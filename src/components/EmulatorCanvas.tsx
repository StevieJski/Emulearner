import { useEffect, useRef, useState, useCallback } from 'react';
import { EmulatorBridge, EmulatorBridgeConfig, EmulatorState } from '../core/EmulatorBridge';
import { GameController } from '../core/GameController';

export interface EmulatorCanvasProps {
  gameUrl: string;
  core: string;
  dataPath?: string;
  biosUrl?: string;
  debug?: boolean;
  volume?: number;
  onReady?: (controller: GameController) => void;
  onStateChange?: (state: EmulatorState) => void;
  onError?: (error: Error) => void;
  style?: React.CSSProperties;
  className?: string;
}

// Generate a stable ID for the container
let containerIdCounter = 0;

/**
 * React component that wraps EmulatorJS.
 * Handles lifecycle, mounts the emulator to a container div,
 * and provides access to a GameController via the onReady callback.
 */
export function EmulatorCanvas({
  gameUrl,
  core,
  dataPath = 'data/',
  biosUrl,
  debug = false,
  volume = 0.5,
  onReady,
  onStateChange,
  onError,
  style,
  className,
}: EmulatorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<EmulatorBridge | null>(null);
  const [state, setState] = useState<EmulatorState>('uninitialized');
  const [containerId] = useState(() => `emulator-container-${++containerIdCounter}`);
  const mountedRef = useRef(true);

  const handleStateChange = useCallback((newState: EmulatorState) => {
    if (mountedRef.current) {
      setState(newState);
      onStateChange?.(newState);
    }
  }, [onStateChange]);

  useEffect(() => {
    mountedRef.current = true;

    // Small delay to ensure DOM is ready
    const initTimeout = setTimeout(() => {
      if (!containerRef.current || !mountedRef.current) return;

      const config: EmulatorBridgeConfig = {
        containerId,
        gameUrl,
        core,
        dataPath,
        biosUrl,
        debug,
        volume,
      };

      const bridge = new EmulatorBridge(config);
      bridgeRef.current = bridge;

      handleStateChange('loading');

      bridge.load()
        .then(() => {
          if (mountedRef.current) {
            handleStateChange('ready');
            const controller = new GameController(bridge);
            onReady?.(controller);
          }
        })
        .catch((error) => {
          if (mountedRef.current) {
            handleStateChange('error');
            onError?.(error);
            console.error('EmulatorJS failed to load:', error);
          }
        });
    }, 100);

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      clearTimeout(initTimeout);
      if (bridgeRef.current) {
        bridgeRef.current.destroy();
        bridgeRef.current = null;
      }
    };
  }, [containerId, gameUrl, core, dataPath, biosUrl, debug, volume, handleStateChange, onReady, onError]);

  return (
    <div
      ref={containerRef}
      id={containerId}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        ...style,
      }}
      data-state={state}
    />
  );
}
