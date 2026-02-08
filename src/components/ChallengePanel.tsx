/**
 * ChallengePanel - Main UI for selecting and running challenges
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { CodeEditor } from './CodeEditor';
import { ResultDisplay } from './ResultDisplay';
import { GameController } from '../core/GameController';
import { ChallengeEngine } from '../challenges/ChallengeEngine';
import {
  Challenge,
  ChallengeResult,
  ChallengeStatus,
  ChallengeMeta,
} from '../challenges/types';
import {
  getAllChallengeMeta,
  getChallenge,
  registerSonicChallenges,
  startGame,
  isGameReady,
} from '../challenges';
import { LogEntry } from '../sandbox/types';

// Register challenges on module load
registerSonicChallenges();

interface ChallengePanelProps {
  controller: GameController | null;
  gameUrl?: string;
  onChallengeStart?: () => void;
}

/**
 * Check if the loaded ROM URL likely matches a challenge's game ID.
 * This prevents auto-start from running Sonic 2 discovery on unrelated ROMs.
 */
function romMatchesGame(gameUrl: string | undefined, gameId: string): boolean {
  if (!gameUrl) return false;
  const url = gameUrl.toLowerCase();
  switch (gameId) {
    case 'SonicTheHedgehog2-Genesis':
      return url.includes('sonic');
    case 'Airstriker-Genesis':
      return url.includes('airstriker');
    default:
      return false;
  }
}

export function ChallengePanel({
  controller,
  gameUrl,
  onChallengeStart,
}: ChallengePanelProps) {
  const [challenges, setChallenges] = useState<ChallengeMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState<string>('');
  const [status, setStatus] = useState<ChallengeStatus>('idle');
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [engine, setEngine] = useState<ChallengeEngine | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [gameReady, setGameReady] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [startProgress, setStartProgress] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);

  // Load challenges list
  useEffect(() => {
    const meta = getAllChallengeMeta();
    setChallenges(meta);
    if (meta.length > 0 && !selectedId) {
      setSelectedId(meta[0].id);
    }
  }, [selectedId]);

  // Create engine when controller is available
  useEffect(() => {
    if (controller) {
      const newEngine = new ChallengeEngine(controller);
      setEngine(newEngine);
      return () => newEngine.destroy();
    }
  }, [controller]);

  // Track whether auto-start has been attempted for this challenge
  const autoStartAttempted = useRef(false);

  // Reset auto-start flag when challenge changes
  useEffect(() => {
    autoStartAttempted.current = false;
  }, [selectedId]);

  // Check game readiness periodically (stops polling once ready)
  // Only polls if the loaded ROM matches the challenge game
  useEffect(() => {
    if (!controller || !currentChallenge) {
      setGameReady(false);
      return;
    }

    // Don't load game data or poll if the ROM doesn't match
    if (!romMatchesGame(gameUrl, currentChallenge.game)) {
      setGameReady(false);
      return;
    }

    // Load game data for the current challenge
    try {
      controller.loadGameData(currentChallenge.game);
    } catch (e) {
      console.log('[ChallengePanel] Failed to load game data:', e);
    }

    const checkReady = () => {
      try {
        const ready = isGameReady(currentChallenge.game, controller);
        setGameReady(ready);
        return ready;
      } catch (e) {
        console.error('[ChallengePanel] Error checking game ready:', e);
        setGameReady(false);
        return false;
      }
    };

    // Initial check
    if (checkReady()) return; // Already ready, no need to poll

    const interval = setInterval(() => {
      if (checkReady()) {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [controller, currentChallenge, gameUrl]);

  // Load selected challenge
  useEffect(() => {
    if (selectedId) {
      const challenge = getChallenge(selectedId);
      if (challenge) {
        setCurrentChallenge(challenge);
        setCode(challenge.starterCode);
        setResult(null);
        setStatus('idle');
        setConsoleOutput([]);
        setShowHints(false);
        setHintIndex(0);
      }
    }
  }, [selectedId]);

  const handleChallengeSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedId(e.target.value);
    },
    []
  );

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  const handleStartGame = useCallback(async () => {
    if (!controller || !currentChallenge) return;

    setStartingGame(true);
    setStartProgress('Starting...');

    try {
      const result = await startGame(
        currentChallenge.game,
        controller,
        setStartProgress
      );

      if (result.success) {
        setGameReady(true);
        setStartProgress('');
      } else {
        setStartProgress(result.message);
      }
    } catch (error) {
      setStartProgress(`Error: ${error}`);
    } finally {
      setStartingGame(false);
    }
  }, [controller, currentChallenge]);

  // Auto-start: trigger game start when controller + challenge are available
  // Only auto-starts if the loaded ROM matches the challenge's game
  useEffect(() => {
    if (!controller || !currentChallenge || gameReady || startingGame) return;
    if (autoStartAttempted.current) return;
    if (!controller.isReady) return;
    if (!romMatchesGame(gameUrl, currentChallenge.game)) return;

    autoStartAttempted.current = true;
    const timer = setTimeout(() => {
      handleStartGame();
    }, 500);
    return () => clearTimeout(timer);
  }, [controller, currentChallenge, gameReady, startingGame, handleStartGame, gameUrl]);

  const handleRun = useCallback(async () => {
    if (!engine || !currentChallenge || !controller) {
      console.log('[ChallengePanel] Cannot run - missing:', { engine: !!engine, currentChallenge: !!currentChallenge, controller: !!controller });
      return;
    }

    // Clear previous results but preserve error history
    setResult(null);
    setConsoleOutput([]);
    setLastError(null);
    setStatus('running');
    onChallengeStart?.();

    console.log('[ChallengePanel] Starting challenge execution...');
    console.log('[ChallengePanel] Controller ready:', controller.isReady);
    console.log('[ChallengePanel] Frame number:', controller.frameNumber);

    // Note: Don't pause here - stepFrame handles pause/resume internally

    // Collect console output
    const logs: string[] = [];
    const handleLog = (entry: LogEntry) => {
      const msg = entry.args
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ');
      logs.push(`[${entry.level}] ${msg}`);
      setConsoleOutput([...logs]);
    };

    try {
      const challengeResult = await engine.runChallenge(
        currentChallenge,
        code,
        {
          onLog: handleLog,
          onStatusChange: setStatus,
        }
      );

      console.log('[ChallengePanel] Challenge complete:', challengeResult);
      setResult(challengeResult);
      setConsoleOutput(logs);

      // Track error separately so it persists
      if (challengeResult.error) {
        setLastError(challengeResult.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[ChallengePanel] Challenge error:', errorMessage, errorStack);
      setLastError(errorMessage);
      setResult({
        success: false,
        message: `Unexpected error: ${errorMessage}`,
        framesUsed: 0,
        finalState: {},
        error: errorMessage,
        errorStack,
      });
      setStatus('error');
    }
  }, [engine, currentChallenge, controller, code, onChallengeStart]);

  const handleStop = useCallback(() => {
    engine?.stop();
    setStatus('idle');
  }, [engine]);

  const handleReset = useCallback(() => {
    if (currentChallenge) {
      setCode(currentChallenge.starterCode);
      setResult(null);
      setStatus('idle');
      setConsoleOutput([]);
    }
  }, [currentChallenge]);

  // Debug function to test basic input
  const handleDebugTest = useCallback(async () => {
    if (!controller) {
      console.log('[Debug] No controller');
      return;
    }
    console.log('[Debug] Starting test...');
    console.log('[Debug] Controller ready:', controller.isReady);
    console.log('[Debug] Frame before:', controller.frameNumber);

    try {
      // Test basic press
      console.log('[Debug] Pressing right...');
      controller.press('right');

      // Step multiple frames to see movement
      console.log('[Debug] Stepping 60 frames...');
      for (let i = 0; i < 60; i++) {
        await controller.step();
        if (i % 10 === 0) {
          console.log('[Debug] Frame:', controller.frameNumber);
        }
      }

      console.log('[Debug] Frame after:', controller.frameNumber);

      // Release
      controller.release('right');
      console.log('[Debug] Released right');

      // Try reading some state
      if (controller.hasGameData) {
        try {
          const state = controller.getState();
          console.log('[Debug] Game state:', state);
        } catch (e) {
          console.log('[Debug] Could not read state:', e);
        }
      }

      console.log('[Debug] Test complete!');
    } catch (error) {
      console.error('[Debug] Error:', error);
    }
  }, [controller]);

  const handleShowHint = useCallback(() => {
    setShowHints(true);
  }, []);

  const handleNextHint = useCallback(() => {
    if (currentChallenge && hintIndex < currentChallenge.hints.length - 1) {
      setHintIndex(hintIndex + 1);
    }
  }, [currentChallenge, hintIndex]);

  if (!controller) {
    return (
      <div style={{ padding: '20px', color: '#666' }}>
        Start the emulator to access challenges.
      </div>
    );
  }

  return (
    <div style={{ padding: '10px' }}>
      <h3 style={{ marginTop: 0 }}>Challenges</h3>

      {/* Game Ready Status */}
      {!gameReady && currentChallenge && (
        <div
          style={{
            padding: '15px',
            backgroundColor: '#fff3e0',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #ff9800',
          }}
        >
          <strong style={{ color: '#e65100' }}>
            {startingGame ? 'Starting Game...' : 'Game Not Ready'}
          </strong>
          {startingGame && startProgress ? (
            <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#666' }}>
              {startProgress}
            </p>
          ) : (
            <>
              <p style={{ margin: '10px 0 15px', fontSize: '14px' }}>
                The game needs to be started before running challenges.
                Click the button below to automatically navigate through the menus,
                or start the game manually.
              </p>
              <button
                onClick={handleStartGame}
                disabled={startingGame}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  backgroundColor: '#ff9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: startingGame ? 'not-allowed' : 'pointer',
                }}
              >
                Start Game Automatically
              </button>
            </>
          )}
        </div>
      )}

      {gameReady && (
        <div
          style={{
            padding: '8px 15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '4px',
            marginBottom: '15px',
            fontSize: '14px',
            color: '#2e7d32',
          }}
        >
          Game ready! You can now run challenges.
        </div>
      )}

      {/* Challenge Selector */}
      <div style={{ marginBottom: '15px' }}>
        <select
          value={selectedId}
          onChange={handleChallengeSelect}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '14px',
            borderRadius: '4px',
          }}
        >
          {challenges.map((c) => (
            <option key={c.id} value={c.id}>
              Lesson {c.lessonNumber}: {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Challenge Description */}
      {currentChallenge && (
        <div
          style={{
            padding: '15px',
            backgroundColor: '#e3f2fd',
            borderRadius: '4px',
            marginBottom: '15px',
          }}
        >
          <h4 style={{ margin: '0 0 10px 0' }}>{currentChallenge.name}</h4>
          <div
            style={{
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}
          >
            {currentChallenge.description.trim()}
          </div>
          {currentChallenge.goalDescription && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px',
                backgroundColor: '#bbdefb',
                borderRadius: '4px',
                fontWeight: 'bold',
              }}
            >
              Goal: {currentChallenge.goalDescription}
            </div>
          )}
        </div>
      )}

      {/* Code Editor */}
      <div style={{ marginBottom: '15px' }}>
        <CodeEditor
          initialCode={code}
          onChange={handleCodeChange}
          disabled={status === 'running'}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <button
          onClick={handleRun}
          disabled={status === 'running' || !currentChallenge || !gameReady}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            backgroundColor: gameReady ? '#4caf50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: status === 'running' || !gameReady ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'running' ? 'Running...' : 'Run Code'}
        </button>

        {status === 'running' && (
          <button
            onClick={handleStop}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Stop
          </button>
        )}

        <button
          onClick={handleReset}
          disabled={status === 'running'}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: status === 'running' ? 'not-allowed' : 'pointer',
          }}
        >
          Reset Code
        </button>

        <button
          onClick={handleDebugTest}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            backgroundColor: '#9c27b0',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Debug Test
        </button>
      </div>

      {/* Last Error Display (persistent) */}
      {lastError && !result?.error && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#ffebee',
            borderRadius: '4px',
            marginBottom: '10px',
            border: '1px solid #f44336',
          }}
        >
          <strong style={{ color: '#c62828' }}>Last Error:</strong>
          <pre style={{ margin: '5px 0 0', fontSize: '12px', color: '#c62828', whiteSpace: 'pre-wrap' }}>
            {lastError}
          </pre>
        </div>
      )}

      {/* Result Display */}
      <ResultDisplay
        result={result}
        status={status}
        consoleOutput={consoleOutput}
      />

      {/* Hints Section */}
      {currentChallenge && currentChallenge.hints.length > 0 && (
        <div style={{ marginTop: '15px' }}>
          {!showHints ? (
            <button
              onClick={handleShowHint}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Show Hint
            </button>
          ) : (
            <div
              style={{
                padding: '15px',
                backgroundColor: '#fff3e0',
                borderRadius: '4px',
              }}
            >
              <strong>Hint {hintIndex + 1}:</strong>
              <p style={{ margin: '10px 0' }}>
                {currentChallenge.hints[hintIndex]}
              </p>
              {hintIndex < currentChallenge.hints.length - 1 && (
                <button
                  onClick={handleNextHint}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Next Hint ({hintIndex + 2}/{currentChallenge.hints.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
