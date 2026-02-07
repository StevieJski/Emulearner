/**
 * CodeSandbox - Safe execution environment for student code
 *
 * Executes student TypeScript/JavaScript code in a Web Worker with
 * controlled access to game APIs. Provides timeout protection and
 * error handling.
 */

import { GameController } from '../core/GameController';
import {
  ToWorkerMessage,
  FromWorkerMessage,
  SandboxExecutionResult,
  StepResponse,
  LogEntry,
} from './types';

/**
 * Options for code execution
 */
export interface ExecutionOptions {
  /** Maximum frames before timeout */
  maxFrames: number;

  /** Callback for console output from student code */
  onLog?: (entry: LogEntry) => void;

  /** Callback for each frame step (for visualization) */
  onStep?: (frameNumber: number) => void;
}

/**
 * CodeSandbox provides safe execution of student code with controlled
 * access to game APIs.
 */
export class CodeSandbox {
  private worker: Worker | null = null;
  private controller: GameController;
  private _isReady: boolean = false;
  private messageId: number = 0;
  private currentExecution: {
    resolve: (result: SandboxExecutionResult) => void;
    reject: (error: Error) => void;
    options: ExecutionOptions;
  } | null = null;

  constructor(controller: GameController) {
    this.controller = controller;
  }

  /**
   * Check if the sandbox is ready
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Initialize the worker
   */
  async initialize(): Promise<void> {
    if (this.worker) {
      return;
    }

    // Create worker from the worker module
    // Using a blob URL to avoid separate file requirements
    const workerCode = await this.getWorkerCode();
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    this.worker = new Worker(workerUrl);
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = this.handleWorkerError.bind(this);

    // Wait for ready signal
    await new Promise<void>((resolve) => {
      const checkReady = (event: MessageEvent<FromWorkerMessage>) => {
        if (event.data.event === 'ready') {
          this._isReady = true;
          resolve();
        }
      };
      this.worker!.addEventListener('message', checkReady, { once: true });
    });

    URL.revokeObjectURL(workerUrl);
  }

  /**
   * Execute student code in the sandbox
   */
  async execute(code: string, options: ExecutionOptions): Promise<SandboxExecutionResult> {
    if (!this.worker) {
      await this.initialize();
    }

    if (this.currentExecution) {
      throw new Error('Another execution is already in progress');
    }

    return new Promise((resolve, reject) => {
      this.currentExecution = { resolve, reject, options };

      // Get available variables from the loaded game data
      const availableVariables = this.controller.hasGameData
        ? this.controller.getVariableNames()
        : [];

      // Send execute command to worker
      this.sendToWorker('execute', {
        code,
        maxFrames: options.maxFrames,
        availableVariables,
      });
    });
  }

  /**
   * Terminate the current execution
   */
  terminate(): void {
    if (this.worker) {
      this.sendToWorker('terminate', {});
      if (this.currentExecution) {
        this.currentExecution.resolve({
          completed: false,
          framesExecuted: 0,
          error: 'Execution terminated',
          consoleOutput: [],
        });
        this.currentExecution = null;
      }
    }
  }

  /**
   * Destroy the sandbox and clean up resources
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this._isReady = false;
      this.currentExecution = null;
    }
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent<FromWorkerMessage & { command?: string }>): void {
    const { id, event: eventType, payload, command } = event.data;

    // Debug: console.log('Worker message:', { id, event: eventType, command });

    // Handle worker requests (step, getState) - these have 'command' field
    if (command) {
      switch (command) {
        case 'step':
          this.handleStepRequest(id!, payload);
          return;
        case 'getState':
          this.handleStateRequest(id!);
          return;
      }
    }

    // Handle worker events - these have 'event' field
    switch (eventType) {
      case 'ready':
        this._isReady = true;
        break;

      case 'log':
        if (this.currentExecution?.options.onLog) {
          this.currentExecution.options.onLog(payload as LogEntry);
        }
        break;

      case 'complete':
        if (this.currentExecution) {
          this.currentExecution.resolve(payload as SandboxExecutionResult);
          this.currentExecution = null;
        }
        break;

      case 'error':
        console.error('Worker error:', payload);
        if (this.currentExecution) {
          const errorPayload = payload as { message: string };
          this.currentExecution.resolve({
            completed: false,
            framesExecuted: 0,
            error: errorPayload.message,
            consoleOutput: [],
          });
          this.currentExecution = null;
        }
        break;
    }
  }

  /**
   * Handle step request from worker
   */
  private async handleStepRequest(
    id: number,
    payload: unknown
  ): Promise<void> {
    const { inputs } = payload as {
      inputs: Array<{ action: string; button?: string }>;
      heldButtons: string[];
    };

    // Debug: Log inputs being processed
    if (inputs.length > 0) {
      console.log('[CodeSandbox] Processing inputs:', inputs);
    }

    // Apply inputs to the controller
    for (const input of inputs) {
      switch (input.action) {
        case 'press':
          if (input.button) {
            console.log('[CodeSandbox] Pressing:', input.button);
            this.controller.press(input.button as Parameters<typeof this.controller.press>[0]);
          }
          break;
        case 'release':
          if (input.button) {
            console.log('[CodeSandbox] Releasing:', input.button);
            this.controller.release(input.button as Parameters<typeof this.controller.release>[0]);
          }
          break;
        case 'releaseAll':
          console.log('[CodeSandbox] Releasing all');
          this.controller.releaseAll();
          break;
      }
    }

    // Step the game
    const frameBeforeStep = this.controller.frameNumber;
    try {
      await this.controller.step();
      console.log('[CodeSandbox] Stepped frame:', frameBeforeStep, '->', this.controller.frameNumber);
    } catch (error) {
      console.error('[CodeSandbox] Step error:', error);
      throw error;
    }

    // Notify step callback
    if (this.currentExecution?.options.onStep) {
      this.currentExecution.options.onStep(this.controller.frameNumber);
    }

    // Send response back to worker
    const response: StepResponse = {
      frameNumber: this.controller.frameNumber,
      state: this.controller.hasGameData ? this.controller.getState() : {},
    };

    this.respondToWorker(id, response);
  }

  /**
   * Handle state request from worker
   */
  private handleStateRequest(id: number): void {
    const response: StepResponse = {
      frameNumber: this.controller.frameNumber,
      state: this.controller.hasGameData ? this.controller.getState() : {},
    };

    this.respondToWorker(id, response);
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(event: ErrorEvent): void {
    console.error('Worker error:', event);
    if (this.currentExecution) {
      this.currentExecution.resolve({
        completed: false,
        framesExecuted: 0,
        error: event.message || 'Unknown worker error',
        consoleOutput: [],
      });
      this.currentExecution = null;
    }
  }

  /**
   * Send a command to the worker
   */
  private sendToWorker(command: string, payload?: unknown): void {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    const id = ++this.messageId;
    const message: ToWorkerMessage = { id, command: command as ToWorkerMessage['command'], payload };
    this.worker.postMessage(message);
  }

  /**
   * Send a response to a worker request
   */
  private respondToWorker(id: number, payload: unknown): void {
    if (!this.worker) {
      return;
    }
    // Send as a special response message
    this.worker.postMessage({ id, command: 'step', payload });
  }

  /**
   * Get the worker code as a string
   * This is a simplified version that runs in the same context
   * For production, this would be a separate bundled worker file
   */
  private async getWorkerCode(): Promise<string> {
    // For now, return inline worker code
    // In production, this would load from a pre-bundled worker file
    return `
const VALID_BUTTONS = ['a', 'b', 'x', 'y', 'l', 'r', 'l2', 'r2', 'select', 'start', 'l3', 'r3', 'up', 'down', 'left', 'right'];

let currentExecution = null;
let messageId = 0;
const pendingRequests = new Map();

function sendRequest(command, payload) {
  return new Promise((resolve) => {
    const id = ++messageId;
    pendingRequests.set(id, resolve);
    self.postMessage({ id, command, payload });
  });
}

function sendEvent(event, payload) {
  self.postMessage({ event, payload });
}

function sandboxLog(level, ...args) {
  if (currentExecution) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    currentExecution.consoleOutput.push('[' + level + '] ' + message);
  }
  sendEvent('log', { level, args, timestamp: Date.now() });
}

async function requestStep() {
  if (!currentExecution) throw new Error('No execution in progress');
  // Check relative frames stepped, not absolute emulator frame
  if (currentExecution.framesExecuted >= currentExecution.maxFrames) {
    throw new Error('Maximum frames exceeded');
  }

  const inputs = [...currentExecution.inputQueue];
  currentExecution.inputQueue = [];

  const response = await sendRequest('step', {
    inputs,
    heldButtons: Array.from(currentExecution.heldButtons),
  });

  currentExecution.frameNumber = response.frameNumber;
  currentExecution.framesExecuted++;  // Track relative frames
  currentExecution.currentState = response.state;
  return response;
}

function createGameAPI() {
  return {
    press(button) {
      if (!VALID_BUTTONS.includes(button)) {
        throw new Error('Invalid button: ' + button + '. Valid: ' + VALID_BUTTONS.join(', '));
      }
      if (currentExecution) {
        currentExecution.heldButtons.add(button);
        currentExecution.inputQueue.push({ action: 'press', button });
      }
    },
    release(button) {
      if (!VALID_BUTTONS.includes(button)) throw new Error('Invalid button: ' + button);
      if (currentExecution) {
        currentExecution.heldButtons.delete(button);
        currentExecution.inputQueue.push({ action: 'release', button });
      }
    },
    releaseAll() {
      if (currentExecution) {
        currentExecution.heldButtons.clear();
        currentExecution.inputQueue.push({ action: 'releaseAll' });
      }
    },
    async tap(button) {
      this.press(button);
      await this.step();
      this.release(button);
    },
    async hold(button, frames) {
      this.press(button);
      await this.stepFrames(frames);
      this.release(button);
    },
    async step() { await requestStep(); },
    async stepFrames(count) { for (let i = 0; i < count; i++) await requestStep(); },
    async wait(frames) { await this.stepFrames(frames); },
    getVariable(name) {
      if (!currentExecution) throw new Error('No execution in progress');
      const value = currentExecution.currentState[name];
      if (value === undefined) throw new Error('Variable "' + name + '" not found');
      return value;
    },
    getState() {
      if (!currentExecution) throw new Error('No execution in progress');
      return { ...currentExecution.currentState };
    },
    get frameNumber() { return currentExecution?.framesExecuted ?? 0; }
  };
}

async function executeCode(payload) {
  const { code, maxFrames } = payload;

  currentExecution = {
    frameNumber: 0,
    framesExecuted: 0,  // Track relative frames for maxFrames check
    maxFrames,
    consoleOutput: [],
    currentState: {},
    heldButtons: new Set(),
    inputQueue: [],
  };

  const initialResponse = await sendRequest('getState', {});
  currentExecution.currentState = initialResponse.state;
  currentExecution.frameNumber = initialResponse.frameNumber;

  const game = createGameAPI();
  const console = {
    log: (...args) => sandboxLog('log', ...args),
    warn: (...args) => sandboxLog('warn', ...args),
    error: (...args) => sandboxLog('error', ...args),
    info: (...args) => sandboxLog('info', ...args),
  };

  try {
    const wrappedCode = 'return (async function(game, console) { "use strict"; ' + code + ' })(game, console);';
    const fn = new Function('game', 'console', 'Math', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Date', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'undefined', wrappedCode);
    await fn(game, console, Math, Number, String, Boolean, Array, Object, JSON, Date, parseInt, parseFloat, isNaN, isFinite, undefined);

    const result = {
      completed: true,
      framesExecuted: currentExecution.framesExecuted,
      consoleOutput: currentExecution.consoleOutput,
    };
    currentExecution = null;
    return result;
  } catch (error) {
    const result = {
      completed: false,
      framesExecuted: currentExecution?.framesExecuted ?? 0,
      error: error.message || String(error),
      errorStack: error.stack,
      consoleOutput: currentExecution?.consoleOutput ?? [],
    };
    currentExecution = null;
    return result;
  }
}

self.onmessage = async (event) => {
  const { id, command, payload } = event.data;
  try {
    switch (command) {
      case 'execute':
        const result = await executeCode(payload);
        sendEvent('complete', result);
        break;
      case 'step':
      case 'getState':
        if (id !== undefined) {
          const resolver = pendingRequests.get(id);
          if (resolver) {
            pendingRequests.delete(id);
            resolver(payload);
          }
        }
        break;
      case 'terminate':
        currentExecution = null;
        break;
    }
  } catch (error) {
    sendEvent('error', { message: error.message || String(error) });
  }
};

sendEvent('ready', {});
`;
  }
}
