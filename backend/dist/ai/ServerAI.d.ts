/**
 * Backend AI System
 * Server-side AI for multiplayer games
 */
import { Player } from '../core/types';
export type AIDifficulty = 'easy' | 'medium' | 'hard';
export declare class ServerAIPlayer {
    private player;
    private difficulty;
    private decisionQueueSize;
    constructor(player: Player, difficulty: AIDifficulty);
    /**
     * Get AI's next decision
     */
    getNextDecision(): {
        action: string;
        data: unknown;
    } | null;
    /**
     * Queue decisions for this turn
     */
    queueDecisions(): void;
    private getEasyDecision;
    private getMediumDecision;
    private getHardDecision;
    /**
     * Get AI's evaluation of current position
     */
    evaluatePosition(): number;
}
export declare class ServerAIManager {
    private aiPlayers;
    /**
     * Register server-side AI player
     */
    registerAI(player: Player, difficulty: AIDifficulty): void;
    /**
     * Queue decisions for all AI players
     */
    queueAllDecisions(): void;
    /**
     * Get next decision for a player
     */
    getNextDecision(playerId: string): {
        action: string;
        data: unknown;
    } | null;
    /**
     * Is this an AI player
     */
    isAI(playerId: string): boolean;
    /**
     * Remove AI player
     */
    removeAI(playerId: string): void;
}
//# sourceMappingURL=ServerAI.d.ts.map