/**
 * Types for Stable Retro data.json format
 *
 * These types define the structure used by OpenAI's retro/stable-retro
 * for mapping game memory addresses to named variables.
 */

/**
 * Memory type specification string format:
 * - First character: endianness
 *   - '>' = big endian
 *   - '<' = little endian
 *   - '|' = not applicable (single byte)
 * - Second character: signedness
 *   - 'u' = unsigned
 *   - 'i' = signed
 * - Remaining characters: byte count ('1', '2', '4', '8')
 *
 * Examples:
 * - "|u1" = unsigned byte (endianness doesn't matter)
 * - ">u2" = big-endian unsigned 16-bit
 * - "<i4" = little-endian signed 32-bit
 */
export type StableRetroTypeSpec = string;

/**
 * Parsed memory type information
 */
export interface ParsedMemoryType {
  endian: 'big' | 'little' | 'native';
  signed: boolean;
  bytes: number;
}

/**
 * A single variable mapping from data.json
 */
export interface VariableMapping {
  address: number;
  type: StableRetroTypeSpec;
}

/**
 * The "info" section of data.json containing variable mappings
 */
export type VariableInfo = Record<string, VariableMapping>;

/**
 * Complete data.json structure
 */
export interface DataJson {
  info: VariableInfo;
}

/**
 * A single goal condition from scenario.json
 */
export interface ScenarioCondition {
  op?: 'equal' | 'not-equal' | 'less-than' | 'greater-than' | 'zero' | 'nonzero';
  reference?: number | string;
  reward?: number;
  penalty?: number;
  measurement?: string;
  delta?: boolean;
}

/**
 * Reward structure in scenario.json
 */
export interface ScenarioReward {
  variables?: Record<string, ScenarioCondition>;
}

/**
 * Done condition structure in scenario.json
 */
export interface ScenarioDone {
  variables?: Record<string, ScenarioCondition>;
  condition?: 'any' | 'all';
}

/**
 * Complete scenario.json structure
 */
export interface ScenarioJson {
  done?: ScenarioDone;
  reward?: ScenarioReward;
}

/**
 * Metadata.json structure for game info
 */
export interface MetadataJson {
  default_state?: string;
  default_player_state?: string;
}

/**
 * Game data bundle containing all parsed files
 */
export interface GameData {
  gameName: string;
  data: DataJson;
  scenario?: ScenarioJson;
  metadata?: MetadataJson;
}

/**
 * Supported game identifiers
 * Format: GameName-Console
 */
export type GameId =
  | 'SonicTheHedgehog2-Genesis'
  | string; // Allow custom games

/**
 * Console type to RAM offset mapping
 */
export type ConsoleType =
  | 'genesis'
  | 'snes'
  | 'nes'
  | 'gba'
  | 'gb'
  | 'gbc'
  | 'n64'
  | 'psx';
