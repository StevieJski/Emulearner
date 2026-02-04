# Emulearner: Learn TypeScript Through Retro Games

## Vision
A browser-based coding education platform where students learn TypeScript by writing code to control classic video games. Built on EmulatorJS with Stable Retro data compatibility.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser                                      │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │   Monaco     │  │  Challenge   │  │      EmulatorJS            │ │
│  │   Editor     │  │  UI/Sidebar  │  │  (WASM RetroArch cores)    │ │
│  │ (TypeScript) │  │              │  │                            │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────────┬──────────────┘ │
│         │                 │                        │                 │
│         ▼                 ▼                        ▼                 │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Emulearner Runtime                            ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  ││
│  │  │ TypeScript  │  │  Challenge  │  │   Stable Retro Data     │  ││
│  │  │ Sandbox     │  │  Engine     │  │   Parser (TS types)     │  ││
│  │  │ (eval/VM)   │  │             │  │                         │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

**Key Insight**: Everything runs in the browser. No backend required for core functionality.

## Core Concepts

### Student Experience
1. Select a lesson (e.g., "Lesson 1: Move Sonic Right")
2. Read challenge description and hints
3. Write TypeScript code in Monaco editor
4. Click "Run" - code executes controlling the game
5. See success/failure with animated playback
6. Progress to next lesson

### Code Execution Model
```typescript
// Student writes code like this:
export async function solve(game: GameController): Promise<void> {
  // Move right for 60 frames
  for (let i = 0; i < 60; i++) {
    game.press("right");
    await game.step();
  }
}
```

### Challenge Definition
```typescript
interface Challenge {
  lesson: number;
  name: string;
  game: string;              // "SonicTheHedgehog-Genesis"
  state: string;             // "GreenHillZone.Act1"
  description: string;
  hints: string[];
  starterCode: string;
  goal: GoalFunction;        // Validates success
  maxFrames: number;
}
```

## Stable Retro Data Integration

### TypeScript Types for Stable Retro Files

```typescript
// ============ data.json ============
// Maps game variables to RAM addresses

type ByteOrder = "|" | ">" | "<";  // native, big-endian, little-endian
type DataTypeChar = "i" | "u" | "n";  // signed, unsigned, BCD
type DataType = `${ByteOrder}${DataTypeChar}${number}`;

interface VariableMapping {
  address: number;
  type: DataType;  // e.g., "|i1", ">u2", "<u4"
}

interface DataJson {
  info: Record<string, VariableMapping>;
}

// Example: SonicTheHedgehog-Genesis data.json
// {
//   "info": {
//     "x": { "address": 16593248, "type": ">i2" },
//     "y": { "address": 16593252, "type": ">i2" },
//     "rings": { "address": 16787438, "type": ">u2" },
//     "lives": { "address": 16787694, "type": "|u1" }
//   }
// }

// ============ scenario.json ============
// Defines episode termination and rewards

type ComparisonOp = "zero" | "equal" | "negative" | "positive" | "nonzero";

interface DoneCondition {
  variables?: Record<string, {
    op: ComparisonOp;
    reference?: number;
  }>;
  script?: string;  // "lua:function_name"
  condition?: "any" | "all";  // How to combine multiple conditions
}

interface RewardConfig {
  variables?: Record<string, {
    reward?: number;   // Points per unit increase
    penalty?: number;  // Points per unit decrease
  }>;
  script?: string;
}

interface ScenarioJson {
  done: DoneCondition;
  reward?: RewardConfig;
  crop?: [number, number, number, number];  // [top, left, bottom, right]
  actions?: number[][];  // Button combinations per axis
  scripts?: string[];    // Lua script files to load
}

// ============ metadata.json ============
interface MetadataJson {
  default_state: string;  // State file name without .state extension
}

// ============ Game State ============
interface GameState {
  [variable: string]: number;  // Values extracted from RAM
}
```

### Console RAM Base Offsets

Stable Retro addresses are relative to console RAM start. EmulatorJS exposes the full core memory heap, so we need offsets:

| Console | RAM Base Offset | Notes |
|---------|-----------------|-------|
| NES | `0` | Direct mapping to main RAM |
| SNES | `8257536` | Offset from core's total memory heap |
| Genesis | `16711680` | Maps to $FF0000 region |
| GBA | TBD | Need to determine experimentally |

### RAM Reading Implementation

```typescript
// Console-specific offsets
const RAM_BASE_OFFSETS: Record<string, number> = {
  nes: 0,
  snes: 8257536,
  genesis: 16711680,
};

class MemoryReader {
  private console: string;
  private baseOffset: number;

  constructor(console: string) {
    this.console = console;
    this.baseOffset = RAM_BASE_OFFSETS[console] ?? 0;
  }

  private getMemoryBuffer(): Uint8Array {
    // Access EmulatorJS core memory heap
    return window.EJS_emulator.core.HEAPU8;
  }

  read(mapping: VariableMapping): number {
    const { address, type } = mapping;
    const absoluteAddress = address + this.baseOffset;
    const [order, kind, size] = this.parseType(type);

    const buffer = this.getMemoryBuffer();
    const bytes = buffer.slice(absoluteAddress, absoluteAddress + size);
    return this.decodeValue(bytes, order, kind, size);
  }

  private parseType(type: DataType): [ByteOrder, DataTypeChar, number] {
    // Parse ">u2" into [">", "u", 2]
    const order = type[0] as ByteOrder;
    const kind = type[1] as DataTypeChar;
    const size = parseInt(type.slice(2), 10);
    return [order, kind, size];
  }

  private decodeValue(bytes: Uint8Array, order: ByteOrder,
                      kind: DataTypeChar, size: number): number {
    // Handle endianness
    let value = 0;
    if (order === ">" || order === "|") {
      // Big-endian or native (treat as big for single bytes)
      for (let i = 0; i < size; i++) {
        value = (value << 8) | bytes[i];
      }
    } else {
      // Little-endian
      for (let i = size - 1; i >= 0; i--) {
        value = (value << 8) | bytes[i];
      }
    }

    // Handle signed values
    if (kind === "i") {
      const signBit = 1 << (size * 8 - 1);
      if (value & signBit) {
        value = value - (1 << (size * 8));
      }
    }

    // Handle BCD (Binary Coded Decimal)
    if (kind === "n") {
      let bcdValue = 0;
      let multiplier = 1;
      for (let i = size - 1; i >= 0; i--) {
        const lo = bytes[i] & 0x0F;
        const hi = (bytes[i] >> 4) & 0x0F;
        bcdValue += lo * multiplier;
        multiplier *= 10;
        bcdValue += hi * multiplier;
        multiplier *= 10;
      }
      value = bcdValue;
    }

    return value;
  }
}

// Usage example - create sensors from data.json
function createSensors(dataJson: DataJson, console: string): Record<string, () => number> {
  const reader = new MemoryReader(console);
  const sensors: Record<string, () => number> = {};

  for (const [name, mapping] of Object.entries(dataJson.info)) {
    sensors[name] = () => reader.read(mapping);
  }

  return sensors;
}

// Expose to students as hero object
const hero = createSensors(sonicDataJson, "genesis");
// Student code: if (hero.x() > 500) { ... }
```
```

## Project Structure

```
Emulearner/
├── src/                          # TypeScript source (new)
│   ├── core/
│   │   ├── Hero.ts               # Student-facing API (moveRight, jump, etc.)
│   │   ├── GameController.ts     # Low-level emulator control
│   │   ├── MemoryReader.ts       # Read game state from RAM
│   │   └── CodeSandbox.ts        # Safe TypeScript execution (Web Worker)
│   ├── challenges/
│   │   ├── Challenge.ts          # Challenge interface & types
│   │   ├── ChallengeRunner.ts    # Execution engine
│   │   ├── ChallengeRegistry.ts  # Lookup by lesson number/name
│   │   ├── airstriker/           # Beginner track (Lessons 1-15)
│   │   │   ├── lesson01-move-right.ts
│   │   │   ├── lesson08-loop-patrol.ts
│   │   │   ├── lesson15-precision-nav.ts  # Capstone
│   │   │   └── index.ts
│   │   └── sonic/                # Intermediate track (Lessons 16-25)
│   │       ├── lesson16-first-function.ts
│   │       ├── lesson25-speed-run.ts      # Capstone
│   │       └── index.ts
│   ├── strategies/               # Game-specific button mappings
│   │   ├── GameStrategy.ts       # Interface
│   │   ├── AirstrikerStrategy.ts
│   │   └── SonicStrategy.ts
│   ├── data/
│   │   ├── types.ts              # Stable Retro type definitions
│   │   ├── parser.ts             # Load data.json, scenario.json, etc.
│   │   └── games/                # Game-specific data (from stable-retro)
│   │       ├── Airstriker-Genesis/
│   │       │   ├── data.json
│   │       │   └── metadata.json
│   │       ├── SonicTheHedgehog2-Genesis/
│   │       │   ├── data.json
│   │       │   └── metadata.json
│   │       └── ...
│   ├── progress/
│   │   ├── ProgressTracker.ts    # Save/load completion state
│   │   └── types.ts              # Progress interfaces
│   ├── ui/
│   │   ├── App.tsx               # Main React app
│   │   ├── components/
│   │   │   ├── Editor.tsx        # Monaco wrapper with TypeScript
│   │   │   ├── GameCanvas.tsx    # EmulatorJS wrapper
│   │   │   ├── ChallengePanel.tsx
│   │   │   ├── HintSystem.tsx    # Progressive hint display
│   │   │   ├── ProgressBar.tsx   # Lesson completion
│   │   │   └── ResultDisplay.tsx
│   │   └── hooks/
│   │       ├── useChallenge.ts
│   │       └── useProgress.ts
│   └── index.ts                  # Entry point
├── data/                         # EmulatorJS assets (existing)
│   ├── src/
│   │   ├── emulator.js           # Modify for programmatic control
│   │   ├── GameManager.js        # Extend with frame stepping
│   │   └── ...
│   ├── cores/                    # WASM cores
│   └── ...
├── public/
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── PLAN.md                       # This file
```

## Curriculum to Port (25 Lessons)

### Beginner Track: Airstriker (Lessons 1-15)

| # | Name | Concept | Goal | Key Learning |
|---|------|---------|------|--------------|
| 1 | Move Right | commands | x > 100 | Single command execution |
| 2 | Dodge Up | commands | y >= 50 | Vertical movement |
| 3 | Dive Down | commands | y <= 49 | Opposite direction |
| 4 | Navigate | sequencing | x > 100, y >= 50 | Combine commands |
| 5 | Variable Distance | variables | x > 120 | Replace magic numbers |
| 6 | Two Variables | variables | x > 100, y >= 50 | Multiple variables |
| 7 | Reuse Variable | variables | x > 150 | Same var, multiple uses |
| 8 | Loop Patrol | while loops | x > 150 | First loop |
| 9 | Variable Target | loops + vars | x > 140 | Variable in condition |
| 10 | Climb Up | loops | y >= 50 | Vertical loop |
| 11 | Two Loops | sequencing | x > 100, y >= 50 | Sequential loops |
| 12 | Conditional Dodge | if statements | x > 100, y >= 50 | Branching |
| 13 | Choose Direction | if-else | x > 100 | Explicit else |
| 14 | Lane Control | conditions | x > 120, y == 50 | Precision |
| 15 | Precision Nav | **capstone** | x > 150, y >= 50 | All concepts |

### Intermediate Track: Sonic (Lessons 16-25)

| # | Name | Concept | Goal | Key Learning |
|---|------|---------|------|--------------|
| 16 | First Function | functions | x > 300 | Function definition |
| 17 | Parameters | params | x > 400 | Parameterized functions |
| 18 | Jump Function | functions | x > 500 | Pre-defined function call |
| 19 | Loop in Function | composition | x > 600 | Loop inside function |
| 20 | Jump To Target | loops + funcs | x > 800 | Parameterized + loop |
| 21 | Multiple Functions | organization | x > 700 | Multiple functions |
| 22 | Smart Movement | conditionals | x > 600 | If-else in function |
| 23 | Height Aware | game state | x > 700 | Reading y position |
| 24 | Function Library | reusability | x > 900 | Building toolkit |
| 25 | Speed Run | **optimization** | x > 1000, <300f | Efficiency |

### Adaptation for TypeScript

**Python → TypeScript syntax changes**:
```python
# Python (ArcadeCoder)
def move_to(target):
    while hero.x < target:
        hero.move_right()
```

```typescript
// TypeScript (Emulearner)
function moveTo(target: number): void {
  while (hero.x < target) {
    hero.moveRight();
  }
}
```

**Concept mapping**:
- `def` → `function` (Lessons 16-25)
- Indentation → Braces `{}`
- `snake_case` → `camelCase`
- Type annotations encouraged (but optional for beginners)

## Implementation Phases

### Phase 1: TypeScript Foundation
**Goal**: Convert EmulatorJS to TypeScript, establish build system

1. Set up Vite + TypeScript + React
2. Create TypeScript declarations for EmulatorJS
3. Wrap EmulatorJS in typed GameController class
4. Implement MemoryReader for RAM access
5. Create Stable Retro data parsers

**Deliverable**: Can load a game and read RAM values in TypeScript

### Phase 2: Challenge System
**Goal**: Port challenge concept from ArcadeCoder

1. Define Challenge interface
2. Implement ChallengeEngine (run code, validate goals)
3. Create CodeSandbox for safe student code execution
4. Port 5 basic Sonic challenges as proof of concept
5. Implement goal checking using scenario.json rules

**Deliverable**: Can run a challenge and detect success/failure

### Phase 3: User Interface
**Goal**: Build the learning environment

1. Monaco editor with TypeScript support
2. Challenge selection sidebar
3. Game display canvas (EmulatorJS integration)
4. Result display (success/error messages)
5. Frame playback for reviewing runs

**Deliverable**: Functional web UI for coding challenges

### Phase 4: Content & Polish
**Goal**: Create curriculum and refine UX

1. Port remaining challenges from ArcadeCoder
2. Add more games (NES, SNES, GBA)
3. Progressive difficulty system
4. Save/load student progress
5. Syntax highlighting for game API

**Deliverable**: Complete learning platform

## Key Technical Decisions

### Code Execution Strategy
**Options**:
1. **eval()** - Simple but security concerns
2. **Function constructor** - Slightly safer
3. **Web Worker + iframe** - Best isolation
4. **Pyodide** - Run actual Python (not for TypeScript)

**Recommendation**: Web Worker with limited API exposure
- Student code runs in isolated Worker
- Only `GameController` API exposed
- Timeout protection for infinite loops

### State File Handling
EmulatorJS uses different state formats than Stable Retro. Options:
1. Convert .state files to EmulatorJS format
2. Use EmulatorJS native states, create new checkpoints
3. Build adapter layer

**Recommendation**: Create new states in EmulatorJS format
- More reliable than conversion
- Can match Stable Retro positions by playing to checkpoints
- Store as base64 in challenge definitions

### Memory Access
EmulatorJS doesn't expose raw RAM by default. Options:
1. Modify RetroArch cores to expose memory
2. Use existing `getCoreOptions()` if memory exposed
3. Rely on visual/state comparison instead of RAM

**Recommendation**: Investigate core memory exposure first
- Check if `Module.HEAPU8` accessible
- May need core modifications for direct RAM access

## API Design for Students

### GameController Interface
```typescript
interface GameController {
  // Input methods
  press(button: Button): void;
  release(button: Button): void;
  hold(button: Button, frames: number): Promise<void>;

  // Frame control
  step(): Promise<void>;           // Advance one frame
  stepFrames(n: number): Promise<void>;

  // State reading (from data.json mappings)
  getState(): GameState;           // All variables
  get(variable: string): number;   // Single variable

  // Utilities
  screenshot(): ImageData;
  saveState(): StateSnapshot;
  loadState(snapshot: StateSnapshot): void;
}

type Button = "up" | "down" | "left" | "right" |
              "a" | "b" | "x" | "y" |
              "start" | "select" |
              "l" | "r";
```

### Example Challenge Code
```typescript
// Lesson 1: Move Sonic to x=1000
export async function solve(game: GameController): Promise<void> {
  while (game.get("x") < 1000) {
    game.press("right");
    await game.step();
  }
}

// Lesson 5: Collect 10 rings
export async function solve(game: GameController): Promise<void> {
  const targetRings = game.get("rings") + 10;

  while (game.get("rings") < targetRings) {
    // Student implements ring collection logic
    game.press("right");
    if (shouldJump(game)) {
      game.press("a");
    }
    await game.step();
  }
}
```

## EmulatorJS Modifications Required

### 1. Expose Frame Stepping
Currently EmulatorJS runs continuously. Need single-frame control:
```javascript
// In GameManager.js
stepFrame() {
  Module._retro_run();  // Run exactly one frame
  return this.getFrameData();
}
```

### 2. RAM Access (Already Available!)
Memory is accessible via `window.EJS_emulator.core.HEAPU8`:
```javascript
// No modification needed - just use with correct offset
const buffer = window.EJS_emulator.core.HEAPU8;
const value = buffer[address + RAM_BASE_OFFSET];
```

### 3. Synchronous Input
Current input is event-based. Need direct control:
```javascript
// In GameManager.js
setInputState(player, inputs) {
  // Set all inputs atomically before frame step
  this.inputState[player] = inputs;
}
```

### 4. Disable Auto-Run
```javascript
// In emulator.js - new config option
EJS_manualFrameStep = true;  // Don't start main loop automatically
```

## Lessons Learned from ArcadeCoder

### Curriculum Design (Proven Pattern)

ArcadeCoder uses a **25-lesson curriculum across 2 difficulty tiers** that successfully teaches coding fundamentals:

| Tier | Lessons | Game | Concepts Taught |
|------|---------|------|-----------------|
| Beginner | 1-15 | Airstriker | Commands → Variables → Loops → Conditionals |
| Intermediate | 16-25 | Sonic 2 | Functions → Parameters → Optimization |

**Key insight**: Each lesson teaches **ONE new concept** while reinforcing prerequisites.

**Progression example**:
```
Lesson 1:  hero.x > 100     (single command)
Lesson 4:  hero.x > 100 && hero.y >= 50  (sequencing)
Lesson 8:  hero.x > 150     (while loop introduced)
Lesson 15: hero.x > 150 && hero.y >= 50  (capstone: loops + conditions)
Lesson 25: hero.x > 1000 in <300 frames  (optimization)
```

### Challenge Interface (Port Directly)

```typescript
interface Challenge {
  // Identification
  lessonNumber: number;
  name: string;
  description: string;

  // Execution
  game: string;
  state?: string;
  goal: (hero: Hero) => boolean;
  failCondition?: (hero: Hero) => boolean;
  maxFrames: number;  // Default 1800 (~30 sec at 60fps)

  // Pedagogy
  concepts: string[];      // ["functions", "loops"]
  hints: string[];         // Progressive hints (2-4 per challenge)
  starterCode: string;     // Scaffolded code

  // Progression
  prerequisites?: string[];
}
```

### Goal Function Patterns

**Pattern 1: Threshold** (most common)
```typescript
goal: (hero) => hero.x > 100
```

**Pattern 2: Multi-constraint**
```typescript
goal: (hero) => hero.x > 100 && hero.y >= 50
```

**Pattern 3: Exact position** (precision challenges)
```typescript
goal: (hero) => hero.x > 120 && hero.y === 50
```

**Pattern 4: Efficiency** (advanced)
```typescript
goal: (hero) => hero.x > 1000 && hero.frameCount < 300
```

### Starter Code Scaffolding

**Principle: Fade scaffolding as lessons progress**

```typescript
// Lesson 1: Minimal - just show where to write
`// Move right to reach x > 100
hero.moveRight();`

// Lesson 8: Structural - provide control flow
`while (hero.x < 150) {
  // Your code here
}`

// Lesson 15: Capstone - minimal scaffold, student owns it
`const targetX = 150;
while (hero.x < targetX) {
  // Navigate to the goal
}`
```

**Rules**:
- Use `// TODO:` comments or placeholder values
- Provide ~70% structure, student fills ~30%
- Never include commented-out solutions
- Keep under 5 lines for basic lessons

### Hint Design

**Structure**: 2-4 hints per challenge, progressive specificity

```typescript
// Lesson 8: While Loop
hints: [
  "Put hero.moveRight() inside the loop",           // Conceptual
  "Replace the TODO with your movement code",       // Structural
  "The loop continues until hero.x >= 150",         // Specific
]
```

**Rules**:
- Start abstract, get specific
- Reference syntax in final hints: `"Try: while (hero.x < 150)"`
- Never spoil the complete solution
- One sentence per hint

### Execution Architecture

**Condition checking order** (proven to work):
1. Syntax/runtime errors (try-catch)
2. Frame timeout (prevents infinite loops)
3. Fail condition (optional negative case)
4. Goal condition (success check)

**Sandboxing** (essential for security):
```typescript
const SAFE_GLOBALS = {
  console: { log: console.log },
  Math,
  Array,
  Object,
  // NO: import, require, fetch, eval
};
```

### Improvements to Implement in Emulearner

**From ArcadeCoder analysis - things to add**:

1. **Concept validation** - Parse AST to verify student used the taught concept
   ```typescript
   // Lesson 8 requires a while loop
   if (!studentCode.includes('while')) {
     return { success: false, message: "Try using a while loop!" };
   }
   ```

2. **Context-sensitive hints** - Analyze student code to suggest relevant hints
   ```typescript
   if (hasInfiniteLoop(studentCode)) {
     showHint("Check your loop condition - it might run forever!");
   }
   ```

3. **Progress persistence** - Save to localStorage
   ```typescript
   interface Progress {
     completedLessons: number[];
     bestFrameCounts: Record<number, number>;
     hintsUsed: Record<number, number>;
   }
   ```

4. **Trajectory visualization** - Show path vs goal on game canvas

5. **Intermediate checkpoints** - For lessons with big jumps in difficulty

## Why Use Stable Retro Data Files

1. **Community Powered**: No need to spend hours with a hex editor finding variables - someone already did it
2. **Standardized Format**: Used by leading AI research labs (OpenAI, Google DeepMind)
3. **Portable**: If you ever migrate to a different engine, the data format is universal
4. **Comprehensive**: Covers dozens of popular retro games with tested variable mappings

## Open Questions

1. **ROM Distribution**: How to legally provide game ROMs?
   - User provides their own?
   - Use homebrew games?
   - Partner with rights holders?

2. **GBA Memory Offset**: Need to determine RAM base offset for Game Boy Advance cores
   - Test experimentally with known game variables

3. **Performance**: Can we step frames fast enough for responsive feedback?
   - Target: 1000+ frames/second when fast-forwarding
   - May need Web Worker for computation

4. **State Compatibility**: Can we reliably recreate Stable Retro states?
   - Test by comparing RAM values at known positions
   - May need position-matching rather than exact state restore

## Getting Started

```bash
# Clone and setup
cd ~/Emulearner
npm install

# Add TypeScript tooling
npm install -D typescript vite @vitejs/plugin-react
npm install react react-dom @monaco-editor/react

# Create tsconfig.json, vite.config.ts
# Start development server
npm run dev
```

## Success Metrics

- [ ] Load Sonic ROM and display in browser
- [ ] Execute TypeScript code that controls Sonic
- [ ] Read x position from RAM using data.json mapping
- [ ] Complete Lesson 1 challenge programmatically
- [ ] Full UI with editor, game view, challenge panel
- [ ] 25 challenges ported from ArcadeCoder
- [ ] Works on Chrome, Firefox, Safari

---

*This plan will be refined as implementation progresses.*
