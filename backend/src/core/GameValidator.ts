/**
 * Validation Utilities
 * Server-side validation for game actions
 */

import { City, Player, Unit, ValidationResult } from './types';

export class GameValidator {
	/**
	 * Validate unit movement action
	 */
	static validateUnitMovement(
		unit: Unit,
		targetX: number,
		targetY: number,
	): ValidationResult {
		// Basic validation
		if (!unit) {
			return { valid: false, error: 'Unit not found' };
		}

		if (unit.movementPoints <= 0) {
			return { valid: false, error: 'Unit has no movement points' };
		}

		// Calculate distance (Manhattan)
		const distance = Math.abs(unit.x - targetX) + Math.abs(unit.y - targetY);

		if (distance > unit.movementPoints) {
			return { valid: false, error: 'Insufficient movement points' };
		}

		// In multiplayer, validate terrain passability
		// TODO: Check tile type in map

		return { valid: true };
	}

	/**
	 * Validate unit creation
	 */
	static validateUnitCreation(
		city: City,
		player: Player,
		unitType: string,
	): ValidationResult {
		if (!city) {
			return { valid: false, error: 'City not found' };
		}

		if (city.ownerId !== player.id) {
			return { valid: false, error: 'City not owned by player' };
		}

		// Check production cost
		const productionCost = this.getUnitProductionCost(unitType);

		if (player.resources.production < productionCost) {
			return { valid: false, error: 'Insufficient production' };
		}

		return { valid: true };
	}

	/**
	 * Validate combat action
	 */
	static validateCombat(
		attacker: Unit,
		defender: Unit,
		attacker_player: Player,
	): ValidationResult {
		if (!attacker || !defender) {
			return { valid: false, error: 'Unit not found' };
		}

		if (attacker.ownerId !== attacker_player.id) {
			return { valid: false, error: 'Unit not owned by player' };
		}

		if (attacker.movementPoints <= 0) {
			return { valid: false, error: 'Unit has no movement points' };
		}

		// Calculate distance
		const distance =
			Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);

		if (distance > 1) {
			return { valid: false, error: 'Target too far away' };
		}

		return { valid: true };
	}

	/**
	 * Validate city settlement
	 */
	static validateSettlement(settler: Unit, player: Player): ValidationResult {
		if (!settler) {
			return { valid: false, error: 'Unit not found' };
		}

		if (settler.ownerId !== player.id) {
			return { valid: false, error: 'Unit not owned by player' };
		}

		if (settler.type !== 'settler') {
			return { valid: false, error: 'Unit is not a settler' };
		}

		return { valid: true };
	}

	/**
	 * Get unit production cost
	 */
	private static getUnitProductionCost(unitType: string): number {
		switch (unitType) {
			case 'settler':
				return 100;
			case 'worker':
				return 50;
			case 'warrior':
				return 75;
			default:
				return 100;
		}
	}
}
