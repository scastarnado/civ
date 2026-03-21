/**
 * Frontend Main Entry Point
 * Initializes game and connects all systems
 */
import { GameEngine } from '@/core/GameEngine';
import { TileType } from '@/core/types';
import { InputHandler } from '@/input/InputHandler';
import { NetworkClient } from '@/network/NetworkClient';
import { CanvasRenderer } from '@/render/CanvasRenderer';
import { AIManager } from '@/systems/AISystem';
import { UIManager } from '@/ui/UIManager';
import { PersistenceManager } from '@/utils/PersistenceManager';
class GameApplication {
    constructor() {
        this.gameEngine = null;
        this.renderer = null;
        this.input = null;
        this.ui = null;
        this.network = null;
        this.aiManager = null;
        this.persistence = null;
        this.gameLoopId = null;
        this.lastFrameTime = 0;
        this.fps = 60;
        this.frameInterval = 1000 / this.fps;
        this.currentPlayer = null;
        this.selectedUnitId = null;
        this.resourcePromptUnitId = null;
        this.mountainPromptUnitId = null;
        this.lastTurnSignature = null;
        this.lastBlockedInputMessageAt = 0;
    }
    async initialize() {
        console.log('Initializing 4X Strategy Game...');
        // Initialize UI
        this.ui = new UIManager();
        this.ui.addEvent('Welcome to 4X Strategy Game!');
        // Setup event listeners
        this.setupLoginScreen();
    }
    setupLoginScreen() {
        const startBtn = document.getElementById('start-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const gameModeSelect = document.getElementById('game-mode');
        const authTabs = document.querySelectorAll('[data-auth-tab]');
        const loginUsername = document.getElementById('login-username');
        const loginPassword = document.getElementById('login-password');
        const loginActionBtn = document.getElementById('login-action-btn');
        const registerUsername = document.getElementById('register-username');
        const registerEmail = document.getElementById('register-email');
        const registerPassword = document.getElementById('register-password');
        const registerPasswordConfirm = document.getElementById('register-password-confirm');
        const registerActionBtn = document.getElementById('register-action-btn');
        const guestNameInput = document.getElementById('guest-player-name');
        const guestActionBtn = document.getElementById('guest-action-btn');
        const authMessage = document.getElementById('auth-message');
        const selectedProfile = document.getElementById('selected-profile-name');
        if (!startBtn ||
            !logoutBtn ||
            !gameModeSelect ||
            !loginUsername ||
            !loginPassword ||
            !loginActionBtn ||
            !registerUsername ||
            !registerEmail ||
            !registerPassword ||
            !registerPasswordConfirm ||
            !registerActionBtn ||
            !guestNameInput ||
            !guestActionBtn ||
            !authMessage ||
            !selectedProfile) {
            console.error('Login screen elements not found');
            return;
        }
        const lastProfileKey = 'civ.lastProfileName';
        let selectedPlayerName = localStorage.getItem(lastProfileKey) || 'Player';
        let selectedProfileType = 'guest';
        let activeAccountUsername = null;
        const postJson = async (url, body) => {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            return (await response.json());
        };
        const getJson = async (url) => {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
            });
            return (await response.json());
        };
        const setMessage = (text, isError = false) => {
            authMessage.textContent = text;
            authMessage.style.color = isError ? '#ff8080' : '#9ef5cf';
        };
        const updateSelectedProfile = (name, type) => {
            selectedPlayerName = name.trim() || 'Player';
            selectedProfileType = type;
            selectedProfile.textContent =
                type === 'guest' ?
                    `Guest: ${selectedPlayerName}`
                    : `Account: ${selectedPlayerName}`;
            startBtn.disabled = selectedPlayerName.length === 0;
            logoutBtn.disabled = type !== 'account';
            localStorage.setItem(lastProfileKey, selectedPlayerName);
        };
        const setActiveTab = (tab) => {
            authTabs.forEach((btn) => {
                const active = btn.dataset.authTab === tab;
                btn.classList.toggle('active', active);
            });
            const panels = ['login', 'register', 'guest'];
            panels.forEach((panelName) => {
                const panel = document.getElementById(`auth-panel-${panelName}`);
                if (!panel)
                    return;
                panel.classList.toggle('active', panelName === tab);
            });
        };
        updateSelectedProfile(selectedPlayerName, selectedProfileType);
        setActiveTab('guest');
        const syncFromSession = async () => {
            try {
                const me = await getJson('/api/auth/me');
                if (me.ok && me.user) {
                    activeAccountUsername = me.user.username;
                    updateSelectedProfile(me.user.username, 'account');
                    setMessage(`Session restored for ${me.user.username}.`);
                }
            }
            catch {
                // Keep guest mode silently on network/api failures.
            }
        };
        void syncFromSession();
        authTabs.forEach((tabBtn) => {
            tabBtn.addEventListener('click', () => {
                const target = tabBtn.dataset.authTab;
                if (!target)
                    return;
                setActiveTab(target);
                setMessage('');
            });
        });
        loginActionBtn.addEventListener('click', async () => {
            const username = loginUsername.value.trim();
            const password = loginPassword.value;
            if (!username || !password) {
                setMessage('Enter username and password to login.', true);
                return;
            }
            try {
                const result = await postJson('/api/auth/login', {
                    identifier: username,
                    password,
                });
                if (!result.ok || !result.user) {
                    setMessage(result.error || 'Invalid credentials.', true);
                    return;
                }
                activeAccountUsername = result.user.username;
                updateSelectedProfile(result.user.username, 'account');
                setMessage(`Logged in as ${result.user.username}.`);
            }
            catch {
                setMessage('Login service unavailable. Try again.', true);
            }
        });
        registerActionBtn.addEventListener('click', async () => {
            const email = registerEmail.value.trim();
            const username = registerUsername.value.trim();
            const password = registerPassword.value;
            const confirmPassword = registerPasswordConfirm.value;
            if (!email || !username || !password) {
                setMessage('Email, username and password are required.', true);
                return;
            }
            if (!email.includes('@')) {
                setMessage('Please provide a valid email address.', true);
                return;
            }
            if (password !== confirmPassword) {
                setMessage('Passwords do not match.', true);
                return;
            }
            try {
                const result = await postJson('/api/auth/register', {
                    email,
                    username,
                    password,
                });
                if (!result.ok || !result.user) {
                    setMessage(result.error || 'Could not register account.', true);
                    return;
                }
                activeAccountUsername = result.user.username;
                updateSelectedProfile(result.user.username, 'account');
                setMessage(`Account created for ${result.user.username}.`);
                registerPassword.value = '';
                registerPasswordConfirm.value = '';
            }
            catch {
                setMessage('Registration service unavailable. Try again.', true);
            }
        });
        guestActionBtn.addEventListener('click', () => {
            const guestName = guestNameInput.value.trim() || 'Player';
            activeAccountUsername = null;
            updateSelectedProfile(guestName, 'guest');
            setMessage(`Guest profile ready: ${guestName}.`);
        });
        logoutBtn.addEventListener('click', async () => {
            try {
                await postJson('/api/auth/logout', {});
                activeAccountUsername = null;
                updateSelectedProfile(guestNameInput.value.trim() || 'Player', 'guest');
                setActiveTab('guest');
                setMessage('Logged out. Guest mode active.');
            }
            catch {
                setMessage('Logout service unavailable.', true);
            }
        });
        startBtn.addEventListener('click', async () => {
            let playerName = selectedPlayerName || 'Player';
            const gameMode = gameModeSelect.value;
            if (selectedProfileType === 'account') {
                try {
                    const me = await getJson('/api/auth/me');
                    if (!me.ok || !me.user) {
                        setMessage('Session expired. Please login again.', true);
                        setActiveTab('login');
                        return;
                    }
                    playerName = me.user.username;
                    activeAccountUsername = me.user.username;
                }
                catch {
                    setMessage('Cannot verify session. Check connection.', true);
                    return;
                }
            }
            else if (activeAccountUsername) {
                playerName = activeAccountUsername;
            }
            this.startGame(playerName, gameMode === 'multiplayer').catch((err) => {
                console.error('Failed to start game:', err);
                this.ui?.addEvent(`Error: ${err.message}`);
            });
        });
    }
    async startGame(playerName, isMultiplayer) {
        const worldSeed = Math.floor(Math.random() * 2147483647);
        const gameId = `game-${Date.now()}`;
        console.log(`Starting game: ${isMultiplayer ? 'Multiplayer' : 'Solo'}`);
        console.log(`World seed: ${worldSeed}`);
        // Initialize core systems
        this.gameEngine = new GameEngine(worldSeed);
        this.persistence = new PersistenceManager(gameId);
        this.aiManager = new AIManager(this.gameEngine);
        // Create human player
        const humanPlayer = {
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
        const aiDifficulties = [
            'easy',
            'medium',
            'hard',
        ];
        const aiColors = ['#ff0000', '#0000ff', '#ffff00'];
        for (let i = 0; i < 3; i++) {
            const aiPlayer = {
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
            this.ui?.pushAITurnIntel(message);
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
            }
            catch (err) {
                console.error('Failed to connect to server:', err);
                this.ui?.addEvent('Server unavailable, playing offline');
            }
        }
        // Hide login screen, show game
        const loginScreen = document.getElementById('login-screen');
        const gameContainer = document.getElementById('game-container');
        const bottomPanel = document.getElementById('bottom-panel');
        if (loginScreen)
            loginScreen.style.display = 'none';
        if (gameContainer)
            gameContainer.style.display = 'flex';
        if (bottomPanel)
            bottomPanel.style.display = 'block';
        this.ui?.addEvent('Tips: Click your units/cities to select.');
        this.ui?.addEvent('Use H (or Esc) to open the strategy handbook anytime.');
        this.ui?.addEvent('Use F to center camera on the selected unit/city.');
        // Start game loop
        this.startGameLoop();
    }
    setupInputHandlers() {
        if (!this.input)
            return;
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
                return;
            }
            this.ui?.toggleTutorialMenu();
            if (this.ui?.isTutorialMenuOpen()) {
                this.ui.addEvent('Opened strategy handbook.');
            }
            else {
                this.ui?.addEvent('Closed strategy handbook.');
            }
        });
        this.input.onKeyDown('KeyH', () => {
            this.ui?.toggleTutorialMenu();
            if (this.ui?.isTutorialMenuOpen()) {
                this.ui.addEvent('Opened strategy handbook.');
            }
            else {
                this.ui?.addEvent('Closed strategy handbook.');
            }
        });
        this.input.onKeyDown('KeyF', () => this.focusSelectedEntity());
        // Arrow keys for camera movement
        this.input.onKeyDown('ArrowUp', () => {
            if (this.renderer)
                this.renderer.panCamera(0, -5);
        });
        this.input.onKeyDown('ArrowDown', () => {
            if (this.renderer)
                this.renderer.panCamera(0, 5);
        });
        this.input.onKeyDown('ArrowLeft', () => {
            if (this.renderer)
                this.renderer.panCamera(-5, 0);
        });
        this.input.onKeyDown('ArrowRight', () => {
            if (this.renderer)
                this.renderer.panCamera(5, 0);
        });
        // Mouse clicks for unit selection and movement
        this.input.onClick((x, y) => {
            if (!this.isHumanTurn()) {
                this.showBlockedInputMessage('Wait for AI turns to finish.');
                return;
            }
            if (this.isPlayerActionLocked()) {
                this.ui?.addEvent('An active timed action is in progress.');
                return;
            }
            if (this.renderer) {
                const worldPos = this.renderer.screenToWorld(x, y);
                if (this.gameEngine) {
                    const gameState = this.gameEngine.getGameState();
                    const clickedNodeStatus = this.gameEngine.getResourceStatusAt(worldPos.x, worldPos.y);
                    if (clickedNodeStatus?.mode === 'cooldown') {
                        this.ui?.updateResourceStatus(clickedNodeStatus);
                        this.ui?.addEvent(`${clickedNodeStatus.type.toUpperCase()} node: ${clickedNodeStatus.cooldownTurnsRemaining} turn(s) left to load.`);
                    }
                    // Check if clicked on unit
                    for (const player of gameState.players) {
                        for (const unit of player.units) {
                            if (unit.x === worldPos.x &&
                                unit.y === worldPos.y &&
                                unit.ownerId === this.currentPlayer?.id) {
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
                            if (city.x === worldPos.x &&
                                city.y === worldPos.y &&
                                city.ownerId === this.currentPlayer?.id) {
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
                            const targetTile = this.gameEngine
                                .getMapCache()
                                .getTile(worldPos.x, worldPos.y);
                            if (targetTile?.type === TileType.MOUNTAIN &&
                                unit.type === 'settler') {
                                const mountainResult = this.gameEngine.beginMountainDestroyAttempt(this.selectedUnitId, worldPos.x, worldPos.y);
                                if (mountainResult.ok) {
                                    this.ui?.addEvent(mountainResult.message);
                                    this.handleMountainDestroyLanding(this.selectedUnitId);
                                }
                                else {
                                    this.ui?.addEvent(mountainResult.message);
                                }
                                return;
                            }
                            const moved = this.gameEngine.moveUnit(this.selectedUnitId, worldPos.x, worldPos.y);
                            if (moved) {
                                this.ui?.hideCityManagement();
                                this.ui?.addEvent(`Moved ${unit.type} to (${worldPos.x}, ${worldPos.y})`);
                                this.handleResourceLanding(this.selectedUnitId);
                            }
                            else {
                                const reason = this.getMoveFailureReason(unit, worldPos.x, worldPos.y);
                                if (reason)
                                    this.ui?.addEvent(reason);
                            }
                        }
                        else if (unit) {
                            this.ui?.addEvent('This unit has no movement points left.');
                        }
                    }
                }
            }
        });
    }
    getMoveFailureReason(unit, targetX, targetY) {
        if (!this.gameEngine)
            return null;
        if (targetX === unit.x && targetY === unit.y) {
            return 'Unit is already on that tile.';
        }
        const distance = Math.abs(unit.x - targetX) + Math.abs(unit.y - targetY);
        if (distance > unit.movementPoints) {
            return `Not enough movement points (${distance} needed).`;
        }
        const tile = this.gameEngine.getMapCache().getTile(targetX, targetY);
        if (!tile) {
            return 'Cannot move there: unknown tile.';
        }
        if (tile.type === TileType.WATER) {
            return 'Cannot move into water.';
        }
        if (tile.type === TileType.MOUNTAIN && unit.type !== 'settler') {
            return 'Only settlers can enter mountains.';
        }
        const ownMountainTask = this.gameEngine.getMountainDestroyStatusForUnit(unit.id);
        if (ownMountainTask) {
            return 'This unit is busy with mountain destruction.';
        }
        const gatherStatus = this.gameEngine.getResourceStatusForUnit(unit.id);
        if (gatherStatus?.mode === 'active') {
            return 'This unit is busy with active gathering.';
        }
        return 'Move blocked.';
    }
    setupNetworkHandlers() {
        if (!this.network)
            return;
        this.network.on('STATE_UPDATE', (data) => {
            console.log('Received state update:', data);
            // Handle state updates from server
        });
        this.network.on('ERROR', (data) => {
            console.error('Server error:', data);
            if (this.ui) {
                this.ui.addEvent(`Server error: ${data}`);
            }
        });
    }
    startGameLoop() {
        const gameLoop = (currentTime) => {
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
    update(deltaMs) {
        if (!this.gameEngine)
            return;
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
        this.updateMountainDestroyUI();
        this.updateResourceGatherUI();
    }
    render() {
        if (!this.gameEngine || !this.renderer)
            return;
        const gameState = this.gameEngine.getGameState();
        // Render map and entities
        this.renderer.render(gameState, this.gameEngine.getMapCache(), this.currentPlayer?.id);
        // Update UI panels
        if (this.ui && this.currentPlayer) {
            this.ui.updateTurnOrder(this.gameEngine.getTurn(), gameState.players, this.gameEngine.getCurrentPlayerIndex());
            this.ui.updateResources(this.currentPlayer);
        }
    }
    endTurn() {
        if (!this.gameEngine || !this.currentPlayer)
            return;
        if (!this.isHumanTurn()) {
            this.showBlockedInputMessage('You can end turn only during your turn.');
            return;
        }
        if (this.gameEngine.isPlayerGatherLocked(this.currentPlayer.id)) {
            this.ui?.addEvent('Cannot end turn during active gathering.');
            return;
        }
        const currentPlayer = this.gameEngine.getCurrentPlayer();
        // Only allow human player to end turn
        if (!currentPlayer.isHuman)
            return;
        this.gameEngine.endTurn();
        this.ui?.updateTurn(this.gameEngine.getTurn(), this.gameEngine.getCurrentPlayer());
        // Send to server if multiplayer
        if (this.network?.isConnectedToServer()) {
            this.network.endTurn();
        }
        this.ui?.addEvent('Turn ended.');
    }
    updateCameraInput(deltaMs) {
        if (!this.input || !this.renderer)
            return;
        if (!this.isHumanTurn())
            return;
        if (this.isPlayerActionLocked())
            return;
        const speedTilesPerSecond = 15;
        const step = (deltaMs / 1000) * speedTilesPerSecond;
        let dx = 0;
        let dy = 0;
        if (this.input.isKeyPressed('ArrowUp') || this.input.isKeyPressed('KeyW')) {
            dy -= step;
        }
        if (this.input.isKeyPressed('ArrowDown') ||
            this.input.isKeyPressed('KeyS')) {
            dy += step;
        }
        if (this.input.isKeyPressed('ArrowLeft') ||
            this.input.isKeyPressed('KeyA')) {
            dx -= step;
        }
        if (this.input.isKeyPressed('ArrowRight') ||
            this.input.isKeyPressed('KeyD')) {
            dx += step;
        }
        if (dx !== 0 || dy !== 0) {
            this.renderer.panCamera(dx, dy);
        }
    }
    getUnit(unitId) {
        if (!this.gameEngine)
            return null;
        const gameState = this.gameEngine.getGameState();
        for (const player of gameState.players) {
            const unit = player.units.find((u) => u.id === unitId);
            if (unit)
                return unit;
        }
        return null;
    }
    handleResourceLanding(unitId) {
        if (!this.gameEngine || !this.ui)
            return;
        const status = this.gameEngine.getResourceStatusForUnit(unitId);
        this.ui.updateResourceStatus(status);
        if (!status) {
            this.resourcePromptUnitId = null;
            this.ui.hideResourceChoice();
            return;
        }
        if (status.mode === 'none' && this.resourcePromptUnitId !== unitId) {
            this.resourcePromptUnitId = unitId;
            this.ui.showResourceChoice(status, () => {
                if (!this.gameEngine || !this.ui)
                    return;
                const result = this.gameEngine.startActiveGather(unitId);
                this.ui.addEvent(result.message);
            }, () => {
                if (!this.gameEngine || !this.ui)
                    return;
                const result = this.gameEngine.startIdleGather(unitId);
                this.ui.addEvent(result.message);
            }, () => {
                // Player chose to ignore — dismissed, no gather started
            });
        }
        else if (status.mode !== 'none') {
            this.resourcePromptUnitId = null;
            this.ui.hideResourceChoice();
        }
    }
    handleMountainDestroyLanding(unitId) {
        if (!this.gameEngine || !this.ui)
            return;
        const status = this.gameEngine.getMountainDestroyStatusForUnit(unitId);
        this.ui.updateMountainDestroyStatus(status);
        if (!status) {
            this.mountainPromptUnitId = null;
            return;
        }
        if (status.mode === 'pending' && this.mountainPromptUnitId !== unitId) {
            this.mountainPromptUnitId = unitId;
            this.ui.showMountainDestroyChoice(status, () => {
                if (!this.gameEngine || !this.ui)
                    return;
                const result = this.gameEngine.confirmMountainDestroy(unitId);
                this.ui.addEvent(result.message);
            }, () => {
                if (!this.gameEngine || !this.ui)
                    return;
                const result = this.gameEngine.cancelMountainDestroy(unitId);
                this.ui.addEvent(result.message);
                this.mountainPromptUnitId = null;
                this.ui.updateMountainDestroyStatus(null);
            });
        }
        else if (status.mode !== 'pending') {
            this.mountainPromptUnitId = null;
            this.ui.hideMountainDestroyChoice();
        }
    }
    updateMountainDestroyUI() {
        if (!this.gameEngine || !this.ui || !this.selectedUnitId) {
            this.ui?.updateMountainDestroyStatus(null);
            return;
        }
        const status = this.gameEngine.getMountainDestroyStatusForUnit(this.selectedUnitId);
        this.ui.updateMountainDestroyStatus(status);
        if (!status) {
            this.mountainPromptUnitId = null;
            return;
        }
        if (status.mode === 'pending') {
            this.handleMountainDestroyLanding(this.selectedUnitId);
        }
        else {
            this.mountainPromptUnitId = null;
            this.ui.hideMountainDestroyChoice();
        }
    }
    updateResourceGatherUI() {
        if (!this.gameEngine || !this.ui || !this.selectedUnitId) {
            this.ui?.updateResourceStatus(null);
            return;
        }
        const mountainStatus = this.gameEngine.getMountainDestroyStatusForUnit(this.selectedUnitId);
        if (mountainStatus) {
            return;
        }
        const status = this.gameEngine.getResourceStatusForUnit(this.selectedUnitId);
        this.ui.updateResourceStatus(status);
        if (!this.isHumanTurn()) {
            this.resourcePromptUnitId = null;
            this.ui.hideResourceChoice();
            return;
        }
        if (!status) {
            this.resourcePromptUnitId = null;
            this.ui.hideResourceChoice();
            return;
        }
        if (status.mode === 'none') {
            if (this.resourcePromptUnitId !== this.selectedUnitId) {
                this.resourcePromptUnitId = this.selectedUnitId;
                this.ui.showResourceChoice(status, () => {
                    if (!this.gameEngine || !this.ui || !this.selectedUnitId)
                        return;
                    const result = this.gameEngine.startActiveGather(this.selectedUnitId);
                    this.ui.addEvent(result.message);
                }, () => {
                    if (!this.gameEngine || !this.ui || !this.selectedUnitId)
                        return;
                    const result = this.gameEngine.startIdleGather(this.selectedUnitId);
                    this.ui.addEvent(result.message);
                }, () => {
                    // Player chose to ignore — dismissed, no gather started.
                });
            }
            return;
        }
        this.resourcePromptUnitId = null;
        this.ui.hideResourceChoice();
    }
    isPlayerActionLocked() {
        if (!this.gameEngine || !this.currentPlayer)
            return false;
        return this.gameEngine.isPlayerGatherLocked(this.currentPlayer.id);
    }
    isHumanTurn() {
        if (!this.gameEngine)
            return false;
        return this.gameEngine.getCurrentPlayer().isHuman;
    }
    syncTurnStatus(force = false) {
        if (!this.gameEngine || !this.ui)
            return;
        const current = this.gameEngine.getCurrentPlayer();
        const signature = `${this.gameEngine.getTurn()}:${current.id}`;
        if (!force && this.lastTurnSignature === signature) {
            return;
        }
        this.lastTurnSignature = signature;
        this.updateAIRumorSignals();
        this.ui.updateTurn(this.gameEngine.getTurn(), current);
        if (current.isHuman) {
            const readyUnits = current.units.filter((u) => u.movementPoints > 0).length;
            this.ui.addEvent(`Your turn: ${readyUnits} unit(s) ready. Press H for handbook, F to focus selection.`);
        }
        else {
            this.ui.addEvent(`${current.name} (AI) is taking its turn...`);
        }
    }
    updateAIRumorSignals() {
        if (!this.gameEngine || !this.ui || !this.renderer || !this.currentPlayer) {
            return;
        }
        const gameState = this.gameEngine.getGameState();
        const anchor = this.currentPlayer.cities[0] || this.currentPlayer.units[0] || null;
        if (!anchor) {
            this.ui.setAIRumorLines(['No scouts available for strategic reports.']);
            this.renderer.setAIRumorHints([]);
            return;
        }
        const turn = this.gameEngine.getTurn();
        const rumorLines = [];
        const rumorHints = [];
        for (const player of gameState.players) {
            if (!player.isAI)
                continue;
            for (const city of player.cities) {
                const dx = city.x - anchor.x;
                const dy = city.y - anchor.y;
                const distance = Math.abs(dx) + Math.abs(dy);
                const direction = this.getDirectionLabel(dx, dy);
                const rangeBand = distance <= 20 ? 'near frontier'
                    : distance <= 45 ? 'mid frontier'
                        : 'far frontier';
                rumorLines.push(`- Activity rumored to the ${direction} (${rangeBand}).`);
                const seed = this.hashSeedFromString(`${city.id}:${turn}`);
                const offsetX = (seed % 11) - 5;
                const offsetY = (Math.floor(seed / 11) % 11) - 5;
                rumorHints.push({
                    x: city.x + offsetX,
                    y: city.y + offsetY,
                    intensity: Math.max(1, Math.min(4, Math.floor(city.population / 3))),
                });
            }
        }
        const uniqueRumors = Array.from(new Set(rumorLines)).slice(0, 5);
        this.ui.setAIRumorLines(uniqueRumors.length > 0 ? uniqueRumors : ['No rumors intercepted yet.']);
        this.renderer.setAIRumorHints(rumorHints);
    }
    getDirectionLabel(dx, dy) {
        const horizontal = dx > 3 ? 'east' : dx < -3 ? 'west' : '';
        const vertical = dy > 3 ? 'south' : dy < -3 ? 'north' : '';
        if (horizontal && vertical) {
            return `${vertical}-${horizontal}`;
        }
        if (horizontal)
            return horizontal;
        if (vertical)
            return vertical;
        return 'central zone';
    }
    hashSeedFromString(value) {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return Math.abs(hash);
    }
    focusSelectedEntity() {
        if (!this.renderer || !this.gameEngine || !this.ui)
            return;
        const selected = this.renderer.getSelectedEntity();
        if (!selected) {
            this.ui.addEvent('No selected entity to focus.');
            return;
        }
        const gameState = this.gameEngine.getGameState();
        if (selected.type === 'unit') {
            for (const player of gameState.players) {
                const unit = player.units.find((u) => u.id === selected.id);
                if (unit) {
                    this.renderer.centerCameraOn(unit.x, unit.y);
                    this.ui.addEvent(`Focused camera on ${unit.type}.`);
                    return;
                }
            }
        }
        if (selected.type === 'city') {
            for (const player of gameState.players) {
                const city = player.cities.find((c) => c.id === selected.id);
                if (city) {
                    this.renderer.centerCameraOn(city.x, city.y);
                    this.ui.addEvent(`Focused camera on ${city.name}.`);
                    return;
                }
            }
        }
        this.ui.addEvent('Selected entity is no longer available.');
    }
    showBlockedInputMessage(message) {
        const now = Date.now();
        if (now - this.lastBlockedInputMessageAt < 900) {
            return;
        }
        this.lastBlockedInputMessageAt = now;
        this.ui?.addEvent(message);
    }
    openCityManagement(cityId) {
        if (!this.gameEngine || !this.currentPlayer || !this.ui)
            return;
        const data = this.gameEngine.getCityManagementData(this.currentPlayer.id, cityId);
        if (!data)
            return;
        this.ui.showCityManagement(data, (optionId) => {
            if (!this.gameEngine || !this.currentPlayer || !this.ui)
                return;
            const result = this.gameEngine.applyCityOption(this.currentPlayer.id, cityId, optionId);
            this.ui.addEvent(result.message);
            if (result.ok) {
                this.openCityManagement(cityId);
            }
        }, () => {
            this.ui?.addEvent('Closed city management.');
        });
    }
    cleanup() {
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
//# sourceMappingURL=index.js.map