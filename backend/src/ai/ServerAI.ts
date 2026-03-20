/**
 * Backend AI System
 * Server-side AI for multiplayer games
 */

import { Player, Unit, UnitType } from '../core/types';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export class ServerAIPlayer {
	private player: Player;
	private difficulty: AIDifficulty;
	private decisionQueueSize: number = 0;

	constructor(player: Player, difficulty: AIDifficulty) {
		this.player = player;
		this.difficulty = difficulty;
	}

	/**
	 * Get AI's next decision
	 */
	getNextDecision(): { action: string; data: unknown } | null {
		if (this.decisionQueueSize <= 0) {
			return null;
		}

		this.decisionQueueSize--;

		switch (this.difficulty) {
			case 'easy':
				return this.getEasyDecision();
			case 'medium':
				return this.getMediumDecision();
			case 'hard':
				return this.getHardDecision();
		}
	}

	/**
	 * Queue decisions for this turn
	 */
	queueDecisions(): void {
		// Depending on difficulty, queue different number of decisions
		switch (this.difficulty) {
			case 'easy':
				this.decisionQueueSize = Math.floor(Math.random() * 3);
				break;
			case 'medium':
				this.decisionQueueSize = Math.floor(Math.random() * 5) + 1;
				break;
			case 'hard':
				this.decisionQueueSize = Math.floor(Math.random() * 7) + 3;
				break;
		}
	}

	private getEasyDecision(): { action: string; data: unknown } | null {
		// Random unit movement
		if (this.player.units.length > 0) {
			const unit =
				this.player.units[Math.floor(Math.random() * this.player.units.length)];
			return {
				action: 'MOVE_UNIT',
				data: {
					unitId: unit.id,
					targetX: unit.x + (Math.random() < 0.5 ? -1 : 1),
					targetY: unit.y + (Math.random() < 0.5 ? -1 : 1),
				},
			};
		}

		return null;
	}

	private getMediumDecision(): { action: string; data: unknown } | null {
		// Mix of strategic and random decisions
		// Prioritize expansion, defense

		if (Math.random() < 0.3) {
			// Expand
			const settler = this.player.units.find(
				(u: Unit) => u.type === UnitType.SETTLER,
			);
			if (settler) {
				return {
					action: 'MOVE_UNIT',
					data: {
						unitId: settler.id,
						targetX: settler.x + (Math.random() < 0.5 ? -2 : 2),
						targetY: settler.y + (Math.random() < 0.5 ? -2 : 2),
					},
				};
			}
		}

		// Scout
		const worker = this.player.units.find(
			(u: Unit) => u.type === UnitType.WORKER,
		);
		if (worker) {
			return {
				action: 'MOVE_UNIT',
				data: {
					unitId: worker.id,
					targetX: worker.x + (Math.random() < 0.5 ? -1 : 1),
					targetY: worker.y + (Math.random() < 0.5 ? -1 : 1),
				},
			};
		}

		return null;
	}

	private getHardDecision(): { action: string; data: unknown } | null {
		// Aggressive strategy
		// Prioritize expansion, build strong military

		const rand = Math.random();

		if (rand < 0.4) {
			// Aggressive expansion
			const settler = this.player.units.find(
				(u: Unit) => u.type === UnitType.SETTLER,
			);
			if (settler) {
				return {
					action: 'MOVE_UNIT',
					data: {
						unitId: settler.id,
						targetX: settler.x + (Math.random() < 0.5 ? -3 : 3),
						targetY: settler.y + (Math.random() < 0.5 ? -3 : 3),
					},
				};
			}
		} else if (rand < 0.6) {
			// Build army
			if (this.player.cities.length > 0) {
				const city = this.player.cities[0];
				return {
					action: 'CREATE_UNIT',
					data: {
						cityId: city.id,
						unitType: UnitType.WARRIOR,
					},
				};
			}
		} else {
			// General scouting/aggression move
			const warrior = this.player.units.find(
				(u: Unit) => u.type === UnitType.WARRIOR,
			);
			if (warrior) {
				return {
					action: 'MOVE_UNIT',
					data: {
						unitId: warrior.id,
						targetX: warrior.x + (Math.random() < 0.5 ? -2 : 2),
						targetY: warrior.y + (Math.random() < 0.5 ? -2 : 2),
					},
				};
			}
		}

		return null;
	}

	/**
	 * Get AI's evaluation of current position
	 */
	evaluatePosition(): number {
		let score = 0;

		// Score based on cities
		score += this.player.cities.length * 100;

		// Score based on units
		score += this.player.units.length * 10;

		// Score based on resources
		score += this.player.resources.gold * 0.1;
		score += this.player.resources.production * 0.5;

		return score;
	}
}

export class ServerAIManager {
	private aiPlayers: Map<string, ServerAIPlayer> = new Map();

	/**
	 * Register server-side AI player
	 */
	registerAI(player: Player, difficulty: AIDifficulty): void {
		const ai = new ServerAIPlayer(player, difficulty);
		this.aiPlayers.set(player.id, ai);
	}

	/**
	 * Queue decisions for all AI players
	 */
	queueAllDecisions(): void {
		this.aiPlayers.forEach((ai) => {
			ai.queueDecisions();
		});
	}

	/**
	 * Get next decision for a player
	 */
	getNextDecision(playerId: string): { action: string; data: unknown } | null {
		const ai = this.aiPlayers.get(playerId);
		return ai ? ai.getNextDecision() : null;
	}

	/**
	 * Is this an AI player
	 */
	isAI(playerId: string): boolean {
		return this.aiPlayers.has(playerId);
	}

	/**
	 * Remove AI player
	 */
	removeAI(playerId: string): void {
		this.aiPlayers.delete(playerId);
	}
}
