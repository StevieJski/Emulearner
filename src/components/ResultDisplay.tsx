/**
 * ResultDisplay - Show challenge execution results
 */

import { ChallengeResult, ChallengeStatus } from '../challenges/types';

interface ResultDisplayProps {
  result: ChallengeResult | null;
  status: ChallengeStatus;
  consoleOutput?: string[];
}

export function ResultDisplay({
  result,
  status,
  consoleOutput = [],
}: ResultDisplayProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return '#4caf50';
      case 'failure':
      case 'timeout':
        return '#f44336';
      case 'error':
        return '#ff9800';
      case 'running':
        return '#2196f3';
      default:
        return '#666';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Ready to run';
      case 'running':
        return 'Running...';
      case 'success':
        return 'Success!';
      case 'failure':
        return 'Goal not achieved';
      case 'timeout':
        return 'Timeout';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  return (
    <div
      style={{
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        marginTop: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '10px',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
          }}
        />
        <strong style={{ color: getStatusColor() }}>{getStatusText()}</strong>
        {result && (
          <span style={{ color: '#666', fontSize: '14px' }}>
            ({result.framesUsed} frames)
          </span>
        )}
      </div>

      {result?.message && (
        <p style={{ margin: '10px 0', color: '#333' }}>{result.message}</p>
      )}

      {result?.error && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#ffebee',
            borderRadius: '4px',
            marginTop: '10px',
          }}
        >
          <strong style={{ color: '#c62828' }}>Error:</strong>
          <pre
            style={{
              margin: '5px 0 0',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              color: '#c62828',
            }}
          >
            {result.error}
          </pre>
        </div>
      )}

      {consoleOutput.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <strong style={{ fontSize: '12px', color: '#666' }}>Console Output:</strong>
          <pre
            style={{
              margin: '5px 0 0',
              padding: '10px',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              fontSize: '12px',
              borderRadius: '4px',
              maxHeight: '150px',
              overflow: 'auto',
            }}
          >
            {consoleOutput.join('\n') || '(no output)'}
          </pre>
        </div>
      )}

      {result?.success === false && status !== 'error' && result.finalState && (
        <div style={{ marginTop: '10px' }}>
          <strong style={{ fontSize: '12px', color: '#666' }}>Final State:</strong>
          <pre
            style={{
              margin: '5px 0 0',
              padding: '10px',
              backgroundColor: '#e3f2fd',
              fontSize: '12px',
              borderRadius: '4px',
            }}
          >
            {Object.entries(result.finalState)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}
