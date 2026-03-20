/**
 * Menu Manager
 * Handles menu panel, settings, and controls display
 */
export type MenuCallback = () => void;
export declare class MenuManager {
    private menuOverlay;
    private menuPanel;
    private isOpen;
    private onResume;
    private onSave;
    private onExit;
    constructor();
    private initializeElements;
    private setupEventListeners;
    /**
     * Open the menu
     */
    open(): void;
    /**
     * Close the menu
     */
    close(): void;
    /**
     * Toggle menu open/close
     */
    toggle(): void;
    /**
     * Check if menu is open
     */
    isMenuOpen(): boolean;
    /**
     * Switch between tabs
     */
    private switchTab;
    /**
     * Register resume callback
     */
    onResumeClick(callback: MenuCallback): void;
    /**
     * Register save callback
     */
    onSaveClick(callback: MenuCallback): void;
    /**
     * Register exit callback
     */
    onExitClick(callback: MenuCallback): void;
}
//# sourceMappingURL=MenuManager.d.ts.map