import { useState, useEffect } from 'react';
import type { Flow, RecordingState, PlaybackState } from '../types';
import { getFlows, deleteFlow } from '../utils/storage';
import { sendToBackground } from '../utils/messaging';
import { FlowList } from '../components/FlowList';
import { RecordButton } from '../components/RecordButton';

export function Popup() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);

  // Load flows and state on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [savedFlows, state] = await Promise.all([
          getFlows(),
          sendToBackground<{ recording: RecordingState; playback: PlaybackState }>('GET_STATE'),
        ]);
        setFlows(savedFlows);
        setIsRecording(state.recording.isRecording);
        setIsPlaying(state.playback.isPlaying);
        setStepCount(state.recording.steps?.length || 0);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('Failed to load extension state');
      } finally {
        setLoading(false);
      }
    };

    init();

    // Poll for step count while recording
    const interval = setInterval(async () => {
      try {
        const state = await sendToBackground<{ recording: RecordingState; playback: PlaybackState }>('GET_STATE');
        if (state.recording.isRecording) {
          setStepCount(state.recording.steps?.length || 0);
        }
      } catch {
        // Ignore polling errors
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle start recording
  const handleStartRecording = async () => {
    try {
      await sendToBackground('START_RECORDING');
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // Handle stop recording
  const handleStopRecording = async () => {
    try {
      const result = await sendToBackground<{ flow: Flow }>('STOP_RECORDING');
      setIsRecording(false);
      if (result.flow) {
        setFlows((prev) => [result.flow, ...prev]);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // Handle play flow
  const handlePlay = async (flowId: string) => {
    try {
      await sendToBackground('START_PLAYBACK', flowId);
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to start playback:', error);
    }
  };

  // Handle stop playback
  const handleStopPlayback = async () => {
    try {
      await sendToBackground('STOP_PLAYBACK');
      setIsPlaying(false);
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  };

  // Handle delete flow
  const handleDelete = async (flowId: string) => {
    try {
      await deleteFlow(flowId);
      setFlows((prev) => prev.filter((f) => f.id !== flowId));
    } catch (error) {
      console.error('Failed to delete flow:', error);
    }
  };

  // Handle edit flow (open editor page)
  const handleEdit = (flowId: string) => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`editor.html?flowId=${flowId}`),
    });
  };

  if (loading) {
    return (
      <div className="popup">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="popup">
      <header className="popup-header">
        <h1>Flow Recorder</h1>
      </header>

      <div className="popup-content">
        {error && (
          <div className="error-message" style={{ padding: '8px', background: '#fee', color: '#c00', borderRadius: '4px', marginBottom: '12px' }}>
            {error}
          </div>
        )}
        <RecordButton
          isRecording={isRecording}
          isPlaying={isPlaying}
          stepCount={stepCount}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
          onStopPlayback={handleStopPlayback}
        />

        <div className="flows-section">
          <h2>Saved Flows ({flows.length})</h2>
          <FlowList
            flows={flows}
            onPlay={handlePlay}
            onEdit={handleEdit}
            onDelete={handleDelete}
            disabled={isRecording || isPlaying}
          />
        </div>
      </div>

      <footer className="popup-footer">
        <button
          className="btn btn-secondary btn-small"
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') })}
        >
          Open Editor
        </button>
      </footer>
    </div>
  );
}
