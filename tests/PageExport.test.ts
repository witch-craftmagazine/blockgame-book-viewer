import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// `navigator` is getter-only on newer Node, so plain assignment throws. Redefine it
// instead. This avoids vi.stubGlobal, which Bun's test runner (used in CI) lacks.
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
function stubNavigator(value: unknown): void {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
}
function restoreNavigator(): void {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete (globalThis as any).navigator;
}
import { BookCanvas } from '../src/render/BookCanvas';
import { MinecraftBookViewer } from '../src/ui/BlockgameBookViewer';
import { MinecraftBookElement } from '../src/component/blockgame-book';

describe('Page Export & Mobile Share API', () => {
  let mockContainer: any;
  let mockCtx: any;

  afterEach(() => {
    restoreNavigator();
  });

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
          return this._innerHTML + this.children.map((c: any) => c.innerHTML || '').join('');
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
        querySelector: vi.fn((sel: string) => {
          if (sel.includes('.mc-btn-export-page')) {
            const btn = makeEl('button');
            btn.className = 'mc-btn mc-btn-export-page';
            return btn;
          }
          return makeEl(sel.includes('btn') || sel.includes('button') ? 'button' : (sel.includes('textarea') ? 'textarea' : 'div'));
        }),
        querySelectorAll: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 344, height: 180 }),
        dispatchEvent: vi.fn((_evt: any) => true),
        click: vi.fn(),
        remove: vi.fn(),
      };
      if (tag === 'canvas') {
        el.getContext = () => mockCtx;
        el.toDataURL = vi.fn(() => 'data:image/png;base64,dGVzdA==');
      }
      return el;
    };

    (globalThis as any).document = {
      createElement: makeEl,
      body: makeEl('body'),
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
    (globalThis as any).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getSelection: () => ({ toString: () => '', removeAllRanges: vi.fn() }),
      innerWidth: 1024,
    };

    mockContainer = makeEl('div');
  });

  it('generates a valid data URL and blob for the current page', async () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      baseAssetPath: './assets',
    });

    canvas.setBook({
      title: 'Export Test Book',
      author: 'Tester',
      pages: ['Page 1 content', 'Page 2 content'],
    });

    const dataUrl = canvas.getPageDataUrl();
    expect(dataUrl).toContain('data:image/png;base64,');

    const blob = await canvas.getPageBlob();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });

  it('renders isolated single page off-screen when requested in double-page mode', async () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      baseAssetPath: './assets',
      defaultViewMode: 'double',
    });

    canvas.setBook({
      title: 'Spread Book',
      author: 'Author',
      pages: ['Left page text', 'Right page text'],
    });

    const page1Url = canvas.getPageDataUrl(1);
    expect(page1Url).toContain('data:image/png;base64,');
  });

  it('triggers navigator.share with page image file when supported on mobile', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);

    stubNavigator({
      share: shareMock,
      canShare: canShareMock,
    });

    const viewer = new MinecraftBookViewer(mockContainer, {
      book: {
        title: 'Mobile Book',
        author: 'Player',
        pages: ['Chapter 1'],
      },
      controls: false,
    });

    await viewer.exportCurrentPage();

    expect(canShareMock).toHaveBeenCalled();
    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Mobile Book',
        text: 'Page 1 of Mobile Book',
        files: expect.any(Array),
      })
    );
  });

  it('falls back to file download when navigator.share is unavailable', async () => {
    stubNavigator({});

    const viewer = new MinecraftBookViewer(mockContainer, {
      book: {
        title: 'Download Book',
        author: 'Player',
        pages: ['Single page download'],
      },
      controls: false,
    });

    const bodyAppendSpy = vi.spyOn((globalThis as any).document.body, 'appendChild');

    await viewer.exportCurrentPage();

    expect(bodyAppendSpy).toHaveBeenCalled();
    const appendedEl = bodyAppendSpy.mock.calls[0][0] as any;
    expect(appendedEl.tagName).toBe('A');
    expect(appendedEl.download).toBe('download_book-page-1.png');
    expect(appendedEl.click).toHaveBeenCalled();
  });

  it('renders .mc-btn-export-page in toolbar when exportPageButton control option is true', () => {
    new MinecraftBookViewer(mockContainer, {
      book: { title: 'Toolbar Book', author: 'Author', pages: ['Page 1'] },
      controls: { exportPageButton: true },
    });

    expect(mockContainer.innerHTML).toContain('mc-btn-export-page');
  });

  it('supports exportCurrentPage and dispatches pageexport event on MinecraftBookElement', async () => {
    stubNavigator({});

    const element = new MinecraftBookElement();
    (element as any).classList = {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      contains: vi.fn(() => false),
    };
    (element as any).children = [];
    (element as any).appendChild = vi.fn((child: any) => {
      (element as any).children.push(child);
      return child;
    });
    (element as any).getAttribute = vi.fn((attr: string) => (attr === 'controls' ? 'false' : null));
    (element as any).hasAttribute = vi.fn(() => false);
    (element as any).querySelector = vi.fn(() => null);
    (element as any).dispatchEvent = vi.fn();

    await element.connectedCallback();

    element.setBook({
      title: 'Element Book',
      author: 'Web Component',
      pages: ['Element page 1'],
    });

    await element.exportCurrentPage();

    expect((element as any).dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pageexport',
      })
    );
  });
});
