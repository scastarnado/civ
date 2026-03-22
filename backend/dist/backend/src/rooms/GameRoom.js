/**
 * Game Room
 * Manages one lobby/game session.
 */
export class GameRoom {
    constructor(roomId, lobbyCode, hostPlayerId) {
        this.gameState = null;
        this.players = new Map();
        this.disconnectedPlayers = new Map();
        this.disconnectTimers = new Map();
        this.turnOrder = [];
        this.currentPlayerIndex = 0;
        this.isRunning = false;
        this.roomId = roomId;
        this.lobbyCode = lobbyCode;
        this.hostPlayerId = hostPlayerId;
    }
    addPlayer(playerId, playerName, ws) {
        if (this.players.has(playerId)) {
            this.reconnectPlayer(playerId, ws || null);
            this.updatePlayerName(playerId, playerName);
            return;
        }
        const player = {
            id: playerId,
            name: playerName,
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
    }
    updatePlayerName(playerId, playerName) {
        const playerObj = this.players.get(playerId);
        if (!playerObj)
            return;
        playerObj.player.name = playerName;
        if (this.gameState) {
            const statePlayer = this.gameState.players.find((p) => p.id === playerId);
            if (statePlayer) {
                statePlayer.name = playerName;
            }
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
            if (currentPlayerId === playerId && this.isRunning) {
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
        if (playerId === this.hostPlayerId && this.turnOrder.length > 0) {
            this.hostPlayerId = this.turnOrder[0];
        }
        if (this.players.size === 0) {
            this.isRunning = false;
        }
    }
    startGame() {
        if (this.isRunning || this.players.size < 2)
            return false;
        this.isRunning = true;
        console.log(`Starting game in room ${this.roomId}`);
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
        this.broadcastState('GAME_STARTED', {
            roomId: this.roomId,
            worldSeed: gameState.worldSeed,
            players: gameState.players.map((p) => ({ id: p.id, name: p.name })),
        });
        return true;
    }
    processAction(playerId, actionType, data) {
        if (!this.gameState)
            return;
        const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
        if (playerId !== currentPlayerId) {
            sendErrorForPlayer(this.players, playerId, 'Not your turn');
            return;
        }
        switch (actionType) {
            case 'MOVE_UNIT':
                this.broadcastState('ACTION_EXECUTED', { action: actionType, data });
                break;
            default:
                break;
        }
    }
    endPlayerTurn(playerId) {
        if (!this.isRunning || this.turnOrder.length === 0)
            return;
        const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
        if (playerId !== currentPlayerId) {
            sendErrorForPlayer(this.players, playerId, 'Not your turn');
            return;
        }
        this.currentPlayerIndex =
            (this.currentPlayerIndex + 1) % this.turnOrder.length;
        if (this.gameState) {
            if (this.currentPlayerIndex === 0) {
                this.gameState.turn++;
            }
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
    getGameState() {
        return this.gameState;
    }
    getPlayerCount() {
        return this.players.size;
    }
    getRoomId() {
        return this.roomId;
    }
    getLobbyCode() {
        return this.lobbyCode;
    }
    getHostPlayerId() {
        return this.hostPlayerId;
    }
    setHostPlayerId(playerId) {
        this.hostPlayerId = playerId;
    }
    isGameRunning() {
        return this.isRunning;
    }
    getLobbySnapshot(maxPlayers = 4) {
        return {
            roomId: this.roomId,
            lobbyCode: this.lobbyCode,
            hostPlayerId: this.hostPlayerId,
            players: Array.from(this.players.values()).map(({ player, ws }) => ({
                id: player.id,
                name: player.name,
                connected: !!ws,
            })),
            maxPlayers,
            started: this.isRunning,
        };
    }
    broadcast(message) {
        this.players.forEach((playerObj) => {
            if (playerObj.ws && playerObj.ws.readyState === 1) {
                playerObj.ws.send(message);
            }
        });
    }
    broadcastState(type, data) {
        const message = {
            type,
            payload: data,
            timestamp: Date.now(),
        };
        this.broadcast(JSON.stringify(message));
    }
    getPlayer(playerId) {
        const playerObj = this.players.get(playerId);
        return playerObj?.player || null;
    }
    getPlayers() {
        return Array.from(this.players.values()).map((p) => p.player);
    }
    updatePlayerConnection(playerId, ws) {
        this.reconnectPlayer(playerId, ws);
    }
    getColorForPlayer(index) {
        const colors = ['#00ff00', '#ff0000', '#0000ff', '#ffff00'];
        return colors[index % colors.length];
    }
}
function sendErrorForPlayer(players, playerId, error) {
    const playerObj = players.get(playerId);
    if (playerObj?.ws && playerObj.ws.readyState === 1) {
        const message = {
            type: 'ERROR',
            payload: { error },
            timestamp: Date.now(),
        };
        playerObj.ws.send(JSON.stringify(message));
    }
}
//# sourceMappingURL=GameRoom.js.map