import { describe, it, expect, beforeEach } from 'vitest';
import { BookCanvas } from '../src/render/BookCanvas';
import { MinecraftBook } from '../src/engine/types';
import { defaultGlyphAtlas } from '../src/engine/GlyphAtlas';
import { parseStendhalBook } from '../src/io/BookParser';

describe('Witchcraft Magazine Blinking Eye Easter Egg', () => {
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

  it('detects StarSweetpea as Witchcraft Magazine and enables easter egg', () => {
    const canvas = new BookCanvas({ container: mockContainer });
    const book: MinecraftBook = {
      title: 'Witchcraft Magazine Issue #1',
      author: 'StarSweetpea',
      pages: ['Cover page with eye: /( ⏼\\'],
    };

    canvas.setBook(book);
    expect(canvas.getIsWitchcraftMagazine()).toBe(true);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(true);
  });

  it('does NOT enable easter egg for non-Witchcraft books even if they contain the eye symbol', () => {
    const canvas = new BookCanvas({ container: mockContainer });
    const normalBook: MinecraftBook = {
      title: 'Random Notes',
      author: 'Steve',
      pages: ['Here is a symbol /( ⏼\\ on a normal book'],
    };

    canvas.setBook(normalBook);
    expect(canvas.getIsWitchcraftMagazine()).toBe(false);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(false);
  });

  it('allows manual override via setIsWitchcraftMagazine', () => {
    const canvas = new BookCanvas({ container: mockContainer });
    const book: MinecraftBook = {
      title: 'Manual Test Book',
      author: 'Alex',
      pages: ['Page with eye: ☘(⏼⏼))'],
    };

    canvas.setBook(book);
    expect(canvas.getIsWitchcraftMagazine()).toBe(false);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(false);

    canvas.setIsWitchcraftMagazine(true);
    expect(canvas.getIsWitchcraftMagazine()).toBe(true);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(true);

    canvas.setIsWitchcraftMagazine(false);
    expect(canvas.getIsWitchcraftMagazine()).toBe(false);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(false);
  });

  it('tracks eye presence accurately across pages and view modes', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'single' });
    const book: MinecraftBook = {
      title: 'Witchcraft Magazine Vol. 1',
      author: 'StarSweetpea',
      pages: [
        'Page 1: Witch /( ⏼\\',  // page 0: has eye
        'Page 2: Just plain text',  // page 1: no eye
        'Page 3: Fern mascot ☘(⏼⏼))', // page 2: has eye
      ],
    };

    canvas.setBook(book);
    expect(canvas.getCurrentPage()).toBe(0);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(true);

    // Turn to page 2 (index 1) - no eye
    canvas.nextPage();
    expect(canvas.getCurrentPage()).toBe(1);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(false);

    // Switch to double page mode - spread of page 1 and page 2 (index 2 has eye)
    canvas.setViewMode('double');
    expect(canvas.getHasEyeOnCurrentPage()).toBe(true);

    // Turn back to single page mode
    canvas.setViewMode('single');
    canvas.setPage(1);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(false);
    canvas.setPage(2);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(true);
  });

  it('keeps the eye advance at 8px; blinking draws ◡ with the eye advance so text never reflows', () => {
    const atlas = defaultGlyphAtlas;
    const eyeAdvance = atlas.getAdvance('⏼', false);

    expect(eyeAdvance).toBe(8);
    // ◡ has its own (narrower) Unifont advance; the renderer forces the eye's advance when blinking
    expect(atlas.getAdvance('◡', false)).toBe(4.5);

    // Bold advance
    const boldEyeAdvance = atlas.getAdvance('⏼', true);
    expect(boldEyeAdvance).toBe(9);
  });

  it('manages blink trigger and resets on page turn', () => {
    const canvas = new BookCanvas({ container: mockContainer });
    const book: MinecraftBook = {
      title: 'Witchcraft Magazine',
      author: 'StarSweetpea',
      pages: [
        '/( ⏼\\ on page 1',
        'Normal text on page 2',
      ],
    };

    canvas.setBook(book);
    expect(canvas.getIsBlinkingEye()).toBe(false);

    // Trigger blink
    canvas.triggerBlink();
    expect(canvas.getIsBlinkingEye()).toBe(true);

    // Turn page - blink state must cleanly reset
    canvas.nextPage();
    expect(canvas.getIsBlinkingEye()).toBe(false);
  });

  it('populates eye hitboxes during render for interactive winks', () => {
    const canvas = new BookCanvas({ container: mockContainer });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };
    const book: MinecraftBook = {
      title: 'Witchcraft Magazine',
      author: 'StarSweetpea',
      pages: [
        '/( ⏼\\ on page 1',
      ],
    };

    canvas.setBook(book);
    const hitBoxes = (canvas as any).eyeHitBoxes;
    expect(hitBoxes).toBeDefined();
    expect(hitBoxes.length).toBeGreaterThan(0);
    expect(hitBoxes[0].w).toBe(12);
    expect(hitBoxes[0].h).toBe(12);
  });

  it('verifies eye symbol in Stendhal content authored by StarSweetpea', () => {
    const rawStendhal = `title: Witchcraft Magazine Issue #1
author: StarSweetpea
pages:
#-
             /( ⏼\\
            /  / \\
           /  /   \\
          /  /     \\
         /  /       \\
#-
Normal page 2 text`;

    const book = parseStendhalBook(rawStendhal);
    expect(book).not.toBeNull();
    if (!book) return;

    expect(book.author).toBe('StarSweetpea');
    expect(book.pages[0]).toContain('⏼');

    const canvas = new BookCanvas({ container: mockContainer });
    canvas.setBook(book);
    expect(canvas.getIsWitchcraftMagazine()).toBe(true);
    expect(canvas.getHasEyeOnCurrentPage()).toBe(true);
  });

  it('correctly identifies blank pages (empty, whitespace, or formatting-only)', () => {
    const canvas = new BookCanvas({ container: mockContainer });
    const book: MinecraftBook = {
      title: 'Blank Test',
      author: 'StarSweetpea',
      pages: [
        'Real content line',
        '   \n\n   ',
        '§6§l  §r\n',
        '',
      ],
    };
    canvas.setBook(book);

    expect(canvas.isPageBlank(0)).toBe(false);
    expect(canvas.isPageBlank(1)).toBe(true);
    expect(canvas.isPageBlank(2)).toBe(true);
    expect(canvas.isPageBlank(3)).toBe(true);
  });

  it('displays StarSweetpea gif on blank page at the end of odd-numbered magazine in double-page mode', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'double' });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };

    // 3 pages total (odd number of pages: 0, 1, 2)
    // Page 0 (left): Page 1 content
    // Page 1 (right): Page 2 content
    // Page 2 (left): Page 3 BLANK
    const book: MinecraftBook = {
      title: 'Witchcraft Magazine Issue #1',
      author: 'StarSweetpea',
      pages: [
        'Page 1 cover text',
        'Page 2 story text',
        '   ', // Page 3 is blank
      ],
    };

    canvas.setBook(book);

    // On spread 0 (pages 0 and 1): both have text, no gif displayed
    expect(canvas.getCurrentPage()).toBe(0);
    expect(canvas.getBlankPageGifPlacement()).toBeNull();
    const gifEl = (canvas as any).gifOverlayElement;
    expect(gifEl.style.display).toBe('none');

    // Turn to page 2 (spread 2): Page 3 is blank on left
    canvas.nextPage();
    expect(canvas.getCurrentPage()).toBe(2);

    const placement = canvas.getBlankPageGifPlacement();
    expect(placement).not.toBeNull();
    expect(placement?.x).toBe(55); // Centered on left parchment
    expect(placement?.y).toBe(43);
    expect(placement?.w).toBe(88);
    expect(placement?.h).toBe(100);

    // Overlay is displayed
    canvas.render();
    expect(gifEl.style.display).toBe('block');
    expect(gifEl.style.left).toBe(`${55 * canvas.getScale()}px`);
    expect(gifEl.style.top).toBe(`${43 * canvas.getScale()}px`);
  });

  it('displays StarSweetpea gif in single-page mode on the final blank page', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'single' });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };

    const book: MinecraftBook = {
      title: 'Witchcraft Magazine Issue #1',
      author: 'StarSweetpea',
      pages: [
        'Page 1 text',
        'Page 2 text',
        ' ', // Page 3 is blank
      ],
    };

    canvas.setBook(book);

    // Page 0: no gif
    expect(canvas.getBlankPageGifPlacement()).toBeNull();

    // Page 1: no gif
    canvas.nextPage();
    expect(canvas.getBlankPageGifPlacement()).toBeNull();

    // Page 2 (last page, blank): displays gif on single page
    canvas.nextPage();
    expect(canvas.getCurrentPage()).toBe(2);
    const placement = canvas.getBlankPageGifPlacement();
    expect(placement).not.toBeNull();
    expect(placement?.x).toBe(49); // Centered on single page
    expect(placement?.y).toBe(43);
    expect(placement?.w).toBe(88);
    expect(placement?.h).toBe(100);
  });

  it('displays StarSweetpea gif on companion right page when odd-numbered magazine has text on last page', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'double' });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };

    // 1 page total (odd number of pages: page 0 has text)
    // In double mode: Left page has text, right page is the blank companion page (pageIndex 1 >= totalPages)
    const book: MinecraftBook = {
      title: 'Witchcraft Magazine Single Page Special',
      author: 'StarSweetpea',
      pages: [
        'Only 1 page of content here!',
      ],
    };

    canvas.setBook(book);
    expect(canvas.getCurrentPage()).toBe(0);

    const placement = canvas.getBlankPageGifPlacement();
    expect(placement).not.toBeNull();
    expect(placement?.x).toBe(201); // Centered on right parchment (RIGHT_PAGE_X + 49 = 152 + 49)
    expect(placement?.y).toBe(43);
    expect(placement?.w).toBe(88);
    expect(placement?.h).toBe(100);
  });

  it('does NOT display StarSweetpea gif on non-Witchcraft books even if ending on a blank page', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'double' });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };

    const book: MinecraftBook = {
      title: 'Steve Mining Journal',
      author: 'Steve',
      pages: [
        'Found diamonds',
        'Found iron',
        ' ', // Blank page
      ],
    };

    canvas.setBook(book);
    canvas.nextPage();
    expect(canvas.getCurrentPage()).toBe(2);
    expect(canvas.getBlankPageGifPlacement()).toBeNull();
  });

  it('scales gif overlay matching canvas bounding rect when canvas is clamped smaller than scale', () => {
    const canvas = new BookCanvas({ container: mockContainer, defaultViewMode: 'double', scale: 4 });
    (canvas as any).bookBg = { naturalWidth: 256, naturalHeight: 256 };

    const book: MinecraftBook = {
      title: 'Witchcraft Magazine Clamped Test',
      author: 'StarSweetpea',
      pages: ['Only 1 page of content here!'],
    };

    canvas.setBook(book);
    const canvasEl = canvas.getCanvas();
    const stageEl = canvas.getStageElement();
    const gifEl = (Array.from(stageEl.children) as any[]).find((c: any) => c.className === 'book-blank-page-gif');
    expect(gifEl).toBeDefined();

    // Mock clamped bounding client rect: scale is 4, but container clamps canvas to 688x384 (scale 2 equivalent)
    canvasEl.getBoundingClientRect = () => ({
      left: 20,
      top: 30,
      width: 688,
      height: 384,
      right: 708,
      bottom: 414,
      x: 20,
      y: 30,
      toJSON: () => {},
    });
    stageEl.getBoundingClientRect = () => ({
      left: 20,
      top: 30,
      width: 688,
      height: 384,
      right: 708,
      bottom: 414,
      x: 20,
      y: 30,
      toJSON: () => {},
    });

    canvas.updateGifOverlay();

    // In double mode, baseW = 344, baseH = 192.
    // scaleX = 688 / 344 = 2, scaleY = 384 / 192 = 2.
    // Placement is x: 201, y: 43, w: 88, h: 100.
    // Therefore, gif overlay should be sized to 2x (w: 176, h: 200), NOT 4x (w: 352, h: 400).
    expect(gifEl.style.width).toBe('176px');
    expect(gifEl.style.height).toBe('200px');
    expect(gifEl.style.left).toBe(`${201 * 2}px`);
    expect(gifEl.style.top).toBe(`${43 * 2}px`);
  });
});
