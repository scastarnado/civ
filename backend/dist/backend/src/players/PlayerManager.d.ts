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
export declare class PlayerManager {
    private players;
    /**
     * Add connected player
     */
    addPlayer(playerId: string, ws: WebSocket): void;
    /**
     * Remove player
     */
    removePlayer(playerId: string): void;
    /**
     * Get player
     */
    getPlayer(playerId: string): ConnectedPlayer | null;
    /**
     * Get all active players
     */
    getActivePlayers(): ConnectedPlayer[];
    /**
     * Get all players
     */
    getAllPlayers(): ConnectedPlayer[];
    /**
     * Check if player exists
     */
    hasPlayer(playerId: string): boolean;
    /**
     * Get player count
     */
    getPlayerCount(): number;
    /**
     * Get active player count
     */
    getActivePlayerCount(): number;
    /**
     * Broadcast message to all players
     */
    broadcast(message: string, excludePlayerId?: string): void;
    /**
     * Send message to specific player
     */
    sendToPlayer(playerId: string, message: string): void;
    /**
     * Cleanup inactive players
     */
    cleanupInactive(maxInactiveMs?: number): void;
    /**
     * Get player statistics
     */
    getStats(): Record<string, unknown>;
}
//# sourceMappingURL=PlayerManager.d.ts.map