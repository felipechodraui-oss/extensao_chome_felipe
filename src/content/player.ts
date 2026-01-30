import type { RecordedStep } from '../types';
import { findElement } from '../utils/selectors';

// Highlight element during playback
function highlightElement(element: Element): () => void {
  const originalOutline = (element as HTMLElement).style.outline;
  const originalOutlineOffset = (element as HTMLElement).style.outlineOffset;

  (element as HTMLElement).style.outline = '3px solid #4CAF50';
  (element as HTMLElement).style.outlineOffset = '2px';

  return () => {
    (element as HTMLElement).style.outline = originalOutline;
    (element as HTMLElement).style.outlineOffset = originalOutlineOffset;
  };
}

// Get the center coordinates of an element
function getElementCenter(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

// Create a mouse event with all necessary properties
function createMouseEvent(type: string, element: Element, coords: { x: number; y: number }): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    detail: type === 'dblclick' ? 2 : 1,
    screenX: coords.x + window.screenX,
    screenY: coords.y + window.screenY,
    clientX: coords.x,
    clientY: coords.y,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    button: 0,
    buttons: type === 'mouseup' ? 0 : 1,
    relatedTarget: null,
  });
}

// Create pointer events (for modern sites)
function createPointerEvent(type: string, element: Element, coords: { x: number; y: number }): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    detail: 1,
    screenX: coords.x + window.screenX,
    screenY: coords.y + window.screenY,
    clientX: coords.x,
    clientY: coords.y,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    pointerId: 1,
    width: 1,
    height: 1,
    pressure: type === 'pointerup' ? 0 : 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 'mouse',
    isPrimary: true,
  });
}

// Simulate a comprehensive click event (works with most frameworks)
function simulateClick(element: Element, position?: { x: number; y: number }): void {
  const coords = position ?? getElementCenter(element);
  const htmlElement = element as HTMLElement;

  // Focus the element first
  if (htmlElement.focus) {
    htmlElement.focus();
  }

  // Dispatch pointer events (for modern frameworks)
  element.dispatchEvent(createPointerEvent('pointerover', element, coords));
  element.dispatchEvent(createPointerEvent('pointerenter', element, coords));
  element.dispatchEvent(createPointerEvent('pointerdown', element, coords));

  // Dispatch mouse events
  element.dispatchEvent(createMouseEvent('mouseover', element, coords));
  element.dispatchEvent(createMouseEvent('mouseenter', element, coords));
  element.dispatchEvent(createMouseEvent('mousedown', element, coords));
  element.dispatchEvent(createMouseEvent('mouseup', element, coords));
  element.dispatchEvent(createMouseEvent('click', element, coords));

  // Dispatch pointer up
  element.dispatchEvent(createPointerEvent('pointerup', element, coords));

  // Handle checkboxes and radio buttons specifically
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox') {
      element.checked = !element.checked;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (element.type === 'radio') {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // For Google Forms and similar: look for clickable parent or associated label
  const label = element.closest('label') || document.querySelector(`label[for="${element.id}"]`);
  if (label && label !== element) {
    label.dispatchEvent(createMouseEvent('click', label, getElementCenter(label)));
  }

  // Also try native click (catches cases the events miss)
  if (htmlElement.click) {
    htmlElement.click();
  }

  // For divs/spans that act as buttons (common in Google Forms)
  if (element.getAttribute('role') === 'radio' || element.getAttribute('role') === 'checkbox') {
    // Toggle aria-checked for custom controls
    const currentState = element.getAttribute('aria-checked');
    if (currentState === 'false') {
      element.setAttribute('aria-checked', 'true');
    } else if (currentState === 'true' && element.getAttribute('role') === 'checkbox') {
      element.setAttribute('aria-checked', 'false');
    }
  }
}

// Simulate typing into an input with proper event sequence for React/Vue/Angular
function simulateInput(element: Element, value: string): void {
  const htmlElement = element as HTMLElement;

  // Focus the element
  if (htmlElement.focus) {
    htmlElement.focus();
  }
  element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // Clear existing value first
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));

    // Type character by character for better framework compatibility
    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      // Keydown
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: char,
        code: `Key${char.toUpperCase()}`,
        charCode: char.charCodeAt(0),
        keyCode: char.charCodeAt(0),
        which: char.charCodeAt(0),
        bubbles: true,
        cancelable: true,
      }));

      // Update value
      element.value = value.substring(0, i + 1);

      // Input event with inputType (important for React)
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: char,
      });
      element.dispatchEvent(inputEvent);

      // Keyup
      element.dispatchEvent(new KeyboardEvent('keyup', {
        key: char,
        code: `Key${char.toUpperCase()}`,
        charCode: char.charCodeAt(0),
        keyCode: char.charCodeAt(0),
        which: char.charCodeAt(0),
        bubbles: true,
        cancelable: true,
      }));
    }

    // Final change event
    element.dispatchEvent(new Event('change', { bubbles: true }));

    // Try to set value using native setter (bypasses React's synthetic events)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (element instanceof HTMLInputElement && nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (element instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Handle contenteditable divs (used in some modern editors)
  if (htmlElement.contentEditable === 'true') {
    htmlElement.textContent = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Simulate select change
function simulateSelect(element: Element, value: string): void {
  if (element instanceof HTMLSelectElement) {
    // Focus first
    element.focus();

    // Find and select the option
    for (let i = 0; i < element.options.length; i++) {
      if (element.options[i].value === value || element.options[i].text === value) {
        element.selectedIndex = i;
        break;
      }
    }

    // Dispatch events
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Simulate keypress
function simulateKeypress(element: Element, key: string): void {
  const keyCode = key.charCodeAt(0);
  const specialKeyCodes: Record<string, number> = {
    'Enter': 13,
    'Tab': 9,
    'Escape': 27,
    'Backspace': 8,
    'Delete': 46,
    'ArrowUp': 38,
    'ArrowDown': 40,
    'ArrowLeft': 37,
    'ArrowRight': 39,
  };

  const code = specialKeyCodes[key] || keyCode;

  const eventInit = {
    key,
    code: specialKeyCodes[key] ? key : `Key${key.toUpperCase()}`,
    keyCode: code,
    which: code,
    charCode: code,
    bubbles: true,
    cancelable: true,
  };

  element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  element.dispatchEvent(new KeyboardEvent('keypress', eventInit));
  element.dispatchEvent(new KeyboardEvent('keyup', eventInit));

  // For Enter key on forms, also try to submit
  if (key === 'Enter') {
    const form = element.closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  // For Tab, try to move focus
  if (key === 'Tab') {
    const focusableElements = document.querySelectorAll(
      'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    );
    const currentIndex = Array.from(focusableElements).indexOf(element as HTMLElement);
    if (currentIndex >= 0 && currentIndex < focusableElements.length - 1) {
      (focusableElements[currentIndex + 1] as HTMLElement).focus();
    }
  }
}

// Simulate scroll
function simulateScroll(position: { x: number; y: number }): void {
  window.scrollTo({
    left: position.x,
    top: position.y,
    behavior: 'smooth',
  });
}

// Execute a single step
export async function executeStep(step: RecordedStep): Promise<boolean> {
  // Handle wait step
  if (step.type === 'wait' && step.delay) {
    await new Promise((resolve) => setTimeout(resolve, step.delay));
    return true;
  }

  // Handle scroll step
  if (step.type === 'scroll' && step.scrollPosition) {
    simulateScroll(step.scrollPosition);
    return true;
  }

  // Find the target element
  const element = findElement(step.target);
  if (!element) {
    console.error('Flow Recorder: Element not found for step', step);
    return false;
  }

  // Highlight the element
  const removeHighlight = highlightElement(element);

  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Wait a bit for scroll
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Execute the action
  switch (step.type) {
    case 'click':
      simulateClick(element, step.position);
      break;

    case 'input':
      if (step.value !== undefined) {
        simulateInput(element, step.value);
      }
      break;

    case 'select':
      if (step.value !== undefined) {
        simulateSelect(element, step.value);
      }
      break;

    case 'keypress':
      if (step.value) {
        simulateKeypress(element, step.value);
      }
      break;

    default:
      console.warn('Flow Recorder: Unknown step type', step.type);
  }

  // Remove highlight after a short delay
  setTimeout(removeHighlight, 500);

  return true;
}
