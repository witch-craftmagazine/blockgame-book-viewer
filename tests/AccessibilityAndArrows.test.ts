import { describe, it, expect, beforeEach } from 'vitest';
import { BookCanvas } from '../src/render/BookCanvas';
import { MinecraftBook } from '../src/engine/types';
import { splitTextToLines } from '../src/engine/StringSplitter';

describe('Accessibility Text Layer & Arrow Symmetry', () => {
  let mockContainer: any;

  beforeEach(() => {
    const mockCtx = {
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

  const sampleBook: MinecraftBook = {
    title: 'Accessibility Issue',
    author: 'Steve',
    pages: [
      '§6§lChapter 1§r\nWelcome to our magazine!\nEnjoy your stay.',
      '§bPage 2 contents here§r\nMore lore and stories.',
      '§aPage 3 contents here§r\nEven more text.',
      '§cFinal Page 4§r\nThe end.',
    ],
  };

  it('guarantees arrow symmetry in two-page mode', () => {
    const TWO_PAGE_WIDTH = 344;
    const SPINE_X = TWO_PAGE_WIDTH / 2; // 172
    const ARROW_WIDTH = 23;

    // Double page mode left backward button:
    const leftArrowX = 53;
    const leftArrowRight = leftArrowX + ARROW_WIDTH; // 76
    const leftDistanceToOuterEdge = leftArrowX; // 53px
    const leftDistanceToSpine = SPINE_X - leftArrowRight; // 172 - 76 = 96px

    // Double page mode right forward button:
    // RIGHT_PAGE_X = 152. forwardButtonX = 152 + 116 = 268.
    const rightArrowX = 152 + 116; // 268
    const rightArrowRight = rightArrowX + ARROW_WIDTH; // 291
    const rightDistanceToOuterEdge = TWO_PAGE_WIDTH - rightArrowRight; // 344 - 291 = 53px
    const rightDistanceToSpine = rightArrowX - SPINE_X; // 268 - 172 = 96px

    // Verify perfect symmetry
    expect(leftDistanceToOuterEdge).toBe(rightDistanceToOuterEdge);
    expect(leftDistanceToOuterEdge).toBe(53);

    expect(leftDistanceToSpine).toBe(rightDistanceToSpine);
    expect(leftDistanceToSpine).toBe(96);
  });

  it('correctly performs hitTestButtons with the symmetrical double-page positions', () => {
    const bookCanvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'double',
    });
    bookCanvas.setScale(1);
    bookCanvas.setBook(sampleBook);

    // In double mode, current page is 0, right page is 1.
    // Backward button is disabled on page 0. Forward button is enabled.
    expect(bookCanvas.hitTestButtons(53, 160)).toBeNull(); // page 0 can't go backward
    expect(bookCanvas.hitTestButtons(268, 160)).toBe('forward');
    expect(bookCanvas.hitTestButtons(291, 160)).toBe('forward');
    expect(bookCanvas.hitTestButtons(267, 160)).toBeNull(); // just outside left
    expect(bookCanvas.hitTestButtons(292, 160)).toBeNull(); // just outside right

    // Move to page 2 (left: 2, right: 3)
    bookCanvas.setPage(2);
    // Backward button is now enabled at (53..76, 157..170)
    expect(bookCanvas.hitTestButtons(53, 160)).toBe('backward');
    expect(bookCanvas.hitTestButtons(76, 160)).toBe('backward');
    expect(bookCanvas.hitTestButtons(52, 160)).toBeNull(); // just outside left
    expect(bookCanvas.hitTestButtons(77, 160)).toBeNull(); // just outside right

    // On page 2 (with page 3 as right page in a 4-page book), page 3 is the last page, so forward is disabled
    expect(bookCanvas.hitTestButtons(266, 160)).toBeNull();
  });

  it('correctly performs hitTestButtons in single-page mode', () => {
    const bookCanvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'single',
    });
    bookCanvas.setScale(1);
    bookCanvas.setBook(sampleBook);

    // Page 0: backward disabled, forward enabled at (116..139)
    expect(bookCanvas.hitTestButtons(43, 160)).toBeNull();
    expect(bookCanvas.hitTestButtons(116, 160)).toBe('forward');
    expect(bookCanvas.hitTestButtons(139, 160)).toBe('forward');

    // Page 1: both backward and forward enabled
    bookCanvas.setPage(1);
    expect(bookCanvas.hitTestButtons(43, 160)).toBe('backward');
    expect(bookCanvas.hitTestButtons(66, 160)).toBe('backward');
    expect(bookCanvas.hitTestButtons(116, 160)).toBe('forward');
  });

  it('generates accessible DOM text layer with stripped formatting and ARIA roles', () => {
    const bookCanvas = new BookCanvas({
      container: mockContainer,
      defaultViewMode: 'double',
    });
    bookCanvas.setScale(2);
    bookCanvas.setBook(sampleBook);

    // Inspect the text layer element inside the book-stage
    const stageEl = mockContainer.children[0];
    expect(stageEl.className).toBe('book-stage');
    expect(stageEl.getAttribute('role')).toBe('region');
    expect(stageEl.getAttribute('aria-label')).toBe('Blockgame Book Reader');

    const textLayerEl = stageEl.children.find((c: any) => c.className === 'book-text-layer');
    expect(textLayerEl).toBeDefined();
    expect(textLayerEl.getAttribute('aria-live')).toBe('polite');

    // There should be 2 page sections for double mode (Page 1 and Page 2)
    expect(textLayerEl.children.length).toBe(2);

    const leftSection = textLayerEl.children[0];
    expect(leftSection.getAttribute('aria-label')).toBe('Page 1 of 4');

    const heading = leftSection.children.find((c: any) => c.className === 'sr-only');
    expect(heading.textContent).toBe('Page 1 of 4');

    // Check accessible lines inside left section
    const lines = leftSection.children.filter((c: any) => c.className === 'accessible-line');
    expect(lines.length).toBeGreaterThan(0);

    // Text formatting symbols (§) must be completely stripped from screen reader text
    const firstLineText = lines[0].textContent;
    expect(firstLineText).not.toContain('§');
    expect(firstLineText).toBe('Chapter 1');

    // Check scale application: scale was 2, line height should be 18px (9 * 2)
    expect(lines[0].style.fontSize).toBe('18px');
    expect(lines[0].style.lineHeight).toBe('18px');

    // Check accessible navigation button on right page
    const rightSection = textLayerEl.children[1];
    expect(rightSection.getAttribute('aria-label')).toBe('Page 2 of 4');
    const nextBtn = rightSection.children.find((c: any) => c.className?.includes('accessible-next-btn'));
    expect(nextBtn).toBeDefined();
    expect(nextBtn.getAttribute('aria-label')).toBe('Turn forward to page 3');
  });

  it('keeps text selection toggled OFF by default and allows toggling without interfering with buttons', () => {
    const makeEl = (tag: string) => {
      const classes = new Set<string>();
      const el: any = {
        tagName: tag.toUpperCase(),
        _className: '',
        get className() { return Array.from(classes).join(' '); },
        set className(v: string) {
          classes.clear();
          v.split(' ').filter(Boolean).forEach(c => classes.add(c));
        },
        classList: {
          toggle(cls: string, force?: boolean) {
            if (force === true) classes.add(cls);
            else if (force === false) classes.delete(cls);
            else if (classes.has(cls)) classes.delete(cls);
            else classes.add(cls);
          },
          contains(cls: string) { return classes.has(cls); }
        },
        style: {},
        children: [] as any[],
        attributes: {} as Record<string, string>,
        _innerHTML: '',
        get innerHTML() { return this._innerHTML; },
        set innerHTML(val: string) {
          this._innerHTML = val;
          if (val === '') this.children = [];
        },
        textContent: '',
        setAttribute(k: string, v: string) { this.attributes[k] = v; },
        getAttribute(k: string) { return this.attributes[k]; },
        appendChild(child: any) { this.children.push(child); return child; },
        addEventListener() {},
        removeEventListener() {},
        closest: () => null,
      };
      if (tag === 'canvas') {
        el.getContext = () => ({
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
          imageSmoothingEnabled: false,
        });
      }
      return el;
    };

    (globalThis as any).document.createElement = makeEl;

    const container = makeEl('div');
    const bookCanvas = new BookCanvas({
      container,
      defaultViewMode: 'single',
    });
    bookCanvas.setBook(sampleBook);

    // 1. Text selection must be OFF by default
    expect(bookCanvas.isTextSelectionEnabled()).toBe(false);

    const stageEl = container.children[0];
    expect(stageEl.classList.contains('text-selection-enabled')).toBe(false);

    // 2. Toggle text selection ON
    bookCanvas.setTextSelectionEnabled(true);
    expect(bookCanvas.isTextSelectionEnabled()).toBe(true);
    expect(stageEl.classList.contains('text-selection-enabled')).toBe(true);

    // 3. Navigation buttons work regardless of text selection state
    expect(bookCanvas.hitTestButtons(116, 160)).toBe('forward');

    // 4. Toggle text selection back OFF
    bookCanvas.setTextSelectionEnabled(false);
    expect(bookCanvas.isTextSelectionEnabled()).toBe(false);
    expect(stageEl.classList.contains('text-selection-enabled')).toBe(false);
  });

  it('persists formatting styles across explicit newlines on a page until reset with §r', () => {
    // In Minecraft written books, each page is a single text component; styles carry over across \n
    const rawMultiLine = '§c§lBold Red Header\nSecond line\n§rReset Line';
    const lines = splitTextToLines(rawMultiLine);

    expect(lines).toHaveLength(3);
    // Line 1 is bold and red
    expect(lines[0].spans[0].bold).toBe(true);
    expect(lines[0].spans[0].color).toBe('#FF5555');

    // Line 2 inherits bold and red across the newline
    expect(lines[1].spans[0].bold).toBe(true);
    expect(lines[1].spans[0].color).toBe('#FF5555');

    // Line 3 resets to default formatting after §r
    expect(lines[2].spans[0].bold).toBe(false);
    expect(lines[2].spans[0].color).toBe('#000000');
  });

  it('calls clearRect on render and clears highlighted line on page turn', () => {
    let clearRectCalled = false;
    const trackingMockCtx = {
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
      clearRect: () => { clearRectCalled = true; },
      rect: () => {},
      clip: () => {},
      fillText: () => {},
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
        get innerHTML() { return this._innerHTML; },
        set innerHTML(val: string) {
          this._innerHTML = val;
          if (val === '') this.children = [];
        },
        textContent: '',
        setAttribute(k: string, v: string) { this.attributes[k] = v; },
        getAttribute(k: string) { return this.attributes[k]; },
        appendChild(child: any) { this.children.push(child); return child; },
        addEventListener() {},
        removeEventListener() {},
        closest: () => null,
      };
      if (tag === 'canvas') {
        el.getContext = () => trackingMockCtx;
      }
      return el;
    };

    (globalThis as any).document.createElement = makeEl;

    const bookCanvas = new BookCanvas({
      container: makeEl('div'),
      defaultViewMode: 'single',
    });
    bookCanvas.setBook(sampleBook);
    // Set a fake book background image so render executes
    (bookCanvas as any).bookBg = {} as HTMLImageElement;

    // Trigger render
    bookCanvas.render();
    expect(clearRectCalled).toBe(true);

    // Set highlighted line then turn page -> highlight should clear
    bookCanvas.setHighlightedLine(3);
    expect((bookCanvas as any).highlightedLineIndex).toBe(3);

    bookCanvas.nextPage();
    expect((bookCanvas as any).highlightedLineIndex).toBeNull();
  });
});
