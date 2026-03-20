/**
 * Menu Manager
 * Handles menu panel, settings, and controls display
 */
export class MenuManager {
    constructor() {
        this.menuOverlay = null;
        this.menuPanel = null;
        this.isOpen = false;
        this.onResume = null;
        this.onSave = null;
        this.onExit = null;
        this.initializeElements();
        this.setupEventListeners();
    }
    initializeElements() {
        this.menuOverlay = document.getElementById('menu-overlay');
        this.menuPanel = document.getElementById('menu-panel');
        if (!this.menuOverlay || !this.menuPanel) {
            console.error('Menu elements not found in DOM');
        }
    }
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('menu-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        // Tab buttons
        const tabButtons = document.querySelectorAll('.menu-tab-button');
        tabButtons.forEach((button) => {
            button.addEventListener('click', (e) => {
                const target = e.target;
                const tabName = target.getAttribute('data-tab');
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });
        // Menu options
        const resumeBtn = document.getElementById('menu-resume');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                this.close();
                if (this.onResume)
                    this.onResume();
            });
        }
        const saveBtn = document.getElementById('menu-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (this.onSave)
                    this.onSave();
            });
        }
        const exitBtn = document.getElementById('menu-exit');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                if (this.onExit)
                    this.onExit();
            });
        }
        // Close on overlay click (outside the panel)
        if (this.menuOverlay) {
            this.menuOverlay.addEventListener('click', (e) => {
                if (e.target === this.menuOverlay) {
                    this.close();
                }
            });
        }
    }
    /**
     * Open the menu
     */
    open() {
        if (this.menuOverlay) {
            this.menuOverlay.classList.add('active');
            this.isOpen = true;
        }
    }
    /**
     * Close the menu
     */
    close() {
        if (this.menuOverlay) {
            this.menuOverlay.classList.remove('active');
            this.isOpen = false;
        }
    }
    /**
     * Toggle menu open/close
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        }
        else {
            this.open();
        }
    }
    /**
     * Check if menu is open
     */
    isMenuOpen() {
        return this.isOpen;
    }
    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Hide all tab contents
        const allContents = document.querySelectorAll('.menu-tab-content');
        allContents.forEach((content) => {
            content.classList.remove('active');
        });
        // Deactivate all tab buttons
        const allButtons = document.querySelectorAll('.menu-tab-button');
        allButtons.forEach((button) => {
            button.classList.remove('active');
        });
        // Show selected tab content
        const selectedContent = document.getElementById(tabName);
        if (selectedContent) {
            selectedContent.classList.add('active');
        }
        // Activate selected tab button
        const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }
    }
    /**
     * Register resume callback
     */
    onResumeClick(callback) {
        this.onResume = callback;
    }
    /**
     * Register save callback
     */
    onSaveClick(callback) {
        this.onSave = callback;
    }
    /**
     * Register exit callback
     */
    onExitClick(callback) {
        this.onExit = callback;
    }
}
//# sourceMappingURL=MenuManager.js.map