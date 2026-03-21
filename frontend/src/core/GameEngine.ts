/**
 * Core Game Engine
 * Manages main game loop, turns, and state transitions
 */

import {
	City,
	CityBuildingType,
	CityManagementData,
	CityManagementOption,
	GameState,
	MountainDestroyStatus,
	Player,
	PlayerProgression,
	PlayerResources,
	ResearchType,
	ResourceNodeStatus,
	ResourceNodeType,
	Tile,
	TileType,
	Unit,
	UnitType,
} from '@/core/types';
import { MapCache } from '@/map/ChunkSystem';

interface ResourceNodeRuntime {
	key: string;
	type: ResourceNodeType;
	x: number;
	y: number;
	capacity: number;
	remaining: number;
	respawnTurns: number;
	respawnTurnsRemaining: number;
	activeGather?: {
		unitId: string;
		playerId: string;
		startedAt: number;
		durationMs: number;
	};
	idleGather?: {
		unitId: string;
		playerId: string;
		lastTickAt: number;
		intervalMs: number;
		chunkAmount: number;
	};
}

interface MountainDestroyRuntime {
	unitId: string;
	playerId: string;
	x: number;
	y: number;
	originX: number;
	originY: number;
	movementSpent: number;
	totalTurns: number;
	remainingTurns: number;
	mode: 'pending' | 'destroying';
}

interface ResourceProfile {
	capacity: number;
	activeDurationMs: number;
	respawnTurns: number;
	idleIntervalMs: number;
	idleChunkAmount: number;
	fullYield: PlayerResources;
}

interface BuildingDefinition {
	type: CityBuildingType;
	name: string;
	category: 'military' | 'improvements' | 'civil';
	description: string;
	cost: PlayerResources;
	idleYieldBonus: PlayerResources;
	prerequisites?: ResearchType[];
}

interface ResearchDefinition {
	type: ResearchType;
	name: string;
	category: 'military' | 'improvements' | 'civil';
	description: string;
	cost: PlayerResources;
	prerequisites?: ResearchType[];
}

const RESOURCE_PROFILES: Record<ResourceNodeType, ResourceProfile> = {
	[ResourceNodeType.WHEAT]: {
		capacity: 100,
		activeDurationMs: 4500,
		respawnTurns: 6,
		idleIntervalMs: 5000,
		idleChunkAmount: 20,
		fullYield: { gold: 0, food: 40, production: 0 },
	},
	[ResourceNodeType.DEER]: {
		capacity: 100,
		activeDurationMs: 5000,
		respawnTurns: 6,
		idleIntervalMs: 5000,
		idleChunkAmount: 20,
		fullYield: { gold: 4, food: 32, production: 0 },
	},
	[ResourceNodeType.IRON]: {
		capacity: 100,
		activeDurationMs: 6000,
		respawnTurns: 8,
		idleIntervalMs: 5000,
		idleChunkAmount: 20,
		fullYield: { gold: 0, food: 0, production: 36 },
	},
	[ResourceNodeType.HORSES]: {
		capacity: 100,
		activeDurationMs: 5500,
		respawnTurns: 7,
		idleIntervalMs: 5000,
		idleChunkAmount: 20,
		fullYield: { gold: 6, food: 8, production: 22 },
	},
	[ResourceNodeType.GOLD]: {
		capacity: 100,
		activeDurationMs: 6500,
		respawnTurns: 10,
		idleIntervalMs: 5000,
		idleChunkAmount: 20,
		fullYield: { gold: 44, food: 0, production: 0 },
	},
};

const BUILDING_DEFINITIONS: Record<CityBuildingType, BuildingDefinition> = {
	[CityBuildingType.GRANARY]: {
		type: CityBuildingType.GRANARY,
		name: 'Granary',
		category: 'improvements',
		description: 'Improves idle food growth in this city.',
		cost: { gold: 20, food: 10, production: 40 },
		idleYieldBonus: { gold: 0, food: 0.08, production: 0 },
	},
	[CityBuildingType.WORKSHOP]: {
		type: CityBuildingType.WORKSHOP,
		name: 'Workshop',
		category: 'improvements',
		description: 'Improves idle production in this city.',
		cost: { gold: 25, food: 0, production: 50 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.08 },
	},
	[CityBuildingType.MARKET]: {
		type: CityBuildingType.MARKET,
		name: 'Market',
		category: 'civil',
		description: 'Generates passive gold income.',
		cost: { gold: 30, food: 0, production: 60 },
		idleYieldBonus: { gold: 0.06, food: 0, production: 0 },
	},
	[CityBuildingType.BARRACKS]: {
		type: CityBuildingType.BARRACKS,
		name: 'Barracks',
		category: 'military',
		description: 'Unlocks stronger military training options.',
		cost: { gold: 35, food: 5, production: 70 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.02 },
	},
	[CityBuildingType.WATCHTOWER]: {
		type: CityBuildingType.WATCHTOWER,
		name: 'Watchtower',
		category: 'civil',
		description: 'Boosts scouting and map awareness.',
		cost: { gold: 30, food: 0, production: 55 },
		idleYieldBonus: { gold: 0.02, food: 0, production: 0 },
		prerequisites: [ResearchType.SCOUTING],
	},
};

const RESEARCH_DEFINITIONS: Record<ResearchType, ResearchDefinition> = {
	[ResearchType.LOGISTICS]: {
		type: ResearchType.LOGISTICS,
		name: 'Logistics',
		category: 'military',
		description: '+1 movement for all units.',
		cost: { gold: 30, food: 20, production: 60 },
	},
	[ResearchType.SCOUTING]: {
		type: ResearchType.SCOUTING,
		name: 'Scouting',
		category: 'civil',
		description: '+1 vision range for units and cities.',
		cost: { gold: 25, food: 15, production: 45 },
	},
	[ResearchType.METALLURGY]: {
		type: ResearchType.METALLURGY,
		name: 'Metallurgy',
		category: 'military',
		description: '+1 attack and +1 defense for all units.',
		cost: { gold: 40, food: 20, production: 80 },
		prerequisites: [ResearchType.LOGISTICS],
	},
	[ResearchType.AGRONOMY]: {
		type: ResearchType.AGRONOMY,
		name: 'Agronomy',
		category: 'improvements',
		description: '+20% passive food generation.',
		cost: { gold: 35, food: 25, production: 55 },
	},
	[ResearchType.INDUSTRIALIZATION]: {
		type: ResearchType.INDUSTRIALIZATION,
		name: 'Industrialization',
		category: 'improvements',
		description: '+20% passive production generation.',
		cost: { gold: 45, food: 20, production: 90 },
		prerequisites: [ResearchType.AGRONOMY],
	},
};

export class GameEngine {
	private gameState: GameState;
	private mapCache: MapCache;
	private currentPlayerIndex: number = 0;
	private isRunning: boolean = false;
	private tickCallbacks: ((deltaMs: number) => void)[] = [];
	private resourceNodes: Map<string, ResourceNodeRuntime> = new Map();
	private mountainDestroyTasks: Map<string, MountainDestroyRuntime> = new Map();

	constructor(worldSeed: number, maxPlayers: number = 4) {
		this.mapCache = new MapCache(worldSeed);
		this.gameState = {
			id: this.generateId(),
			turn: 0,
			maxPlayers,
			players: [],
			chunks: new Map(),
			worldSeed,
			isMultiplayer: false,
			createdAt: Date.now(),
			lastUpdateAt: Date.now(),
		};
	}

	// ============ Game Initialization ============

	addPlayer(player: Player): void {
		if (this.gameState.players.length >= this.gameState.maxPlayers) {
			throw new Error('Max players reached');
		}
		this.gameState.players.push(player);
	}

	startGame(): void {
		if (this.gameState.players.length === 0) {
			throw new Error('No players in game');
		}

		// Initialize players with starting units and cities
		this.gameState.players.forEach((player) => {
			this.initializePlayer(player);
		});

		this.isRunning = true;
		// Initialize time tracking
	}

	private initializePlayer(player: Player): void {
		player.progression = player.progression || this.createDefaultProgression();
		player.techs = player.techs || [];

		// Initialize resources
		player.resources = {
			gold: 100,
			food: 50,
			production: 25,
		};

		// Create initial settler unit
		const settler: Unit = {
			id: this.generateId(),
			ownerId: player.id,
			type: UnitType.SETTLER,
			x: Math.floor(Math.random() * 100),
			y: Math.floor(Math.random() * 100),
			health: 10,
			maxHealth: 10,
			movementPoints: 2 + player.progression.unitMovementBonus,
			maxMovementPoints: 2 + player.progression.unitMovementBonus,
			attack: 1 + player.progression.attackBonus,
			defense: 1 + player.progression.defenseBonus,
			automated: false,
		};

		player.units.push(settler);

		// Create initial city
		const city: City = {
			id: this.generateId(),
			ownerId: player.id,
			name: `${player.name}'s City`,
			x: settler.x,
			y: settler.y,
			population: 5,
			food: 25,
			production: 10,
			productionQueue: [],
			level: 1,
			footprintRadius: 0,
			buildings: [],
		};

		player.cities.push(city);
	}

	// ============ Game Loop ============

	/**
	 * Main game tick - called each frame
	 */
	tick(deltaMs: number): void {
		if (!this.isRunning) return;

		this.gameState.lastUpdateAt = Date.now();

		// Update game state based on elapsed time
		this.updateGameState(deltaMs);

		// Notify all listeners
		this.tickCallbacks.forEach((callback) => callback(deltaMs));
	}

	/**
	 * Register callback for each game tick
	 */
	onTick(callback: (deltaMs: number) => void): void {
		this.tickCallbacks.push(callback);
	}

	private updateGameState(deltaMs: number): void {
		// Update city resources passively
		this.gameState.players.forEach((player) => {
			this.updatePlayerResources(player, deltaMs);
		});

		this.updateResourceNodes();
	}

	// ============ Turn Management ============

	/**
	 * End current player's turn and advance to next
	 */
	endTurn(): void {
		const currentPlayer = this.getCurrentPlayer();

		// Reset unit movement points
		currentPlayer.units.forEach((unit) => {
			unit.movementPoints = unit.maxMovementPoints;
		});

		// Advance to next player
		this.currentPlayerIndex =
			(this.currentPlayerIndex + 1) % this.gameState.players.length;

		// If cycled back to first player, increment turn counter
		if (this.currentPlayerIndex === 0) {
			this.gameState.turn++;
		}

		this.progressResourceRespawnsByTurn();
		this.progressMountainDestroyByTurn();
	}

	getCurrentPlayer(): Player {
		return this.gameState.players[this.currentPlayerIndex];
	}

	getCurrentPlayerIndex(): number {
		return this.currentPlayerIndex;
	}

	// ============ Player Actions ============

	/**
	 * Move a unit from one location to another
	 */
	moveUnit(unitId: string, targetX: number, targetY: number): boolean {
		const unit = this.findUnit(unitId);
		if (!unit) return false;

		if (this.isUnitBusy(unitId)) {
			return false;
		}

		// Calculate distance (simplified Manhattan distance)
		const distance = Math.abs(unit.x - targetX) + Math.abs(unit.y - targetY);

		if (distance > unit.movementPoints) {
			return false; // Not enough movement points
		}

		// Check if destination is walkable (not water, mountain, etc.)
		const tile = this.mapCache.getTile(targetX, targetY);
		if (
			!tile ||
			tile.type === TileType.WATER ||
			tile.type === TileType.MOUNTAIN
		) {
			return false; // Cannot move to water or mountain
		}

		const moved = unit.x !== targetX || unit.y !== targetY;
		if (moved) {
			this.cancelIdleGatherForUnit(unitId);
		}

		unit.x = targetX;
		unit.y = targetY;
		unit.movementPoints -= distance;

		return true;
	}

	startActiveGather(unitId: string): { ok: boolean; message: string } {
		const unit = this.findUnit(unitId);
		if (!unit) return { ok: false, message: 'Unit not found.' };

		const node = this.getOrCreateResourceNodeAt(unit.x, unit.y);
		if (!node) {
			return { ok: false, message: 'No resource node on this tile.' };
		}

		if (node.respawnTurnsRemaining > 0 || node.remaining <= 0) {
			return {
				ok: false,
				message: `This node is respawning. ${node.respawnTurnsRemaining} turn(s) left.`,
			};
		}

		node.idleGather = undefined;
		node.activeGather = {
			unitId,
			playerId: unit.ownerId,
			startedAt: Date.now(),
			durationMs: RESOURCE_PROFILES[node.type].activeDurationMs,
		};

		return { ok: true, message: 'Active gathering started.' };
	}

	startIdleGather(unitId: string): { ok: boolean; message: string } {
		const unit = this.findUnit(unitId);
		if (!unit) return { ok: false, message: 'Unit not found.' };

		const node = this.getOrCreateResourceNodeAt(unit.x, unit.y);
		if (!node) {
			return { ok: false, message: 'No resource node on this tile.' };
		}

		if (node.respawnTurnsRemaining > 0 || node.remaining <= 0) {
			return {
				ok: false,
				message: `This node is respawning. ${node.respawnTurnsRemaining} turn(s) left.`,
			};
		}

		node.activeGather = undefined;
		node.idleGather = {
			unitId,
			playerId: unit.ownerId,
			lastTickAt: Date.now(),
			intervalMs: RESOURCE_PROFILES[node.type].idleIntervalMs,
			chunkAmount: RESOURCE_PROFILES[node.type].idleChunkAmount,
		};

		return { ok: true, message: 'Idle gathering started.' };
	}

	getResourceStatusForUnit(unitId: string): ResourceNodeStatus | null {
		const unit = this.findUnit(unitId);
		if (!unit) return null;

		const node = this.getOrCreateResourceNodeAt(unit.x, unit.y);
		if (!node) return null;

		return this.toNodeStatus(node);
	}

	beginMountainDestroyAttempt(
		unitId: string,
		targetX: number,
		targetY: number,
	): { ok: boolean; message: string } {
		const unit = this.findUnit(unitId);
		if (!unit) return { ok: false, message: 'Unit not found.' };

		if (unit.type !== UnitType.SETTLER) {
			return { ok: false, message: 'Only settlers can destroy mountains.' };
		}

		if (this.isUnitBusy(unitId)) {
			return {
				ok: false,
				message: 'This unit is already busy with another action.',
			};
		}

		const distance = Math.abs(unit.x - targetX) + Math.abs(unit.y - targetY);
		if (distance > unit.movementPoints) {
			return { ok: false, message: 'Not enough movement points.' };
		}

		const tile = this.mapCache.getTile(targetX, targetY);
		if (!tile || tile.type !== TileType.MOUNTAIN) {
			return { ok: false, message: 'Target tile is not a mountain.' };
		}

		this.cancelIdleGatherForUnit(unitId);

		const task: MountainDestroyRuntime = {
			unitId,
			playerId: unit.ownerId,
			x: targetX,
			y: targetY,
			originX: unit.x,
			originY: unit.y,
			movementSpent: distance,
			totalTurns: 10,
			remainingTurns: 10,
			mode: 'pending',
		};

		unit.x = targetX;
		unit.y = targetY;
		unit.movementPoints = Math.max(0, unit.movementPoints - distance);
		this.mountainDestroyTasks.set(unitId, task);

		return {
			ok: true,
			message: 'Settler reached mountain. Choose destroy or ignore.',
		};
	}

	confirmMountainDestroy(unitId: string): { ok: boolean; message: string } {
		const task = this.mountainDestroyTasks.get(unitId);
		if (!task) {
			return { ok: false, message: 'No mountain action found for this unit.' };
		}

		task.mode = 'destroying';
		return {
			ok: true,
			message: `Mountain destruction started (${task.totalTurns} turns).`,
		};
	}

	cancelMountainDestroy(unitId: string): { ok: boolean; message: string } {
		const task = this.mountainDestroyTasks.get(unitId);
		if (!task) {
			return { ok: false, message: 'No mountain action found for this unit.' };
		}

		const unit = this.findUnit(unitId);
		if (unit) {
			unit.x = task.originX;
			unit.y = task.originY;
			unit.movementPoints = Math.min(
				unit.maxMovementPoints,
				unit.movementPoints + task.movementSpent,
			);
		}

		this.mountainDestroyTasks.delete(unitId);
		return { ok: true, message: 'Mountain action ignored. Settler returned.' };
	}

	getMountainDestroyStatusForUnit(
		unitId: string,
	): MountainDestroyStatus | null {
		const task = this.mountainDestroyTasks.get(unitId);
		if (!task) return null;
		return this.toMountainDestroyStatus(task);
	}

	getResourceStatusAt(x: number, y: number): ResourceNodeStatus | null {
		const node = this.getOrCreateResourceNodeAt(x, y);
		if (!node) return null;
		return this.toNodeStatus(node);
	}

	isPlayerActionLocked(playerId: string): boolean {
		return (
			this.isPlayerGatherLocked(playerId) ||
			this.isPlayerMountainLocked(playerId)
		);
	}

	isPlayerGatherLocked(playerId: string): boolean {
		for (const node of this.resourceNodes.values()) {
			if (node.activeGather?.playerId === playerId) {
				return true;
			}
		}
		return false;
	}

	private isPlayerMountainLocked(playerId: string): boolean {
		for (const task of this.mountainDestroyTasks.values()) {
			if (task.playerId === playerId) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Create a unit in a city
	 */
	createUnit(cityId: string, unitType: UnitType): Unit | null {
		const city = this.findCity(cityId);
		if (!city) return null;

		const unitCost = this.getUnitProductionCost(unitType);
		const player = this.findPlayer(city.ownerId);
		if (!player || player.resources.production < unitCost) {
			return null; // Not enough production
		}

		const unit: Unit = {
			id: this.generateId(),
			ownerId: city.ownerId,
			type: unitType,
			x: city.x,
			y: city.y,
			health: 10,
			maxHealth: 10,
			movementPoints:
				this.getUnitMovement(unitType) + player.progression.unitMovementBonus,
			maxMovementPoints:
				this.getUnitMovement(unitType) + player.progression.unitMovementBonus,
			attack: this.getUnitAttack(unitType) + player.progression.attackBonus,
			defense: this.getUnitDefense(unitType) + player.progression.defenseBonus,
			automated: false,
		};

		player.units.push(unit);
		player.resources.production -= unitCost;

		return unit;
	}

	/**
	 * Settle a new city with a settler
	 */
	settleCity(settlerId: string): City | null {
		const settler = this.findUnit(settlerId);
		if (!settler || settler.type !== UnitType.SETTLER) {
			return null;
		}

		const player = this.findPlayer(settler.ownerId);
		if (!player) return null;

		const newCity: City = {
			id: this.generateId(),
			ownerId: settler.ownerId,
			name: `${player.name}'s City ${player.cities.length + 1}`,
			x: settler.x,
			y: settler.y,
			population: 1,
			food: 10,
			production: 5,
			productionQueue: [],
			level: 1,
			footprintRadius: 0,
			buildings: [],
		};

		player.cities.push(newCity);

		// Remove settler from game
		player.units = player.units.filter((u) => u.id !== settlerId);

		return newCity;
	}

	// ============ Combat ============

	/**
	 * Simple combat resolution
	 * damage = attacker_attack - defender_defense + random(0-5)
	 */
	attack(attackerUnitId: string, defenderUnitId: string): void {
		const attacker = this.findUnit(attackerUnitId);
		const defender = this.findUnit(defenderUnitId);

		if (!attacker || !defender) return;

		const damage = Math.max(
			1,
			attacker.attack - defender.defense + Math.random() * 5,
		);
		defender.health -= damage;

		if (defender.health <= 0) {
			// Remove defeated unit
			const owner = this.findPlayer(defender.ownerId);
			if (owner) {
				owner.units = owner.units.filter((u) => u.id !== defenderUnitId);
			}
		}

		// Attacker loses movement
		attacker.movementPoints = 0;
	}

	// ============ Idle Progression ============

	/**
	 * Calculate idle progression when player returns
	 */
	calculateIdleProgression(elapsedMs: number): void {
		const elapsedMinutes = elapsedMs / 60000;

		this.gameState.players.forEach((player) => {
			// Resource generation: cities generate food/production over time
			const totalProduction = player.cities.reduce(
				(sum, city) => sum + city.production,
				0,
			);
			const totalFood = player.cities.reduce((sum, city) => sum + city.food, 0);

			const idleResourcesPerMinute = {
				gold: totalProduction * 0.1,
				food: totalFood * 0.2,
				production: totalProduction * 0.3,
			};

			player.resources.gold += idleResourcesPerMinute.gold * elapsedMinutes;
			player.resources.food += idleResourcesPerMinute.food * elapsedMinutes;
			player.resources.production +=
				idleResourcesPerMinute.production * elapsedMinutes;
		});
	}

	// ============ Helper Methods ============

	getCityManagementData(
		playerId: string,
		cityId: string,
	): CityManagementData | null {
		const player = this.findPlayer(playerId);
		if (!player) return null;

		const city = player.cities.find((c) => c.id === cityId);
		if (!city) return null;

		const options: CityManagementOption[] = [];

		Object.values(BUILDING_DEFINITIONS).forEach((building) => {
			const owned = city.buildings.includes(building.type);
			const lockedByPrerequisite = (building.prerequisites || []).some(
				(prereq) => !player.techs.includes(prereq),
			);
			options.push({
				id: building.type,
				kind: 'building',
				category: building.category,
				name: building.name,
				description: building.description,
				cost: { ...building.cost },
				owned,
				canAfford: this.canAfford(player.resources, building.cost),
				lockedByPrerequisite,
			});
		});

		Object.values(RESEARCH_DEFINITIONS).forEach((research) => {
			const owned = player.techs.includes(research.type);
			const lockedByPrerequisite = (research.prerequisites || []).some(
				(prereq) => !player.techs.includes(prereq),
			);
			options.push({
				id: research.type,
				kind: 'research',
				category: research.category,
				name: research.name,
				description: research.description,
				cost: { ...research.cost },
				owned,
				canAfford: this.canAfford(player.resources, research.cost),
				lockedByPrerequisite,
			});
		});

		return {
			cityId: city.id,
			cityName: city.name,
			level: city.level,
			population: city.population,
			buildings: [...city.buildings],
			playerResources: { ...player.resources },
			options,
		};
	}

	applyCityOption(
		playerId: string,
		cityId: string,
		optionId: string,
	): { ok: boolean; message: string } {
		const player = this.findPlayer(playerId);
		if (!player) return { ok: false, message: 'Player not found.' };

		const city = player.cities.find((c) => c.id === cityId);
		if (!city) return { ok: false, message: 'City not found.' };

		if (optionId in BUILDING_DEFINITIONS) {
			const building = BUILDING_DEFINITIONS[optionId as CityBuildingType];
			if (city.buildings.includes(building.type)) {
				return { ok: false, message: 'Building already constructed.' };
			}
			if (
				(building.prerequisites || []).some(
					(prereq) => !player.techs.includes(prereq),
				)
			) {
				return { ok: false, message: 'Missing prerequisite research.' };
			}
			if (!this.canAfford(player.resources, building.cost)) {
				return { ok: false, message: 'Not enough resources.' };
			}

			this.payCost(player.resources, building.cost);
			city.buildings.push(building.type);
			this.recalculateCityScale(city);

			if (building.type === CityBuildingType.BARRACKS) {
				player.progression.attackBonus += 1;
				this.reapplyUnitProgression(player);
			}

			if (building.type === CityBuildingType.WATCHTOWER) {
				player.progression.visionBonus += 1;
			}

			return {
				ok: true,
				message: `${city.name} built ${building.name}.`,
			};
		}

		if (optionId in RESEARCH_DEFINITIONS) {
			const research = RESEARCH_DEFINITIONS[optionId as ResearchType];
			if (player.techs.includes(research.type)) {
				return { ok: false, message: 'Research already completed.' };
			}
			if (
				(research.prerequisites || []).some(
					(prereq) => !player.techs.includes(prereq),
				)
			) {
				return { ok: false, message: 'Missing prerequisite research.' };
			}
			if (!this.canAfford(player.resources, research.cost)) {
				return { ok: false, message: 'Not enough resources.' };
			}

			this.payCost(player.resources, research.cost);
			player.techs.push(research.type);
			this.applyResearchEffects(player, research.type);

			return {
				ok: true,
				message: `${player.name} completed ${research.name} research.`,
			};
		}

		return { ok: false, message: 'Unknown option.' };
	}

	private updatePlayerResources(player: Player, deltaMs: number): void {
		// Passive resource generation from city base output and buildings.
		const deltaSeconds = deltaMs / 1000;
		const productionPerSecond = 0.01;

		player.cities.forEach((city) => {
			const buildingYield = this.getBuildingIdleYield(city);
			player.resources.production +=
				(city.production + buildingYield.production) *
				productionPerSecond *
				deltaSeconds *
				player.progression.productionMultiplier;
			player.resources.food +=
				(city.food + buildingYield.food) *
				productionPerSecond *
				deltaSeconds *
				player.progression.foodMultiplier;
			player.resources.gold +=
				buildingYield.gold *
				productionPerSecond *
				deltaSeconds *
				player.progression.goldMultiplier;
		});
	}

	getPlayerVisionBonus(playerId: string): number {
		const player = this.findPlayer(playerId);
		if (!player) return 0;
		return player.progression.visionBonus;
	}

	private updateResourceNodes(): void {
		const now = Date.now();

		for (const node of this.resourceNodes.values()) {
			if (node.respawnTurnsRemaining > 0) {
				continue;
			}

			if (node.activeGather) {
				const elapsed = now - node.activeGather.startedAt;
				if (elapsed >= node.activeGather.durationMs) {
					this.harvestNodeAmount(
						node,
						node.remaining,
						node.activeGather.playerId,
					);
					node.activeGather = undefined;
					if (node.remaining <= 0) {
						this.depleteNode(node);
					}
				}
			}

			if (node.idleGather && node.remaining > 0) {
				const elapsed = now - node.idleGather.lastTickAt;
				if (elapsed >= node.idleGather.intervalMs) {
					const amount = Math.min(node.remaining, node.idleGather.chunkAmount);
					this.harvestNodeAmount(node, amount, node.idleGather.playerId);
					node.idleGather.lastTickAt = now;
					if (node.remaining <= 0) {
						node.idleGather = undefined;
						this.depleteNode(node);
					}
				}
			}
		}
	}

	private depleteNode(node: ResourceNodeRuntime): void {
		node.remaining = 0;
		node.activeGather = undefined;
		node.idleGather = undefined;
		node.respawnTurnsRemaining = node.respawnTurns;
	}

	private harvestNodeAmount(
		node: ResourceNodeRuntime,
		amount: number,
		playerId: string,
	): void {
		if (amount <= 0) return;

		const player = this.findPlayer(playerId);
		if (!player) return;

		const ratio = amount / node.capacity;
		const yieldBundle = RESOURCE_PROFILES[node.type].fullYield;

		player.resources.gold += yieldBundle.gold * ratio;
		player.resources.food += yieldBundle.food * ratio;
		player.resources.production += yieldBundle.production * ratio;
		node.remaining = Math.max(0, node.remaining - amount);
	}

	private getOrCreateResourceNodeAt(
		x: number,
		y: number,
	): ResourceNodeRuntime | null {
		const key = this.resourceNodeKey(x, y);
		const cached = this.resourceNodes.get(key);
		if (cached) {
			return cached;
		}

		const tile = this.mapCache.getTile(x, y);
		if (!tile || !tile.resourceNode) {
			return null;
		}

		const created = this.createResourceNodeRuntime(tile);
		this.resourceNodes.set(key, created);
		return created;
	}

	private createResourceNodeRuntime(tile: Tile): ResourceNodeRuntime {
		const profile = RESOURCE_PROFILES[tile.resourceNode as ResourceNodeType];
		return {
			key: this.resourceNodeKey(tile.x, tile.y),
			type: tile.resourceNode as ResourceNodeType,
			x: tile.x,
			y: tile.y,
			capacity: profile.capacity,
			remaining: profile.capacity,
			respawnTurns: profile.respawnTurns,
			respawnTurnsRemaining: 0,
		};
	}

	private toNodeStatus(node: ResourceNodeRuntime): ResourceNodeStatus {
		const now = Date.now();
		let mode: ResourceNodeStatus['mode'] = 'none';
		let activeProgress = 0;
		let cooldownProgress = 0;
		let cooldownTurnsRemaining = 0;
		let idleTickProgress = 0;

		if (node.respawnTurnsRemaining > 0) {
			mode = 'cooldown';
			cooldownTurnsRemaining = node.respawnTurnsRemaining;
			cooldownProgress =
				node.respawnTurns <= 0 ?
					1
				:	(node.respawnTurns - node.respawnTurnsRemaining) / node.respawnTurns;
		} else if (node.activeGather) {
			mode = 'active';
			activeProgress = Math.min(
				1,
				(now - node.activeGather.startedAt) / node.activeGather.durationMs,
			);
		} else if (node.idleGather) {
			mode = 'idle';
			idleTickProgress = Math.min(
				1,
				(now - node.idleGather.lastTickAt) / node.idleGather.intervalMs,
			);
		}

		return {
			type: node.type,
			x: node.x,
			y: node.y,
			capacity: node.capacity,
			remaining: node.remaining,
			mode,
			activeProgress,
			cooldownProgress,
			cooldownTurnsRemaining,
			idleTickProgress,
		};
	}

	private progressResourceRespawnsByTurn(): void {
		for (const node of this.resourceNodes.values()) {
			if (node.respawnTurnsRemaining > 0) {
				node.respawnTurnsRemaining -= 1;
				if (node.respawnTurnsRemaining <= 0) {
					node.respawnTurnsRemaining = 0;
					node.remaining = node.capacity;
				}
			}
		}
	}

	private progressMountainDestroyByTurn(): void {
		for (const [unitId, task] of this.mountainDestroyTasks.entries()) {
			if (task.mode !== 'destroying') continue;

			task.remainingTurns -= 1;
			if (task.remainingTurns > 0) continue;

			this.mapCache.setTileType(task.x, task.y, TileType.GRASSLAND);
			this.mapCache.clearTileResourceNode(task.x, task.y);
			this.mountainDestroyTasks.delete(unitId);
		}
	}

	private resourceNodeKey(x: number, y: number): string {
		return `${x},${y}`;
	}

	private isUnitInActiveGather(unitId: string): boolean {
		for (const node of this.resourceNodes.values()) {
			if (node.activeGather?.unitId === unitId) {
				return true;
			}
		}
		return false;
	}

	private isUnitInMountainDestroy(unitId: string): boolean {
		return this.mountainDestroyTasks.has(unitId);
	}

	private isUnitBusy(unitId: string): boolean {
		return (
			this.isUnitInActiveGather(unitId) || this.isUnitInMountainDestroy(unitId)
		);
	}

	private toMountainDestroyStatus(
		task: MountainDestroyRuntime,
	): MountainDestroyStatus {
		const completedTurns = task.totalTurns - task.remainingTurns;
		const progress =
			task.mode === 'pending' ? 0
			: task.totalTurns <= 0 ? 1
			: Math.min(1, completedTurns / task.totalTurns);

		return {
			x: task.x,
			y: task.y,
			mode: task.mode,
			totalTurns: task.totalTurns,
			remainingTurns: task.remainingTurns,
			progress,
		};
	}

	private cancelIdleGatherForUnit(unitId: string): void {
		for (const node of this.resourceNodes.values()) {
			if (node.idleGather?.unitId === unitId) {
				node.idleGather = undefined;
			}
		}
	}

	private findPlayer(playerId: string): Player | undefined {
		return this.gameState.players.find((player) => player.id === playerId);
	}

	private findUnit(unitId: string): Unit | undefined {
		for (const player of this.gameState.players) {
			const unit = player.units.find((u) => u.id === unitId);
			if (unit) return unit;
		}
		return undefined;
	}

	private findCity(cityId: string): City | undefined {
		for (const player of this.gameState.players) {
			const city = player.cities.find((c) => c.id === cityId);
			if (city) return city;
		}
		return undefined;
	}

	private getUnitProductionCost(unitType: UnitType): number {
		switch (unitType) {
			case UnitType.SETTLER:
				return 100;
			case UnitType.WORKER:
				return 50;
			case UnitType.WARRIOR:
				return 75;
			default:
				return 100;
		}
	}

	private getUnitMovement(unitType: UnitType): number {
		switch (unitType) {
			case UnitType.SETTLER:
				return 2;
			case UnitType.WORKER:
				return 2;
			case UnitType.WARRIOR:
				return 3;
			default:
				return 2;
		}
	}

	private getUnitAttack(unitType: UnitType): number {
		switch (unitType) {
			case UnitType.WARRIOR:
				return 5;
			default:
				return 1;
		}
	}

	private getUnitDefense(unitType: UnitType): number {
		switch (unitType) {
			case UnitType.WARRIOR:
				return 3;
			default:
				return 1;
		}
	}

	private createDefaultProgression(): PlayerProgression {
		return {
			unitMovementBonus: 0,
			visionBonus: 0,
			attackBonus: 0,
			defenseBonus: 0,
			foodMultiplier: 1,
			productionMultiplier: 1,
			goldMultiplier: 1,
		};
	}

	private canAfford(
		resources: PlayerResources,
		cost: PlayerResources,
	): boolean {
		return (
			resources.gold >= cost.gold &&
			resources.food >= cost.food &&
			resources.production >= cost.production
		);
	}

	private payCost(resources: PlayerResources, cost: PlayerResources): void {
		resources.gold -= cost.gold;
		resources.food -= cost.food;
		resources.production -= cost.production;
	}

	private recalculateCityScale(city: City): void {
		const tier = Math.min(4, 1 + Math.floor(city.buildings.length / 2));
		city.level = tier;
		city.footprintRadius = Math.max(0, tier - 1);
	}

	private applyResearchEffects(
		player: Player,
		researchType: ResearchType,
	): void {
		switch (researchType) {
			case ResearchType.LOGISTICS:
				player.progression.unitMovementBonus += 1;
				this.reapplyUnitProgression(player);
				break;
			case ResearchType.SCOUTING:
				player.progression.visionBonus += 1;
				break;
			case ResearchType.METALLURGY:
				player.progression.attackBonus += 1;
				player.progression.defenseBonus += 1;
				this.reapplyUnitProgression(player);
				break;
			case ResearchType.AGRONOMY:
				player.progression.foodMultiplier += 0.2;
				break;
			case ResearchType.INDUSTRIALIZATION:
				player.progression.productionMultiplier += 0.2;
				break;
		}
	}

	private reapplyUnitProgression(player: Player): void {
		player.units.forEach((unit) => {
			const baseMovement = this.getUnitMovement(unit.type);
			const bonusMove = player.progression.unitMovementBonus;
			const newMax = baseMovement + bonusMove;
			unit.maxMovementPoints = newMax;
			unit.movementPoints = Math.min(newMax, unit.movementPoints + bonusMove);
			unit.attack =
				this.getUnitAttack(unit.type) + player.progression.attackBonus;
			unit.defense =
				this.getUnitDefense(unit.type) + player.progression.defenseBonus;
		});
	}

	private getBuildingIdleYield(city: City): PlayerResources {
		return city.buildings.reduce(
			(acc, buildingType) => {
				const def = BUILDING_DEFINITIONS[buildingType];
				if (!def) return acc;
				acc.gold += def.idleYieldBonus.gold;
				acc.food += def.idleYieldBonus.food;
				acc.production += def.idleYieldBonus.production;
				return acc;
			},
			{ gold: 0, food: 0, production: 0 },
		);
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	// ============ Getters ============

	getGameState(): GameState {
		return this.gameState;
	}

	getMapCache(): MapCache {
		return this.mapCache;
	}

	isGameRunning(): boolean {
		return this.isRunning;
	}

	getTurn(): number {
		return this.gameState.turn;
	}
}
