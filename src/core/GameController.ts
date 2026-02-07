import { EmulatorBridge } from './EmulatorBridge';
import { MemoryReader, GameState } from './MemoryReader';
import { GameId } from '../data/types';

/**
 * Button names for game input.
 * Maps to EmulatorJS simulateInput indices.
 */
export type Button =
  | 'a'
  | 'b'
  | 'x'
  | 'y'
  | 'l'
  | 'r'
  | 'l2'
  | 'r2'
  | 'select'
  | 'start'
  | 'l3'
  | 'r3'
  | 'up'
  | 'down'
  | 'left'
  | 'right';

/**
 * Map button names to EmulatorJS indices.
 * Based on EmulatorJS virtual controller definitions in emulator.js.
 *
 * RetroArch/EmulatorJS standard mapping:
 * - 0: B (Genesis B, NES B, SNES B)
 * - 1: Y (Genesis C, SNES Y)
 * - 2: Select/Mode
 * - 3: Start
 * - 4: D-pad Up
 * - 5: D-pad Down
 * - 6: D-pad Left
 * - 7: D-pad Right
 * - 8: A (Genesis A, NES A, SNES A)
 * - 9: X (Genesis Y, SNES X)
 * - 10: L shoulder (Genesis X)
 * - 11: R shoulder (Genesis Z)
 * - 12-15: Additional buttons (L2, R2, L3, R3)
 */
export const BUTTON_MAP: Record<Button, number> = {
  b: 0,       // Genesis B, NES B, SNES B
  y: 1,       // Genesis C, SNES Y
  select: 2,  // Select / Mode
  start: 3,   // Start
  up: 4,      // D-pad up
  down: 5,    // D-pad down
  left: 6,    // D-pad left
  right: 7,   // D-pad right
  a: 8,       // Genesis A, NES A, SNES A
  x: 9,       // Genesis Y, SNES X
  l: 10,      // L shoulder / Genesis X
  r: 11,      // R shoulder / Genesis Z
  l2: 12,     // L2 trigger
  r2: 13,     // R2 trigger
  l3: 14,     // L3 stick press
  r3: 15,     // R3 stick press
};

/**
 * Memory type specification for reading game RAM.
 * Format: "[endian]<type><bytes>"
 * Endian: "<" little-endian, ">" big-endian
 * Type: "i" signed int, "u" unsigned int
 * Bytes: 1, 2, or 4
 *
 * Examples: ">i2" = big-endian signed 16-bit
 *           "<u4" = little-endian unsigned 32-bit
 */
export type MemoryType =
  | '<i1' | '>i1' | 'i1'
  | '<u1' | '>u1' | 'u1'
  | '<i2' | '>i2' | 'i2'
  | '<u2' | '>u2' | 'u2'
  | '<i4' | '>i4' | 'i4'
  | '<u4' | '>u4' | 'u4';

/**
 * RAM base offsets for different console systems.
 * These are added to game-specific addresses to access memory.
 */
export const CONSOLE_RAM_OFFSETS: Record<string, number> = {
  nes: 0,
  snes: 8257536,
  genesis: 16711680,
  segaMD: 16711680,
  gba: 0x02000000,
  gb: 0,
  gbc: 0,
  n64: 0,
  psx: 0,
  // Add more as needed
};

/**
 * GameController provides a simplified, student-friendly API for
 * controlling emulated games programmatically.
 *
 * This is the primary interface for educational challenges.
 */
export class GameController {
  private bridge: EmulatorBridge;
  private playerIndex: number;
  private heldButtons: Set<Button> = new Set();
  private ramOffset: number = 0;
  private memoryReader: MemoryReader;

  constructor(bridge: EmulatorBridge, playerIndex: number = 0) {
    this.bridge = bridge;
    this.playerIndex = playerIndex;
    this.memoryReader = new MemoryReader(bridge);
  }

  /**
   * Set the RAM base offset for memory reads.
   * Can use a preset console name or a custom offset.
   */
  setRamOffset(consoleOrOffset: string | number): void {
    if (typeof consoleOrOffset === 'string') {
      this.ramOffset = CONSOLE_RAM_OFFSETS[consoleOrOffset] ?? 0;
    } else {
      this.ramOffset = consoleOrOffset;
    }
  }

  /**
   * Get the RAM base offset.
   */
  getRamOffset(): number {
    return this.ramOffset;
  }

  // ==================== Input Methods ====================

  /**
   * Press and hold a button.
   * The button stays pressed until release() is called.
   */
  press(button: Button): void {
    const index = BUTTON_MAP[button];
    if (index === undefined) {
      throw new Error(`Unknown button: ${button}`);
    }
    this.bridge.simulateInput(this.playerIndex, index, true);
    this.heldButtons.add(button);
  }

  /**
   * Release a held button.
   */
  release(button: Button): void {
    const index = BUTTON_MAP[button];
    if (index === undefined) {
      throw new Error(`Unknown button: ${button}`);
    }
    this.bridge.simulateInput(this.playerIndex, index, false);
    this.heldButtons.delete(button);
  }

  /**
   * Release all currently held buttons.
   */
  releaseAll(): void {
    for (const button of this.heldButtons) {
      this.release(button);
    }
  }

  /**
   * Tap a button: press, advance one frame, release.
   */
  async tap(button: Button): Promise<void> {
    this.press(button);
    await this.step();
    this.release(button);
  }

  /**
   * Hold a button for a specified number of frames.
   */
  async hold(button: Button, frames: number): Promise<void> {
    this.press(button);
    await this.stepFrames(frames);
    this.release(button);
  }

  /**
   * Hold multiple buttons simultaneously for a specified number of frames.
   */
  async holdMultiple(buttons: Button[], frames: number): Promise<void> {
    for (const button of buttons) {
      this.press(button);
    }
    await this.stepFrames(frames);
    for (const button of buttons) {
      this.release(button);
    }
  }

  /**
   * Check if a button is currently held.
   */
  isPressed(button: Button): boolean {
    return this.heldButtons.has(button);
  }

  // ==================== Frame Control ====================

  /**
   * Advance the game by exactly one frame.
   */
  async step(): Promise<void> {
    await this.bridge.stepFrame();
  }

  /**
   * Advance the game by multiple frames.
   */
  async stepFrames(count: number): Promise<void> {
    await this.bridge.stepFrames(count);
  }

  /**
   * Get the current frame number.
   */
  get frameNumber(): number {
    return this.bridge.getFrameNumber();
  }

  /**
   * Pause the game.
   */
  pause(): void {
    this.bridge.pause();
  }

  /**
   * Resume the game (run continuously).
   */
  play(): void {
    this.bridge.play();
  }

  // ==================== Memory Access ====================

  /**
   * Read a value from game memory.
   *
   * @param address - The game-specific memory address
   * @param type - Memory type specification (e.g., ">i2" for big-endian signed 16-bit)
   * @returns The value at the specified address
   *
   * @example
   * // Read Sonic's X position (Genesis, big-endian signed 16-bit)
   * const xPos = controller.readMemory(0xD008, ">i2");
   */
  readMemory(address: number, type: MemoryType = 'u1'): number {
    const fullAddress = this.ramOffset + address;

    // Parse type string
    const endian = type.startsWith('<') ? 'little' : type.startsWith('>') ? 'big' : 'little';
    const typeWithoutEndian = type.replace(/^[<>]/, '');
    const signed = typeWithoutEndian.startsWith('i');
    const bytes = parseInt(typeWithoutEndian.slice(1), 10);

    // Read the raw bytes
    const rawBytes = this.bridge.readMemoryBytes(fullAddress, bytes);

    // Combine bytes according to endianness
    let value = 0;
    if (endian === 'little') {
      for (let i = bytes - 1; i >= 0; i--) {
        value = (value << 8) | rawBytes[i];
      }
    } else {
      for (let i = 0; i < bytes; i++) {
        value = (value << 8) | rawBytes[i];
      }
    }

    // Handle signed values
    if (signed) {
      const signBit = 1 << (bytes * 8 - 1);
      if (value & signBit) {
        value = value - (1 << (bytes * 8));
      }
    }

    return value;
  }

  /**
   * Read a byte from game memory (shorthand for readMemory with u1).
   */
  readByte(address: number): number {
    return this.readMemory(address, 'u1');
  }

  /**
   * Read multiple bytes from game memory.
   */
  readBytes(address: number, length: number): Uint8Array {
    return this.bridge.readMemoryBytes(this.ramOffset + address, length);
  }

  // ==================== Stable Retro Integration ====================

  /**
   * Load game data (variable mappings) for a specific game.
   * This enables getVariable() and getState() methods.
   *
   * @param gameId - Game identifier like "SonicTheHedgehog2-Genesis"
   *
   * @example
   * controller.loadGameData('SonicTheHedgehog2-Genesis');
   * const xPos = controller.getVariable('x');
   */
  loadGameData(gameId: GameId): void {
    this.memoryReader.loadGame(gameId);
  }

  /**
   * Discover the work RAM base address and configure memory reads.
   *
   * For Genesis games, the emulator allocates work RAM dynamically in WASM heap.
   * This method uses the cheat system to locate the RAM, then configures the
   * memory offset so that data.json addresses map to correct HEAPU8 locations.
   *
   * Must be called after the game is running (not just loaded).
   *
   * @param consoleType - Console type for base address calculation (default: 'genesis')
   * @returns The discovered base address
   */
  async discoverMemory(consoleType: string = 'genesis'): Promise<number> {
    const base = await this.bridge.discoverWorkRamBase();
    const consoleRamBase = CONSOLE_RAM_OFFSETS[consoleType] ?? 0;
    // data.json addresses = consoleRamBase + relative_offset
    // HEAPU8 address = base + relative_offset
    // So: HEAPU8 addr = data.json addr + (base - consoleRamBase)
    const offset = base - consoleRamBase;
    this.memoryReader.setMemoryOffset(offset);
    console.log(`[GameController] Memory discovered: base=0x${base.toString(16)}, offset=${offset}`);
    return base;
  }

  /**
   * Read a named variable from game memory using Stable Retro mappings.
   * Requires loadGameData() to be called first.
   *
   * @param name - Variable name from data.json (e.g., "x", "rings", "lives")
   * @returns The current value of the variable
   * @throws If game data is not loaded or variable is not found
   *
   * @example
   * controller.loadGameData('SonicTheHedgehog2-Genesis');
   * const xPos = controller.getVariable('x');
   * const rings = controller.getVariable('rings');
   */
  getVariable(name: string): number {
    return this.memoryReader.getVariable(name);
  }

  /**
   * Read all named variables from game memory.
   * Requires loadGameData() to be called first.
   *
   * @returns Object with all variable names and their current values
   *
   * @example
   * controller.loadGameData('SonicTheHedgehog2-Genesis');
   * const state = controller.getState();
   * console.log(state.x, state.rings, state.lives);
   */
  getState(): GameState {
    return this.memoryReader.getState();
  }

  /**
   * Get available variable names for the loaded game.
   */
  getVariableNames(): string[] {
    return this.memoryReader.getVariableNames();
  }

  /**
   * Check if a variable exists in the loaded game data.
   */
  hasVariable(name: string): boolean {
    return this.memoryReader.hasVariable(name);
  }

  /**
   * Check if game data is loaded.
   */
  get hasGameData(): boolean {
    return this.memoryReader.isLoaded;
  }

  /**
   * Get the MemoryReader for advanced access.
   */
  getMemoryReader(): MemoryReader {
    return this.memoryReader;
  }

  // ==================== State Management ====================

  /**
   * Save the current game state.
   */
  saveState(): Uint8Array {
    return this.bridge.saveState();
  }

  /**
   * Load a previously saved game state.
   */
  loadState(state: Uint8Array): void {
    this.bridge.loadState(state);
  }

  /**
   * Take a screenshot.
   */
  async screenshot(): Promise<Uint8Array> {
    return this.bridge.screenshot();
  }

  /**
   * Restart the game.
   */
  restart(): void {
    this.releaseAll();
    this.bridge.restart();
  }

  // ==================== Utility Methods ====================

  /**
   * Wait for a specified number of frames (alias for stepFrames).
   */
  async wait(frames: number): Promise<void> {
    await this.stepFrames(frames);
  }

  /**
   * Check if the emulator is ready.
   */
  get isReady(): boolean {
    return this.bridge.isReady;
  }

  /**
   * Get the underlying EmulatorBridge for advanced operations.
   */
  getBridge(): EmulatorBridge {
    return this.bridge;
  }
}

/**
 * Create a GameController from configuration.
 * Convenience function that sets up both bridge and controller.
 */
export async function createGameController(config: {
  containerId: string;
  gameUrl: string;
  core: string;
  dataPath?: string;
  console?: string;
}): Promise<GameController> {
  const bridge = new EmulatorBridge({
    containerId: config.containerId,
    gameUrl: config.gameUrl,
    core: config.core,
    dataPath: config.dataPath,
  });

  await bridge.load();

  const controller = new GameController(bridge);

  if (config.console) {
    controller.setRamOffset(config.console);
  }

  return controller;
}
