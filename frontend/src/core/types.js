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
    CityBuildingType["ARMORY"] = "armory";
    CityBuildingType["DRILL_GROUND"] = "drill_ground";
    CityBuildingType["WATER_MILL"] = "water_mill";
    CityBuildingType["FORGE"] = "forge";
    CityBuildingType["LIBRARY"] = "library";
    CityBuildingType["HARBOR"] = "harbor";
    CityBuildingType["GUARD_POST"] = "guard_post";
    CityBuildingType["FLETCHER_RANGE"] = "fletcher_range";
    CityBuildingType["SIEGE_WORKSHOP"] = "siege_workshop";
    CityBuildingType["MUSTER_HALL"] = "muster_hall";
    CityBuildingType["STABLE"] = "stable";
    CityBuildingType["SIGNAL_TOWER"] = "signal_tower";
    CityBuildingType["SHIELD_FOUNDRY"] = "shield_foundry";
    CityBuildingType["VETERAN_LODGE"] = "veteran_lodge";
    CityBuildingType["SUPPLY_DEPOT"] = "supply_depot";
    CityBuildingType["WAR_COLLEGE"] = "war_college";
    CityBuildingType["ARSENAL"] = "arsenal";
    CityBuildingType["OFFICER_ACADEMY"] = "officer_academy";
    CityBuildingType["MILLING_HOUSE"] = "milling_house";
    CityBuildingType["SMOKEHOUSE"] = "smokehouse";
    CityBuildingType["STONECUTTER"] = "stonecutter";
    CityBuildingType["LUMBER_YARD"] = "lumber_yard";
    CityBuildingType["BREWERY"] = "brewery";
    CityBuildingType["BAKERY"] = "bakery";
    CityBuildingType["WEAVERY"] = "weavery";
    CityBuildingType["QUARRY_WORKS"] = "quarry_works";
    CityBuildingType["FARM_ESTATE"] = "farm_estate";
    CityBuildingType["FOUNDRY"] = "foundry";
    CityBuildingType["POWER_PLANT"] = "power_plant";
    CityBuildingType["TOWN_SQUARE"] = "town_square";
    CityBuildingType["ARCHIVE"] = "archive";
    CityBuildingType["CARAVANSERAI"] = "caravanserai";
    CityBuildingType["OBSERVATORY"] = "observatory";
    CityBuildingType["CUSTOMS_HOUSE"] = "customs_house";
    CityBuildingType["MONUMENT"] = "monument";
    CityBuildingType["COURTHOUSE"] = "courthouse";
    CityBuildingType["UNIVERSITY"] = "university";
    CityBuildingType["LIGHTHOUSE"] = "lighthouse";
    CityBuildingType["GUILD_HALL"] = "guild_hall";
    CityBuildingType["EMBASSY"] = "embassy";
})(CityBuildingType || (CityBuildingType = {}));
export var ResearchType;
(function (ResearchType) {
    ResearchType["LOGISTICS"] = "logistics";
    ResearchType["SCOUTING"] = "scouting";
    ResearchType["METALLURGY"] = "metallurgy";
    ResearchType["AGRONOMY"] = "agronomy";
    ResearchType["INDUSTRIALIZATION"] = "industrialization";
    ResearchType["TACTICS"] = "tactics";
    ResearchType["WAR_ECONOMY"] = "war_economy";
    ResearchType["IRRIGATION"] = "irrigation";
    ResearchType["MECHANIZATION"] = "mechanization";
    ResearchType["CARTOGRAPHY"] = "cartography";
    ResearchType["BANKING"] = "banking";
    ResearchType["BRONZE_WORKING"] = "bronze_working";
    ResearchType["DISCIPLINE"] = "discipline";
    ResearchType["CONSCRIPTION"] = "conscription";
    ResearchType["FORTIFICATION"] = "fortification";
    ResearchType["MILITARY_ENGINEERING"] = "military_engineering";
    ResearchType["FIELD_MEDICINE"] = "field_medicine";
    ResearchType["CHAIN_OF_COMMAND"] = "chain_of_command";
    ResearchType["STEELCRAFT"] = "steelcraft";
    ResearchType["BALLISTICS"] = "ballistics";
    ResearchType["COMBINED_ARMS"] = "combined_arms";
    ResearchType["ELITE_DRILLS"] = "elite_drills";
    ResearchType["CROP_ROTATION"] = "crop_rotation";
    ResearchType["SOIL_RENEWAL"] = "soil_renewal";
    ResearchType["SANITATION"] = "sanitation";
    ResearchType["ENGINEERING_GUILDS"] = "engineering_guilds";
    ResearchType["STEAM_POWER"] = "steam_power";
    ResearchType["MASS_PRODUCTION"] = "mass_production";
    ResearchType["STORAGE_METHODS"] = "storage_methods";
    ResearchType["ANIMAL_HUSBANDRY"] = "animal_husbandry";
    ResearchType["WINDMILLS"] = "windmills";
    ResearchType["CIVIL_ENGINEERING"] = "civil_engineering";
    ResearchType["REFINING"] = "refining";
    ResearchType["SCHOLARSHIP"] = "scholarship";
    ResearchType["NAVIGATION"] = "navigation";
    ResearchType["DIPLOMACY"] = "diplomacy";
    ResearchType["BUREAUCRACY"] = "bureaucracy";
    ResearchType["EDUCATION"] = "education";
    ResearchType["CIVIC_TRADITIONS"] = "civic_traditions";
    ResearchType["TRADE_LEDGERS"] = "trade_ledgers";
    ResearchType["URBAN_PLANNING"] = "urban_planning";
    ResearchType["PHILOSOPHY"] = "philosophy";
    ResearchType["ASTRONOMY"] = "astronomy";
    ResearchType["COMMUNICATIONS"] = "communications";
    ResearchType["CURRENCY"] = "currency";
})(ResearchType || (ResearchType = {}));
// Constants
export const CHUNK_SIZE = 32;
export const TILE_SIZE = 16; // pixels
export const VIEWPORT_TILES = {
    width: 64,
    height: 48,
};
//# sourceMappingURL=types.js.map