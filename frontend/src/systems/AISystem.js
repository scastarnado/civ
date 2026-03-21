/**
 * AI System
 * Modular AI for computer-controlled players
 */
import { UnitType } from '@/core/types';
/**
 * AI Decision maker
 */
export class AIPlayer {
    constructor(player, difficulty, engine) {
        this.actionsPerformed = 0;
        this.player = player;
        this.difficulty = difficulty;
        this.engine = engine;
    }
    /**
     * Execute all AI actions for one full turn.
     */
    takeTurn() {
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
    captureSnapshot() {
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
    buildFoggedSummary(before, after) {
        const signals = [];
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
        }
        else if (this.actionsPerformed >= 2) {
            activity = 'moderate';
        }
        const notableSignals = signals.slice(0, 2).join('; ');
        return `${this.player.name} intel: ${activity} activity, ${notableSignals}.`;
    }
    /**
     * Easy AI: Random movement and basic expansion
     */
    makeEasyDecision() {
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
            const settler = this.player.units.find((u) => u.type === UnitType.SETTLER);
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
    makeMediumDecision() {
        // Prioritize expansion
        const settlers = this.player.units.filter((u) => u.type === UnitType.SETTLER);
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
    makeHardDecision() {
        // Expand aggressively
        const settlers = this.player.units.filter((u) => u.type === UnitType.SETTLER);
        settlers.forEach((settler) => {
            this.moveUnitTowardEmpty(settler);
            this.tryGatherAtUnitPosition(settler);
        });
        // Move toward potential enemies
        const enemies = this.findNearbyEnemies();
        if (enemies.length > 0) {
            const warriors = this.player.units.filter((u) => u.type === UnitType.WARRIOR);
            warriors.forEach((warrior) => {
                this.moveUnitToward(warrior, enemies[0].x, enemies[0].y);
                this.tryGatherAtUnitPosition(warrior);
            });
        }
        // Maintain strong military
        const militaryRatio = this.player.units.filter((u) => u.type === UnitType.WARRIOR).length /
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
        if (this.player.cities.length < Math.floor(this.difficulty === 'hard' ? 5 : 3)) {
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
    getRandomUnit() {
        if (this.player.units.length === 0)
            return undefined;
        return this.player.units[Math.floor(Math.random() * this.player.units.length)];
    }
    getRandomCity() {
        if (this.player.cities.length === 0)
            return undefined;
        return this.player.cities[Math.floor(Math.random() * this.player.cities.length)];
    }
    moveUnitRandomly(unit) {
        if (unit.movementPoints <= 0)
            return;
        const dx = Math.random() < 0.5 ? -1 : 1;
        const dy = Math.random() < 0.5 ? -1 : 1;
        const targetX = unit.x + dx;
        const targetY = unit.y + dy;
        if (this.engine.moveUnit(unit.id, targetX, targetY)) {
            this.actionsPerformed++;
        }
    }
    moveUnitTowardEmpty(unit) {
        if (unit.movementPoints <= 0)
            return;
        // Move toward unexplored areas
        const dx = Math.random() < 0.5 ? -2 : 2;
        const dy = Math.random() < 0.5 ? -2 : 2;
        const targetX = Math.max(0, unit.x + dx);
        const targetY = Math.max(0, unit.y + dy);
        if (this.engine.moveUnit(unit.id, targetX, targetY)) {
            this.actionsPerformed++;
        }
    }
    moveUnitToward(unit, targetX, targetY) {
        if (unit.movementPoints <= 0)
            return;
        const dx = targetX > unit.x ? 1
            : targetX < unit.x ? -1
                : 0;
        const dy = targetY > unit.y ? 1
            : targetY < unit.y ? -1
                : 0;
        const newX = unit.x + dx;
        const newY = unit.y + dy;
        if (this.engine.moveUnit(unit.id, newX, newY)) {
            this.actionsPerformed++;
        }
    }
    tryGatherAtUnitPosition(unit) {
        const status = this.engine.getResourceStatusForUnit(unit.id);
        if (!status || status.mode !== 'none' || status.remaining <= 0) {
            return;
        }
        const activeForHighValue = status.type === 'gold' || status.type === 'iron';
        const result = activeForHighValue ?
            this.engine.startActiveGather(unit.id)
            : this.engine.startIdleGather(unit.id);
        if (result.ok) {
            this.actionsPerformed++;
        }
    }
    shouldExpand() {
        return (this.difficulty === 'hard' ||
            (this.difficulty === 'medium' && Math.random() < 0.6));
    }
    shouldBuildSettler() {
        const settlerRatio = this.player.units.filter((u) => u.type === UnitType.SETTLER).length /
            Math.max(1, this.player.units.length);
        if (this.difficulty === 'easy')
            return settlerRatio < 0.2 && Math.random() < 0.1;
        if (this.difficulty === 'medium')
            return settlerRatio < 0.3 && Math.random() < 0.3;
        return settlerRatio < 0.4; // hard
    }
    isThreatened() {
        const enemies = this.findNearbyEnemies();
        return enemies.length > 0;
    }
    findNearbyEnemies() {
        const gameState = this.engine.getGameState();
        const enemies = [];
        const anchor = this.player.units[0];
        if (!anchor)
            return enemies;
        gameState.players.forEach((player) => {
            if (player.id !== this.player.id) {
                player.units.forEach((unit) => {
                    const distance = Math.abs(unit.x - anchor.x) + Math.abs(unit.y - anchor.y);
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
    constructor(engine) {
        this.aiPlayers = new Map();
        this.turnTokenInProgress = null;
        this.pendingTurnEndAt = 0;
        this.pendingSummary = null;
        this.aiTurnDelayMs = 700;
        this.engine = engine;
    }
    /**
     * Register AI player
     */
    registerAI(player, difficulty) {
        const ai = new AIPlayer(player, difficulty, this.engine);
        this.aiPlayers.set(player.id, ai);
    }
    setTurnResolvedCallback(callback) {
        this.onAITurnResolved = callback;
    }
    /**
     * Update all AI players
     */
    update() {
        const gameState = this.engine.getGameState();
        const currentPlayer = gameState.players[this.engine.getCurrentPlayerIndex()];
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
            const ai = this.aiPlayers.get(currentPlayer.id);
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
    isCurrentPlayerAI() {
        const gameState = this.engine.getGameState();
        const currentPlayer = gameState.players[this.engine.getCurrentPlayerIndex()];
        return currentPlayer.isAI;
    }
}
//# sourceMappingURL=AISystem.js.map