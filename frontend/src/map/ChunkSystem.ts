/**
 * Map Chunk System
 * Deterministic procedural generation for infinite world
 */

import {
	Chunk,
	CHUNK_SIZE,
	ResourceNodeType,
	Tile,
	TileType,
} from '@/core/types';

/**
 * Simple seeded random number generator (used for deterministic generation)
 * Enables consistent chunk generation across multiple sessions
 */
export class SeededRandom {
	private seed: number;

	constructor(seed: number) {
		this.seed = seed;
	}

	next(): number {
		this.seed = (this.seed * 9301 + 49297) % 233280;
		return this.seed / 233280;
	}

	nextInt(max: number): number {
		return Math.floor(this.next() * max);
	}

	nextRange(min: number, max: number): number {
		return min + Math.floor(this.next() * (max - min));
	}
}

/**
 * Map chunk generator using deterministic noise
 */
export class ChunkGenerator {
	private worldSeed: number;

	constructor(worldSeed: number) {
		this.worldSeed = worldSeed;
	}

	/**
	 * Generate a chunk deterministically based on chunk coordinates
	 * Same chunk coordinates will always generate identical terrain
	 */
	generateChunk(cx: number, cy: number): Chunk {
		// Create unique seed for this chunk
		const chunkSeed = this.worldSeed ^ ((cx << 16) | (cy & 0xffff));

		const tiles: Tile[] = [];

		for (let y = 0; y < CHUNK_SIZE; y++) {
			for (let x = 0; x < CHUNK_SIZE; x++) {
				const globalX = cx * CHUNK_SIZE + x;
				const globalY = cy * CHUNK_SIZE + y;

				const tile = this.generateTile(globalX, globalY);
				tiles.push(tile);
			}
		}

		return {
			cx,
			cy,
			tiles,
			seed: chunkSeed,
		};
	}

	/**
	 * Add resource nodes to tiles that don't have them yet (save migration path).
	 */
	backfillResourceNodes(chunk: Chunk): Chunk {
		return {
			...chunk,
			tiles: chunk.tiles.map((tile) => ({
				...tile,
				resourceNode:
					tile.resourceNode ?? this.pickResourceNode(tile.type, tile.x, tile.y),
			})),
		};
	}

	/**
	 * Generate individual tile using multiple noise functions
	 */
	private generateTile(x: number, y: number): Tile {
		// Use multiple noise samples for better terrain variation
		const noise1 = this.perlinNoise(x, y, this.worldSeed, 1);
		const noise2 = this.perlinNoise(x * 0.5, y * 0.5, this.worldSeed ^ 1, 2);
		const combined = (noise1 * 0.7 + noise2 * 0.3) * 100;

		let type: TileType;

		// Tile distribution based on noise
		if (combined > 70) {
			type = TileType.MOUNTAIN;
		} else if (combined > 50) {
			type = TileType.FOREST;
		} else if (combined < 20) {
			type = TileType.WATER;
		} else {
			type = TileType.GRASSLAND;
		}

		const cx = Math.floor(x / CHUNK_SIZE);
		const cy = Math.floor(y / CHUNK_SIZE);
		const resourceNode = this.pickResourceNode(type, x, y);

		return {
			type,
			x,
			y,
			chunkCx: cx,
			chunkCy: cy,
			resourceNode,
		};
	}

	/**
	 * Deterministically place resource nodes by terrain type.
	 */
	private pickResourceNode(
		tileType: TileType,
		x: number,
		y: number,
	): ResourceNodeType | undefined {
		const roll = this.hash01(x, y, this.worldSeed ^ 0x5f3759df);

		if (tileType === TileType.GRASSLAND) {
			if (roll < 0.02) return ResourceNodeType.WHEAT;
			if (roll < 0.03) return ResourceNodeType.HORSES;
			if (roll < 0.035) return ResourceNodeType.GOLD;
		}

		if (tileType === TileType.FOREST) {
			if (roll < 0.03) return ResourceNodeType.DEER;
		}

		if (tileType === TileType.MOUNTAIN) {
			if (roll < 0.04) return ResourceNodeType.IRON;
			if (roll < 0.048) return ResourceNodeType.GOLD;
		}

		return undefined;
	}

	/**
	 * Stable 0..1 hash from world position and seed.
	 */
	private hash01(x: number, y: number, seed: number): number {
		let n = x * 374761393 + y * 668265263 + seed * 1274126177;
		n = (n ^ (n >> 13)) * 1274126177;
		n = n ^ (n >> 16);
		return (n >>> 0) / 4294967295;
	}

	/**
	 * Simple Perlin-like noise generator
	 * Not true Perlin but sufficient for deterministic terrain
	 */
	private perlinNoise(
		x: number,
		y: number,
		seed: number,
		scale: number,
	): number {
		const xi = Math.floor(x / scale);
		const yi = Math.floor(y / scale);
		const xf = (x / scale) % 1;
		const yf = (y / scale) % 1;

		const rng00 = new SeededRandom((seed ^ (xi << 16)) | yi);
		const rng10 = new SeededRandom((seed ^ ((xi + 1) << 16)) | yi);
		const rng01 = new SeededRandom((seed ^ (xi << 16)) | (yi + 1));
		const rng11 = new SeededRandom((seed ^ ((xi + 1) << 16)) | (yi + 1));

		const v00 = rng00.next();
		const v10 = rng10.next();
		const v01 = rng01.next();
		const v11 = rng11.next();

		// Smooth interpolation
		const u = xf * xf * (3 - 2 * xf);
		const v = yf * yf * (3 - 2 * yf);

		const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

		const nx0 = lerp(v00, v10, u);
		const nx1 = lerp(v01, v11, u);
		return lerp(nx0, nx1, v);
	}
}

/**
 * Map cache for storing generated chunks
 * Prevents regeneration of chunks
 */
export class MapCache {
	private chunks: Map<string, Chunk> = new Map();
	private generator: ChunkGenerator;

	constructor(worldSeed: number) {
		this.generator = new ChunkGenerator(worldSeed);
	}

	/**
	 * Get or generate a chunk
	 */
	getChunk(cx: number, cy: number): Chunk {
		const key = `${cx},${cy}`;
		let chunk = this.chunks.get(key);

		if (!chunk) {
			chunk = this.generator.generateChunk(cx, cy);
			this.chunks.set(key, chunk);
		}

		return chunk;
	}

	/**
	 * Get a specific tile by world coordinates
	 */
	getTile(x: number, y: number): Tile | null {
		const cx = Math.floor(x / CHUNK_SIZE);
		const cy = Math.floor(y / CHUNK_SIZE);
		const chunk = this.getChunk(cx, cy);

		return chunk.tiles.find((t) => t.x === x && t.y === y) || null;
	}

	/**
	 * Get all tiles in a rectangular region
	 */
	getTilesInRegion(x1: number, y1: number, x2: number, y2: number): Tile[] {
		const tiles: Tile[] = [];

		const minX = Math.min(x1, x2);
		const maxX = Math.max(x1, x2);
		const minY = Math.min(y1, y2);
		const maxY = Math.max(y1, y2);

		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				const tile = this.getTile(x, y);
				if (tile) tiles.push(tile);
			}
		}

		return tiles;
	}

	/**
	 * Get all chunks in a region
	 */
	getChunksInRegion(
		cx1: number,
		cy1: number,
		cx2: number,
		cy2: number,
	): Chunk[] {
		const chunks: Chunk[] = [];

		const minCx = Math.min(cx1, cx2);
		const maxCx = Math.max(cx1, cx2);
		const minCy = Math.min(cy1, cy2);
		const maxCy = Math.max(cy1, cy2);

		for (let cy = minCy; cy <= maxCy; cy++) {
			for (let cx = minCx; cx <= maxCx; cx++) {
				chunks.push(this.getChunk(cx, cy));
			}
		}

		return chunks;
	}

	/**
	 * Serialize chunks for persistence
	 */
	serializeChunks(): Record<string, Chunk> {
		const serialized: Record<string, Chunk> = {};
		this.chunks.forEach((chunk, key) => {
			serialized[key] = chunk;
		});
		return serialized;
	}

	/**
	 * Deserialize chunks from storage
	 */
	deserializeChunks(data: Record<string, Chunk>): void {
		this.chunks.clear();
		Object.entries(data).forEach(([key, chunk]) => {
			this.chunks.set(key, this.generator.backfillResourceNodes(chunk));
		});
	}

	/**
	 * Clear cache (useful for memory management)
	 */
	clearCache(): void {
		this.chunks.clear();
	}
}
