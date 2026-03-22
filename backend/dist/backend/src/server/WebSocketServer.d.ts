/**
 * WebSocket Server
 * Manages client connections, matchmaking queue, and friend lobbies.
 */
export declare class GameServer {
    private wss;
    private rooms;
    private lobbiesByCode;
    private queue;
    private playerManager;
    private port;
    private readonly maxPlayersPerMatch;
    private readonly disconnectGraceMs;
    private readonly playerNames;
    constructor(port?: number);
    start(): void;
    private setupConnectionHandlers;
    private handleMessage;
    private handleHandshake;
    private handleGameMessage;
    private handleJoinQueue;
    private createMatchRoom;
    private createLobbyForHost;
    private joinLobbyByCode;
    private leaveLobby;
    private handleDisconnect;
    private removeFromQueue;
    private leaveNonRunningLobbyIfAny;
    private closeLobbyRoom;
    private broadcastLobbyUpdate;
    private broadcastQueueSize;
    private findRoomByPlayerId;
    private generateLobbyCode;
    private sendState;
    private sendError;
    stop(): void;
}
//# sourceMappingURL=WebSocketServer.d.ts.map