/**
 * Game Room
 * Manages one lobby/game session.
 */

import { WebSocket } from 'ws';
import { GameState, NetworkMessage, Player } from '../core/types';

export interface LobbyPlayerSummary {
	id: string;
	name: string;
	connected: boolean;
}

export interface LobbySnapshot {
	roomId: string;
	lobbyCode: string;
	hostPlayerId: string;
	players: LobbyPlayerSummary[];
	maxPlayers: number;
	started: boolean;
}

export class GameRoom {
	private roomId: string;
	private lobbyCode: string;
	private hostPlayerId: string;
	private gameState: GameState | null = null;
	private players: Map<string, { ws: WebSocket | null; player: Player }> =
		new Map();
	private disconnectedPlayers: Map<
		string,
		{ disconnectedAt: number; graceUntil: number }
	> = new Map();
	private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> =
		new Map();
	private turnOrder: string[] = [];
	private currentPlayerIndex: number = 0;
	private isRunning: boolean = false;

	constructor(roomId: string, lobbyCode: string, hostPlayerId: string) {
		this.roomId = roomId;
		this.lobbyCode = lobbyCode;
		this.hostPlayerId = hostPlayerId;
	}

	addPlayer(playerId: string, playerName: string, ws?: WebSocket): void {
		if (this.players.has(playerId)) {
			this.reconnectPlayer(playerId, ws || null);
			this.updatePlayerName(playerId, playerName);
			return;
		}

		const player: Player = {
			id: playerId,
			name: playerName,
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
	}

	updatePlayerName(playerId: string, playerName: string): void {
		const playerObj = this.players.get(playerId);
		if (!playerObj) return;
		playerObj.player.name = playerName;
		if (this.gameState) {
			const statePlayer = this.gameState.players.find((p) => p.id === playerId);
			if (statePlayer) {
				statePlayer.name = playerName;
			}
		}
	}

	hasPlayer(playerId: string): boolean {
		return this.players.has(playerId);
	}

	isPlayerDisconnected(playerId: string): boolean {
		return this.disconnectedPlayers.has(playerId);
	}

	markPlayerDisconnected(playerId: string, graceMs: number): void {
		const playerObj = this.players.get(playerId);
		if (!playerObj) return;

		playerObj.ws = null;
		const now = Date.now();
		const graceUntil = now + graceMs;
		this.disconnectedPlayers.set(playerId, { disconnectedAt: now, graceUntil });

		this.broadcastState('PLAYER_DISCONNECTED', {
			playerId,
			graceMs,
		});

		const existingTimer = this.disconnectTimers.get(playerId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		const timer = setTimeout(() => {
			if (!this.disconnectedPlayers.has(playerId)) return;

			const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
			if (currentPlayerId === playerId && this.isRunning) {
				this.forceAdvanceTurnForDisconnectedPlayer(playerId);
			}

			this.removePlayer(playerId);
			this.broadcastState('PLAYER_REMOVED', {
				playerId,
				reason: 'disconnect-timeout',
			});
		}, graceMs);

		this.disconnectTimers.set(playerId, timer);
	}

	reconnectPlayer(playerId: string, ws: WebSocket | null): void {
		const playerObj = this.players.get(playerId);
		if (!playerObj) return;

		playerObj.ws = ws;
		if (this.disconnectedPlayers.has(playerId)) {
			this.disconnectedPlayers.delete(playerId);
			const timer = this.disconnectTimers.get(playerId);
			if (timer) {
				clearTimeout(timer);
				this.disconnectTimers.delete(playerId);
			}

			this.broadcastState('PLAYER_RECONNECTED', { playerId });
		}
	}

	removePlayer(playerId: string): void {
		const existingTimer = this.disconnectTimers.get(playerId);
		if (existingTimer) {
			clearTimeout(existingTimer);
			this.disconnectTimers.delete(playerId);
		}

		this.disconnectedPlayers.delete(playerId);

		const removedIndex = this.turnOrder.indexOf(playerId);
		this.players.delete(playerId);
		this.turnOrder = this.turnOrder.filter((id) => id !== playerId);

		if (this.gameState) {
			this.gameState.players = this.gameState.players.filter(
				(player) => player.id !== playerId,
			);
		}

		if (removedIndex !== -1 && this.turnOrder.length > 0) {
			if (removedIndex < this.currentPlayerIndex) {
				this.currentPlayerIndex -= 1;
			}
			if (this.currentPlayerIndex >= this.turnOrder.length) {
				this.currentPlayerIndex = 0;
			}
		}

		if (playerId === this.hostPlayerId && this.turnOrder.length > 0) {
			this.hostPlayerId = this.turnOrder[0];
		}

		if (this.players.size === 0) {
			this.isRunning = false;
		}
	}

	startGame(): boolean {
		if (this.isRunning || this.players.size < 2) return false;

		this.isRunning = true;
		console.log(`Starting game in room ${this.roomId}`);

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
		this.broadcastState('GAME_STARTED', {
			roomId: this.roomId,
			worldSeed: gameState.worldSeed,
			players: gameState.players.map((p) => ({ id: p.id, name: p.name })),
		});
		return true;
	}

	processAction(playerId: string, actionType: string, data: unknown): void {
		if (!this.gameState) return;

		const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
		if (playerId !== currentPlayerId) {
			sendErrorForPlayer(this.players, playerId, 'Not your turn');
			return;
		}

		switch (actionType) {
			case 'MOVE_UNIT':
				this.broadcastState('ACTION_EXECUTED', { action: actionType, data });
				break;
			default:
				break;
		}
	}

	endPlayerTurn(playerId: string): void {
		if (!this.isRunning || this.turnOrder.length === 0) return;

		const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
		if (playerId !== currentPlayerId) {
			sendErrorForPlayer(this.players, playerId, 'Not your turn');
			return;
		}

		this.currentPlayerIndex =
			(this.currentPlayerIndex + 1) % this.turnOrder.length;

		if (this.gameState) {
			if (this.currentPlayerIndex === 0) {
				this.gameState.turn++;
			}
			this.broadcastState('TURN_CHANGED', {
				turn: this.gameState.turn,
				currentPlayerIndex: this.currentPlayerIndex,
			});
		}
	}

	private forceAdvanceTurnForDisconnectedPlayer(playerId: string): void {
		if (!this.gameState || this.turnOrder.length === 0) return;
		const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
		if (currentPlayerId !== playerId) return;

		this.currentPlayerIndex =
			(this.currentPlayerIndex + 1) % this.turnOrder.length;
		if (this.currentPlayerIndex === 0) {
			this.gameState.turn++;
		}

		this.broadcastState('TURN_AUTO_SKIPPED', {
			skippedPlayerId: playerId,
			turn: this.gameState.turn,
			currentPlayerIndex: this.currentPlayerIndex,
		});
	}

	getGameState(): GameState | null {
		return this.gameState;
	}

	getPlayerCount(): number {
		return this.players.size;
	}

	getRoomId(): string {
		return this.roomId;
	}

	getLobbyCode(): string {
		return this.lobbyCode;
	}

	getHostPlayerId(): string {
		return this.hostPlayerId;
	}

	setHostPlayerId(playerId: string): void {
		this.hostPlayerId = playerId;
	}

	isGameRunning(): boolean {
		return this.isRunning;
	}

	getLobbySnapshot(maxPlayers: number = 4): LobbySnapshot {
		return {
			roomId: this.roomId,
			lobbyCode: this.lobbyCode,
			hostPlayerId: this.hostPlayerId,
			players: Array.from(this.players.values()).map(({ player, ws }) => ({
				id: player.id,
				name: player.name,
				connected: !!ws,
			})),
			maxPlayers,
			started: this.isRunning,
		};
	}

	broadcast(message: string): void {
		this.players.forEach((playerObj) => {
			if (playerObj.ws && playerObj.ws.readyState === 1) {
				playerObj.ws.send(message);
			}
		});
	}

	private broadcastState(type: string, data: unknown): void {
		const message: NetworkMessage = {
			type,
			payload: data,
			timestamp: Date.now(),
		};
		this.broadcast(JSON.stringify(message));
	}

	getPlayer(playerId: string): Player | null {
		const playerObj = this.players.get(playerId);
		return playerObj?.player || null;
	}

	getPlayers(): Player[] {
		return Array.from(this.players.values()).map((p) => p.player);
	}

	updatePlayerConnection(playerId: string, ws: WebSocket): void {
		this.reconnectPlayer(playerId, ws);
	}

	private getColorForPlayer(index: number): string {
		const colors = ['#00ff00', '#ff0000', '#0000ff', '#ffff00'];
		return colors[index % colors.length];
	}
}

function sendErrorForPlayer(
	players: Map<string, { ws: WebSocket | null; player: Player }>,
	playerId: string,
	error: string,
): void {
	const playerObj = players.get(playerId);
	if (playerObj?.ws && playerObj.ws.readyState === 1) {
		const message: NetworkMessage = {
			type: 'ERROR',
			payload: { error },
			timestamp: Date.now(),
		};
		playerObj.ws.send(JSON.stringify(message));
	}
}
