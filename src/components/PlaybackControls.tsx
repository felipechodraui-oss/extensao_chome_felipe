import { useState } from 'react';
import { sendToBackground } from '../utils/messaging';

interface PlaybackControlsProps {
  flowId: string;
}

export function PlaybackControls({ flowId }: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const handlePlay = async () => {
    try {
      // Set speed before starting playback
      await sendToBackground('SET_PLAYBACK_OPTIONS', { speed });
      await sendToBackground('START_PLAYBACK', flowId);
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to start playback:', error);
    }
  };

  const handleStop = async () => {
    try {
      await sendToBackground('STOP_PLAYBACK');
      setIsPlaying(false);
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        {!isPlaying ? (
          <button className="btn btn-primary" onClick={handlePlay}>
            ▶ Play
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={handleStop}>
            ⏹ Stop
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Speed:</label>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="input"
          disabled={isPlaying}
        >
          <option value={0.5}>0.5x (Slow)</option>
          <option value={1}>1x (Normal)</option>
          <option value={1.5}>1.5x (Fast)</option>
          <option value={2}>2x (Faster)</option>
        </select>
      </div>

      {isPlaying && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--success)',
            fontWeight: '500',
          }}
        >
          <span style={{ animation: 'recording-blink 1s infinite' }}>●</span>
          Playing...
        </span>
      )}
    </div>
  );
}
