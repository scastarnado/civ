/**
 * UI System
 * Manages UI panels, resources display, and event log
 */
import { City, CityManagementData, MountainDestroyStatus, Player, ResourceNodeStatus, Unit } from '@/core/types';
export interface GameSettings {
    masterVolume: number;
    sfxEnabled: boolean;
    showGrid: boolean;
    showFPS: boolean;
    confirmEndTurn: boolean;
}
export declare class UIPanel {
    private container;
    constructor(elementId: string);
    /**
     * Update panel content
     */
    setContent(content: string): void;
    /**
     * Clear panel content
     */
    clear(): void;
    getContainer(): HTMLElement;
}
export declare class UIManager {
    private leftPanel;
    private rightPanel;
    private bottomPanel;
    private rightPanelContent;
    private rightPanelTabButtons;
    private rightPanelActiveTab;
    private rightPanelPlayer;
    private eventLog;
    private maxLogEntries;
    private lastEventMessage;
    private lastEventAt;
    private lastEventRepeatCount;
    private resourcePromptOverlay;
    private resourcePromptText;
    private resourceProgressOverlay;
    private resourceProgressText;
    private resourceProgressFillA;
    private resourceProgressFillB;
    private cityOverlay;
    private cityOverlayContent;
    private cityOverlayOnClose;
    private tutorialOverlay;
    private tutorialPanel;
    private tutorialContent;
    private tutorialActiveTab;
    private turnInfoText;
    private aiRumorLines;
    private aiIntelFeed;
    private controlsText;
    private pauseMenuOverlay;
    private settings;
    onLeaveGame: (() => void) | null;
    onSettingsChange: ((settings: GameSettings) => void) | null;
    constructor();
    private setupRightPanelTabs;
    private refreshRightPanelTabStyles;
    private renderRightPanelContent;
    private createCityOverlay;
    private createResourceOverlays;
    private createTutorialOverlay;
    private renderTutorialContent;
    /**
     * Update left panel with selected entity info
     */
    updateSelectedInfo(entity: Unit | City | null): void;
    /**
     * Update right panel with player resources
     */
    updateResources(player: Player): void;
    updateTurnOrder(turn: number, players: Player[], currentIndex: number): void;
    setAIRumorLines(lines: string[]): void;
    pushAITurnIntel(message: string): void;
    /**
     * Add event to log
     */
    addEvent(message: string): void;
    /**
     * Update event log display
     */
    private updateEventLog;
    /**
     * Clear event log
     */
    clearEventLog(): void;
    /**
     * Toggle panel visibility
     */
    togglePanel(panelId: string): void;
    /**
     * Show game over screen
     */
    showGameOver(winner: Player | null): void;
    /**
     * Update turn indicator
     */
    updateTurn(turn: number, currentPlayer: Player): void;
    private createPromptButton;
    private showChoicePrompt;
    showResourceChoice(status: ResourceNodeStatus, onActive: () => void, onIdle: () => void, onIgnore: () => void): void;
    showMountainDestroyChoice(status: MountainDestroyStatus, onDestroy: () => void, onIgnore: () => void): void;
    hideResourceChoice(): void;
    hideMountainDestroyChoice(): void;
    showCityManagement(data: CityManagementData, onSelect: (optionId: string) => void, onClose: () => void): void;
    hideCityManagement(triggerCallback?: boolean): void;
    showTutorialMenu(): void;
    hideTutorialMenu(): void;
    toggleTutorialMenu(): void;
    isTutorialMenuOpen(): boolean;
    closeActivePanel(): boolean;
    updateResourceStatus(status: ResourceNodeStatus | null): void;
    updateMountainDestroyStatus(status: MountainDestroyStatus | null): void;
    private createPauseMenuOverlay;
    private renderPauseMenuMain;
    private renderLeaveConfirm;
    private renderPauseMenuSettings;
    showPauseMenu(): void;
    hidePauseMenu(): void;
    isPauseMenuOpen(): boolean;
    getSettings(): GameSettings;
    private loadSettings;
    private saveSettings;
}
//# sourceMappingURL=UIManager.d.ts.map