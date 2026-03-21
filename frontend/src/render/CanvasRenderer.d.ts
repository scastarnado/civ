/**
 * Canvas Renderer
 * Handles all ASCII/character-based rendering to HTML5 Canvas
 */
import { GameState } from '@/core/types';
import { MapCache } from '@/map/ChunkSystem';
interface AIRumorHint {
	x: number;
	y: number;
	intensity: number;
}
export declare class CanvasRenderer {
	private canvas;
	private ctx;
	private cameraX;
	private cameraY;
	private selectedEntity;
	private cameraInitialized;
	private localPlayerId;
	private discoveredTiles;
	private visibleTiles;
	private aiRumorHints;
	private readonly unitVisionRadius;
	private readonly cityVisionRadius;
	private colors;
	constructor(canvasId: string);
	/**
	 * Render entire game view
	 */
	render(
		gameState: GameState,
		mapCache: MapCache,
		localPlayerId?: string,
	): void;
	/**
	 * Draw the map tiles visible in viewport
	 */
	private drawMap;
	/**
	 * Draw individual tile
	 */
	private drawTile;
	private getResourceMarker;
	/**
	 * Draw city
	 */
	private drawCity;
	/**
	 * Draw unit
	 */
	private drawUnit;
	/**
	 * Draw grid background
	 */
	private drawGrid;
	/**
	 * Draw selection highlight
	 */
	private drawSelectionHighlight;
	/**
	 * Update camera to center on target
	 */
	private updateCamera;
	/**
	 * Pan camera by delta
	 */
	panCamera(deltaX: number, deltaY: number): void;
	centerCameraOn(worldX: number, worldY: number): void;
	setLocalPlayerId(playerId: string): void;
	setAIRumorHints(hints: AIRumorHint[]): void;
	/**
	 * Get camera position
	 */
	getCameraPosition(): {
		x: number;
		y: number;
	};
	/**
	 * Get canvas dimensions
	 */
	getCanvasDimensions(): {
		width: number;
		height: number;
	};
	/**
	 * Select entity
	 */
	selectEntity(type: string, id: string): void;
	/**
	 * Deselect entity
	 */
	deselectEntity(): void;
	/**
	 * Get selected entity
	 */
	getSelectedEntity(): {
		type: string;
		id: string;
	} | null;
	/**
	 * Convert screen coordinates to world coordinates
	 */
	screenToWorld(
		screenX: number,
		screenY: number,
	): {
		x: number;
		y: number;
	};
	/**
	 * Convert world coordinates to screen coordinates
	 */
	worldToScreen(
		worldX: number,
		worldY: number,
	): {
		x: number;
		y: number;
	};
	private getLocalPlayer;
	private updateVisibility;
	private revealAround;
	private tileKey;
	private isTileVisible;
	private isTileDiscovered;
	private shouldRenderEntity;
	private drawAIRumorHints;
}
export {};
//# sourceMappingURL=CanvasRenderer.d.ts.map
