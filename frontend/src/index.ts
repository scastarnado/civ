/**
 * Frontend Main Entry Point
 * Initializes game and connects all systems
 */

import { GameEngine } from '@/core/GameEngine';
import { Player } from '@/core/types';
import { InputHandler } from '@/input/InputHandler';
import { NetworkClient } from '@/network/NetworkClient';
import { CanvasRenderer } from '@/render/CanvasRenderer';
import { AIManager } from '@/systems/AISystem';
import { UIManager } from '@/ui/UIManager';
import { PersistenceManager } from '@/utils/PersistenceManager';

class GameApplication {
	private gameEngine: GameEngine | null = null;
	private renderer: CanvasRenderer | null = null;
	private input: InputHandler | null = null;
	private ui: UIManager | null = null;
	private network: NetworkClient | null = null;
	private aiManager: AIManager | null = null;
	private persistence: PersistenceManager | null = null;

	private gameLoopId: number | null = null;
	private lastFrameTime: number = 0;
	private fps: number = 60;
	private frameInterval: number = 1000 / this.fps;

	private currentPlayer: Player | null = null;
	private selectedUnitId: string | null = null;
	private resourcePromptUnitId: string | null = null;
	private lastTurnSignature: string | null = null;
	private lastBlockedInputMessageAt: number = 0;

	async initialize(): Promise<void> {
		console.log('Initializing 4X Strategy Game...');

		// Initialize UI
		this.ui = new UIManager();
		this.ui.addEvent('Welcome to 4X Strategy Game!');

		// Setup event listeners
		this.setupLoginScreen();
	}

	private setupLoginScreen(): void {
		const startBtn = document.getElementById('start-btn');
		const playerNameInput = document.getElementById(
			'player-name',
		) as HTMLInputElement;
		const gameModeSelect = document.getElementById(
			'game-mode',
		) as HTMLSelectElement;

		if (!startBtn || !playerNameInput || !gameModeSelect) {
			console.error('Login screen elements not found');
			return;
		}

		startBtn.addEventListener('click', () => {
			const playerName = playerNameInput.value || 'Player';
			const gameMode = gameModeSelect.value;

			this.startGame(playerName, gameMode === 'multiplayer').catch((err) => {
				console.error('Failed to start game:', err);
				this.ui?.addEvent(`Error: ${err.message}`);
			});
		});
	}

	private async startGame(
		playerName: string,
		isMultiplayer: boolean,
	): Promise<void> {
		const worldSeed = Math.floor(Math.random() * 2147483647);
		const gameId = `game-${Date.now()}`;

		console.log(`Starting game: ${isMultiplayer ? 'Multiplayer' : 'Solo'}`);
		console.log(`World seed: ${worldSeed}`);

		// Initialize core systems
		this.gameEngine = new GameEngine(worldSeed);
		this.persistence = new PersistenceManager(gameId);
		this.aiManager = new AIManager(this.gameEngine);

		// Create human player
		const humanPlayer: Player = {
			id: `player-${Date.now()}`,
			name: playerName,
			isAI: false,
			isHuman: true,
			resources: { gold: 100, food: 50, production: 25 },
			units: [],
			cities: [],
			techs: [],
			progression: {
				unitMovementBonus: 0,
				visionBonus: 0,
				attackBonus: 0,
				defenseBonus: 0,
				foodMultiplier: 1,
				productionMultiplier: 1,
				goldMultiplier: 1,
			},
			color: '#00ff00',
		};

		this.gameEngine.addPlayer(humanPlayer);
		this.currentPlayer = humanPlayer;

		// Add AI players
		const aiDifficulties: Array<'easy' | 'medium' | 'hard'> = [
			'easy',
			'medium',
			'hard',
		];
		const aiColors = ['#ff0000', '#0000ff', '#ffff00'];

		for (let i = 0; i < 3; i++) {
			const aiPlayer: Player = {
				id: `ai-${i}`,
				name: `AI ${i + 1}`,
				isAI: true,
				isHuman: false,
				difficulty: aiDifficulties[i],
				resources: { gold: 100, food: 50, production: 25 },
				units: [],
				cities: [],
				techs: [],
				progression: {
					unitMovementBonus: 0,
					visionBonus: 0,
					attackBonus: 0,
					defenseBonus: 0,
					foodMultiplier: 1,
					productionMultiplier: 1,
					goldMultiplier: 1,
				},
				color: aiColors[i],
			};

			this.gameEngine.addPlayer(aiPlayer);
			this.aiManager.registerAI(aiPlayer, aiDifficulties[i]);
		}

		this.aiManager.setTurnResolvedCallback((message) => {
			this.ui?.addEvent(message);
		});

		// Start game
		this.gameEngine.startGame();
		this.syncTurnStatus(true);

		// Initialize rendering
		this.renderer = new CanvasRenderer('gameCanvas');
		this.renderer.setLocalPlayerId(humanPlayer.id);
		if (humanPlayer.units.length > 0) {
			const startUnit = humanPlayer.units[0];
			this.renderer.centerCameraOn(startUnit.x, startUnit.y);
		}

		// Initialize input
		this.input = new InputHandler();
		this.setupInputHandlers();

		// Connect network if multiplayer
		if (isMultiplayer) {
			this.network = new NetworkClient();
			try {
				await this.network.connect(humanPlayer.id);
				this.setupNetworkHandlers();
				this.ui?.addEvent('Connected to server');
			} catch (err) {
				console.error('Failed to connect to server:', err);
				this.ui?.addEvent('Server unavailable, playing offline');
			}
		}

		// Hide login screen, show game
		const loginScreen = document.getElementById('login-screen');
		const gameContainer = document.getElementById('game-container');
		const bottomPanel = document.getElementById('bottom-panel');

		if (loginScreen) loginScreen.style.display = 'none';
		if (gameContainer) gameContainer.style.display = 'flex';
		if (bottomPanel) bottomPanel.style.display = 'block';

		// Start game loop
		this.startGameLoop();
	}

	private setupInputHandlers(): void {
		if (!this.input) return;

		const endTurnBtn = document.getElementById('end-turn-btn');
		if (endTurnBtn) {
			endTurnBtn.addEventListener('click', () => this.endTurn());
		}

		// End turn on spacebar or Enter
		this.input.onKeyDown('Space', () => this.endTurn());
		this.input.onKeyDown('Enter', () => this.endTurn());
		this.input.onKeyDown('Escape', () => {
			if (this.ui?.closeActivePanel()) {
				this.ui.addEvent('Closed panel.');
			}
		});

		// Arrow keys for camera movement
		this.input.onKeyDown('ArrowUp', () => {
			if (this.renderer) this.renderer.panCamera(0, -5);
		});
		this.input.onKeyDown('ArrowDown', () => {
			if (this.renderer) this.renderer.panCamera(0, 5);
		});
		this.input.onKeyDown('ArrowLeft', () => {
			if (this.renderer) this.renderer.panCamera(-5, 0);
		});
		this.input.onKeyDown('ArrowRight', () => {
			if (this.renderer) this.renderer.panCamera(5, 0);
		});

		// Mouse clicks for unit selection and movement
		this.input.onClick((x, y) => {
			if (!this.isHumanTurn()) {
				this.showBlockedInputMessage('Wait for AI turns to finish.');
				return;
			}

			if (this.isPlayerActionLocked()) {
				this.ui?.addEvent('Active gathering in progress. Actions are paused.');
				return;
			}

			if (this.renderer) {
				const worldPos = this.renderer.screenToWorld(x, y);

				if (this.gameEngine) {
					const gameState = this.gameEngine.getGameState();
					const clickedNodeStatus = this.gameEngine.getResourceStatusAt(
						worldPos.x,
						worldPos.y,
					);
					if (clickedNodeStatus?.mode === 'cooldown') {
						this.ui?.updateResourceStatus(clickedNodeStatus);
						this.ui?.addEvent(
							`${clickedNodeStatus.type.toUpperCase()} node: ${clickedNodeStatus.cooldownTurnsRemaining} turn(s) left to load.`,
						);
					}

					// Check if clicked on unit
					for (const player of gameState.players) {
						for (const unit of player.units) {
							if (
								unit.x === worldPos.x &&
								unit.y === worldPos.y &&
								unit.ownerId === this.currentPlayer?.id
							) {
								this.selectedUnitId = unit.id;
								this.renderer.selectEntity('unit', unit.id);
								this.ui?.hideCityManagement();
								this.ui?.updateSelectedInfo(unit);
								return;
							}
						}
					}

					// Check if clicked on city
					for (const player of gameState.players) {
						for (const city of player.cities) {
							if (
								city.x === worldPos.x &&
								city.y === worldPos.y &&
								city.ownerId === this.currentPlayer?.id
							) {
								this.renderer.selectEntity('city', city.id);
								this.selectedUnitId = null;
								this.ui?.updateSelectedInfo(city);
								this.openCityManagement(city.id);
								return;
							}
						}
					}

					// Move selected unit if available
					if (this.selectedUnitId) {
						const unit = this.getUnit(this.selectedUnitId);
						if (unit && unit.movementPoints > 0) {
							const moved = this.gameEngine.moveUnit(
								this.selectedUnitId,
								worldPos.x,
								worldPos.y,
							);
							if (moved) {
								this.ui?.hideCityManagement();
								this.ui?.addEvent(
									`Moved ${unit.type} to (${worldPos.x}, ${worldPos.y})`,
								);
								this.handleResourceLanding(this.selectedUnitId);
							}
						}
					}
				}
			}
		});
	}

	private setupNetworkHandlers(): void {
		if (!this.network) return;

		this.network.on('STATE_UPDATE', (data: unknown) => {
			console.log('Received state update:', data);
			// Handle state updates from server
		});

		this.network.on('ERROR', (data: unknown) => {
			console.error('Server error:', data);
			if (this.ui) {
				this.ui.addEvent(`Server error: ${data}`);
			}
		});
	}

	private startGameLoop(): void {
		const gameLoop = (currentTime: number) => {
			if (this.lastFrameTime === 0) {
				this.lastFrameTime = currentTime;
			}

			const deltaTime = currentTime - this.lastFrameTime;

			if (deltaTime >= this.frameInterval) {
				this.update(deltaTime);
				this.render();
				this.lastFrameTime = currentTime;
			}

			this.gameLoopId = requestAnimationFrame(gameLoop);
		};

		this.gameLoopId = requestAnimationFrame(gameLoop);
	}

	private update(deltaMs: number): void {
		if (!this.gameEngine) return;

		// Update game engine
		this.gameEngine.tick(deltaMs);

		// Update AI players
		if (this.aiManager) {
			this.aiManager.update();
		}

		// Update input
		if (this.input) {
			this.input.update();
			this.updateCameraInput(deltaMs);
		}

		this.syncTurnStatus();

		// Save periodically
		if (this.persistence && Math.random() < 0.01) {
			// Save every ~1% of frames
			const gameState = this.gameEngine.getGameState();
			this.persistence.saveGameState(gameState);
			this.persistence.saveIdleTimestamp();
		}

		this.updateResourceGatherUI();
	}

	private render(): void {
		if (!this.gameEngine || !this.renderer) return;

		const gameState = this.gameEngine.getGameState();

		// Render map and entities
		this.renderer.render(
			gameState,
			this.gameEngine.getMapCache(),
			this.currentPlayer?.id,
		);

		// Update UI panels
		if (this.ui && this.currentPlayer) {
			this.ui.updateTurnOrder(
				this.gameEngine.getTurn(),
				gameState.players,
				this.gameEngine.getCurrentPlayerIndex(),
			);
			this.ui.updateResources(this.currentPlayer);
		}
	}

	private endTurn(): void {
		if (!this.gameEngine || !this.currentPlayer) return;
		if (!this.isHumanTurn()) {
			this.showBlockedInputMessage('You can end turn only during your turn.');
			return;
		}
		if (this.isPlayerActionLocked()) {
			this.ui?.addEvent('Cannot end turn during active gathering.');
			return;
		}

		const currentPlayer = this.gameEngine.getCurrentPlayer();

		// Only allow human player to end turn
		if (!currentPlayer.isHuman) return;

		this.gameEngine.endTurn();
		this.ui?.updateTurn(
			this.gameEngine.getTurn(),
			this.gameEngine.getCurrentPlayer(),
		);

		// Send to server if multiplayer
		if (this.network?.isConnectedToServer()) {
			this.network.endTurn();
		}

		this.ui?.addEvent('Turn ended.');
	}

	private updateCameraInput(deltaMs: number): void {
		if (!this.input || !this.renderer) return;
		if (!this.isHumanTurn()) return;
		if (this.isPlayerActionLocked()) return;

		const speedTilesPerSecond = 15;
		const step = (deltaMs / 1000) * speedTilesPerSecond;

		let dx = 0;
		let dy = 0;

		if (this.input.isKeyPressed('ArrowUp') || this.input.isKeyPressed('KeyW')) {
			dy -= step;
		}
		if (
			this.input.isKeyPressed('ArrowDown') ||
			this.input.isKeyPressed('KeyS')
		) {
			dy += step;
		}
		if (
			this.input.isKeyPressed('ArrowLeft') ||
			this.input.isKeyPressed('KeyA')
		) {
			dx -= step;
		}
		if (
			this.input.isKeyPressed('ArrowRight') ||
			this.input.isKeyPressed('KeyD')
		) {
			dx += step;
		}

		if (dx !== 0 || dy !== 0) {
			this.renderer.panCamera(dx, dy);
		}
	}

	private getUnit(unitId: string) {
		if (!this.gameEngine) return null;
		const gameState = this.gameEngine.getGameState();

		for (const player of gameState.players) {
			const unit = player.units.find((u) => u.id === unitId);
			if (unit) return unit;
		}
		return null;
	}

	private handleResourceLanding(unitId: string): void {
		if (!this.gameEngine || !this.ui) return;

		const status = this.gameEngine.getResourceStatusForUnit(unitId);
		this.ui.updateResourceStatus(status);

		if (!status) {
			this.resourcePromptUnitId = null;
			this.ui.hideResourceChoice();
			return;
		}

		if (status.mode === 'none' && this.resourcePromptUnitId !== unitId) {
			this.resourcePromptUnitId = unitId;
			this.ui.showResourceChoice(
				status,
				() => {
					if (!this.gameEngine || !this.ui) return;
					const result = this.gameEngine.startActiveGather(unitId);
					this.ui.addEvent(result.message);
				},
				() => {
					if (!this.gameEngine || !this.ui) return;
					const result = this.gameEngine.startIdleGather(unitId);
					this.ui.addEvent(result.message);
				},
			);
		} else if (status.mode !== 'none') {
			this.resourcePromptUnitId = null;
			this.ui.hideResourceChoice();
		}
	}

	private updateResourceGatherUI(): void {
		if (!this.gameEngine || !this.ui || !this.selectedUnitId) {
			this.ui?.updateResourceStatus(null);
			return;
		}

		const status = this.gameEngine.getResourceStatusForUnit(
			this.selectedUnitId,
		);
		this.ui.updateResourceStatus(status);

		if (status?.mode !== 'none') {
			this.resourcePromptUnitId = null;
			this.ui.hideResourceChoice();
		}
	}

	private isPlayerActionLocked(): boolean {
		if (!this.gameEngine || !this.currentPlayer) return false;
		return this.gameEngine.isPlayerActionLocked(this.currentPlayer.id);
	}

	private isHumanTurn(): boolean {
		if (!this.gameEngine) return false;
		return this.gameEngine.getCurrentPlayer().isHuman;
	}

	private syncTurnStatus(force: boolean = false): void {
		if (!this.gameEngine || !this.ui) return;

		const current = this.gameEngine.getCurrentPlayer();
		const signature = `${this.gameEngine.getTurn()}:${current.id}`;
		if (!force && this.lastTurnSignature === signature) {
			return;
		}

		this.lastTurnSignature = signature;
		this.ui.updateTurn(this.gameEngine.getTurn(), current);
	}

	private showBlockedInputMessage(message: string): void {
		const now = Date.now();
		if (now - this.lastBlockedInputMessageAt < 900) {
			return;
		}
		this.lastBlockedInputMessageAt = now;
		this.ui?.addEvent(message);
	}

	private openCityManagement(cityId: string): void {
		if (!this.gameEngine || !this.currentPlayer || !this.ui) return;

		const data = this.gameEngine.getCityManagementData(
			this.currentPlayer.id,
			cityId,
		);
		if (!data) return;

		this.ui.showCityManagement(
			data,
			(optionId) => {
				if (!this.gameEngine || !this.currentPlayer || !this.ui) return;
				const result = this.gameEngine.applyCityOption(
					this.currentPlayer.id,
					cityId,
					optionId,
				);
				this.ui.addEvent(result.message);
				if (result.ok) {
					this.openCityManagement(cityId);
				}
			},
			() => {
				this.ui?.addEvent('Closed city management.');
			},
		);
	}

	cleanup(): void {
		if (this.gameLoopId !== null) {
			cancelAnimationFrame(this.gameLoopId);
		}

		if (this.network) {
			this.network.disconnect();
		}

		if (this.input) {
			this.input.clear();
		}

		if (this.persistence) {
			const gameState = this.gameEngine?.getGameState();
			if (gameState) {
				this.persistence.saveGameState(gameState);
			}
		}
	}
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
	const app = new GameApplication();
	await app.initialize();

	// Cleanup on page unload
	window.addEventListener('beforeunload', () => {
		app.cleanup();
	});
});
