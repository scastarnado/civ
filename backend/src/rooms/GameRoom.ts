/**
 * Game Room
 * Manages a single game session
 */

import { WebSocket } from 'ws';
import { GameState, NetworkMessage, Player } from '../core/types';

export class GameRoom {
	private roomId: string;
	private gameState: GameState | null = null;
	private players: Map<string, { ws: WebSocket | null; player: Player }> =
		new Map();
	private turnOrder: string[] = [];
	private currentPlayerIndex: number = 0;
	private isRunning: boolean = false;

	constructor(roomId: string) {
		this.roomId = roomId;
	}

	/**
	 * Add player to room
	 */
	addPlayer(playerId: string, ws?: WebSocket): void {
		if (this.players.has(playerId)) {
			return; // Player already in room
		}

		const player: Player = {
			id: playerId,
			name: `Player ${this.players.size + 1}`,
			isAI: false,
			isHuman: true,
			resources: { gold: 100, food: 50, production: 25 },
			units: [],
			cities: [],
			techs: [],
			color: this.getColorForPlayer(this.players.size),
		};

		this.players.set(playerId, { ws: ws || null, player });
		this.turnOrder.push(playerId);

		// Start game if we have enough players
		if (this.players.size >= 2) {
			this.startGame();
		}
	}

	/**
	 * Remove player from room
	 */
	removePlayer(playerId: string): void {
		this.players.delete(playerId);
		this.turnOrder = this.turnOrder.filter((id) => id !== playerId);

		if (this.players.size === 0) {
			this.isRunning = false;
		}
	}

	/**
	 * Start game
	 */
	private startGame(): void {
		if (this.isRunning || this.players.size < 2) return;

		this.isRunning = true;
		console.log(`Starting game in room ${this.roomId}`);

		// Initialize game state
		const gameState: GameState = {
			id: this.roomId,
			turn: 0,
			maxPlayers: 4,
			players: Array.from(this.players.values()).map((p) => p.player),
			chunks: new Map(),
			worldSeed: Math.floor(Math.random() * 2147483647),
			isMultiplayer: true,
			createdAt: Date.now(),
			lastUpdateAt: Date.now(),
		};

		this.gameState = gameState;

		// Broadcast game started
		this.broadcastState('GAME_STARTED', gameState);
	}

	/**
	 * Process player action
	 */
	processAction(playerId: string, actionType: string, data: unknown): void {
		if (!this.gameState) return;

		// Validate it's the current player's turn
		const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
		if (playerId !== currentPlayerId) {
			this.sendError(playerId, 'Not your turn');
			return;
		}

		switch (actionType) {
			case 'MOVE_UNIT':
				// Server-side validation of unit movement
				console.log(`Action: Move unit for player ${playerId}`);
				this.broadcastState('ACTION_EXECUTED', { action: actionType, data });
				break;

			default:
				console.warn(`Unknown action: ${actionType}`);
				break;
		}
	}

	/**
	 * End current player's turn
	 */
	endPlayerTurn(playerId: string): void {
		const currentPlayerId = this.turnOrder[this.currentPlayerIndex];

		if (playerId !== currentPlayerId) {
			this.sendError(playerId, 'Not your turn');
			return;
		}

		// Advance turn
		this.currentPlayerIndex =
			(this.currentPlayerIndex + 1) % this.turnOrder.length;

		if (this.gameState) {
			if (this.currentPlayerIndex === 0) {
				this.gameState.turn++;
			}

			// Notify all players
			this.broadcastState('TURN_CHANGED', {
				turn: this.gameState.turn,
				currentPlayerIndex: this.currentPlayerIndex,
			});
		}
	}

	/**
	 * Get game state
	 */
	getGameState(): GameState | null {
		return this.gameState;
	}

	/**
	 * Get player count
	 */
	getPlayerCount(): number {
		return this.players.size;
	}

	/**
	 * Get room ID
	 */
	getRoomId(): string {
		return this.roomId;
	}

	/**
	 * Check if room is running
	 */
	isGameRunning(): boolean {
		return this.isRunning;
	}

	/**
	 * Broadcast message to all players
	 */
	broadcast(message: string): void {
		this.players.forEach((playerObj) => {
			if (playerObj.ws && playerObj.ws.readyState === 1) {
				// WebSocket.OPEN === 1
				playerObj.ws.send(message);
			}
		});
	}

	/**
	 * Broadcast state update
	 */
	private broadcastState(type: string, data: unknown): void {
		const message: NetworkMessage = {
			type,
			payload: data,
			timestamp: Date.now(),
		};

		this.broadcast(JSON.stringify(message));
	}

	/**
	 * Send error to specific player
	 */
	private sendError(playerId: string, error: string): void {
		const playerObj = this.players.get(playerId);
		if (playerObj?.ws && playerObj.ws.readyState === 1) {
			const message: NetworkMessage = {
				type: 'ERROR',
				payload: { error },
				timestamp: Date.now(),
			};

			playerObj.ws.send(JSON.stringify(message));
		}
	}

	/**
	 * Get player by ID
	 */
	getPlayer(playerId: string): Player | null {
		const playerObj = this.players.get(playerId);
		return playerObj?.player || null;
	}

	/**
	 * Get all players
	 */
	getPlayers(): Player[] {
		return Array.from(this.players.values()).map((p) => p.player);
	}

	// ============ Helper Methods ============

	private getColorForPlayer(index: number): string {
		const colors = ['#00ff00', '#ff0000', '#0000ff', '#ffff00'];
		return colors[index % colors.length];
	}

	/**
	 * Update WebSocket connection for player
	 */
	updatePlayerConnection(playerId: string, ws: WebSocket): void {
		const playerObj = this.players.get(playerId);
		if (playerObj) {
			playerObj.ws = ws;
		}
	}

	/**
	 * Serialize room state for persistence
	 */
	serialize(): unknown {
		return {
			roomId: this.roomId,
			gameState: this.gameState,
			turnOrder: this.turnOrder,
			currentPlayerIndex: this.currentPlayerIndex,
			isRunning: this.isRunning,
		};
	}
}
