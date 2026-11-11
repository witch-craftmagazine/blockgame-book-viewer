import { describe, it, expect, beforeEach } from 'vitest';
import { BookCanvas } from '../src/render/BookCanvas';
import { BlockgameBookViewer } from '../src/ui/BlockgameBookViewer';
import { BlockgameBookElement } from '../src/component/blockgame-book';
import { BlockgameBook } from '../src/engine/types';

describe('Continuous scroll view', () => {
  let mockContainer: any;
  let mockCtx: any;

  const testBook: BlockgameBook = {
    title: 'Continuous Scroll Odyssey',
    author: 'StarSweetpea',
    pages: [
      'Page 1: Introduction to continuous vertical scroll.',
      'Page 2: Second page content explaining trackpad scrolling.',
      'Page 3: Third page with article text for readers.',
      'Page 4: Fourth page exploring responsive double spread reflow.',
      'Page 5: Fifth page detailing viewport virtualization.',
      'Page 6: Sixth page concluding the chapter.',
    ],
  };

  beforeEach(() => {
    mockCtx = {
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      drawImage: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillRect: () => {},
      setLineDash: () => {},
      clearRect: () => {},
      rect: () => {},
      clip: () => {},
      fillText: () => {},
      measureText: () => ({ width: 10 }),
      getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
      imageSmoothingEnabled: false,
    };

    const makeEl = (tag: string) => {
      const listeners: Record<string, Function[]> = {};
      const el: any = {
        tagName: tag.toUpperCase(),
        className: '',
        dataset: {} as Record<string, string>,
        classList: {
          classes: new Set<string>(),
          add(c: string) { this.classes.add(c); el.className = Array.from(this.classes).join(' '); },
          remove(c: string) { this.classes.delete(c); el.className = Array.from(this.classes).join(' '); },
          toggle(c: string) { if (this.classes.has(c)) this.remove(c); else this.add(c); },
          contains(c: string) { return this.classes.has(c) || el.className.split(' ').includes(c); },
        },
        style: {},
        children: [] as any[],
        attributes: {} as Record<string, string>,
        _innerHTML: '',
        get innerHTML() {
          return this._innerHTML;
        },
        set innerHTML(val: string) {
          this._innerHTML = val;
          if (val === '') {
            this.children = [];
          }
        },
        textContent: '',
        value: '',
        setAttribute(k: string, v: string) {
          this.attributes[k] = v;
          if (k.startsWith('data-')) {
            const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
            this.dataset[camel] = v;
          }
        },
        getAttribute(k: string) {
          return this.attributes[k];
        },
        hasAttribute(k: string) {
          return k in this.attributes;
        },
        removeAttribute(k: string) {
          delete this.attributes[k];
        },
        appendChild(child: any) {
          this.children.push(child);
          child.parentElement = this;
          return child;
        },
        removeChild(child: any) {
          const idx = this.children.indexOf(child);
          if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentElement = null;
          }
          return child;
        },
        remove() {
          if (this.parentElement) {
            this.parentElement.removeChild(this);
          }
        },
        querySelector(sel: string): any {
          const all = this.querySelectorAll(sel);
          if (all.length > 0) return all[0];
          // For toolbar or modal buttons
          if (sel.includes('btn') || sel.includes('button') || sel.includes('indicator') || sel.includes('#')) {
            const fallback = makeEl(sel.includes('btn') || sel.includes('button') ? 'button' : 'div');
            if (sel.startsWith('#')) fallback.id = sel.slice(1);
            if (sel.startsWith('.')) fallback.className = sel.slice(1);
            return fallback;
          }
          return null;
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
            } else if (sel.startsWith('[') && sel.endsWith(']')) {
              const [attr, val] = sel.slice(1, -1).split('=');
              const cleanVal = val ? val.replace(/['"]/g, '') : null;
              if (cleanVal !== null) {
                if (node.getAttribute?.(attr) === cleanVal || node.dataset?.[attr.replace('data-', '')] === cleanVal) match = true;
              } else {
                if (node.hasAttribute?.(attr)) match = true;
              }
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
        addEventListener(event: string, fn: Function) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(fn);
        },
        removeEventListener(event: string, fn: Function) {
          if (!listeners[event]) return;
          const idx = listeners[event].indexOf(fn);
          if (idx !== -1) listeners[event].splice(idx, 1);
        },
        dispatchEvent(evt: any) {
          const handlers = listeners[evt.type] || [];
          for (const h of handlers) h(evt);
          return true;
        },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        scrollBy: () => {},
        scrollTo: () => {},
        scrollIntoView: () => {},
        clientWidth: 800,
        clientHeight: 600,
      };

      if (tag === 'canvas') {
        el.getContext = () => mockCtx;
        el.toDataURL = () => 'data:image/png;base64,mock';
      }
      return el;
    };

    class MockImage {
      private _src = '';
      onload: any = null;
      onerror: any = null;
      naturalWidth = 256;
      naturalHeight = 256;
      width = 256;
      height = 256;
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    (globalThis as any).Image = MockImage;

    (globalThis as any).document = {
      createElement: makeEl,
      body: makeEl('body'),
    };
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      getSelection: () => ({ removeAllRanges: () => {}, toString: () => '' }),
      innerWidth: 1024,
      innerHeight: 768,
    };

    mockContainer = makeEl('div');
  });

  it('initializes in scroll-single mode and creates page wrapper elements', async () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'scroll-single',
    });
    await canvas.init();
    canvas.setBook(testBook);

    expect(canvas.getViewMode()).toBe('scroll-single');
    expect(canvas.isScrollMode()).toBe(true);

    const scrollContainer = canvas.getContinuousScrollView()?.getViewportElement();
    expect(scrollContainer).toBeDefined();
    expect(scrollContainer?.style.display).toBe('flex');

    const pages = scrollContainer?.querySelectorAll('.mc-book-scroll-page');
    expect(pages?.length).toBe(6);

    const firstPage = pages?.[0] as any;
    expect(firstPage.dataset.index).toBe('0');
    expect(firstPage.getAttribute('aria-label')).toBe('Page 1 of 6');
  });

  it('initializes in scroll-double mode and creates spread wrapper elements', async () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'scroll-double',
    });
    await canvas.init();
    canvas.setBook(testBook);

    expect(canvas.getViewMode()).toBe('scroll-double');
    expect(canvas.isScrollMode()).toBe(true);

    const scrollContainer = canvas.getContinuousScrollView()?.getViewportElement();
    const spreads = scrollContainer?.querySelectorAll('.mc-book-scroll-spread');
    expect(spreads?.length).toBe(3);

    const firstSpread = spreads?.[0] as any;
    expect(firstSpread.dataset.pageStart).toBe('0');
    expect(firstSpread.getAttribute('aria-label')).toContain('Spread: Pages 1 and 2 of 6');
  });

  it('switches dynamically between discrete flip and continuous scroll modes', async () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'double',
    });
    await canvas.init();
    canvas.setBook(testBook);

    expect(canvas.getViewMode()).toBe('double');
    expect(canvas.isScrollMode()).toBe(false);

    // Switch to scroll-single
    canvas.setViewMode('scroll-single');
    expect(canvas.getViewMode()).toBe('scroll-single');
    expect(canvas.isScrollMode()).toBe(true);

    const scrollContainer = canvas.getContinuousScrollView()?.getViewportElement();
    expect(scrollContainer?.style.display).toBe('flex');

    // Switch back to discrete double
    canvas.setViewMode('double');
    expect(canvas.getViewMode()).toBe('double');
    expect(canvas.isScrollMode()).toBe(false);
    expect(scrollContainer?.style.display).toBe('none');
  });

  it('virtualizes DOM pages by mounting and unmounting canvases', async () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'scroll-single',
    });
    await canvas.init();
    canvas.setBook(testBook);

    const scrollView = canvas.getContinuousScrollView()!;
    expect(scrollView).toBeDefined();

    // Verify mounting item 0
    scrollView.mountCanvasForItem(0);
    const page0 = scrollView.getViewportElement().querySelector('[data-index="0"]') as any;
    expect(page0.querySelector('canvas')).not.toBeNull();

    // Verify unmounting item 0
    scrollView.unmountCanvasForItem(0);
    expect(page0.querySelector('canvas')).toBeNull();
  });

  it('updates the dynamic floating page badge during navigation and scroll', async () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'scroll-single',
    });
    await canvas.init();
    canvas.setBook(testBook);

    const scrollView = canvas.getContinuousScrollView()!;
    const badge = scrollView.getFloatingBadgeElement();
    expect(badge.textContent).toBe('Page 1 of 6');

    // Programmatic scroll to page 4
    canvas.scrollToPage(4, { behavior: 'auto' });
    expect(badge.textContent).toBe('Page 4 of 6');
    expect(canvas.getCurrentPage()).toBe(3);
  });

  it('supports keyboard navigation in the continuous scroll container', async () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'scroll-single',
    });
    await canvas.init();
    canvas.setBook(testBook);

    const viewport = canvas.getContinuousScrollView()!.getViewportElement();
    let scrolledBy = 0;
    viewport.scrollBy = ((opts: any) => {
      scrolledBy += opts.top;
    }) as any;

    viewport.dispatchEvent({ type: 'keydown', key: 'ArrowDown', preventDefault: () => {} } as any);
    expect(scrolledBy).toBe(140);

    viewport.dispatchEvent({ type: 'keydown', key: 'ArrowUp', preventDefault: () => {} } as any);
    expect(scrolledBy).toBe(0);
  });

  it('integrates continuous scroll into BlockgameBookViewer toolbar and page indicator', async () => {
    const viewer = new BlockgameBookViewer(mockContainer, {
      book: testBook,
      defaultViewMode: 'scroll-single',
    });
    await viewer.init();

    expect(viewer.getViewMode()).toBe('scroll-single');

    // Programmatic scroll
    viewer.scrollToPage(3);
    expect(viewer.getCurrentPage()).toBe(2);

    // View mode cycling via setViewMode
    viewer.setViewMode('scroll-double');
    expect(viewer.getViewMode()).toBe('scroll-double');
  });

  it('supports view-mode attribute and scrollToPage on <blockgame-book> custom element', async () => {
    const el = new BlockgameBookElement();
    const attrs: Record<string, string> = {};
    (el as any).setAttribute = (k: string, v: string) => { attrs[k] = v; };
    (el as any).getAttribute = (k: string) => attrs[k] ?? null;
    (el as any).hasAttribute = (k: string) => k in attrs;
    (el as any).removeAttribute = (k: string) => { delete attrs[k]; };
    (el as any).querySelector = () => null;
    (el as any).classList = { add: () => {}, remove: () => {} };
    (el as any).appendChild = (child: any) => child;
    (el as any).dispatchEvent = () => true;

    el.setAttribute('view-mode', 'scroll-single');
    el.setAttribute('text', 'Line 1 of continuous component.\n\nLine 2 of continuous component.');

    await el.connectedCallback();

    expect(el.viewMode).toBe('scroll-single');
    expect(el.getViewMode()).toBe('scroll-single');

    el.viewMode = 'scroll-double';
    expect(el.getAttribute('view-mode')).toBe('scroll-double');
    expect(el.getViewMode()).toBe('scroll-double');
  });
});
