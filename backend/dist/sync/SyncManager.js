/**
 * Synchronization Helper
 * Manages state sync between clients and server
 */
export class SyncManager {
    constructor() {
        this.snapshots = [];
        this.maxSnapshots = 100;
        this.eventLog = [];
        this.maxEvents = 1000;
    }
    /**
     * Save state snapshot
     */
    saveSnapshot(state) {
        const snapshot = {
            turn: state.turn,
            timestamp: state.lastUpdateAt,
            state: JSON.parse(JSON.stringify(state)), // Deep copy
        };
        this.snapshots.push(snapshot);
        // Limit snapshot count
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
    }
    /**
     * Get state at specific turn
     */
    getStateAtTurn(turn) {
        const snapshot = this.snapshots.find((s) => s.turn === turn);
        return snapshot ? snapshot.state : null;
    }
    /**
     * Get latest state
     */
    getLatestState() {
        return this.snapshots.length > 0 ?
            this.snapshots[this.snapshots.length - 1].state
            : null;
    }
    /**
     * Log game event
     */
    logEvent(event) {
        this.eventLog.push(event);
        if (this.eventLog.length > this.maxEvents) {
            this.eventLog.shift();
        }
    }
    /**
     * Get events since turn
     */
    getEventsSinceTurn() {
        return this.eventLog.filter(() => {
            // Events have game data, extract turn if needed
            return true; // Simplified for now
        });
    }
    /**
     * Get all events
     */
    getAllEvents() {
        return [...this.eventLog];
    }
    /**
     * Create delta between two states (for optimized sync)
     */
    createDelta(oldState, newState) {
        if (!oldState) {
            return newState; // No delta, send full state
        }
        const delta = {};
        // Only include changed fields
        if (oldState.turn !== newState.turn) {
            delta.turn = newState.turn;
        }
        if (JSON.stringify(oldState.players) !== JSON.stringify(newState.players)) {
            delta.players = newState.players;
        }
        // Other fields...
        return delta;
    }
    /**
     * Merge delta with base state
     */
    applyDelta(baseState, delta) {
        return {
            ...baseState,
            ...delta,
        };
    }
    /**
     * Clear all snapshots (cleanup)
     */
    clearSnapshots() {
        this.snapshots = [];
    }
    /**
     * Clear all events (cleanup)
     */
    clearEvents() {
        this.eventLog = [];
    }
    /**
     * Get sync statistics
     */
    getStats() {
        return {
            snapshotCount: this.snapshots.length,
            eventCount: this.eventLog.length,
        };
    }
}
//# sourceMappingURL=SyncManager.js.map