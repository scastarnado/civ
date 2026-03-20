/**
 * Shared Type Definitions
 * Used by both frontend and backend
 */
// Tile types
export var TileType;
(function (TileType) {
    TileType["GRASSLAND"] = ".";
    TileType["FOREST"] = "T";
    TileType["MOUNTAIN"] = "^";
    TileType["WATER"] = "~";
})(TileType || (TileType = {}));
export var ResourceNodeType;
(function (ResourceNodeType) {
    ResourceNodeType["WHEAT"] = "wheat";
    ResourceNodeType["DEER"] = "deer";
    ResourceNodeType["IRON"] = "iron";
    ResourceNodeType["HORSES"] = "horses";
    ResourceNodeType["GOLD"] = "gold";
})(ResourceNodeType || (ResourceNodeType = {}));
// Unit types and properties
export var UnitType;
(function (UnitType) {
    UnitType["SETTLER"] = "settler";
    UnitType["WORKER"] = "worker";
    UnitType["WARRIOR"] = "warrior";
})(UnitType || (UnitType = {}));
export var CityBuildingType;
(function (CityBuildingType) {
    CityBuildingType["GRANARY"] = "granary";
    CityBuildingType["WORKSHOP"] = "workshop";
    CityBuildingType["MARKET"] = "market";
    CityBuildingType["BARRACKS"] = "barracks";
    CityBuildingType["WATCHTOWER"] = "watchtower";
})(CityBuildingType || (CityBuildingType = {}));
export var ResearchType;
(function (ResearchType) {
    ResearchType["LOGISTICS"] = "logistics";
    ResearchType["SCOUTING"] = "scouting";
    ResearchType["METALLURGY"] = "metallurgy";
    ResearchType["AGRONOMY"] = "agronomy";
    ResearchType["INDUSTRIALIZATION"] = "industrialization";
})(ResearchType || (ResearchType = {}));
// Constants
export const CHUNK_SIZE = 32;
export const TILE_SIZE = 16; // pixels
export const VIEWPORT_TILES = {
    width: 64,
    height: 48,
};
//# sourceMappingURL=types.js.map