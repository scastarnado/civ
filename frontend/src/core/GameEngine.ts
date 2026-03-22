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
	progressionBonus?: Partial<PlayerProgression>;
}

interface ResearchDefinition {
	type: ResearchType;
	name: string;
	category: 'military' | 'improvements' | 'civil';
	description: string;
	cost: PlayerResources;
	prerequisites?: ResearchType[];
	progressionBonus?: Partial<PlayerProgression>;
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

const BUILDING_DEFINITIONS_LIST: BuildingDefinition[] = [
	{
		type: CityBuildingType.BARRACKS,
		name: 'Barracks',
		category: 'military',
		description: 'Standardized training routines harden your front line.',
		cost: { gold: 35, food: 5, production: 70 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.02 },
		progressionBonus: { attackBonus: 1 },
	},
	{
		type: CityBuildingType.ARMORY,
		name: 'Armory',
		category: 'military',
		description: 'Improves armor standards and defensive readiness.',
		cost: { gold: 45, food: 5, production: 85 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.03 },
		prerequisites: [ResearchType.METALLURGY],
		progressionBonus: { defenseBonus: 1 },
	},
	{
		type: CityBuildingType.DRILL_GROUND,
		name: 'Drill Ground',
		category: 'military',
		description: 'Sharpens formation changes and march discipline.',
		cost: { gold: 40, food: 10, production: 75 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.02 },
		prerequisites: [ResearchType.LOGISTICS],
		progressionBonus: { unitMovementBonus: 1 },
	},
	{
		type: CityBuildingType.GUARD_POST,
		name: 'Guard Post',
		category: 'military',
		description: 'Permanent patrol posts improve defensive cover.',
		cost: { gold: 34, food: 4, production: 62 },
		idleYieldBonus: { gold: 0.01, food: 0, production: 0.02 },
		prerequisites: [ResearchType.FORTIFICATION],
		progressionBonus: { defenseBonus: 1 },
	},
	{
		type: CityBuildingType.FLETCHER_RANGE,
		name: 'Fletcher Range',
		category: 'military',
		description: 'Better ranged practice improves striking power.',
		cost: { gold: 38, food: 6, production: 68 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.03 },
		prerequisites: [ResearchType.BRONZE_WORKING],
		progressionBonus: { attackBonus: 1 },
	},
	{
		type: CityBuildingType.SIEGE_WORKSHOP,
		name: 'Siege Workshop',
		category: 'military',
		description: 'Heavy engine workshops support battlefield pressure.',
		cost: { gold: 62, food: 8, production: 112 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.08 },
		prerequisites: [ResearchType.MILITARY_ENGINEERING],
		progressionBonus: { attackBonus: 1 },
	},
	{
		type: CityBuildingType.MUSTER_HALL,
		name: 'Muster Hall',
		category: 'military',
		description: 'Speeds reinforcement cycles and reserve call-ups.',
		cost: { gold: 52, food: 14, production: 84 },
		idleYieldBonus: { gold: 0, food: 0.01, production: 0.04 },
		prerequisites: [ResearchType.CONSCRIPTION],
		progressionBonus: { defenseBonus: 1 },
	},
	{
		type: CityBuildingType.STABLE,
		name: 'Stable',
		category: 'military',
		description: 'Mounted logistics improve operational reach.',
		cost: { gold: 36, food: 12, production: 58 },
		idleYieldBonus: { gold: 0, food: 0.01, production: 0.02 },
		prerequisites: [ResearchType.LOGISTICS],
		progressionBonus: { unitMovementBonus: 1 },
	},
	{
		type: CityBuildingType.SIGNAL_TOWER,
		name: 'Signal Tower',
		category: 'military',
		description: 'Signal relays improve command visibility.',
		cost: { gold: 46, food: 0, production: 78 },
		idleYieldBonus: { gold: 0.02, food: 0, production: 0.02 },
		prerequisites: [ResearchType.CHAIN_OF_COMMAND],
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: CityBuildingType.SHIELD_FOUNDRY,
		name: 'Shield Foundry',
		category: 'military',
		description: 'Mass-forged protection raises battlefield resilience.',
		cost: { gold: 68, food: 0, production: 118 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.07 },
		prerequisites: [ResearchType.STEELCRAFT],
		progressionBonus: { defenseBonus: 1 },
	},
	{
		type: CityBuildingType.VETERAN_LODGE,
		name: 'Veteran Lodge',
		category: 'military',
		description: 'Experienced captains preserve hard-won tactics.',
		cost: { gold: 58, food: 8, production: 96 },
		idleYieldBonus: { gold: 0.01, food: 0, production: 0.03 },
		prerequisites: [ResearchType.FIELD_MEDICINE],
		progressionBonus: { attackBonus: 1, defenseBonus: 1 },
	},
	{
		type: CityBuildingType.SUPPLY_DEPOT,
		name: 'Supply Depot',
		category: 'military',
		description: 'Keeps armies fueled without choking the economy.',
		cost: { gold: 70, food: 10, production: 104 },
		idleYieldBonus: { gold: 0.03, food: 0.02, production: 0.05 },
		prerequisites: [ResearchType.WAR_ECONOMY],
	},
	{
		type: CityBuildingType.WAR_COLLEGE,
		name: 'War College',
		category: 'military',
		description: 'Formal doctrine sharpens offensive execution.',
		cost: { gold: 74, food: 6, production: 126 },
		idleYieldBonus: { gold: 0.02, food: 0, production: 0.05 },
		prerequisites: [ResearchType.CHAIN_OF_COMMAND],
		progressionBonus: { attackBonus: 1, visionBonus: 1 },
	},
	{
		type: CityBuildingType.ARSENAL,
		name: 'Arsenal',
		category: 'military',
		description: 'Large ordnance depots sustain prolonged campaigns.',
		cost: { gold: 88, food: 0, production: 138 },
		idleYieldBonus: { gold: 0.02, food: 0, production: 0.09 },
		prerequisites: [ResearchType.BALLISTICS],
		progressionBonus: { attackBonus: 1 },
	},
	{
		type: CityBuildingType.OFFICER_ACADEMY,
		name: 'Officer Academy',
		category: 'military',
		description: 'Elite command training elevates the whole army.',
		cost: { gold: 96, food: 8, production: 148 },
		idleYieldBonus: { gold: 0.03, food: 0, production: 0.06 },
		prerequisites: [ResearchType.ELITE_DRILLS],
		progressionBonus: { attackBonus: 1, defenseBonus: 1, visionBonus: 1 },
	},
	{
		type: CityBuildingType.GRANARY,
		name: 'Granary',
		category: 'improvements',
		description: 'Improves idle food growth in this city.',
		cost: { gold: 20, food: 10, production: 40 },
		idleYieldBonus: { gold: 0, food: 0.08, production: 0 },
	},
	{
		type: CityBuildingType.WORKSHOP,
		name: 'Workshop',
		category: 'improvements',
		description: 'Improves idle production in this city.',
		cost: { gold: 25, food: 0, production: 50 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.08 },
	},
	{
		type: CityBuildingType.WATER_MILL,
		name: 'Water Mill',
		category: 'improvements',
		description: 'Turns flowing water into steady food and output.',
		cost: { gold: 35, food: 5, production: 65 },
		idleYieldBonus: { gold: 0, food: 0.07, production: 0.04 },
		prerequisites: [ResearchType.IRRIGATION],
	},
	{
		type: CityBuildingType.FORGE,
		name: 'Forge',
		category: 'improvements',
		description: 'Advanced metalwork increases industrial throughput.',
		cost: { gold: 50, food: 0, production: 90 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.12 },
		prerequisites: [ResearchType.INDUSTRIALIZATION],
	},
	{
		type: CityBuildingType.MILLING_HOUSE,
		name: 'Milling House',
		category: 'improvements',
		description: 'Converts surplus grain into efficient reserves.',
		cost: { gold: 28, food: 6, production: 52 },
		idleYieldBonus: { gold: 0, food: 0.06, production: 0.02 },
		prerequisites: [ResearchType.CROP_ROTATION],
	},
	{
		type: CityBuildingType.SMOKEHOUSE,
		name: 'Smokehouse',
		category: 'improvements',
		description: 'Preserves food and reduces spoilage losses.',
		cost: { gold: 26, food: 10, production: 48 },
		idleYieldBonus: { gold: 0, food: 0.05, production: 0.01 },
		prerequisites: [ResearchType.ANIMAL_HUSBANDRY],
	},
	{
		type: CityBuildingType.STONECUTTER,
		name: 'Stonecutter',
		category: 'improvements',
		description: 'Specialized masonry accelerates durable construction.',
		cost: { gold: 40, food: 0, production: 70 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.07 },
		prerequisites: [ResearchType.ENGINEERING_GUILDS],
	},
	{
		type: CityBuildingType.LUMBER_YARD,
		name: 'Lumber Yard',
		category: 'improvements',
		description: 'Organized timber processing boosts construction flow.',
		cost: { gold: 34, food: 0, production: 58 },
		idleYieldBonus: { gold: 0, food: 0, production: 0.06 },
		prerequisites: [ResearchType.AGRONOMY],
	},
	{
		type: CityBuildingType.BREWERY,
		name: 'Brewery',
		category: 'improvements',
		description: 'Fermentation industries add value to local harvests.',
		cost: { gold: 42, food: 8, production: 66 },
		idleYieldBonus: { gold: 0.04, food: 0.03, production: 0 },
		prerequisites: [ResearchType.STORAGE_METHODS],
	},
	{
		type: CityBuildingType.BAKERY,
		name: 'Bakery',
		category: 'improvements',
		description: 'Urban baking increases food efficiency and trade value.',
		cost: { gold: 38, food: 12, production: 60 },
		idleYieldBonus: { gold: 0.02, food: 0.06, production: 0 },
		prerequisites: [ResearchType.SOIL_RENEWAL],
	},
	{
		type: CityBuildingType.WEAVERY,
		name: 'Weavery',
		category: 'improvements',
		description: 'Textile craft turns surplus materials into income.',
		cost: { gold: 44, food: 0, production: 72 },
		idleYieldBonus: { gold: 0.05, food: 0, production: 0.03 },
		prerequisites: [ResearchType.WINDMILLS],
	},
	{
		type: CityBuildingType.QUARRY_WORKS,
		name: 'Quarry Works',
		category: 'improvements',
		description: 'Deep extraction projects feed major civic building.',
		cost: { gold: 58, food: 0, production: 92 },
		idleYieldBonus: { gold: 0.01, food: 0, production: 0.09 },
		prerequisites: [ResearchType.CIVIL_ENGINEERING],
	},
	{
		type: CityBuildingType.FARM_ESTATE,
		name: 'Farm Estate',
		category: 'improvements',
		description: 'Large agricultural holdings scale food output upward.',
		cost: { gold: 52, food: 16, production: 82 },
		idleYieldBonus: { gold: 0.01, food: 0.09, production: 0.02 },
		prerequisites: [ResearchType.IRRIGATION],
	},
	{
		type: CityBuildingType.FOUNDRY,
		name: 'Foundry',
		category: 'improvements',
		description: 'Refined furnaces dramatically lift industrial output.',
		cost: { gold: 74, food: 0, production: 118 },
		idleYieldBonus: { gold: 0.02, food: 0, production: 0.12 },
		prerequisites: [ResearchType.REFINING],
	},
	{
		type: CityBuildingType.POWER_PLANT,
		name: 'Power Plant',
		category: 'improvements',
		description: 'Mechanized energy unlocks true mass production.',
		cost: { gold: 92, food: 0, production: 150 },
		idleYieldBonus: { gold: 0.03, food: 0, production: 0.15 },
		prerequisites: [ResearchType.MASS_PRODUCTION],
	},
	{
		type: CityBuildingType.MARKET,
		name: 'Market',
		category: 'civil',
		description: 'Generates passive gold income.',
		cost: { gold: 30, food: 0, production: 60 },
		idleYieldBonus: { gold: 0.06, food: 0, production: 0 },
	},
	{
		type: CityBuildingType.WATCHTOWER,
		name: 'Watchtower',
		category: 'civil',
		description: 'Boosts scouting and regional awareness.',
		cost: { gold: 30, food: 0, production: 55 },
		idleYieldBonus: { gold: 0.02, food: 0, production: 0 },
		prerequisites: [ResearchType.SCOUTING],
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: CityBuildingType.LIBRARY,
		name: 'Library',
		category: 'civil',
		description: 'Curated knowledge improves administration and planning.',
		cost: { gold: 35, food: 10, production: 60 },
		idleYieldBonus: { gold: 0.03, food: 0.02, production: 0 },
		prerequisites: [ResearchType.SCHOLARSHIP],
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: CityBuildingType.HARBOR,
		name: 'Harbor',
		category: 'civil',
		description: 'Trade routes and shipping expand passive gold flow.',
		cost: { gold: 55, food: 0, production: 80 },
		idleYieldBonus: { gold: 0.12, food: 0, production: 0.02 },
		prerequisites: [ResearchType.NAVIGATION],
	},
	{
		type: CityBuildingType.TOWN_SQUARE,
		name: 'Town Square',
		category: 'civil',
		description: 'Public gathering space boosts civic cohesion and trade.',
		cost: { gold: 34, food: 8, production: 54 },
		idleYieldBonus: { gold: 0.04, food: 0.02, production: 0 },
		prerequisites: [ResearchType.CIVIC_TRADITIONS],
	},
	{
		type: CityBuildingType.ARCHIVE,
		name: 'Archive',
		category: 'civil',
		description: 'Preserved records stabilize administration.',
		cost: { gold: 40, food: 0, production: 62 },
		idleYieldBonus: { gold: 0.03, food: 0, production: 0.02 },
		prerequisites: [ResearchType.PHILOSOPHY],
	},
	{
		type: CityBuildingType.CARAVANSERAI,
		name: 'Caravanserai',
		category: 'civil',
		description: 'Overland traders enrich the city between turns.',
		cost: { gold: 46, food: 0, production: 72 },
		idleYieldBonus: { gold: 0.08, food: 0, production: 0.02 },
		prerequisites: [ResearchType.TRADE_LEDGERS],
	},
	{
		type: CityBuildingType.OBSERVATORY,
		name: 'Observatory',
		category: 'civil',
		description: 'Sky study sharpens long-range awareness.',
		cost: { gold: 52, food: 0, production: 86 },
		idleYieldBonus: { gold: 0.02, food: 0, production: 0.02 },
		prerequisites: [ResearchType.ASTRONOMY],
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: CityBuildingType.CUSTOMS_HOUSE,
		name: 'Customs House',
		category: 'civil',
		description: 'Taxes cross-city exchange with high efficiency.',
		cost: { gold: 62, food: 0, production: 96 },
		idleYieldBonus: { gold: 0.1, food: 0, production: 0.01 },
		prerequisites: [ResearchType.BANKING],
	},
	{
		type: CityBuildingType.MONUMENT,
		name: 'Monument',
		category: 'civil',
		description: 'Shared identity improves local stability and prestige.',
		cost: { gold: 42, food: 4, production: 74 },
		idleYieldBonus: { gold: 0.03, food: 0.02, production: 0.01 },
		prerequisites: [ResearchType.CIVIC_TRADITIONS],
	},
	{
		type: CityBuildingType.COURTHOUSE,
		name: 'Courthouse',
		category: 'civil',
		description: 'Formal legal systems reduce friction in expansion.',
		cost: { gold: 58, food: 0, production: 88 },
		idleYieldBonus: { gold: 0.05, food: 0, production: 0.03 },
		prerequisites: [ResearchType.BUREAUCRACY],
	},
	{
		type: CityBuildingType.UNIVERSITY,
		name: 'University',
		category: 'civil',
		description: 'Advanced schooling deepens the city knowledge base.',
		cost: { gold: 70, food: 6, production: 110 },
		idleYieldBonus: { gold: 0.05, food: 0.01, production: 0.03 },
		prerequisites: [ResearchType.EDUCATION],
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: CityBuildingType.LIGHTHOUSE,
		name: 'Lighthouse',
		category: 'civil',
		description: 'Navigation beacons widen trade and maritime reach.',
		cost: { gold: 54, food: 0, production: 82 },
		idleYieldBonus: { gold: 0.06, food: 0, production: 0.02 },
		prerequisites: [ResearchType.NAVIGATION],
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: CityBuildingType.GUILD_HALL,
		name: 'Guild Hall',
		category: 'civil',
		description: 'Professional networks improve trade and workmanship.',
		cost: { gold: 64, food: 0, production: 98 },
		idleYieldBonus: { gold: 0.07, food: 0, production: 0.04 },
		prerequisites: [ResearchType.URBAN_PLANNING],
	},
	{
		type: CityBuildingType.EMBASSY,
		name: 'Embassy',
		category: 'civil',
		description: 'Formal diplomacy opens richer external exchange.',
		cost: { gold: 82, food: 0, production: 118 },
		idleYieldBonus: { gold: 0.11, food: 0, production: 0.02 },
		prerequisites: [ResearchType.DIPLOMACY],
		progressionBonus: { visionBonus: 1 },
	},
];

const BUILDING_DEFINITIONS = Object.fromEntries(
	BUILDING_DEFINITIONS_LIST.map((definition) => [definition.type, definition]),
) as Record<CityBuildingType, BuildingDefinition>;

const RESEARCH_DEFINITIONS_LIST: ResearchDefinition[] = [
	{
		type: ResearchType.LOGISTICS,
		name: 'Logistics',
		category: 'military',
		description: '+1 movement for all units.',
		cost: { gold: 30, food: 20, production: 60 },
		progressionBonus: { unitMovementBonus: 1 },
	},
	{
		type: ResearchType.BRONZE_WORKING,
		name: 'Bronze Working',
		category: 'military',
		description: '+1 attack from better weapon standards.',
		cost: { gold: 32, food: 10, production: 58 },
		progressionBonus: { attackBonus: 1 },
	},
	{
		type: ResearchType.DISCIPLINE,
		name: 'Discipline',
		category: 'military',
		description: '+1 defense from tighter formations.',
		cost: { gold: 38, food: 16, production: 72 },
		prerequisites: [ResearchType.LOGISTICS],
		progressionBonus: { defenseBonus: 1 },
	},
	{
		type: ResearchType.METALLURGY,
		name: 'Metallurgy',
		category: 'military',
		description: '+1 attack and +1 defense for all units.',
		cost: { gold: 40, food: 20, production: 80 },
		prerequisites: [ResearchType.BRONZE_WORKING],
		progressionBonus: { attackBonus: 1, defenseBonus: 1 },
	},
	{
		type: ResearchType.TACTICS,
		name: 'Tactics',
		category: 'military',
		description: '+1 attack from coordinated battlefield plans.',
		cost: { gold: 50, food: 25, production: 90 },
		prerequisites: [ResearchType.DISCIPLINE, ResearchType.METALLURGY],
		progressionBonus: { attackBonus: 1 },
	},
	{
		type: ResearchType.CONSCRIPTION,
		name: 'Conscription',
		category: 'military',
		description: '+8% production through larger manpower pools.',
		cost: { gold: 44, food: 18, production: 84 },
		prerequisites: [ResearchType.DISCIPLINE],
		progressionBonus: { productionMultiplier: 0.08 },
	},
	{
		type: ResearchType.FORTIFICATION,
		name: 'Fortification',
		category: 'military',
		description: '+1 defense from prepared positions.',
		cost: { gold: 48, food: 10, production: 86 },
		prerequisites: [ResearchType.BRONZE_WORKING],
		progressionBonus: { defenseBonus: 1 },
	},
	{
		type: ResearchType.MILITARY_ENGINEERING,
		name: 'Military Engineering',
		category: 'military',
		description: '+10% production for siege-focused infrastructure.',
		cost: { gold: 58, food: 14, production: 100 },
		prerequisites: [ResearchType.FORTIFICATION, ResearchType.METALLURGY],
		progressionBonus: { productionMultiplier: 0.1 },
	},
	{
		type: ResearchType.FIELD_MEDICINE,
		name: 'Field Medicine',
		category: 'military',
		description: '+1 defense from improved casualty recovery.',
		cost: { gold: 54, food: 20, production: 92 },
		prerequisites: [ResearchType.CONSCRIPTION],
		progressionBonus: { defenseBonus: 1 },
	},
	{
		type: ResearchType.CHAIN_OF_COMMAND,
		name: 'Chain of Command',
		category: 'military',
		description: '+1 vision from cleaner battlefield signaling.',
		cost: { gold: 64, food: 18, production: 112 },
		prerequisites: [ResearchType.TACTICS],
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: ResearchType.STEELCRAFT,
		name: 'Steelcraft',
		category: 'military',
		description: '+1 attack from superior weapon tempering.',
		cost: { gold: 66, food: 10, production: 120 },
		prerequisites: [ResearchType.METALLURGY],
		progressionBonus: { attackBonus: 1 },
	},
	{
		type: ResearchType.BALLISTICS,
		name: 'Ballistics',
		category: 'military',
		description: '+1 attack from better projectile science.',
		cost: { gold: 76, food: 12, production: 132 },
		prerequisites: [ResearchType.MILITARY_ENGINEERING, ResearchType.STEELCRAFT],
		progressionBonus: { attackBonus: 1 },
	},
	{
		type: ResearchType.WAR_ECONOMY,
		name: 'War Economy',
		category: 'military',
		description: '+10% production and +10% gold from mobilized industry.',
		cost: { gold: 65, food: 15, production: 110 },
		prerequisites: [ResearchType.CHAIN_OF_COMMAND],
		progressionBonus: { productionMultiplier: 0.1, goldMultiplier: 0.1 },
	},
	{
		type: ResearchType.COMBINED_ARMS,
		name: 'Combined Arms',
		category: 'military',
		description: '+1 movement and +1 attack from integrated warfare.',
		cost: { gold: 84, food: 16, production: 146 },
		prerequisites: [ResearchType.BALLISTICS, ResearchType.CHAIN_OF_COMMAND],
		progressionBonus: { unitMovementBonus: 1, attackBonus: 1 },
	},
	{
		type: ResearchType.ELITE_DRILLS,
		name: 'Elite Drills',
		category: 'military',
		description: '+1 attack and +1 defense for veteran formations.',
		cost: { gold: 96, food: 18, production: 160 },
		prerequisites: [ResearchType.COMBINED_ARMS, ResearchType.FIELD_MEDICINE],
		progressionBonus: { attackBonus: 1, defenseBonus: 1 },
	},
	{
		type: ResearchType.AGRONOMY,
		name: 'Agronomy',
		category: 'improvements',
		description: '+20% passive food generation.',
		cost: { gold: 35, food: 25, production: 55 },
		progressionBonus: { foodMultiplier: 0.2 },
	},
	{
		type: ResearchType.ANIMAL_HUSBANDRY,
		name: 'Animal Husbandry',
		category: 'improvements',
		description: '+8% food and +2% production from livestock systems.',
		cost: { gold: 26, food: 18, production: 44 },
		progressionBonus: { foodMultiplier: 0.08, productionMultiplier: 0.02 },
	},
	{
		type: ResearchType.CROP_ROTATION,
		name: 'Crop Rotation',
		category: 'improvements',
		description: '+8% food from healthier fields.',
		cost: { gold: 38, food: 28, production: 58 },
		prerequisites: [ResearchType.AGRONOMY],
		progressionBonus: { foodMultiplier: 0.08 },
	},
	{
		type: ResearchType.IRRIGATION,
		name: 'Irrigation',
		category: 'improvements',
		description: '+15% passive food generation.',
		cost: { gold: 45, food: 35, production: 80 },
		prerequisites: [ResearchType.AGRONOMY],
		progressionBonus: { foodMultiplier: 0.15 },
	},
	{
		type: ResearchType.SOIL_RENEWAL,
		name: 'Soil Renewal',
		category: 'improvements',
		description: '+8% food from long-term field recovery.',
		cost: { gold: 42, food: 30, production: 62 },
		prerequisites: [ResearchType.CROP_ROTATION],
		progressionBonus: { foodMultiplier: 0.08 },
	},
	{
		type: ResearchType.INDUSTRIALIZATION,
		name: 'Industrialization',
		category: 'improvements',
		description: '+20% passive production generation.',
		cost: { gold: 45, food: 20, production: 90 },
		prerequisites: [ResearchType.AGRONOMY],
		progressionBonus: { productionMultiplier: 0.2 },
	},
	{
		type: ResearchType.ENGINEERING_GUILDS,
		name: 'Engineering Guilds',
		category: 'improvements',
		description: '+10% production from better craft organization.',
		cost: { gold: 54, food: 12, production: 96 },
		prerequisites: [ResearchType.INDUSTRIALIZATION],
		progressionBonus: { productionMultiplier: 0.1 },
	},
	{
		type: ResearchType.WINDMILLS,
		name: 'Windmills',
		category: 'improvements',
		description: '+6% food and +6% production from rotary power.',
		cost: { gold: 50, food: 16, production: 84 },
		prerequisites: [ResearchType.IRRIGATION],
		progressionBonus: { foodMultiplier: 0.06, productionMultiplier: 0.06 },
	},
	{
		type: ResearchType.SANITATION,
		name: 'Sanitation',
		category: 'improvements',
		description: '+5% food and +5% gold from healthier cities.',
		cost: { gold: 56, food: 20, production: 88 },
		prerequisites: [ResearchType.IRRIGATION, ResearchType.ANIMAL_HUSBANDRY],
		progressionBonus: { foodMultiplier: 0.05, goldMultiplier: 0.05 },
	},
	{
		type: ResearchType.MECHANIZATION,
		name: 'Mechanization',
		category: 'improvements',
		description: '+15% production and +1 unit movement.',
		cost: { gold: 70, food: 20, production: 120 },
		prerequisites: [ResearchType.INDUSTRIALIZATION],
		progressionBonus: { productionMultiplier: 0.15, unitMovementBonus: 1 },
	},
	{
		type: ResearchType.STEAM_POWER,
		name: 'Steam Power',
		category: 'improvements',
		description: '+12% production from engine-driven workshops.',
		cost: { gold: 66, food: 12, production: 122 },
		prerequisites: [ResearchType.ENGINEERING_GUILDS],
		progressionBonus: { productionMultiplier: 0.12 },
	},
	{
		type: ResearchType.STORAGE_METHODS,
		name: 'Storage Methods',
		category: 'improvements',
		description: '+5% food and +8% gold from preserving surpluses.',
		cost: { gold: 48, food: 22, production: 78 },
		prerequisites: [ResearchType.SOIL_RENEWAL],
		progressionBonus: { foodMultiplier: 0.05, goldMultiplier: 0.08 },
	},
	{
		type: ResearchType.MASS_PRODUCTION,
		name: 'Mass Production',
		category: 'improvements',
		description: '+18% production from assembly methods.',
		cost: { gold: 84, food: 10, production: 148 },
		prerequisites: [ResearchType.STEAM_POWER, ResearchType.MECHANIZATION],
		progressionBonus: { productionMultiplier: 0.18 },
	},
	{
		type: ResearchType.CIVIL_ENGINEERING,
		name: 'Civil Engineering',
		category: 'improvements',
		description: '+10% production and +5% gold from large works.',
		cost: { gold: 76, food: 10, production: 132 },
		prerequisites: [
			ResearchType.ENGINEERING_GUILDS,
			ResearchType.STORAGE_METHODS,
		],
		progressionBonus: { productionMultiplier: 0.1, goldMultiplier: 0.05 },
	},
	{
		type: ResearchType.REFINING,
		name: 'Refining',
		category: 'improvements',
		description: '+12% production and +12% gold from advanced processing.',
		cost: { gold: 94, food: 8, production: 156 },
		prerequisites: [
			ResearchType.MASS_PRODUCTION,
			ResearchType.CIVIL_ENGINEERING,
		],
		progressionBonus: { productionMultiplier: 0.12, goldMultiplier: 0.12 },
	},
	{
		type: ResearchType.SCOUTING,
		name: 'Scouting',
		category: 'civil',
		description: '+1 vision range for units and cities.',
		cost: { gold: 25, food: 15, production: 45 },
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: ResearchType.PHILOSOPHY,
		name: 'Philosophy',
		category: 'civil',
		description: '+5% food and +5% gold from social organization.',
		cost: { gold: 28, food: 18, production: 46 },
		progressionBonus: { foodMultiplier: 0.05, goldMultiplier: 0.05 },
	},
	{
		type: ResearchType.CARTOGRAPHY,
		name: 'Cartography',
		category: 'civil',
		description: '+1 additional vision range from mapping expertise.',
		cost: { gold: 45, food: 20, production: 70 },
		prerequisites: [ResearchType.SCOUTING],
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: ResearchType.SCHOLARSHIP,
		name: 'Scholarship',
		category: 'civil',
		description: '+8% gold from organized learning networks.',
		cost: { gold: 38, food: 14, production: 58 },
		prerequisites: [ResearchType.PHILOSOPHY],
		progressionBonus: { goldMultiplier: 0.08 },
	},
	{
		type: ResearchType.CURRENCY,
		name: 'Currency',
		category: 'civil',
		description: '+10% gold from standardized exchange.',
		cost: { gold: 42, food: 10, production: 60 },
		prerequisites: [ResearchType.PHILOSOPHY],
		progressionBonus: { goldMultiplier: 0.1 },
	},
	{
		type: ResearchType.TRADE_LEDGERS,
		name: 'Trade Ledgers',
		category: 'civil',
		description: '+8% gold from better mercantile accounting.',
		cost: { gold: 50, food: 8, production: 72 },
		prerequisites: [ResearchType.CURRENCY],
		progressionBonus: { goldMultiplier: 0.08 },
	},
	{
		type: ResearchType.BANKING,
		name: 'Banking',
		category: 'civil',
		description: '+20% passive gold generation.',
		cost: { gold: 80, food: 10, production: 105 },
		prerequisites: [ResearchType.TRADE_LEDGERS, ResearchType.CARTOGRAPHY],
		progressionBonus: { goldMultiplier: 0.2 },
	},
	{
		type: ResearchType.EDUCATION,
		name: 'Education',
		category: 'civil',
		description: '+5% food and +5% production from trained citizens.',
		cost: { gold: 60, food: 12, production: 84 },
		prerequisites: [ResearchType.SCHOLARSHIP],
		progressionBonus: { foodMultiplier: 0.05, productionMultiplier: 0.05 },
	},
	{
		type: ResearchType.ASTRONOMY,
		name: 'Astronomy',
		category: 'civil',
		description: '+1 vision from celestial navigation and observation.',
		cost: { gold: 66, food: 8, production: 92 },
		prerequisites: [ResearchType.CARTOGRAPHY, ResearchType.SCHOLARSHIP],
		progressionBonus: { visionBonus: 1 },
	},
	{
		type: ResearchType.NAVIGATION,
		name: 'Navigation',
		category: 'civil',
		description: '+1 movement and +5% gold from better routes.',
		cost: { gold: 58, food: 8, production: 86 },
		prerequisites: [ResearchType.CARTOGRAPHY],
		progressionBonus: { unitMovementBonus: 1, goldMultiplier: 0.05 },
	},
	{
		type: ResearchType.DIPLOMACY,
		name: 'Diplomacy',
		category: 'civil',
		description: '+12% gold from stable foreign relations.',
		cost: { gold: 72, food: 0, production: 96 },
		prerequisites: [ResearchType.EDUCATION],
		progressionBonus: { goldMultiplier: 0.12 },
	},
	{
		type: ResearchType.CIVIC_TRADITIONS,
		name: 'Civic Traditions',
		category: 'civil',
		description: '+6% food and +6% gold from stronger local identity.',
		cost: { gold: 48, food: 12, production: 68 },
		prerequisites: [ResearchType.PHILOSOPHY],
		progressionBonus: { foodMultiplier: 0.06, goldMultiplier: 0.06 },
	},
	{
		type: ResearchType.BUREAUCRACY,
		name: 'Bureaucracy',
		category: 'civil',
		description: '+10% gold and +5% production from stronger administration.',
		cost: { gold: 68, food: 8, production: 94 },
		prerequisites: [ResearchType.CIVIC_TRADITIONS, ResearchType.CURRENCY],
		progressionBonus: { goldMultiplier: 0.1, productionMultiplier: 0.05 },
	},
	{
		type: ResearchType.URBAN_PLANNING,
		name: 'Urban Planning',
		category: 'civil',
		description: '+8% food and +8% production from smarter city layouts.',
		cost: { gold: 76, food: 12, production: 108 },
		prerequisites: [ResearchType.BUREAUCRACY, ResearchType.EDUCATION],
		progressionBonus: { foodMultiplier: 0.08, productionMultiplier: 0.08 },
	},
	{
		type: ResearchType.COMMUNICATIONS,
		name: 'Communications',
		category: 'civil',
		description: '+1 vision and +10% gold from faster information flow.',
		cost: { gold: 88, food: 0, production: 122 },
		prerequisites: [ResearchType.DIPLOMACY, ResearchType.ASTRONOMY],
		progressionBonus: { visionBonus: 1, goldMultiplier: 0.1 },
	},
];

const RESEARCH_DEFINITIONS = Object.fromEntries(
	RESEARCH_DEFINITIONS_LIST.map((definition) => [definition.type, definition]),
) as Record<ResearchType, ResearchDefinition>;

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

		// Create initial settler unit at a deterministic spawn so multiplayer clients align
		const startPosition = this.getStartingPositionForPlayer(player.id);
		const settler: Unit = {
			id: this.generateId(),
			ownerId: player.id,
			type: UnitType.SETTLER,
			x: startPosition.x,
			y: startPosition.y,
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

	private getStartingPositionForPlayer(playerId: string): {
		x: number;
		y: number;
	} {
		const base = this.hashPlayerToInt(playerId);
		const worldSeed = this.gameState.worldSeed;
		for (let attempt = 0; attempt < 256; attempt++) {
			const candidateX = (base + worldSeed + attempt * 17) % 100;
			const candidateY = ((base >>> 1) + worldSeed + attempt * 29) % 100;
			const x = candidateX < 0 ? candidateX + 100 : candidateX;
			const y = candidateY < 0 ? candidateY + 100 : candidateY;
			const tile = this.mapCache.getTile(x, y);
			if (!tile) continue;
			if (tile.type === TileType.WATER || tile.type === TileType.MOUNTAIN) continue;
			const occupied = this.gameState.players.some((existingPlayer) =>
				existingPlayer.cities.some(
					(city) => city.x === x && city.y === y,
				),
			);
			if (!occupied) {
				return { x, y };
			}
		}
		return { x: Math.abs(base) % 100, y: Math.abs(base >> 3) % 100 };
	}

	private hashPlayerToInt(playerId: string): number {
		let hash = 2166136261;
		for (let i = 0; i < playerId.length; i++) {
			hash ^= playerId.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		return hash >>> 0;
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
				prerequisiteIds: [...(building.prerequisites || [])],
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
				prerequisiteIds: [...(research.prerequisites || [])],
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
			this.applyProgressionBonus(player, building.progressionBonus);

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
		const definition = RESEARCH_DEFINITIONS[researchType];
		this.applyProgressionBonus(player, definition?.progressionBonus);
	}

	private applyProgressionBonus(
		player: Player,
		progressionBonus?: Partial<PlayerProgression>,
	): void {
		if (!progressionBonus) {
			return;
		}

		let needsUnitRefresh = false;

		(
			Object.entries(progressionBonus) as Array<
				[keyof PlayerProgression, number]
			>
		).forEach(([key, value]) => {
			player.progression[key] += value;
			if (
				key === 'unitMovementBonus' ||
				key === 'attackBonus' ||
				key === 'defenseBonus'
			) {
				needsUnitRefresh = true;
			}
		});

		if (needsUnitRefresh) {
			this.reapplyUnitProgression(player);
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
