import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookCanvas } from '../src/render/BookCanvas';
import { BlockgameBook } from '../src/engine/types';
import { splitTextToLines, getTextWidthForEngine, BEDROCK_BOOK_TEXT_WIDTH, JAVA_BOOK_TEXT_WIDTH } from '../src/engine/StringSplitter';
import { defaultGlyphAtlas } from '../src/engine/GlyphAtlas';
import { BlockgameBookElement } from '../src/component/blockgame-book';

describe('Bedrock Edition Appearance & Decoupled Engine', () => {
  let mockContainer: any;
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      setLineDash: vi.fn(),
      clearRect: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(32 * 32 * 4) })),
      imageSmoothingEnabled: false,
    };

    const makeEl = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          toggle: vi.fn(),
          contains: vi.fn(() => false),
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
        setAttribute(k: string, v: string) {
          this.attributes[k] = v;
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
          return child;
        },
        removeChild(child: any) {
          const idx = this.children.indexOf(child);
          if (idx !== -1) this.children.splice(idx, 1);
          return child;
        },
        querySelector: vi.fn((sel: string) =>
          makeEl(sel.includes('btn') || sel.includes('button') ? 'button' : (sel.includes('textarea') ? 'textarea' : 'div'))
        ),
        querySelectorAll: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        closest: () => null,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 616, height: 384 }),
      };
      if (tag === 'canvas') {
        el.getContext = () => mockCtx;
        el.toDataURL = () => 'data:image/png;base64,fake';
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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getSelection: () => ({ removeAllRanges: vi.fn(), toString: () => '' }),
      innerWidth: 1024,
      innerHeight: 768,
    };

    mockContainer = makeEl('div');
  });

  const fourPageBook: BlockgameBook = {
    title: 'Test Bedrock Book',
    author: 'Alex',
    pages: [
      'Page 1 text content',
      'Page 2 text content',
      'Page 3 text content',
      'Page 4 text content',
    ],
  };

  it('sets base canvas dimensions to 308x192 in Bedrock appearance mode', () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      appearance: 'bedrock',
    });
    canvas.setBook(fourPageBook);

    const dim = canvas.getBaseDimensions();
    expect(dim.width).toBe(308);
    expect(dim.height).toBe(192);
    expect(canvas.getAppearance()).toBe('bedrock');
    expect(canvas.getEngine()).toBe('java'); // Default engine is decoupled java
  });

  it('switches between java (192/344) and bedrock (308) base dimensions via setAppearance', () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      appearance: 'java',
      defaultViewMode: 'single',
    });
    canvas.setBook(fourPageBook);

    expect(canvas.getBaseDimensions().width).toBe(192);
    expect(canvas.getBaseDimensions().height).toBe(192);

    canvas.setAppearance('bedrock');
    expect(canvas.getAppearance()).toBe('bedrock');
    expect(canvas.getBaseDimensions().width).toBe(308);
    expect(canvas.getBaseDimensions().height).toBe(192);

    canvas.setAppearance('java');
    expect(canvas.getAppearance()).toBe('java');
    expect(canvas.getBaseDimensions().width).toBe(192);
  });

  it('decouples Bedrock appearance from text engine (Java 114px vs Bedrock 122px)', () => {
    expect(getTextWidthForEngine('java')).toBe(114);
    expect(getTextWidthForEngine('bedrock')).toBe(122);
    expect(JAVA_BOOK_TEXT_WIDTH).toBe(114);
    expect(BEDROCK_BOOK_TEXT_WIDTH).toBe(122);

    // Construct a string that is >114px and <= 122px
    // In Minecraft font, standard char 'x' has 6px advance.
    // 19 characters * 6px = 114px.
    // 20 characters * 6px = 120px. (Exceeds 114px, fits in 122px).
    const text20Chars = 'x'.repeat(20);

    const javaSplit = splitTextToLines(text20Chars, getTextWidthForEngine('java'), defaultGlyphAtlas);
    const bedrockSplit = splitTextToLines(text20Chars, getTextWidthForEngine('bedrock'), defaultGlyphAtlas);

    expect(javaSplit.length).toBe(2); // Wrapped because it exceeds 114px
    expect(bedrockSplit.length).toBe(1); // Fits because 120px <= 122px

    // Now test through BookCanvas with setEngine
    const canvas = new BookCanvas({
      container: mockContainer,
      appearance: 'bedrock',
      engine: 'java',
    });
    canvas.setBook({
      title: 'Wrap Test',
      author: 'Alex',
      pages: [text20Chars],
    });

    expect(canvas.getPageLines(0).length).toBe(2);

    canvas.setEngine('bedrock');
    expect(canvas.getEngine()).toBe('bedrock');
    expect(canvas.getPageLines(0).length).toBe(1);

    canvas.setEngine('java');
    expect(canvas.getEngine()).toBe('java');
    expect(canvas.getPageLines(0).length).toBe(2);
  });

  it('navigates in 2-page spread increments when appearance is bedrock', () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      appearance: 'bedrock',
    });
    canvas.setBook(fourPageBook);

    expect(canvas.getCurrentPage()).toBe(0);

    const advanced = canvas.nextPage();
    expect(advanced).toBe(true);
    expect(canvas.getCurrentPage()).toBe(2); // Jumped 2 pages for two-page spread

    const advancedPastEnd = canvas.nextPage();
    expect(advancedPastEnd).toBe(false);
    expect(canvas.getCurrentPage()).toBe(2);

    const wentBack = canvas.prevPage();
    expect(wentBack).toBe(true);
    expect(canvas.getCurrentPage()).toBe(0);
  });

  it('correctly hit-tests Bedrock close button and navigation buttons', () => {
    const onCloseMock = vi.fn();

    const canvas = new BookCanvas({
      container: mockContainer,
      appearance: 'bedrock',
      onClose: onCloseMock,
    });
    canvas.setBook(fourPageBook);

    // Close button is at (285, 11, 9, 9)
    expect(canvas.hitTestButtons(285, 11)).toBe('close');
    expect(canvas.hitTestButtons(290, 15)).toBe('close');

    // Backward button is at (7, 159, 24, 24) - should be null on page 0
    expect(canvas.hitTestButtons(15, 170)).toBeNull();

    // Forward button is at (277, 159, 24, 24) - should be forward on page 0 of 4-page book
    expect(canvas.hitTestButtons(285, 170)).toBe('forward');

    // Advance to page 2
    canvas.setPage(2);
    // Backward button should now be active
    expect(canvas.hitTestButtons(15, 170)).toBe('backward');
    // Forward button should now be null since leftIdx=2 and leftIdx+2=4 >= 4 total pages
    expect(canvas.hitTestButtons(285, 170)).toBeNull();

    // Outside buttons
    expect(canvas.hitTestButtons(100, 100)).toBeNull();
  });

  it('toggles high-contrast mode and state correctly', () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      appearance: 'bedrock',
      highContrast: false,
    });
    canvas.setBook(fourPageBook);

    expect(canvas.isHighContrast()).toBe(false);

    canvas.setHighContrast(true);
    expect(canvas.isHighContrast()).toBe(true);

    canvas.setHighContrast(false);
    expect(canvas.isHighContrast()).toBe(false);
  });

  it('supports appearance, engine, and high-contrast in BlockgameBookElement Web Component', async () => {
    const el = new BlockgameBookElement();
    (el as any).classList = {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      contains: vi.fn(() => false),
    };
    (el as any).dispatchEvent = vi.fn();
    (el as any).children = [];
    (el as any).appendChild = vi.fn((child: any) => {
      (el as any).children.push(child);
      return child;
    });

    const scriptEl = {
      tagName: 'SCRIPT',
      textContent: `
title: Bedrock Web Component Book
author: Alex
pages:
#- Page 1
#- Page 2
#- Page 3
#- Page 4
      `,
    };

    (el as any).querySelector = vi.fn().mockImplementation((selector: string) => {
      if (selector.includes('script')) return scriptEl;
      return null;
    });

    const attributes: Record<string, string> = {
      appearance: 'bedrock',
      engine: 'bedrock',
      'high-contrast': '',
    };

    (el as any).getAttribute = vi.fn().mockImplementation((attr: string) => attributes[attr] || null);
    (el as any).hasAttribute = vi.fn().mockImplementation((attr: string) => attr in attributes);
    (el as any).setAttribute = vi.fn().mockImplementation((attr: string, val: string) => {
      attributes[attr] = val;
    });
    (el as any).removeAttribute = vi.fn().mockImplementation((attr: string) => {
      delete attributes[attr];
    });

    await el.connectedCallback();

    const viewer = el.getViewer();
    expect(viewer).toBeDefined();
    expect(viewer?.getAppearance()).toBe('bedrock');
    expect(viewer?.getEngine()).toBe('bedrock');
    expect(viewer?.isHighContrast()).toBe(true);

    // Test component property setters/getters
    el.appearance = 'java';
    expect(el.appearance).toBe('java');
    expect(viewer?.getAppearance()).toBe('java');

    el.engine = 'java';
    expect(el.engine).toBe('java');
    expect(viewer?.getEngine()).toBe('java');

    el.highContrast = false;
    expect(el.highContrast).toBe(false);
    expect(viewer?.isHighContrast()).toBe(false);

    // Test attributeChangedCallback
    await el.attributeChangedCallback('appearance', 'java', 'bedrock');
    expect(viewer?.getAppearance()).toBe('bedrock');

    await el.attributeChangedCallback('engine', 'java', 'bedrock');
    expect(viewer?.getEngine()).toBe('bedrock');

    await el.attributeChangedCallback('high-contrast', null, 'true');
    expect(viewer?.isHighContrast()).toBe(true);
  });
});
