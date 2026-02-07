/**
 * Lesson 2: Jump
 *
 * Learn to use a different button and observe the y coordinate.
 * Teaches: Different buttons, vertical movement
 */

import { Challenge } from '../types';

export const lesson02Jump: Challenge = {
  id: 'sonic-lesson-02-jump',
  lessonNumber: 2,
  name: 'Jump Up',
  description: `
Time to learn about jumping!

In Sonic, the y coordinate works differently than you might expect:
- **Lower y values = higher on screen** (0 is at the top)
- **Higher y values = lower on screen**

Your goal is to make Sonic jump so his y position goes below 300.
(Remember: lower y = higher jump!)

**Button:** Use 'a' or 'b' to jump in Sonic games.
`,
  game: 'SonicTheHedgehog2-Genesis',
  goal: (state) => state.y < 300,
  goalDescription: 'Jump to y < 300',
  maxFrames: 300,
  hints: [
    'Press "a" or "b" to jump',
    'You need to hold the button for a bit for a higher jump',
    'Try game.hold("a", 30) to hold the button for 30 frames',
  ],
  starterCode: `// Make Sonic jump high!
// Remember: lower y = higher on screen

await game.tap('a'); // This is a quick tap - might not jump high enough!
`,
  concepts: ['sequences'],
  difficulty: 'beginner',
  solution: `await game.hold('a', 30);`,
};
