/**
 * Persistence System
 * Handles local storage of game state
 */
import { GameState } from '@/core/types';
export declare class PersistenceManager {
    private gameId;
    constructor(gameId: string);
    /**
     * Save game state to localStorage
     */
    saveGameState(gameState: GameState): void;
    /**
     * Load game state from localStorage
     */
    loadGameState(): GameState | null;
    /**
     * Save chunks to localStorage
     */
    saveChunks(chunks: Record<string, unknown>): void;
    /**
     * Load chunks from localStorage
     */
    loadChunks(): Record<string, unknown> | null;
    /**
     * Save idle timestamp for offline progression
     */
    saveIdleTimestamp(): void;
    /**
     * Get elapsed idle time
     */
    getIdleElapsedTime(): number;
    /**
     * Delete all saved data for this game
     */
    deleteSave(): void;
    /**
     * Get list of all saved games
     */
    static listSavedGames(): string[];
    /**
     * Get storage usage
     */
    static getStorageUsage(): {
        used: number;
        total: number;
        percentage: number;
    };
    private getKey;
}
//# sourceMappingURL=PersistenceManager.d.ts.map