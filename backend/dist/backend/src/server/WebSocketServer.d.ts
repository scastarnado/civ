/**
 * WebSocket Server
 * Manages client connections and message routing
 */
export declare class GameServer {
    private wss;
    private rooms;
    private playerManager;
    private port;
    private readonly disconnectGraceMs;
    constructor(port?: number);
    /**
     * Start server
     */
    start(): void;
    /**
     * Setup connection handlers
     */
    private setupConnectionHandlers;
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Handle handshake/login
     */
    private handleHandshake;
    private findRoomByPlayerId;
    /**
     * Send message to client
     */
    private sendState;
    /**
     * Send error to client
     */
    private sendError;
    /**
     * Stop server
     */
    stop(): void;
}
//# sourceMappingURL=WebSocketServer.d.ts.map