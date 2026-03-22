/**
 * Game Room
 * Manages a single game session
 */
export class GameRoom {
    constructor(roomId) {
        this.gameState = null;
        this.players = new Map();
        this.disconnectedPlayers = new Map();
        this.disconnectTimers = new Map();
        this.turnOrder = [];
        this.currentPlayerIndex = 0;
        this.isRunning = false;
        this.roomId = roomId;
    }
    /**
     * Add player to room
     */
    addPlayer(playerId, ws) {
        if (this.players.has(playerId)) {
            this.reconnectPlayer(playerId, ws || null);
            return;
        }
        const player = {
            id: playerId,
            name: `Player ${this.players.size + 1}`,
            isAI: false,
            isHuman: true,
            resources: { gold: 100, food: 50, production: 25 },
            units: [],
            cities: [],
            techs: [],
            color: this.getColorForPlayer(this.players.size),
        };
        this.players.set(playerId, { ws: ws || null, player });
        this.turnOrder.push(playerId);
        // Start game if we have enough players
        if (this.players.size >= 2) {
            this.startGame();
        }
    }
    hasPlayer(playerId) {
        return this.players.has(playerId);
    }
    isPlayerDisconnected(playerId) {
        return this.disconnectedPlayers.has(playerId);
    }
    markPlayerDisconnected(playerId, graceMs) {
        const playerObj = this.players.get(playerId);
        if (!playerObj)
            return;
        playerObj.ws = null;
        const now = Date.now();
        const graceUntil = now + graceMs;
        this.disconnectedPlayers.set(playerId, { disconnectedAt: now, graceUntil });
        this.broadcastState('PLAYER_DISCONNECTED', {
            playerId,
            graceMs,
        });
        const existingTimer = this.disconnectTimers.get(playerId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const timer = setTimeout(() => {
            if (!this.disconnectedPlayers.has(playerId))
                return;
            const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
            if (currentPlayerId === playerId) {
                this.forceAdvanceTurnForDisconnectedPlayer(playerId);
            }
            this.removePlayer(playerId);
            this.broadcastState('PLAYER_REMOVED', {
                playerId,
                reason: 'disconnect-timeout',
            });
        }, graceMs);
        this.disconnectTimers.set(playerId, timer);
    }
    reconnectPlayer(playerId, ws) {
        const playerObj = this.players.get(playerId);
        if (!playerObj)
            return;
        playerObj.ws = ws;
        if (this.disconnectedPlayers.has(playerId)) {
            this.disconnectedPlayers.delete(playerId);
            const timer = this.disconnectTimers.get(playerId);
            if (timer) {
                clearTimeout(timer);
                this.disconnectTimers.delete(playerId);
            }
            this.broadcastState('PLAYER_RECONNECTED', { playerId });
        }
    }
    /**
     * Remove player from room
     */
    removePlayer(playerId) {
        const existingTimer = this.disconnectTimers.get(playerId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.disconnectTimers.delete(playerId);
        }
        this.disconnectedPlayers.delete(playerId);
        const removedIndex = this.turnOrder.indexOf(playerId);
        this.players.delete(playerId);
        this.turnOrder = this.turnOrder.filter((id) => id !== playerId);
        if (this.gameState) {
            this.gameState.players = this.gameState.players.filter((player) => player.id !== playerId);
        }
        if (removedIndex !== -1 && this.turnOrder.length > 0) {
            if (removedIndex < this.currentPlayerIndex) {
                this.currentPlayerIndex -= 1;
            }
            if (this.currentPlayerIndex >= this.turnOrder.length) {
                this.currentPlayerIndex = 0;
            }
        }
        if (this.players.size === 0) {
            this.isRunning = false;
        }
    }
    /**
     * Start game
     */
    startGame() {
        if (this.isRunning || this.players.size < 2)
            return;
        this.isRunning = true;
        console.log(`Starting game in room ${this.roomId}`);
        // Initialize game state
        const gameState = {
            id: this.roomId,
            turn: 0,
            maxPlayers: 4,
            players: Array.from(this.players.values()).map((p) => p.player),
            chunks: new Map(),
            worldSeed: Math.floor(Math.random() * 2147483647),
            isMultiplayer: true,
            createdAt: Date.now(),
            lastUpdateAt: Date.now(),
        };
        this.gameState = gameState;
        // Broadcast game started
        this.broadcastState('GAME_STARTED', gameState);
    }
    /**
     * Process player action
     */
    processAction(playerId, actionType, data) {
        if (!this.gameState)
            return;
        // Validate it's the current player's turn
        const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
        if (playerId !== currentPlayerId) {
            this.sendError(playerId, 'Not your turn');
            return;
        }
        switch (actionType) {
            case 'MOVE_UNIT':
                // Server-side validation of unit movement
                console.log(`Action: Move unit for player ${playerId}`);
                this.broadcastState('ACTION_EXECUTED', { action: actionType, data });
                break;
            default:
                console.warn(`Unknown action: ${actionType}`);
                break;
        }
    }
    /**
     * End current player's turn
     */
    endPlayerTurn(playerId) {
        if (this.turnOrder.length === 0)
            return;
        const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
        if (playerId !== currentPlayerId) {
            this.sendError(playerId, 'Not your turn');
            return;
        }
        // Advance turn
        this.currentPlayerIndex =
            (this.currentPlayerIndex + 1) % this.turnOrder.length;
        if (this.gameState) {
            if (this.currentPlayerIndex === 0) {
                this.gameState.turn++;
            }
            // Notify all players
            this.broadcastState('TURN_CHANGED', {
                turn: this.gameState.turn,
                currentPlayerIndex: this.currentPlayerIndex,
            });
        }
    }
    forceAdvanceTurnForDisconnectedPlayer(playerId) {
        if (!this.gameState || this.turnOrder.length === 0)
            return;
        const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
        if (currentPlayerId !== playerId)
            return;
        this.currentPlayerIndex =
            (this.currentPlayerIndex + 1) % this.turnOrder.length;
        if (this.currentPlayerIndex === 0) {
            this.gameState.turn++;
        }
        this.broadcastState('TURN_AUTO_SKIPPED', {
            skippedPlayerId: playerId,
            turn: this.gameState.turn,
            currentPlayerIndex: this.currentPlayerIndex,
        });
    }
    /**
     * Get game state
     */
    getGameState() {
        return this.gameState;
    }
    /**
     * Get player count
     */
    getPlayerCount() {
        return this.players.size;
    }
    /**
     * Get room ID
     */
    getRoomId() {
        return this.roomId;
    }
    /**
     * Check if room is running
     */
    isGameRunning() {
        return this.isRunning;
    }
    /**
     * Broadcast message to all players
     */
    broadcast(message) {
        this.players.forEach((playerObj) => {
            if (playerObj.ws && playerObj.ws.readyState === 1) {
                // WebSocket.OPEN === 1
                playerObj.ws.send(message);
            }
        });
    }
    /**
     * Broadcast state update
     */
    broadcastState(type, data) {
        const message = {
            type,
            payload: data,
            timestamp: Date.now(),
        };
        this.broadcast(JSON.stringify(message));
    }
    /**
     * Send error to specific player
     */
    sendError(playerId, error) {
        const playerObj = this.players.get(playerId);
        if (playerObj?.ws && playerObj.ws.readyState === 1) {
            const message = {
                type: 'ERROR',
                payload: { error },
                timestamp: Date.now(),
            };
            playerObj.ws.send(JSON.stringify(message));
        }
    }
    /**
     * Get player by ID
     */
    getPlayer(playerId) {
        const playerObj = this.players.get(playerId);
        return playerObj?.player || null;
    }
    /**
     * Get all players
     */
    getPlayers() {
        return Array.from(this.players.values()).map((p) => p.player);
    }
    // ============ Helper Methods ============
    getColorForPlayer(index) {
        const colors = ['#00ff00', '#ff0000', '#0000ff', '#ffff00'];
        return colors[index % colors.length];
    }
    /**
     * Update WebSocket connection for player
     */
    updatePlayerConnection(playerId, ws) {
        this.reconnectPlayer(playerId, ws);
    }
    /**
     * Serialize room state for persistence
     */
    serialize() {
        return {
            roomId: this.roomId,
            gameState: this.gameState,
            turnOrder: this.turnOrder,
            currentPlayerIndex: this.currentPlayerIndex,
            isRunning: this.isRunning,
        };
    }
}
//# sourceMappingURL=GameRoom.js.map