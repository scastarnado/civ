/**
 * WebSocket Server
 * Manages client connections and message routing
 */
import { WebSocket, WebSocketServer } from 'ws';
import { PlayerManager } from '../players/PlayerManager';
import { GameRoom } from '../rooms/GameRoom';
export class GameServer {
    constructor(port = 8080) {
        this.rooms = new Map();
        this.disconnectGraceMs = 120000;
        this.port = port;
        this.wss = new WebSocketServer({ port });
        this.playerManager = new PlayerManager();
        this.setupConnectionHandlers();
    }
    /**
     * Start server
     */
    start() {
        console.log(`WebSocket server listening on port ${this.port}`);
    }
    /**
     * Setup connection handlers
     */
    setupConnectionHandlers() {
        this.wss.on('connection', (ws) => {
            console.log('Client connected');
            let playerId = null;
            let roomId = null;
            // Handle incoming messages
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(ws, message, playerId, roomId, (newPlayerId, newRoomId) => {
                        playerId = newPlayerId;
                        roomId = newRoomId;
                    });
                }
                catch (error) {
                    console.error('Failed to parse message:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });
            // Handle disconnect
            ws.on('close', () => {
                console.log(`Client disconnected: ${playerId}`);
                if (playerId && roomId) {
                    const room = this.rooms.get(roomId);
                    if (room) {
                        room.markPlayerDisconnected(playerId, this.disconnectGraceMs);
                    }
                    this.playerManager.removePlayer(playerId);
                }
            });
            // Handle errors
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    }
    /**
     * Handle incoming message
     */
    handleMessage(ws, message, playerId, roomId, setIds) {
        switch (message.type) {
            case 'HANDSHAKE':
                this.handleHandshake(ws, message, (id, id2) => {
                    setIds(id, id2);
                });
                break;
            case 'MOVE_UNIT':
                if (roomId && playerId) {
                    const room = this.rooms.get(roomId);
                    if (room) {
                        room.processAction(playerId, 'MOVE_UNIT', message.payload);
                    }
                }
                break;
            case 'END_TURN':
                if (roomId && playerId) {
                    const room = this.rooms.get(roomId);
                    if (room) {
                        room.endPlayerTurn(playerId);
                    }
                }
                break;
            case 'SYNC_STATE':
                if (roomId && playerId) {
                    const room = this.rooms.get(roomId);
                    if (room) {
                        const state = room.getGameState();
                        this.sendState(ws, 'STATE_UPDATE', state);
                    }
                }
                break;
            default:
                console.warn(`Unknown message type: ${message.type}`);
                break;
        }
    }
    /**
     * Handle handshake/login
     */
    handleHandshake(ws, message, setIds) {
        const payload = message.payload;
        if (!payload.playerId) {
            this.sendError(ws, 'Missing playerId in handshake');
            return;
        }
        const playerId = payload.playerId;
        // Register player
        this.playerManager.addPlayer(playerId, ws);
        const existingRoom = this.findRoomByPlayerId(playerId);
        if (existingRoom) {
            existingRoom.reconnectPlayer(playerId, ws);
            setIds(playerId, existingRoom.getRoomId());
            this.sendState(ws, 'HANDSHAKE_ACK', {
                playerId,
                roomId: existingRoom.getRoomId(),
                reconnected: true,
                graceMs: this.disconnectGraceMs,
            });
            console.log(`Player ${playerId} reconnected to room ${existingRoom.getRoomId()}`);
            return;
        }
        // Find or create room (for now, single room)
        let room = Array.from(this.rooms.values()).find((r) => r.getPlayerCount() < 4);
        if (!room) {
            const roomId = `room-${Date.now()}`;
            room = new GameRoom(roomId);
            this.rooms.set(roomId, room);
            console.log(`Created new room: ${roomId}`);
        }
        room.addPlayer(playerId, ws);
        setIds(playerId, room.getRoomId());
        this.sendState(ws, 'HANDSHAKE_ACK', {
            playerId,
            roomId: room.getRoomId(),
            reconnected: false,
            graceMs: this.disconnectGraceMs,
        });
        console.log(`Player ${playerId} joined room ${room.getRoomId()}`);
    }
    findRoomByPlayerId(playerId) {
        for (const room of this.rooms.values()) {
            if (room.hasPlayer(playerId)) {
                return room;
            }
        }
        return null;
    }
    /**
     * Send message to client
     */
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
    /**
     * Send error to client
     */
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
    /**
     * Stop server
     */
    stop() {
        this.wss.close();
        console.log('Server stopped');
    }
}
//# sourceMappingURL=WebSocketServer.js.map