/**
 * Input Handler
 * Manages keyboard and mouse input
 */
export interface InputState {
    keys: Set<string>;
    mousePos: {
        x: number;
        y: number;
    };
    mouseDown: boolean;
    mouseButton: number;
}
export type InputCallback = (input: InputState) => void;
export declare class InputHandler {
    private state;
    private callbacks;
    private keyDownCallbacks;
    private keyUpCallbacks;
    private mouseClickCallbacks;
    constructor(targetElement?: HTMLElement | Document);
    private setupEventListeners;
    private handleKeyDown;
    private handleKeyUp;
    private handleMouseMove;
    private handleMouseDown;
    private handleMouseUp;
    private handleWheel;
    private handleTouchMove;
    private handleTouchStart;
    private handleTouchEnd;
    /**
     * Register general input callback
     */
    onInput(callback: InputCallback): void;
    /**
     * Register key-down specific callback
     */
    onKeyDown(key: string, callback: () => void): void;
    /**
     * Register key-up specific callback
     */
    onKeyUp(key: string, callback: () => void): void;
    /**
     * Register mouse click callback
     */
    onClick(callback: (x: number, y: number) => void): void;
    /**
     * Check if key is currently pressed
     */
    isKeyPressed(key: string): boolean;
    /**
     * Get current input state
     */
    getState(): InputState;
    /**
     * Get mouse position
     */
    getMousePosition(): {
        x: number;
        y: number;
    };
    /**
     * Check if mouse is down
     */
    isMouseDown(): boolean;
    /**
     * Get currently pressed keys
     */
    getPressedKeys(): string[];
    /**
     * Trigger input callbacks
     */
    update(): void;
    /**
     * Clear all input state
     */
    clear(): void;
}
//# sourceMappingURL=InputHandler.d.ts.map