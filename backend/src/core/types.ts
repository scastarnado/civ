/**
 * Shared Type Definitions
 * Used by both frontend and backend
 */

// Coordinates
export interface Coordinate {
	x: number;
	y: number;
}

// Chunk management
export interface ChunkCoord {
	cx: number;
	cy: number;
}

// Tile types
export enum TileType {
	GRASSLAND = '.',
	FOREST = 'T',
	MOUNTAIN = '^',
	WATER = '~',
}

export interface Tile {
	type: TileType;
	x: number;
	y: number;
	chunkCx: number;
	chunkCy: number;
}

export interface Chunk {
	cx: number;
	cy: number;
	tiles: Tile[];
	seed: number;
}

// Unit types and properties
export enum UnitType {
	SETTLER = 'settler',
	WORKER = 'worker',
	WARRIOR = 'warrior',
}

export interface Unit {
	id: string;
	ownerId: string;
	type: UnitType;
	x: number;
	y: number;
	health: number;
	maxHealth: number;
	movementPoints: number;
	maxMovementPoints: number;
	attack: number;
	defense: number;
	automated: boolean;
}

// City
export interface City {
	id: string;
	ownerId: string;
	name: string;
	x: number;
	y: number;
	population: number;
	food: number;
	production: number;
	productionQueue: UnitType[];
}

// Player
export interface Player {
	id: string;
	name: string;
	isAI: boolean;
	isHuman: boolean;
	difficulty?: 'easy' | 'medium' | 'hard';
	resources: PlayerResources;
	units: Unit[];
	cities: City[];
	techs: string[];
	color: string;
}

export interface PlayerResources {
	gold: number;
	food: number;
	production: number;
}

// Game state
export interface GameState {
	id: string;
	turn: number;
	maxPlayers: number;
	players: Player[];
	chunks: Map<string, Chunk>;
	worldSeed: number;
	isMultiplayer: boolean;
	createdAt: number;
	lastUpdateAt: number;
}

// Technology
export interface Technology {
	id: string;
	name: string;
	cost: number;
	prerequisites: string[];
	effects: TechEffect[];
}

export interface TechEffect {
	type:
		| 'unit_unlock'
		| 'building_unlock'
		| 'resource_bonus'
		| 'production_boost';
	value: string | number;
}

// Multiplayer events
export interface GameEvent {
	type: string;
	timestamp: number;
	playerId: string;
	data: Record<string, unknown>;
}

// Difficulty settings
export interface DifficultySettings {
	aiAggressiveness: number; // 0-1
	aiExpansionRate: number; // 0-1
	aiTechSpeed: number; // 0-1
	resourceMultiplier: number; // 0.5-2
}

// Idle progression
export interface IdleState {
	lastActiveTime: number;
	elapsedMs: number;
	resourcesGained: PlayerResources;
}

// Network message types
export interface NetworkMessage {
	type: string;
	payload: unknown;
	timestamp: number;
}

export interface MoveUnitMessage {
	unitId: string;
	targetX: number;
	targetY: number;
}

export interface EndTurnMessage {
	playerId: string;
}

export interface CreateUnitMessage {
	cityId: string;
	unitType: UnitType;
}

export interface SyncStateMessage {
	playerId: string;
	fromTurn: number;
}

export interface StateUpdateMessage {
	gameState: Partial<GameState>;
	events: GameEvent[];
}

// AI Decision types
export interface AIDecision {
	type: 'move_unit' | 'build_unit' | 'attack' | 'research_tech' | 'expand';
	targetId?: string;
	targetCoordinate?: Coordinate;
	unitType?: UnitType;
	techId?: string;
}

// Validation result
export interface ValidationResult {
	valid: boolean;
	error?: string;
}

// Constants
export const CHUNK_SIZE = 32;
export const TILE_SIZE = 16; // pixels
export const VIEWPORT_TILES = {
	width: 64,
	height: 48,
};
