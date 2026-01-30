import type { Message, RecordedStep } from '../types';
import { startRecording, stopRecording } from './recorder';
import { executeStep } from './player';

// Prevent duplicate injection
if ((window as unknown as { __flowRecorderLoaded?: boolean }).__flowRecorderLoaded) {
  console.log('Flow Recorder: Content script already loaded, skipping');
} else {
  (window as unknown as { __flowRecorderLoaded: boolean }).__flowRecorderLoaded = true;

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    console.log('Flow Recorder: Received message:', message.type);

    const handleAsync = async () => {
      try {
        switch (message.type) {
          case 'PING':
            // Used to check if content script is loaded
            return { success: true, loaded: true };

          case 'START_RECORDING':
            startRecording();
            return { success: true };

          case 'STOP_RECORDING':
            stopRecording();
            return { success: true };

          case 'EXECUTE_STEP':
            console.log('Flow Recorder: Executing step:', message.payload);
            const success = await executeStep(message.payload as RecordedStep);
            console.log('Flow Recorder: Step result:', success);
            return { success };

          default:
            console.warn('Flow Recorder: Unknown message type:', message.type);
            return { error: 'Unknown message type' };
        }
      } catch (error) {
        console.error('Flow Recorder: Error handling message:', error);
        return { success: false, error: String(error) };
      }
    };

    handleAsync().then(sendResponse).catch((error) => {
      console.error('Flow Recorder: Async handler error:', error);
      sendResponse({ success: false, error: String(error) });
    });

    return true; // Keep channel open for async response
  });

  console.log('Flow Recorder content script loaded on', window.location.href);
}
