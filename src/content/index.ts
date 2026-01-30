import type { Message, RecordedStep } from '../types';
import { startRecording, stopRecording } from './recorder';
import { executeStep } from './player';

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  const handleAsync = async () => {
    switch (message.type) {
      case 'START_RECORDING':
        startRecording();
        return { success: true };

      case 'STOP_RECORDING':
        stopRecording();
        return { success: true };

      case 'EXECUTE_STEP':
        const success = await executeStep(message.payload as RecordedStep);
        return { success };

      default:
        return { error: 'Unknown message type' };
    }
  };

  handleAsync().then(sendResponse);
  return true; // Keep channel open for async response
});

console.log('Flow Recorder content script loaded');
