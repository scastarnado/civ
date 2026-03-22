/**
 * Player Manager
 * Manages connected players
 */
export class PlayerManager {
    constructor() {
        this.players = new Map();
    }
    /**
     * Add connected player
     */
    addPlayer(playerId, ws) {
        if (this.players.has(playerId)) {
            // Update connection
            const player = this.players.get(playerId);
            player.ws = ws;
            player.isActive = true;
            return;
        }
        this.players.set(playerId, {
            id: playerId,
            ws,
            connectedAt: Date.now(),
            isActive: true,
        });
        console.log(`Player registered: ${playerId} (Total: ${this.players.size})`);
    }
    /**
     * Remove player
     */
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.isActive = false;
        }
    }
    /**
     * Get player
     */
    getPlayer(playerId) {
        return this.players.get(playerId) || null;
    }
    /**
     * Get all active players
     */
    getActivePlayers() {
        return Array.from(this.players.values()).filter((p) => p.isActive);
    }
    /**
     * Get all players
     */
    getAllPlayers() {
        return Array.from(this.players.values());
    }
    /**
     * Check if player exists
     */
    hasPlayer(playerId) {
        return this.players.has(playerId);
    }
    /**
     * Get player count
     */
    getPlayerCount() {
        return this.players.size;
    }
    /**
     * Get active player count
     */
    getActivePlayerCount() {
        return this.getActivePlayers().length;
    }
    /**
     * Broadcast message to all players
     */
    broadcast(message, excludePlayerId) {
        this.players.forEach((player) => {
            if (excludePlayerId && player.id === excludePlayerId) {
                return;
            }
            if (player.isActive && player.ws.readyState === 1) {
                // WebSocket.OPEN === 1
                player.ws.send(message);
            }
        });
    }
    /**
     * Send message to specific player
     */
    sendToPlayer(playerId, message) {
        const player = this.players.get(playerId);
        if (player && player.isActive && player.ws.readyState === 1) {
            player.ws.send(message);
        }
    }
    /**
     * Cleanup inactive players
     */
    cleanupInactive(maxInactiveMs = 5 * 60 * 1000) {
        // 5 minutes default
        const now = Date.now();
        this.players.forEach((player, playerId) => {
            if (!player.isActive && now - player.connectedAt > maxInactiveMs) {
                this.players.delete(playerId);
                console.log(`Cleaned up inactive player: ${playerId}`);
            }
        });
    }
    /**
     * Get player statistics
     */
    getStats() {
        return {
            totalPlayers: this.players.size,
            activePlayers: this.getActivePlayerCount(),
            inactivePlayers: this.players.size - this.getActivePlayerCount(),
        };
    }
}
//# sourceMappingURL=PlayerManager.js.map