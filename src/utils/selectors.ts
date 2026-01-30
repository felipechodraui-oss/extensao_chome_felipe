import type { ElementSelector } from '../types';

// Generate a unique CSS selector for an element
export function generateCssSelector(element: Element): string {
  // Priority 1: ID (most reliable)
  if (element.id && !element.id.includes(':')) {
    return `#${CSS.escape(element.id)}`;
  }

  // Priority 2: data-testid (designed for testing)
  const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  // Priority 3: name attribute (common for form elements)
  const name = element.getAttribute('name');
  if (name) {
    const tagName = element.tagName.toLowerCase();
    return `${tagName}[name="${CSS.escape(name)}"]`;
  }

  // Priority 4: aria-label (accessibility attribute, usually stable)
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.length < 50) {
    return `[aria-label="${CSS.escape(ariaLabel)}"]`;
  }

  // Priority 5: placeholder (for inputs)
  const placeholder = element.getAttribute('placeholder');
  if (placeholder && placeholder.length < 50) {
    return `[placeholder="${CSS.escape(placeholder)}"]`;
  }

  // Priority 6: Build a path from the element to root
  const path: string[] = [];
  let current: Element | null = element;
  let depth = 0;
  const maxDepth = 5; // Limit path depth for robustness

  while (current && current !== document.body && depth < maxDepth) {
    let selector = current.tagName.toLowerCase();

    // Try to add a unique identifier
    if (current.id && !current.id.includes(':')) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break; // ID is unique, no need to go further
    }

    // Add meaningful class names (avoid dynamic/generated classes)
    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .split(' ')
        .filter((c) => {
          const trimmed = c.trim();
          // Filter out dynamic-looking classes
          return trimmed &&
            !trimmed.includes(':') &&
            !trimmed.match(/^[a-z]{1,2}-/) && // Avoid Tailwind-like classes
            !trimmed.match(/^\d/) && // Avoid classes starting with numbers
            !trimmed.match(/^_/) && // Avoid underscore prefixed (CSS modules)
            trimmed.length > 2; // Avoid very short classes
        })
        .slice(0, 2);
      if (classes.length) {
        selector += '.' + classes.map((c) => CSS.escape(c)).join('.');
      }
    }

    // Add nth-of-type if needed for uniqueness
    const parentEl = current.parentElement;
    if (parentEl) {
      const currentTagName = current.tagName;
      const siblings = Array.from(parentEl.children) as Element[];
      const matchingSiblings = siblings.filter((child) => child.tagName === currentTagName);
      if (matchingSiblings.length > 1) {
        const index = matchingSiblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
    depth++;
  }

  return path.join(' > ');
}

// Generate XPath for an element
export function generateXPath(element: Element): string {
  // Try ID first
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling: Element | null = current.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    const tagName = current.tagName.toLowerCase();
    const pathIndex = index > 1 ? `[${index}]` : '';
    path.unshift(`${tagName}${pathIndex}`);

    current = current.parentElement;
  }

  return '/' + path.join('/');
}

// Get relevant attributes for an element
export function getElementAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  const relevantAttrs = [
    'id',
    'name',
    'type',
    'placeholder',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'data-testid',
    'data-test-id',
    'data-value',
    'data-answer-value',
    'role',
    'href',
    'value',
    'for',
    'title',
    'alt',
  ];

  for (const attr of relevantAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      attrs[attr] = value;
    }
  }

  // For Google Forms: capture data-params which contains question info
  const dataParams = element.getAttribute('data-params');
  if (dataParams) {
    attrs['data-params'] = dataParams.substring(0, 200); // Truncate if too long
  }

  return attrs;
}

// Get text content (trimmed, limited length)
export function getElementText(element: Element): string | undefined {
  const text = element.textContent?.trim();
  if (text && text.length > 0 && text.length < 100) {
    return text;
  }
  return undefined;
}

// Generate complete element selector
export function generateElementSelector(element: Element): ElementSelector {
  return {
    css: generateCssSelector(element),
    xpath: generateXPath(element),
    text: getElementText(element),
    tagName: element.tagName.toLowerCase(),
    attributes: getElementAttributes(element),
  };
}

// Recursively search through Shadow DOM
function querySelectorDeep(root: Document | Element | ShadowRoot, cssSelector: string): Element | null {
  // Try in current root
  try {
    const element = root.querySelector(cssSelector);
    if (element) return element;
  } catch {
    // Invalid selector
  }

  // Search in shadow roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const found = querySelectorDeep(el.shadowRoot, cssSelector);
      if (found) return found;
    }
  }

  return null;
}

// Find all elements matching selector, including in Shadow DOM
function querySelectorAllDeep(root: Document | Element | ShadowRoot, cssSelector: string): Element[] {
  const results: Element[] = [];

  try {
    const elements = root.querySelectorAll(cssSelector);
    results.push(...Array.from(elements));
  } catch {
    // Invalid selector
  }

  // Search in shadow roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      results.push(...querySelectorAllDeep(el.shadowRoot, cssSelector));
    }
  }

  return results;
}

// Find element by text content, including Shadow DOM
function findByTextDeep(root: Document | Element | ShadowRoot, tagName: string, text: string): Element | null {
  const elements = root.querySelectorAll(tagName);
  for (const el of elements) {
    if (el.textContent?.trim() === text) {
      return el;
    }
  }

  // Search in shadow roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const found = findByTextDeep(el.shadowRoot, tagName, text);
      if (found) return found;
    }
  }

  return null;
}

// Find element using selector (tries multiple strategies)
export function findElement(selector: ElementSelector): Element | null {
  console.log('Flow Recorder: Finding element with selector:', {
    css: selector.css,
    xpath: selector.xpath,
    text: selector.text,
    tagName: selector.tagName,
  });

  // Try CSS selector first (with Shadow DOM support)
  const elementByCss = querySelectorDeep(document, selector.css);
  if (elementByCss) {
    console.log('Flow Recorder: Found element via CSS selector');
    return elementByCss;
  }

  // Try XPath (doesn't support Shadow DOM, but try anyway)
  try {
    const result = document.evaluate(
      selector.xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    if (result.singleNodeValue) {
      console.log('Flow Recorder: Found element via XPath');
      return result.singleNodeValue as Element;
    }
  } catch (e) {
    console.log('Flow Recorder: XPath evaluation failed:', e);
  }

  // Try finding by text content (with Shadow DOM support)
  if (selector.text) {
    const elementByText = findByTextDeep(document, selector.tagName, selector.text);
    if (elementByText) {
      console.log('Flow Recorder: Found element via text content');
      return elementByText;
    }
  }

  // Try finding by ID
  if (selector.attributes.id) {
    const elementById = document.getElementById(selector.attributes.id);
    if (elementById) {
      console.log('Flow Recorder: Found element via ID');
      return elementById;
    }
  }

  // Try finding by name attribute
  if (selector.attributes.name) {
    const elementByName = querySelectorDeep(document, `[name="${CSS.escape(selector.attributes.name)}"]`);
    if (elementByName) {
      console.log('Flow Recorder: Found element via name attribute');
      return elementByName;
    }
  }

  // Try finding by aria-label
  if (selector.attributes['aria-label']) {
    const elementByAria = querySelectorDeep(
      document,
      `[aria-label="${CSS.escape(selector.attributes['aria-label'])}"]`
    );
    if (elementByAria) {
      console.log('Flow Recorder: Found element via aria-label');
      return elementByAria;
    }
  }

  // Try finding by placeholder
  if (selector.attributes.placeholder) {
    const elementByPlaceholder = querySelectorDeep(
      document,
      `[placeholder="${CSS.escape(selector.attributes.placeholder)}"]`
    );
    if (elementByPlaceholder) {
      console.log('Flow Recorder: Found element via placeholder');
      return elementByPlaceholder;
    }
  }

  // Try finding by data-testid
  if (selector.attributes['data-testid']) {
    const elementByTestId = querySelectorDeep(
      document,
      `[data-testid="${CSS.escape(selector.attributes['data-testid'])}"]`
    );
    if (elementByTestId) {
      console.log('Flow Recorder: Found element via data-testid');
      return elementByTestId;
    }
  }

  // Try finding by role + text combination
  if (selector.attributes.role && selector.text) {
    const elementsByRole = querySelectorAllDeep(document, `[role="${selector.attributes.role}"]`);
    for (const el of elementsByRole) {
      if (el.textContent?.trim() === selector.text) {
        console.log('Flow Recorder: Found element via role + text');
        return el;
      }
    }
  }

  // Last resort: find by tag and approximate text match
  if (selector.text) {
    const allByTag = querySelectorAllDeep(document, selector.tagName);
    for (const el of allByTag) {
      const elText = el.textContent?.trim() || '';
      if (elText.includes(selector.text) || selector.text.includes(elText)) {
        console.log('Flow Recorder: Found element via approximate text match');
        return el;
      }
    }
  }

  console.log('Flow Recorder: Element not found with any strategy');
  return null;
}

// Find element with retry (for dynamic content)
export async function findElementWithRetry(
  selector: ElementSelector,
  maxAttempts: number = 10,
  intervalMs: number = 500
): Promise<Element | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const element = findElement(selector);
    if (element) {
      return element;
    }

    if (attempt < maxAttempts) {
      console.log(`Flow Recorder: Element not found, attempt ${attempt}/${maxAttempts}. Retrying in ${intervalMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  console.error('Flow Recorder: Element not found after all retries');
  return null;
}
