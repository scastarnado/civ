/**
 * Persistence System
 * Handles local storage of game state
 */

import { GameState } from '@/core/types';

const SAVE_KEY_PREFIX = 'civ-game-';
const CHUNKS_KEY = 'chunks';
const GAME_STATE_KEY = 'state';
const IDLE_TIME_KEY = 'idle-time';

export class PersistenceManager {
	private gameId: string;

	constructor(gameId: string) {
		this.gameId = gameId;
	}

	/**
	 * Save game state to localStorage
	 */
	saveGameState(gameState: GameState): void {
		try {
			const key = this.getKey(GAME_STATE_KEY);
			const serialized = JSON.stringify(gameState);
			localStorage.setItem(key, serialized);
		} catch (error) {
			console.error('Failed to save game state:', error);
		}
	}

	/**
	 * Load game state from localStorage
	 */
	loadGameState(): GameState | null {
		try {
			const key = this.getKey(GAME_STATE_KEY);
			const data = localStorage.getItem(key);
			if (!data) return null;
			return JSON.parse(data);
		} catch (error) {
			console.error('Failed to load game state:', error);
			return null;
		}
	}

	/**
	 * Save chunks to localStorage
	 */
	saveChunks(chunks: Record<string, unknown>): void {
		try {
			const key = this.getKey(CHUNKS_KEY);
			const serialized = JSON.stringify(chunks);

			// Check storage limit (localStorage usually 5-10MB)
			if (serialized.length > 5 * 1024 * 1024) {
				console.warn('Chunks too large for localStorage, skipping save');
				return;
			}

			localStorage.setItem(key, serialized);
		} catch (error) {
			console.error('Failed to save chunks:', error);
		}
	}

	/**
	 * Load chunks from localStorage
	 */
	loadChunks(): Record<string, unknown> | null {
		try {
			const key = this.getKey(CHUNKS_KEY);
			const data = localStorage.getItem(key);
			if (!data) return null;
			return JSON.parse(data);
		} catch (error) {
			console.error('Failed to load chunks:', error);
			return null;
		}
	}

	/**
	 * Save idle timestamp for offline progression
	 */
	saveIdleTimestamp(): void {
		try {
			const key = this.getKey(IDLE_TIME_KEY);
			localStorage.setItem(key, Date.now().toString());
		} catch (error) {
			console.error('Failed to save idle timestamp:', error);
		}
	}

	/**
	 * Get elapsed idle time
	 */
	getIdleElapsedTime(): number {
		try {
			const key = this.getKey(IDLE_TIME_KEY);
			const saved = localStorage.getItem(key);
			if (!saved) return 0;

			const lastTime = parseInt(saved, 10);
			return Date.now() - lastTime;
		} catch (error) {
			console.error('Failed to get idle time:', error);
			return 0;
		}
	}

	/**
	 * Delete all saved data for this game
	 */
	deleteSave(): void {
		try {
			const gameStateKey = this.getKey(GAME_STATE_KEY);
			const chunksKey = this.getKey(CHUNKS_KEY);
			const idleKey = this.getKey(IDLE_TIME_KEY);

			localStorage.removeItem(gameStateKey);
			localStorage.removeItem(chunksKey);
			localStorage.removeItem(idleKey);
		} catch (error) {
			console.error('Failed to delete save:', error);
		}
	}

	/**
	 * Get list of all saved games
	 */
	static listSavedGames(): string[] {
		try {
			const games: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (
					key &&
					key.startsWith(SAVE_KEY_PREFIX) &&
					key.endsWith(GAME_STATE_KEY)
				) {
					const gameId = key
						.replace(SAVE_KEY_PREFIX, '')
						.replace(`-${GAME_STATE_KEY}`, '');
					if (!games.includes(gameId)) {
						games.push(gameId);
					}
				}
			}
			return games;
		} catch (error) {
			console.error('Failed to list saved games:', error);
			return [];
		}
	}

	/**
	 * Get storage usage
	 */
	static getStorageUsage(): {
		used: number;
		total: number;
		percentage: number;
	} {
		try {
			let used = 0;
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					const value = localStorage.getItem(key);
					if (value) {
						used += key.length + value.length;
					}
				}
			}

			const total = 5 * 1024 * 1024; // Approximate 5MB limit
			return {
				used,
				total,
				percentage: (used / total) * 100,
			};
		} catch (error) {
			console.error('Failed to get storage usage:', error);
			return { used: 0, total: 0, percentage: 0 };
		}
	}

	// ============ Private Methods ============

	private getKey(type: string): string {
		return `${SAVE_KEY_PREFIX}${this.gameId}-${type}`;
	}
}
