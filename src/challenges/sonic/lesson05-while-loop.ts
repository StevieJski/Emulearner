/**
 * Lesson 5: While Loop
 *
 * Introduction to loops - repeat actions until a condition is met.
 * Teaches: while loops, checking game state in loops
 */

import { Challenge } from '../types';

export const lesson05WhileLoop: Challenge = {
  id: 'sonic-lesson-05-while-loop',
  lessonNumber: 5,
  name: 'Loop Until Goal',
  description: `
What if you don't know exactly how many frames you need?

A **while loop** repeats code until a condition becomes false:
\`\`\`javascript
while (condition) {
  // This code runs repeatedly
  // until condition is false
}
\`\`\`

Your goal is to move Sonic past x = 1000. That's pretty far!
Instead of guessing how many frames, use a loop that checks
Sonic's position and keeps going until he's past the target.

**Important:** Always include \`await game.step()\` inside your loop!
`,
  game: 'SonicTheHedgehog2-Genesis',
  goal: (state) => state.x > 1000,
  goalDescription: 'Move Sonic past x > 1000 using a while loop',
  maxFrames: 1200,
  hints: [
    'Use game.getVariable("x") to check Sonic\'s current x position',
    'Your condition should be: game.getVariable("x") < 1000',
    'Don\'t forget: await game.step() inside the loop to advance frames!',
  ],
  starterCode: `// Move Sonic to x > 1000 using a while loop

game.press('right');

// Keep stepping until we reach the goal
while (game.getVariable('x') < 1000) {
  await game.step();
}
`,
  concepts: ['while-loops', 'conditionals'],
  difficulty: 'beginner',
  solution: `game.press('right');
while (game.getVariable('x') < 1000) {
  await game.step();
}`,
};
