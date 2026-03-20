/**
 * Input Handler
 * Manages keyboard and mouse input
 */

export interface InputState {
	keys: Set<string>;
	mousePos: { x: number; y: number };
	mouseDown: boolean;
	mouseButton: number;
}

export type InputCallback = (input: InputState) => void;

export class InputHandler {
	private state: InputState = {
		keys: new Set(),
		mousePos: { x: 0, y: 0 },
		mouseDown: false,
		mouseButton: 0,
	};

	private callbacks: InputCallback[] = [];
	private keyDownCallbacks: { [key: string]: () => void } = {};
	private keyUpCallbacks: { [key: string]: () => void } = {};
	private mouseClickCallbacks: { (x: number, y: number): void }[] = [];

	constructor(targetElement: HTMLElement | Document = document) {
		this.setupEventListeners(targetElement as HTMLElement);
	}

	private setupEventListeners(target: HTMLElement): void {
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

	private handleKeyDown(event: KeyboardEvent): void {
		const key = event.code || event.key.toLowerCase();

		if (!this.state.keys.has(key)) {
			this.state.keys.add(key);

			// Trigger key-specific callback
			if (this.keyDownCallbacks[key]) {
				this.keyDownCallbacks[key]();
			}
		}
	}

	private handleKeyUp(event: KeyboardEvent): void {
		const key = event.code || event.key.toLowerCase();
		this.state.keys.delete(key);

		// Trigger key-specific callback
		if (this.keyUpCallbacks[key]) {
			this.keyUpCallbacks[key]();
		}
	}

	private handleMouseMove(event: MouseEvent): void {
		const rect = (event.target as HTMLElement).getBoundingClientRect();
		this.state.mousePos = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		};
	}

	private handleMouseDown(event: MouseEvent): void {
		this.state.mouseDown = true;
		this.state.mouseButton = event.button;
	}

	private handleMouseUp(event: MouseEvent): void {
		this.state.mouseDown = false;

		// Trigger click callbacks
		const rect = (event.target as HTMLElement).getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		this.mouseClickCallbacks.forEach((callback) => callback(x, y));
	}

	private handleWheel(event: WheelEvent): void {
		// Could be used for zoom
		event.preventDefault();
	}

	private handleTouchMove(event: TouchEvent): void {
		if (event.touches.length > 0) {
			const touch = event.touches[0];
			const rect = (event.target as HTMLElement).getBoundingClientRect();
			this.state.mousePos = {
				x: touch.clientX - rect.left,
				y: touch.clientY - rect.top,
			};
		}
	}

	private handleTouchStart(_event: TouchEvent): void {
		this.state.mouseDown = true;
	}

	private handleTouchEnd(event: TouchEvent): void {
		this.state.mouseDown = false;

		if (event.changedTouches.length > 0) {
			const touch = event.changedTouches[0];
			const rect = (event.target as HTMLElement).getBoundingClientRect();
			const x = touch.clientX - rect.left;
			const y = touch.clientY - rect.top;

			this.mouseClickCallbacks.forEach((callback) => callback(x, y));
		}
	}

	// ============ Public API ============

	/**
	 * Register general input callback
	 */
	onInput(callback: InputCallback): void {
		this.callbacks.push(callback);
	}

	/**
	 * Register key-down specific callback
	 */
	onKeyDown(key: string, callback: () => void): void {
		this.keyDownCallbacks[key] = callback;
	}

	/**
	 * Register key-up specific callback
	 */
	onKeyUp(key: string, callback: () => void): void {
		this.keyUpCallbacks[key] = callback;
	}

	/**
	 * Register mouse click callback
	 */
	onClick(callback: (x: number, y: number) => void): void {
		this.mouseClickCallbacks.push(callback);
	}

	/**
	 * Check if key is currently pressed
	 */
	isKeyPressed(key: string): boolean {
		return this.state.keys.has(key);
	}

	/**
	 * Get current input state
	 */
	getState(): InputState {
		return { ...this.state };
	}

	/**
	 * Get mouse position
	 */
	getMousePosition(): { x: number; y: number } {
		return { ...this.state.mousePos };
	}

	/**
	 * Check if mouse is down
	 */
	isMouseDown(): boolean {
		return this.state.mouseDown;
	}

	/**
	 * Get currently pressed keys
	 */
	getPressedKeys(): string[] {
		return Array.from(this.state.keys);
	}

	/**
	 * Trigger input callbacks
	 */
	update(): void {
		this.callbacks.forEach((callback) => callback(this.state));
	}

	/**
	 * Clear all input state
	 */
	clear(): void {
		this.state.keys.clear();
		this.state.mouseDown = false;
	}
}
