/**
 * Network Client
 * Handles WebSocket communication with backend
 */
export type MessageHandler = (data: unknown) => void;
export declare class NetworkClient {
	private ws;
	private url;
	private isConnected;
	private messageHandlers;
	private reconnectAttempts;
	private maxReconnectAttempts;
	private reconnectDelay;
	private messageQueue;
	private playerId;
	private manualDisconnect;
	constructor(url?: string);
	/**
	 * Connect to server
	 */
	connect(playerId: string, playerName?: string): Promise<void>;
	/**
	 * Attempt to reconnect
	 */
	private attemptReconnect;
	/**
	 * Send message to server
	 */
	send(type: string, payload: unknown): void;
	/**
	 * Send move unit command
	 */
	moveUnit(unitId: string, targetX: number, targetY: number): void;
	/**
	 * Send end turn command
	 */
	endTurn(): void;
	/**
	 * Request state sync
	 */
	requestSync(fromTurn: number): void;
	joinMatchmakingQueue(): void;
	leaveMatchmakingQueue(): void;
	hostFriendsLobby(): void;
	joinFriendsLobby(lobbyCode: string): void;
	leaveLobby(): void;
	startLobbyGame(): void;
	/**
	 * Register message handler
	 */
	on(type: string, handler: MessageHandler): void;
	/**
	 * Remove message handler
	 */
	off(type: string, handler: MessageHandler): void;
	/**
	 * Handle incoming message
	 */
	private handleMessage;
	/**
	 * Flush queued messages
	 */
	private flushMessageQueue;
	/**
	 * Check connection status
	 */
	isConnectedToServer(): boolean;
	private emitConnectionStatus;
	/**
	 * Disconnect
	 */
	disconnect(): void;
}
//# sourceMappingURL=NetworkClient.d.ts.map
