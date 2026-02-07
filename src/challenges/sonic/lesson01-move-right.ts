/**
 * Lesson 1: Move Right
 *
 * The simplest challenge - press a single button to move Sonic.
 * Teaches: Basic input commands, running code
 */

import { Challenge } from '../types';

export const lesson01MoveRight: Challenge = {
  id: 'sonic-lesson-01-move-right',
  lessonNumber: 1,
  name: 'Move Right',
  description: `
Welcome to your first challenge!

Sonic starts at position x = 64. Your goal is to move him to the right
until his x position is greater than 500.

Use the \`game.press()\` method to press a button, and \`game.step()\` to
advance the game by one frame.

**Hint:** To move right continuously, you'll need to call step() multiple times.
`,
  game: 'SonicTheHedgehog2-Genesis',
  goal: (state) => state.x > 500,
  goalDescription: 'Move Sonic to x > 500',
  maxFrames: 600, // ~10 seconds at 60fps
  hints: [
    'Use game.press("right") to start moving right',
    'Call game.step() to advance one frame - you need many frames to move far!',
    'Try using game.stepFrames(100) to advance multiple frames at once',
  ],
  starterCode: `// Move Sonic to the right!
// Sonic starts at x = 64, get him past x = 500

game.press('right');
// Now advance time so Sonic actually moves
await game.stepFrames(100);
`,
  concepts: ['sequences'],
  difficulty: 'beginner',
  solution: `game.press('right');
await game.stepFrames(200);`,
};
