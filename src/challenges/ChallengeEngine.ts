/**
 * ChallengeEngine - Orchestrator for challenge execution
 *
 * Manages the full lifecycle of running a challenge:
 * - Load initial state
 * - Execute student code via CodeSandbox
 * - Check goal conditions
 * - Return results
 */

import { GameController } from '../core/GameController';
import { CodeSandbox, ExecutionOptions } from '../sandbox/CodeSandbox';
import { LogEntry } from '../sandbox/types';
import {
  Challenge,
  ChallengeResult,
  ChallengeStatus,
} from './types';

/**
 * Options for running a challenge
 */
export interface ChallengeRunOptions {
  /** Callback for console output from student code */
  onLog?: (entry: LogEntry) => void;

  /** Callback for each frame step */
  onStep?: (frameNumber: number, state: Record<string, number>) => void;

  /** Callback for status changes */
  onStatusChange?: (status: ChallengeStatus) => void;

  /** Additional frame delay for visualization (ms) */
  frameDelay?: number;
}

/**
 * ChallengeEngine orchestrates challenge execution
 */
export class ChallengeEngine {
  private controller: GameController;
  private sandbox: CodeSandbox;
  private currentChallenge: Challenge | null = null;
  private status: ChallengeStatus = 'idle';
  private statusCallback?: (status: ChallengeStatus) => void;

  constructor(controller: GameController, sandbox?: CodeSandbox) {
    this.controller = controller;
    this.sandbox = sandbox ?? new CodeSandbox(controller);
  }

  /**
   * Get current status
   */
  getStatus(): ChallengeStatus {
    return this.status;
  }

  /**
   * Get currently loaded challenge
   */
  getCurrentChallenge(): Challenge | null {
    return this.currentChallenge;
  }

  /**
   * Run a challenge with the provided student code
   *
   * @param challenge - The challenge definition
   * @param studentCode - The student's code to execute
   * @param options - Optional callbacks for progress monitoring
   * @returns The result of the challenge attempt
   */
  async runChallenge(
    challenge: Challenge,
    studentCode: string,
    options: ChallengeRunOptions = {}
  ): Promise<ChallengeResult> {
    this.currentChallenge = challenge;
    this.statusCallback = options.onStatusChange;

    try {
      // Update status
      this.setStatus('running');

      // Load game data for variable access
      this.controller.loadGameData(challenge.game);

      // Load initial state if provided
      if (challenge.initialState) {
        this.controller.loadState(challenge.initialState);
        // Allow state to settle
        await this.controller.step();
      }

      // Discover RAM base address for memory reads (skip if already discovered)
      if (!this.controller.isMemoryDiscovered) {
        try {
          await this.controller.discoverMemory('genesis');
          console.log('[ChallengeEngine] Memory discovery successful');
        } catch (e) {
          console.warn('[ChallengeEngine] Memory discovery failed:', e);
          // Continue anyway - challenges may still work without memory reads
        }
      } else {
        console.log('[ChallengeEngine] Memory already discovered, skipping');
      }

      // Note: Don't pause here - stepFrame handles pause/resume internally
      // Pausing before step causes frame advancement to fail

      // Track goal achievement
      let goalMet = false;
      let goalFrame = 0;

      // Create execution options with goal checking
      // Note: Goal checking is disabled for now since memory addresses are incorrect
      const execOptions: ExecutionOptions = {
        maxFrames: challenge.maxFrames,
        onLog: options.onLog,
        onStep: (frameNumber) => {
          // Only check goal every 10 frames to reduce overhead
          if (frameNumber % 10 === 0) {
            try {
              const state = this.controller.getState();
              options.onStep?.(frameNumber, state);

              // Check goal condition
              if (!goalMet && challenge.goal(state)) {
                goalMet = true;
                goalFrame = frameNumber;
              }
            } catch (e) {
              // Ignore state reading errors
              console.warn('Error reading game state:', e);
            }
          }
        },
      };

      // Execute student code
      console.log('[ChallengeEngine] Starting code execution...');
      const execResult = await this.sandbox.execute(studentCode, execOptions);
      console.log('[ChallengeEngine] Execution complete:', {
        completed: execResult.completed,
        framesExecuted: execResult.framesExecuted,
        error: execResult.error,
      });

      // Clean up after execution
      this.controller.releaseAll();

      // Resume the emulator so it renders properly
      // Use a small delay to let things settle
      await new Promise(resolve => setTimeout(resolve, 100));
      this.controller.play();

      // Get final state
      let finalState: Record<string, number> = {};
      try {
        finalState = this.controller.getState();
      } catch {
        // Ignore errors reading final state
      }

      // Check goal one more time with final state
      if (!goalMet && challenge.goal(finalState)) {
        goalMet = true;
        goalFrame = execResult.framesExecuted;
      }

      // Determine result
      if (execResult.error) {
        this.setStatus('error');
        return {
          success: false,
          message: `Error: ${execResult.error}`,
          framesUsed: execResult.framesExecuted,
          finalState,
          error: execResult.error,
          errorStack: execResult.errorStack,
        };
      }

      if (goalMet) {
        this.setStatus('success');
        return {
          success: true,
          message: `Goal achieved in ${goalFrame} frames!`,
          framesUsed: goalFrame,
          finalState,
        };
      }

      if (execResult.framesExecuted >= challenge.maxFrames) {
        this.setStatus('timeout');
        return {
          success: false,
          message: `Timeout: Goal not achieved within ${challenge.maxFrames} frames.`,
          framesUsed: execResult.framesExecuted,
          finalState,
        };
      }

      this.setStatus('failure');
      return {
        success: false,
        message: 'Code completed but goal was not achieved.',
        framesUsed: execResult.framesExecuted,
        finalState,
      };

    } catch (error) {
      this.setStatus('error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Unexpected error: ${errorMessage}`,
        framesUsed: 0,
        finalState: {},
        error: errorMessage,
      };
    }
  }

  /**
   * Stop the current challenge execution
   */
  stop(): void {
    this.sandbox.terminate();
    this.setStatus('idle');
  }

  /**
   * Reset the engine state
   */
  reset(): void {
    this.stop();
    this.currentChallenge = null;
    this.controller.releaseAll();
  }

  /**
   * Destroy the engine and clean up resources
   */
  destroy(): void {
    this.reset();
    this.sandbox.destroy();
  }

  /**
   * Update status and notify callback
   */
  private setStatus(status: ChallengeStatus): void {
    this.status = status;
    this.statusCallback?.(status);
  }
}
