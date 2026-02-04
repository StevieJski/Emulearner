# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Emulearner is a browser-based coding education platform that teaches TypeScript through interactive retro video game challenges. Built on EmulatorJS (v4.2.4), it uses WASM RetroArch cores to run classic games. Students write TypeScript code that controls games, with challenges progressing through different systems.

**Current State**: EmulatorJS core is functional. PLAN.md contains detailed architecture for the planned TypeScript/React transformation (not yet implemented).

## Commands

```bash
npm install          # Install dependencies
npm start            # Start dev server at http://localhost:8080
npm run minify       # Minify JS/CSS for production
npm run build        # Create 7z and zip archives in dist/
npm run docs         # Generate JSDoc documentation
npm run update       # Update contributors list
npm run update -- --ejs_v=X.X.X  # Set version number
npm run update -- --deps=true    # Update dependencies
```

## Architecture

### Core Components

- **EmulatorJS Class** (`data/src/emulator.js`, ~7300 lines) - Central orchestrator for the emulator, manages configuration, core loading, game state. Supports 30+ retro systems.

- **GameManager Class** (`data/src/GameManager.js`, ~470 lines) - Interface to RetroArch cores. Exposes `loadState()`, `saveState()`, `simulateInput()`, `getCoreOptions()`, `setVariable()`, `toggleFastForward()`, `toggleRewind()`.

- **Storage System** (`data/src/storage.js`) - IndexedDB wrapper for save game persistence.

- **Input Handling** (`data/src/gamepad.js`, `data/src/nipplejs.js`) - Gamepad polling and virtual joystick for touch.

### Configuration System

EmulatorJS is configured via global `window.EJS_*` variables before script load:
```javascript
window.EJS_pathtodata = "...";     // Path to data folder
window.EJS_gameUrl = "path/to/rom";
window.EJS_core = "genesis_plus_gx";
window.EJS_player = "emulator";    // Container element ID
window.EJS_DEBUG_XX = true;        // Load unminified for debugging
```

### File Structure

```
data/
├── src/           # JavaScript source modules
├── cores/         # WASM RetroArch cores (downloaded separately)
├── localization/  # 16+ language JSON files
├── emulator.css
├── loader.js      # Dynamic module loader
└── version.json
minify/            # Minification configuration
build.js           # Archive creation
update.js          # Dependency/version updates
```

### Memory Access

RAM accessible via `window.EJS_emulator.core.HEAPU8` with console-specific offsets:
- NES: `0`
- SNES: `8257536`
- Genesis: `16711680`

## Planned Architecture (see PLAN.md)

The future TypeScript/React conversion includes:
- **GameController** - Typed API for students (`press()`, `step()`, `getState()`)
- **MemoryReader** - Parse Stable Retro data.json for RAM variable mappings
- **ChallengeEngine** - Run code, validate goals, manage challenge progression
- **CodeSandbox** - Web Worker isolation for safe student code execution
- 25-lesson curriculum ported from ArcadeCoder project

## Code Style

- **Do not auto-format** - VS Code formatting breaks project consistency
- All files must end with newline (enforced by CI)
- Follow existing formatting patterns in codebase

VS Code users: create `.vscode/settings.json`:
```json
{
    "diffEditor.ignoreTrimWhitespace": false,
    "editor.formatOnPaste": false,
    "editor.formatOnSave": false
}
```

## Versioning

- **stable** - Tested releases (default for production)
- **latest** - Main branch code with stable cores
- **nightly** - Bleeding edge code + cores (updated daily)

CDN: `https://cdn.emulatorjs.org/<version>/data/`

## Notes

- Cores and minified files are not in the repo (since v4.0.9) - get from releases or CDN
- Everything runs client-side, no backend required
- GPL-3.0 licensed
