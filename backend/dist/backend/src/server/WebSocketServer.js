/**
 * WebSocket Server
 * Manages client connections, matchmaking queue, and friend lobbies.
 */
import { WebSocket, WebSocketServer } from 'ws';
import { PlayerManager } from '../players/PlayerManager';
import { GameRoom } from '../rooms/GameRoom';
export class GameServer {
    constructor(port = 8080) {
        this.rooms = new Map();
        this.lobbiesByCode = new Map();
        this.queue = [];
        this.maxPlayersPerMatch = 4;
        this.disconnectGraceMs = 120000;
        this.playerNames = new Map();
        this.port = port;
        this.wss = new WebSocketServer({ port });
        this.playerManager = new PlayerManager();
        this.setupConnectionHandlers();
    }
    start() {
        console.log(`WebSocket server listening on port ${this.port}`);
    }
    setupConnectionHandlers() {
        this.wss.on('connection', (ws) => {
            console.log('Client connected');
            let session = null;
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    session = this.handleMessage(ws, message, session);
                }
                catch (error) {
                    console.error('Failed to parse message:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });
            ws.on('close', () => {
                if (!session)
                    return;
                console.log(`Client disconnected: ${session.playerId}`);
                this.handleDisconnect(session.playerId, session.roomId);
            });
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    }
    handleMessage(ws, message, session) {
        switch (message.type) {
            case 'HANDSHAKE':
                return this.handleHandshake(ws, message, session);
            case 'MATCHMAKING_JOIN_QUEUE': {
                if (!session) {
                    this.sendError(ws, 'Handshake required first');
                    return session;
                }
                this.handleJoinQueue(session.playerId, ws);
                return session;
            }
            case 'MATCHMAKING_LEAVE_QUEUE': {
                if (!session)
                    return session;
                this.removeFromQueue(session.playerId);
                this.sendState(ws, 'QUEUE_STATUS', {
                    queued: false,
                    position: -1,
                    queuedPlayers: this.queue.length,
                });
                return session;
            }
            case 'FRIENDS_HOST_LOBBY': {
                if (!session) {
                    this.sendError(ws, 'Handshake required first');
                    return session;
                }
                const room = this.createLobbyForHost(session.playerId, ws);
                session.roomId = room.getRoomId();
                return session;
            }
            case 'FRIENDS_JOIN_LOBBY': {
                if (!session) {
                    this.sendError(ws, 'Handshake required first');
                    return session;
                }
                const payload = (message.payload || {});
                const room = this.joinLobbyByCode(session.playerId, payload.lobbyCode || '', ws);
                if (room) {
                    session.roomId = room.getRoomId();
                }
                return session;
            }
            case 'LOBBY_LEAVE': {
                if (!session)
                    return session;
                const fallbackRoom = this.findRoomByPlayerId(session.playerId);
                const effectiveRoomId = session.roomId || fallbackRoom?.getRoomId() || null;
                this.leaveLobby(session.playerId, effectiveRoomId, ws);
                session.roomId = null;
                return session;
            }
            case 'LOBBY_START_GAME': {
                if (!session)
                    return session;
                const fallbackRoom = this.findRoomByPlayerId(session.playerId);
                const effectiveRoomId = session.roomId || fallbackRoom?.getRoomId() || null;
                if (!effectiveRoomId) {
                    this.sendError(ws, 'No lobby found for player');
                    return session;
                }
                const room = this.rooms.get(effectiveRoomId);
                if (!room)
                    return session;
                if (room.getHostPlayerId() !== session.playerId) {
                    this.sendError(ws, 'Only host can start the game');
                    return session;
                }
                if (!room.startGame()) {
                    this.sendError(ws, 'Need at least 2 players to start');
                    return session;
                }
                session.roomId = effectiveRoomId;
                return session;
            }
            case 'MOVE_UNIT':
            case 'END_TURN':
            case 'SYNC_STATE': {
                if (!session)
                    return session;
                const fallbackRoom = this.findRoomByPlayerId(session.playerId);
                const effectiveRoomId = session.roomId || fallbackRoom?.getRoomId() || null;
                if (!effectiveRoomId) {
                    this.sendError(ws, 'No active room for player');
                    return session;
                }
                session.roomId = effectiveRoomId;
                this.handleGameMessage(ws, session.playerId, effectiveRoomId, message);
                return session;
            }
            default:
                console.warn(`Unknown message type: ${message.type}`);
                return session;
        }
    }
    handleHandshake(ws, message, session) {
        const payload = (message.payload || {});
        if (!payload.playerId) {
            this.sendError(ws, 'Missing playerId in handshake');
            return session;
        }
        const playerId = payload.playerId;
        const playerName = (payload.playerName || 'Player').trim() || 'Player';
        this.playerNames.set(playerId, playerName);
        this.playerManager.addPlayer(playerId, ws);
        const existingRoom = this.findRoomByPlayerId(playerId);
        if (existingRoom) {
            existingRoom.updatePlayerName(playerId, playerName);
            existingRoom.reconnectPlayer(playerId, ws);
            this.sendState(ws, 'HANDSHAKE_ACK', {
                playerId,
                roomId: existingRoom.getRoomId(),
                reconnected: true,
                graceMs: this.disconnectGraceMs,
            });
            if (!existingRoom.isGameRunning()) {
                this.broadcastLobbyUpdate(existingRoom);
            }
            return {
                playerId,
                roomId: existingRoom.getRoomId(),
            };
        }
        this.sendState(ws, 'HANDSHAKE_ACK', {
            playerId,
            roomId: null,
            reconnected: false,
            graceMs: this.disconnectGraceMs,
        });
        return { playerId, roomId: null };
    }
    handleGameMessage(ws, playerId, roomId, message) {
        const room = this.rooms.get(roomId);
        if (!room || !room.isGameRunning()) {
            this.sendError(ws, 'Game room not active');
            return;
        }
        switch (message.type) {
            case 'MOVE_UNIT':
                room.processAction(playerId, 'MOVE_UNIT', message.payload);
                break;
            case 'END_TURN':
                room.endPlayerTurn(playerId);
                break;
            case 'SYNC_STATE':
                this.sendState(ws, 'STATE_UPDATE', room.getGameState());
                break;
        }
    }
    handleJoinQueue(playerId, ws) {
        this.removeFromQueue(playerId);
        this.leaveNonRunningLobbyIfAny(playerId);
        this.queue.push(playerId);
        const position = this.queue.indexOf(playerId) + 1;
        this.sendState(ws, 'QUEUE_STATUS', {
            queued: true,
            position,
            queuedPlayers: this.queue.length,
        });
        this.broadcastQueueSize();
        if (this.queue.length >= this.maxPlayersPerMatch) {
            const matchedPlayers = this.queue.splice(0, this.maxPlayersPerMatch);
            this.createMatchRoom(matchedPlayers);
            this.broadcastQueueSize();
        }
    }
    createMatchRoom(playerIds) {
        const roomId = `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const lobbyCode = this.generateLobbyCode();
        const hostPlayerId = playerIds[0];
        const room = new GameRoom(roomId, lobbyCode, hostPlayerId);
        this.rooms.set(roomId, room);
        this.lobbiesByCode.set(lobbyCode, roomId);
        playerIds.forEach((playerId) => {
            const player = this.playerManager.getPlayer(playerId);
            const name = this.playerNames.get(playerId) || 'Player';
            room.addPlayer(playerId, name, player?.ws);
        });
        room.startGame();
        const payload = {
            roomId,
            playerIds,
            players: room.getPlayers().map((p) => ({ id: p.id, name: p.name })),
        };
        room.broadcast(JSON.stringify({
            type: 'MATCH_FOUND',
            payload,
            timestamp: Date.now(),
        }));
    }
    createLobbyForHost(playerId, ws) {
        this.removeFromQueue(playerId);
        this.leaveNonRunningLobbyIfAny(playerId);
        const roomId = `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const lobbyCode = this.generateLobbyCode();
        const name = this.playerNames.get(playerId) || 'Player';
        const room = new GameRoom(roomId, lobbyCode, playerId);
        room.addPlayer(playerId, name, ws);
        this.rooms.set(roomId, room);
        this.lobbiesByCode.set(lobbyCode, roomId);
        this.sendState(ws, 'LOBBY_CREATED', room.getLobbySnapshot(this.maxPlayersPerMatch));
        this.broadcastLobbyUpdate(room);
        return room;
    }
    joinLobbyByCode(playerId, rawLobbyCode, ws) {
        const lobbyCode = rawLobbyCode.trim().toUpperCase();
        if (!lobbyCode) {
            this.sendError(ws, 'Please enter a lobby code');
            return null;
        }
        const roomId = this.lobbiesByCode.get(lobbyCode);
        if (!roomId) {
            this.sendError(ws, 'Lobby not found');
            return null;
        }
        const room = this.rooms.get(roomId);
        if (!room || room.isGameRunning()) {
            this.sendError(ws, 'Lobby is not available');
            return null;
        }
        if (room.getPlayerCount() >= this.maxPlayersPerMatch &&
            !room.hasPlayer(playerId)) {
            this.sendError(ws, 'Lobby is full');
            return null;
        }
        this.removeFromQueue(playerId);
        this.leaveNonRunningLobbyIfAny(playerId);
        const name = this.playerNames.get(playerId) || 'Player';
        room.addPlayer(playerId, name, ws);
        this.broadcastLobbyUpdate(room);
        return room;
    }
    leaveLobby(playerId, roomId, ws) {
        if (!roomId)
            return;
        const room = this.rooms.get(roomId);
        if (!room || room.isGameRunning())
            return;
        const wasHost = room.getHostPlayerId() === playerId;
        room.removePlayer(playerId);
        this.sendState(ws, 'LOBBY_LEFT', { roomId, playerId });
        if (room.getPlayerCount() === 0 || wasHost) {
            this.closeLobbyRoom(room);
            return;
        }
        this.broadcastLobbyUpdate(room);
    }
    handleDisconnect(playerId, roomId) {
        this.removeFromQueue(playerId);
        const effectiveRoomId = roomId || this.findRoomByPlayerId(playerId)?.getRoomId() || null;
        if (effectiveRoomId) {
            const room = this.rooms.get(effectiveRoomId);
            if (room) {
                if (room.isGameRunning()) {
                    room.markPlayerDisconnected(playerId, this.disconnectGraceMs);
                }
                else {
                    const wasHost = room.getHostPlayerId() === playerId;
                    room.removePlayer(playerId);
                    if (room.getPlayerCount() === 0 || wasHost) {
                        this.closeLobbyRoom(room);
                    }
                    else {
                        this.broadcastLobbyUpdate(room);
                    }
                }
            }
        }
        this.playerManager.removePlayer(playerId);
    }
    removeFromQueue(playerId) {
        const prevLen = this.queue.length;
        this.queue = this.queue.filter((id) => id !== playerId);
        if (this.queue.length !== prevLen) {
            this.broadcastQueueSize();
        }
    }
    leaveNonRunningLobbyIfAny(playerId) {
        const room = this.findRoomByPlayerId(playerId);
        if (!room || room.isGameRunning())
            return;
        const wasHost = room.getHostPlayerId() === playerId;
        room.removePlayer(playerId);
        if (room.getPlayerCount() === 0 || wasHost) {
            this.closeLobbyRoom(room);
        }
        else {
            this.broadcastLobbyUpdate(room);
        }
    }
    closeLobbyRoom(room) {
        const snapshot = room.getLobbySnapshot(this.maxPlayersPerMatch);
        room.broadcast(JSON.stringify({
            type: 'LOBBY_CLOSED',
            payload: {
                roomId: snapshot.roomId,
                lobbyCode: snapshot.lobbyCode,
            },
            timestamp: Date.now(),
        }));
        this.lobbiesByCode.delete(snapshot.lobbyCode);
        this.rooms.delete(snapshot.roomId);
    }
    broadcastLobbyUpdate(room) {
        room.broadcast(JSON.stringify({
            type: 'LOBBY_UPDATED',
            payload: room.getLobbySnapshot(this.maxPlayersPerMatch),
            timestamp: Date.now(),
        }));
    }
    broadcastQueueSize() {
        this.queue.forEach((playerId, idx) => {
            const player = this.playerManager.getPlayer(playerId);
            if (!player || player.ws.readyState !== WebSocket.OPEN)
                return;
            this.sendState(player.ws, 'QUEUE_STATUS', {
                queued: true,
                position: idx + 1,
                queuedPlayers: this.queue.length,
            });
        });
    }
    findRoomByPlayerId(playerId) {
        for (const room of this.rooms.values()) {
            if (room.hasPlayer(playerId)) {
                return room;
            }
        }
        return null;
    }
    generateLobbyCode() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        if (this.lobbiesByCode.has(code)) {
            return this.generateLobbyCode();
        }
        return code;
    }
    sendState(ws, type, data) {
        if (ws.readyState === WebSocket.OPEN) {
            const message = {
                type,
                payload: data,
                timestamp: Date.now(),
            };
            ws.send(JSON.stringify(message));
        }
    }
    sendError(ws, error) {
        if (ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'ERROR',
                payload: { error },
                timestamp: Date.now(),
            };
            ws.send(JSON.stringify(message));
        }
    }
    stop() {
        this.wss.close();
        console.log('Server stopped');
    }
}
//# sourceMappingURL=WebSocketServer.js.map