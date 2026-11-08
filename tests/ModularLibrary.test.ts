import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BookCanvas,
  MinecraftBookViewer,
  MinecraftBookElement,
  BookPlugin,
  splitTextToLines,
  parseBook,
  exportToStendhal,
  exportToGiveCommandModern,
  WitchcraftPlugin,
  defaultGlyphAtlas,
  ResourcePackManager,
} from '../src/index';

describe('Modular Library API & Components', () => {
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
        querySelector: vi.fn(() => null),
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
    expect(MinecraftBookViewer).toBeDefined();
    expect(MinecraftBookElement).toBeDefined();
    expect(splitTextToLines).toBeDefined();
    expect(parseBook).toBeDefined();
    expect(exportToStendhal).toBeDefined();
    expect(exportToGiveCommandModern).toBeDefined();
    expect(WitchcraftPlugin).toBeDefined();
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

  it('instantiates MinecraftBookViewer with options and loads arbitrary book', () => {
    const viewer = new MinecraftBookViewer(mockContainer, {
      theme: 'dark',
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

    const viewer = new MinecraftBookViewer(mockContainer);
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
});
