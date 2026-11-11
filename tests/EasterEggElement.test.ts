import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlockgameBookElement } from '../src/component/blockgame-book';
import { BlockgameBookViewer } from '../src/ui/BlockgameBookViewer';

describe('Easter eggs through the viewer option and the <blockgame-book> element', () => {
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
      fill: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
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
          if (val === '') this.children = [];
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
          if (idx !== -1) this.children.splice(idx, 1);
          return child;
        },
        querySelector: vi.fn(() => makeEl('div')),
        querySelectorAll: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        closest: () => null,
        remove() {},
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
    (globalThis as any).document = { createElement: makeEl, body: makeEl('body') };
    (globalThis as any).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getSelection: () => ({ removeAllRanges: vi.fn(), toString: () => '' }),
      innerWidth: 1024,
      innerHeight: 768,
    };

    mockContainer = makeEl('div');
  });


  const eyeJson = JSON.stringify([{ char: '⏼', frames: ['◡'], frameMs: 160 }]);

  describe('BlockgameBookViewer options', () => {
    it('passes blankPageImage and animatedChars to the canvas and exposes runtime setters', () => {
      const viewer = new BlockgameBookViewer(mockContainer, {
        book: { title: 'T', author: 'A', pages: ['a ⏼ b', ' '] },
        blankPageImage: '/x.gif',
        animatedChars: [{ char: '⏼', frames: ['◡'] }],
      });
      const canvas = viewer.getCanvas();
      expect(canvas.getBlankPageImage()?.src).toBe('/x.gif');
      expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(true);

      viewer.setAnimatedChars([]);
      expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(false);
      viewer.setBlankPageImage(null);
      expect(canvas.getBlankPageImage()).toBeNull();
    });

    it('is off by default, even for a Witchcraft Magazine book', () => {
      const viewer = new BlockgameBookViewer(mockContainer, {
        book: { title: 'Witchcraft Magazine', author: 'StarSweetpea', pages: ['⏼', ' '] },
      });
      expect(viewer.getCanvas().getBlankPageImage()).toBeNull();
      expect(viewer.getCanvas().hasAnimatedCharOnCurrentPage()).toBe(false);
    });
  });

  describe('<blockgame-book> attributes and properties', () => {
    const makeElement = (initial: Record<string, string>, pageText = 'Page 1 ⏼') => {
      const el = new BlockgameBookElement();
      (el as any).classList = { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) };
      (el as any).dispatchEvent = vi.fn();
      (el as any).children = [];
      (el as any).appendChild = vi.fn((child: any) => {
        (el as any).children.push(child);
        return child;
      });
      const scriptEl = {
        tagName: 'SCRIPT',
        textContent: `\ntitle: Element Book\nauthor: Alex\npages:\n#- ${pageText}\n#- Page 2\n`,
      };
      (el as any).querySelector = vi.fn((selector: string) => (selector.includes('script') ? scriptEl : null));
      const attributes: Record<string, string> = { ...initial };
      (el as any).getAttribute = vi.fn((attr: string) => (attr in attributes ? attributes[attr] : null));
      (el as any).hasAttribute = vi.fn((attr: string) => attr in attributes);
      (el as any).setAttribute = vi.fn((attr: string, val: string) => {
        attributes[attr] = val;
      });
      (el as any).removeAttribute = vi.fn((attr: string) => {
        delete attributes[attr];
      });
      return { el, attributes };
    };

    it('does nothing when neither attribute is present', async () => {
      const { el } = makeElement({});
      await el.connectedCallback();
      const canvas = el.getViewer()!.getCanvas();
      expect(canvas.getBlankPageImage()).toBeNull();
      expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(false);
    });

    it('reads blank-page-image and animated-chars (JSON) at connect time', async () => {
      const { el } = makeElement({ 'blank-page-image': '/author.gif', 'animated-chars': eyeJson });
      await el.connectedCallback();
      const canvas = el.getViewer()!.getCanvas();
      expect(canvas.getBlankPageImage()?.src).toBe('/author.gif');
      expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(true);
      expect(el.blankPageImage).toBe('/author.gif');
      expect(el.animatedChars).toHaveLength(1);
    });

    it('ignores invalid animated-chars JSON with a warning instead of throwing', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { el } = makeElement({ 'animated-chars': '{not json' });
      await el.connectedCallback();
      expect(el.getViewer()!.getCanvas().hasAnimatedCharOnCurrentPage()).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('updates at runtime through attributeChangedCallback, and clears when the attribute is removed', async () => {
      const { el } = makeElement({});
      await el.connectedCallback();
      const canvas = el.getViewer()!.getCanvas();

      await el.attributeChangedCallback('blank-page-image', null, '/a.gif');
      expect(canvas.getBlankPageImage()?.src).toBe('/a.gif');
      await el.attributeChangedCallback('blank-page-image', '/a.gif', '/b.gif');
      expect(canvas.getBlankPageImage()?.src).toBe('/b.gif');
      await el.attributeChangedCallback('blank-page-image', '/b.gif', null);
      expect(canvas.getBlankPageImage()).toBeNull();

      await el.attributeChangedCallback('animated-chars', null, eyeJson);
      expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(true);
      await el.attributeChangedCallback('animated-chars', eyeJson, null);
      expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(false);
    });

    it('accepts an options object through the property, before and after connection', async () => {
      const { el } = makeElement({ 'blank-page-image': '/attr.gif' });
      el.blankPageImage = { src: '/prop.png', width: 40, height: 50 };
      await el.connectedCallback();
      const canvas = el.getViewer()!.getCanvas();
      // A property set before connection wins over the attribute.
      expect(canvas.getBlankPageImage()).toMatchObject({ src: '/prop.png', width: 40, height: 50 });

      el.blankPageImage = null;
      expect(canvas.getBlankPageImage()).toBeNull();
      el.animatedChars = [{ char: '⏼', frames: ['◡'] }];
      expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(true);
    });

    it('lists both attributes in observedAttributes', () => {
      expect(BlockgameBookElement.observedAttributes).toContain('blank-page-image');
      expect(BlockgameBookElement.observedAttributes).toContain('animated-chars');
    });
  });
});
