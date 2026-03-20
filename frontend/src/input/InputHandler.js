/**
 * Input Handler
 * Manages keyboard and mouse input
 */
export class InputHandler {
    constructor(targetElement = document) {
        this.state = {
            keys: new Set(),
            mousePos: { x: 0, y: 0 },
            mouseDown: false,
            mouseButton: 0,
        };
        this.callbacks = [];
        this.keyDownCallbacks = {};
        this.keyUpCallbacks = {};
        this.mouseClickCallbacks = [];
        this.setupEventListeners(targetElement);
    }
    setupEventListeners(target) {
        // Keyboard events
        target.addEventListener('keydown', (e) => this.handleKeyDown(e));
        target.addEventListener('keyup', (e) => this.handleKeyUp(e));
        // Mouse events
        target.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        target.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        target.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        target.addEventListener('wheel', (e) => this.handleWheel(e), false);
        // Touch events (for mobile)
        target.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        target.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        target.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }
    handleKeyDown(event) {
        const key = event.code || event.key.toLowerCase();
        if (!this.state.keys.has(key)) {
            this.state.keys.add(key);
            // Trigger key-specific callback
            if (this.keyDownCallbacks[key]) {
                this.keyDownCallbacks[key]();
            }
        }
    }
    handleKeyUp(event) {
        const key = event.code || event.key.toLowerCase();
        this.state.keys.delete(key);
        // Trigger key-specific callback
        if (this.keyUpCallbacks[key]) {
            this.keyUpCallbacks[key]();
        }
    }
    handleMouseMove(event) {
        const rect = event.target.getBoundingClientRect();
        this.state.mousePos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }
    handleMouseDown(event) {
        this.state.mouseDown = true;
        this.state.mouseButton = event.button;
    }
    handleMouseUp(event) {
        this.state.mouseDown = false;
        // Trigger click callbacks
        const rect = event.target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this.mouseClickCallbacks.forEach((callback) => callback(x, y));
    }
    handleWheel(event) {
        // Could be used for zoom
        event.preventDefault();
    }
    handleTouchMove(event) {
        if (event.touches.length > 0) {
            const touch = event.touches[0];
            const rect = event.target.getBoundingClientRect();
            this.state.mousePos = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top,
            };
        }
    }
    handleTouchStart(_event) {
        this.state.mouseDown = true;
    }
    handleTouchEnd(event) {
        this.state.mouseDown = false;
        if (event.changedTouches.length > 0) {
            const touch = event.changedTouches[0];
            const rect = event.target.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.mouseClickCallbacks.forEach((callback) => callback(x, y));
        }
    }
    // ============ Public API ============
    /**
     * Register general input callback
     */
    onInput(callback) {
        this.callbacks.push(callback);
    }
    /**
     * Register key-down specific callback
     */
    onKeyDown(key, callback) {
        this.keyDownCallbacks[key] = callback;
    }
    /**
     * Register key-up specific callback
     */
    onKeyUp(key, callback) {
        this.keyUpCallbacks[key] = callback;
    }
    /**
     * Register mouse click callback
     */
    onClick(callback) {
        this.mouseClickCallbacks.push(callback);
    }
    /**
     * Check if key is currently pressed
     */
    isKeyPressed(key) {
        return this.state.keys.has(key);
    }
    /**
     * Get current input state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get mouse position
     */
    getMousePosition() {
        return { ...this.state.mousePos };
    }
    /**
     * Check if mouse is down
     */
    isMouseDown() {
        return this.state.mouseDown;
    }
    /**
     * Get currently pressed keys
     */
    getPressedKeys() {
        return Array.from(this.state.keys);
    }
    /**
     * Trigger input callbacks
     */
    update() {
        this.callbacks.forEach((callback) => callback(this.state));
    }
    /**
     * Clear all input state
     */
    clear() {
        this.state.keys.clear();
        this.state.mouseDown = false;
    }
}
//# sourceMappingURL=InputHandler.js.map