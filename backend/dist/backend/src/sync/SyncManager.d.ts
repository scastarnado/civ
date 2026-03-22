/**
 * Synchronization Helper
 * Manages state sync between clients and server
 */
import { GameEvent, GameState } from '../core/types';
export interface StateSnapshot {
    turn: number;
    timestamp: number;
    state: GameState;
}
export declare class SyncManager {
    private snapshots;
    private maxSnapshots;
    private eventLog;
    private maxEvents;
    /**
     * Save state snapshot
     */
    saveSnapshot(state: GameState): void;
    /**
     * Get state at specific turn
     */
    getStateAtTurn(turn: number): GameState | null;
    /**
     * Get latest state
     */
    getLatestState(): GameState | null;
    /**
     * Log game event
     */
    logEvent(event: GameEvent): void;
    /**
     * Get events since turn
     */
    getEventsSinceTurn(): GameEvent[];
    /**
     * Get all events
     */
    getAllEvents(): GameEvent[];
    /**
     * Create delta between two states (for optimized sync)
     */
    createDelta(oldState: GameState | null, newState: GameState): Partial<GameState>;
    /**
     * Merge delta with base state
     */
    applyDelta(baseState: GameState, delta: Partial<GameState>): GameState;
    /**
     * Clear all snapshots (cleanup)
     */
    clearSnapshots(): void;
    /**
     * Clear all events (cleanup)
     */
    clearEvents(): void;
    /**
     * Get sync statistics
     */
    getStats(): Record<string, unknown>;
}
//# sourceMappingURL=SyncManager.d.ts.map