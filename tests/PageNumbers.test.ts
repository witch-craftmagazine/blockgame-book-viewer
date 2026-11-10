import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookCanvas } from '../src/render/BookCanvas';
import { BlockgameBookViewer } from '../src/ui/BlockgameBookViewer';
import { BlockgameBookElement } from '../src/component/blockgame-book';
import { BlockgameBook } from '../src/engine/types';

const RIGHT_PAGE_X = 152; // x of the right page in a Java spread; indicator edge is RIGHT_PAGE_X + 148 (see BookCanvas)

describe('On-book page numbers (Java "Page X of Y", Bedrock "N of M")', () => {
  let mockContainer: any;
  let mockCtx: any;

  const fourPageBook: BlockgameBook = {
    title: 'Numbered',
    author: 'Alex',
    pages: ['one', 'two', 'three', 'four'],
  };

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

  /** Java indicator draws: [text, rightEdgeX, y] for every right-aligned line drawn while `fn` runs. */
  const recordJava = (canvas: BookCanvas, fn: () => void): Array<[string, number, number]> => {
    const draws: Array<[string, number, number]> = [];
    const original = (canvas as any).renderTextLineRightAligned;
    (canvas as any).renderTextLineRightAligned = function (text: string, x: number, y: number, ...rest: any[]) {
      draws.push([text, x, y]);
      return original.call(this, text, x, y, ...rest);
    };
    try {
      fn();
    } finally {
      (canvas as any).renderTextLineRightAligned = original;
    }
    return draws;
  };

  /** Bedrock indicator draws: the "N of M" strings passed to renderSpans while `fn` runs. */
  const recordBedrock = (canvas: BookCanvas, fn: () => void): string[] => {
    const texts: string[] = [];
    const original = (canvas as any).renderSpans;
    (canvas as any).renderSpans = function (spans: Array<{ text: string }>, ...rest: any[]) {
      const text = spans.map((s) => s.text).join('');
      if (/^\d+ of \d+$/.test(text)) texts.push(text);
      return original.call(this, spans, ...rest);
    };
    try {
      fn();
    } finally {
      (canvas as any).renderSpans = original;
    }
    return texts;
  };

  const makeCanvas = async (opts: Record<string, any> = {}, book: BlockgameBook = fourPageBook) => {
    const canvas = new BookCanvas({ container: mockContainer, ...opts });
    await canvas.init();
    canvas.setBook(book);
    return canvas;
  };

  describe('Java appearance', () => {
    it('is on by default in single view at the vanilla position', async () => {
      const canvas = await makeCanvas({ defaultViewMode: 'single' });
      const draws = recordJava(canvas, () => canvas.render());
      expect(draws).toEqual([['Page 1 of 4', 148, 16]]);
    });

    it('draws one number per page in a double spread', async () => {
      const canvas = await makeCanvas({ defaultViewMode: 'double' });
      const draws = recordJava(canvas, () => canvas.render());
      expect(draws).toEqual([
        ['Page 1 of 4', 150, 16],
        ['Page 2 of 4', RIGHT_PAGE_X + 148, 16],
      ]);
    });

    it('draws nothing when showPageIndicator is false', async () => {
      const canvas = await makeCanvas({ defaultViewMode: 'double', showPageIndicator: false });
      expect(canvas.getShowPageIndicator()).toBe(false);
      expect(recordJava(canvas, () => canvas.render())).toEqual([]);
    });

    it('toggles at runtime', async () => {
      const canvas = await makeCanvas({ defaultViewMode: 'single' });
      expect(canvas.getShowPageIndicator()).toBe(true);

      canvas.setShowPageIndicator(false);
      expect(recordJava(canvas, () => canvas.render())).toEqual([]);

      canvas.setShowPageIndicator(true);
      expect(recordJava(canvas, () => canvas.render())).toHaveLength(1);
    });

    it('re-renders when toggled in single view', async () => {
      const canvas = await makeCanvas({ defaultViewMode: 'single' });
      const spy = vi.spyOn(canvas, 'render');
      canvas.setShowPageIndicator(false);
      expect(spy).toHaveBeenCalledTimes(1);
      canvas.setShowPageIndicator(false); // unchanged, no extra render
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('is included in single-page export and honors the flag', async () => {
      const canvas = await makeCanvas({ defaultViewMode: 'double' });
      const on = recordJava(canvas, () => canvas.getPageDataUrl(2));
      expect(on).toEqual([['Page 3 of 4', 148, 16]]);

      canvas.setShowPageIndicator(false);
      expect(recordJava(canvas, () => canvas.getPageDataUrl(2))).toEqual([]);
    });

    it('draws on a blank page and on the last page', async () => {
      const canvas = await makeCanvas(
        { defaultViewMode: 'single' },
        { title: 'Blank', author: 'Alex', pages: ['first', '', 'last'] }
      );
      const target = (globalThis as any).document.createElement('canvas');
      const blank = recordJava(canvas, () => canvas.renderPageToCanvas(1, target, 1));
      expect(blank.map((d) => d[0])).toEqual(['Page 2 of 3']);
      const last = recordJava(canvas, () => canvas.renderPageToCanvas(2, target, 1));
      expect(last.map((d) => d[0])).toEqual(['Page 3 of 3']);
    });

    it('applies to scroll-single and scroll-double canvases', async () => {
      const single = await makeCanvas({ defaultViewMode: 'scroll-single' });
      const target = (globalThis as any).document.createElement('canvas');
      expect(recordJava(single, () => single.renderPageToCanvas(1, target, 1)).map((d) => d[0])).toEqual([
        'Page 2 of 4',
      ]);

      const double = await makeCanvas({ defaultViewMode: 'scroll-double' });
      expect(recordJava(double, () => double.renderSpreadToCanvas(2, target, 1)).map((d) => d[0])).toEqual([
        'Page 3 of 4',
        'Page 4 of 4',
      ]);

      double.setShowPageIndicator(false);
      expect(recordJava(double, () => double.renderSpreadToCanvas(2, target, 1))).toEqual([]);
    });

    it('remounts the scroll view when toggled in scroll mode', async () => {
      const canvas = await makeCanvas({ defaultViewMode: 'scroll-single' });
      expect(canvas.isScrollMode()).toBe(true);
      const setBookData = vi.spyOn(canvas.getContinuousScrollView()!, 'setBookData');
      const render = vi.spyOn(canvas, 'render');

      canvas.setShowPageIndicator(false);
      expect(setBookData).toHaveBeenCalledTimes(1);
      expect(render).not.toHaveBeenCalled();
    });
  });

  describe('Bedrock appearance', () => {
    it('is on by default, matching the previous always-on behaviour', async () => {
      const canvas = await makeCanvas({ appearance: 'bedrock' });
      expect(recordBedrock(canvas, () => canvas.render())).toEqual(['1 of 4', '2 of 4']);
    });

    it('draws nothing when showPageIndicator is false', async () => {
      const canvas = await makeCanvas({ appearance: 'bedrock', showPageIndicator: false });
      expect(recordBedrock(canvas, () => canvas.render())).toEqual([]);
    });

    it('toggles at runtime', async () => {
      const canvas = await makeCanvas({ appearance: 'bedrock' });
      canvas.setShowPageIndicator(false);
      expect(recordBedrock(canvas, () => canvas.render())).toEqual([]);
      canvas.setShowPageIndicator(true);
      expect(recordBedrock(canvas, () => canvas.render())).toEqual(['1 of 4', '2 of 4']);
    });

    it('draws only the left number when the right page does not exist', async () => {
      const canvas = await makeCanvas(
        { appearance: 'bedrock' },
        { title: 'Odd', author: 'Alex', pages: ['a', 'b', 'c'] }
      );
      canvas.setPage(2);
      expect(recordBedrock(canvas, () => canvas.render())).toEqual(['3 of 3']);
    });

    it('is included in spread export and honors the flag', async () => {
      const canvas = await makeCanvas({ appearance: 'bedrock', defaultViewMode: 'scroll-single' });
      const target = (globalThis as any).document.createElement('canvas');
      expect(recordBedrock(canvas, () => canvas.renderSpreadToCanvas(2, target, 1))).toEqual(['3 of 4', '4 of 4']);
      canvas.setShowPageIndicator(false);
      expect(recordBedrock(canvas, () => canvas.renderSpreadToCanvas(2, target, 1))).toEqual([]);
    });

    it('does not draw the Java indicator', async () => {
      const canvas = await makeCanvas({ appearance: 'bedrock' });
      expect(recordJava(canvas, () => canvas.render())).toEqual([]);
    });
  });

  describe('BlockgameBookViewer option', () => {
    it('defaults to on and passes pageNumbers: false through to the canvas', async () => {
      const on = new BlockgameBookViewer(mockContainer, { book: fourPageBook });
      await on.init();
      expect(on.isPageNumbersEnabled()).toBe(true);
      expect(on.getCanvas().getShowPageIndicator()).toBe(true);

      const off = new BlockgameBookViewer(mockContainer, { book: fourPageBook, pageNumbers: false });
      await off.init();
      expect(off.isPageNumbersEnabled()).toBe(false);
      expect(off.getCanvas().getShowPageIndicator()).toBe(false);
    });

    it('setPageNumbers updates the canvas', async () => {
      const viewer = new BlockgameBookViewer(mockContainer, { book: fourPageBook });
      await viewer.init();
      viewer.setPageNumbers(false);
      expect(viewer.getCanvas().getShowPageIndicator()).toBe(false);
      viewer.setPageNumbers(true);
      expect(viewer.getCanvas().getShowPageIndicator()).toBe(true);
    });

    it('is independent of the toolbar page indicator control', async () => {
      const viewer = new BlockgameBookViewer(mockContainer, {
        book: fourPageBook,
        controls: { pageIndicator: false },
      });
      await viewer.init();
      expect(viewer.isPageNumbersEnabled()).toBe(true);
    });
  });

  describe('<blockgame-book> page-numbers attribute', () => {
    const makeElement = (initial: Record<string, string>) => {
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
        textContent: `
title: Element Book
author: Alex
pages:
#- Page 1
#- Page 2
#- Page 3
#- Page 4
      `,
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

    it('is on when the attribute is absent', async () => {
      const { el } = makeElement({});
      await el.connectedCallback();
      expect(el.getViewer()?.isPageNumbersEnabled()).toBe(true);
      expect(el.pageNumbers).toBe(true);
    });

    it('is off at connect time when page-numbers="false"', async () => {
      const { el } = makeElement({ 'page-numbers': 'false' });
      await el.connectedCallback();
      expect(el.getViewer()?.isPageNumbersEnabled()).toBe(false);
      expect(el.pageNumbers).toBe(false);
    });

    it('treats a bare or "true" attribute as on', async () => {
      const bare = makeElement({ 'page-numbers': '' });
      await bare.el.connectedCallback();
      expect(bare.el.getViewer()?.isPageNumbersEnabled()).toBe(true);

      const explicit = makeElement({ 'page-numbers': 'true' });
      await explicit.el.connectedCallback();
      expect(explicit.el.getViewer()?.isPageNumbersEnabled()).toBe(true);
    });

    it('toggles at runtime through attributeChangedCallback', async () => {
      const { el } = makeElement({});
      await el.connectedCallback();
      const viewer = el.getViewer()!;

      await el.attributeChangedCallback('page-numbers', null, 'false');
      expect(viewer.isPageNumbersEnabled()).toBe(false);

      await el.attributeChangedCallback('page-numbers', 'false', 'true');
      expect(viewer.isPageNumbersEnabled()).toBe(true);

      await el.attributeChangedCallback('page-numbers', 'true', 'false');
      expect(viewer.isPageNumbersEnabled()).toBe(false);

      // Removing the attribute restores the default (on)
      await el.attributeChangedCallback('page-numbers', 'false', null);
      expect(viewer.isPageNumbersEnabled()).toBe(true);
    });

    it('toggles at runtime through the pageNumbers property', async () => {
      const { el, attributes } = makeElement({});
      await el.connectedCallback();
      const viewer = el.getViewer()!;

      el.pageNumbers = false;
      expect(attributes['page-numbers']).toBe('false');
      expect(viewer.isPageNumbersEnabled()).toBe(false);
      expect(el.pageNumbers).toBe(false);

      el.pageNumbers = true;
      expect('page-numbers' in attributes).toBe(false);
      expect(viewer.isPageNumbersEnabled()).toBe(true);
      expect(el.pageNumbers).toBe(true);
    });

    it('is listed in observedAttributes', () => {
      expect(BlockgameBookElement.observedAttributes).toContain('page-numbers');
    });
  });
});
