/**
 * Core Game Engine
 * Manages main game loop, turns, and state transitions
 */
import { City, CityManagementData, GameState, MountainDestroyStatus, Player, ResourceNodeStatus, Unit, UnitType } from '@/core/types';
import { MapCache } from '@/map/ChunkSystem';
export declare class GameEngine {
    private gameState;
    private mapCache;
    private currentPlayerIndex;
    private isRunning;
    private tickCallbacks;
    private resourceNodes;
    private mountainDestroyTasks;
    constructor(worldSeed: number, maxPlayers?: number);
    addPlayer(player: Player): void;
    startGame(): void;
    private initializePlayer;
    /**
     * Main game tick - called each frame
     */
    tick(deltaMs: number): void;
    /**
     * Register callback for each game tick
     */
    onTick(callback: (deltaMs: number) => void): void;
    private updateGameState;
    /**
     * End current player's turn and advance to next
     */
    endTurn(): void;
    getCurrentPlayer(): Player;
    getCurrentPlayerIndex(): number;
    /**
     * Move a unit from one location to another
     */
    moveUnit(unitId: string, targetX: number, targetY: number): boolean;
    startActiveGather(unitId: string): {
        ok: boolean;
        message: string;
    };
    startIdleGather(unitId: string): {
        ok: boolean;
        message: string;
    };
    getResourceStatusForUnit(unitId: string): ResourceNodeStatus | null;
    beginMountainDestroyAttempt(unitId: string, targetX: number, targetY: number): {
        ok: boolean;
        message: string;
    };
    confirmMountainDestroy(unitId: string): {
        ok: boolean;
        message: string;
    };
    cancelMountainDestroy(unitId: string): {
        ok: boolean;
        message: string;
    };
    getMountainDestroyStatusForUnit(unitId: string): MountainDestroyStatus | null;
    getResourceStatusAt(x: number, y: number): ResourceNodeStatus | null;
    isPlayerActionLocked(playerId: string): boolean;
    isPlayerGatherLocked(playerId: string): boolean;
    private isPlayerMountainLocked;
    /**
     * Create a unit in a city
     */
    createUnit(cityId: string, unitType: UnitType): Unit | null;
    /**
     * Settle a new city with a settler
     */
    settleCity(settlerId: string): City | null;
    /**
     * Simple combat resolution
     * damage = attacker_attack - defender_defense + random(0-5)
     */
    attack(attackerUnitId: string, defenderUnitId: string): void;
    /**
     * Calculate idle progression when player returns
     */
    calculateIdleProgression(elapsedMs: number): void;
    getCityManagementData(playerId: string, cityId: string): CityManagementData | null;
    applyCityOption(playerId: string, cityId: string, optionId: string): {
        ok: boolean;
        message: string;
    };
    private updatePlayerResources;
    getPlayerVisionBonus(playerId: string): number;
    private updateResourceNodes;
    private depleteNode;
    private harvestNodeAmount;
    private getOrCreateResourceNodeAt;
    private createResourceNodeRuntime;
    private toNodeStatus;
    private progressResourceRespawnsByTurn;
    private progressMountainDestroyByTurn;
    private resourceNodeKey;
    private isUnitInActiveGather;
    private isUnitInMountainDestroy;
    private isUnitBusy;
    private toMountainDestroyStatus;
    private cancelIdleGatherForUnit;
    private findPlayer;
    private findUnit;
    private findCity;
    private getUnitProductionCost;
    private getUnitMovement;
    private getUnitAttack;
    private getUnitDefense;
    private createDefaultProgression;
    private canAfford;
    private payCost;
    private recalculateCityScale;
    private applyResearchEffects;
    private applyProgressionBonus;
    private reapplyUnitProgression;
    private getBuildingIdleYield;
    private generateId;
    getGameState(): GameState;
    getMapCache(): MapCache;
    isGameRunning(): boolean;
    getTurn(): number;
}
//# sourceMappingURL=GameEngine.d.ts.map