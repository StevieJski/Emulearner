/**
 * CodeSandbox Types
 *
 * Types for worker communication and sandbox execution.
 */

/**
 * Commands that can be sent to the sandbox worker
 */
export type SandboxCommand =
  | 'execute'
  | 'step'
  | 'getState'
  | 'terminate';

/**
 * Events that can be received from the sandbox worker
 */
export type SandboxEvent =
  | 'ready'
  | 'log'
  | 'error'
  | 'stepRequest'
  | 'inputRequest'
  | 'stateRequest'
  | 'complete';

/**
 * Message from main thread to worker
 */
export interface ToWorkerMessage {
  id: number;
  command: SandboxCommand;
  payload?: unknown;
}

/**
 * Message from worker to main thread
 */
export interface FromWorkerMessage {
  id?: number;
  event: SandboxEvent;
  payload?: unknown;
}

/**
 * Execute command payload
 */
export interface ExecutePayload {
  code: string;
  maxFrames: number;
  availableVariables: string[];
}

/**
 * Step response from main thread
 */
export interface StepResponse {
  frameNumber: number;
  state: Record<string, number>;
}

/**
 * Input request from worker
 */
export interface InputRequest {
  action: 'press' | 'release' | 'releaseAll';
  button?: string;
}

/**
 * Execution result from worker
 */
export interface SandboxExecutionResult {
  completed: boolean;
  framesExecuted: number;
  error?: string;
  errorStack?: string;
  consoleOutput: string[];
}

/**
 * Log entry from worker
 */
export interface LogEntry {
  level: 'log' | 'warn' | 'error' | 'info';
  args: unknown[];
  timestamp: number;
}

/**
 * API exposed to student code in the sandbox
 */
export interface SandboxGameAPI {
  // Input
  press(button: string): void;
  release(button: string): void;
  releaseAll(): void;
  tap(button: string): Promise<void>;
  hold(button: string, frames: number): Promise<void>;

  // Frame control
  step(): Promise<void>;
  stepFrames(count: number): Promise<void>;
  wait(frames: number): Promise<void>;

  // Memory/state
  getVariable(name: string): number;
  getState(): Record<string, number>;

  // Info
  frameNumber: number;
}

/**
 * Valid button names for sandbox API
 */
export const VALID_BUTTONS = [
  'a', 'b', 'x', 'y',
  'l', 'r', 'l2', 'r2',
  'select', 'start',
  'l3', 'r3',
  'up', 'down', 'left', 'right',
] as const;

export type SandboxButton = typeof VALID_BUTTONS[number];
