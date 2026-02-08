/**
 * TypeScript declarations for EmulatorJS
 */

export interface EmulatorJSConfig {
  gameUrl: string;
  dataPath?: string;
  system?: string;
  biosUrl?: string;
  gameName?: string;
  startOnLoad?: boolean;
  fullscreenOnLoad?: boolean;
  volume?: number;
  noAutoLoad?: boolean;
  loadStateOnStart?: string;
  pathtodata?: string;
  core?: string;
  player?: string;
  DEBUG_XX?: boolean;
  externalFiles?: Record<string, string>;
  shaders?: Record<string, string>;
}

export interface GameManagerFunctions {
  restart: () => void;
  loadState: (path: string, slot: number) => number;
  screenshot: () => void;
  simulateInput: (player: number, index: number, value: number) => void;
  toggleMainLoop: (playing: number) => void;
  getCoreOptions: () => string;
  setVariable: (option: string, value: string) => void;
  setCheat: (index: number, enabled: number, code: string) => void;
  resetCheat: () => void;
  toggleShader: (active: number) => void;
  getDiskCount: () => number;
  getCurrentDisk: () => number;
  setCurrentDisk: (disk: number) => void;
  getSaveFilePath: () => string;
  saveSaveFiles: () => void;
  supportsStates: () => number;
  loadSaveFiles: () => void;
  toggleFastForward: (active: number) => void;
  setFastForwardRatio: (ratio: number) => void;
  toggleRewind: (active: number) => void;
  setRewindGranularity: (value: number) => void;
  toggleSlowMotion: (active: number) => void;
  setSlowMotionRatio: (ratio: number) => void;
  getFrameNum: () => number;
  setVSync: (enabled: number) => void;
  setVideoRoation: (rotation: number) => void;
  getVideoDimensions: (type: string) => number;
  setKeyboardEnabled: (enabled: number) => void;
}

export interface EmscriptenFS {
  writeFile: (path: string, data: string | Uint8Array) => void;
  readFile: (path: string) => Uint8Array;
  unlink: (path: string) => void;
  mkdir: (path: string) => void;
  mount: (fs: unknown, options: unknown, mountpoint: string) => void;
  unmount: (mountpoint: string) => void;
  syncfs: (populate: boolean, callback: () => void) => void;
  analyzePath: (path: string) => { exists: boolean };
  filesystems: {
    IDBFS: unknown;
  };
}

export interface EmscriptenModule {
  FS: EmscriptenFS;
  HEAPU8: Uint8Array;
  HEAP8: Int8Array;
  HEAPU16: Uint16Array;
  HEAP16: Int16Array;
  HEAPU32: Uint32Array;
  HEAP32: Int32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: unknown[]) => unknown;
  ccall: (name: string, returnType: string, argTypes: string[], args: unknown[]) => unknown;
  postMainLoop?: () => void;
  preMainLoop?: () => void;
  EmulatorJSGetState?: () => Uint8Array;
  callbacks: {
    setupCoreSettingFile?: (filePath: string) => void;
  };
  abort: () => void;
}

export interface GameManager {
  EJS: EmulatorJS;
  Module: EmscriptenModule;
  FS: EmscriptenFS;
  functions: GameManagerFunctions;

  restart: () => void;
  getState: () => Uint8Array;
  loadState: (state: Uint8Array) => void;
  screenshot: () => Promise<Uint8Array>;
  quickSave: (slot?: number) => boolean;
  quickLoad: (slot?: number) => void;
  simulateInput: (player: number, index: number, value: number) => void;
  toggleMainLoop: (playing: number) => void;
  getCoreOptions: () => string;
  setVariable: (option: string, value: string) => void;
  setCheat: (index: number, enabled: number, code: string) => void;
  resetCheat: () => void;
  toggleShader: (active: number) => void;
  getDiskCount: () => number;
  getCurrentDisk: () => number;
  setCurrentDisk: (disk: number) => void;
  getSaveFilePath: () => string;
  saveSaveFiles: () => void;
  supportsStates: () => boolean;
  getSaveFile: (save?: boolean) => Uint8Array | null;
  loadSaveFiles: () => void;
  setFastForwardRatio: (ratio: number) => void;
  toggleFastForward: (active: number) => void;
  setSlowMotionRatio: (ratio: number) => void;
  toggleSlowMotion: (active: number) => void;
  setRewindGranularity: (value: number) => void;
  getFrameNum: () => number;
  setVSync: (enabled: number) => void;
  setVideoRotation: (rotation: number) => void;
  getVideoDimensions: (type: string) => number | undefined;
  setKeyboardEnabled: (enabled: boolean) => void;
  setAltKeyEnabled: (enabled: boolean) => void;
  writeFile: (path: string, data: string | Uint8Array) => void;
  mkdir: (path: string) => void;
}

export interface EmulatorJS {
  config: EmulatorJSConfig;
  gameManager: GameManager;
  Module: EmscriptenModule;
  debug: boolean;
  isNetplay: boolean;
  rewindEnabled: boolean;
  isFastForward: boolean;
  isSlowMotion: boolean;
  settings: Record<string, string>;
  failedToStart: boolean;

  on: (event: string, callback: (...args: unknown[]) => void) => void;
  callEvent: (event: string, data: unknown) => void;
  displayMessage: (message: string) => void;
  localization: (key: string) => string;
  getCore: () => string;
  downloadFile: (
    url: string,
    progressCallback: ((progress: number) => void) | null,
    cache: boolean,
    options: { responseType: string; method: string }
  ) => Promise<{ data: ArrayBuffer } | number>;
  checkCompression: (data: Uint8Array, message: string) => Promise<Record<string, Uint8Array> | number>;
  getCoreSettings: () => string;
  preGetSetting: (name: string) => string | null;
  changeSettingOption: (name: string, value: string) => void;
}

declare global {
  interface Window {
    EJS_emulator?: EmulatorJS;
    EJS_gameUrl?: string;
    EJS_core?: string;
    EJS_player?: string;
    EJS_pathtodata?: string;
    EJS_startOnLoaded?: boolean;
    EJS_DEBUG_XX?: boolean;
    EJS_biosUrl?: string;
    EJS_volume?: number;
    EJS_Buttons?: Record<string, boolean>;
    EJS_Settings?: Record<string, unknown>;
    EJS_netplayServer?: string;
    EJS_netplayUrl?: string;
    EJS_gameID?: number;
    EJS_gameName?: string;
    EJS_loadStateOnStart?: string;
    EJS_noAutoLoad?: boolean;
    EJS_defaultOptions?: Record<string, unknown>;
    EJS_onGameStart?: () => void;
    EJS_onLoadState?: () => void;
    EJS_onSaveState?: () => void;
    EJS_GameManager?: new (module: EmscriptenModule, ejs: EmulatorJS) => GameManager;
    EmulatorJS?: new (container: string | HTMLElement, config: EmulatorJSConfig) => EmulatorJS;
  }
}

export {};
