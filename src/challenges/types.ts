/**
 * Challenge System Types
 *
 * Defines the structure for educational coding challenges
 * that teach programming concepts through retro games.
 */

import { GameState } from '../core/MemoryReader';
import { GameId } from '../data/types';

/**
 * Function that checks if the challenge goal has been achieved.
 *
 * @param state - Current game state (all variables)
 * @returns true if the goal is met, false otherwise
 *
 * @example
 * // Goal: Move Sonic to x > 500
 * const goal: GoalFunction = (state) => state.x > 500;
 */
export type GoalFunction = (state: GameState) => boolean;

/**
 * Challenge difficulty level
 */
export type ChallengeDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * Programming concepts taught by a challenge
 */
export type ProgrammingConcept =
  | 'variables'
  | 'functions'
  | 'loops'
  | 'conditionals'
  | 'arrays'
  | 'objects'
  | 'async'
  | 'while-loops'
  | 'for-loops'
  | 'sequences'
  | 'expressions';

/**
 * A single educational challenge definition
 */
export interface Challenge {
  /** Unique identifier for the challenge */
  id: string;

  /** Lesson number for ordering (e.g., 1, 2, 3...) */
  lessonNumber: number;

  /** Display name for the challenge */
  name: string;

  /** Detailed description of what the student should do */
  description: string;

  /** Game identifier (e.g., "SonicTheHedgehog2-Genesis") */
  game: GameId;

  /** Optional save state to start from (for specific scenarios) */
  initialState?: Uint8Array;

  /** Goal function that determines success */
  goal: GoalFunction;

  /** Maximum frames allowed before timeout */
  maxFrames: number;

  /** Hints to help students who are stuck */
  hints: string[];

  /** Starter code template for the editor */
  starterCode: string;

  /** Programming concepts this challenge teaches */
  concepts: ProgrammingConcept[];

  /** Optional difficulty rating */
  difficulty?: ChallengeDifficulty;

  /** Optional expected solution (for testing) */
  solution?: string;

  /** Optional goal description for display */
  goalDescription?: string;
}

/**
 * Result of running a challenge
 */
export interface ChallengeResult {
  /** Whether the goal was achieved */
  success: boolean;

  /** Human-readable message about the result */
  message: string;

  /** Number of frames used */
  framesUsed: number;

  /** Final game state when challenge ended */
  finalState: GameState;

  /** Error if execution failed */
  error?: string;

  /** Detailed error stack trace (for debugging) */
  errorStack?: string;
}

/**
 * Status of a challenge execution
 */
export type ChallengeStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failure'
  | 'timeout'
  | 'error';

/**
 * Progress through the challenge curriculum
 */
export interface ChallengeProgress {
  /** Completed challenge IDs */
  completed: string[];

  /** Current challenge being worked on */
  current?: string;

  /** Best results for each challenge */
  bestResults: Record<string, ChallengeResult>;
}

/**
 * Configuration for the CodeSandbox execution environment
 */
export interface ExecutionConfig {
  /** Maximum frames before timeout */
  maxFrames: number;

  /** Whether to check goal after each frame */
  checkGoalPerFrame: boolean;

  /** Delay between frames in ms (for visualization) */
  frameDelay?: number;
}

/**
 * Result from CodeSandbox execution
 */
export interface ExecutionResult {
  /** Whether execution completed without errors */
  completed: boolean;

  /** Number of frames executed */
  framesExecuted: number;

  /** Any error that occurred */
  error?: string;

  /** Error stack trace */
  errorStack?: string;

  /** Console output from the code */
  consoleOutput: string[];
}

/**
 * Message types for worker communication
 */
export type WorkerMessageType =
  | 'execute'
  | 'result'
  | 'error'
  | 'log'
  | 'step'
  | 'input'
  | 'ready';

/**
 * Base worker message structure
 */
export interface WorkerMessage {
  type: WorkerMessageType;
  payload?: unknown;
}

/**
 * Message to start code execution
 */
export interface ExecuteMessage extends WorkerMessage {
  type: 'execute';
  payload: {
    code: string;
    maxFrames: number;
  };
}

/**
 * Message with execution result
 */
export interface ResultMessage extends WorkerMessage {
  type: 'result';
  payload: ExecutionResult;
}

/**
 * Message with console log output
 */
export interface LogMessage extends WorkerMessage {
  type: 'log';
  payload: {
    level: 'log' | 'warn' | 'error';
    args: unknown[];
  };
}

/**
 * Challenge metadata for listing/filtering
 */
export interface ChallengeMeta {
  id: string;
  lessonNumber: number;
  name: string;
  game: GameId;
  concepts: ProgrammingConcept[];
  difficulty?: ChallengeDifficulty;
}

/**
 * Extract metadata from a challenge
 */
export function getChallengeMeta(challenge: Challenge): ChallengeMeta {
  return {
    id: challenge.id,
    lessonNumber: challenge.lessonNumber,
    name: challenge.name,
    game: challenge.game,
    concepts: challenge.concepts,
    difficulty: challenge.difficulty,
  };
}
