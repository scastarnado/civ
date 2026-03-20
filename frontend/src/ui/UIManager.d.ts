/**
 * UI System
 * Manages UI panels, resources display, and event log
 */
import { City, CityManagementData, Player, ResourceNodeStatus, Unit } from '@/core/types';
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
    private resourcePromptOverlay;
    private resourcePromptText;
    private resourceProgressOverlay;
    private resourceProgressText;
    private resourceProgressFillA;
    private resourceProgressFillB;
    private cityOverlay;
    private cityOverlayContent;
    private cityOverlayOnClose;
    private turnInfoText;
    private controlsText;
    constructor();
    private setupRightPanelTabs;
    private refreshRightPanelTabStyles;
    private renderRightPanelContent;
    private createCityOverlay;
    private createResourceOverlays;
    /**
     * Update left panel with selected entity info
     */
    updateSelectedInfo(entity: Unit | City | null): void;
    /**
     * Update right panel with player resources
     */
    updateResources(player: Player): void;
    updateTurnOrder(turn: number, players: Player[], currentIndex: number): void;
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
    showResourceChoice(status: ResourceNodeStatus, onActive: () => void, onIdle: () => void): void;
    hideResourceChoice(): void;
    showCityManagement(data: CityManagementData, onSelect: (optionId: string) => void, onClose: () => void): void;
    hideCityManagement(triggerCallback?: boolean): void;
    closeActivePanel(): boolean;
    updateResourceStatus(status: ResourceNodeStatus | null): void;
}
//# sourceMappingURL=UIManager.d.ts.map