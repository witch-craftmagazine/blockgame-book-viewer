import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BookCanvas,
  BlockgameBookViewer,
  BlockgameBookElement,
  BookPlugin,
  splitTextToLines,
  parseBook,
  exportToStendhal,
  exportToGiveCommandModern,
  AnimatedCharController,
  defaultGlyphAtlas,
  ResourcePackManager,
  BookEditorModal,
} from '../src/index';

describe('Public API', () => {
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
          toggle: vi.fn(),
          contains: vi.fn(() => false),
          add: vi.fn(),
          remove: vi.fn(),
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
        },
        getAttribute(k: string) {
          return this.attributes[k];
        },
        hasAttribute(k: string) {
          return k in this.attributes;
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
        querySelector: vi.fn((sel: string) => makeEl(sel.includes('btn') || sel.includes('button') ? 'button' : (sel.includes('textarea') ? 'textarea' : 'div'))),
        querySelectorAll: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 344, height: 180 }),
      };
      if (tag === 'canvas') {
        el.getContext = () => mockCtx;
      }
      return el;
    };

    (globalThis as any).document = {
      createElement: makeEl,
      body: makeEl('body'),
    };
    (globalThis as any).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getSelection: () => ({ toString: () => '', removeAllRanges: vi.fn() }),
      innerWidth: 1024,
    };

    mockContainer = makeEl('div');
  });

  it('exports all expected core utilities and classes', () => {
    expect(BookCanvas).toBeDefined();
    expect(BlockgameBookViewer).toBeDefined();
    expect(BlockgameBookElement).toBeDefined();
    expect(splitTextToLines).toBeDefined();
    expect(parseBook).toBeDefined();
    expect(exportToStendhal).toBeDefined();
    expect(exportToGiveCommandModern).toBeDefined();
    expect(AnimatedCharController).toBeDefined();
    expect(defaultGlyphAtlas).toBeDefined();
    expect(ResourcePackManager).toBeDefined();
  });

  it('allows registering and triggering custom plugins on BookCanvas', () => {
    const onBookChangeMock = vi.fn();
    const onPageChangeMock = vi.fn();
    const onBeforeRenderPageMock = vi.fn();
    const onAfterRenderPageMock = vi.fn();
    const onRenderCharMock = vi.fn();
    const onClickMock = vi.fn();

    const customPlugin: BookPlugin = {
      name: 'test-custom-plugin',
      onBookChange: onBookChangeMock,
      onPageChange: onPageChangeMock,
      onBeforeRenderPage: onBeforeRenderPageMock,
      onAfterRenderPage: onAfterRenderPageMock,
      onRenderChar: onRenderCharMock,
      onClick: onClickMock,
    };

    const canvas = new BookCanvas({
      container: mockContainer,
      plugins: [customPlugin],
    });

    expect(canvas.getPlugin('test-custom-plugin')).toBe(customPlugin);

    canvas.setBook({
      title: 'Plugin Test Book',
      author: 'Test Author',
      pages: ['Page 1 text', 'Page 2 text'],
    });

    expect(onBookChangeMock).toHaveBeenCalled();

    // Turn page
    canvas.nextPage();
    expect(onPageChangeMock).toHaveBeenCalled();

    // Remove plugin
    canvas.removePlugin('test-custom-plugin');
    expect(canvas.getPlugin('test-custom-plugin')).toBeUndefined();
  });

  it('instantiates BlockgameBookViewer with options and loads arbitrary book', () => {
    const viewer = new BlockgameBookViewer(mockContainer, {
      defaultViewMode: 'double',
      book: {
        title: 'Custom Tome',
        author: 'Wizard',
        pages: ['Chapter 1: The Beginning\n\nOnce upon a time in Minecraftia...'],
      },
    });

    expect(viewer.getBook().title).toBe('Custom Tome');
    expect(viewer.getCanvas()).toBeDefined();
    expect(viewer.getTotalPages()).toBe(1);
    expect(viewer.getCurrentPage()).toBe(0);

    // Test page navigation
    expect(viewer.nextPage()).toBe(false); // only 1 page
    expect(viewer.prevPage()).toBe(false);
  });

  it('can parse various formats and load into viewer', () => {
    const stendhalContent = `title: My Notes\nauthor: Steve\npages:\n#- §eHello World!\nSecond line of page 1\n#- Page 2 contents`;
    const book = parseBook(stendhalContent);
    expect(book).not.toBeNull();
    expect(book?.title).toBe('My Notes');
    expect(book?.author).toBe('Steve');
    expect(book?.pages.length).toBe(2);

    const viewer = new BlockgameBookViewer(mockContainer);
    viewer.setBook(book!);
    expect(viewer.getBook().title).toBe('My Notes');
    expect(viewer.getTotalPages()).toBe(2);
  });

  it('supports exportToGiveCommandModern from a parsed book', () => {
    const book = {
      title: 'Guide Book',
      author: 'Librarian',
      pages: ['§1First page text'],
    };
    const cmd = exportToGiveCommandModern(book);
    expect(cmd).toContain('/give @p written_book');
    expect(cmd).toContain('Guide Book');
  });

  it('auto-fits scale to container dimensions in double-page mode without cutting off', () => {
    mockContainer.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 480,
    });

    const canvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'double',
    });

    canvas.fitToContainer();
    // In 800x480 container with toolbar:
    // TWO_PAGE_WIDTH = 344, Height = 192.
    // scale 3 is 1032x576 (overflows 800x480)
    // scale 2 is 688x384 (fits comfortably within 800x480)
    expect(canvas.getScale()).toBe(2);
    expect(344 * canvas.getScale()).toBeLessThanOrEqual(800);
    expect(192 * canvas.getScale()).toBeLessThanOrEqual(480);
  });

  it('loads vanilla Minecraft textures by default instead of Lithos', async () => {
    const loadedPaths: string[] = [];
    const canvas = new BookCanvas({
      container: mockContainer,
      baseAssetPath: './assets',
    });

    (canvas as any).loadImage = vi.fn().mockImplementation((src: string) => {
      loadedPaths.push(src);
      return Promise.resolve({
        naturalWidth: 256,
        naturalHeight: 256,
      });
    });

    (canvas as any).atlas.load = vi.fn().mockResolvedValue(undefined);

    await canvas.init();

    // Verify vanilla textures were requested
    expect(loadedPaths).toContain('./assets/textures/gui/book.png');
    expect(loadedPaths).toContain('./assets/textures/gui/page_forward.png');
    expect(loadedPaths).toContain('./assets/textures/gui/page_backward.png');

    // Verify Lithos textures were NOT loaded by default
    const hasLithos = loadedPaths.some((p) => p.includes('packs/lithos'));
    expect(hasLithos).toBe(false);
  });

  it('allows zoom-in button to zoom within page bounds and prevents scaling beyond max fitting scale', () => {
    const viewer = new BlockgameBookViewer(mockContainer, {
      defaultViewMode: 'double',
      controls: true,
    });

    const canvasWrapper = (viewer as any).canvasWrapper;
    // Simulate generous viewport allowing zoom up to scale 5
    canvasWrapper.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1920,
      height: 1200,
    });

    const canvas = viewer.getCanvas();
    canvas.setScale(2);
    expect(canvas.getScale()).toBe(2);

    // Find zoom-in button in toolbar
    const toolbar = (viewer as any).toolbarElement;
    expect(toolbar).toBeDefined();

    const zoomInBtn = toolbar.children
      .flatMap((c: any) => c.children || [])
      .find((el: any) => el.className?.includes('mc-btn-zoom-in'));

    if (zoomInBtn) {
      const clickHandler = zoomInBtn.addEventListener.mock.calls.find((call: any) => call[0] === 'click')?.[1];
      if (clickHandler) {
        clickHandler();
        // Zoom-in should increment scale to 3
        expect(canvas.getScale()).toBe(3);
      }
    }

    const zoomOutBtn = toolbar.children
      .flatMap((c: any) => c.children || [])
      .find((el: any) => el.className?.includes('mc-btn-zoom-out'));

    if (zoomOutBtn) {
      const clickHandler = zoomOutBtn.addEventListener.mock.calls.find((call: any) => call[0] === 'click')?.[1];
      if (clickHandler) {
        clickHandler();
        expect(canvas.getScale()).toBe(2);
      }
    }

    // Now constrain viewport to max fitting scale 2
    canvasWrapper.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 720,
      height: 460,
    });
    // Attempting to zoom in beyond container fitting scale should be prevented
    if (zoomInBtn) {
      const clickHandler = zoomInBtn.addEventListener.mock.calls.find((call: any) => call[0] === 'click')?.[1];
      if (clickHandler) {
        clickHandler();
        expect(canvas.getScale()).toBeLessThanOrEqual(2);
      }
    }
  });

  it('initializes BlockgameBookElement with inline script custom book', async () => {
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
title: Custom Web Component Book
author: Author A
pages:
#- Page 1 Inline
#- Page 2 Inline
      `,
    };

    (el as any).querySelector = vi.fn().mockImplementation((selector: string) => {
      if (selector.includes('script')) return scriptEl;
      return null;
    });

    (el as any).getAttribute = vi.fn().mockImplementation((attr: string) => {
      if (attr === 'view-mode') return 'double';
      if (attr === 'base-path') return './assets';
      if (attr === 'controls') return 'false';
      return null;
    });
    (el as any).hasAttribute = vi.fn().mockImplementation((attr: string) => {
      return attr === 'view-mode';
    });

    await el.connectedCallback();

    const v = el.getViewer();
    expect(v).toBeDefined();
    expect(v?.getBook()?.title).toBe('Custom Web Component Book');
    expect(v?.getBook()?.pages.length).toBe(2);
  });

  it('provides BookEditorModal for editing book markup', () => {
    let appliedBook: any = null;
    const modal = new BookEditorModal((book) => {
      appliedBook = book;
    });

    const initialBook = {
      title: 'Original Title',
      author: 'Author One',
      pages: ['First Page Content'],
    };

    modal.open(initialBook);

    const textarea = modal.getTextarea();
    expect(textarea).toBeDefined();
    expect(textarea.value).toContain('Original Title');

    // Simulate editing markup
    textarea.value = `title: Edited Tome
author: Editor Two
pages:
#- §4§lEdited First Page§r
#- §2Second Page Content§r
`;

    modal.apply();

    expect(appliedBook).toBeDefined();
    expect(appliedBook.title).toBe('Edited Tome');
    expect(appliedBook.author).toBe('Editor Two');
    expect(appliedBook.pages.length).toBe(2);
    expect(appliedBook.pages[0]).toContain('§4§lEdited First Page§r');
  });

  it('supports raw text attribute and setText API with LosslessSplit pagination on BlockgameBookElement', async () => {
    const el = new BlockgameBookElement();
    const attrs: Record<string, string> = {};
    (el as any).setAttribute = vi.fn((k: string, v: string) => { attrs[k] = v; });
    (el as any).getAttribute = vi.fn((k: string) => attrs[k] ?? null);
    (el as any).hasAttribute = vi.fn((k: string) => k in attrs);
    (el as any).removeAttribute = vi.fn((k: string) => { delete attrs[k]; });
    (el as any).querySelector = vi.fn(() => null);
    (el as any).classList = { add: vi.fn(), remove: vi.fn() };
    (el as any).appendChild = vi.fn();

    const longStory = [
      'Line 1 of long continuous story.',
      'Line 2 continues here with more lore.',
      'Line 3 goes deeper into the ancient ruins.',
      'Line 4 reveals forgotten artifacts.',
      'Line 5 mentions an old parchment.',
      'Line 6 describes glowing runes.',
      'Line 7 talks of ancient enchanters.',
      'Line 8 notes a mystical altar.',
      'Line 9 warns of hidden perils.',
      'Line 10 uncovers an old riddle.',
      'Line 11 speaks of dragon breath.',
      'Line 12 guides the reader forward.',
      'Line 13 reaches the midpoint.',
      'Line 14 touches the final line of page 1.',
      'Line 15 naturally starts page 2 without word breakage.',
      'Line 16 continues page 2.',
    ].join('\n\n');

    el.setAttribute('text', longStory);
    el.setAttribute('book-title', 'Ancient Lore');
    el.setAttribute('author', 'Scholar');
    await el.connectedCallback();

    const viewer = el.getViewer();
    expect(viewer).toBeDefined();
    expect(viewer?.getTotalPages()).toBeGreaterThan(1);

    // Test setText()
    el.setText('Short replacement story.', 'New Title', 'New Author');
    expect(viewer?.getTotalPages()).toBe(1);
  });

  it('honors persist-progress attribute to enable PageMemoryManager', async () => {
    const el = new BlockgameBookElement();
    const attrs: Record<string, string> = {};
    (el as any).setAttribute = vi.fn((k: string, v: string) => { attrs[k] = v; });
    (el as any).getAttribute = vi.fn((k: string) => attrs[k] ?? null);
    (el as any).hasAttribute = vi.fn((k: string) => k in attrs);
    (el as any).removeAttribute = vi.fn((k: string) => { delete attrs[k]; });
    (el as any).querySelector = vi.fn(() => null);
    (el as any).classList = { add: vi.fn(), remove: vi.fn() };
    (el as any).appendChild = vi.fn();

    expect(el.persistProgress).toBe(false);

    el.setAttribute('persist-progress', '');
    expect(el.hasAttribute('persist-progress')).toBe(true);

    await el.connectedCallback();
    expect(el.persistProgress).toBe(true);

    el.persistProgress = false;
    expect(el.persistProgress).toBe(false);
  });
});
