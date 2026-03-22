/**
 * UI System
 * Manages UI panels, resources display, and event log
 */

import {
	City,
	CityManagementData,
	CityManagementOption,
	MountainDestroyStatus,
	Player,
	ResourceNodeStatus,
	Unit,
} from '@/core/types';

export interface GameSettings {
	masterVolume: number;
	sfxEnabled: boolean;
	showGrid: boolean;
	showFPS: boolean;
	confirmEndTurn: boolean;
}

const SETTINGS_KEY = 'civ.settings';
const DEFAULT_SETTINGS: GameSettings = {
	masterVolume: 70,
	sfxEnabled: true,
	showGrid: true,
	showFPS: false,
	confirmEndTurn: false,
};

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
	private lastEventMessage: string | null = null;
	private lastEventAt: number = 0;
	private lastEventRepeatCount: number = 0;
	private resourcePromptOverlay: HTMLDivElement;
	private resourcePromptText: HTMLDivElement;
	private resourceProgressOverlay: HTMLDivElement;
	private resourceProgressText: HTMLDivElement;
	private resourceProgressFillA: HTMLDivElement;
	private resourceProgressFillB: HTMLDivElement;
	private cityOverlay: HTMLDivElement;
	private cityOverlayContent: HTMLDivElement;
	private cityOverlayOnClose: (() => void) | null = null;
	private tutorialOverlay: HTMLDivElement;
	private tutorialPanel: HTMLDivElement;
	private tutorialContent: HTMLDivElement;
	private tutorialActiveTab:
		| 'basics'
		| 'map'
		| 'turns'
		| 'economy'
		| 'upgrades' = 'basics';
	private turnInfoText: string = 'Turn: 0';
	private aiRumorLines: string[] = [];
	private aiIntelFeed: string[] = [];
	private controlsText: string =
		'CONTROLS\n- End Turn: Space / Enter\n- Select/Move: Left Click\n- Camera: WASD / Arrows\n- Game Menu: Esc\n- Handbook: H\n- Focus Selected: F';
	private pauseMenuOverlay!: HTMLDivElement;
	private settings: GameSettings = { ...DEFAULT_SETTINGS };
	onLeaveGame: (() => void) | null = null;
	onSettingsChange: ((settings: GameSettings) => void) | null = null;

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
		const tutorialOverlay = this.createTutorialOverlay();
		this.tutorialOverlay = tutorialOverlay.overlay;
		this.tutorialPanel = tutorialOverlay.panel;
		this.tutorialContent = tutorialOverlay.content;

		const rightContent = document.getElementById('right-content');
		if (!rightContent) {
			throw new Error("UI element with id 'right-content' not found");
		}
		this.rightPanelContent = rightContent;
		this.setupRightPanelTabs();
		this.settings = this.loadSettings();
		const pauseMenu = this.createPauseMenuOverlay();
		this.pauseMenuOverlay = pauseMenu.overlay;
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

	private createTutorialOverlay(): {
		overlay: HTMLDivElement;
		panel: HTMLDivElement;
		content: HTMLDivElement;
	} {
		const overlay = document.createElement('div');
		overlay.style.position = 'fixed';
		overlay.style.inset = '0';
		overlay.style.background = 'rgba(0, 0, 0, 0.72)';
		overlay.style.display = 'none';
		overlay.style.zIndex = '30';

		const panel = document.createElement('div');
		panel.style.position = 'absolute';
		panel.style.left = '50%';
		panel.style.top = '50%';
		panel.style.transform = 'translate(-50%, -50%)';
		panel.style.width = 'min(960px, 94vw)';
		panel.style.maxHeight = '86vh';
		panel.style.background = '#0f0f0f';
		panel.style.border = '2px solid #00ff00';
		panel.style.padding = '12px';
		panel.style.overflow = 'hidden';
		overlay.appendChild(panel);

		const titleRow = document.createElement('div');
		titleRow.style.display = 'flex';
		titleRow.style.justifyContent = 'space-between';
		titleRow.style.alignItems = 'center';
		titleRow.style.marginBottom = '8px';

		const title = document.createElement('div');
		title.textContent = 'Strategy Handbook';
		title.style.fontWeight = 'bold';
		title.style.fontSize = '15px';
		titleRow.appendChild(title);

		const closeBtn = document.createElement('button');
		closeBtn.textContent = 'Close (Esc)';
		closeBtn.addEventListener('click', () => this.hideTutorialMenu());
		titleRow.appendChild(closeBtn);
		panel.appendChild(titleRow);

		const tabRow = document.createElement('div');
		tabRow.style.display = 'grid';
		tabRow.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
		tabRow.style.gap = '6px';
		tabRow.style.marginBottom = '10px';

		const tabs: Array<{
			key: 'basics' | 'map' | 'turns' | 'economy' | 'upgrades';
			label: string;
		}> = [
			{ key: 'basics', label: 'Basics' },
			{ key: 'map', label: 'Map & Cells' },
			{ key: 'turns', label: 'Turns & Actions' },
			{ key: 'economy', label: 'Economy' },
			{ key: 'upgrades', label: 'Upgrades' },
		];

		tabs.forEach((tab) => {
			const btn = document.createElement('button');
			btn.textContent = tab.label;
			btn.dataset.tutorialTab = tab.key;
			btn.style.width = '100%';
			btn.style.margin = '0';
			btn.style.padding = '6px';
			btn.addEventListener('click', () => {
				this.tutorialActiveTab = tab.key;
				this.renderTutorialContent();
			});
			tabRow.appendChild(btn);
		});
		panel.appendChild(tabRow);

		const content = document.createElement('div');
		content.style.maxHeight = 'calc(86vh - 110px)';
		content.style.overflowY = 'auto';
		content.style.border = '1px solid #00aa00';
		content.style.padding = '10px';
		content.style.lineHeight = '1.5';
		panel.appendChild(content);

		overlay.addEventListener('click', (event) => {
			if (event.target === overlay) {
				this.hideTutorialMenu();
			}
		});

		document.body.appendChild(overlay);

		return { overlay, panel, content };
	}

	private renderTutorialContent(): void {
		const tabContent: Record<string, string> = {
			basics: `<div style="margin-bottom:10px;"><strong>Quick Objective</strong><br>Grow cities, field units, gather resources, and out-scale rival players over turns.</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
<div style="border:1px solid #00aa00;padding:8px;"><strong>1) Expand</strong><br>Use <strong>S</strong> (Settler) to create new cities.</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>2) Harvest</strong><br>Move units onto resource markers and choose Active/Idle/Ignore.</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>3) Build Power</strong><br>Open city management to unlock buildings and research.</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>4) Control Tempo</strong><br>End turns efficiently while preserving production momentum.</div>
</div>
<div style="margin-top:10px;border:1px solid #00aa00;padding:8px;"><strong>Input Reference</strong><br>Left Click: select/move | Space/Enter: end turn | Arrows/WASD: camera | Esc: close panel, then open/close this handbook.</div>`,
			map: `<div style="margin-bottom:8px;"><strong>Cell Legend (what each cell means)</strong></div>
<div style="font-family:'Courier New',monospace;border:1px solid #00aa00;padding:8px;white-space:pre-wrap;">.  Grassland   (walkable)
T  Forest      (walkable)
^  Mountain    (not walkable)
~  Water       (not walkable)

w  Wheat node  -> food-focused harvest
d  Deer node   -> food + a bit of gold
i  Iron node   -> production-focused harvest
h  Horses node -> balanced mobile economy
$  Gold node   -> gold-focused harvest

C  City center (population number shown next to C)
S/W/! Units    Settler / Worker / Warrior</div>
<div style="margin-top:8px;border:1px solid #00aa00;padding:8px;"><strong>Interactions with player</strong><br>Walkable cells let your units move and stand. Resource cells trigger a gather choice. Mountain/water cells block movement and can shape chokepoints.</div>
<div style="margin-top:8px;border:1px solid #00aa00;padding:8px;"><strong>Visibility</strong><br>Bright tiles are currently visible. Dim tiles are discovered but currently outside vision.</div>`,
			turns: `<div style="margin-bottom:8px;"><strong>What you can do each turn</strong></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;">
<div style="border:1px solid #00aa00;padding:8px;"><strong>Unit Actions</strong><br>- Move within movement points<br>- Settle city (Settler only)<br>- Start gather on a resource tile<br>- Attack (Warrior)</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>City Actions</strong><br>- Open city management<br>- Build one building/research option if affordable<br>- Spend production to create units</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>Gathering Modes</strong><br><strong>Active</strong>: one-time full harvest after a short lock.<br><strong>Idle</strong>: periodic small harvest chunks over time.<br><strong>Ignore</strong>: no gather started.</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>Turn Flow</strong><br>When you end turn, units reset movement for that player. Node respawn counters also tick down by turn.</div>
</div>
<div style="margin-top:8px;border:1px solid #00aa00;padding:8px;"><strong>Important rule</strong><br>If a player has an <strong>active gather</strong> running, actions are temporarily locked until it completes.</div>`,
			economy: `<div style="margin-bottom:8px;"><strong>How economy works</strong></div>
<div style="border:1px solid #00aa00;padding:8px;margin-bottom:8px;"><strong>Passive income (always on)</strong><br>Each city continuously contributes food and production over time, modified by multipliers and building bonuses. Gold is primarily from certain buildings plus gold resource harvesting.</div>
<div style="border:1px solid #00aa00;padding:8px;margin-bottom:8px;"><strong>Node economy</strong><br>Resource nodes have capacity. Harvesting drains capacity. When empty, node enters cooldown for several turns, then refills to full.</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;">
<div style="border:1px solid #00aa00;padding:8px;"><strong>Spend Gold</strong><br>Buildings + research</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>Spend Food</strong><br>Some research/buildings</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>Spend Production</strong><br>Units + buildings + research</div>
</div>
<div style="margin-top:8px;border:1px solid #00aa00;padding:8px;"><strong>Tempo tip</strong><br>Chain passive city growth with idle gathering, then spike with active harvest when you need a fast purchase.</div>`,
			upgrades: `<div style="margin-bottom:8px;"><strong>Buildings & Research Impact</strong></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;">
<div style="border:1px solid #00aa00;padding:8px;"><strong>Buildings</strong><br>Granary: boosts passive food<br>Workshop: boosts passive production<br>Market: adds passive gold<br>Barracks: increases combat power (+attack progression)<br>Watchtower: adds vision progression (requires Scouting)</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>Research</strong><br>Logistics: +1 movement to units<br>Scouting: +1 vision<br>Metallurgy: +1 attack and +1 defense (requires Logistics)<br>Agronomy: +20% passive food<br>Industrialization: +20% passive production (requires Agronomy)</div>
</div>
<div style="margin-top:8px;border:1px solid #00aa00;padding:8px;"><strong>City scaling</strong><br>As buildings accumulate, city level and footprint increase, making city presence more visible on the map.</div>
<div style="margin-top:8px;border:1px solid #00aa00;padding:8px;"><strong>Practical build order</strong><br>Early: Granary/Workshop -> Mid: Logistics + Market -> Late: Metallurgy + Industrialization.</div>`,
		};

		this.tutorialContent.innerHTML =
			tabContent[this.tutorialActiveTab] || tabContent.basics;

		const tabButtons = this.tutorialPanel.querySelectorAll(
			'button[data-tutorial-tab]',
		);
		tabButtons.forEach((button) => {
			const btn = button as HTMLButtonElement;
			const active = btn.dataset.tutorialTab === this.tutorialActiveTab;
			btn.style.backgroundColor = '#003300';
			btn.style.borderColor = '#00ff00';
			if (active) {
				btn.style.backgroundColor = '#006600';
				btn.style.borderColor = '#aaffaa';
			}
		});
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

		const rumors =
			this.aiRumorLines.length > 0 ?
				this.aiRumorLines.join('\n')
			:	'No reliable reports yet.';
		const intel =
			this.aiIntelFeed.length > 0 ?
				this.aiIntelFeed.join('\n')
			:	'No enemy activity reports yet.';

		this.turnInfoText = `TURN\nNumber: ${turn}\nPlayers: ${players.length}\nOrder:\n${lines.join('\n')}\n\nRUMORED SETTLEMENT FRONTS\n${rumors}\n\nENEMY ACTIVITY FEED\n${intel}`;
		this.renderRightPanelContent();
	}

	setAIRumorLines(lines: string[]): void {
		this.aiRumorLines = lines.slice(0, 5);
		this.renderRightPanelContent();
	}

	pushAITurnIntel(message: string): void {
		this.aiIntelFeed.push(`- ${message}`);
		if (this.aiIntelFeed.length > 6) {
			this.aiIntelFeed.shift();
		}
		this.renderRightPanelContent();
	}

	/**
	 * Add event to log
	 */
	addEvent(message: string): void {
		const now = Date.now();
		const timestamp = new Date().toLocaleTimeString();

		if (
			this.lastEventMessage === message &&
			now - this.lastEventAt < 1600 &&
			this.eventLog.length > 0
		) {
			this.lastEventRepeatCount += 1;
			this.eventLog[this.eventLog.length - 1] =
				`[${timestamp}] ${message} (x${this.lastEventRepeatCount})`;
		} else {
			this.lastEventMessage = message;
			this.lastEventAt = now;
			this.lastEventRepeatCount = 1;
			this.eventLog.push(`[${timestamp}] ${message}`);
		}

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
		const container = this.bottomPanel.getContainer();
		container.scrollTop = container.scrollHeight;
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

	private createPromptButton(
		label: string,
		onClick: () => void,
	): HTMLButtonElement {
		const button = document.createElement('button');
		button.textContent = label;
		button.style.width = '100%';
		button.addEventListener('click', () => {
			this.resourcePromptOverlay.style.display = 'none';
			onClick();
		});
		return button;
	}

	private showChoicePrompt(
		message: string,
		buttons: Array<{ label: string; onClick: () => void }>,
	): void {
		this.resourcePromptOverlay.innerHTML = '';

		this.resourcePromptText = document.createElement('div');
		this.resourcePromptText.style.marginBottom = '10px';
		this.resourcePromptText.textContent = message;
		this.resourcePromptOverlay.appendChild(this.resourcePromptText);

		const buttonRow = document.createElement('div');
		buttonRow.style.display = 'flex';
		buttonRow.style.flexDirection = 'column';
		buttonRow.style.gap = '6px';

		buttons.forEach(({ label, onClick }) => {
			buttonRow.appendChild(this.createPromptButton(label, onClick));
		});

		this.resourcePromptOverlay.appendChild(buttonRow);
		this.resourcePromptOverlay.style.display = 'block';
	}

	showResourceChoice(
		status: ResourceNodeStatus,
		onActive: () => void,
		onIdle: () => void,
		onIgnore: () => void,
	): void {
		this.showChoicePrompt(
			`Resource found: ${status.type.toUpperCase()} at (${status.x}, ${status.y}). Choose how to gather.`,
			[
				{ label: 'Active Gather', onClick: onActive },
				{ label: 'Idle Gather', onClick: onIdle },
				{ label: 'Ignore', onClick: onIgnore },
			],
		);
	}

	showMountainDestroyChoice(
		status: MountainDestroyStatus,
		onDestroy: () => void,
		onIgnore: () => void,
	): void {
		this.showChoicePrompt(
			`Mountain at (${status.x}, ${status.y}). Choose action for your settler.`,
			[
				{
					label: `Destroy (${status.totalTurns} turns)`,
					onClick: onDestroy,
				},
				{ label: 'Ignore', onClick: onIgnore },
			],
		);
	}

	hideResourceChoice(): void {
		this.resourcePromptOverlay.style.display = 'none';
	}

	hideMountainDestroyChoice(): void {
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

	showTutorialMenu(): void {
		this.tutorialOverlay.style.display = 'block';
		this.renderTutorialContent();
	}

	hideTutorialMenu(): void {
		this.tutorialOverlay.style.display = 'none';
	}

	toggleTutorialMenu(): void {
		if (this.isTutorialMenuOpen()) {
			this.hideTutorialMenu();
		} else {
			this.showTutorialMenu();
		}
	}

	isTutorialMenuOpen(): boolean {
		return this.tutorialOverlay.style.display !== 'none';
	}

	closeActivePanel(): boolean {
		if (this.pauseMenuOverlay.style.display !== 'none') {
			this.hidePauseMenu();
			return true;
		}

		if (this.cityOverlay.style.display !== 'none') {
			this.hideCityManagement(true);
			return true;
		}

		if (this.resourcePromptOverlay.style.display !== 'none') {
			this.hideResourceChoice();
			return true;
		}

		if (this.tutorialOverlay.style.display !== 'none') {
			this.hideTutorialMenu();
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

	updateMountainDestroyStatus(status: MountainDestroyStatus | null): void {
		if (!status) {
			this.resourceProgressOverlay.style.display = 'none';
			return;
		}

		if (status.mode === 'pending') {
			this.resourceProgressOverlay.style.display = 'none';
			return;
		}

		const turnsDone = status.totalTurns - status.remainingTurns;
		this.resourceProgressText.textContent = `Mountain destruction at (${status.x}, ${status.y}) - ${status.remainingTurns} turn(s) left`;

		this.resourceProgressFillA.style.width = `${Math.floor(status.progress * 100)}%`;
		this.resourceProgressFillB.style.width = `${Math.floor((turnsDone / status.totalTurns) * 100)}%`;
		this.resourceProgressOverlay.style.display = 'block';
	}

	// ─── Pause / Game Menu ────────────────────────────────────────────────────

	private createPauseMenuOverlay(): {
		overlay: HTMLDivElement;
		tabContent: HTMLDivElement;
	} {
		const overlay = document.createElement('div');
		overlay.style.position = 'fixed';
		overlay.style.inset = '0';
		overlay.style.background = 'rgba(0, 0, 0, 0.82)';
		overlay.style.display = 'none';
		overlay.style.zIndex = '35';

		const panel = document.createElement('div');
		panel.style.position = 'absolute';
		panel.style.left = '50%';
		panel.style.top = '50%';
		panel.style.transform = 'translate(-50%, -50%)';
		panel.style.width = 'min(420px, 94vw)';
		panel.style.background = '#0f0f0f';
		panel.style.border = '2px solid #00ff00';
		panel.style.padding = '16px';
		overlay.appendChild(panel);

		const titleRow = document.createElement('div');
		titleRow.style.display = 'flex';
		titleRow.style.justifyContent = 'space-between';
		titleRow.style.alignItems = 'center';
		titleRow.style.marginBottom = '12px';

		const title = document.createElement('div');
		title.textContent = 'GAME MENU';
		title.style.fontWeight = 'bold';
		title.style.fontSize = '16px';
		titleRow.appendChild(title);

		const closeBtn = document.createElement('button');
		closeBtn.textContent = 'Resume (Esc)';
		closeBtn.addEventListener('click', () => this.hidePauseMenu());
		titleRow.appendChild(closeBtn);
		panel.appendChild(titleRow);

		const tabBar = document.createElement('div');
		tabBar.style.display = 'grid';
		tabBar.style.gridTemplateColumns = 'repeat(2, 1fr)';
		tabBar.style.gap = '6px';
		tabBar.style.marginBottom = '12px';
		panel.appendChild(tabBar);

		const tabContent = document.createElement('div');
		panel.appendChild(tabContent);

		const tabBtns: Record<string, HTMLButtonElement> = {};

		const renderTab = (tab: 'menu' | 'settings') => {
			Object.entries(tabBtns).forEach(([key, btn]) => {
				btn.style.backgroundColor = key === tab ? '#006600' : '#003300';
				btn.style.borderColor = key === tab ? '#aaffaa' : '#00ff00';
			});
			if (tab === 'menu') {
				this.renderPauseMenuMain(tabContent);
			} else {
				this.renderPauseMenuSettings(tabContent);
			}
		};

		const tabDefs: Array<{ key: 'menu' | 'settings'; label: string }> = [
			{ key: 'menu', label: 'Menu' },
			{ key: 'settings', label: 'Settings' },
		];

		tabDefs.forEach(({ key, label }) => {
			const btn = document.createElement('button');
			btn.textContent = label;
			btn.style.width = '100%';
			btn.style.padding = '6px';
			btn.style.margin = '0';
			btn.addEventListener('click', () => renderTab(key));
			tabBtns[key] = btn;
			tabBar.appendChild(btn);
		});

		renderTab('menu');

		// Store renderTab so showPauseMenu() can reset to main tab
		(
			overlay as HTMLDivElement & {
				_renderTab?: (t: 'menu' | 'settings') => void;
			}
		)._renderTab = renderTab;

		overlay.addEventListener('click', (event) => {
			if (event.target === overlay) this.hidePauseMenu();
		});

		document.body.appendChild(overlay);
		return { overlay, tabContent };
	}

	private renderPauseMenuMain(container: HTMLDivElement): void {
		container.innerHTML = '';

		const resumeBtn = document.createElement('button');
		resumeBtn.textContent = 'Resume Game';
		resumeBtn.style.width = '100%';
		resumeBtn.style.padding = '10px';
		resumeBtn.style.marginBottom = '8px';
		resumeBtn.style.fontSize = '14px';
		resumeBtn.addEventListener('click', () => this.hidePauseMenu());
		container.appendChild(resumeBtn);

		const handbookBtn = document.createElement('button');
		handbookBtn.textContent = 'Strategy Handbook (H)';
		handbookBtn.style.width = '100%';
		handbookBtn.style.padding = '8px';
		handbookBtn.style.marginBottom = '16px';
		handbookBtn.addEventListener('click', () => {
			this.hidePauseMenu();
			this.showTutorialMenu();
		});
		container.appendChild(handbookBtn);

		const dangerZone = document.createElement('div');
		dangerZone.style.borderTop = '1px solid #330000';
		dangerZone.style.paddingTop = '12px';

		const dangerLabel = document.createElement('div');
		dangerLabel.textContent = '— DANGER ZONE —';
		dangerLabel.style.color = '#ff4444';
		dangerLabel.style.fontSize = '11px';
		dangerLabel.style.textAlign = 'center';
		dangerLabel.style.letterSpacing = '1px';
		dangerLabel.style.marginBottom = '10px';
		dangerZone.appendChild(dangerLabel);

		const leaveBtn = document.createElement('button');
		leaveBtn.textContent = 'Leave Game';
		leaveBtn.style.width = '100%';
		leaveBtn.style.padding = '8px';
		leaveBtn.style.borderColor = '#ff4444';
		leaveBtn.style.color = '#ff4444';
		leaveBtn.style.backgroundColor = '#1a0000';
		leaveBtn.addEventListener('click', () =>
			this.renderLeaveConfirm(container),
		);
		dangerZone.appendChild(leaveBtn);

		container.appendChild(dangerZone);
	}

	private renderLeaveConfirm(container: HTMLDivElement): void {
		container.innerHTML = '';

		const warning = document.createElement('div');
		warning.style.border = '1px solid #ff4444';
		warning.style.padding = '12px';
		warning.style.marginBottom = '12px';
		warning.style.color = '#ff8888';
		warning.style.lineHeight = '1.6';
		warning.innerHTML =
			`<strong style="color:#ff4444;font-size:14px;">⚠ Leave Game?</strong><br><br>` +
			`Leaving an active game counts as a <strong>forfeit</strong>. ` +
			`In ranked play this will negatively affect your matchmaking score ` +
			`and may result in a temporary queue penalty.<br><br>` +
			`Your current progress will not be saved as a victory.`;
		container.appendChild(warning);

		const confirmBtn = document.createElement('button');
		confirmBtn.textContent = 'Confirm — Forfeit & Leave';
		confirmBtn.style.width = '100%';
		confirmBtn.style.padding = '8px';
		confirmBtn.style.marginBottom = '8px';
		confirmBtn.style.borderColor = '#ff4444';
		confirmBtn.style.color = '#ff4444';
		confirmBtn.style.backgroundColor = '#1a0000';
		confirmBtn.addEventListener('click', () => {
			this.hidePauseMenu();
			if (this.onLeaveGame) this.onLeaveGame();
		});
		container.appendChild(confirmBtn);

		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = 'Cancel — Keep Playing';
		cancelBtn.style.width = '100%';
		cancelBtn.style.padding = '8px';
		cancelBtn.addEventListener('click', () =>
			this.renderPauseMenuMain(container),
		);
		container.appendChild(cancelBtn);
	}

	private renderPauseMenuSettings(container: HTMLDivElement): void {
		container.innerHTML = '';

		const makeSectionHeader = (text: string): HTMLDivElement => {
			const d = document.createElement('div');
			d.textContent = text;
			d.style.color = '#aaffaa';
			d.style.fontSize = '11px';
			d.style.fontWeight = 'bold';
			d.style.letterSpacing = '1px';
			d.style.marginTop = '12px';
			d.style.marginBottom = '6px';
			d.style.borderBottom = '1px solid #005500';
			d.style.paddingBottom = '2px';
			return d;
		};

		const makeRow = (label: string, control: HTMLElement): HTMLDivElement => {
			const row = document.createElement('div');
			row.style.display = 'flex';
			row.style.justifyContent = 'space-between';
			row.style.alignItems = 'center';
			row.style.marginBottom = '8px';
			const labelEl = document.createElement('div');
			labelEl.textContent = label;
			row.appendChild(labelEl);
			row.appendChild(control);
			return row;
		};

		const makeToggle = (
			value: boolean,
			onChange: (v: boolean) => void,
		): HTMLButtonElement => {
			const btn = document.createElement('button');
			const update = (v: boolean) => {
				btn.textContent = v ? 'ON' : 'OFF';
				btn.style.backgroundColor = v ? '#006600' : '#330000';
				btn.style.borderColor = v ? '#aaffaa' : '#aa0000';
				btn.style.color = v ? '#aaffaa' : '#ff8888';
				btn.style.minWidth = '50px';
				btn.style.padding = '3px 8px';
			};
			let current = value;
			update(current);
			btn.addEventListener('click', () => {
				current = !current;
				update(current);
				onChange(current);
			});
			return btn;
		};

		const makeSlider = (
			value: number,
			onChange: (v: number) => void,
		): HTMLDivElement => {
			const wrapper = document.createElement('div');
			wrapper.style.display = 'flex';
			wrapper.style.alignItems = 'center';
			wrapper.style.gap = '8px';

			const input = document.createElement('input');
			input.type = 'range';
			input.min = '0';
			input.max = '100';
			input.value = String(value);
			input.style.width = '110px';
			input.style.accentColor = '#00ff00';

			const valueLabel = document.createElement('div');
			valueLabel.textContent = `${value}%`;
			valueLabel.style.minWidth = '36px';
			valueLabel.style.textAlign = 'right';

			input.addEventListener('input', () => {
				const v = parseInt(input.value, 10);
				valueLabel.textContent = `${v}%`;
				onChange(v);
			});

			wrapper.appendChild(input);
			wrapper.appendChild(valueLabel);
			return wrapper;
		};

		// ── Audio ────────────────────────────────────────────────────────────
		container.appendChild(makeSectionHeader('AUDIO'));

		container.appendChild(
			makeRow(
				'Master Volume',
				makeSlider(this.settings.masterVolume, (v) => {
					this.settings.masterVolume = v;
					this.saveSettings();
					this.onSettingsChange?.(this.getSettings());
				}),
			),
		);

		container.appendChild(
			makeRow(
				'Sound Effects',
				makeToggle(this.settings.sfxEnabled, (v) => {
					this.settings.sfxEnabled = v;
					this.saveSettings();
					this.onSettingsChange?.(this.getSettings());
				}),
			),
		);

		// ── Display ──────────────────────────────────────────────────────────
		container.appendChild(makeSectionHeader('DISPLAY'));

		container.appendChild(
			makeRow(
				'Show Grid Lines',
				makeToggle(this.settings.showGrid, (v) => {
					this.settings.showGrid = v;
					this.saveSettings();
					this.onSettingsChange?.(this.getSettings());
				}),
			),
		);

		container.appendChild(
			makeRow(
				'Show FPS Counter',
				makeToggle(this.settings.showFPS, (v) => {
					this.settings.showFPS = v;
					this.saveSettings();
					this.onSettingsChange?.(this.getSettings());
				}),
			),
		);

		// ── Gameplay ─────────────────────────────────────────────────────────
		container.appendChild(makeSectionHeader('GAMEPLAY'));

		container.appendChild(
			makeRow(
				'Confirm End Turn',
				makeToggle(this.settings.confirmEndTurn, (v) => {
					this.settings.confirmEndTurn = v;
					this.saveSettings();
					this.onSettingsChange?.(this.getSettings());
				}),
			),
		);
	}

	showPauseMenu(): void {
		this.pauseMenuOverlay.style.display = 'block';
		const typed = this.pauseMenuOverlay as HTMLDivElement & {
			_renderTab?: (t: 'menu' | 'settings') => void;
		};
		typed._renderTab?.('menu');
	}

	hidePauseMenu(): void {
		this.pauseMenuOverlay.style.display = 'none';
	}

	isPauseMenuOpen(): boolean {
		return this.pauseMenuOverlay.style.display !== 'none';
	}

	getSettings(): GameSettings {
		return { ...this.settings };
	}

	private loadSettings(): GameSettings {
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (raw) {
				return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
			}
		} catch {
			// ignore malformed data
		}
		return { ...DEFAULT_SETTINGS };
	}

	private saveSettings(): void {
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
		} catch {
			// ignore quota errors
		}
	}
}
