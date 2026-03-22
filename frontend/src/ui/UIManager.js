/**
 * UI System
 * Manages UI panels, resources display, and event log
 */
const SETTINGS_KEY = 'civ.settings';
const DEFAULT_SETTINGS = {
    masterVolume: 70,
    sfxEnabled: true,
    showGrid: true,
    showFPS: false,
    confirmEndTurn: false,
};
export class UIPanel {
    constructor(elementId) {
        const element = document.getElementById(elementId);
        if (!element) {
            throw new Error(`UI element with id '${elementId}' not found`);
        }
        this.container = element;
    }
    /**
     * Update panel content
     */
    setContent(content) {
        const contentElement = this.container.querySelector('.panel-content');
        if (contentElement) {
            contentElement.textContent = content;
        }
    }
    /**
     * Clear panel content
     */
    clear() {
        this.setContent('');
    }
    getContainer() {
        return this.container;
    }
}
export class UIManager {
    constructor() {
        this.rightPanelTabButtons = new Map();
        this.rightPanelActiveTab = 'overview';
        this.rightPanelPlayer = null;
        this.eventLog = [];
        this.maxLogEntries = 50;
        this.lastEventMessage = null;
        this.lastEventAt = 0;
        this.lastEventRepeatCount = 0;
        this.cityOverlayOnClose = null;
        this.tutorialActiveTab = 'basics';
        this.turnInfoText = 'Turn: 0';
        this.aiRumorLines = [];
        this.aiIntelFeed = [];
        this.controlsText = 'CONTROLS\n- End Turn: Space / Enter\n- Select/Move: Left Click\n- Camera: WASD / Arrows\n- Game Menu: Esc\n- Handbook: H\n- Focus Selected: F';
        this.settings = { ...DEFAULT_SETTINGS };
        this.onLeaveGame = null;
        this.onSettingsChange = null;
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
    setupRightPanelTabs() {
        const rightPanelContainer = this.rightPanel.getContainer();
        const endTurnBtn = document.getElementById('end-turn-btn');
        const tabsContainer = document.createElement('div');
        tabsContainer.style.display = 'flex';
        tabsContainer.style.gap = '4px';
        tabsContainer.style.marginBottom = '8px';
        const tabDefs = [
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
        }
        else {
            rightPanelContainer.appendChild(tabsContainer);
        }
        this.refreshRightPanelTabStyles();
    }
    refreshRightPanelTabStyles() {
        this.rightPanelTabButtons.forEach((btn, key) => {
            if (key === this.rightPanelActiveTab) {
                btn.style.backgroundColor = '#006600';
                btn.style.borderColor = '#aaffaa';
            }
            else {
                btn.style.backgroundColor = '#003300';
                btn.style.borderColor = '#00ff00';
            }
        });
    }
    renderRightPanelContent() {
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
        }
        else if (this.rightPanelActiveTab === 'turn') {
            content = this.turnInfoText;
        }
        else {
            content = this.controlsText;
        }
        this.rightPanelContent.textContent = content;
    }
    createCityOverlay() {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.left = '50%';
        overlay.style.top = '50%';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.background = '#111111';
        overlay.style.border = '2px solid #00ff00';
        overlay.style.width = 'min(980px, 92vw)';
        overlay.style.height = 'min(860px, 82vh)';
        overlay.style.display = 'none';
        overlay.style.flexDirection = 'column';
        overlay.style.overflow = 'hidden';
        overlay.style.boxShadow = '0 18px 42px rgba(0, 0, 0, 0.52)';
        overlay.style.display = 'none';
        overlay.style.zIndex = '25';
        const dragHandle = document.createElement('div');
        dragHandle.style.display = 'flex';
        dragHandle.style.alignItems = 'center';
        dragHandle.style.justifyContent = 'space-between';
        dragHandle.style.padding = '10px 12px';
        dragHandle.style.background = 'linear-gradient(180deg, #14331f, #0d2517)';
        dragHandle.style.borderBottom = '1px solid #00aa66';
        dragHandle.style.cursor = 'grab';
        dragHandle.style.userSelect = 'none';
        const dragTitle = document.createElement('div');
        dragTitle.textContent = 'City Management';
        dragTitle.style.fontWeight = 'bold';
        dragTitle.style.letterSpacing = '0.3px';
        dragHandle.appendChild(dragTitle);
        const dragActions = document.createElement('div');
        dragActions.style.display = 'flex';
        dragActions.style.alignItems = 'center';
        dragActions.style.gap = '8px';
        dragHandle.appendChild(dragActions);
        const dragHint = document.createElement('div');
        dragHint.textContent = 'Drag to move';
        dragHint.style.opacity = '0.8';
        dragHint.style.fontSize = '11px';
        dragActions.appendChild(dragHint);
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'X';
        closeBtn.title = 'Close city management';
        closeBtn.setAttribute('aria-label', 'Close city management panel');
        closeBtn.style.width = '28px';
        closeBtn.style.height = '28px';
        closeBtn.style.padding = '0';
        closeBtn.style.lineHeight = '1';
        closeBtn.style.fontWeight = 'bold';
        closeBtn.style.cursor = 'pointer';
        closeBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.hideCityManagement(true);
        });
        dragActions.appendChild(closeBtn);
        overlay.appendChild(dragHandle);
        const content = document.createElement('div');
        content.style.flex = '1';
        content.style.overflowY = 'auto';
        content.style.padding = '12px';
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        this.makeOverlayDraggable(overlay, dragHandle);
        return { overlay, content, dragHandle };
    }
    makeOverlayDraggable(overlay, handle) {
        let dragging = false;
        let pointerId = -1;
        let startX = 0;
        let startY = 0;
        let originLeft = 0;
        let originTop = 0;
        const clamp = (value, min, max) => {
            return Math.max(min, Math.min(max, value));
        };
        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0)
                return;
            const rect = overlay.getBoundingClientRect();
            overlay.style.left = `${rect.left}px`;
            overlay.style.top = `${rect.top}px`;
            overlay.style.transform = 'none';
            dragging = true;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            originLeft = rect.left;
            originTop = rect.top;
            handle.style.cursor = 'grabbing';
            handle.setPointerCapture(pointerId);
            event.preventDefault();
        });
        handle.addEventListener('pointermove', (event) => {
            if (!dragging || event.pointerId !== pointerId)
                return;
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            const maxLeft = Math.max(0, window.innerWidth - overlay.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - overlay.offsetHeight);
            const nextLeft = clamp(originLeft + deltaX, 0, maxLeft);
            const nextTop = clamp(originTop + deltaY, 0, maxTop);
            overlay.style.left = `${nextLeft}px`;
            overlay.style.top = `${nextTop}px`;
        });
        const endDrag = (event) => {
            if (!dragging || event.pointerId !== pointerId)
                return;
            dragging = false;
            handle.style.cursor = 'grab';
            handle.releasePointerCapture(pointerId);
            pointerId = -1;
        };
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
    }
    createResourceOverlays() {
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
    createTutorialOverlay() {
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
        tabRow.style.gridTemplateColumns = 'repeat(6, minmax(0, 1fr))';
        tabRow.style.gap = '6px';
        tabRow.style.marginBottom = '10px';
        const tabs = [
            { key: 'basics', label: 'Basics' },
            { key: 'map', label: 'Map & Cells' },
            { key: 'turns', label: 'Turns & Actions' },
            { key: 'economy', label: 'Economy' },
            { key: 'upgrades', label: 'Upgrades' },
            { key: 'perfectRun', label: 'Perfect Run' },
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
    renderTutorialContent() {
        const tabContent = {
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
            perfectRun: `<div style="margin-bottom:8px;"><strong>Perfect Run Blueprint</strong><br>Use this as a full reference before and during matches. It covers start, growth, warfare, defense, and endgame outcomes.</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:8px;">
<div style="border:1px solid #00aa00;padding:8px;"><strong>1) Start the game correctly (Turns 1-3)</strong><br>- Select a profile on the landing screen and press <strong>Start Game</strong>.<br>- Settle your first city quickly with your Settler.<br>- Scout nearby tiles with Warrior/Worker to reveal resource nodes and chokepoints.<br>- Prioritize safe expansion lanes before rivals claim them.</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>2) Maintain and grow your civilization (Early-Mid)</strong><br>- Keep passive economy stable: food for growth, production for tempo, gold for purchases.<br>- Use idle gathering for steady income, then active gathering for timed spikes.<br>- Open city management often and keep a consistent upgrade pipeline.<br>- Expand with additional cities when your core can still defend itself.</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>3) How to attack effectively</strong><br>- Attack only after a power spike (new combat upgrade, fresh units, or movement advantage).<br>- Focus one target city/unit group at a time instead of splitting damage.<br>- Use terrain and vision to approach from favorable angles.<br>- Convert economic lead into military pressure before opponents catch up.</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>4) How to defend from other civilizations</strong><br>- Keep a standing force near borders and your highest-value cities.<br>- Build defensive tech/buildings early enough to survive sudden rushes.<br>- Protect workers and gatherers; losing economy units slows your whole game plan.<br>- Fall back to defensible lines, then counterattack after enemy momentum stalls.</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>5) How to win</strong><br>- Outscale rivals with stronger economy and upgrade timing.<br>- Keep production cycling so armies and infrastructure both progress.<br>- Win decisive fights around objectives, then press your advantage without overextending.<br>- Maintain map control and deny key resource zones to opponents.</div>
<div style="border:1px solid #00aa00;padding:8px;"><strong>6) How to lose (common mistakes)</strong><br>- Delaying first city setup and falling behind on economy.<br>- Overspending on one resource path while ignoring balance.<br>- Fighting too early without upgrades, or too late after rivals spike.<br>- Leaving cities undefended and losing units to poor positioning.</div>
</div>
<div style="margin-top:8px;border:1px solid #00aa00;padding:8px;"><strong>Checklist before ending each turn</strong><br>1) Spend available resources efficiently. 2) Move units to useful positions. 3) Confirm city upgrades are queued. 4) Check border safety. 5) End turn only when tempo is maintained.</div>`,
        };
        this.tutorialContent.innerHTML =
            tabContent[this.tutorialActiveTab] || tabContent.basics;
        const tabButtons = this.tutorialPanel.querySelectorAll('button[data-tutorial-tab]');
        tabButtons.forEach((button) => {
            const btn = button;
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
    updateSelectedInfo(entity) {
        if (!entity) {
            this.leftPanel.setContent('None selected');
            return;
        }
        if ('type' in entity) {
            // It's a unit
            const unit = entity;
            const info = `UNIT
Type: ${unit.type}
Health: ${unit.health}/${unit.maxHealth}
Movement: ${unit.movementPoints}/${unit.maxMovementPoints}
Attack: ${unit.attack}
Defense: ${unit.defense}
Position: (${unit.x}, ${unit.y})
Automated: ${unit.automated ? 'Yes' : 'No'}`;
            this.leftPanel.setContent(info);
        }
        else {
            // It's a city
            const city = entity;
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
    updateResources(player) {
        this.rightPanelPlayer = player;
        this.renderRightPanelContent();
    }
    updateTurnOrder(turn, players, currentIndex) {
        const lines = [];
        for (let offset = 0; offset < players.length; offset++) {
            const idx = (currentIndex + offset) % players.length;
            const player = players[idx];
            const prefix = offset === 0 ? 'NOW'
                : offset === 1 ? 'NEXT'
                    : `+${offset}`;
            lines.push(`${prefix}: ${player.name}${player.isAI ? ' [AI]' : ' [HUMAN]'}`);
        }
        const rumors = this.aiRumorLines.length > 0 ?
            this.aiRumorLines.join('\n')
            : 'No reliable reports yet.';
        const intel = this.aiIntelFeed.length > 0 ?
            this.aiIntelFeed.join('\n')
            : 'No enemy activity reports yet.';
        this.turnInfoText = `TURN\nNumber: ${turn}\nPlayers: ${players.length}\nOrder:\n${lines.join('\n')}\n\nRUMORED SETTLEMENT FRONTS\n${rumors}\n\nENEMY ACTIVITY FEED\n${intel}`;
        this.renderRightPanelContent();
    }
    setAIRumorLines(lines) {
        this.aiRumorLines = lines.slice(0, 5);
        this.renderRightPanelContent();
    }
    pushAITurnIntel(message) {
        this.aiIntelFeed.push(`- ${message}`);
        if (this.aiIntelFeed.length > 6) {
            this.aiIntelFeed.shift();
        }
        this.renderRightPanelContent();
    }
    /**
     * Add event to log
     */
    addEvent(message) {
        const now = Date.now();
        const timestamp = new Date().toLocaleTimeString();
        if (this.lastEventMessage === message &&
            now - this.lastEventAt < 1600 &&
            this.eventLog.length > 0) {
            this.lastEventRepeatCount += 1;
            this.eventLog[this.eventLog.length - 1] =
                `[${timestamp}] ${message} (x${this.lastEventRepeatCount})`;
        }
        else {
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
    updateEventLog() {
        this.bottomPanel.setContent(this.eventLog.join('\n'));
        // Auto-scroll to bottom
        const container = this.bottomPanel.getContainer();
        container.scrollTop = container.scrollHeight;
    }
    /**
     * Clear event log
     */
    clearEventLog() {
        this.eventLog = [];
        this.updateEventLog();
    }
    /**
     * Toggle panel visibility
     */
    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }
    /**
     * Show game over screen
     */
    showGameOver(winner) {
        const message = winner ? `Game Over! Winner: ${winner.name}` : 'Game Over!';
        alert(message);
    }
    /**
     * Update turn indicator
     */
    updateTurn(turn, currentPlayer) {
        this.addEvent(`Turn ${turn}: ${currentPlayer.name}'s turn${currentPlayer.isAI ? ' (AI)' : ''}`);
    }
    createPromptButton(label, onClick) {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.width = '100%';
        button.addEventListener('click', () => {
            this.resourcePromptOverlay.style.display = 'none';
            onClick();
        });
        return button;
    }
    showChoicePrompt(message, buttons) {
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
    showResourceChoice(status, onActive, onIdle, onIgnore) {
        this.showChoicePrompt(`Resource found: ${status.type.toUpperCase()} at (${status.x}, ${status.y}). Choose how to gather.`, [
            { label: 'Active Gather', onClick: onActive },
            { label: 'Idle Gather', onClick: onIdle },
            { label: 'Ignore', onClick: onIgnore },
        ]);
    }
    showMountainDestroyChoice(status, onDestroy, onIgnore) {
        this.showChoicePrompt(`Mountain at (${status.x}, ${status.y}). Choose action for your settler.`, [
            {
                label: `Destroy (${status.totalTurns} turns)`,
                onClick: onDestroy,
            },
            { label: 'Ignore', onClick: onIgnore },
        ]);
    }
    hideResourceChoice() {
        this.resourcePromptOverlay.style.display = 'none';
    }
    hideMountainDestroyChoice() {
        this.resourcePromptOverlay.style.display = 'none';
    }
    showCityManagement(data, onSelect, onClose) {
        this.cityOverlayOnClose = onClose;
        this.cityOverlay.style.left = '50%';
        this.cityOverlay.style.top = '50%';
        this.cityOverlay.style.transform = 'translate(-50%, -50%)';
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
        const grouped = {
            military: [],
            improvements: [],
            civil: [],
        };
        data.options.forEach((option) => {
            grouped[option.category].push(option);
        });
        const sectionOrder = [
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
        const tabButtons = [];
        const renderTab = (categoryKey) => {
            tabContent.innerHTML = '';
            const options = grouped[categoryKey] || [];
            if (options.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'No options in this tab yet.';
                empty.style.marginBottom = '10px';
                tabContent.appendChild(empty);
                return;
            }
            const webWrap = document.createElement('div');
            webWrap.style.position = 'relative';
            webWrap.style.minHeight = '660px';
            webWrap.style.border = '1px solid #00aa00';
            webWrap.style.background =
                'radial-gradient(circle at center, rgba(0, 255, 136, 0.08), rgba(0, 0, 0, 0.22) 55%, rgba(0, 0, 0, 0.45) 100%)';
            webWrap.style.overflow = 'hidden';
            webWrap.style.minWidth = '0';
            const skillLayout = document.createElement('div');
            skillLayout.style.display = 'grid';
            skillLayout.style.gridTemplateColumns =
                'minmax(0, 1.7fr) minmax(280px, 0.9fr)';
            skillLayout.style.gap = '12px';
            skillLayout.style.alignItems = 'stretch';
            skillLayout.style.marginBottom = '10px';
            const webViewport = document.createElement('div');
            webViewport.style.position = 'absolute';
            webViewport.style.left = '0';
            webViewport.style.top = '0';
            webViewport.style.width = '100%';
            webViewport.style.height = '100%';
            webViewport.style.cursor = 'grab';
            webViewport.style.touchAction = 'none';
            webWrap.appendChild(webViewport);
            const webWorld = document.createElement('div');
            webWorld.style.position = 'absolute';
            webWorld.style.left = '0';
            webWorld.style.top = '0';
            webWorld.style.width = '100%';
            webWorld.style.height = '100%';
            webWorld.style.transformOrigin = '50% 50%';
            webViewport.appendChild(webWorld);
            const linkLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            linkLayer.setAttribute('viewBox', '0 0 1000 1000');
            linkLayer.setAttribute('preserveAspectRatio', 'none');
            linkLayer.style.position = 'absolute';
            linkLayer.style.left = '0';
            linkLayer.style.top = '0';
            linkLayer.style.width = '100%';
            linkLayer.style.height = '100%';
            webWorld.appendChild(linkLayer);
            const nodeLayer = document.createElement('div');
            nodeLayer.style.position = 'absolute';
            nodeLayer.style.left = '0';
            nodeLayer.style.top = '0';
            nodeLayer.style.width = '100%';
            nodeLayer.style.height = '100%';
            webWorld.appendChild(nodeLayer);
            const graphControls = document.createElement('div');
            graphControls.style.position = 'absolute';
            graphControls.style.top = '8px';
            graphControls.style.right = '8px';
            graphControls.style.display = 'flex';
            graphControls.style.alignItems = 'center';
            graphControls.style.gap = '6px';
            graphControls.style.padding = '6px 8px';
            graphControls.style.border = '1px solid #00aa66';
            graphControls.style.background = 'rgba(8, 22, 14, 0.86)';
            graphControls.style.zIndex = '2';
            webWrap.appendChild(graphControls);
            const zoomOutBtn = document.createElement('button');
            zoomOutBtn.textContent = '-';
            zoomOutBtn.style.width = '28px';
            zoomOutBtn.style.padding = '2px 0';
            graphControls.appendChild(zoomOutBtn);
            const zoomInBtn = document.createElement('button');
            zoomInBtn.textContent = '+';
            zoomInBtn.style.width = '28px';
            zoomInBtn.style.padding = '2px 0';
            graphControls.appendChild(zoomInBtn);
            const zoomResetBtn = document.createElement('button');
            zoomResetBtn.textContent = 'Reset';
            zoomResetBtn.style.padding = '2px 6px';
            graphControls.appendChild(zoomResetBtn);
            const zoomLabel = document.createElement('span');
            zoomLabel.style.fontSize = '11px';
            zoomLabel.style.minWidth = '52px';
            graphControls.appendChild(zoomLabel);
            const center = { x: 50, y: 50 };
            const optionById = new Map(options.map((opt) => [opt.id, opt]));
            const nodePos = new Map();
            const ringGroups = new Map();
            const getInternalDeps = (option) => {
                return option.prerequisiteIds.filter((depId) => optionById.has(depId));
            };
            const depthCache = new Map();
            const getDepth = (optionId) => {
                const cached = depthCache.get(optionId);
                if (cached !== undefined) {
                    return cached;
                }
                const option = optionById.get(optionId);
                if (!option) {
                    return 0;
                }
                const deps = getInternalDeps(option);
                const depth = deps.length === 0 ?
                    0
                    : Math.max(...deps.map((depId) => getDepth(depId))) + 1;
                depthCache.set(optionId, depth);
                return depth;
            };
            options.forEach((option) => {
                const depth = getDepth(option.id);
                const ring = ringGroups.get(depth) || [];
                ring.push(option);
                ringGroups.set(depth, ring);
            });
            const maxDepth = Math.max(...Array.from(ringGroups.keys()), 0);
            const outerRadius = 43;
            const innerRadius = 14;
            const ringStep = maxDepth === 0 ? 0 : (outerRadius - innerRadius) / maxDepth;
            const hub = document.createElement('div');
            hub.textContent = 'CITY CORE';
            hub.style.position = 'absolute';
            hub.style.left = `${center.x}%`;
            hub.style.top = `${center.y}%`;
            hub.style.transform = 'translate(-50%, -50%)';
            hub.style.width = '86px';
            hub.style.height = '86px';
            hub.style.display = 'flex';
            hub.style.alignItems = 'center';
            hub.style.justifyContent = 'center';
            hub.style.textAlign = 'center';
            hub.style.borderRadius = '50%';
            hub.style.border = '2px solid #d9ffb1';
            hub.style.background =
                'radial-gradient(circle at 35% 35%, rgba(236, 255, 178, 0.46), rgba(20, 80, 44, 0.92) 55%, rgba(5, 12, 8, 0.96) 100%)';
            hub.style.fontSize = '11px';
            hub.style.fontWeight = 'bold';
            hub.style.boxShadow =
                '0 0 0 2px rgba(217, 255, 177, 0.16), 0 0 24px rgba(208, 255, 164, 0.28)';
            nodeLayer.appendChild(hub);
            let zoom = 1;
            let panX = 0;
            let panY = 0;
            let dragging = false;
            let dragStartX = 0;
            let dragStartY = 0;
            const clamp = (value, min, max) => {
                return Math.max(min, Math.min(max, value));
            };
            const clampPan = () => {
                const viewportRect = webViewport.getBoundingClientRect();
                const overflowX = Math.max(0, (viewportRect.width * zoom - viewportRect.width) / 2);
                const overflowY = Math.max(0, (viewportRect.height * zoom - viewportRect.height) / 2);
                panX = clamp(panX, -overflowX, overflowX);
                panY = clamp(panY, -overflowY, overflowY);
            };
            const updateGraphTransform = () => {
                clampPan();
                webWorld.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
                zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
            };
            const setZoom = (nextZoom) => {
                zoom = clamp(nextZoom, 0.55, 2.1);
                updateGraphTransform();
            };
            zoomOutBtn.addEventListener('click', () => setZoom(zoom - 0.12));
            zoomInBtn.addEventListener('click', () => setZoom(zoom + 0.12));
            zoomResetBtn.addEventListener('click', () => {
                zoom = 1;
                panX = 0;
                panY = 0;
                updateGraphTransform();
            });
            webViewport.addEventListener('wheel', (event) => {
                event.preventDefault();
                const direction = event.deltaY < 0 ? 1 : -1;
                setZoom(zoom + direction * 0.08);
            }, { passive: false });
            webViewport.addEventListener('pointerdown', (event) => {
                if (event.button !== 0)
                    return;
                const target = event.target;
                if (target.closest('button'))
                    return;
                dragging = true;
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                webViewport.style.cursor = 'grabbing';
                webViewport.setPointerCapture(event.pointerId);
            });
            webViewport.addEventListener('pointermove', (event) => {
                if (!dragging)
                    return;
                const deltaX = event.clientX - dragStartX;
                const deltaY = event.clientY - dragStartY;
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                panX += deltaX;
                panY += deltaY;
                updateGraphTransform();
            });
            const endGraphDrag = (event) => {
                if (!dragging)
                    return;
                dragging = false;
                webViewport.style.cursor = 'grab';
                webViewport.releasePointerCapture(event.pointerId);
            };
            webViewport.addEventListener('pointerup', endGraphDrag);
            webViewport.addEventListener('pointercancel', endGraphDrag);
            window.addEventListener('resize', updateGraphTransform);
            updateGraphTransform();
            Array.from(ringGroups.entries())
                .sort(([depthA], [depthB]) => depthA - depthB)
                .forEach(([depth, ringOptions]) => {
                const radius = innerRadius + ringStep * depth;
                ringOptions
                    .slice()
                    .sort((left, right) => left.name.localeCompare(right.name))
                    .forEach((option, idx) => {
                    const angle = (Math.PI * 2 * idx) / Math.max(1, ringOptions.length) -
                        Math.PI / 2 +
                        depth * 0.16;
                    const x = center.x + Math.cos(angle) * radius;
                    const y = center.y + Math.sin(angle) * radius;
                    nodePos.set(option.id, { x, y });
                });
            });
            const drawLink = (from, to, locked) => {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', `${from.x}%`);
                line.setAttribute('y1', `${from.y}%`);
                line.setAttribute('x2', `${to.x}%`);
                line.setAttribute('y2', `${to.y}%`);
                line.setAttribute('stroke', locked ? '#446655' : '#2de093');
                line.setAttribute('stroke-width', locked ? '1.2' : '1.8');
                line.setAttribute('stroke-opacity', locked ? '0.45' : '0.78');
                if (locked) {
                    line.setAttribute('stroke-dasharray', '6 4');
                }
                linkLayer.appendChild(line);
            };
            options.forEach((option) => {
                const to = nodePos.get(option.id);
                if (!to)
                    return;
                const deps = getInternalDeps(option);
                if (deps.length === 0) {
                    drawLink(center, to, option.lockedByPrerequisite);
                    return;
                }
                deps.forEach((depId) => {
                    const from = nodePos.get(depId);
                    if (from) {
                        drawLink(from, to, option.lockedByPrerequisite);
                    }
                });
            });
            const detailPanel = document.createElement('div');
            detailPanel.style.border = '1px solid #00aa66';
            detailPanel.style.background =
                'linear-gradient(180deg, rgba(16, 22, 18, 0.98), rgba(6, 13, 10, 0.98))';
            detailPanel.style.padding = '14px';
            detailPanel.style.minHeight = '660px';
            detailPanel.style.boxShadow = 'inset 0 0 18px rgba(255, 231, 164, 0.06)';
            detailPanel.style.display = 'flex';
            detailPanel.style.flexDirection = 'column';
            detailPanel.style.gap = '10px';
            const nodeButtons = new Map();
            let selectedOptionId = options.find((option) => !option.lockedByPrerequisite)?.id ||
                options[0]?.id ||
                '';
            const dependentCounts = new Map();
            options.forEach((option) => {
                getInternalDeps(option).forEach((depId) => {
                    dependentCounts.set(depId, (dependentCounts.get(depId) || 0) + 1);
                });
            });
            const getOptionStatus = (option) => {
                if (option.owned) {
                    return { text: 'Completed', color: '#aaffaa' };
                }
                if (option.lockedByPrerequisite) {
                    return { text: 'Requires prerequisite unlocks', color: '#88aa99' };
                }
                if (!option.canAfford) {
                    return { text: 'Insufficient resources', color: '#ffcc66' };
                }
                return { text: 'Ready to unlock', color: '#8feebb' };
            };
            const getNodeGlyph = (option) => {
                const words = option.name.split(/\s+/).filter(Boolean);
                if (words.length === 1) {
                    return words[0].slice(0, 2).toUpperCase();
                }
                return words
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join('')
                    .toUpperCase();
            };
            const updateNodeSelectionStyles = () => {
                nodeButtons.forEach((button, optionId) => {
                    const option = optionById.get(optionId);
                    if (!option)
                        return;
                    const isSelected = optionId === selectedOptionId;
                    button.style.borderColor =
                        isSelected ? '#ffe894'
                            : option.owned ? '#9bffbc'
                                : option.lockedByPrerequisite ? '#55645e'
                                    : !option.canAfford ? '#c99a58'
                                        : '#5bcf8d';
                    button.style.boxShadow =
                        isSelected ?
                            '0 0 0 3px rgba(255, 232, 148, 0.2), 0 0 22px rgba(255, 232, 148, 0.28)'
                            : option.owned ? '0 0 14px rgba(155, 255, 188, 0.2)'
                                : '0 0 8px rgba(0, 255, 136, 0.18)';
                    button.style.transform =
                        isSelected ?
                            'translate(-50%, -50%) scale(1.12)'
                            : 'translate(-50%, -50%) scale(1)';
                });
            };
            const renderDetails = () => {
                const option = optionById.get(selectedOptionId);
                if (!option) {
                    detailPanel.textContent = 'Select a node to inspect it.';
                    return;
                }
                detailPanel.innerHTML = '';
                const status = getOptionStatus(option);
                const panelCaption = document.createElement('div');
                panelCaption.textContent = 'Selected Skill';
                panelCaption.style.fontSize = '11px';
                panelCaption.style.textTransform = 'uppercase';
                panelCaption.style.letterSpacing = '1.2px';
                panelCaption.style.opacity = '0.68';
                detailPanel.appendChild(panelCaption);
                const headerRow = document.createElement('div');
                headerRow.style.display = 'flex';
                headerRow.style.justifyContent = 'space-between';
                headerRow.style.alignItems = 'center';
                headerRow.style.gap = '10px';
                headerRow.style.marginBottom = '8px';
                detailPanel.appendChild(headerRow);
                const title = document.createElement('div');
                title.style.fontWeight = 'bold';
                title.style.fontSize = '16px';
                title.textContent = option.name;
                headerRow.appendChild(title);
                const statusBadge = document.createElement('div');
                statusBadge.textContent = status.text;
                statusBadge.style.color = status.color;
                statusBadge.style.fontSize = '11px';
                statusBadge.style.border = `1px solid ${status.color}`;
                statusBadge.style.padding = '4px 6px';
                statusBadge.style.background = 'rgba(0, 0, 0, 0.24)';
                statusBadge.style.borderRadius = '999px';
                headerRow.appendChild(statusBadge);
                const meta = document.createElement('div');
                meta.style.fontSize = '11px';
                meta.style.opacity = '0.85';
                meta.style.marginBottom = '10px';
                meta.textContent = `${option.kind.toUpperCase()} • ${option.category.toUpperCase()}`;
                detailPanel.appendChild(meta);
                const description = document.createElement('div');
                description.style.lineHeight = '1.45';
                description.style.marginBottom = '10px';
                description.textContent = option.description;
                detailPanel.appendChild(description);
                const costRow = document.createElement('div');
                costRow.style.fontSize = '11px';
                costRow.style.marginBottom = '8px';
                costRow.textContent = `Cost: Gold ${option.cost.gold} • Food ${option.cost.food} • Production ${option.cost.production}`;
                detailPanel.appendChild(costRow);
                const prereqNames = option.prerequisiteIds.length ?
                    option.prerequisiteIds.map((prereqId) => optionById.get(prereqId)?.name || prereqId)
                    : ['City Core'];
                const prereqRow = document.createElement('div');
                prereqRow.style.fontSize = '11px';
                prereqRow.style.marginBottom = '8px';
                prereqRow.textContent = `Prerequisites: ${prereqNames.join(', ')}`;
                detailPanel.appendChild(prereqRow);
                const impactRow = document.createElement('div');
                impactRow.style.fontSize = '11px';
                impactRow.style.opacity = '0.88';
                impactRow.style.marginBottom = '10px';
                impactRow.textContent = `Impact: ${option.description}`;
                detailPanel.appendChild(impactRow);
                const nodeHint = document.createElement('div');
                nodeHint.style.marginTop = '12px';
                nodeHint.style.fontSize = '10px';
                nodeHint.style.opacity = '0.65';
                nodeHint.textContent =
                    'Path view: orbit nodes unlock from the City Core outward. Select any node in the constellation to inspect it here.';
                detailPanel.appendChild(nodeHint);
                if (!option.owned) {
                    const actionBtn = document.createElement('button');
                    actionBtn.textContent = `Unlock ${option.kind}`;
                    actionBtn.style.padding = '6px 10px';
                    actionBtn.disabled = option.lockedByPrerequisite || !option.canAfford;
                    actionBtn.addEventListener('click', () => onSelect(option.id));
                    detailPanel.appendChild(actionBtn);
                }
            };
            options.forEach((option) => {
                const pos = nodePos.get(option.id);
                if (!pos)
                    return;
                // Count how many other nodes depend on this one to determine node prominence
                const dependentCount = dependentCounts.get(option.id) || 0;
                // Scale nodes by importance: 54px for hub nodes (3+ dependents), 46px for branch nodes (1-2 dependents), 38px for leaf nodes
                const nodeSize = dependentCount >= 3 ? 54
                    : dependentCount >= 1 ? 46
                        : 38;
                const node = document.createElement('button');
                node.type = 'button';
                node.title = option.name;
                node.style.position = 'absolute';
                node.style.left = `${pos.x}%`;
                node.style.top = `${pos.y}%`;
                node.style.transform = 'translate(-50%, -50%)';
                node.style.width = `${nodeSize}px`;
                node.style.height = `${nodeSize}px`;
                node.style.padding = '0';
                node.style.display = 'flex';
                node.style.alignItems = 'center';
                node.style.justifyContent = 'center';
                node.style.fontSize = dependentCount >= 3 ? '12px' : '10px';
                node.style.fontWeight = 'bold';
                node.style.letterSpacing = '0.6px';
                node.style.border = '2px solid #5bcf8d';
                node.style.borderRadius = '50%';
                node.style.background =
                    'radial-gradient(circle at 35% 35%, rgba(166, 255, 210, 0.36), rgba(15, 42, 28, 0.95) 55%, rgba(5, 11, 8, 1) 100%)';
                node.style.color = '#d8ffe7';
                node.style.cursor = 'pointer';
                node.style.transition = 'transform 120ms ease, box-shadow 120ms ease';
                node.style.zIndex = '3';
                node.textContent = getNodeGlyph(option);
                if (option.owned) {
                    node.style.borderColor = '#9bffbc';
                    node.style.background =
                        'radial-gradient(circle at 35% 35%, rgba(226, 255, 170, 0.42), rgba(37, 78, 35, 0.94) 52%, rgba(8, 20, 10, 1) 100%)';
                }
                else if (option.lockedByPrerequisite) {
                    node.style.borderColor = '#557766';
                    node.style.background =
                        'radial-gradient(circle at 35% 35%, rgba(120, 130, 126, 0.18), rgba(20, 28, 24, 0.9) 52%, rgba(10, 13, 12, 1) 100%)';
                    node.style.color = '#90a69a';
                }
                else if (!option.canAfford) {
                    node.style.borderColor = '#cc9955';
                    node.style.background =
                        'radial-gradient(circle at 35% 35%, rgba(255, 214, 138, 0.24), rgba(52, 32, 18, 0.94) 52%, rgba(17, 10, 7, 1) 100%)';
                    node.style.color = '#ffd487';
                }
                node.addEventListener('click', () => {
                    selectedOptionId = option.id;
                    updateNodeSelectionStyles();
                    renderDetails();
                });
                nodeButtons.set(option.id, node);
                nodeLayer.appendChild(node);
            });
            updateNodeSelectionStyles();
            renderDetails();
            skillLayout.appendChild(webWrap);
            skillLayout.appendChild(detailPanel);
            tabContent.appendChild(skillLayout);
            const legend = document.createElement('div');
            legend.style.fontSize = '11px';
            legend.style.opacity = '0.85';
            legend.textContent =
                'Constellation legend: circular nodes emulate a Path of Exile-style passive tree. Larger orbs mark branch hubs, bright links show open routes, and the right-hand panel always shows the selected skill.';
            tabContent.appendChild(legend);
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
    hideCityManagement(triggerCallback = false) {
        this.cityOverlay.style.display = 'none';
        if (triggerCallback && this.cityOverlayOnClose) {
            this.cityOverlayOnClose();
        }
        this.cityOverlayOnClose = null;
    }
    showTutorialMenu() {
        this.tutorialOverlay.style.display = 'block';
        this.renderTutorialContent();
    }
    hideTutorialMenu() {
        this.tutorialOverlay.style.display = 'none';
    }
    toggleTutorialMenu() {
        if (this.isTutorialMenuOpen()) {
            this.hideTutorialMenu();
        }
        else {
            this.showTutorialMenu();
        }
    }
    isTutorialMenuOpen() {
        return this.tutorialOverlay.style.display !== 'none';
    }
    closeActivePanel() {
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
    updateResourceStatus(status) {
        if (!status) {
            this.resourceProgressOverlay.style.display = 'none';
            this.hideResourceChoice();
            return;
        }
        const remaining = `${Math.floor(status.remaining)}/${status.capacity}`;
        if (status.mode === 'cooldown') {
            this.resourceProgressText.textContent = `${status.type.toUpperCase()} Node reloading - ${status.cooldownTurnsRemaining} turn(s) left`;
        }
        else {
            this.resourceProgressText.textContent = `${status.type.toUpperCase()} Node  Remaining: ${remaining}`;
        }
        let progressA = 0;
        let progressB = 0;
        if (status.mode === 'active') {
            progressA = status.activeProgress;
            progressB = status.remaining / status.capacity;
        }
        else if (status.mode === 'cooldown') {
            progressA = status.cooldownProgress;
            progressB = 0;
        }
        else if (status.mode === 'idle') {
            progressA = status.idleTickProgress;
            progressB = status.remaining / status.capacity;
        }
        else {
            progressA = status.remaining / status.capacity;
            progressB = 0;
        }
        this.resourceProgressFillA.style.width = `${Math.floor(progressA * 100)}%`;
        this.resourceProgressFillB.style.width = `${Math.floor(progressB * 100)}%`;
        this.resourceProgressOverlay.style.display = 'block';
    }
    updateMountainDestroyStatus(status) {
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
    createPauseMenuOverlay() {
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
        const tabBtns = {};
        const renderTab = (tab) => {
            Object.entries(tabBtns).forEach(([key, btn]) => {
                btn.style.backgroundColor = key === tab ? '#006600' : '#003300';
                btn.style.borderColor = key === tab ? '#aaffaa' : '#00ff00';
            });
            if (tab === 'menu') {
                this.renderPauseMenuMain(tabContent);
            }
            else {
                this.renderPauseMenuSettings(tabContent);
            }
        };
        const tabDefs = [
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
        overlay._renderTab = renderTab;
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay)
                this.hidePauseMenu();
        });
        document.body.appendChild(overlay);
        return { overlay, tabContent };
    }
    renderPauseMenuMain(container) {
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
        leaveBtn.addEventListener('click', () => this.renderLeaveConfirm(container));
        dangerZone.appendChild(leaveBtn);
        container.appendChild(dangerZone);
    }
    renderLeaveConfirm(container) {
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
            if (this.onLeaveGame)
                this.onLeaveGame();
        });
        container.appendChild(confirmBtn);
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel — Keep Playing';
        cancelBtn.style.width = '100%';
        cancelBtn.style.padding = '8px';
        cancelBtn.addEventListener('click', () => this.renderPauseMenuMain(container));
        container.appendChild(cancelBtn);
    }
    renderPauseMenuSettings(container) {
        container.innerHTML = '';
        const makeSectionHeader = (text) => {
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
        const makeRow = (label, control) => {
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
        const makeToggle = (value, onChange) => {
            const btn = document.createElement('button');
            const update = (v) => {
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
        const makeSlider = (value, onChange) => {
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
        container.appendChild(makeRow('Master Volume', makeSlider(this.settings.masterVolume, (v) => {
            this.settings.masterVolume = v;
            this.saveSettings();
            this.onSettingsChange?.(this.getSettings());
        })));
        container.appendChild(makeRow('Sound Effects', makeToggle(this.settings.sfxEnabled, (v) => {
            this.settings.sfxEnabled = v;
            this.saveSettings();
            this.onSettingsChange?.(this.getSettings());
        })));
        // ── Display ──────────────────────────────────────────────────────────
        container.appendChild(makeSectionHeader('DISPLAY'));
        container.appendChild(makeRow('Show Grid Lines', makeToggle(this.settings.showGrid, (v) => {
            this.settings.showGrid = v;
            this.saveSettings();
            this.onSettingsChange?.(this.getSettings());
        })));
        container.appendChild(makeRow('Show FPS Counter', makeToggle(this.settings.showFPS, (v) => {
            this.settings.showFPS = v;
            this.saveSettings();
            this.onSettingsChange?.(this.getSettings());
        })));
        // ── Gameplay ─────────────────────────────────────────────────────────
        container.appendChild(makeSectionHeader('GAMEPLAY'));
        container.appendChild(makeRow('Confirm End Turn', makeToggle(this.settings.confirmEndTurn, (v) => {
            this.settings.confirmEndTurn = v;
            this.saveSettings();
            this.onSettingsChange?.(this.getSettings());
        })));
    }
    showPauseMenu() {
        this.pauseMenuOverlay.style.display = 'block';
        const typed = this.pauseMenuOverlay;
        typed._renderTab?.('menu');
    }
    hidePauseMenu() {
        this.pauseMenuOverlay.style.display = 'none';
    }
    isPauseMenuOpen() {
        return this.pauseMenuOverlay.style.display !== 'none';
    }
    getSettings() {
        return { ...this.settings };
    }
    loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
            }
        }
        catch {
            // ignore malformed data
        }
        return { ...DEFAULT_SETTINGS };
    }
    saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
        }
        catch {
            // ignore quota errors
        }
    }
}
//# sourceMappingURL=UIManager.js.map