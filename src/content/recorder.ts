import type { RecordedStep, StepType, ElementSelector } from '../types';
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
  console.log('Flow Recorder: Recording step:', step.type, step);
  chrome.runtime.sendMessage({ type: 'RECORD_STEP', payload: step });
}

// Get the real target element using composedPath (works with Shadow DOM)
function getRealTarget(event: Event): Element | null {
  // composedPath() returns the full path including shadow DOM elements
  const path = event.composedPath();

  if (path.length === 0) {
    return event.target as Element;
  }

  // The first element in the path is the actual target (deepest element)
  const target = path[0];

  if (target instanceof Element) {
    return target;
  }

  // Fallback to event.target
  return event.target as Element;
}

// Build the shadow host path for an element
function getShadowHostPath(element: Element): string[] {
  const hostPath: string[] = [];
  let current: Node | null = element;

  while (current) {
    if (current instanceof ShadowRoot) {
      // Get the host element of this shadow root
      const host = current.host;
      if (host) {
        // Generate a simple selector for the host
        let hostSelector = host.tagName.toLowerCase();
        if (host.id) {
          hostSelector = `#${host.id}`;
        } else if (host.className && typeof host.className === 'string') {
          const firstClass = host.className.split(' ')[0];
          if (firstClass) {
            hostSelector = `${host.tagName.toLowerCase()}.${firstClass}`;
          }
        }
        hostPath.unshift(hostSelector);
      }
      current = current.host;
    } else {
      current = current.parentNode;
    }
  }

  return hostPath;
}

// Check if element is inside a Shadow DOM
function isInShadowDOM(element: Element): boolean {
  let parent: Node | null = element.parentNode;
  while (parent) {
    if (parent instanceof ShadowRoot) {
      return true;
    }
    parent = parent.parentNode;
  }
  return false;
}

// Generate selector with shadow DOM awareness
function generateShadowAwareSelector(element: Element): ElementSelector {
  const baseSelector = generateElementSelector(element);

  // If element is in shadow DOM, add the host path
  if (isInShadowDOM(element)) {
    const hostPath = getShadowHostPath(element);
    if (hostPath.length > 0) {
      // Store the shadow host path in attributes for later use
      baseSelector.attributes['data-shadow-host-path'] = hostPath.join(' >>> ');
      console.log('Flow Recorder: Element in Shadow DOM, host path:', hostPath);
    }
  }

  return baseSelector;
}

// Create a step from an event
function createStep(type: StepType, element: Element, extras: Partial<RecordedStep> = {}): RecordedStep {
  return {
    id: generateId(),
    type,
    timestamp: Date.now(),
    target: generateShadowAwareSelector(element),
    delay: getDelay(),
    ...extras,
  };
}

// Event handlers - using composedPath for Shadow DOM support
function handleClick(event: MouseEvent): void {
  // Use composedPath to get the real target in Shadow DOM
  const target = getRealTarget(event);
  if (!target || !(target instanceof Element)) return;

  console.log('Flow Recorder: Click detected on:', target.tagName, 'inShadowDOM:', isInShadowDOM(target));

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
  // Use composedPath to get the real target in Shadow DOM
  const target = getRealTarget(event) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (!target) return;

  console.log('Flow Recorder: Input detected on:', target.tagName, 'inShadowDOM:', isInShadowDOM(target));

  // Ignore inputs in extension UI
  if (target.closest?.('[data-flow-recorder]')) return;

  // For select elements, record immediately
  if (target.tagName === 'SELECT') {
    const step = createStep('select', target, {
      value: (target as HTMLSelectElement).value,
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
    if ('value' in target) {
      const step = createStep('input', target, {
        value: target.value,
      });
      recordStep(step);
    }
  }, INPUT_DEBOUNCE_MS);

  inputDebounceTimers.set(target, timer);
}

function handleKeydown(event: KeyboardEvent): void {
  const target = getRealTarget(event);
  if (!target) return;

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

  // Use capture phase (true) to catch events before they're handled
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('change', handleInput, true);
  document.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('scroll', handleScroll, true);

  console.log('Flow Recorder: Recording started with Shadow DOM support');
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
