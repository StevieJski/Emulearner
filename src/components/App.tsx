import { useState, useCallback, useRef } from 'react';
import { EmulatorCanvas } from './EmulatorCanvas';
import { GameController, Button } from '../core/GameController';
import { EmulatorState } from '../core/EmulatorBridge';

const BUTTONS: Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'start', 'select'];

const PRESET_ROMS = [
  { name: 'Select a ROM...', url: '', core: 'genesis_plus_gx' },
  { name: 'Sonic The Hedgehog 2', url: 'roms/Sonic The Hedgehog 2 (World) (Rev A).md', core: 'genesis_plus_gx' },
  { name: 'Airstriker (Genesis)', url: 'roms/airstriker.md', core: 'genesis_plus_gx' },
];

export function App() {
  const [gameUrl, setGameUrl] = useState<string>('');
  const [core, setCore] = useState<string>('genesis_plus_gx');
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [state, setState] = useState<EmulatorState>('uninitialized');
  const [frameNumber, setFrameNumber] = useState<number>(0);
  const [started, setStarted] = useState(false);
  const controllerRef = useRef<GameController | null>(null);

  const handleReady = useCallback((controller: GameController) => {
    controllerRef.current = controller;
    controller.setRamOffset('genesis');
    console.log('Emulator ready! GameController available.');

    // Expose controller globally for debugging
    (window as unknown as { game: GameController }).game = controller;
  }, []);

  const handleStateChange = useCallback((newState: EmulatorState) => {
    setState(newState);
  }, []);

  const handleStart = () => {
    if (gameUrl) {
      setStarted(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setGameUrl(url);
      setSelectedPreset(0);
    }
  };

  const handlePresetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value, 10);
    setSelectedPreset(index);
    const preset = PRESET_ROMS[index];
    if (preset.url) {
      setGameUrl(preset.url);
      setCore(preset.core);
    } else {
      setGameUrl('');
    }
  };

  const handleButtonPress = (button: Button) => {
    controllerRef.current?.press(button);
  };

  const handleButtonRelease = (button: Button) => {
    controllerRef.current?.release(button);
  };

  const handleStep = async () => {
    if (controllerRef.current) {
      await controllerRef.current.step();
      setFrameNumber(controllerRef.current.frameNumber);
    }
  };

  const handleStep10 = async () => {
    if (controllerRef.current) {
      await controllerRef.current.stepFrames(10);
      setFrameNumber(controllerRef.current.frameNumber);
    }
  };

  const handlePlay = () => {
    controllerRef.current?.play();
  };

  const handlePause = () => {
    controllerRef.current?.pause();
    if (controllerRef.current) {
      setFrameNumber(controllerRef.current.frameNumber);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Emulearner</h1>
      <p>TypeScript/React wrapper for EmulatorJS</p>

      {!started ? (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Preset ROMs:
              <select
                value={selectedPreset}
                onChange={handlePresetSelect}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                {PRESET_ROMS.map((rom, i) => (
                  <option key={i} value={i}>{rom.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label>
              Core:
              <select
                value={core}
                onChange={(e) => setCore(e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="genesis_plus_gx">Sega Genesis (genesis_plus_gx)</option>
                <option value="snes9x">SNES (snes9x)</option>
                <option value="fceumm">NES (fceumm)</option>
                <option value="gambatte">Game Boy (gambatte)</option>
                <option value="mgba">GBA (mgba)</option>
              </select>
            </label>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label>
              Or upload ROM:
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".md,.gen,.bin,.smc,.sfc,.nes,.gb,.gbc,.gba,.zip"
                style={{ marginLeft: '10px' }}
              />
            </label>
          </div>

          <button
            onClick={handleStart}
            disabled={!gameUrl}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              cursor: gameUrl ? 'pointer' : 'not-allowed',
            }}
          >
            Start Emulator
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '10px' }}>
            <span>State: <strong>{state}</strong></span>
            <span style={{ marginLeft: '20px' }}>Frame: <strong>{frameNumber}</strong></span>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: '1', maxWidth: '800px' }}>
              <EmulatorCanvas
                gameUrl={gameUrl}
                core={core}
                dataPath="data/"
                debug={true}
                onReady={handleReady}
                onStateChange={handleStateChange}
                style={{ border: '2px solid #333', borderRadius: '4px' }}
              />
            </div>

            <div style={{ width: '200px' }}>
              <h3>Frame Control</h3>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                <button onClick={handlePlay}>Play</button>
                <button onClick={handlePause}>Pause</button>
              </div>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
                <button onClick={handleStep}>Step 1</button>
                <button onClick={handleStep10}>Step 10</button>
              </div>

              <h3>Input</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {BUTTONS.map((button) => (
                  <button
                    key={button}
                    onMouseDown={() => handleButtonPress(button)}
                    onMouseUp={() => handleButtonRelease(button)}
                    onMouseLeave={() => handleButtonRelease(button)}
                    style={{
                      padding: '8px',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {button}
                  </button>
                ))}
              </div>

              <h3 style={{ marginTop: '20px' }}>Debug</h3>
              <p style={{ fontSize: '12px', color: '#666' }}>
                Open browser console.<br />
                <code>window.game</code> gives you access to the GameController.
              </p>
              <pre style={{ fontSize: '10px', background: '#f0f0f0', padding: '5px' }}>
{`// Try in console:
game.press('right');
await game.step();
game.release('right');
game.frameNumber`}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
