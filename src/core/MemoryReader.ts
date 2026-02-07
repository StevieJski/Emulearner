/**
 * MemoryReader - Stable Retro-aware memory reader
 *
 * Reads game variables using data.json mappings from the Stable Retro format.
 * Works in conjunction with GameController for educational challenges.
 */

import { DataJson, GameId, ParsedMemoryType, VariableMapping } from '../data/types';
import { loadDataJson, parseTypeSpec } from '../data/parser';
import { EmulatorBridge } from './EmulatorBridge';

/**
 * Game state as a record of variable names to values
 */
export type GameState = Record<string, number>;

/**
 * MemoryReader provides high-level access to game memory using
 * Stable Retro data.json variable mappings.
 */
export class MemoryReader {
  private bridge: EmulatorBridge;
  private gameId: GameId | null = null;
  private dataJson: DataJson | null = null;
  private _memoryOffset: number = 0;

  constructor(bridge: EmulatorBridge) {
    this.bridge = bridge;
  }

  /**
   * Set the memory offset applied to all data.json addresses.
   *
   * For Genesis, data.json uses absolute 68000 CPU addresses (e.g., 0xFFFE12).
   * The actual location in HEAPU8 is: dataJsonAddr + memoryOffset
   * where memoryOffset = discoveredBase - 0xFF0000 (typically negative).
   */
  setMemoryOffset(offset: number): void {
    this._memoryOffset = offset;
    console.log(`[MemoryReader] Memory offset set to ${offset} (0x${(offset >>> 0).toString(16)})`);
  }

  /**
   * Get the current memory offset.
   */
  get memoryOffset(): number {
    return this._memoryOffset;
  }

  /**
   * Load data.json for a specific game
   *
   * @param gameId - Game identifier like "SonicTheHedgehog2-Genesis"
   * @throws If game data is not found
   */
  loadGame(gameId: GameId): void {
    this.dataJson = loadDataJson(gameId);
    this.gameId = gameId;
  }

  /**
   * Check if game data is loaded
   */
  get isLoaded(): boolean {
    return this.dataJson !== null;
  }

  /**
   * Get the currently loaded game ID
   */
  get currentGame(): GameId | null {
    return this.gameId;
  }

  /**
   * Get available variable names for the loaded game
   */
  getVariableNames(): string[] {
    if (!this.dataJson) {
      return [];
    }
    return Object.keys(this.dataJson.info);
  }

  /**
   * Read a single variable by name
   *
   * @param name - Variable name from data.json (e.g., "x", "rings", "lives")
   * @returns The current value of the variable
   * @throws If game data is not loaded or variable is not found
   *
   * @example
   * reader.loadGame('SonicTheHedgehog2-Genesis');
   * const xPos = reader.getVariable('x');
   * const rings = reader.getVariable('rings');
   */
  getVariable(name: string): number {
    if (!this.dataJson) {
      throw new Error('No game data loaded. Call loadGame() first.');
    }

    const mapping = this.dataJson.info[name];
    if (!mapping) {
      const available = this.getVariableNames().join(', ');
      throw new Error(
        `Variable "${name}" not found. Available: ${available}`
      );
    }

    return this.readVariable(mapping);
  }

  /**
   * Read all variables for the loaded game
   *
   * @returns Object with all variable names and their current values
   * @throws If game data is not loaded
   *
   * @example
   * reader.loadGame('SonicTheHedgehog2-Genesis');
   * const state = reader.getState();
   * // { x: 100, y: 200, rings: 5, lives: 3, ... }
   */
  getState(): GameState {
    if (!this.dataJson) {
      throw new Error('No game data loaded. Call loadGame() first.');
    }

    const state: GameState = {};
    for (const [name, mapping] of Object.entries(this.dataJson.info)) {
      try {
        state[name] = this.readVariable(mapping);
      } catch {
        // Skip variables that fail to read (might be invalid addresses)
        state[name] = 0;
      }
    }
    return state;
  }

  /**
   * Check if a variable exists in the loaded game data
   */
  hasVariable(name: string): boolean {
    if (!this.dataJson) {
      return false;
    }
    return name in this.dataJson.info;
  }

  /**
   * Get the memory mapping for a variable
   */
  getMapping(name: string): VariableMapping | undefined {
    return this.dataJson?.info[name];
  }

  /**
   * Read a value using a VariableMapping
   */
  private readVariable(mapping: VariableMapping): number {
    const parsed = parseTypeSpec(mapping.type);
    const adjustedAddress = mapping.address + this._memoryOffset;
    return this.readMemoryTyped(adjustedAddress, parsed);
  }

  /**
   * Read memory using parsed type information
   */
  private readMemoryTyped(address: number, type: ParsedMemoryType): number {
    // Read the raw bytes
    const rawBytes = this.bridge.readMemoryBytes(address, type.bytes);

    // Handle single-byte reads
    if (type.bytes === 1) {
      const value = rawBytes[0];
      if (type.signed && value >= 128) {
        return value - 256;
      }
      return value;
    }

    // Combine bytes according to endianness
    let value = 0;
    if (type.endian === 'little') {
      for (let i = type.bytes - 1; i >= 0; i--) {
        value = (value << 8) | rawBytes[i];
      }
    } else {
      // 'big' or 'native' (we treat native as big for Genesis)
      for (let i = 0; i < type.bytes; i++) {
        value = (value << 8) | rawBytes[i];
      }
    }

    // Handle signed values using two's complement
    if (type.signed) {
      const signBit = 1 << (type.bytes * 8 - 1);
      if (value & signBit) {
        value = value - (1 << (type.bytes * 8));
      }
    }

    return value;
  }
}
