/**
 * Network Client
 * Handles WebSocket communication with backend
 */
export class NetworkClient {
    constructor(url) {
        this.ws = null;
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.messageQueue = [];
        this.playerId = '';
        this.playerName = 'Player';
        this.manualDisconnect = false;
        this.url = url || NetworkClient.resolveDefaultUrl();
    }
    static resolveDefaultUrl() {
        if (typeof window === 'undefined') {
            return 'ws://localhost:8080';
        }
        const params = new URLSearchParams(window.location.search);
        const queryUrl = params.get('wsUrl')?.trim();
        if (queryUrl) {
            return queryUrl;
        }
        const storedUrl = window.localStorage.getItem('civ.wsUrl')?.trim();
        if (storedUrl) {
            return storedUrl;
        }
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const hostname = window.location.hostname || 'localhost';
        return `${protocol}://${hostname}:8080`;
    }
    /**
     * Connect to server
     */
    async connect(playerId, playerName) {
        return new Promise((resolve, reject) => {
            try {
                this.playerId = playerId;
                this.playerName =
                    (playerName || this.playerName || 'Player').trim() || 'Player';
                this.manualDisconnect = false;
                this.ws = new WebSocket(this.url);
                this.ws.onopen = () => {
                    this.isConnected = true;
                    const wasReconnecting = this.reconnectAttempts > 0;
                    this.reconnectAttempts = 0;
                    console.log('Connected to server');
                    // Send initial handshake
                    this.send('HANDSHAKE', { playerId, playerName: this.playerName });
                    // Flush message queue
                    this.flushMessageQueue();
                    this.emitConnectionStatus('connected', {
                        reconnected: wasReconnecting,
                    });
                    resolve();
                };
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                this.ws.onerror = (event) => {
                    console.error('WebSocket error:', event);
                    this.emitConnectionStatus('error', { event });
                    reject(event);
                };
                this.ws.onclose = () => {
                    this.isConnected = false;
                    console.log('Disconnected from server');
                    this.emitConnectionStatus('disconnected', {
                        willReconnect: !this.manualDisconnect &&
                            this.reconnectAttempts < this.maxReconnectAttempts,
                    });
                    if (!this.manualDisconnect) {
                        this.attemptReconnect();
                    }
                };
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Attempt to reconnect
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emitConnectionStatus('reconnect-failed', {
                attempts: this.reconnectAttempts,
                maxAttempts: this.maxReconnectAttempts,
            });
            return;
        }
        this.reconnectAttempts++;
        this.emitConnectionStatus('reconnecting', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
        });
        console.log(`Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        setTimeout(() => {
            this.connect(this.playerId, this.playerName).catch((err) => {
                console.error('Reconnection failed:', err);
            });
        }, this.reconnectDelay * this.reconnectAttempts);
    }
    /**
     * Send message to server
     */
    send(type, payload) {
        const message = {
            type,
            payload,
            timestamp: Date.now(),
        };
        if (!this.isConnected) {
            // Queue message for later
            this.messageQueue.push(message);
            return;
        }
        try {
            this.ws?.send(JSON.stringify(message));
        }
        catch (error) {
            console.error('Failed to send message:', error);
        }
    }
    /**
     * Send move unit command
     */
    moveUnit(unitId, targetX, targetY) {
        const payload = {
            unitId,
            targetX,
            targetY,
        };
        this.send('MOVE_UNIT', payload);
    }
    /**
     * Send end turn command
     */
    endTurn() {
        const payload = {
            playerId: this.playerId,
        };
        this.send('END_TURN', payload);
    }
    /**
     * Request state sync
     */
    requestSync(fromTurn) {
        this.send('SYNC_STATE', {
            playerId: this.playerId,
            fromTurn,
        });
    }
    joinMatchmakingQueue() {
        this.send('MATCHMAKING_JOIN_QUEUE', { playerId: this.playerId });
    }
    leaveMatchmakingQueue() {
        this.send('MATCHMAKING_LEAVE_QUEUE', { playerId: this.playerId });
    }
    hostFriendsLobby() {
        this.send('FRIENDS_HOST_LOBBY', { playerId: this.playerId });
    }
    joinFriendsLobby(lobbyCode) {
        this.send('FRIENDS_JOIN_LOBBY', {
            playerId: this.playerId,
            lobbyCode,
        });
    }
    leaveLobby() {
        this.send('LOBBY_LEAVE', { playerId: this.playerId });
    }
    startLobbyGame() {
        this.send('LOBBY_START_GAME', { playerId: this.playerId });
    }
    /**
     * Register message handler
     */
    on(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }
    /**
     * Remove message handler
     */
    off(type, handler) {
        const handlers = this.messageHandlers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    /**
     * Handle incoming message
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            const handlers = this.messageHandlers.get(message.type) || [];
            handlers.forEach((handler) => {
                try {
                    handler(message.payload);
                }
                catch (error) {
                    console.error(`Error in message handler for ${message.type}:`, error);
                }
            });
        }
        catch (error) {
            console.error('Failed to parse message:', error);
        }
    }
    /**
     * Flush queued messages
     */
    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                try {
                    this.ws?.send(JSON.stringify(message));
                }
                catch (error) {
                    console.error('Failed to send queued message:', error);
                }
            }
        }
    }
    /**
     * Check connection status
     */
    isConnectedToServer() {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }
    emitConnectionStatus(status, data = {}) {
        const handlers = this.messageHandlers.get('CONNECTION_STATUS') || [];
        handlers.forEach((handler) => {
            try {
                handler({ status, ...data });
            }
            catch (error) {
                console.error('Error in connection status handler:', error);
            }
        });
    }
    /**
     * Disconnect
     */
    disconnect() {
        this.manualDisconnect = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}
//# sourceMappingURL=NetworkClient.js.map