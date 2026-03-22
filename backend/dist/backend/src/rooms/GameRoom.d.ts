/**
 * Game Room
 * Manages a single game session
 */
import { WebSocket } from 'ws';
import { GameState, Player } from '../core/types';
export declare class GameRoom {
    private roomId;
    private gameState;
    private players;
    private disconnectedPlayers;
    private disconnectTimers;
    private turnOrder;
    private currentPlayerIndex;
    private isRunning;
    constructor(roomId: string);
    /**
     * Add player to room
     */
    addPlayer(playerId: string, ws?: WebSocket): void;
    hasPlayer(playerId: string): boolean;
    isPlayerDisconnected(playerId: string): boolean;
    markPlayerDisconnected(playerId: string, graceMs: number): void;
    reconnectPlayer(playerId: string, ws: WebSocket | null): void;
    /**
     * Remove player from room
     */
    removePlayer(playerId: string): void;
    /**
     * Start game
     */
    private startGame;
    /**
     * Process player action
     */
    processAction(playerId: string, actionType: string, data: unknown): void;
    /**
     * End current player's turn
     */
    endPlayerTurn(playerId: string): void;
    private forceAdvanceTurnForDisconnectedPlayer;
    /**
     * Get game state
     */
    getGameState(): GameState | null;
    /**
     * Get player count
     */
    getPlayerCount(): number;
    /**
     * Get room ID
     */
    getRoomId(): string;
    /**
     * Check if room is running
     */
    isGameRunning(): boolean;
    /**
     * Broadcast message to all players
     */
    broadcast(message: string): void;
    /**
     * Broadcast state update
     */
    private broadcastState;
    /**
     * Send error to specific player
     */
    private sendError;
    /**
     * Get player by ID
     */
    getPlayer(playerId: string): Player | null;
    /**
     * Get all players
     */
    getPlayers(): Player[];
    private getColorForPlayer;
    /**
     * Update WebSocket connection for player
     */
    updatePlayerConnection(playerId: string, ws: WebSocket): void;
    /**
     * Serialize room state for persistence
     */
    serialize(): unknown;
}
//# sourceMappingURL=GameRoom.d.ts.map