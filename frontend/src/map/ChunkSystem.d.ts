/**
 * Map Chunk System
 * Deterministic procedural generation for infinite world
 */
import { Chunk, Tile } from '@/core/types';
/**
 * Simple seeded random number generator (used for deterministic generation)
 * Enables consistent chunk generation across multiple sessions
 */
export declare class SeededRandom {
    private seed;
    constructor(seed: number);
    next(): number;
    nextInt(max: number): number;
    nextRange(min: number, max: number): number;
}
/**
 * Map chunk generator using deterministic noise
 */
export declare class ChunkGenerator {
    private worldSeed;
    constructor(worldSeed: number);
    /**
     * Generate a chunk deterministically based on chunk coordinates
     * Same chunk coordinates will always generate identical terrain
     */
    generateChunk(cx: number, cy: number): Chunk;
    /**
     * Add resource nodes to tiles that don't have them yet (save migration path).
     */
    backfillResourceNodes(chunk: Chunk): Chunk;
    /**
     * Generate individual tile using multiple noise functions
     */
    private generateTile;
    /**
     * Deterministically place resource nodes by terrain type.
     */
    private pickResourceNode;
    /**
     * Stable 0..1 hash from world position and seed.
     */
    private hash01;
    /**
     * Simple Perlin-like noise generator
     * Not true Perlin but sufficient for deterministic terrain
     */
    private perlinNoise;
}
/**
 * Map cache for storing generated chunks
 * Prevents regeneration of chunks
 */
export declare class MapCache {
    private chunks;
    private generator;
    constructor(worldSeed: number);
    /**
     * Get or generate a chunk
     */
    getChunk(cx: number, cy: number): Chunk;
    /**
     * Get a specific tile by world coordinates
     */
    getTile(x: number, y: number): Tile | null;
    /**
     * Get all tiles in a rectangular region
     */
    getTilesInRegion(x1: number, y1: number, x2: number, y2: number): Tile[];
    /**
     * Get all chunks in a region
     */
    getChunksInRegion(cx1: number, cy1: number, cx2: number, cy2: number): Chunk[];
    /**
     * Serialize chunks for persistence
     */
    serializeChunks(): Record<string, Chunk>;
    /**
     * Deserialize chunks from storage
     */
    deserializeChunks(data: Record<string, Chunk>): void;
    /**
     * Clear cache (useful for memory management)
     */
    clearCache(): void;
}
//# sourceMappingURL=ChunkSystem.d.ts.map