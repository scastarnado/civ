/**
 * AI System
 * Modular AI for computer-controlled players
 */
import { GameEngine } from '@/core/GameEngine';
import { Player } from '@/core/types';
export type AIDifficulty = 'easy' | 'medium' | 'hard';
/**
 * AI Decision maker
 */
export declare class AIPlayer {
    private player;
    private difficulty;
    private engine;
    private actionsPerformed;
    constructor(player: Player, difficulty: AIDifficulty, engine: GameEngine);
    /**
     * Execute all AI actions for one full turn.
     */
    takeTurn(): string;
    private captureSnapshot;
    private buildFoggedSummary;
    /**
     * Easy AI: Random movement and basic expansion
     */
    private makeEasyDecision;
    /**
     * Medium AI: Strategic expansion and defense
     */
    private makeMediumDecision;
    /**
     * Hard AI: Aggressive expansion, military focus, tech race
     */
    private makeHardDecision;
    private getRandomUnit;
    private getRandomCity;
    private moveUnitRandomly;
    private moveUnitTowardEmpty;
    private moveUnitToward;
    private tryGatherAtUnitPosition;
    private shouldExpand;
    private shouldBuildSettler;
    private isThreatened;
    private findNearbyEnemies;
}
/**
 * AI Manager - handles all AI players
 */
export declare class AIManager {
    private aiPlayers;
    private engine;
    private onAITurnResolved?;
    private turnTokenInProgress;
    private pendingTurnEndAt;
    private pendingSummary;
    private readonly aiTurnDelayMs;
    constructor(engine: GameEngine);
    /**
     * Register AI player
     */
    registerAI(player: Player, difficulty: AIDifficulty): void;
    setTurnResolvedCallback(callback: (message: string) => void): void;
    /**
     * Update all AI players
     */
    update(): void;
    /**
     * Check if current player is AI
     */
    isCurrentPlayerAI(): boolean;
}
//# sourceMappingURL=AISystem.d.ts.map