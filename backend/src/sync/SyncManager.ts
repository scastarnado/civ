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

export class SyncManager {
	private snapshots: StateSnapshot[] = [];
	private maxSnapshots: number = 100;
	private eventLog: GameEvent[] = [];
	private maxEvents: number = 1000;

	/**
	 * Save state snapshot
	 */
	saveSnapshot(state: GameState): void {
		const snapshot: StateSnapshot = {
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
	getStateAtTurn(turn: number): GameState | null {
		const snapshot = this.snapshots.find((s) => s.turn === turn);
		return snapshot ? snapshot.state : null;
	}

	/**
	 * Get latest state
	 */
	getLatestState(): GameState | null {
		return this.snapshots.length > 0 ?
				this.snapshots[this.snapshots.length - 1].state
			:	null;
	}

	/**
	 * Log game event
	 */
	logEvent(event: GameEvent): void {
		this.eventLog.push(event);

		if (this.eventLog.length > this.maxEvents) {
			this.eventLog.shift();
		}
	}

	/**
	 * Get events since turn
	 */
	getEventsSinceTurn(): GameEvent[] {
		return this.eventLog.filter(() => {
			// Events have game data, extract turn if needed
			return true; // Simplified for now
		});
	}

	/**
	 * Get all events
	 */
	getAllEvents(): GameEvent[] {
		return [...this.eventLog];
	}

	/**
	 * Create delta between two states (for optimized sync)
	 */
	createDelta(
		oldState: GameState | null,
		newState: GameState,
	): Partial<GameState> {
		if (!oldState) {
			return newState; // No delta, send full state
		}

		const delta: Partial<GameState> = {};

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
	applyDelta(baseState: GameState, delta: Partial<GameState>): GameState {
		return {
			...baseState,
			...delta,
		};
	}

	/**
	 * Clear all snapshots (cleanup)
	 */
	clearSnapshots(): void {
		this.snapshots = [];
	}

	/**
	 * Clear all events (cleanup)
	 */
	clearEvents(): void {
		this.eventLog = [];
	}

	/**
	 * Get sync statistics
	 */
	getStats(): Record<string, unknown> {
		return {
			snapshotCount: this.snapshots.length,
			eventCount: this.eventLog.length,
		};
	}
}
