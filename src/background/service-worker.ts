import type { Flow, Message, RecordedStep, RecordingState, PlaybackState } from '../types';
import { getFlows, saveFlow, generateId } from '../utils/storage';

// State management
let recordingState: RecordingState = {
  isRecording: false,
  currentFlowId: null,
  steps: [],
  startUrl: null,
};

let playbackState: PlaybackState = {
  isPlaying: false,
  isPaused: false,
  currentFlowId: null,
  currentStepIndex: 0,
  options: {
    speed: 1,
    stepByStep: false,
    stopOnError: true,
    highlightElements: true,
  },
};

// Get the active tab
async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Start recording
async function startRecording(): Promise<void> {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) return;

  recordingState = {
    isRecording: true,
    currentFlowId: generateId(),
    steps: [],
    startUrl: tab.url,
  };

  // Notify content script to start capturing events
  await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });

  // Update badge
  await chrome.action.setBadgeText({ text: 'REC' });
  await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
}

// Stop recording and save flow
async function stopRecording(): Promise<Flow | null> {
  if (!recordingState.isRecording) return null;

  const tab = await getActiveTab();
  if (tab?.id) {
    await chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });
  }

  const flow: Flow = {
    id: recordingState.currentFlowId!,
    name: `Recording ${new Date().toLocaleString()}`,
    steps: recordingState.steps,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startUrl: recordingState.startUrl!,
  };

  await saveFlow(flow);

  recordingState = {
    isRecording: false,
    currentFlowId: null,
    steps: [],
    startUrl: null,
  };

  await chrome.action.setBadgeText({ text: '' });

  return flow;
}

// Add a recorded step
function addRecordedStep(step: RecordedStep): void {
  if (!recordingState.isRecording) return;
  recordingState.steps.push(step);
}

// Start playback of a flow
async function startPlayback(flowId: string): Promise<void> {
  const flows = await getFlows();
  const flow = flows.find((f) => f.id === flowId);
  if (!flow) return;

  playbackState = {
    isPlaying: true,
    isPaused: false,
    currentFlowId: flowId,
    currentStepIndex: 0,
    options: playbackState.options,
  };

  // Navigate to start URL
  const tab = await getActiveTab();
  if (tab?.id) {
    await chrome.tabs.update(tab.id, { url: flow.startUrl });

    // Wait for page to load, then start executing steps
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        executeNextStep(flow);
      }
    });
  }

  await chrome.action.setBadgeText({ text: 'PLAY' });
  await chrome.action.setBadgeBackgroundColor({ color: '#00FF00' });
}

// Execute the next step in playback
async function executeNextStep(flow: Flow): Promise<void> {
  if (!playbackState.isPlaying || playbackState.isPaused) return;

  const step = flow.steps[playbackState.currentStepIndex];
  if (!step) {
    // Playback complete
    await stopPlayback();
    return;
  }

  const tab = await getActiveTab();
  if (!tab?.id) return;

  // Handle navigation steps
  if (step.type === 'navigation' && step.url) {
    await chrome.tabs.update(tab.id, { url: step.url });
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        playbackState.currentStepIndex++;
        const delay = (flow.steps[playbackState.currentStepIndex]?.delay || 500) / playbackState.options.speed;
        setTimeout(() => executeNextStep(flow), delay);
      }
    });
    return;
  }

  // Send step to content script for execution
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'EXECUTE_STEP',
      payload: step,
    });

    playbackState.currentStepIndex++;
    const nextStep = flow.steps[playbackState.currentStepIndex];
    const delay = (nextStep?.delay || 500) / playbackState.options.speed;
    setTimeout(() => executeNextStep(flow), delay);
  } catch (error) {
    console.error('Failed to execute step:', error);
    if (playbackState.options.stopOnError) {
      await stopPlayback();
    } else {
      playbackState.currentStepIndex++;
      executeNextStep(flow);
    }
  }
}

// Stop playback
async function stopPlayback(): Promise<void> {
  playbackState = {
    ...playbackState,
    isPlaying: false,
    isPaused: false,
    currentFlowId: null,
    currentStepIndex: 0,
  };

  await chrome.action.setBadgeText({ text: '' });
}

// Message handler
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  const handleAsync = async () => {
    switch (message.type) {
      case 'START_RECORDING':
        await startRecording();
        return { success: true };

      case 'STOP_RECORDING':
        const flow = await stopRecording();
        return { success: true, flow };

      case 'RECORD_STEP':
        addRecordedStep(message.payload as RecordedStep);
        return { success: true };

      case 'START_PLAYBACK':
        await startPlayback(message.payload as string);
        return { success: true };

      case 'STOP_PLAYBACK':
        await stopPlayback();
        return { success: true };

      case 'PAUSE_PLAYBACK':
        playbackState.isPaused = true;
        return { success: true };

      case 'RESUME_PLAYBACK':
        playbackState.isPaused = false;
        if (playbackState.currentFlowId) {
          const flows = await getFlows();
          const currentFlow = flows.find((f) => f.id === playbackState.currentFlowId);
          if (currentFlow) executeNextStep(currentFlow);
        }
        return { success: true };

      case 'SET_PLAYBACK_OPTIONS':
        playbackState.options = {
          ...playbackState.options,
          ...(message.payload as Partial<typeof playbackState.options>),
        };
        return { success: true, options: playbackState.options };

      case 'GET_STATE':
        return {
          recording: recordingState,
          playback: playbackState,
        };

      default:
        return { error: 'Unknown message type' };
    }
  };

  handleAsync().then(sendResponse);
  return true; // Keep channel open for async response
});

// Handle tab updates (for recording navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (recordingState.isRecording && changeInfo.url) {
    const step: RecordedStep = {
      id: generateId(),
      type: 'navigation',
      timestamp: Date.now(),
      url: changeInfo.url,
      delay: recordingState.steps.length > 0
        ? Date.now() - recordingState.steps[recordingState.steps.length - 1].timestamp
        : 0,
      target: {
        css: '',
        xpath: '',
        tagName: 'window',
        attributes: {},
      },
    };
    addRecordedStep(step);
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'toggle-recording':
      if (recordingState.isRecording) {
        await stopRecording();
      } else {
        await startRecording();
      }
      break;

    case 'stop-playback':
      if (playbackState.isPlaying) {
        await stopPlayback();
      }
      break;
  }
});

console.log('Flow Recorder service worker initialized');
