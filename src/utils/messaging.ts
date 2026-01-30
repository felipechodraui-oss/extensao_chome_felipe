import type { Message, MessageType } from '../types';

// Send message to background service worker
export function sendToBackground<T = unknown>(type: MessageType, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response as T);
      }
    });
  });
}

// Send message to content script in specific tab
export function sendToTab<T = unknown>(
  tabId: number,
  type: MessageType,
  payload?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response as T);
      }
    });
  });
}

// Send message to all tabs
export async function broadcastToTabs(type: MessageType, payload?: unknown): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await sendToTab(tab.id, type, payload);
      } catch {
        // Tab might not have content script loaded
      }
    }
  }
}

// Listen for messages
export function onMessage(
  callback: (message: Message, sender: chrome.runtime.MessageSender) => void | Promise<unknown>
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = callback(message as Message, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch((error) => {
        console.error('Message handler error:', error);
        sendResponse({ error: error.message });
      });
      return true; // Keep channel open for async response
    }
    return false;
  });
}
