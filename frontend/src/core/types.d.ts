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
export declare enum ResourceNodeType {
    WHEAT = "wheat",
    DEER = "deer",
    IRON = "iron",
    HORSES = "horses",
    GOLD = "gold"
}
export interface Tile {
    type: TileType;
    x: number;
    y: number;
    chunkCx: number;
    chunkCy: number;
    resourceNode?: ResourceNodeType;
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
    level: number;
    footprintRadius: number;
    buildings: CityBuildingType[];
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
    progression: PlayerProgression;
    color: string;
}
export interface PlayerResources {
    gold: number;
    food: number;
    production: number;
}
export interface PlayerProgression {
    unitMovementBonus: number;
    visionBonus: number;
    attackBonus: number;
    defenseBonus: number;
    foodMultiplier: number;
    productionMultiplier: number;
    goldMultiplier: number;
}
export declare enum CityBuildingType {
    GRANARY = "granary",
    WORKSHOP = "workshop",
    MARKET = "market",
    BARRACKS = "barracks",
    WATCHTOWER = "watchtower",
    ARMORY = "armory",
    DRILL_GROUND = "drill_ground",
    WATER_MILL = "water_mill",
    FORGE = "forge",
    LIBRARY = "library",
    HARBOR = "harbor",
    GUARD_POST = "guard_post",
    FLETCHER_RANGE = "fletcher_range",
    SIEGE_WORKSHOP = "siege_workshop",
    MUSTER_HALL = "muster_hall",
    STABLE = "stable",
    SIGNAL_TOWER = "signal_tower",
    SHIELD_FOUNDRY = "shield_foundry",
    VETERAN_LODGE = "veteran_lodge",
    SUPPLY_DEPOT = "supply_depot",
    WAR_COLLEGE = "war_college",
    ARSENAL = "arsenal",
    OFFICER_ACADEMY = "officer_academy",
    MILLING_HOUSE = "milling_house",
    SMOKEHOUSE = "smokehouse",
    STONECUTTER = "stonecutter",
    LUMBER_YARD = "lumber_yard",
    BREWERY = "brewery",
    BAKERY = "bakery",
    WEAVERY = "weavery",
    QUARRY_WORKS = "quarry_works",
    FARM_ESTATE = "farm_estate",
    FOUNDRY = "foundry",
    POWER_PLANT = "power_plant",
    TOWN_SQUARE = "town_square",
    ARCHIVE = "archive",
    CARAVANSERAI = "caravanserai",
    OBSERVATORY = "observatory",
    CUSTOMS_HOUSE = "customs_house",
    MONUMENT = "monument",
    COURTHOUSE = "courthouse",
    UNIVERSITY = "university",
    LIGHTHOUSE = "lighthouse",
    GUILD_HALL = "guild_hall",
    EMBASSY = "embassy"
}
export declare enum ResearchType {
    LOGISTICS = "logistics",
    SCOUTING = "scouting",
    METALLURGY = "metallurgy",
    AGRONOMY = "agronomy",
    INDUSTRIALIZATION = "industrialization",
    TACTICS = "tactics",
    WAR_ECONOMY = "war_economy",
    IRRIGATION = "irrigation",
    MECHANIZATION = "mechanization",
    CARTOGRAPHY = "cartography",
    BANKING = "banking",
    BRONZE_WORKING = "bronze_working",
    DISCIPLINE = "discipline",
    CONSCRIPTION = "conscription",
    FORTIFICATION = "fortification",
    MILITARY_ENGINEERING = "military_engineering",
    FIELD_MEDICINE = "field_medicine",
    CHAIN_OF_COMMAND = "chain_of_command",
    STEELCRAFT = "steelcraft",
    BALLISTICS = "ballistics",
    COMBINED_ARMS = "combined_arms",
    ELITE_DRILLS = "elite_drills",
    CROP_ROTATION = "crop_rotation",
    SOIL_RENEWAL = "soil_renewal",
    SANITATION = "sanitation",
    ENGINEERING_GUILDS = "engineering_guilds",
    STEAM_POWER = "steam_power",
    MASS_PRODUCTION = "mass_production",
    STORAGE_METHODS = "storage_methods",
    ANIMAL_HUSBANDRY = "animal_husbandry",
    WINDMILLS = "windmills",
    CIVIL_ENGINEERING = "civil_engineering",
    REFINING = "refining",
    SCHOLARSHIP = "scholarship",
    NAVIGATION = "navigation",
    DIPLOMACY = "diplomacy",
    BUREAUCRACY = "bureaucracy",
    EDUCATION = "education",
    CIVIC_TRADITIONS = "civic_traditions",
    TRADE_LEDGERS = "trade_ledgers",
    URBAN_PLANNING = "urban_planning",
    PHILOSOPHY = "philosophy",
    ASTRONOMY = "astronomy",
    COMMUNICATIONS = "communications",
    CURRENCY = "currency"
}
export type CityOptionCategory = 'military' | 'improvements' | 'civil';
export interface CityOptionCost {
    gold: number;
    food: number;
    production: number;
}
export interface CityManagementOption {
    id: string;
    kind: 'building' | 'research';
    category: CityOptionCategory;
    name: string;
    description: string;
    cost: CityOptionCost;
    prerequisiteIds: string[];
    owned: boolean;
    canAfford: boolean;
    lockedByPrerequisite: boolean;
}
export interface CityManagementData {
    cityId: string;
    cityName: string;
    level: number;
    population: number;
    buildings: CityBuildingType[];
    playerResources: PlayerResources;
    options: CityManagementOption[];
}
export type ResourceGatherMode = 'none' | 'active' | 'idle' | 'cooldown';
export interface ResourceNodeStatus {
    type: ResourceNodeType;
    x: number;
    y: number;
    capacity: number;
    remaining: number;
    mode: ResourceGatherMode;
    activeProgress: number;
    cooldownProgress: number;
    cooldownTurnsRemaining: number;
    idleTickProgress: number;
}
export type MountainDestroyMode = 'pending' | 'destroying';
export interface MountainDestroyStatus {
    x: number;
    y: number;
    mode: MountainDestroyMode;
    totalTurns: number;
    remainingTurns: number;
    progress: number;
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