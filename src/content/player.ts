import type { RecordedStep, ElementSelector } from '../types';

// ============================================================================
// CAPTCHA DETECTION
// ============================================================================

const CAPTCHA_SELECTORS = [
  '.g-recaptcha', 'iframe[src*="recaptcha"]', 'iframe[title*="reCAPTCHA"]',
  '#recaptcha', '[data-sitekey]', '.h-captcha', 'iframe[src*="hcaptcha"]',
  '.cf-turnstile', 'iframe[src*="challenges.cloudflare.com"]',
  '#funcaptcha', 'iframe[src*="funcaptcha"]',
  '[class*="captcha"]', '[id*="captcha"]', 'img[src*="captcha"]',
];

let lastCaptchaAlertTime = 0;
const CAPTCHA_COOLDOWN_MS = 30000;

export function detectCaptcha(): { detected: boolean; type: string | null } {
  if (Date.now() - lastCaptchaAlertTime < CAPTCHA_COOLDOWN_MS) {
    return { detected: false, type: null };
  }

  for (const selector of CAPTCHA_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
          let type = 'CAPTCHA';
          if (selector.includes('recaptcha')) type = 'reCAPTCHA';
          else if (selector.includes('hcaptcha')) type = 'hCaptcha';
          else if (selector.includes('cloudflare')) type = 'Cloudflare Turnstile';
          return { detected: true, type };
        }
      }
    } catch { /* ignore */ }
  }
  return { detected: false, type: null };
}

function showCaptchaAlert(captchaType: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'flow-recorder-captcha-overlay';
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;`;
    overlay.innerHTML = `
      <div style="background:white;border-radius:12px;padding:24px 32px;max-width:400px;text-align:center;">
        <div style="font-size:48px;">🤖</div>
        <h2 style="margin:12px 0;color:#333;">CAPTCHA Detectado</h2>
        <p style="color:#666;font-size:14px;">Detectamos um <strong>${captchaType}</strong>. Clique em "Vou Resolver" para ter 20 segundos.</p>
        <div id="countdown" style="display:none;font-size:32px;font-weight:bold;color:#4CAF50;margin:16px 0;"></div>
        <div id="buttons" style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
          <button id="resolve" style="background:#4CAF50;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;">Vou Resolver</button>
          <button id="stop" style="background:#f44336;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;">Parar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#resolve')?.addEventListener('click', () => {
      (overlay.querySelector('#buttons') as HTMLElement).style.display = 'none';
      const countdown = overlay.querySelector('#countdown') as HTMLElement;
      countdown.style.display = 'block';
      let seconds = 20;
      countdown.textContent = String(seconds);
      const interval = setInterval(() => {
        seconds--;
        countdown.textContent = String(seconds);
        if (seconds <= 0) {
          clearInterval(interval);
          overlay.remove();
          lastCaptchaAlertTime = Date.now();
          resolve(true);
        }
      }, 1000);
    });

    overlay.querySelector('#stop')?.addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
  });
}

// ============================================================================
// DEEP QUERY SELECTOR - Traverses Shadow DOM
// ============================================================================

/**
 * Query selector that traverses ALL shadow roots recursively
 */
function deepQuerySelector(selector: string, root: Document | Element | ShadowRoot = document): Element | null {
  // Try in current root
  try {
    const element = root.querySelector(selector);
    if (element) return element;
  } catch { /* invalid selector */ }

  // Search in all shadow roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if ((el as HTMLElement).shadowRoot) {
      const found = deepQuerySelector(selector, (el as HTMLElement).shadowRoot!);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Find element using shadow host path (format: "host1 >>> host2 >>> target")
 */
function findByShadowPath(hostPath: string, targetSelector: string): Element | null {
  const hosts = hostPath.split(' >>> ').map(s => s.trim());
  let currentRoot: Document | ShadowRoot = document;

  for (const hostSelector of hosts) {
    const hostElement: Element | null = currentRoot.querySelector(hostSelector);
    if (!hostElement || !(hostElement as HTMLElement).shadowRoot) {
      console.log('Flow Recorder: Shadow host not found:', hostSelector);
      return null;
    }
    currentRoot = (hostElement as HTMLElement).shadowRoot!;
  }

  // Now search in the final shadow root
  return currentRoot.querySelector(targetSelector);
}

/**
 * Check if element is visible and interactable
 */
function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

  return true;
}

/**
 * Wait for element to be visible with timeout
 */
async function waitForVisible(element: Element, timeoutMs: number = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isElementVisible(element)) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

// ============================================================================
// ELEMENT FINDER - Multiple strategies with Shadow DOM support
// ============================================================================

function findElement(selector: ElementSelector): Element | null {
  console.log('Flow Recorder: Finding element:', selector);

  // Strategy 1: Check for shadow host path
  const shadowPath = selector.attributes['data-shadow-host-path'];
  if (shadowPath) {
    console.log('Flow Recorder: Using shadow path:', shadowPath);
    const element = findByShadowPath(shadowPath, selector.css);
    if (element) {
      console.log('Flow Recorder: Found via shadow path');
      return element;
    }
  }

  // Strategy 2: Deep CSS selector (traverses shadow DOM)
  const byCss = deepQuerySelector(selector.css);
  if (byCss) {
    console.log('Flow Recorder: Found via deep CSS');
    return byCss;
  }

  // Strategy 3: XPath (doesn't work in shadow DOM, but try anyway)
  try {
    const result = document.evaluate(selector.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    if (result.singleNodeValue) {
      console.log('Flow Recorder: Found via XPath');
      return result.singleNodeValue as Element;
    }
  } catch { /* ignore */ }

  // Strategy 4: By ID (with deep search)
  if (selector.attributes.id) {
    const byId = document.getElementById(selector.attributes.id) || deepQuerySelector(`#${selector.attributes.id}`);
    if (byId) {
      console.log('Flow Recorder: Found via ID');
      return byId;
    }
  }

  // Strategy 5: By name attribute
  if (selector.attributes.name) {
    const byName = deepQuerySelector(`[name="${selector.attributes.name}"]`);
    if (byName) {
      console.log('Flow Recorder: Found via name');
      return byName;
    }
  }

  // Strategy 6: By placeholder
  if (selector.attributes.placeholder) {
    const byPlaceholder = deepQuerySelector(`[placeholder="${selector.attributes.placeholder}"]`);
    if (byPlaceholder) {
      console.log('Flow Recorder: Found via placeholder');
      return byPlaceholder;
    }
  }

  // Strategy 7: By aria-label
  if (selector.attributes['aria-label']) {
    const byAria = deepQuerySelector(`[aria-label="${selector.attributes['aria-label']}"]`);
    if (byAria) {
      console.log('Flow Recorder: Found via aria-label');
      return byAria;
    }
  }

  // Strategy 8: By data-testid
  if (selector.attributes['data-testid']) {
    const byTestId = deepQuerySelector(`[data-testid="${selector.attributes['data-testid']}"]`);
    if (byTestId) {
      console.log('Flow Recorder: Found via data-testid');
      return byTestId;
    }
  }

  // Strategy 9: By text content
  if (selector.text) {
    const allByTag = Array.from(document.querySelectorAll(selector.tagName));
    for (const el of allByTag) {
      if (el.textContent?.trim() === selector.text) {
        console.log('Flow Recorder: Found via text content');
        return el;
      }
    }
  }

  console.log('Flow Recorder: Element not found with any strategy');
  return null;
}

async function findElementWithRetry(selector: ElementSelector, maxAttempts: number = 10, intervalMs: number = 500): Promise<Element | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const element = findElement(selector);
    if (element) return element;
    console.log(`Flow Recorder: Retry ${i + 1}/${maxAttempts}`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

// ============================================================================
// EVENT SIMULATION
// ============================================================================

function highlightElement(element: Element): () => void {
  const el = element as HTMLElement;
  const originalOutline = el.style.outline;
  el.style.outline = '3px solid #4CAF50';
  return () => { el.style.outline = originalOutline; };
}

function simulateClick(element: Element, position?: { x: number; y: number }): void {
  const el = element as HTMLElement;
  el.scrollIntoView({ behavior: 'instant', block: 'center' });

  const rect = el.getBoundingClientRect();
  const x = position?.x ?? rect.left + rect.width / 2;
  const y = position?.y ?? rect.top + rect.height / 2;

  console.log('Flow Recorder: Clicking at', x, y);

  // Focus first
  el.focus?.();

  // Dispatch pointer and mouse events
  const events = [
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y }),
    new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y }),
    new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y }),
    new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y }),
    new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y }),
  ];

  for (const event of events) {
    element.dispatchEvent(event);
  }

  // Native click
  el.click?.();

  // Handle checkbox/radio
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    const newState = el.type === 'radio' ? true : !el.checked;
    el.checked = newState;
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }
}

function simulateInput(element: Element, value: string): void {
  const el = element as HTMLElement;
  el.scrollIntoView({ behavior: 'instant', block: 'center' });

  console.log('Flow Recorder: Inputting value:', value);

  // Click to focus
  el.click?.();
  el.focus?.();

  // Find the actual input element
  let input: HTMLInputElement | HTMLTextAreaElement | null = null;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    input = el;
  } else {
    // Search in element and its shadow root
    input = el.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    if (!input && (el as HTMLElement).shadowRoot) {
      input = (el as HTMLElement).shadowRoot!.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    }
  }

  if (!input) {
    console.log('Flow Recorder: No input element found, trying active element');
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      input = active;
    }
  }

  if (input) {
    input.focus();

    // Use native setter to bypass framework proxies
    const proto = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (setter) {
      setter.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      setter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    console.log('Flow Recorder: Value set to:', input.value);
  } else {
    console.error('Flow Recorder: Could not find input element');
  }
}

function simulateSelect(element: Element, value: string): void {
  if (element instanceof HTMLSelectElement) {
    element.focus();
    for (let i = 0; i < element.options.length; i++) {
      if (element.options[i].value === value || element.options[i].text === value) {
        element.selectedIndex = i;
        break;
      }
    }
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }
}

function simulateKeypress(element: Element, key: string): void {
  const keyCode = key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : key.charCodeAt(0);
  const eventInit = { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true };

  element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  element.dispatchEvent(new KeyboardEvent('keypress', eventInit));
  element.dispatchEvent(new KeyboardEvent('keyup', eventInit));

  if (key === 'Enter') {
    const form = element.closest('form');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
}

function simulateScroll(position: { x: number; y: number }): void {
  window.scrollTo({ left: position.x, top: position.y, behavior: 'smooth' });
}

// ============================================================================
// STEP EXECUTOR
// ============================================================================

export async function executeStep(step: RecordedStep): Promise<boolean> {
  console.log('Flow Recorder: Executing step:', step.type, step);

  // Check for captcha
  const captcha = detectCaptcha();
  if (captcha.detected) {
    const shouldContinue = await showCaptchaAlert(captcha.type || 'CAPTCHA');
    if (!shouldContinue) return false;
  }

  // Handle wait and scroll steps
  if (step.type === 'wait' && step.delay) {
    await new Promise(r => setTimeout(r, step.delay));
    return true;
  }

  if (step.type === 'scroll' && step.scrollPosition) {
    simulateScroll(step.scrollPosition);
    return true;
  }

  // Find the target element
  const element = await findElementWithRetry(step.target);
  if (!element) {
    console.error('Flow Recorder: Element not found');
    return false;
  }

  // Wait for element to be visible
  const visible = await waitForVisible(element);
  if (!visible) {
    console.warn('Flow Recorder: Element not visible, proceeding anyway');
  }

  // Highlight element
  const removeHighlight = highlightElement(element);

  // Scroll into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 300));

  // Execute action
  try {
    switch (step.type) {
      case 'click':
        simulateClick(element, step.position);
        break;
      case 'input':
        if (step.value !== undefined) simulateInput(element, step.value);
        break;
      case 'select':
        if (step.value !== undefined) simulateSelect(element, step.value);
        break;
      case 'keypress':
        if (step.value) simulateKeypress(element, step.value);
        break;
    }
  } catch (error) {
    console.error('Flow Recorder: Error executing step:', error);
    removeHighlight();
    return false;
  }

  setTimeout(removeHighlight, 500);
  console.log('Flow Recorder: Step completed');
  return true;
}
