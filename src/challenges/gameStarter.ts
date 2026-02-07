/**
 * Game Starter - Automatically navigate through game menus
 *
 * Provides automated sequences to get from title screen to gameplay
 * for different games. Uses memory-mapped game_mode variable to verify
 * actual game state instead of blind frame stepping.
 */

import { GameController } from '../core/GameController';
import { GameId } from '../data/types';

/**
 * Start sequence result
 */
export interface StartResult {
  success: boolean;
  message: string;
}

/**
 * Sonic 2 game_mode values (68000 address 0xFFF600)
 */
const SONIC2_MODE = {
  SEGA_LOGO: 0x00,
  TITLE: 0x04,
  DEMO: 0x08,
  GAMEPLAY: 0x0C,
  SPECIAL_STAGE: 0x8C,
} as const;

/**
 * Read the game_mode variable from RAM.
 * Returns -1 if memory hasn't been discovered yet or the read fails.
 */
function readGameMode(controller: GameController): number {
  try {
    return controller.getVariable('game_mode');
  } catch {
    return -1;
  }
}

/**
 * Check if Sonic 2 is in active gameplay by reading game_mode from RAM.
 */
export function isSonic2InGameplay(controller: GameController, _debug = false): boolean {
  if (!controller.isReady) return false;

  const mode = readGameMode(controller);
  if (_debug) {
    console.log(`[gameStarter] game_mode=0x${mode >= 0 ? mode.toString(16).toUpperCase() : '??'}`);
  }

  // Memory not discovered yet — not ready
  if (mode < 0) return false;

  return mode === SONIC2_MODE.GAMEPLAY || mode === SONIC2_MODE.SPECIAL_STAGE;
}

/**
 * Wait up to maxFrames for game_mode to change away from the given mode.
 * Steps in chunks for efficiency.
 */
async function waitForModeChange(
  controller: GameController,
  fromMode: number,
  maxFrames: number,
  chunkSize = 30,
): Promise<number> {
  let stepped = 0;
  while (stepped < maxFrames) {
    await controller.stepFrames(chunkSize);
    stepped += chunkSize;
    const mode = readGameMode(controller);
    if (mode >= 0 && mode !== fromMode) return mode;
  }
  return readGameMode(controller);
}

/**
 * Wait up to maxFrames for game_mode to reach a target mode.
 */
async function waitForMode(
  controller: GameController,
  targetMode: number,
  maxFrames: number,
  chunkSize = 30,
): Promise<boolean> {
  let stepped = 0;
  while (stepped < maxFrames) {
    const mode = readGameMode(controller);
    if (mode === targetMode) return true;
    await controller.stepFrames(chunkSize);
    stepped += chunkSize;
  }
  return readGameMode(controller) === targetMode;
}

/**
 * Automated start sequence for Sonic The Hedgehog 2
 *
 * Uses memory-mapped game_mode to verify each transition:
 * 1. Discover RAM layout
 * 2. Skip SEGA logo (wait for mode change)
 * 3. Press Start at title, then Start again for 1P mode
 * 4. Verify gameplay mode is reached
 */
export async function startSonic2(
  controller: GameController,
  onProgress?: (message: string) => void
): Promise<StartResult> {
  try {
    // Step 1: Load game data and discover memory
    onProgress?.('Discovering memory layout...');
    controller.loadGameData('SonicTheHedgehog2-Genesis');

    try {
      await controller.discoverMemory('genesis');
    } catch (e) {
      return { success: false, message: `Memory discovery failed: ${e}` };
    }

    // Step 2: Check if already in gameplay
    const currentMode = readGameMode(controller);
    if (currentMode === SONIC2_MODE.GAMEPLAY || currentMode === SONIC2_MODE.SPECIAL_STAGE) {
      onProgress?.('Game already running!');
      return { success: true, message: 'Game already in gameplay.' };
    }

    // Step 3: Wait through SEGA logo
    if (currentMode === SONIC2_MODE.SEGA_LOGO) {
      onProgress?.('Waiting for SEGA logo...');
      const newMode = await waitForModeChange(controller, SONIC2_MODE.SEGA_LOGO, 360);
      if (newMode === SONIC2_MODE.GAMEPLAY) {
        onProgress?.('Game started!');
        return { success: true, message: 'Game started!' };
      }
    }

    // Step 4: Retry loop — press Start to navigate menus
    for (let attempt = 0; attempt < 3; attempt++) {
      onProgress?.(`Pressing Start (attempt ${attempt + 1}/3)...`);

      // Press Start to get past title / select 1P
      await controller.tap('start');
      await controller.stepFrames(60);

      // Press Start again for 1P mode selection
      await controller.tap('start');

      onProgress?.('Waiting for level to load...');
      const reachedGameplay = await waitForMode(
        controller,
        SONIC2_MODE.GAMEPLAY,
        240,
      );

      if (reachedGameplay) {
        onProgress?.('Game started!');
        return { success: true, message: 'Game started! You can now run challenges.' };
      }

      // If we ended up back at SEGA logo or title, keep trying
      const mode = readGameMode(controller);
      console.log(`[gameStarter] Attempt ${attempt + 1} ended at mode 0x${mode.toString(16)}`);
    }

    // Final check
    const finalMode = readGameMode(controller);
    if (finalMode === SONIC2_MODE.GAMEPLAY || finalMode === SONIC2_MODE.SPECIAL_STAGE) {
      onProgress?.('Game started!');
      return { success: true, message: 'Game started!' };
    }

    return {
      success: false,
      message: `Could not reach gameplay. game_mode=0x${finalMode.toString(16).toUpperCase()}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error during auto-start: ${error}`,
    };
  }
}

/**
 * Start a game automatically based on game ID
 */
export async function startGame(
  gameId: GameId,
  controller: GameController,
  onProgress?: (message: string) => void
): Promise<StartResult> {
  switch (gameId) {
    case 'SonicTheHedgehog2-Genesis':
      return startSonic2(controller, onProgress);
    default:
      return {
        success: false,
        message: `No auto-start sequence available for ${gameId}`,
      };
  }
}

/**
 * Check if a game is ready for challenges
 */
export function isGameReady(
  gameId: GameId,
  controller: GameController,
  debug = false
): boolean {
  switch (gameId) {
    case 'SonicTheHedgehog2-Genesis':
      return isSonic2InGameplay(controller, debug);
    default:
      return true; // Assume ready for unknown games
  }
}
