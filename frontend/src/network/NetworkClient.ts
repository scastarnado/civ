/**
 * Network Client
 * Handles WebSocket communication with backend
 */

import { EndTurnMessage, MoveUnitMessage, NetworkMessage } from '@/core/types';

export type MessageHandler = (data: unknown) => void;

export class NetworkClient {
	private ws: WebSocket | null = null;
	private url: string;
	private isConnected: boolean = false;
	private messageHandlers: Map<string, MessageHandler[]> = new Map();
	private reconnectAttempts: number = 0;
	private maxReconnectAttempts: number = 5;
	private reconnectDelay: number = 1000;
	private messageQueue: NetworkMessage[] = [];
	private playerId: string = '';
	private manualDisconnect: boolean = false;

	constructor(url: string = 'ws://localhost:8080') {
		this.url = url;
	}

	/**
	 * Connect to server
	 */
	async connect(playerId: string): Promise<void> {
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
						willReconnect:
							!this.manualDisconnect &&
							this.reconnectAttempts < this.maxReconnectAttempts,
					});
					if (!this.manualDisconnect) {
						this.attemptReconnect();
					}
				};
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Attempt to reconnect
	 */
	private attemptReconnect(): void {
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
		console.log(
			`Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
		);

		setTimeout(() => {
			this.connect(this.playerId).catch((err) => {
				console.error('Reconnection failed:', err);
			});
		}, this.reconnectDelay * this.reconnectAttempts);
	}

	/**
	 * Send message to server
	 */
	send(type: string, payload: unknown): void {
		const message: NetworkMessage = {
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
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	}

	/**
	 * Send move unit command
	 */
	moveUnit(unitId: string, targetX: number, targetY: number): void {
		const payload: MoveUnitMessage = {
			unitId,
			targetX,
			targetY,
		};
		this.send('MOVE_UNIT', payload);
	}

	/**
	 * Send end turn command
	 */
	endTurn(): void {
		const payload: EndTurnMessage = {
			playerId: this.playerId,
		};
		this.send('END_TURN', payload);
	}

	/**
	 * Request state sync
	 */
	requestSync(fromTurn: number): void {
		this.send('SYNC_STATE', {
			playerId: this.playerId,
			fromTurn,
		});
	}

	/**
	 * Register message handler
	 */
	on(type: string, handler: MessageHandler): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, []);
		}
		this.messageHandlers.get(type)!.push(handler);
	}

	/**
	 * Remove message handler
	 */
	off(type: string, handler: MessageHandler): void {
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
	private handleMessage(data: string): void {
		try {
			const message: NetworkMessage = JSON.parse(data);
			const handlers = this.messageHandlers.get(message.type) || [];

			handlers.forEach((handler) => {
				try {
					handler(message.payload);
				} catch (error) {
					console.error(`Error in message handler for ${message.type}:`, error);
				}
			});
		} catch (error) {
			console.error('Failed to parse message:', error);
		}
	}

	/**
	 * Flush queued messages
	 */
	private flushMessageQueue(): void {
		while (this.messageQueue.length > 0) {
			const message = this.messageQueue.shift();
			if (message) {
				try {
					this.ws?.send(JSON.stringify(message));
				} catch (error) {
					console.error('Failed to send queued message:', error);
				}
			}
		}
	}

	/**
	 * Check connection status
	 */
	isConnectedToServer(): boolean {
		return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
	}

	private emitConnectionStatus(status: string, data: unknown = {}): void {
		const handlers = this.messageHandlers.get('CONNECTION_STATUS') || [];
		handlers.forEach((handler) => {
			try {
				handler({ status, ...(data as Record<string, unknown>) });
			} catch (error) {
				console.error('Error in connection status handler:', error);
			}
		});
	}

	/**
	 * Disconnect
	 */
	disconnect(): void {
		this.manualDisconnect = true;
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.isConnected = false;
	}
}
