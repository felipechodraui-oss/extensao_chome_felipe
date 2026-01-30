interface RecordButtonProps {
  isRecording: boolean;
  isPlaying: boolean;
  stepCount?: number;
  onStart: () => void;
  onStop: () => void;
  onStopPlayback: () => void;
}

export function RecordButton({
  isRecording,
  isPlaying,
  stepCount = 0,
  onStart,
  onStop,
  onStopPlayback,
}: RecordButtonProps) {
  if (isPlaying) {
    return (
      <div className="record-section">
        <button className="btn btn-stop-playback btn-large" onClick={onStopPlayback}>
          <span className="btn-icon-large">⏹</span>
          Stop Playback
        </button>
        <p className="record-status">Playing flow...</p>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="record-section">
        <button className="btn btn-recording btn-large" onClick={onStop}>
          <span className="btn-icon-large recording-pulse">●</span>
          Stop Recording
        </button>
        <p className="record-status">
          Recording... {stepCount} {stepCount === 1 ? 'step' : 'steps'} captured
        </p>
      </div>
    );
  }

  return (
    <div className="record-section">
      <button className="btn btn-record btn-large" onClick={onStart}>
        <span className="btn-icon-large">●</span>
        Start Recording
      </button>
      <p className="record-status">Click to start recording your browser actions</p>
    </div>
  );
}
