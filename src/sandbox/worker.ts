/**
 * CodeSandbox Web Worker
 *
 * Executes student code in an isolated environment with controlled
 * access to game APIs. Communicates with main thread via postMessage.
 */

import {
  FromWorkerMessage,
  ToWorkerMessage,
  ExecutePayload,
  StepResponse,
  SandboxExecutionResult,
  LogEntry,
  VALID_BUTTONS,
} from './types';

// Worker state
let currentExecution: {
  resolve: (result: SandboxExecutionResult) => void;
  reject: (error: Error) => void;
  frameNumber: number;
  maxFrames: number;
  consoleOutput: string[];
  pendingSteps: Array<(response: StepResponse) => void>;
  currentState: Record<string, number>;
  heldButtons: Set<string>;
  inputQueue: Array<{ action: string; button?: string }>;
} | null = null;

let messageId = 0;
const pendingRequests = new Map<number, (response: unknown) => void>();

/**
 * Send a message to the main thread and wait for response
 */
function sendRequest(command: string, payload?: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    const id = ++messageId;
    pendingRequests.set(id, resolve);
    self.postMessage({ id, command, payload });
  });
}

/**
 * Send a message to the main thread without waiting
 */
function sendEvent(event: string, payload?: unknown): void {
  const msg: FromWorkerMessage = { event: event as FromWorkerMessage['event'], payload };
  self.postMessage(msg);
}

/**
 * Log to console (captured for result)
 */
function sandboxLog(level: LogEntry['level'], ...args: unknown[]): void {
  if (currentExecution) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    currentExecution.consoleOutput.push(`[${level}] ${message}`);
  }
  sendEvent('log', { level, args, timestamp: Date.now() });
}

/**
 * Request a frame step from main thread
 */
async function requestStep(): Promise<StepResponse> {
  if (!currentExecution) {
    throw new Error('No execution in progress');
  }

  if (currentExecution.frameNumber >= currentExecution.maxFrames) {
    throw new Error('Maximum frames exceeded');
  }

  // Send any queued inputs first
  const inputs = [...currentExecution.inputQueue];
  currentExecution.inputQueue = [];

  const response = await sendRequest('step', {
    inputs,
    heldButtons: Array.from(currentExecution.heldButtons),
  }) as StepResponse;

  currentExecution.frameNumber = response.frameNumber;
  currentExecution.currentState = response.state;

  return response;
}

/**
 * Create the game API object exposed to student code
 */
function createGameAPI() {
  return {
    // Input methods
    press(button: string): void {
      if (!VALID_BUTTONS.includes(button as typeof VALID_BUTTONS[number])) {
        throw new Error(`Invalid button: ${button}. Valid buttons: ${VALID_BUTTONS.join(', ')}`);
      }
      if (currentExecution) {
        currentExecution.heldButtons.add(button);
        currentExecution.inputQueue.push({ action: 'press', button });
      }
    },

    release(button: string): void {
      if (!VALID_BUTTONS.includes(button as typeof VALID_BUTTONS[number])) {
        throw new Error(`Invalid button: ${button}`);
      }
      if (currentExecution) {
        currentExecution.heldButtons.delete(button);
        currentExecution.inputQueue.push({ action: 'release', button });
      }
    },

    releaseAll(): void {
      if (currentExecution) {
        currentExecution.heldButtons.clear();
        currentExecution.inputQueue.push({ action: 'releaseAll' });
      }
    },

    async tap(button: string): Promise<void> {
      this.press(button);
      await this.step();
      this.release(button);
    },

    async hold(button: string, frames: number): Promise<void> {
      this.press(button);
      await this.stepFrames(frames);
      this.release(button);
    },

    // Frame control
    async step(): Promise<void> {
      await requestStep();
    },

    async stepFrames(count: number): Promise<void> {
      for (let i = 0; i < count; i++) {
        await requestStep();
      }
    },

    async wait(frames: number): Promise<void> {
      await this.stepFrames(frames);
    },

    // State access
    getVariable(name: string): number {
      if (!currentExecution) {
        throw new Error('No execution in progress');
      }
      const value = currentExecution.currentState[name];
      if (value === undefined) {
        throw new Error(`Variable "${name}" not found in game state`);
      }
      return value;
    },

    getState(): Record<string, number> {
      if (!currentExecution) {
        throw new Error('No execution in progress');
      }
      return { ...currentExecution.currentState };
    },

    // Properties
    get frameNumber(): number {
      return currentExecution?.frameNumber ?? 0;
    },
  };
}

/**
 * Execute student code in the sandbox
 */
async function executeCode(payload: ExecutePayload): Promise<SandboxExecutionResult> {
  const { code, maxFrames } = payload;

  // Initialize execution state
  currentExecution = {
    resolve: () => {},
    reject: () => {},
    frameNumber: 0,
    maxFrames,
    consoleOutput: [],
    pendingSteps: [],
    currentState: {},
    heldButtons: new Set(),
    inputQueue: [],
  };

  // Get initial state
  const initialResponse = await sendRequest('getState', {}) as StepResponse;
  currentExecution.currentState = initialResponse.state;
  currentExecution.frameNumber = initialResponse.frameNumber;

  const game = createGameAPI();

  // Create a restricted console
  const console = {
    log: (...args: unknown[]) => sandboxLog('log', ...args),
    warn: (...args: unknown[]) => sandboxLog('warn', ...args),
    error: (...args: unknown[]) => sandboxLog('error', ...args),
    info: (...args: unknown[]) => sandboxLog('info', ...args),
  };

  try {
    // Wrap code in an async function
    // The game API is passed as a parameter to avoid scope pollution
    const wrappedCode = `
      return (async function(game, console) {
        "use strict";
        ${code}
      })(game, console);
    `;

    // Create function with restricted scope
    // Only expose: game, console, Math, basic globals
    const fn = new Function(
      'game',
      'console',
      'Math',
      'Number',
      'String',
      'Boolean',
      'Array',
      'Object',
      'JSON',
      'Date',
      'parseInt',
      'parseFloat',
      'isNaN',
      'isFinite',
      'undefined',
      wrappedCode
    );

    // Execute with timeout via maxFrames limit
    await fn(
      game,
      console,
      Math,
      Number,
      String,
      Boolean,
      Array,
      Object,
      JSON,
      Date,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      undefined
    );

    const result: SandboxExecutionResult = {
      completed: true,
      framesExecuted: currentExecution.frameNumber,
      consoleOutput: currentExecution.consoleOutput,
    };

    currentExecution = null;
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const result: SandboxExecutionResult = {
      completed: false,
      framesExecuted: currentExecution?.frameNumber ?? 0,
      error: errorMessage,
      errorStack,
      consoleOutput: currentExecution?.consoleOutput ?? [],
    };

    currentExecution = null;
    return result;
  }
}

/**
 * Handle messages from main thread
 */
self.onmessage = async (event: MessageEvent<ToWorkerMessage>) => {
  const { id, command, payload } = event.data;

  try {
    switch (command) {
      case 'execute': {
        const result = await executeCode(payload as ExecutePayload);
        sendEvent('complete', result);
        break;
      }

      case 'step':
      case 'getState': {
        // These are responses to our requests
        if (id !== undefined) {
          const resolver = pendingRequests.get(id);
          if (resolver) {
            pendingRequests.delete(id);
            resolver(payload);
          }
        }
        break;
      }

      case 'terminate': {
        if (currentExecution) {
          currentExecution = null;
        }
        break;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendEvent('error', { message: errorMessage });
  }
};

// Signal ready
sendEvent('ready', {});
