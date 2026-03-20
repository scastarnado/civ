/**
 * Player Manager
 * Manages connected players
 */

import { WebSocket } from 'ws';

export interface ConnectedPlayer {
	id: string;
	ws: WebSocket;
	connectedAt: number;
	isActive: boolean;
}

export class PlayerManager {
	private players: Map<string, ConnectedPlayer> = new Map();

	/**
	 * Add connected player
	 */
	addPlayer(playerId: string, ws: WebSocket): void {
		if (this.players.has(playerId)) {
			// Update connection
			const player = this.players.get(playerId)!;
			player.ws = ws;
			player.isActive = true;
			return;
		}

		this.players.set(playerId, {
			id: playerId,
			ws,
			connectedAt: Date.now(),
			isActive: true,
		});

		console.log(`Player registered: ${playerId} (Total: ${this.players.size})`);
	}

	/**
	 * Remove player
	 */
	removePlayer(playerId: string): void {
		const player = this.players.get(playerId);
		if (player) {
			player.isActive = false;
		}
	}

	/**
	 * Get player
	 */
	getPlayer(playerId: string): ConnectedPlayer | null {
		return this.players.get(playerId) || null;
	}

	/**
	 * Get all active players
	 */
	getActivePlayers(): ConnectedPlayer[] {
		return Array.from(this.players.values()).filter((p) => p.isActive);
	}

	/**
	 * Get all players
	 */
	getAllPlayers(): ConnectedPlayer[] {
		return Array.from(this.players.values());
	}

	/**
	 * Check if player exists
	 */
	hasPlayer(playerId: string): boolean {
		return this.players.has(playerId);
	}

	/**
	 * Get player count
	 */
	getPlayerCount(): number {
		return this.players.size;
	}

	/**
	 * Get active player count
	 */
	getActivePlayerCount(): number {
		return this.getActivePlayers().length;
	}

	/**
	 * Broadcast message to all players
	 */
	broadcast(message: string, excludePlayerId?: string): void {
		this.players.forEach((player) => {
			if (excludePlayerId && player.id === excludePlayerId) {
				return;
			}

			if (player.isActive && player.ws.readyState === 1) {
				// WebSocket.OPEN === 1
				player.ws.send(message);
			}
		});
	}

	/**
	 * Send message to specific player
	 */
	sendToPlayer(playerId: string, message: string): void {
		const player = this.players.get(playerId);
		if (player && player.isActive && player.ws.readyState === 1) {
			player.ws.send(message);
		}
	}

	/**
	 * Cleanup inactive players
	 */
	cleanupInactive(maxInactiveMs: number = 5 * 60 * 1000): void {
		// 5 minutes default
		const now = Date.now();

		this.players.forEach((player, playerId) => {
			if (!player.isActive && now - player.connectedAt > maxInactiveMs) {
				this.players.delete(playerId);
				console.log(`Cleaned up inactive player: ${playerId}`);
			}
		});
	}

	/**
	 * Get player statistics
	 */
	getStats(): Record<string, unknown> {
		return {
			totalPlayers: this.players.size,
			activePlayers: this.getActivePlayerCount(),
			inactivePlayers: this.players.size - this.getActivePlayerCount(),
		};
	}
}
