import { describe, it, expect, beforeEach } from 'vitest';
import { BookCanvas } from '../src/render/BookCanvas';
import { BlockgameBook } from '../src/engine/types';
import { parseStendhalBook } from '../src/io/BookParser';
import { AnimatedCharController, normalizeAnimatedChars, normalizeBlankPageImage } from '../src/render/EasterEggs';

describe('AnimatedCharController', () => {
  const present = new Set(['⏼']);
  const def = { char: '⏼', frames: ['◡', '◠'], frameMs: 100, delayMs: 1000 as number };

  it('ignores invalid definitions and lets the last duplicate win', () => {
    const list = normalizeAnimatedChars([
      { char: 'ab', frames: ['x'] }, // not a single character
      { char: 'a', frames: [] }, // no frames
      { char: 'a', frames: ['xy'] }, // frame not a single character
      null,
      'nope',
      { char: '⏼', frames: ['x'] },
      { char: '⏼', frames: ['◡'], frameMs: 0 },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].frames).toEqual(['◡']);
    expect(list[0].frameMs).toBe(1); // floored so a frame is always visible
    expect(list[0].delay).toEqual([3500, 6500]); // blink-like defaults
    expect(normalizeAnimatedChars('not an array')).toEqual([]);
  });

  it('counts an astral character as a single character', () => {
    expect(normalizeAnimatedChars([{ char: '𝗵', frames: ['𝗮'] }])).toHaveLength(1);
  });

  it('rests, runs each frame in order, then rests again for the configured delay', () => {
    const c = new AnimatedCharController([def]);
    expect(c.tick(0, present)).toBe(false); // schedules the first run at t=1000
    expect(c.frameFor('⏼')).toBeNull();
    expect(c.tick(999, present)).toBe(false);
    expect(c.tick(1000, present)).toBe(true);
    expect(c.frameFor('⏼')).toBe('◡');
    expect(c.tick(1050, present)).toBe(false); // frame still showing
    expect(c.tick(1100, present)).toBe(true);
    expect(c.frameFor('⏼')).toBe('◠');
    expect(c.tick(1200, present)).toBe(true); // run finished
    expect(c.frameFor('⏼')).toBeNull();
    expect(c.tick(2199, present)).toBe(false);
    expect(c.tick(2200, present)).toBe(true); // next run
    expect(c.frameFor('⏼')).toBe('◡');
  });

  it('picks the rest delay from a [min, max] range using the injected random source', () => {
    const c = new AnimatedCharController([{ ...def, delayMs: [1000, 3000] as any }], () => 0.5);
    c.tick(0, present);
    expect(c.tick(1999, present)).toBe(false);
    expect(c.tick(2000, present)).toBe(true); // 1000 + 0.5 * 2000
  });

  it('loops continuously when the delay is 0', () => {
    const c = new AnimatedCharController([{ char: '✧', frames: ['✦', '✧'], frameMs: 50, delayMs: 0 }]);
    const p = new Set(['✧']);
    c.tick(0, p);
    expect(c.frameFor('✧')).toBe('✦');
    c.tick(50, p);
    expect(c.frameFor('✧')).toBe('✧');
    c.tick(100, p); // wraps straight into the next run, never resting
    expect(c.frameFor('✧')).toBe('✦');
  });

  it('returns to rest when the character is no longer on screen', () => {
    const c = new AnimatedCharController([def]);
    expect(c.play('⏼', 0)).toBe(true);
    expect(c.isAnimating('⏼')).toBe(true);
    expect(c.tick(10, new Set())).toBe(true);
    expect(c.isAnimating()).toBe(false);
    expect(c.tick(20, new Set())).toBe(false);
  });

  it('play() starts immediately and refuses unknown characters; reset() stops everything', () => {
    const c = new AnimatedCharController([def]);
    expect(c.play('x', 0)).toBe(false);
    c.play('⏼', 5);
    expect(c.frameFor('⏼')).toBe('◡');
    c.reset();
    expect(c.frameFor('⏼')).toBeNull();
  });
});

describe('normalizeBlankPageImage', () => {
  it('accepts a URL or an options object and applies default sizes', () => {
    expect(normalizeBlankPageImage('a.gif')).toMatchObject({ src: 'a.gif', width: 88, height: 100 });
    expect(normalizeBlankPageImage({ src: ' b.png ', width: 40, height: 0 })).toMatchObject({
      src: 'b.png',
      width: 40,
      height: 100,
    });
  });

  it('returns null for missing or blank sources', () => {
    expect(normalizeBlankPageImage(undefined)).toBeNull();
    expect(normalizeBlankPageImage('')).toBeNull();
    expect(normalizeBlankPageImage({ src: '   ' })).toBeNull();
  });
});

describe('Easter eggs: blank-page image and animated characters (canvas integration)', () => {
  let mockContainer: any;
  let mockCtx: any;

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
      fillText: () => {},
      measureText: () => ({ width: 12 }),
      getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
      setLineDash: () => {},
      clearRect: () => {},
      rect: () => {},
      clip: () => {},
      imageSmoothingEnabled: false,
    };

    const makeEl = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: {
          toggle: () => {},
          contains: () => false,
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
        appendChild(child: any) {
          this.children.push(child);
          return child;
        },
        addEventListener() {},
        removeEventListener() {},
        closest: () => null,
        remove() {},
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
      addEventListener() {},
      removeEventListener() {},
      getSelection: () => ({ toString: () => '' }),
    };

    mockContainer = makeEl('div');
  });

  const eye = { char: '⏼', frames: ['◡'], frameMs: 160 };

  it('does nothing by default: no magazine auto-detection, even for a StarSweetpea / Witchcraft book', () => {
    const canvas = new BookCanvas({ container: mockContainer });
    canvas.setBook({
      title: 'Witchcraft Magazine Issue #1',
      author: 'StarSweetpea',
      pages: ['Cover with eye: /( ⏼\\', ' '],
    });
    expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(false);
    expect(canvas.getBlankPageImagePlacement()).toBeNull();
    expect((canvas as any).getIsWitchcraftMagazine).toBeUndefined();
    expect(canvas.playAnimatedChar('⏼')).toBe(false);
  });

  it('tracks which animated characters are on the visible page(s) across pages and view modes', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'single', animatedChars: [eye] });
    canvas.setBook({
      title: 'T',
      author: 'A',
      pages: ['Page 1: Witch /( ⏼\\', 'Page 2: Just plain text', 'Page 3: Fern ☘(⏼⏼))'],
    });
    expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(true);
    canvas.nextPage();
    expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(false);
    canvas.setViewMode('double'); // spread of pages 2 and 3
    expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(true);
    canvas.setViewMode('single');
    canvas.setPage(1);
    expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(false);
    canvas.setPage(2);
    expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(true);
  });

  it('plays on demand only when the character is on screen, and stops on a page turn', () => {
    const canvas = new BookCanvas({ container: mockContainer, animatedChars: [eye] });
    canvas.setBook({ title: 'T', author: 'A', pages: ['/( ⏼\\ on page 1', 'Normal text on page 2'] });

    expect(canvas.playAnimatedChar('x')).toBe(false); // not configured
    expect(canvas.isAnimatedCharPlaying('⏼')).toBe(false);
    expect(canvas.playAnimatedChar('⏼')).toBe(true);
    expect(canvas.isAnimatedCharPlaying('⏼')).toBe(true);

    canvas.nextPage();
    expect(canvas.isAnimatedCharPlaying('⏼')).toBe(false);
    expect(canvas.playAnimatedChar('⏼')).toBe(false); // not on page 2
  });

  it('never reflows text while a character is animating (the original advance is kept)', () => {
    const xs: Record<string, number[]> = { idle: [], playing: [] };
    let bucket = 'idle';
    const recorder = {
      name: 'recorder',
      onRenderChar: (_ctx: any, c: { char: string; x: number }) => {
        if (c.char === 'b') xs[bucket].push(c.x);
      },
    };
    const canvas = new BookCanvas({
      container: mockContainer,
      animatedChars: [eye],
      plugins: [recorder as any],
    });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };
    canvas.setBook({ title: 'T', author: 'A', pages: ['a⏼b'] });

    bucket = 'idle';
    canvas.render();
    bucket = 'playing';
    canvas.playAnimatedChar('⏼'); // re-renders while the eye shows its alternate glyph
    expect(xs.idle.length).toBeGreaterThan(0);
    expect(xs.playing.length).toBeGreaterThan(0);
    expect(xs.playing[0]).toBe(xs.idle[0]);
  });

  it('reads animated characters from Stendhal content', () => {
    const book = parseStendhalBook(
      'title: Any Title\nauthor: Anyone\npages:\n#-\n             /( ⏼\\\n            /  / \\\n#-\nNormal page 2 text'
    );
    expect(book).not.toBeNull();
    const canvas = new BookCanvas({ container: mockContainer, animatedChars: [eye] });
    canvas.setBook(book as BlockgameBook);
    expect(canvas.hasAnimatedCharOnCurrentPage()).toBe(true);
  });

  it('correctly identifies blank pages (empty, whitespace, or formatting-only)', () => {
    const canvas = new BookCanvas({ container: mockContainer });
    canvas.setBook({ title: 'Blank Test', author: 'A', pages: ['Real content line', '   \n\n   ', '§6§l  §r\n', ''] });
    expect(canvas.isPageBlank(0)).toBe(false);
    expect(canvas.isPageBlank(1)).toBe(true);
    expect(canvas.isPageBlank(2)).toBe(true);
    expect(canvas.isPageBlank(3)).toBe(true);
  });

  it('shows the blank-page image at the end of an odd-length book in double view', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'double', blankPageImage: '/img.gif' });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };
    canvas.setBook({ title: 'T', author: 'A', pages: ['Page 1 cover text', 'Page 2 story text', '   '] });

    expect(canvas.getBlankPageImagePlacement()).toBeNull(); // spread 0 has text on both pages
    const overlay = (canvas as any).blankPageOverlayElement;
    expect(overlay.className).toBe('book-blank-page-image');
    expect(overlay.src).toBe('/img.gif');
    expect(overlay.style.display).toBe('none');

    canvas.nextPage();
    expect(canvas.getCurrentPage()).toBe(2);
    expect(canvas.getBlankPageImagePlacement()).toEqual({ x: 55, y: 43, w: 88, h: 100 });
    canvas.render();
    expect(overlay.style.display).toBe('block');
    expect(overlay.style.left).toBe(`${55 * canvas.getScale()}px`);
    expect(overlay.style.top).toBe(`${43 * canvas.getScale()}px`);
  });

  it('shows the blank-page image in single view on the final blank page', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'single', blankPageImage: '/img.gif' });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };
    canvas.setBook({ title: 'T', author: 'A', pages: ['Page 1 text', 'Page 2 text', ' '] });

    expect(canvas.getBlankPageImagePlacement()).toBeNull();
    canvas.nextPage();
    expect(canvas.getBlankPageImagePlacement()).toBeNull();
    canvas.nextPage();
    expect(canvas.getBlankPageImagePlacement()).toEqual({ x: 49, y: 43, w: 88, h: 100 });
  });

  it('shows the image on the companion right page when an odd-length book ends with text', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'double', blankPageImage: '/img.gif' });
    canvas.setBook({ title: 'T', author: 'A', pages: ['Only 1 page of content here!'] });
    expect(canvas.getBlankPageImagePlacement()).toEqual({ x: 201, y: 43, w: 88, h: 100 }); // RIGHT_PAGE_X + 49
  });

  it('does not show the image when the book does not end on a blank page', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'single', blankPageImage: '/img.gif' });
    canvas.setBook({ title: 'T', author: 'A', pages: ['Found diamonds', 'Found iron'] });
    canvas.nextPage();
    expect(canvas.getBlankPageImagePlacement()).toBeNull();
  });

  it('centres a custom image size inside the default slot', () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'single',
      blankPageImage: { src: '/small.png', width: 44, height: 50 },
    });
    canvas.setBook({ title: 'T', author: 'A', pages: [' '] });
    // x: 49 + (88-44)/2, y: 43 + (100-50)/2
    expect(canvas.getBlankPageImagePlacement()).toEqual({ x: 71, y: 68, w: 44, h: 50 });
  });

  it('draws nothing in Bedrock appearance or scroll modes (the coordinates are for Java single/double)', () => {
    const bedrock = new BookCanvas({ container: mockContainer, appearance: 'bedrock', blankPageImage: '/i.gif' });
    bedrock.setBook({ title: 'T', author: 'A', pages: [' '] });
    expect(bedrock.getBlankPageImagePlacement()).toBeNull();

    const scroll = new BookCanvas({ container: mockContainer, defaultViewMode: 'scroll-single', blankPageImage: '/i.gif' });
    scroll.setBook({ title: 'T', author: 'A', pages: [' '] });
    expect(scroll.getBlankPageImagePlacement()).toBeNull();
  });

  it('can set, change and clear the image at runtime', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'single' });
    canvas.setBook({ title: 'T', author: 'A', pages: [' '] });
    expect(canvas.getBlankPageImagePlacement()).toBeNull();

    canvas.setBlankPageImage('/a.gif');
    expect(canvas.getBlankPageImagePlacement()).not.toBeNull();
    expect((canvas as any).blankPageOverlayElement.src).toBe('/a.gif');

    canvas.setBlankPageImage({ src: '/b.gif', alt: 'Author', title: 'The author' });
    expect((canvas as any).blankPageOverlayElement.src).toBe('/b.gif');
    expect((canvas as any).blankPageOverlayElement.alt).toBe('Author');
    expect(canvas.getBlankPageImage()?.src).toBe('/b.gif');

    canvas.setBlankPageImage(null);
    expect(canvas.getBlankPageImagePlacement()).toBeNull();
    expect((canvas as any).blankPageOverlayElement).toBeNull();
  });

  it('scales the overlay to the canvas bounding rect when the canvas is clamped smaller than scale', () => {
    const canvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'double',
      scale: 4,
      blankPageImage: '/img.gif',
    });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };
    canvas.setBook({ title: 'T', author: 'A', pages: ['Only 1 page of content here!'] });

    const canvasEl = canvas.getCanvas();
    const stageEl = canvas.getStageElement();
    const overlay = (Array.from(stageEl.children) as any[]).find((c: any) => c.className === 'book-blank-page-image');
    expect(overlay).toBeDefined();

    const rect = { left: 20, top: 30, width: 688, height: 384, right: 708, bottom: 414, x: 20, y: 30, toJSON: () => {} };
    canvasEl.getBoundingClientRect = () => rect;
    stageEl.getBoundingClientRect = () => rect;
    canvas.updateBlankPageOverlay();

    // Double mode base is 344 x 192, so the clamped canvas is scale 2, not 4.
    expect(overlay.style.width).toBe('176px');
    expect(overlay.style.height).toBe('200px');
    expect(overlay.style.left).toBe(`${201 * 2}px`);
    expect(overlay.style.top).toBe(`${43 * 2}px`);
  });
});
