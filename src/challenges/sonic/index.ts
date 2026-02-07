/**
 * Sonic The Hedgehog 2 - Challenge Collection
 *
 * Educational challenges using Sonic 2 for Genesis.
 */

import { Challenge } from '../types';
import { registerChallenges } from '../registry';

// Import individual lessons
import { lesson01MoveRight } from './lesson01-move-right';
import { lesson02Jump } from './lesson02-jump';
import { lesson03Sequence } from './lesson03-sequence';
import { lesson04Variable } from './lesson04-variable';
import { lesson05WhileLoop } from './lesson05-while-loop';

/**
 * All Sonic 2 challenges
 */
export const sonicChallenges: Challenge[] = [
  lesson01MoveRight,
  lesson02Jump,
  lesson03Sequence,
  lesson04Variable,
  lesson05WhileLoop,
];

/**
 * Register all Sonic challenges with the registry
 */
export function registerSonicChallenges(): void {
  registerChallenges(sonicChallenges);
}

// Export individual lessons for direct access
export {
  lesson01MoveRight,
  lesson02Jump,
  lesson03Sequence,
  lesson04Variable,
  lesson05WhileLoop,
};
