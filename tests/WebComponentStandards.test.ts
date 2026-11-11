import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MinecraftBookElement } from '../src/component/blockgame-book';

describe('Web Component Standards Compliance (<blockgame-book>)', () => {
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      setLineDash: vi.fn(),
      clearRect: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(32 * 32 * 4) })),
      imageSmoothingEnabled: false,
      putImageData: vi.fn(),
      createImageData: vi.fn(),
    };

    const makeEl = (tag: string) => {
      const children: any[] = [];
      const attributes: Record<string, string> = {};
      const el: any = {
        tagName: tag.toUpperCase(),
        children,
        attributes,
        style: {},
        classList: {
          classes: new Set<string>(),
          add(...tokens: string[]) {
            tokens.forEach((t) => this.classes.add(t));
          },
          remove(...tokens: string[]) {
            tokens.forEach((t) => this.classes.delete(t));
          },
          contains(t: string) {
            return this.classes.has(t);
          },
        },
        setAttribute(k: string, v: string) {
          attributes[k] = String(v);
        },
        getAttribute(k: string) {
          return attributes[k] ?? null;
        },
        hasAttribute(k: string) {
          return k in attributes;
        },
        removeAttribute(k: string) {
          delete attributes[k];
        },
        appendChild(child: any) {
          child.parentNode = el;
          children.push(child);
          return child;
        },
        removeChild(child: any) {
          const idx = children.indexOf(child);
          if (idx !== -1) children.splice(idx, 1);
          child.parentNode = null;
          return child;
        },
        remove() {
          if (el.parentNode && el.parentNode.removeChild) {
            el.parentNode.removeChild(el);
          }
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        querySelector(sel: string): any {
          const all = this.querySelectorAll(sel);
          if (all.length > 0) return all[0];
          const fallback = makeEl(sel.includes('btn') || sel.includes('button') ? 'button' : 'div');
          if (sel.startsWith('#')) fallback.id = sel.slice(1);
          if (sel.startsWith('.')) fallback.className = sel.slice(1);
          return fallback;
        },
        querySelectorAll(sel: string): any[] {
          const results: any[] = [];
          const check = (node: any) => {
            let match = false;
            if (sel.startsWith('.')) {
              const cls = sel.slice(1);
              if (node.classList?.contains(cls) || node.className?.split(' ').includes(cls)) match = true;
            } else if (sel.startsWith('#')) {
              if (node.id === sel.slice(1) || node.attributes?.id === sel.slice(1)) match = true;
            } else if (node.tagName?.toLowerCase() === sel.toLowerCase()) {
              match = true;
            }
            if (match) results.push(node);
            for (const child of node.children || []) {
              check(child);
            }
          };
          for (const child of this.children || []) {
            check(child);
          }
          return results;
        },
      };
      if (tag === 'canvas') {
        el.getContext = () => mockCtx;
        el.width = 146;
        el.height = 180;
      }
      return el;
    };

    const mockBody = makeEl('body');
    (globalThis as any).document = {
      createElement: makeEl,
      activeElement: null,
      body: mockBody,
    };
    (globalThis as any).window = {
      innerWidth: 1024,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  const setupElement = () => {
    const el = new MinecraftBookElement();
    const attrs: Record<string, string> = {
      'base-path': './assets',
    };
    const events: CustomEvent[] = [];

    (el as any).attributes = attrs;
    (el as any).getAttribute = (k: string) => attrs[k] ?? null;
    (el as any).hasAttribute = (k: string) => k in attrs;
    (el as any).setAttribute = (k: string, v: string) => {
      const old = attrs[k] ?? null;
      attrs[k] = String(v);
      el.attributeChangedCallback(k, old, String(v));
    };
    (el as any).removeAttribute = (k: string) => {
      const old = attrs[k] ?? null;
      delete attrs[k];
      el.attributeChangedCallback(k, old, null);
    };

    const listeners: Record<string, Function[]> = {};
    (el as any).addEventListener = (type: string, fn: Function) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    };
    (el as any).removeEventListener = (type: string, fn: Function) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((f) => f !== fn);
      }
    };
    (el as any).dispatchEvent = (evt: CustomEvent) => {
      events.push(evt);
      if (listeners[evt.type]) {
        listeners[evt.type].forEach((fn) => fn(evt));
      }
      return true;
    };

    const children: any[] = [];
    (el as any).children = children;
    (el as any).appendChild = (child: any) => {
      child.parentNode = el;
      children.push(child);
      return child;
    };
    (el as any).removeChild = (child: any) => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentNode = null;
      return child;
    };
    (el as any).querySelector = (sel: string) => {
      for (const c of children) {
        if (sel.includes('script') && c.tagName === 'SCRIPT') return c;
        if (sel.includes('pre') && c.tagName === 'PRE') return c;
      }
      return null;
    };
    (el as any).classList = {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false),
    };
    (el as any).clientWidth = 800;

    return { el, attrs, events, listeners, children };
  };

  it('exposes full property <-> attribute symmetry', async () => {
    const { el } = setupElement();

    // src
    el.src = 'https://example.com/book.json';
    expect(el.getAttribute('src')).toBe('https://example.com/book.json');
    expect(el.src).toBe('https://example.com/book.json');

    // text
    el.text = 'Page 1 line';
    expect(el.getAttribute('text')).toBe('Page 1 line');
    expect(el.text).toBe('Page 1 line');

    // bookTitle & author
    el.bookTitle = 'The Great Quest';
    expect(el.getAttribute('book-title')).toBe('The Great Quest');
    expect(el.bookTitle).toBe('The Great Quest');

    el.author = 'Explorer';
    expect(el.getAttribute('author')).toBe('Explorer');
    expect(el.author).toBe('Explorer');

    // controls
    el.controls = false;
    expect(el.getAttribute('controls')).toBe('false');
    expect(el.controls).toBe(false);

    el.controls = true;
    expect(el.getAttribute('controls')).toBe('true');
    expect(el.controls).toBe(true);

    // sound
    el.sound = false;
    expect(el.getAttribute('sound')).toBe('false');
    expect(el.sound).toBe(false);

    el.sound = true;
    expect(el.getAttribute('sound')).toBe('true');
    expect(el.sound).toBe(true);

    // scale
    el.scale = 3;
    expect(el.getAttribute('scale')).toBe('3');
    expect(el.scale).toBe(3);

    // splitMode
    el.splitMode = 'standard';
    expect(el.getAttribute('split-mode')).toBe('standard');
    expect(el.splitMode).toBe('standard');

    // basePath
    el.basePath = '/custom/assets';
    expect(el.getAttribute('base-path')).toBe('/custom/assets');
    expect(el.basePath).toBe('/custom/assets');
  });

  it('resolves ready promise and dispatches ready event upon initialization', async () => {
    const { el, events } = setupElement();

    let readyResolved = false;
    el.whenReady().then((viewer) => {
      readyResolved = true;
      expect(viewer).toBeDefined();
    });

    await el.connectedCallback();

    expect(readyResolved).toBe(true);
    const readyEvent = events.find((e) => e.type === 'ready');
    expect(readyEvent).toBeDefined();
    expect(readyEvent?.bubbles).toBe(true);
    expect(readyEvent?.composed).toBe(true);
    expect(readyEvent?.detail.viewer).toBeDefined();
  });

  it('dispatches bubbling and composed custom events with kebab-case aliases', async () => {
    const { el, events } = setupElement();
    el.text = 'Page 1 text\nPage 2 text';

    await el.connectedCallback();

    // Change page
    el.nextPage();

    const pagechangeEvents = events.filter((e) => e.type === 'pagechange');
    const pageChangeEvents = events.filter((e) => e.type === 'page-change');

    expect(pagechangeEvents.length).toBeGreaterThanOrEqual(1);
    expect(pageChangeEvents.length).toBeGreaterThanOrEqual(1);
    expect(pagechangeEvents[0].bubbles).toBe(true);
    expect(pagechangeEvents[0].composed).toBe(true);
    expect(pageChangeEvents[0].bubbles).toBe(true);
    expect(pageChangeEvents[0].composed).toBe(true);
    expect(pagechangeEvents[0].detail.page).toBeDefined();
    expect(pagechangeEvents[0].detail.total).toBeDefined();
  });

  it('sets up ARIA landmark roles and updates aria-label dynamically', async () => {
    const { el } = setupElement();
    el.bookTitle = 'The Ancient Tome';
    el.author = 'Archmage';

    await el.connectedCallback();

    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-roledescription')).toBe('book');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('aria-label')).toBe('The Ancient Tome by Archmage');

    el.bookTitle = 'New Title';
    expect(el.getAttribute('aria-label')).toBe('New Title by Archmage');
  });

  it('handles keyboard navigation commands (ArrowRight, ArrowLeft, Home, End)', async () => {
    const { el, listeners } = setupElement();
    el.text = 'Page 1\nPage 2\nPage 3\nPage 4';

    await el.connectedCallback();

    expect(listeners['keydown']).toBeDefined();
    const keydownHandler = listeners['keydown'][0];

    // Go to next page
    const rightEvent = { key: 'ArrowRight', preventDefault: vi.fn() };
    keydownHandler(rightEvent);
    expect(rightEvent.preventDefault).toHaveBeenCalled();

    // Go to home
    const homeEvent = { key: 'Home', preventDefault: vi.fn() };
    keydownHandler(homeEvent);
    expect(homeEvent.preventDefault).toHaveBeenCalled();
    expect(el.page).toBe(1);

    // Go to end
    const endEvent = { key: 'End', preventDefault: vi.fn() };
    keydownHandler(endEvent);
    expect(endEvent.preventDefault).toHaveBeenCalled();
  });

  it('provides navigation helpers: firstPage, lastPage, zoomIn, zoomOut, toggleSound, getBook', async () => {
    const { el } = setupElement();
    el.text = Array.from({ length: 35 }, (_, i) => `Paragraph line ${i + 1}`).join('\n');

    await el.connectedCallback();

    expect(el.getBook()).toBeDefined();
    expect(el.page).toBe(1);

    el.lastPage();
    expect(el.page).toBeGreaterThan(1);

    el.firstPage();
    expect(el.page).toBe(1);

    const soundBefore = el.sound;
    const toggled = el.toggleSound();
    expect(toggled).toBe(!soundBefore);

    expect(() => el.zoomIn()).not.toThrow();
    expect(() => el.zoomOut()).not.toThrow();
  });

  it('preserves user light DOM child elements across disconnection and reconnection', async () => {
    const { el, children } = setupElement();

    // Attach user script element
    const userScript = {
      tagName: 'SCRIPT',
      textContent: `
title: Preserved Book
author: Scribe
pages:
#- Page 1 Still Here
#- Page 2 Still Here
      `,
    };
    children.push(userScript);

    await el.connectedCallback();
    expect(el.bookTitle).toBe('Preserved Book');

    // Disconnect
    el.disconnectedCallback();

    // Verify user script was NOT destroyed or removed
    expect(children).toContain(userScript);

    // Reconnect
    await el.connectedCallback();
    expect(el.bookTitle).toBe('Preserved Book');
  });

  it('handles dynamic changes to sound and controls attributes at runtime', async () => {
    const { el } = setupElement();
    el.text = 'Sample Text';

    await el.connectedCallback();

    // Update sound
    el.setAttribute('sound', 'false');
    expect(el.sound).toBe(false);

    el.setAttribute('sound', 'true');
    expect(el.sound).toBe(true);

    // Update controls
    el.setAttribute('controls', 'false');
    expect(el.controls).toBe(false);
    expect(el.getViewer()?.isControlsVisible()).toBe(false);

    el.setAttribute('controls', 'true');
    expect(el.controls).toBe(true);
    expect(el.getViewer()?.isControlsVisible()).toBe(true);
  });

  it('prevents infinite loops and stale script overwrites when setBook is called with inline script', async () => {
    // Setup mock MutationObserver
    let observerCallbacks: Function[] = [];
    class MockMutationObserver {
      callback: Function;
      observedTarget: any;
      constructor(cb: Function) {
        this.callback = cb;
        observerCallbacks.push(cb);
      }
      observe(target: any) {
        this.observedTarget = target;
      }
      disconnect() {
        observerCallbacks = observerCallbacks.filter((c) => c !== this.callback);
      }
    }
    const origMO = (globalThis as any).MutationObserver;
    (globalThis as any).MutationObserver = MockMutationObserver;

    try {
      const { el, children } = setupElement();
      const inlineScript = {
        tagName: 'SCRIPT',
        attributes: { type: 'text/plain' },
        getAttribute: (k: string) => (k === 'type' ? 'text/plain' : null),
        textContent: `
title: Inline Initial
author: Initial Scribe
pages:
#- Initial Page 1
        `,
      };
      children.push(inlineScript);

      await el.connectedCallback();
      expect(el.bookTitle).toBe('Inline Initial');

      // Programmatically switch to a different sample book
      const newBook = {
        title: 'New Sample Tome',
        author: 'New Author',
        pages: ['§1New Page 1 content', '§2New Page 2 content'],
      };

      let mutationCycles = 0;
      // If observer callbacks fire (e.g. simulating browser microtasks), it should NOT loop or overwrite
      el.setBook(newBook);
      expect(el.bookTitle).toBe('New Sample Tome');

      // Trigger all registered observer callbacks
      for (const cb of [...observerCallbacks]) {
        mutationCycles++;
        cb([{ addedNodes: [], removedNodes: [], target: el }]);
      }

      // Title must remain New Sample Tome and not revert to Inline Initial
      expect(el.bookTitle).toBe('New Sample Tome');
      expect(mutationCycles).toBeLessThan(10);
    } finally {
      (globalThis as any).MutationObserver = origMO;
    }
  });

  it('reactively updates book content when inline script text genuinely changes', async () => {
    let scriptCb: Function | null = null;
    class MockMutationObserver {
      cb: Function;
      constructor(cb: Function) {
        this.cb = cb;
      }
      observe(target: any) {
        if (target.tagName === 'SCRIPT') {
          scriptCb = this.cb;
        }
      }
      disconnect() {}
    }
    const origMO = (globalThis as any).MutationObserver;
    (globalThis as any).MutationObserver = MockMutationObserver;

    try {
      const { el, children } = setupElement();
      const inlineScript = {
        tagName: 'SCRIPT',
        attributes: { type: 'text/plain' },
        getAttribute: (k: string) => (k === 'type' ? 'text/plain' : null),
        textContent: `
title: Reactive Version 1
author: Scribe
pages:
#- Content V1
        `,
      };
      children.push(inlineScript);

      await el.connectedCallback();
      expect(el.bookTitle).toBe('Reactive Version 1');

      // Genuinely mutate the text content of the inline script
      inlineScript.textContent = `
title: Reactive Version 2
author: Scribe
pages:
#- Content V2 Updated
      `;

      if (scriptCb) {
        (scriptCb as Function)([{ type: 'characterData', target: inlineScript }]);
      }

      expect(el.bookTitle).toBe('Reactive Version 2');
    } finally {
      (globalThis as any).MutationObserver = origMO;
    }
  });

  it('does not treat a legacy theme="high-contrast" attribute as high contrast', async () => {
    const { el } = setupElement();
    el.text = 'Theme Test Book';
    await el.connectedCallback();

    const viewer = el.getViewer();
    expect(viewer).toBeDefined();

    el.setAttribute('theme', 'high-contrast');
    expect(viewer?.isHighContrast()).toBe(false);
    expect(el.theme).toBe('transparent');
  });
});
