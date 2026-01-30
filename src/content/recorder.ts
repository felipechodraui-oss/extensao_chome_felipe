import type { RecordedStep, StepType } from '../types';
import { generateElementSelector } from '../utils/selectors';
import { generateId } from '../utils/storage';

let isRecording = false;
let lastEventTime = Date.now();

// Debounce tracking for input fields
const inputDebounceTimers = new Map<Element, ReturnType<typeof setTimeout>>();
const INPUT_DEBOUNCE_MS = 500;

// Calculate delay since last event
function getDelay(): number {
  const now = Date.now();
  const delay = now - lastEventTime;
  lastEventTime = now;
  return delay;
}

// Send recorded step to background
function recordStep(step: RecordedStep): void {
  if (!isRecording) return;
  chrome.runtime.sendMessage({ type: 'RECORD_STEP', payload: step });
}

// Create a step from an event
function createStep(type: StepType, element: Element, extras: Partial<RecordedStep> = {}): RecordedStep {
  return {
    id: generateId(),
    type,
    timestamp: Date.now(),
    target: generateElementSelector(element),
    delay: getDelay(),
    ...extras,
  };
}

// Event handlers
function handleClick(event: MouseEvent): void {
  const target = event.target as Element;
  if (!target || !(target instanceof Element)) return;

  // Ignore clicks on the extension's own UI
  if (target.closest('[data-flow-recorder]')) return;

  // Don't record clicks on input fields (those are handled by focus)
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return;
  }

  const step = createStep('click', target, {
    position: { x: event.clientX, y: event.clientY },
  });

  recordStep(step);
}

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (!target) return;

  // Ignore inputs in extension UI
  if (target.closest('[data-flow-recorder]')) return;

  // For select elements, record immediately
  if (target.tagName === 'SELECT') {
    const step = createStep('select', target, {
      value: target.value,
    });
    recordStep(step);
    return;
  }

  // For text inputs, debounce to capture final value
  const existingTimer = inputDebounceTimers.get(target);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    inputDebounceTimers.delete(target);
    const step = createStep('input', target, {
      value: target.value,
    });
    recordStep(step);
  }, INPUT_DEBOUNCE_MS);

  inputDebounceTimers.set(target, timer);
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as Element;

  // Only record special keys (Enter, Tab, Escape, etc.)
  const specialKeys = ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (!specialKeys.includes(event.key)) return;

  // Ignore if in input field (those are captured by input event)
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (!['Enter', 'Tab', 'Escape'].includes(event.key)) return;
  }

  const step = createStep('keypress', target, {
    value: event.key,
  });

  recordStep(step);
}

let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
let lastScrollPosition = { x: 0, y: 0 };

function handleScroll(): void {
  // Debounce scroll events
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  scrollTimeout = setTimeout(() => {
    const currentPosition = {
      x: window.scrollX,
      y: window.scrollY,
    };

    // Only record if position changed significantly
    if (
      Math.abs(currentPosition.x - lastScrollPosition.x) > 50 ||
      Math.abs(currentPosition.y - lastScrollPosition.y) > 50
    ) {
      const step = createStep('scroll', document.documentElement, {
        scrollPosition: currentPosition,
      });

      recordStep(step);
      lastScrollPosition = currentPosition;
    }
  }, 150);
}

// Start recording
export function startRecording(): void {
  if (isRecording) return;

  isRecording = true;
  lastEventTime = Date.now();
  lastScrollPosition = { x: window.scrollX, y: window.scrollY };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('change', handleInput, true);
  document.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('scroll', handleScroll, true);

  console.log('Flow Recorder: Recording started');
}

// Stop recording
export function stopRecording(): void {
  if (!isRecording) return;

  // Flush any pending debounced inputs
  inputDebounceTimers.forEach((timer, element) => {
    clearTimeout(timer);
    const target = element as HTMLInputElement | HTMLTextAreaElement;
    if (target.value) {
      const step = createStep('input', target, {
        value: target.value,
      });
      recordStep(step);
    }
  });
  inputDebounceTimers.clear();

  isRecording = false;

  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('change', handleInput, true);
  document.removeEventListener('keydown', handleKeydown, true);
  window.removeEventListener('scroll', handleScroll, true);

  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  console.log('Flow Recorder: Recording stopped');
}

export function getIsRecording(): boolean {
  return isRecording;
}
