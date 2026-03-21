/**
 * AI System
 * Modular AI for computer-controlled players
 */

import { GameEngine } from '@/core/GameEngine';
import { City, Player, Unit, UnitType } from '@/core/types';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

interface AITurnSnapshot {
	cityCount: number;
	settlerCount: number;
	workerCount: number;
	warriorCount: number;
	gold: number;
	food: number;
	production: number;
}

/**
 * AI Decision maker
 */
export class AIPlayer {
	private player: Player;
	private difficulty: AIDifficulty;
	private engine: GameEngine;
	private actionsPerformed: number = 0;

	constructor(player: Player, difficulty: AIDifficulty, engine: GameEngine) {
		this.player = player;
		this.difficulty = difficulty;
		this.engine = engine;
	}

	/**
	 * Execute all AI actions for one full turn.
	 */
	takeTurn(): string {
		this.actionsPerformed = 0;
		const before = this.captureSnapshot();

		// Decide based on difficulty profile
		switch (this.difficulty) {
			case 'easy':
				this.makeEasyDecision();
				break;
			case 'medium':
				this.makeMediumDecision();
				break;
			case 'hard':
				this.makeHardDecision();
				break;
		}

		const after = this.captureSnapshot();
		return this.buildFoggedSummary(before, after);
	}

	private captureSnapshot(): AITurnSnapshot {
		const units = this.player.units;
		return {
			cityCount: this.player.cities.length,
			settlerCount: units.filter((u) => u.type === UnitType.SETTLER).length,
			workerCount: units.filter((u) => u.type === UnitType.WORKER).length,
			warriorCount: units.filter((u) => u.type === UnitType.WARRIOR).length,
			gold: this.player.resources.gold,
			food: this.player.resources.food,
			production: this.player.resources.production,
		};
	}

	private buildFoggedSummary(
		before: AITurnSnapshot,
		after: AITurnSnapshot,
	): string {
		const signals: string[] = [];

		if (after.cityCount > before.cityCount) {
			signals.push('frontier claims expanded');
		}
		if (after.warriorCount > before.warriorCount) {
			signals.push('military drills intensified');
		}
		if (after.settlerCount > before.settlerCount) {
			signals.push('migration convoys were sighted');
		}
		if (after.workerCount > before.workerCount) {
			signals.push('labor detachments regrouped');
		}

		const goldDelta = after.gold - before.gold;
		const foodDelta = after.food - before.food;
		const productionDelta = after.production - before.production;
		if (goldDelta >= 10) {
			signals.push('trade traffic increased');
		}
		if (foodDelta >= 10) {
			signals.push('supply routes stabilized');
		}
		if (productionDelta >= 10) {
			signals.push('industry output rose');
		}

		if (signals.length === 0) {
			signals.push('scouting patterns shifted');
		}

		let activity = 'low';
		if (this.actionsPerformed >= 4) {
			activity = 'high';
		} else if (this.actionsPerformed >= 2) {
			activity = 'moderate';
		}

		const notableSignals = signals.slice(0, 2).join('; ');
		return `${this.player.name} intel: ${activity} activity, ${notableSignals}.`;
	}

	/**
	 * Easy AI: Random movement and basic expansion
	 */
	private makeEasyDecision(): void {
		// 50% chance to move units randomly
		if (Math.random() < 0.5) {
			const unit = this.getRandomUnit();
			if (unit) {
				this.moveUnitRandomly(unit);
				this.tryGatherAtUnitPosition(unit);
			}
		}

		// 20% chance to settle
		if (Math.random() < 0.2) {
			const settler = this.player.units.find(
				(u) => u.type === UnitType.SETTLER,
			);
			if (settler) {
				if (this.engine.settleCity(settler.id)) {
					this.actionsPerformed++;
				}
			}
		}

		// 10% chance to build warrior
		if (Math.random() < 0.1) {
			const city = this.getRandomCity();
			if (city && this.player.resources.production > 75) {
				if (this.engine.createUnit(city.id, UnitType.WARRIOR)) {
					this.actionsPerformed++;
				}
			}
		}
	}

	/**
	 * Medium AI: Strategic expansion and defense
	 */
	private makeMediumDecision(): void {
		// Prioritize expansion
		const settlers = this.player.units.filter(
			(u) => u.type === UnitType.SETTLER,
		);
		if (settlers.length > 0 && this.shouldExpand()) {
			const settler = settlers[0];
			this.moveUnitTowardEmpty(settler);
			this.tryGatherAtUnitPosition(settler);
		}

		// Scouts should explore
		const workers = this.player.units.filter((u) => u.type === UnitType.WORKER);
		workers.forEach((worker) => {
			this.moveUnitRandomly(worker);
			this.tryGatherAtUnitPosition(worker);
		});

		// Build army if threatened
		if (this.isThreatened()) {
			const city = this.getRandomCity();
			if (city && this.player.resources.production > 50) {
				if (this.engine.createUnit(city.id, UnitType.WARRIOR)) {
					this.actionsPerformed++;
				}
			}
		}

		// Build settlers for expansion
		if (this.shouldBuildSettler()) {
			const city = this.getRandomCity();
			if (city && this.player.resources.production > 100) {
				if (this.engine.createUnit(city.id, UnitType.SETTLER)) {
					this.actionsPerformed++;
				}
			}
		}
	}

	/**
	 * Hard AI: Aggressive expansion, military focus, tech race
	 */
	private makeHardDecision(): void {
		// Expand aggressively
		const settlers = this.player.units.filter(
			(u) => u.type === UnitType.SETTLER,
		);
		settlers.forEach((settler) => {
			this.moveUnitTowardEmpty(settler);
			this.tryGatherAtUnitPosition(settler);
		});

		// Move toward potential enemies
		const enemies = this.findNearbyEnemies();
		if (enemies.length > 0) {
			const warriors = this.player.units.filter(
				(u) => u.type === UnitType.WARRIOR,
			);
			warriors.forEach((warrior) => {
				this.moveUnitToward(warrior, enemies[0].x, enemies[0].y);
				this.tryGatherAtUnitPosition(warrior);
			});
		}

		// Maintain strong military
		const militaryRatio =
			this.player.units.filter((u) => u.type === UnitType.WARRIOR).length /
			Math.max(1, this.player.units.length);

		if (militaryRatio < 0.4) {
			this.player.cities.forEach((city) => {
				if (this.player.resources.production > 75) {
					if (this.engine.createUnit(city.id, UnitType.WARRIOR)) {
						this.actionsPerformed++;
					}
				}
			});
		}

		// Maintain expansion
		if (
			this.player.cities.length < Math.floor(this.difficulty === 'hard' ? 5 : 3)
		) {
			this.player.cities.forEach((city) => {
				if (this.player.resources.production > 100) {
					if (this.engine.createUnit(city.id, UnitType.SETTLER)) {
						this.actionsPerformed++;
					}
				}
			});
		}
	}

	// ============ Helper Methods ============

	private getRandomUnit(): Unit | undefined {
		if (this.player.units.length === 0) return undefined;
		return this.player.units[
			Math.floor(Math.random() * this.player.units.length)
		];
	}

	private getRandomCity(): City | undefined {
		if (this.player.cities.length === 0) return undefined;
		return this.player.cities[
			Math.floor(Math.random() * this.player.cities.length)
		];
	}

	private moveUnitRandomly(unit: Unit): void {
		if (unit.movementPoints <= 0) return;
		const dx = Math.random() < 0.5 ? -1 : 1;
		const dy = Math.random() < 0.5 ? -1 : 1;
		const targetX = unit.x + dx;
		const targetY = unit.y + dy;
		if (this.engine.moveUnit(unit.id, targetX, targetY)) {
			this.actionsPerformed++;
		}
	}

	private moveUnitTowardEmpty(unit: Unit): void {
		if (unit.movementPoints <= 0) return;
		// Move toward unexplored areas
		const dx = Math.random() < 0.5 ? -2 : 2;
		const dy = Math.random() < 0.5 ? -2 : 2;
		const targetX = Math.max(0, unit.x + dx);
		const targetY = Math.max(0, unit.y + dy);
		if (this.engine.moveUnit(unit.id, targetX, targetY)) {
			this.actionsPerformed++;
		}
	}

	private moveUnitToward(unit: Unit, targetX: number, targetY: number): void {
		if (unit.movementPoints <= 0) return;
		const dx =
			targetX > unit.x ? 1
			: targetX < unit.x ? -1
			: 0;
		const dy =
			targetY > unit.y ? 1
			: targetY < unit.y ? -1
			: 0;
		const newX = unit.x + dx;
		const newY = unit.y + dy;
		if (this.engine.moveUnit(unit.id, newX, newY)) {
			this.actionsPerformed++;
		}
	}

	private tryGatherAtUnitPosition(unit: Unit): void {
		const status = this.engine.getResourceStatusForUnit(unit.id);
		if (!status || status.mode !== 'none' || status.remaining <= 0) {
			return;
		}

		const activeForHighValue = status.type === 'gold' || status.type === 'iron';
		const result =
			activeForHighValue ?
				this.engine.startActiveGather(unit.id)
			:	this.engine.startIdleGather(unit.id);

		if (result.ok) {
			this.actionsPerformed++;
		}
	}

	private shouldExpand(): boolean {
		return (
			this.difficulty === 'hard' ||
			(this.difficulty === 'medium' && Math.random() < 0.6)
		);
	}

	private shouldBuildSettler(): boolean {
		const settlerRatio =
			this.player.units.filter((u) => u.type === UnitType.SETTLER).length /
			Math.max(1, this.player.units.length);

		if (this.difficulty === 'easy')
			return settlerRatio < 0.2 && Math.random() < 0.1;
		if (this.difficulty === 'medium')
			return settlerRatio < 0.3 && Math.random() < 0.3;
		return settlerRatio < 0.4; // hard
	}

	private isThreatened(): boolean {
		const enemies = this.findNearbyEnemies();
		return enemies.length > 0;
	}

	private findNearbyEnemies(): Unit[] {
		const gameState = this.engine.getGameState();
		const enemies: Unit[] = [];
		const anchor = this.player.units[0];
		if (!anchor) return enemies;

		gameState.players.forEach((player) => {
			if (player.id !== this.player.id) {
				player.units.forEach((unit) => {
					const distance =
						Math.abs(unit.x - anchor.x) + Math.abs(unit.y - anchor.y);
					if (distance < 20) {
						enemies.push(unit);
					}
				});
			}
		});

		return enemies;
	}
}

/**
 * AI Manager - handles all AI players
 */
export class AIManager {
	private aiPlayers: Map<string, AIPlayer> = new Map();
	private engine: GameEngine;
	private onAITurnResolved?: (message: string) => void;
	private turnTokenInProgress: string | null = null;
	private pendingTurnEndAt: number = 0;
	private pendingSummary: string | null = null;
	private readonly aiTurnDelayMs: number = 700;

	constructor(engine: GameEngine) {
		this.engine = engine;
	}

	/**
	 * Register AI player
	 */
	registerAI(player: Player, difficulty: AIDifficulty): void {
		const ai = new AIPlayer(player, difficulty, this.engine);
		this.aiPlayers.set(player.id, ai);
	}

	setTurnResolvedCallback(callback: (message: string) => void): void {
		this.onAITurnResolved = callback;
	}

	/**
	 * Update all AI players
	 */
	update(): void {
		const gameState = this.engine.getGameState();
		const currentPlayer =
			gameState.players[this.engine.getCurrentPlayerIndex()];
		const turnToken = `${gameState.turn}:${currentPlayer.id}`;
		const now = Date.now();

		if (!currentPlayer.isAI || !this.aiPlayers.has(currentPlayer.id)) {
			this.turnTokenInProgress = null;
			this.pendingSummary = null;
			this.pendingTurnEndAt = 0;
			return;
		}

		// Start processing this AI turn once.
		if (this.turnTokenInProgress !== turnToken) {
			const ai = this.aiPlayers.get(currentPlayer.id)!;
			this.pendingSummary = ai.takeTurn();
			this.turnTokenInProgress = turnToken;
			this.pendingTurnEndAt = now + this.aiTurnDelayMs;
			return;
		}

		// End turn after a short delay so turn flow is visible.
		if (this.pendingSummary && now >= this.pendingTurnEndAt) {
			this.engine.endTurn();
			this.onAITurnResolved?.(`${this.pendingSummary} Turn ended.`);
			this.pendingSummary = null;
		}
	}

	/**
	 * Check if current player is AI
	 */
	isCurrentPlayerAI(): boolean {
		const gameState = this.engine.getGameState();
		const currentPlayer =
			gameState.players[this.engine.getCurrentPlayerIndex()];
		return currentPlayer.isAI;
	}
}
