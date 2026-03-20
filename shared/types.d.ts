/**
 * Shared Type Definitions
 * Used by both frontend and backend
 */
export interface Coordinate {
    x: number;
    y: number;
}
export interface ChunkCoord {
    cx: number;
    cy: number;
}
export declare enum TileType {
    GRASSLAND = ".",
    FOREST = "T",
    MOUNTAIN = "^",
    WATER = "~"
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
export declare enum UnitType {
    SETTLER = "settler",
    WORKER = "worker",
    WARRIOR = "warrior"
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
export interface Technology {
    id: string;
    name: string;
    cost: number;
    prerequisites: string[];
    effects: TechEffect[];
}
export interface TechEffect {
    type: 'unit_unlock' | 'building_unlock' | 'resource_bonus' | 'production_boost';
    value: string | number;
}
export interface GameEvent {
    type: string;
    timestamp: number;
    playerId: string;
    data: Record<string, unknown>;
}
export interface DifficultySettings {
    aiAggressiveness: number;
    aiExpansionRate: number;
    aiTechSpeed: number;
    resourceMultiplier: number;
}
export interface IdleState {
    lastActiveTime: number;
    elapsedMs: number;
    resourcesGained: PlayerResources;
}
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
export interface AIDecision {
    type: 'move_unit' | 'build_unit' | 'attack' | 'research_tech' | 'expand';
    targetId?: string;
    targetCoordinate?: Coordinate;
    unitType?: UnitType;
    techId?: string;
}
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export declare const CHUNK_SIZE = 32;
export declare const TILE_SIZE = 16;
export declare const VIEWPORT_TILES: {
    width: number;
    height: number;
};
//# sourceMappingURL=types.d.ts.map