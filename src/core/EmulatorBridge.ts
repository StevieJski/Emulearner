import type { EmulatorJS, GameManager, EmscriptenModule } from '../types/emulatorjs';

export interface EmulatorBridgeConfig {
  containerId: string;
  gameUrl: string;
  core: string;
  dataPath?: string;
  biosUrl?: string;
  startOnLoad?: boolean;
  debug?: boolean;
  volume?: number;
}

export type EmulatorState = 'uninitialized' | 'loading' | 'ready' | 'running' | 'paused' | 'error';

// Track global state to prevent double-loading
let loaderScriptLoaded = false;
let currentLoadingPromise: Promise<void> | null = null;

/**
 * EmulatorBridge provides a TypeScript interface to EmulatorJS.
 * It handles lifecycle management, script loading, and provides typed access
 * to the underlying GameManager methods.
 */
export class EmulatorBridge {
  private config: EmulatorBridgeConfig;
  private emulator: EmulatorJS | null = null;
  private _state: EmulatorState = 'uninitialized';
  private loadPromise: Promise<void> | null = null;

  constructor(config: EmulatorBridgeConfig) {
    this.config = {
      dataPath: 'data/',
      startOnLoad: true,
      debug: false,
      volume: 0.5,
      ...config,
    };
  }

  get state(): EmulatorState {
    return this._state;
  }

  get gameManager(): GameManager | null {
    return this.emulator?.gameManager ?? null;
  }

  get module(): EmscriptenModule | null {
    // Access Module through gameManager (same as netplay code does)
    return this.emulator?.gameManager?.Module ?? this.emulator?.Module ?? null;
  }

  get isReady(): boolean {
    return this._state === 'ready' || this._state === 'running' || this._state === 'paused';
  }

  /**
   * Initialize and load EmulatorJS with the configured settings.
   * Returns a promise that resolves when the emulator is ready.
   */
  async load(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // If there's already a loading in progress globally, wait for it
    if (currentLoadingPromise) {
      await currentLoadingPromise;
      // After waiting, check if emulator is ready
      if (window.EJS_emulator) {
        this.emulator = window.EJS_emulator;
        this._state = 'ready';
        return;
      }
    }

    this._state = 'loading';

    this.loadPromise = this.doLoad();
    currentLoadingPromise = this.loadPromise;

    try {
      await this.loadPromise;
    } finally {
      currentLoadingPromise = null;
    }

    return this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Verify container exists
      const container = document.getElementById(this.config.containerId);
      if (!container) {
        this._state = 'error';
        reject(new Error(`Container element #${this.config.containerId} not found`));
        return;
      }

      // Set up global config variables that EmulatorJS expects
      this.setupGlobalConfig();

      // Set up the ready callback
      window.EJS_onGameStart = () => {
        this._state = 'ready';
        this.emulator = window.EJS_emulator ?? null;
        resolve();
      };

      // If loader is already loaded, we need to manually trigger EmulatorJS
      if (loaderScriptLoaded) {
        // EmulatorJS scripts are already loaded, create new instance
        // The loader.js checks for EJS_player and creates EmulatorJS automatically
        // We need to reload the page or find another way
        // For now, reject with an error explaining the limitation
        this._state = 'error';
        reject(new Error('EmulatorJS already loaded. Please refresh the page to load a different game.'));
        return;
      }

      // Load the EmulatorJS loader script
      loaderScriptLoaded = true;
      this.loadScript(`${this.config.dataPath}loader.js`)
        .catch((error) => {
          loaderScriptLoaded = false;
          this._state = 'error';
          reject(error);
        });
    });
  }

  private setupGlobalConfig(): void {
    // EJS_player is used as a CSS selector, so add # for ID
    window.EJS_player = `#${this.config.containerId}`;
    window.EJS_gameUrl = this.config.gameUrl;
    window.EJS_core = this.config.core;
    window.EJS_pathtodata = this.config.dataPath;
    window.EJS_startOnLoaded = this.config.startOnLoad;
    window.EJS_DEBUG_XX = this.config.debug;
    window.EJS_volume = this.config.volume;

    if (this.config.biosUrl) {
      window.EJS_biosUrl = this.config.biosUrl;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  }

  /**
   * Resume the emulator main loop (unpause).
   */
  play(): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.toggleMainLoop(1);
    this._state = 'running';
  }

  /**
   * Pause the emulator main loop.
   */
  pause(): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.toggleMainLoop(0);
    this._state = 'paused';
  }

  /**
   * Toggle between play and pause states.
   */
  togglePause(): void {
    if (this._state === 'running') {
      this.pause();
    } else if (this._state === 'paused' || this._state === 'ready') {
      this.play();
    }
  }

  /**
   * Advance the emulator by exactly one frame.
   * Uses requestAnimationFrame polling to detect frame advancement.
   */
  async stepFrame(): Promise<number> {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }

    return new Promise<number>((resolve, reject) => {
      const gm = this.gameManager!;
      const startFrame = gm.getFrameNum();
      let attempts = 0;
      const maxAttempts = 500; // Timeout after ~8 seconds

      // Debug: console.log('stepFrame starting:', startFrame);

      const checkFrame = () => {
        attempts++;
        if (attempts > maxAttempts) {
          console.error('stepFrame timeout after', attempts, 'attempts');
          gm.toggleMainLoop(0);
          this._state = 'paused';
          reject(new Error('stepFrame timeout - frame did not advance'));
          return;
        }

        const currentFrame = gm.getFrameNum();
        if (currentFrame > startFrame) {
          gm.toggleMainLoop(0); // Pause
          this._state = 'paused';
          resolve(currentFrame);
        } else {
          // Use setTimeout instead of requestAnimationFrame for better compatibility
          // with worker message handler contexts
          setTimeout(checkFrame, 1);
        }
      };

      gm.toggleMainLoop(1); // Resume loop
      this._state = 'running';
      // Give the emulator time to run before checking
      setTimeout(checkFrame, 20);
    });
  }

  /**
   * Advance the emulator by a specified number of frames.
   */
  async stepFrames(count: number): Promise<number> {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }

    if (count <= 0) {
      return this.getFrameNumber();
    }

    return new Promise<number>((resolve) => {
      const gm = this.gameManager!;
      const targetFrame = gm.getFrameNum() + count;

      const checkFrame = () => {
        const currentFrame = gm.getFrameNum();
        if (currentFrame >= targetFrame) {
          gm.toggleMainLoop(0); // Pause
          this._state = 'paused';
          resolve(currentFrame);
        } else {
          // Use setTimeout instead of requestAnimationFrame for better compatibility
          // with worker message handler contexts
          setTimeout(checkFrame, 1);
        }
      };

      gm.toggleMainLoop(1); // Resume loop
      this._state = 'running';
      // Give the emulator time to run before checking
      setTimeout(checkFrame, 20);
    });
  }

  /**
   * Get the current frame number.
   */
  getFrameNumber(): number {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    return this.gameManager.getFrameNum();
  }

  /**
   * Simulate a button press/release.
   * @param player - Player number (0-3)
   * @param buttonIndex - Button index (see BUTTON_MAP)
   * @param pressed - true for press, false for release
   */
  simulateInput(player: number, buttonIndex: number, pressed: boolean): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    console.log('[EmulatorBridge] simulateInput:', { player, buttonIndex, pressed });
    this.gameManager.simulateInput(player, buttonIndex, pressed ? 1 : 0);
  }

  /**
   * Get a save state snapshot.
   *
   * Uses Module.EmulatorJSGetState() if available (nightly cores),
   * otherwise falls back to calling _save_state_info directly
   * (available in all core builds including stable).
   */
  saveState(): Uint8Array {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }

    const mod = this.module;
    if (!mod) {
      throw new Error('Module not available');
    }

    // Try the native function first (nightly cores)
    if (typeof mod.EmulatorJSGetState === 'function') {
      return mod.EmulatorJSGetState();
    }

    // Polyfill using _save_state_info (available in all core builds).
    // This C function serializes the current state and returns a string:
    // "size|pointer|success" where success=1 means OK.
    const saveStateInfo = mod.cwrap('save_state_info', 'string', []);
    const info = saveStateInfo() as string;
    const parts = info.split('|');

    if (parts[2] !== '1') {
      throw new Error(`Save state failed: ${parts[0]}`);
    }

    const size = parseInt(parts[0], 10);
    const dataStart = parseInt(parts[1], 10);
    const data = mod.HEAPU8.subarray(dataStart, dataStart + size);

    // Return a copy (the WASM buffer may be reused)
    return new Uint8Array(data);
  }

  /**
   * Load a save state snapshot.
   */
  loadState(state: Uint8Array): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.loadState(state);
  }

  /**
   * Take a screenshot.
   */
  async screenshot(): Promise<Uint8Array> {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    return this.gameManager.screenshot();
  }

  /**
   * Read a byte from emulator memory.
   * @param address - Memory address (with console-specific offset)
   */
  readMemoryByte(address: number): number {
    if (!this.module) {
      throw new Error('Emulator not ready');
    }
    return this.module.HEAPU8[address];
  }

  /**
   * Read a signed byte from emulator memory.
   */
  readMemoryInt8(address: number): number {
    if (!this.module) {
      throw new Error('Emulator not ready');
    }
    return this.module.HEAP8[address];
  }

  /**
   * Read an unsigned 16-bit value from emulator memory.
   * @param address - Memory address (must be 2-byte aligned)
   */
  readMemoryUint16(address: number): number {
    if (!this.module) {
      throw new Error('Emulator not ready');
    }
    return this.module.HEAPU16[address >> 1];
  }

  /**
   * Read a signed 16-bit value from emulator memory.
   */
  readMemoryInt16(address: number): number {
    if (!this.module) {
      throw new Error('Emulator not ready');
    }
    return this.module.HEAP16[address >> 1];
  }

  /**
   * Read an unsigned 32-bit value from emulator memory.
   * @param address - Memory address (must be 4-byte aligned)
   */
  readMemoryUint32(address: number): number {
    if (!this.module) {
      throw new Error('Emulator not ready');
    }
    return this.module.HEAPU32[address >> 2];
  }

  /**
   * Read a signed 32-bit value from emulator memory.
   */
  readMemoryInt32(address: number): number {
    if (!this.module) {
      throw new Error('Emulator not ready');
    }
    return this.module.HEAP32[address >> 2];
  }

  /**
   * Read raw bytes from emulator memory.
   */
  readMemoryBytes(address: number, length: number): Uint8Array {
    if (!this.module) {
      throw new Error('Emulator not ready');
    }
    return this.module.HEAPU8.slice(address, address + length);
  }

  /**
   * Get core options as a JSON string.
   */
  getCoreOptions(): string {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    return this.gameManager.getCoreOptions();
  }

  // ==================== Cheat System ====================

  /**
   * Set a cheat code via the RetroArch cheat system.
   * @param index - Cheat slot index
   * @param enabled - Whether the cheat is active
   * @param code - Cheat code string (e.g., "FFFE12:AB" for Genesis Action Replay format)
   */
  setCheat(index: number, enabled: boolean, code: string): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.setCheat(index, enabled ? 1 : 0, code);
  }

  /**
   * Reset (clear) all active cheats.
   */
  resetCheat(): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.resetCheat();
  }

  // ==================== RAM Base Discovery ====================

  /**
   * Discover the Genesis work RAM base address in HEAPU8.
   *
   * The genesis_plus_gx core allocates work RAM dynamically within the
   * Emscripten heap. This method uses the cheat system to write marker
   * values to known addresses, then scans HEAPU8 to find them.
   *
   * @returns The HEAPU8 base address of the 64KB Genesis work RAM
   * @throws If discovery fails
   */
  async discoverWorkRamBase(): Promise<number> {
    if (!this.module || !this.gameManager) {
      throw new Error('Emulator not ready');
    }

    const heap = this.module.HEAPU8;
    // Use two distinct marker values unlikely to occur naturally
    const MARKER1 = 0xA7;
    const MARKER2 = 0x53;
    // Lives address in Genesis 68000 address space (Action Replay format)
    const LIVES_ADDR = 'FFFE12';
    // Relative offset of lives within 64KB work RAM (0xFF0000-based)
    const LIVES_OFFSET = 0xFE12;
    // Default lives value to restore after discovery
    const DEFAULT_LIVES = 3;

    // Phase 1: Write first marker via cheat system and step one frame
    this.gameManager.resetCheat();
    this.gameManager.setCheat(0, 1, `${LIVES_ADDR}:${MARKER1.toString(16).toUpperCase()}`);
    await this.stepFrame();

    // Record all HEAPU8 positions that contain MARKER1
    // Filter to only plausible base addresses (enough room for 64KB work RAM)
    const marker1Positions: number[] = [];
    for (let i = 0; i < heap.length; i++) {
      if (heap[i] === MARKER1) {
        const possibleBase = i - LIVES_OFFSET;
        if (possibleBase >= 0 && possibleBase + 0xFFFF < heap.length) {
          marker1Positions.push(i);
        }
      }
    }
    console.log(`[EmulatorBridge] Phase 1: Found ${marker1Positions.length} MARKER1 candidates`);

    // Phase 2: Write second marker and step again
    this.gameManager.resetCheat();
    this.gameManager.setCheat(0, 1, `${LIVES_ADDR}:${MARKER2.toString(16).toUpperCase()}`);
    await this.stepFrame();

    // Find positions that changed from MARKER1 to MARKER2
    // This eliminates coincidental matches, leaving only the real lives address
    const matches: number[] = [];
    for (const pos of marker1Positions) {
      if (heap[pos] === MARKER2) {
        matches.push(pos);
      }
    }
    console.log(`[EmulatorBridge] Phase 2: ${matches.length} positions changed MARKER1→MARKER2`);

    // Clear cheats so markers stop being applied
    this.gameManager.resetCheat();
    await this.stepFrame();

    if (matches.length === 0) {
      throw new Error('Failed to discover work RAM base: no matching positions found');
    }

    // Find the best candidate by checking for plausible game state
    let discoveredBase: number | null = null;
    for (const livesAddr of matches) {
      const base = livesAddr - LIVES_OFFSET;
      const zone = heap[base + 0xFE10];
      if (zone <= 20) {
        discoveredBase = base;
        break;
      }
    }
    if (discoveredBase === null) {
      discoveredBase = matches[0] - LIVES_OFFSET;
    }

    // Restore the lives byte that was corrupted by the markers
    heap[discoveredBase + LIVES_OFFSET] = DEFAULT_LIVES;
    console.log(`[EmulatorBridge] Discovered work RAM base: 0x${discoveredBase.toString(16)} (${discoveredBase}), lives restored to ${DEFAULT_LIVES}`);

    return discoveredBase;
  }

  /**
   * Set a core option.
   */
  setVariable(option: string, value: string): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.setVariable(option, value);
  }

  /**
   * Enable/disable fast forward mode.
   */
  setFastForward(enabled: boolean): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.toggleFastForward(enabled ? 1 : 0);
  }

  /**
   * Set fast forward speed ratio.
   */
  setFastForwardRatio(ratio: number): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.setFastForwardRatio(ratio);
  }

  /**
   * Enable/disable slow motion mode.
   */
  setSlowMotion(enabled: boolean): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.toggleSlowMotion(enabled ? 1 : 0);
  }

  /**
   * Set slow motion speed ratio.
   */
  setSlowMotionRatio(ratio: number): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.setSlowMotionRatio(ratio);
  }

  /**
   * Restart the game.
   */
  restart(): void {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    this.gameManager.restart();
  }

  /**
   * Check if save states are supported for the current core.
   */
  supportsStates(): boolean {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    return this.gameManager.supportsStates();
  }

  /**
   * Get video dimensions.
   */
  getVideoDimensions(): { width: number; height: number } | null {
    if (!this.gameManager) {
      throw new Error('Emulator not ready');
    }
    const width = this.gameManager.getVideoDimensions('width');
    const height = this.gameManager.getVideoDimensions('height');
    if (width === undefined || height === undefined) {
      return null;
    }
    return { width, height };
  }

  /**
   * Clean up and destroy the emulator instance.
   */
  destroy(): void {
    // Clear global config
    window.EJS_emulator = undefined;
    window.EJS_gameUrl = undefined;
    window.EJS_core = undefined;
    window.EJS_player = undefined;
    window.EJS_pathtodata = undefined;
    window.EJS_startOnLoaded = undefined;
    window.EJS_DEBUG_XX = undefined;
    window.EJS_onGameStart = undefined;

    this.emulator = null;
    this._state = 'uninitialized';
    this.loadPromise = null;
  }
}
