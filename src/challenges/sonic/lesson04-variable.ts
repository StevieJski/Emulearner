/**
 * Lesson 4: Using Variables
 *
 * Introduction to variables - store a target value and use it.
 * Teaches: Variable declaration, using variables in conditions
 */

import { Challenge } from '../types';

export const lesson04Variable: Challenge = {
  id: 'sonic-lesson-04-variable',
  lessonNumber: 4,
  name: 'Target Position',
  description: `
Let's learn about **variables**!

A variable is like a labeled box that holds a value. You can create one like this:
\`\`\`javascript
let targetX = 600;
\`\`\`

Your goal is to move Sonic past a target position stored in a variable.
The target is **600** - you need to declare this variable and then move
Sonic past that x position.

**Why use variables?** They make your code flexible! If the target changes,
you only need to update one number.
`,
  game: 'SonicTheHedgehog2-Genesis',
  goal: (state) => state.x > 600,
  goalDescription: 'Move Sonic past x > 600 (use a variable!)',
  maxFrames: 800,
  hints: [
    'Declare a variable: let targetX = 600;',
    'You can use game.getVariable("x") to check Sonic\'s current position',
    'Compare values: game.getVariable("x") > targetX',
  ],
  starterCode: `// Declare a target variable
let targetX = 600;

// Move Sonic past the target position
game.press('right');

// How many frames do you need?
await game.stepFrames(100); // Probably not enough...
`,
  concepts: ['variables'],
  difficulty: 'beginner',
  solution: `let targetX = 600;
game.press('right');
await game.stepFrames(250);`,
};
