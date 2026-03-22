/**
 * Game Room
 * Manages one lobby/game session.
 */
import { WebSocket } from 'ws';
import { GameState, Player } from '../core/types';
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
export declare class GameRoom {
    private roomId;
    private lobbyCode;
    private hostPlayerId;
    private gameState;
    private players;
    private disconnectedPlayers;
    private disconnectTimers;
    private turnOrder;
    private currentPlayerIndex;
    private isRunning;
    constructor(roomId: string, lobbyCode: string, hostPlayerId: string);
    addPlayer(playerId: string, playerName: string, ws?: WebSocket): void;
    updatePlayerName(playerId: string, playerName: string): void;
    hasPlayer(playerId: string): boolean;
    isPlayerDisconnected(playerId: string): boolean;
    markPlayerDisconnected(playerId: string, graceMs: number): void;
    reconnectPlayer(playerId: string, ws: WebSocket | null): void;
    removePlayer(playerId: string): void;
    startGame(): boolean;
    processAction(playerId: string, actionType: string, data: unknown): void;
    endPlayerTurn(playerId: string): void;
    private forceAdvanceTurnForDisconnectedPlayer;
    getGameState(): GameState | null;
    getPlayerCount(): number;
    getRoomId(): string;
    getLobbyCode(): string;
    getHostPlayerId(): string;
    setHostPlayerId(playerId: string): void;
    isGameRunning(): boolean;
    getLobbySnapshot(maxPlayers?: number): LobbySnapshot;
    broadcast(message: string): void;
    private broadcastState;
    getPlayer(playerId: string): Player | null;
    getPlayers(): Player[];
    updatePlayerConnection(playerId: string, ws: WebSocket): void;
    private getColorForPlayer;
}
//# sourceMappingURL=GameRoom.d.ts.map