/**
 * Validation Utilities
 * Server-side validation for game actions
 */
import { City, Player, Unit, ValidationResult } from './types';
export declare class GameValidator {
    /**
     * Validate unit movement action
     */
    static validateUnitMovement(unit: Unit, targetX: number, targetY: number): ValidationResult;
    /**
     * Validate unit creation
     */
    static validateUnitCreation(city: City, player: Player, unitType: string): ValidationResult;
    /**
     * Validate combat action
     */
    static validateCombat(attacker: Unit, defender: Unit, attacker_player: Player): ValidationResult;
    /**
     * Validate city settlement
     */
    static validateSettlement(settler: Unit, player: Player): ValidationResult;
    /**
     * Get unit production cost
     */
    private static getUnitProductionCost;
}
//# sourceMappingURL=GameValidator.d.ts.map