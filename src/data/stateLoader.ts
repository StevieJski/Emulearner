/**
 * State Loader - Load save states from Stable Retro format
 *
 * Stable Retro states are gzip-compressed Genesis Plus GX save states.
 */

import { GameId } from './types';

// State file registry - maps state names to their file paths
const STATE_REGISTRY: Record<string, Record<string, string>> = {
  'SonicTheHedgehog2-Genesis': {
    'EmeraldHillZone.Act1': 'EmeraldHillZone.Act1.state',
  },
};

/**
 * Decompress gzip data
 */
async function decompressGzip(compressedData: Uint8Array): Promise<Uint8Array> {
  // Use DecompressionStream API (available in modern browsers)
  const blob = new Blob([compressedData as unknown as BlobPart]);
  const stream = blob.stream();
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
  const response = new Response(decompressedStream);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Load a state file for a game
 *
 * @param gameId - Game identifier
 * @param stateName - State name (e.g., "EmeraldHillZone.Act1")
 * @returns Decompressed state data as Uint8Array
 */
export async function loadState(
  gameId: GameId,
  stateName: string
): Promise<Uint8Array> {
  const gameStates = STATE_REGISTRY[gameId];
  if (!gameStates) {
    throw new Error(`No states available for game: ${gameId}`);
  }

  const stateFile = gameStates[stateName];
  if (!stateFile) {
    const available = Object.keys(gameStates).join(', ');
    throw new Error(
      `State "${stateName}" not found for ${gameId}. Available: ${available}`
    );
  }

  // Construct the path to the state file
  const statePath = `/src/data/games/${gameId}/states/${stateFile}`;

  try {
    // Fetch the compressed state file
    const response = await fetch(statePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch state: ${response.status}`);
    }

    const compressedData = new Uint8Array(await response.arrayBuffer());

    // Check if it's gzip compressed (magic bytes: 1f 8b)
    if (compressedData[0] === 0x1f && compressedData[1] === 0x8b) {
      return await decompressGzip(compressedData);
    }

    // Already decompressed
    return compressedData;
  } catch (error) {
    throw new Error(
      `Failed to load state "${stateName}" for ${gameId}: ${error}`
    );
  }
}

/**
 * Get available state names for a game
 */
export function getAvailableStates(gameId: GameId): string[] {
  const gameStates = STATE_REGISTRY[gameId];
  return gameStates ? Object.keys(gameStates) : [];
}

/**
 * Check if a state exists for a game
 */
export function hasState(gameId: GameId, stateName: string): boolean {
  const gameStates = STATE_REGISTRY[gameId];
  return gameStates ? stateName in gameStates : false;
}

/**
 * Get the default state name for a game (first level)
 */
export function getDefaultState(gameId: GameId): string | undefined {
  const states = getAvailableStates(gameId);
  return states[0];
}
