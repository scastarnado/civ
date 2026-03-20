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
// Unit types and properties
export var UnitType;
(function (UnitType) {
    UnitType["SETTLER"] = "settler";
    UnitType["WORKER"] = "worker";
    UnitType["WARRIOR"] = "warrior";
})(UnitType || (UnitType = {}));
// Constants
export const CHUNK_SIZE = 32;
export const TILE_SIZE = 16; // pixels
export const VIEWPORT_TILES = {
    width: 64,
    height: 48,
};
//# sourceMappingURL=types.js.map