/**
 * Game Starter - Automatically navigate through game menus
 *
 * Provides automated sequences to get from title screen to gameplay
 * for different games.
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
 * Check if Sonic 2 is at the title screen or in gameplay
 *
 * NOTE: The stable-retro memory addresses don't match EmulatorJS's memory layout.
 * For now, we just return true if the emulator is ready - user must manually
 * start the game before running challenges.
 */
export function isSonic2InGameplay(controller: GameController, _debug = false): boolean {
  // Just check if the emulator/controller is ready
  // Memory address detection is not working with EmulatorJS memory layout
  return controller.isReady;
}

/**
 * Automated start sequence for Sonic The Hedgehog 2
 *
 * This sequence navigates from the SEGA logo through to gameplay:
 * 1. Wait for title screen
 * 2. Press Start
 * 3. Press Start/A on menu
 * 4. Wait for level to load
 */
export async function startSonic2(
  controller: GameController,
  onProgress?: (message: string) => void
): Promise<StartResult> {
  try {
    onProgress?.('Waiting for SEGA logo...');

    // Wait for SEGA logo (about 3 seconds at 60fps)
    await controller.stepFrames(180);

    onProgress?.('Pressing Start at title...');

    // Press Start to get past title screen
    await controller.tap('start');
    await controller.stepFrames(60);

    onProgress?.('Selecting 1 Player...');

    // Press Start for 1 Player mode
    await controller.tap('start');
    await controller.stepFrames(30);

    onProgress?.('Waiting for level to load...');

    // Wait for level to fully load (about 3 seconds)
    await controller.stepFrames(180);

    onProgress?.('Game started!');
    return {
      success: true,
      message: 'Game started! You can now run challenges.',
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
