/**
 * Lesson 3: Sequence of Actions
 *
 * Combine multiple inputs in sequence.
 * Teaches: Sequencing commands, combining horizontal and vertical movement
 */

import { Challenge } from '../types';

export const lesson03Sequence: Challenge = {
  id: 'sonic-lesson-03-sequence',
  lessonNumber: 3,
  name: 'Move and Jump',
  description: `
Now let's combine what you've learned!

Your goal is to:
1. Move Sonic to the right (x > 400)
2. AND have him in the air (y < 350)

You'll need to chain multiple commands together. The goal is checked
at every frame, so Sonic needs to be at both conditions **at the same time**.

**Strategy:** Move right first, then jump while still moving right!
`,
  game: 'SonicTheHedgehog2-Genesis',
  goal: (state) => state.x > 400 && state.y < 350,
  goalDescription: 'Reach x > 400 while airborne (y < 350)',
  maxFrames: 600,
  hints: [
    'You can press multiple buttons at the same time',
    'Try game.press("right") then game.press("a") to move and jump',
    'Use game.holdMultiple(["right", "a"], 30) to do both at once',
  ],
  starterCode: `// Move right AND jump!
// Both conditions must be true at the same time

game.press('right');
await game.stepFrames(100);
// Now add a jump...
`,
  concepts: ['sequences', 'expressions'],
  difficulty: 'beginner',
  solution: `game.press('right');
await game.stepFrames(100);
game.press('a');
await game.stepFrames(30);`,
};
