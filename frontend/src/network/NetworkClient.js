/**
 * Network Client
 * Handles WebSocket communication with backend
 */
export class NetworkClient {
    constructor(url = 'ws://localhost:8080') {
        this.ws = null;
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.messageQueue = [];
        this.playerId = '';
        this.manualDisconnect = false;
        this.url = url;
    }
    /**
     * Connect to server
     */
    async connect(playerId) {
        return new Promise((resolve, reject) => {
            try {
                this.playerId = playerId;
                this.manualDisconnect = false;
                this.ws = new WebSocket(this.url);
                this.ws.onopen = () => {
                    this.isConnected = true;
                    const wasReconnecting = this.reconnectAttempts > 0;
                    this.reconnectAttempts = 0;
                    console.log('Connected to server');
                    // Send initial handshake
                    this.send('HANDSHAKE', { playerId });
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
            this.connect(this.playerId).catch((err) => {
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