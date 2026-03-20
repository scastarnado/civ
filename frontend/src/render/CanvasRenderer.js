/**
 * Canvas Renderer
 * Handles all ASCII/character-based rendering to HTML5 Canvas
 */
import { ResourceNodeType, TILE_SIZE, } from '@/core/types';
export class CanvasRenderer {
    constructor(canvasId) {
        this.cameraX = 0;
        this.cameraY = 0;
        this.selectedEntity = null;
        this.cameraInitialized = false;
        this.localPlayerId = null;
        this.discoveredTiles = new Set();
        this.visibleTiles = new Set();
        this.unitVisionRadius = 5;
        this.cityVisionRadius = 4;
        // Colors
        this.colors = {
            text: '#00ff00',
            textDim: '#00aa00',
            background: '#000000',
            water: '#003366',
            grassland: '#006600',
            forest: '#003300',
            mountain: '#444444',
            unit: '#00ff00',
            city: '#ffff00',
            selection: '#ff0000',
            grid: '#003300',
        };
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            throw new Error(`Canvas element with id '${canvasId}' not found`);
        }
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = ctx;
        // Setup canvas rendering context
        this.ctx.font = `14px 'Courier New', monospace`;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.textBaseline = 'top';
    }
    /**
     * Render entire game view
     */
    render(gameState, mapCache, localPlayerId) {
        if (localPlayerId) {
            this.localPlayerId = localPlayerId;
        }
        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Draw grid background
        this.drawGrid();
        const localPlayer = this.getLocalPlayer(gameState);
        if (!this.cameraInitialized && localPlayer) {
            const anchorUnit = localPlayer.units[0];
            const anchorCity = localPlayer.cities[0];
            if (anchorUnit) {
                this.updateCamera(anchorUnit.x, anchorUnit.y);
                this.cameraInitialized = true;
            }
            else if (anchorCity) {
                this.updateCamera(anchorCity.x, anchorCity.y);
                this.cameraInitialized = true;
            }
        }
        this.updateVisibility(localPlayer);
        // Draw tiles
        this.drawMap(mapCache);
        // Draw cities
        gameState.players.forEach((player) => {
            player.cities.forEach((city) => {
                if (this.shouldRenderEntity(city.ownerId, city.x, city.y)) {
                    this.drawCity(city, player.color);
                }
            });
        });
        // Draw units
        gameState.players.forEach((player) => {
            player.units.forEach((unit) => {
                if (this.shouldRenderEntity(unit.ownerId, unit.x, unit.y)) {
                    this.drawUnit(unit, player.color);
                }
            });
        });
        // Draw selection highlight
        if (this.selectedEntity) {
            this.drawSelectionHighlight();
        }
    }
    /**
     * Draw the map tiles visible in viewport
     */
    drawMap(mapCache) {
        const viewportWidthTiles = Math.ceil(this.canvas.width / TILE_SIZE);
        const viewportHeightTiles = Math.ceil(this.canvas.height / TILE_SIZE);
        const startTileX = Math.floor(this.cameraX);
        const startTileY = Math.floor(this.cameraY);
        const endTileX = startTileX + viewportWidthTiles;
        const endTileY = startTileY + viewportHeightTiles;
        // Get all tiles in viewport
        const tiles = mapCache.getTilesInRegion(startTileX, startTileY, endTileX, endTileY);
        tiles.forEach((tile) => {
            const tileIsVisible = this.isTileVisible(tile.x, tile.y);
            const tileIsDiscovered = this.isTileDiscovered(tile.x, tile.y);
            this.drawTile(tile, tileIsVisible, tileIsDiscovered);
        });
    }
    /**
     * Draw individual tile
     */
    drawTile(tile, isVisible, isDiscovered) {
        const screenX = (tile.x - this.cameraX) * TILE_SIZE;
        const screenY = (tile.y - this.cameraY) * TILE_SIZE;
        // Skip off-screen tiles
        if (screenX < -TILE_SIZE ||
            screenX > this.canvas.width ||
            screenY < -TILE_SIZE ||
            screenY > this.canvas.height) {
            return;
        }
        if (!isDiscovered) {
            this.ctx.fillStyle = this.colors.background;
            this.ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = this.colors.grid;
            this.ctx.lineWidth = 0.5;
            this.ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            return;
        }
        // Draw background
        let bgColor = this.colors.background;
        let char = '.';
        switch (tile.type) {
            case '.':
                bgColor = this.colors.grassland;
                char = '.';
                break;
            case 'T':
                bgColor = this.colors.forest;
                char = 'T';
                break;
            case '^':
                bgColor = this.colors.mountain;
                char = '^';
                break;
            case '~':
                bgColor = this.colors.water;
                char = '~';
                break;
        }
        // Draw tile background
        this.ctx.fillStyle = bgColor;
        if (!isVisible) {
            this.ctx.globalAlpha = 0.35;
        }
        this.ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        this.ctx.globalAlpha = 1.0;
        // Draw tile border
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        // Draw character
        this.ctx.fillStyle = isVisible ? this.colors.textDim : this.colors.grid;
        this.ctx.fillText(char, screenX + 2, screenY + 2);
        // Draw resource marker overlay
        if (tile.resourceNode) {
            const marker = this.getResourceMarker(tile.resourceNode);
            this.ctx.fillStyle = isVisible ? marker.color : this.colors.textDim;
            this.ctx.fillText(marker.symbol, screenX + 8, screenY + 2);
        }
    }
    getResourceMarker(resourceNode) {
        switch (resourceNode) {
            case ResourceNodeType.WHEAT:
                return { symbol: 'w', color: '#e4c36a' };
            case ResourceNodeType.DEER:
                return { symbol: 'd', color: '#b78b5a' };
            case ResourceNodeType.IRON:
                return { symbol: 'i', color: '#9ea7ad' };
            case ResourceNodeType.HORSES:
                return { symbol: 'h', color: '#c9974e' };
            case ResourceNodeType.GOLD:
                return { symbol: '$', color: '#ffd447' };
            default:
                return { symbol: '?', color: this.colors.textDim };
        }
    }
    /**
     * Draw city
     */
    drawCity(city, playerColor) {
        const screenX = (city.x - this.cameraX) * TILE_SIZE;
        const screenY = (city.y - this.cameraY) * TILE_SIZE;
        if (screenX < -TILE_SIZE ||
            screenX > this.canvas.width ||
            screenY < -TILE_SIZE ||
            screenY > this.canvas.height) {
            return;
        }
        // Draw city background marker
        const markerColor = (this.selectedEntity?.type === 'city' &&
            this.selectedEntity.id === city.id) ?
            this.colors.selection
            : playerColor;
        this.ctx.fillStyle = markerColor;
        this.ctx.globalAlpha = 0.2;
        const footprintRadius = city.footprintRadius || 0;
        for (let dy = -footprintRadius; dy <= footprintRadius; dy++) {
            for (let dx = -footprintRadius; dx <= footprintRadius; dx++) {
                const fx = screenX + dx * TILE_SIZE;
                const fy = screenY + dy * TILE_SIZE;
                this.ctx.fillRect(fx, fy, TILE_SIZE, TILE_SIZE);
            }
        }
        this.ctx.globalAlpha = 1.0;
        // Draw city symbol
        this.ctx.fillStyle = playerColor;
        this.ctx.font = `bold 14px 'Courier New', monospace`;
        this.ctx.fillText('C', screenX + 4, screenY + 2);
        this.ctx.font = `14px 'Courier New', monospace`;
        // Draw city tag
        this.ctx.fillStyle = playerColor;
        this.ctx.fillText(city.population.toString(), screenX + 10, screenY + 2);
    }
    /**
     * Draw unit
     */
    drawUnit(unit, playerColor) {
        const screenX = (unit.x - this.cameraX) * TILE_SIZE;
        const screenY = (unit.y - this.cameraY) * TILE_SIZE;
        if (screenX < -TILE_SIZE ||
            screenX > this.canvas.width ||
            screenY < -TILE_SIZE ||
            screenY > this.canvas.height) {
            return;
        }
        // Draw unit background marker
        const markerColor = (this.selectedEntity?.type === 'unit' &&
            this.selectedEntity.id === unit.id) ?
            this.colors.selection
            : playerColor;
        this.ctx.fillStyle = markerColor;
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        this.ctx.globalAlpha = 1.0;
        // Draw unit symbol
        let symbol = 'U';
        switch (unit.type) {
            case 'settler':
                symbol = 'S';
                break;
            case 'worker':
                symbol = 'W';
                break;
            case 'warrior':
                symbol = '!';
                break;
        }
        this.ctx.fillStyle = playerColor;
        this.ctx.font = `bold 14px 'Courier New', monospace`;
        this.ctx.fillText(symbol, screenX + 4, screenY + 2);
        this.ctx.font = `14px 'Courier New', monospace`;
        // Draw health indicator
        if (unit.health < unit.maxHealth) {
            this.ctx.fillStyle = '#ff0000';
            const healthPercent = unit.health / unit.maxHealth;
            this.ctx.fillRect(screenX + 2, screenY + 11, (TILE_SIZE - 4) * healthPercent, 2);
        }
    }
    /**
     * Draw grid background
     */
    drawGrid() {
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 0.5;
        // Draw vertical lines
        for (let x = 0; x < this.canvas.width; x += TILE_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        // Draw horizontal lines
        for (let y = 0; y < this.canvas.height; y += TILE_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    /**
     * Draw selection highlight
     */
    drawSelectionHighlight() {
        if (!this.selectedEntity)
            return;
        // Selection is drawn as part of unit/city rendering
    }
    /**
     * Update camera to center on target
     */
    updateCamera(targetX, targetY) {
        const viewportWidthTiles = Math.ceil(this.canvas.width / TILE_SIZE);
        const viewportHeightTiles = Math.ceil(this.canvas.height / TILE_SIZE);
        // Center camera on target
        this.cameraX = targetX - viewportWidthTiles / 2;
        this.cameraY = targetY - viewportHeightTiles / 2;
    }
    /**
     * Pan camera by delta
     */
    panCamera(deltaX, deltaY) {
        this.cameraX += deltaX;
        this.cameraY += deltaY;
    }
    centerCameraOn(worldX, worldY) {
        this.updateCamera(worldX, worldY);
        this.cameraInitialized = true;
    }
    setLocalPlayerId(playerId) {
        if (this.localPlayerId !== playerId) {
            this.discoveredTiles.clear();
            this.visibleTiles.clear();
        }
        this.localPlayerId = playerId;
    }
    /**
     * Get camera position
     */
    getCameraPosition() {
        return { x: this.cameraX, y: this.cameraY };
    }
    /**
     * Get canvas dimensions
     */
    getCanvasDimensions() {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
        };
    }
    /**
     * Select entity
     */
    selectEntity(type, id) {
        this.selectedEntity = { type, id };
    }
    /**
     * Deselect entity
     */
    deselectEntity() {
        this.selectedEntity = null;
    }
    /**
     * Get selected entity
     */
    getSelectedEntity() {
        return this.selectedEntity;
    }
    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        return {
            x: Math.floor(this.cameraX + screenX / TILE_SIZE),
            y: Math.floor(this.cameraY + screenY / TILE_SIZE),
        };
    }
    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.cameraX) * TILE_SIZE,
            y: (worldY - this.cameraY) * TILE_SIZE,
        };
    }
    getLocalPlayer(gameState) {
        if (!gameState.players.length)
            return null;
        if (this.localPlayerId) {
            const byId = gameState.players.find((p) => p.id === this.localPlayerId);
            if (byId)
                return byId;
        }
        return gameState.players.find((p) => p.isHuman) || gameState.players[0];
    }
    updateVisibility(localPlayer) {
        this.visibleTiles.clear();
        if (!localPlayer)
            return;
        const visionBonus = localPlayer.progression?.visionBonus || 0;
        localPlayer.units.forEach((unit) => {
            this.revealAround(unit.x, unit.y, this.unitVisionRadius + visionBonus);
        });
        localPlayer.cities.forEach((city) => {
            this.revealAround(city.x, city.y, this.cityVisionRadius + visionBonus);
        });
    }
    revealAround(centerX, centerY, radius) {
        const radiusSq = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy > radiusSq)
                    continue;
                const x = centerX + dx;
                const y = centerY + dy;
                const key = this.tileKey(x, y);
                this.visibleTiles.add(key);
                this.discoveredTiles.add(key);
            }
        }
    }
    tileKey(x, y) {
        return `${x},${y}`;
    }
    isTileVisible(x, y) {
        return this.visibleTiles.has(this.tileKey(x, y));
    }
    isTileDiscovered(x, y) {
        return this.discoveredTiles.has(this.tileKey(x, y));
    }
    shouldRenderEntity(ownerId, x, y) {
        if (!this.localPlayerId) {
            return this.isTileVisible(x, y);
        }
        if (ownerId === this.localPlayerId) {
            return true;
        }
        return this.isTileVisible(x, y);
    }
}
//# sourceMappingURL=CanvasRenderer.js.map