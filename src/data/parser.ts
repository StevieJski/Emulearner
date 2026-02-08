/**
 * Parser for Stable Retro data.json files
 *
 * Loads and parses game variable mappings from the Stable Retro format.
 */

import {
  DataJson,
  GameData,
  GameId,
  ParsedMemoryType,
  StableRetroTypeSpec,
  VariableInfo,
  VariableMapping,
} from './types';

// Import game data files
// These are statically imported to work with bundlers
import sonicData from './games/SonicTheHedgehog2-Genesis/data.json';
import airstrikerData from './games/Airstriker-Genesis/data.json';

/**
 * Registry of available game data
 */
const GAME_DATA_REGISTRY: Record<GameId, DataJson> = {
  'SonicTheHedgehog2-Genesis': sonicData as DataJson,
  'Airstriker-Genesis': airstrikerData as DataJson,
};

/**
 * Parse a Stable Retro type specification string
 *
 * @param typeSpec - Type spec like ">u2", "<i4", "|u1"
 * @returns Parsed type information
 *
 * @example
 * parseTypeSpec(">u2") // { endian: 'big', signed: false, bytes: 2 }
 * parseTypeSpec("|u1") // { endian: 'native', signed: false, bytes: 1 }
 * parseTypeSpec("<i4") // { endian: 'little', signed: true, bytes: 4 }
 */
export function parseTypeSpec(typeSpec: StableRetroTypeSpec): ParsedMemoryType {
  if (typeSpec.length < 3) {
    throw new Error(`Invalid type spec: ${typeSpec}`);
  }

  const endianChar = typeSpec[0];
  const signedChar = typeSpec[1];
  const bytesStr = typeSpec.slice(2);

  let endian: ParsedMemoryType['endian'];
  switch (endianChar) {
    case '>':
      endian = 'big';
      break;
    case '<':
      endian = 'little';
      break;
    case '|':
      endian = 'native';
      break;
    default:
      throw new Error(`Invalid endian character: ${endianChar}`);
  }

  let signed: boolean;
  switch (signedChar) {
    case 'u':
      signed = false;
      break;
    case 'i':
      signed = true;
      break;
    default:
      throw new Error(`Invalid signed character: ${signedChar}`);
  }

  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes) || bytes < 1 || bytes > 8) {
    throw new Error(`Invalid byte count: ${bytesStr}`);
  }

  return { endian, signed, bytes };
}

/**
 * Convert a Stable Retro type spec to GameController MemoryType format
 *
 * @param typeSpec - Stable Retro type spec like ">u2"
 * @returns GameController memory type like ">u2" (they're compatible!)
 */
export function toMemoryType(typeSpec: StableRetroTypeSpec): string {
  // The formats are actually the same, but we validate it
  parseTypeSpec(typeSpec); // Throws if invalid
  return typeSpec;
}

/**
 * Check if a game is available in the registry
 */
export function isGameAvailable(gameId: GameId): boolean {
  return gameId in GAME_DATA_REGISTRY;
}

/**
 * Get list of available games
 */
export function getAvailableGames(): GameId[] {
  return Object.keys(GAME_DATA_REGISTRY);
}

/**
 * Load data.json for a specific game
 *
 * @param gameId - Game identifier like "SonicTheHedgehog2-Genesis"
 * @returns Parsed DataJson object
 * @throws If game is not found
 *
 * @example
 * const data = loadDataJson('SonicTheHedgehog2-Genesis');
 * console.log(data.info.x); // { address: 16756744, type: ">u2" }
 */
export function loadDataJson(gameId: GameId): DataJson {
  const data = GAME_DATA_REGISTRY[gameId];
  if (!data) {
    const available = getAvailableGames().join(', ');
    throw new Error(
      `Game "${gameId}" not found. Available games: ${available}`
    );
  }
  return data;
}

/**
 * Get variable info from a loaded data.json
 *
 * @param data - Loaded DataJson
 * @returns Record of variable name to mapping
 */
export function getVariables(data: DataJson): VariableInfo {
  return data.info;
}

/**
 * Get a specific variable mapping
 *
 * @param data - Loaded DataJson
 * @param name - Variable name
 * @returns Variable mapping or undefined
 */
export function getVariable(
  data: DataJson,
  name: string
): VariableMapping | undefined {
  return data.info[name];
}

/**
 * Get all variable names from a data.json
 */
export function getVariableNames(data: DataJson): string[] {
  return Object.keys(data.info);
}

/**
 * Load complete game data bundle
 *
 * @param gameId - Game identifier
 * @returns GameData with data.json and optionally scenario/metadata
 */
export function loadGameData(gameId: GameId): GameData {
  const data = loadDataJson(gameId);

  // For now, we only have data.json
  // Scenario and metadata will be added as needed
  return {
    gameName: gameId,
    data,
    scenario: undefined,
    metadata: undefined,
  };
}

/**
 * Extract console type from game ID
 *
 * @param gameId - Game identifier like "SonicTheHedgehog2-Genesis"
 * @returns Console name like "Genesis"
 */
export function extractConsole(gameId: GameId): string {
  const parts = gameId.split('-');
  return parts[parts.length - 1];
}

/**
 * Debug helper: log all variables for a game
 */
export function logVariables(gameId: GameId): void {
  const data = loadDataJson(gameId);
  console.log(`Variables for ${gameId}:`);
  for (const [name, mapping] of Object.entries(data.info)) {
    const parsed = parseTypeSpec(mapping.type);
    console.log(
      `  ${name}: address=0x${mapping.address.toString(16)}, ` +
        `type=${mapping.type} (${parsed.endian} endian, ` +
        `${parsed.signed ? 'signed' : 'unsigned'}, ${parsed.bytes} bytes)`
    );
  }
}
