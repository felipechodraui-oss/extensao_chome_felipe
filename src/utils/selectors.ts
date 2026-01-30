import type { ElementSelector } from '../types';

// Generate a unique CSS selector for an element
export function generateCssSelector(element: Element): string {
  // Try ID first
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try data-testid or other test attributes
  const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  // Build a path from the element to root
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add class names for specificity
    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .split(' ')
        .filter((c) => c.trim() && !c.includes(':'))
        .slice(0, 2);
      if (classes.length) {
        selector += '.' + classes.map((c) => CSS.escape(c)).join('.');
      }
    }

    // Add nth-child if needed for uniqueness
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
  // Try CSS selector first (with Shadow DOM support)
  const elementByCss = querySelectorDeep(document, selector.css);
  if (elementByCss) return elementByCss;

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
      return result.singleNodeValue as Element;
    }
  } catch {
    // Invalid XPath
  }

  // Try finding by text content (with Shadow DOM support)
  if (selector.text) {
    const elementByText = findByTextDeep(document, selector.tagName, selector.text);
    if (elementByText) return elementByText;
  }

  // Try finding by ID
  if (selector.attributes.id) {
    const elementById = document.getElementById(selector.attributes.id);
    if (elementById) return elementById;
  }

  // Try finding by name attribute
  if (selector.attributes.name) {
    const elementByName = document.querySelector(`[name="${CSS.escape(selector.attributes.name)}"]`);
    if (elementByName) return elementByName;
  }

  // Try finding by aria-label
  if (selector.attributes['aria-label']) {
    const elementByAria = querySelectorDeep(
      document,
      `[aria-label="${CSS.escape(selector.attributes['aria-label'])}"]`
    );
    if (elementByAria) return elementByAria;
  }

  // Try finding by placeholder
  if (selector.attributes.placeholder) {
    const elementByPlaceholder = querySelectorDeep(
      document,
      `[placeholder="${CSS.escape(selector.attributes.placeholder)}"]`
    );
    if (elementByPlaceholder) return elementByPlaceholder;
  }

  // Last resort: find by tag and approximate text match
  if (selector.text) {
    const allByTag = querySelectorAllDeep(document, selector.tagName);
    for (const el of allByTag) {
      const elText = el.textContent?.trim() || '';
      if (elText.includes(selector.text) || selector.text.includes(elText)) {
        return el;
      }
    }
  }

  return null;
}
