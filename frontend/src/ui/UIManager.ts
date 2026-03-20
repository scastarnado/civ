/**
 * UI System
 * Manages UI panels, resources display, and event log
 */

import {
	City,
	CityManagementData,
	CityManagementOption,
	Player,
	ResourceNodeStatus,
	Unit,
} from '@/core/types';

export class UIPanel {
	private container: HTMLElement;

	constructor(elementId: string) {
		const element = document.getElementById(elementId);
		if (!element) {
			throw new Error(`UI element with id '${elementId}' not found`);
		}
		this.container = element;
	}

	/**
	 * Update panel content
	 */
	setContent(content: string): void {
		const contentElement = this.container.querySelector(
			'.panel-content',
		) as HTMLElement;
		if (contentElement) {
			contentElement.textContent = content;
		}
	}

	/**
	 * Clear panel content
	 */
	clear(): void {
		this.setContent('');
	}

	getContainer(): HTMLElement {
		return this.container;
	}
}

export class UIManager {
	private leftPanel: UIPanel;
	private rightPanel: UIPanel;
	private bottomPanel: UIPanel;
	private rightPanelContent: HTMLElement;
	private rightPanelTabButtons: Map<string, HTMLButtonElement> = new Map();
	private rightPanelActiveTab: 'overview' | 'turn' | 'controls' = 'overview';
	private rightPanelPlayer: Player | null = null;
	private eventLog: string[] = [];
	private maxLogEntries: number = 50;
	private resourcePromptOverlay: HTMLDivElement;
	private resourcePromptText: HTMLDivElement;
	private resourceProgressOverlay: HTMLDivElement;
	private resourceProgressText: HTMLDivElement;
	private resourceProgressFillA: HTMLDivElement;
	private resourceProgressFillB: HTMLDivElement;
	private cityOverlay: HTMLDivElement;
	private cityOverlayContent: HTMLDivElement;
	private cityOverlayOnClose: (() => void) | null = null;
	private turnInfoText: string = 'Turn: 0';
	private controlsText: string =
		'CONTROLS\n- End Turn: Space / Enter\n- Select/Move: Left Click\n- Camera: WASD / Arrows';

	constructor() {
		this.leftPanel = new UIPanel('left-panel');
		this.rightPanel = new UIPanel('right-panel');
		this.bottomPanel = new UIPanel('bottom-panel');
		const overlays = this.createResourceOverlays();
		this.resourcePromptOverlay = overlays.promptOverlay;
		this.resourcePromptText = overlays.promptText;
		this.resourceProgressOverlay = overlays.progressOverlay;
		this.resourceProgressText = overlays.progressText;
		this.resourceProgressFillA = overlays.progressFillA;
		this.resourceProgressFillB = overlays.progressFillB;
		const cityOverlay = this.createCityOverlay();
		this.cityOverlay = cityOverlay.overlay;
		this.cityOverlayContent = cityOverlay.content;

		const rightContent = document.getElementById('right-content');
		if (!rightContent) {
			throw new Error("UI element with id 'right-content' not found");
		}
		this.rightPanelContent = rightContent;
		this.setupRightPanelTabs();
	}

	private setupRightPanelTabs(): void {
		const rightPanelContainer = this.rightPanel.getContainer();
		const endTurnBtn = document.getElementById('end-turn-btn');

		const tabsContainer = document.createElement('div');
		tabsContainer.style.display = 'flex';
		tabsContainer.style.gap = '4px';
		tabsContainer.style.marginBottom = '8px';

		const tabDefs: Array<{
			key: 'overview' | 'turn' | 'controls';
			label: string;
		}> = [
			{ key: 'overview', label: 'Overview' },
			{ key: 'turn', label: 'Turn' },
			{ key: 'controls', label: 'Controls' },
		];

		tabDefs.forEach((tab) => {
			const btn = document.createElement('button');
			btn.textContent = tab.label;
			btn.style.flex = '1';
			btn.style.padding = '4px 6px';
			btn.addEventListener('click', () => {
				this.rightPanelActiveTab = tab.key;
				this.refreshRightPanelTabStyles();
				this.renderRightPanelContent();
			});
			this.rightPanelTabButtons.set(tab.key, btn);
			tabsContainer.appendChild(btn);
		});

		if (endTurnBtn && endTurnBtn.parentElement === rightPanelContainer) {
			rightPanelContainer.insertBefore(tabsContainer, this.rightPanelContent);
		} else {
			rightPanelContainer.appendChild(tabsContainer);
		}

		this.refreshRightPanelTabStyles();
	}

	private refreshRightPanelTabStyles(): void {
		this.rightPanelTabButtons.forEach((btn, key) => {
			if (key === this.rightPanelActiveTab) {
				btn.style.backgroundColor = '#006600';
				btn.style.borderColor = '#aaffaa';
			} else {
				btn.style.backgroundColor = '#003300';
				btn.style.borderColor = '#00ff00';
			}
		});
	}

	private renderRightPanelContent(): void {
		if (!this.rightPanelPlayer) {
			this.rightPanelContent.textContent = 'No player data';
			return;
		}

		const player = this.rightPanelPlayer;
		let content = '';

		if (this.rightPanelActiveTab === 'overview') {
			content = `RESOURCES
Gold: ${Math.floor(player.resources.gold)}
Food: ${Math.floor(player.resources.food)}
Production: ${Math.floor(player.resources.production)}

CITIES
Count: ${player.cities.length}

UNITS
Count: ${player.units.length}
- Settlers: ${player.units.filter((u) => u.type === 'settler').length}
- Workers: ${player.units.filter((u) => u.type === 'worker').length}
- Warriors: ${player.units.filter((u) => u.type === 'warrior').length}

TECH
Researched: ${player.techs.length}`;
		} else if (this.rightPanelActiveTab === 'turn') {
			content = this.turnInfoText;
		} else {
			content = this.controlsText;
		}

		this.rightPanelContent.textContent = content;
	}

	private createCityOverlay(): {
		overlay: HTMLDivElement;
		content: HTMLDivElement;
	} {
		const overlay = document.createElement('div');
		overlay.style.position = 'fixed';
		overlay.style.left = '50%';
		overlay.style.top = '50%';
		overlay.style.transform = 'translate(-50%, -50%)';
		overlay.style.background = '#111111';
		overlay.style.border = '2px solid #00ff00';
		overlay.style.padding = '14px';
		overlay.style.width = '560px';
		overlay.style.maxHeight = '76vh';
		overlay.style.overflowY = 'auto';
		overlay.style.display = 'none';
		overlay.style.zIndex = '25';

		const content = document.createElement('div');
		overlay.appendChild(content);
		document.body.appendChild(overlay);

		return { overlay, content };
	}

	private createResourceOverlays(): {
		promptOverlay: HTMLDivElement;
		promptText: HTMLDivElement;
		progressOverlay: HTMLDivElement;
		progressText: HTMLDivElement;
		progressFillA: HTMLDivElement;
		progressFillB: HTMLDivElement;
	} {
		const promptOverlay = document.createElement('div');
		promptOverlay.style.position = 'fixed';
		promptOverlay.style.left = '50%';
		promptOverlay.style.top = '50%';
		promptOverlay.style.transform = 'translate(-50%, -50%)';
		promptOverlay.style.background = '#101010';
		promptOverlay.style.border = '2px solid #00ff00';
		promptOverlay.style.padding = '14px';
		promptOverlay.style.minWidth = '320px';
		promptOverlay.style.display = 'none';
		promptOverlay.style.zIndex = '20';

		const promptText = document.createElement('div');
		promptText.style.marginBottom = '10px';
		promptOverlay.appendChild(promptText);

		document.body.appendChild(promptOverlay);

		const progressOverlay = document.createElement('div');
		progressOverlay.style.position = 'fixed';
		progressOverlay.style.left = '50%';
		progressOverlay.style.bottom = '14px';
		progressOverlay.style.transform = 'translateX(-50%)';
		progressOverlay.style.background = '#101010';
		progressOverlay.style.border = '2px solid #00ff00';
		progressOverlay.style.padding = '10px';
		progressOverlay.style.width = '420px';
		progressOverlay.style.display = 'none';
		progressOverlay.style.zIndex = '18';

		const progressText = document.createElement('div');
		progressText.style.marginBottom = '8px';
		progressOverlay.appendChild(progressText);

		const barA = document.createElement('div');
		barA.style.width = '100%';
		barA.style.height = '12px';
		barA.style.border = '1px solid #00ff00';
		barA.style.marginBottom = '6px';
		const progressFillA = document.createElement('div');
		progressFillA.style.width = '0%';
		progressFillA.style.height = '100%';
		progressFillA.style.background = '#00ff00';
		barA.appendChild(progressFillA);
		progressOverlay.appendChild(barA);

		const barB = document.createElement('div');
		barB.style.width = '100%';
		barB.style.height = '12px';
		barB.style.border = '1px solid #00ff00';
		const progressFillB = document.createElement('div');
		progressFillB.style.width = '0%';
		progressFillB.style.height = '100%';
		progressFillB.style.background = '#ffcc00';
		barB.appendChild(progressFillB);
		progressOverlay.appendChild(barB);

		document.body.appendChild(progressOverlay);

		return {
			promptOverlay,
			promptText,
			progressOverlay,
			progressText,
			progressFillA,
			progressFillB,
		};
	}

	/**
	 * Update left panel with selected entity info
	 */
	updateSelectedInfo(entity: Unit | City | null): void {
		if (!entity) {
			this.leftPanel.setContent('None selected');
			return;
		}

		if ('type' in entity) {
			// It's a unit
			const unit = entity as Unit;
			const info = `UNIT
Type: ${unit.type}
Health: ${unit.health}/${unit.maxHealth}
Movement: ${unit.movementPoints}/${unit.maxMovementPoints}
Attack: ${unit.attack}
Defense: ${unit.defense}
Position: (${unit.x}, ${unit.y})
Automated: ${unit.automated ? 'Yes' : 'No'}`;
			this.leftPanel.setContent(info);
		} else {
			// It's a city
			const city = entity as City;
			const info = `CITY
Name: ${city.name}
Level: ${city.level}
Population: ${city.population}
Food: ${city.food}
Production: ${city.production}
Position: (${city.x}, ${city.y})
Buildings: ${city.buildings.length > 0 ? city.buildings.join(', ') : 'None'}
Queue: ${city.productionQueue.length > 0 ? city.productionQueue.join(', ') : 'None'}`;
			this.leftPanel.setContent(info);
		}
	}

	/**
	 * Update right panel with player resources
	 */
	updateResources(player: Player): void {
		this.rightPanelPlayer = player;
		this.renderRightPanelContent();
	}

	updateTurnOrder(turn: number, players: Player[], currentIndex: number): void {
		const lines: string[] = [];
		for (let offset = 0; offset < players.length; offset++) {
			const idx = (currentIndex + offset) % players.length;
			const player = players[idx];
			const prefix =
				offset === 0 ? 'NOW'
				: offset === 1 ? 'NEXT'
				: `+${offset}`;
			lines.push(
				`${prefix}: ${player.name}${player.isAI ? ' [AI]' : ' [HUMAN]'}`,
			);
		}

		this.turnInfoText = `TURN\nNumber: ${turn}\nPlayers: ${players.length}\nOrder:\n${lines.join('\n')}`;
		this.renderRightPanelContent();
	}

	/**
	 * Add event to log
	 */
	addEvent(message: string): void {
		const timestamp = new Date().toLocaleTimeString();
		this.eventLog.push(`[${timestamp}] ${message}`);

		// Keep log size limited
		if (this.eventLog.length > this.maxLogEntries) {
			this.eventLog.shift();
		}

		this.updateEventLog();
	}

	/**
	 * Update event log display
	 */
	private updateEventLog(): void {
		this.bottomPanel.setContent(this.eventLog.join('\n'));

		// Auto-scroll to bottom
		const contentElement = this.bottomPanel
			.getContainer()
			.querySelector('.panel-content');
		if (contentElement) {
			contentElement.scrollTop = contentElement.scrollHeight;
		}
	}

	/**
	 * Clear event log
	 */
	clearEventLog(): void {
		this.eventLog = [];
		this.updateEventLog();
	}

	/**
	 * Toggle panel visibility
	 */
	togglePanel(panelId: string): void {
		const panel = document.getElementById(panelId);
		if (panel) {
			panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
		}
	}

	/**
	 * Show game over screen
	 */
	showGameOver(winner: Player | null): void {
		const message = winner ? `Game Over! Winner: ${winner.name}` : 'Game Over!';

		alert(message);
	}

	/**
	 * Update turn indicator
	 */
	updateTurn(turn: number, currentPlayer: Player): void {
		this.addEvent(
			`Turn ${turn}: ${currentPlayer.name}'s turn${currentPlayer.isAI ? ' (AI)' : ''}`,
		);
	}

	showResourceChoice(
		status: ResourceNodeStatus,
		onActive: () => void,
		onIdle: () => void,
	): void {
		this.resourcePromptOverlay.innerHTML = '';

		this.resourcePromptText = document.createElement('div');
		this.resourcePromptText.style.marginBottom = '10px';
		this.resourcePromptText.textContent = `Resource found: ${status.type.toUpperCase()} at (${status.x}, ${status.y}). Choose how to gather.`;
		this.resourcePromptOverlay.appendChild(this.resourcePromptText);

		const activeBtn = document.createElement('button');
		activeBtn.textContent = 'Active Gather';
		activeBtn.addEventListener('click', () => {
			this.resourcePromptOverlay.style.display = 'none';
			onActive();
		});

		const idleBtn = document.createElement('button');
		idleBtn.textContent = 'Idle Gather';
		idleBtn.addEventListener('click', () => {
			this.resourcePromptOverlay.style.display = 'none';
			onIdle();
		});

		const buttonRow = document.createElement('div');
		buttonRow.appendChild(activeBtn);
		buttonRow.appendChild(idleBtn);
		this.resourcePromptOverlay.appendChild(buttonRow);

		this.resourcePromptOverlay.style.display = 'block';
	}

	hideResourceChoice(): void {
		this.resourcePromptOverlay.style.display = 'none';
	}

	showCityManagement(
		data: CityManagementData,
		onSelect: (optionId: string) => void,
		onClose: () => void,
	): void {
		this.cityOverlayOnClose = onClose;
		this.cityOverlayContent.innerHTML = '';

		const title = document.createElement('div');
		title.style.fontWeight = 'bold';
		title.style.marginBottom = '8px';
		title.textContent = `${data.cityName} - Level ${data.level}`;
		this.cityOverlayContent.appendChild(title);

		const summary = document.createElement('div');
		summary.style.marginBottom = '10px';
		summary.textContent = `Population: ${data.population} | Buildings: ${data.buildings.length} | Gold ${Math.floor(data.playerResources.gold)} | Food ${Math.floor(data.playerResources.food)} | Production ${Math.floor(data.playerResources.production)}`;
		this.cityOverlayContent.appendChild(summary);

		const grouped: Record<string, CityManagementOption[]> = {
			military: [],
			improvements: [],
			civil: [],
		};
		data.options.forEach((option) => {
			grouped[option.category].push(option);
		});

		const sectionOrder: Array<{ key: string; label: string }> = [
			{ key: 'military', label: 'Military' },
			{ key: 'improvements', label: 'City Improvements' },
			{ key: 'civil', label: 'Civil / Exploration' },
		];

		const tabBar = document.createElement('div');
		tabBar.style.display = 'flex';
		tabBar.style.gap = '6px';
		tabBar.style.marginBottom = '10px';
		this.cityOverlayContent.appendChild(tabBar);

		const tabContent = document.createElement('div');
		this.cityOverlayContent.appendChild(tabContent);

		const tabButtons: HTMLButtonElement[] = [];

		const renderTab = (categoryKey: string): void => {
			tabContent.innerHTML = '';

			const options = grouped[categoryKey] || [];
			if (options.length === 0) {
				const empty = document.createElement('div');
				empty.textContent = 'No options in this tab yet.';
				empty.style.marginBottom = '10px';
				tabContent.appendChild(empty);
				return;
			}

			options.forEach((option) => {
				const row = document.createElement('div');
				row.style.border = '1px solid #00aa00';
				row.style.padding = '8px';
				row.style.marginBottom = '6px';

				const name = document.createElement('div');
				name.style.fontWeight = 'bold';
				name.textContent = `${option.name} (${option.kind})`;
				row.appendChild(name);

				const desc = document.createElement('div');
				desc.style.margin = '4px 0';
				desc.textContent = option.description;
				row.appendChild(desc);

				const cost = document.createElement('div');
				cost.textContent = `Cost G:${option.cost.gold} F:${option.cost.food} P:${option.cost.production}`;
				row.appendChild(cost);

				const status = document.createElement('div');
				status.style.marginTop = '4px';
				if (option.owned) {
					status.textContent = 'Completed';
				} else if (option.lockedByPrerequisite) {
					status.textContent = 'Locked by prerequisite';
				} else if (!option.canAfford) {
					status.textContent = 'Not enough resources';
				} else {
					status.textContent = 'Available';
				}
				row.appendChild(status);

				if (!option.owned && !option.lockedByPrerequisite) {
					const actionBtn = document.createElement('button');
					actionBtn.textContent = `Start ${option.kind}`;
					actionBtn.disabled = !option.canAfford;
					actionBtn.addEventListener('click', () => onSelect(option.id));
					row.appendChild(actionBtn);
				}

				tabContent.appendChild(row);
			});
		};

		sectionOrder.forEach((section, index) => {
			const tabBtn = document.createElement('button');
			tabBtn.textContent = section.label;
			tabBtn.style.flex = '1';
			tabBtn.addEventListener('click', () => {
				tabButtons.forEach((btn) => {
					btn.style.backgroundColor = '#003300';
					btn.style.borderColor = '#00ff00';
				});
				tabBtn.style.backgroundColor = '#006600';
				tabBtn.style.borderColor = '#aaffaa';
				renderTab(section.key);
			});
			tabButtons.push(tabBtn);
			tabBar.appendChild(tabBtn);

			if (index === 0) {
				tabBtn.style.backgroundColor = '#006600';
				tabBtn.style.borderColor = '#aaffaa';
				renderTab(section.key);
			}
		});

		const closeBtn = document.createElement('button');
		closeBtn.textContent = 'Close';
		closeBtn.style.width = '100%';
		closeBtn.addEventListener('click', () => {
			this.hideCityManagement(true);
		});
		this.cityOverlayContent.appendChild(closeBtn);

		this.cityOverlay.style.display = 'block';
	}

	hideCityManagement(triggerCallback: boolean = false): void {
		this.cityOverlay.style.display = 'none';
		if (triggerCallback && this.cityOverlayOnClose) {
			this.cityOverlayOnClose();
		}
		this.cityOverlayOnClose = null;
	}

	closeActivePanel(): boolean {
		if (this.cityOverlay.style.display !== 'none') {
			this.hideCityManagement(true);
			return true;
		}

		if (this.resourcePromptOverlay.style.display !== 'none') {
			this.hideResourceChoice();
			return true;
		}

		return false;
	}

	updateResourceStatus(status: ResourceNodeStatus | null): void {
		if (!status) {
			this.resourceProgressOverlay.style.display = 'none';
			this.hideResourceChoice();
			return;
		}

		const remaining = `${Math.floor(status.remaining)}/${status.capacity}`;
		if (status.mode === 'cooldown') {
			this.resourceProgressText.textContent = `${status.type.toUpperCase()} Node reloading - ${status.cooldownTurnsRemaining} turn(s) left`;
		} else {
			this.resourceProgressText.textContent = `${status.type.toUpperCase()} Node  Remaining: ${remaining}`;
		}

		let progressA = 0;
		let progressB = 0;

		if (status.mode === 'active') {
			progressA = status.activeProgress;
			progressB = status.remaining / status.capacity;
		} else if (status.mode === 'cooldown') {
			progressA = status.cooldownProgress;
			progressB = 0;
		} else if (status.mode === 'idle') {
			progressA = status.idleTickProgress;
			progressB = status.remaining / status.capacity;
		} else {
			progressA = status.remaining / status.capacity;
			progressB = 0;
		}

		this.resourceProgressFillA.style.width = `${Math.floor(progressA * 100)}%`;
		this.resourceProgressFillB.style.width = `${Math.floor(progressB * 100)}%`;
		this.resourceProgressOverlay.style.display = 'block';
	}
}
