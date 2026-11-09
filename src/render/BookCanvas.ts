import { LineLayout, MinecraftBook, ViewMode } from '../engine/types';
import { defaultGlyphAtlas, GlyphAtlas } from '../engine/GlyphAtlas';
import { splitTextToLines, LINES_PER_PAGE, BOOK_TEXT_WIDTH } from '../engine/StringSplitter';
import { stripFormatting } from '../engine/Formatting';
import { soundManager } from './SoundEffects';
import { ResourcePackInfo } from '../engine/ResourcePackManager';
import { BookPlugin, PageRect } from '../plugin/BookPlugin';

// Dimensions and layout
const TWO_PAGE_OVERLAP = 40; // Exact touch at spine seam with 0 overlapping non-transparent pixels
const TWO_PAGE_WIDTH = 384 - TWO_PAGE_OVERLAP; // 344px base width
const RIGHT_PAGE_X = 192 - TWO_PAGE_OVERLAP;   // 152px base offset

export interface BookCanvasOptions {
  container: HTMLElement;
  atlas?: GlyphAtlas;
  onPageChange?: (page: number, total: number) => void;
  baseAssetPath?: string;
  defaultViewMode?: ViewMode;
  showPageIndicator?: boolean;
  textSelectionEnabled?: boolean;
  scale?: number;
  plugins?: BookPlugin[];
  includeWitchcraftPlugin?: boolean;
}

export class BookCanvas {
  private container: HTMLElement;
  private stageElement: HTMLElement;
  private textLayerElement: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private atlas: GlyphAtlas;
  private baseAssetPath: string;
  private plugins: BookPlugin[] = [];

  private book: MinecraftBook = { title: '', author: '', pages: [''] };
  private paginatedPages: LineLayout[][] = [];
  private currentPage = 0; // 0-indexed
  private viewMode: ViewMode = 'double';
  private scale = 3; // Integer scaling factor
  private isScaleLocked = false;
  private resizeObserver: any = null;
  private showPageIndicator = false;
  private textSelectionEnabled = false; // Off by default

  // Layout Debug & Inspector support
  private showLayoutGrid = false;
  private highlightedLineIndex: number | null = null; // Off by default (toggleable via setShowPageIndicator)

  // Textures
  private bookBg: HTMLImageElement | null = null;
  private pageForwardBtn: HTMLImageElement | null = null;
  private pageForwardHoverBtn: HTMLImageElement | null = null;
  private pageBackwardBtn: HTMLImageElement | null = null;
  private pageBackwardHoverBtn: HTMLImageElement | null = null;

  // Interaction
  private hoveredButton: 'forward' | 'backward' | null = null;
  private onPageChange?: (page: number, total: number) => void;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private lastTouchTurnTime = 0;

  // Animation for §k (obfuscated)
  private animFrameId: number | null = null;
  private lastAnimTick = 0;
  private randomCharPool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+{}[]:;<>?,./~';
  private randomCharsByAdvance: Map<number, string[]> = new Map();

  // Eye blinking animation
  private isWitchcraftMagazine = false;
  private isBlinkingEye = false;
  private nextBlinkTimestamp = 0;
  private blinkEndTimestamp = 0;
  private hasEyeOnCurrentPage = false;
  private eyeHitBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];

  // StarSweetpea Blank Page Easter Egg
  private starSweetPeaGifUrl: string;
  private starSweetPeaImg: HTMLImageElement | null = null;
  private gifOverlayElement: HTMLImageElement | null = null;

  constructor(options: BookCanvasOptions) {
    this.container = options.container;
    this.atlas = options.atlas || defaultGlyphAtlas;
    this.baseAssetPath = options.baseAssetPath || './assets';
    this.starSweetPeaGifUrl = `${this.baseAssetPath}/textures/starsweetpea.gif`;
    this.onPageChange = options.onPageChange;
    this.showPageIndicator = options.showPageIndicator ?? false;
    this.textSelectionEnabled = options.textSelectionEnabled ?? false;
    if (options.defaultViewMode) {
      this.viewMode = options.defaultViewMode;
    }
    if (options.scale !== undefined) {
      this.scale = Math.max(1, Math.min(6, options.scale));
      this.isScaleLocked = true;
    }

    for (const ch of this.randomCharPool) {
      const adv = this.atlas.getAdvance(ch, false);
      if (!this.randomCharsByAdvance.has(adv)) {
        this.randomCharsByAdvance.set(adv, []);
      }
      this.randomCharsByAdvance.get(adv)!.push(ch);
    }

    this.stageElement = document.createElement('div');
    this.stageElement.className = `book-stage${this.textSelectionEnabled ? ' text-selection-enabled' : ''}`;
    this.stageElement.setAttribute('role', 'region');
    this.stageElement.setAttribute('aria-label', 'Minecraft Magazine Reader');

    this.textLayerElement = document.createElement('div');
    this.textLayerElement.className = `book-text-layer${this.textSelectionEnabled ? ' text-selection-enabled' : ''}`;
    this.textLayerElement.setAttribute('aria-live', 'polite');

    this.canvas = document.createElement('canvas');
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
    this.canvas.style.maxWidth = '100%';
    this.canvas.style.maxHeight = '100%';
    this.canvas.style.objectFit = 'contain';

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;

    this.stageElement.appendChild(this.canvas);
    this.stageElement.appendChild(this.textLayerElement);

    if (typeof document !== 'undefined') {
      const gifEl = document.createElement('img');
      gifEl.className = 'book-blank-page-gif';
      gifEl.src = this.starSweetPeaGifUrl;
      gifEl.alt = 'StarSweetpea';
      gifEl.title = 'StarSweetpea ~ Author of Witchcraft Magazine';
      gifEl.style.display = 'none';
      gifEl.style.cursor = 'pointer';
      gifEl.style.pointerEvents = 'auto';
      gifEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.triggerBlink();
        soundManager.playWink();
      });
      this.gifOverlayElement = gifEl;
      this.stageElement.appendChild(this.gifOverlayElement);
    }

    this.container.appendChild(this.stageElement);
    this.setupListeners();

    if (options.plugins) {
      for (const p of options.plugins) {
        this.addPlugin(p);
      }
    }
  }

  public addPlugin(plugin: BookPlugin): void {
    this.plugins.push(plugin);
    if (plugin.init) {
      plugin.init(this);
    }
  }

  public removePlugin(name: string): void {
    const idx = this.plugins.findIndex(p => p.name === name);
    if (idx !== -1) {
      const p = this.plugins[idx];
      if (p.destroy) p.destroy();
      this.plugins.splice(idx, 1);
    }
  }

  public getPlugin<T extends BookPlugin>(name: string): T | undefined {
    return this.plugins.find(p => p.name === name) as T | undefined;
  }

  public getPlugins(): readonly BookPlugin[] {
    return this.plugins;
  }

  public getStageElement(): HTMLElement {
    return this.stageElement;
  }

  public getCanvasDataUrl(): string {
    return this.canvas.toDataURL('image/png');
  }

  public getPaginatedPages(): LineLayout[][] {
    return this.paginatedPages;
  }

  public async init(): Promise<void> {
    await Promise.all([
      this.atlas.load(this.baseAssetPath),
      this.loadTexturesFromPaths({
        book: `${this.baseAssetPath}/textures/gui/book.png`,
        pageForward: `${this.baseAssetPath}/textures/gui/page_forward.png`,
        pageForwardHover: `${this.baseAssetPath}/textures/gui/page_forward_highlighted.png`,
        pageBackward: `${this.baseAssetPath}/textures/gui/page_backward.png`,
        pageBackwardHover: `${this.baseAssetPath}/textures/gui/page_backward_highlighted.png`,
      }),
      this.loadImage(this.starSweetPeaGifUrl)
        .then((img) => {
          this.starSweetPeaImg = img;
        })
        .catch(() => {}),
      soundManager.load(this.baseAssetPath),
    ]);

    this.fitToContainer();
    this.updateCanvasDimensions();
    this.render();
    this.startAnimLoop();
    this.setupResizeObserver();
  }

  public async applyResourcePack(pack: ResourcePackInfo): Promise<void> {
    await this.loadTexturesFromPaths(pack.textures);
    if (pack.fontTextures) {
      await this.atlas.loadFontTextures(pack.fontTextures);
    }
    if (pack.fontBaseUrl) {
      await this.atlas.loadFromFontDirectory(pack.fontBaseUrl);
    } else if (pack.fontProviders && pack.fontTextureResolver) {
      await this.atlas.loadBitmapProviders(pack.fontProviders, pack.fontTextureResolver);
    }
    // Re-paginate pages with updated character advances
    this.recalculatePages();
    this.render();
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (typeof Image === 'undefined') {
        resolve({ naturalWidth: 256, naturalHeight: 256, width: 256, height: 256 } as any);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load texture: ${src}`));
      img.src = src;
    });
  }

  private async loadTexturesFromPaths(paths: {
    book: string;
    pageForward: string;
    pageForwardHover: string;
    pageBackward: string;
    pageBackwardHover: string;
  }): Promise<void> {
    const [bg, fwd, fwdH, bwd, bwdH] = await Promise.all([
      this.loadImage(paths.book),
      this.loadImage(paths.pageForward),
      this.loadImage(paths.pageForwardHover),
      this.loadImage(paths.pageBackward),
      this.loadImage(paths.pageBackwardHover),
    ]);

    this.bookBg = bg;
    this.pageForwardBtn = fwd;
    this.pageForwardHoverBtn = fwdH;
    this.pageBackwardBtn = bwd;
    this.pageBackwardHoverBtn = bwdH;
  }

  public setBook(book: MinecraftBook, preservePage = false): void {
    const savedPage = this.currentPage;
    this.book = book;
    this.isWitchcraftMagazine = this.detectWitchcraftMagazine(book);
    this.recalculatePages();
    if (preservePage) {
      this.currentPage = Math.max(0, Math.min(this.paginatedPages.length - 1, savedPage));
    } else {
      this.currentPage = 0;
    }
    this.updateHasEyeOnCurrentPage();
    if (this.isWitchcraftMagazine) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.scheduleNextBlink(now);
    }
    for (const plugin of this.plugins) {
      if (plugin.onBookChange) {
        plugin.onBookChange(this.book, this.paginatedPages);
      }
    }
    this.notifyPageChange();
    this.render();
  }

  private detectWitchcraftMagazine(book: MinecraftBook): boolean {
    const author = (book.author || '').toLowerCase();
    const title = (book.title || '').toLowerCase();
    return author.includes('starsweetpea') || title.includes('witchcraft');
  }

  private scheduleNextBlink(now: number): void {
    // Autonomous blink interval between 3.5s and 6.5s
    this.nextBlinkTimestamp = now + 3500 + Math.random() * 3000;
  }

  public updateHasEyeOnCurrentPage(): void {
    this.hasEyeOnCurrentPage = false;
    if (!this.isWitchcraftMagazine) return;

    const pagesToCheck = [this.currentPage];
    if (this.viewMode === 'double' && this.currentPage + 1 < this.paginatedPages.length) {
      pagesToCheck.push(this.currentPage + 1);
    }

    for (const pIdx of pagesToCheck) {
      const pageLines = this.paginatedPages[pIdx];
      if (!pageLines) continue;
      for (const line of pageLines) {
        for (const span of line.spans) {
          if (span.text.includes('⏼')) {
            this.hasEyeOnCurrentPage = true;
            return;
          }
        }
      }
    }
  }

  public setIsWitchcraftMagazine(enabled: boolean): void {
    this.isWitchcraftMagazine = enabled;
    this.updateHasEyeOnCurrentPage();
    if (this.isWitchcraftMagazine) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.scheduleNextBlink(now);
    } else {
      this.isBlinkingEye = false;
    }
    this.render();
  }

  public getIsWitchcraftMagazine(): boolean {
    return this.isWitchcraftMagazine;
  }

  public getIsBlinkingEye(): boolean {
    return this.isBlinkingEye;
  }

  public getHasEyeOnCurrentPage(): boolean {
    return this.hasEyeOnCurrentPage;
  }

  public triggerBlink(): void {
    if (!this.isWitchcraftMagazine || !this.hasEyeOnCurrentPage) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.isBlinkingEye = true;
    this.blinkEndTimestamp = now + 160;
    this.scheduleNextBlink(now + 160);
    this.render();
  }

  public isPageBlank(pageIndex: number): boolean {
    const page = this.paginatedPages[pageIndex];
    if (!page || page.length === 0) return true;
    for (const line of page) {
      for (const span of line.spans) {
        if (span.text.trim().length > 0) return false;
      }
    }
    return true;
  }

  public getBlankPageGifPlacement(): { x: number; y: number; w: number; h: number } | null {
    if (!this.isWitchcraftMagazine) return null;
    const totalPages = this.paginatedPages.length;
    if (totalPages === 0) return null;

    const w = 88;
    const h = 100;
    const y = 43;
    const isDouble = this.viewMode === 'double';

    if (!isDouble) {
      // Single page view: only on the last page if that page is blank
      if (this.currentPage === totalPages - 1 && this.isPageBlank(this.currentPage)) {
        return { x: 49, y, w, h };
      }
      return null;
    }

    // Double page spread view:
    const leftIdx = this.currentPage;
    const rightIdx = this.currentPage + 1;

    // Case 1: Left page is the last page and is blank
    if (leftIdx === totalPages - 1 && this.isPageBlank(leftIdx)) {
      return { x: 55, y, w, h };
    }

    // Case 2: Right page is the companion blank page (past totalPages when totalPages is odd)
    // or right page is the last page and is blank
    if (rightIdx >= totalPages) {
      if (!this.isPageBlank(leftIdx)) {
        return { x: RIGHT_PAGE_X + 49, y, w, h };
      }
    } else if (rightIdx === totalPages - 1 && this.isPageBlank(rightIdx)) {
      return { x: RIGHT_PAGE_X + 49, y, w, h };
    }

    return null;
  }

  public updateGifOverlay(): void {
    if (!this.gifOverlayElement) return;

    const placement = this.getBlankPageGifPlacement();
    if (!placement) {
      this.gifOverlayElement.style.display = 'none';
      return;
    }

    const baseW = this.viewMode === 'double' ? TWO_PAGE_WIDTH : 192;
    const baseH = 192;

    const canvasRect = this.canvas && this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
    const stageRect = this.stageElement && this.stageElement.getBoundingClientRect ? this.stageElement.getBoundingClientRect() : null;

    let actualW = baseW * this.scale;
    let actualH = baseH * this.scale;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasRect && canvasRect.width > 0 && canvasRect.height > 0) {
      actualW = canvasRect.width;
      actualH = canvasRect.height;
      if (stageRect) {
        offsetX = canvasRect.left - stageRect.left;
        offsetY = canvasRect.top - stageRect.top;
      }
    }

    const scaleX = actualW / baseW;
    const scaleY = actualH / baseH;

    this.gifOverlayElement.style.display = 'block';
    this.gifOverlayElement.style.left = `${offsetX + placement.x * scaleX}px`;
    this.gifOverlayElement.style.top = `${offsetY + placement.y * scaleY}px`;
    this.gifOverlayElement.style.width = `${placement.w * scaleX}px`;
    this.gifOverlayElement.style.height = `${placement.h * scaleY}px`;
  }

  public recalculatePages(): void {
    const allPages: LineLayout[][] = [];

    // Each Stendhal page (delimited by #-) corresponds strictly 1-to-1 with a reader page.
    // In Minecraft Java Edition, written book pages have a fixed 14-line capacity and never auto-split.
    for (const rawPage of this.book.pages) {
      const lines = splitTextToLines(rawPage, BOOK_TEXT_WIDTH, this.atlas);
      allPages.push(lines);
    }

    this.paginatedPages = allPages.length > 0 ? allPages : [[{ spans: [], width: 0 }]];
    if (this.currentPage >= this.paginatedPages.length) {
      this.currentPage = Math.max(0, this.paginatedPages.length - 1);
    }
  }

  public getRawPageText(pageIndex: number): string {
    return this.book.pages[pageIndex] || '';
  }

  public getPageLines(pageIndex: number): LineLayout[] {
    return this.paginatedPages[pageIndex] || [];
  }

  public getAllPages(): LineLayout[][] {
    return this.paginatedPages;
  }

  public getAtlas(): GlyphAtlas {
    return this.atlas;
  }

  public setShowLayoutGrid(show: boolean): void {
    if (this.showLayoutGrid !== show) {
      this.showLayoutGrid = show;
      this.render();
    }
  }

  public setHighlightedLine(lineIndex: number | null): void {
    if (this.highlightedLineIndex !== lineIndex) {
      this.highlightedLineIndex = lineIndex;
      this.render();
    }
  }

  public setViewMode(mode: ViewMode): void {
    if (this.viewMode !== mode) {
      this.viewMode = mode;
      if (mode === 'double' && this.currentPage % 2 !== 0) {
        this.currentPage--;
      }
      this.updateHasEyeOnCurrentPage();
      this.fitToContainer();
      this.updateCanvasDimensions();
      this.notifyPageChange();
      this.render();
    }
  }

  public getViewMode(): ViewMode {
    return this.viewMode;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Returns the exact bounding rectangle in client coordinates of the visible book page
   * (excluding transparent canvas margins).
   */
  public getBookPageRect(): DOMRect | null {
    if (!this.canvas) return null;
    const canvasRect = this.canvas.getBoundingClientRect();
    if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return null;

    const baseW = this.viewMode === 'double' ? TWO_PAGE_WIDTH : 192;
    const baseH = 192;
    const scaleX = canvasRect.width / baseW;
    const scaleY = canvasRect.height / baseH;

    let minLocalX: number;
    let maxLocalX: number;
    // In Minecraft GUI book.png (192x192 region):
    // Parchment texture starts at y = 1 and ends at y = 181
    const minLocalY = 1;
    const maxLocalY = 181;

    if (this.viewMode === 'double') {
      // Mirrored left page spans x: 26 to 172.
      // Normal right page spans x: 152 + 20 = 172 to 152 + 166 = 318.
      minLocalX = 26;
      maxLocalX = 318;
    } else {
      // Single page spans x: 20 to 166.
      minLocalX = 20;
      maxLocalX = 166;
    }

    const left = canvasRect.left + minLocalX * scaleX;
    const right = canvasRect.left + maxLocalX * scaleX;
    const top = canvasRect.top + minLocalY * scaleY;
    const bottom = canvasRect.top + maxLocalY * scaleY;

    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      x: left,
      y: top,
      toJSON: () => ({ left, right, top, bottom, width: right - left, height: bottom - top }),
    } as DOMRect;
  }

  public setShowPageIndicator(show: boolean): void {
    if (this.showPageIndicator !== show) {
      this.showPageIndicator = show;
      this.render();
    }
  }

  public getShowPageIndicator(): boolean {
    return this.showPageIndicator;
  }

  public setTextSelectionEnabled(enabled: boolean): void {
    this.textSelectionEnabled = enabled;
    if (this.stageElement) {
      this.stageElement.classList.toggle('text-selection-enabled', enabled);
    }
    if (this.textLayerElement) {
      this.textLayerElement.classList.toggle('text-selection-enabled', enabled);
    }
  }

  public isTextSelectionEnabled(): boolean {
    return this.textSelectionEnabled;
  }

  public setScale(scale: number, lockScale = true): void {
    if (lockScale) {
      this.isScaleLocked = true;
    }
    const maxFitting = this.getMaxFittingScale();
    this.scale = Math.max(1, Math.min(maxFitting, scale));
    this.updateCanvasDimensions();
    this.render();
  }

  public getMaxFittingScale(): number {
    const parent = this.container;
    if (!parent || typeof window === 'undefined') return 6;

    let containerW = 0;
    let containerH = 0;

    if (parent.getBoundingClientRect && typeof parent.getBoundingClientRect === 'function') {
      const rect = parent.getBoundingClientRect();
      if (rect && typeof rect.width === 'number' && rect.width > 0) {
        containerW = rect.width;
      }
      if (rect && typeof rect.height === 'number' && rect.height > 0) {
        containerH = rect.height;
      }
    }

    if (containerW <= 0 && typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth > 0) {
      containerW = window.innerWidth;
    }
    if (containerH <= 0 && typeof window !== 'undefined' && typeof window.innerHeight === 'number' && window.innerHeight > 0) {
      containerH = window.innerHeight;
    }

    if (containerW <= 0 || containerH <= 0 || !Number.isFinite(containerW) || !Number.isFinite(containerH)) {
      return 6;
    }

    // Allocate margin/padding and space for toolbar
    const availW = Math.max(containerW - 16, 192);
    const availH = Math.max(containerH - 64, 192);

    const baseW = this.viewMode === 'double' ? TWO_PAGE_WIDTH : 192;
    const baseH = 192;

    const scaleX = Math.floor(availW / baseW);
    const scaleY = Math.floor(availH / baseH);
    const fitting = Math.max(1, Math.min(6, Math.min(scaleX, scaleY)));
    return Number.isFinite(fitting) ? fitting : 6;
  }

  public fitToContainer(): void {
    if (this.isScaleLocked) return;
    const optimalScale = this.getMaxFittingScale();

    if (optimalScale !== this.scale) {
      this.scale = optimalScale;
      this.updateCanvasDimensions();
      this.render();
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        const maxFitting = this.getMaxFittingScale();
        if (this.scale > maxFitting) {
          this.scale = maxFitting;
          this.updateCanvasDimensions();
          this.render();
        } else if (!this.isScaleLocked) {
          this.fitToContainer();
        } else {
          this.updateGifOverlay();
          this.notifyPageChange();
        }
      });
      this.resizeObserver.observe(this.container);
    }
  }

  public getScale(): number {
    return this.scale;
  }

  public getCurrentPage(): number {
    return this.currentPage;
  }

  public getTotalPages(): number {
    return this.paginatedPages.length;
  }

  public setPage(pageIndex: number): void {
    const clamped = Math.max(0, Math.min(this.paginatedPages.length - 1, pageIndex));
    if (clamped !== this.currentPage) {
      this.currentPage = clamped;
      this.highlightedLineIndex = null;
      this.isBlinkingEye = false;
      this.updateHasEyeOnCurrentPage();
      soundManager.playPageTurn();
      this.notifyPageChange();
      this.render();
    }
  }

  public nextPage(): boolean {
    const step = this.viewMode === 'double' ? 2 : 1;
    let changed = false;
    if (this.currentPage + step < this.paginatedPages.length) {
      this.currentPage += step;
      changed = true;
    } else if (this.viewMode === 'double' && this.currentPage + 1 < this.paginatedPages.length) {
      this.currentPage += 1;
      changed = true;
    }

    if (changed) {
      this.highlightedLineIndex = null;
      this.isBlinkingEye = false;
      this.updateHasEyeOnCurrentPage();
      soundManager.playPageTurn();
      this.notifyPageChange();
      this.render();
    }
    return changed;
  }

  public prevPage(): boolean {
    const step = this.viewMode === 'double' ? 2 : 1;
    let changed = false;
    if (this.currentPage - step >= 0) {
      this.currentPage -= step;
      changed = true;
    } else if (this.currentPage > 0) {
      this.currentPage = 0;
      changed = true;
    }

    if (changed) {
      this.highlightedLineIndex = null;
      this.isBlinkingEye = false;
      this.updateHasEyeOnCurrentPage();
      soundManager.playPageTurn();
      this.notifyPageChange();
      this.render();
    }
    return changed;
  }

  private notifyPageChange(): void {
    for (const plugin of this.plugins) {
      if (plugin.onPageChange) {
        plugin.onPageChange(this.currentPage, this.paginatedPages.length);
      }
    }
    if (this.onPageChange) {
      this.onPageChange(this.currentPage, this.paginatedPages.length);
    }
    this.updateTextLayer();
  }

  private updateCanvasDimensions(): void {
    const baseW = this.viewMode === 'double' ? TWO_PAGE_WIDTH : 192;
    const baseH = 192;

    this.canvas.width = baseW * this.scale;
    this.canvas.height = baseH * this.scale;
    this.canvas.style.width = `${baseW * this.scale}px`;
    this.canvas.style.height = `${baseH * this.scale}px`;
    this.canvas.style.maxWidth = '100%';
    this.canvas.style.maxHeight = '100%';
    this.stageElement.style.maxWidth = '100%';
    this.stageElement.style.maxHeight = '100%';
    if (this.isScaleLocked) {
      if (this.stageElement?.classList && typeof this.stageElement.classList.add === 'function') {
        this.stageElement.classList.add('scale-locked');
      }
    } else {
      if (this.stageElement?.classList && typeof this.stageElement.classList.remove === 'function') {
        this.stageElement.classList.remove('scale-locked');
      }
    }
    this.stageElement.style.aspectRatio = `${baseW} / ${baseH}`;

    this.ctx.imageSmoothingEnabled = false;
    this.updateTextLayer();
    this.updateGifOverlay();
  }

  public render(): void {
    if (!this.bookBg) return;

    this.eyeHitBoxes = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);

    const isDouble = this.viewMode === 'double';

    if (!isDouble) {
      // Single Page View (Vanilla 1:1)
      this.renderSinglePage({
        destX: 0,
        pageIndex: this.currentPage,
        textStartX: 36,
        pageIndicatorRightX: 148,
        backwardButtonX: 43,
        forwardButtonX: 116,
        isMirrored: false,
        allowForward: true,
        allowBackward: true,
      });
    } else {
      // Two-Page Spread View:
      // Left page has background MIRRORED horizontally so its binding is on the right (in the middle!)
      // Right page has background standard so its binding is on the left (in the middle!)
      const leftPageIndex = this.currentPage;
      const rightPageIndex = this.currentPage + 1;

      // 1. Render Left Page (Mirrored background, binding in middle)
      this.renderSinglePage({
        destX: 0,
        pageIndex: leftPageIndex,
        textStartX: 42,           // Centered on left parchment
        pageIndicatorRightX: 150,  // Near middle top margin
        backwardButtonX: 53,      // Outer bottom-left corner (symmetrical with right button at 53px from edge)
        forwardButtonX: 116,
        isMirrored: true,         // Mirror background texture!
        allowForward: false,
        allowBackward: true,
      });

      // 2. Render Right Page (Standard background, moved closer to meet central spine)
      if (rightPageIndex < this.paginatedPages.length) {
        this.renderSinglePage({
          destX: RIGHT_PAGE_X,
          pageIndex: rightPageIndex,
          textStartX: RIGHT_PAGE_X + 36,
          pageIndicatorRightX: RIGHT_PAGE_X + 148,
          backwardButtonX: RIGHT_PAGE_X + 53,
          forwardButtonX: RIGHT_PAGE_X + 116, // Outer bottom-right corner (150 + 116 = 266, 342 - (266+23) = 53px)
          isMirrored: false,
          allowForward: true,
          allowBackward: false,
        });
      } else {
        // Draw blank parchment background for empty right page
        const srcW = Math.round(this.bookBg.naturalWidth * 0.75);
        const srcH = Math.round(this.bookBg.naturalHeight * 0.75);
        this.ctx.drawImage(this.bookBg, 0, 0, srcW, srcH, RIGHT_PAGE_X, 0, 192, 192);
      }
    }

    // Draw StarSweetpea blank page easter egg on canvas if active
    const gifPlacement = this.getBlankPageGifPlacement();
    if (gifPlacement && this.starSweetPeaImg) {
      this.ctx.drawImage(
        this.starSweetPeaImg,
        gifPlacement.x,
        gifPlacement.y,
        gifPlacement.w,
        gifPlacement.h
      );
    }

    this.ctx.restore();
    this.updateTextLayer();
    this.updateGifOverlay();
  }

  /**
   * Renders a single book page with customizable geometry and mirroring.
   */
  private renderSinglePage(opts: {
    destX: number;
    pageIndex: number;
    textStartX: number;
    pageIndicatorRightX: number;
    backwardButtonX: number;
    forwardButtonX: number;
    isMirrored: boolean;
    allowForward: boolean;
    allowBackward: boolean;
  }): void {
    if (!this.bookBg) return;

    const {
      destX,
      pageIndex,
      textStartX,
      pageIndicatorRightX,
      backwardButtonX,
      forwardButtonX,
      isMirrored,
      allowForward,
      allowBackward,
    } = opts;

    // Support any resolution texture (16x, 32x, etc.):
    // The book GUI occupies 75% of the texture width/height (192/256)
    const srcW = Math.round(this.bookBg.naturalWidth * 0.75);
    const srcH = Math.round(this.bookBg.naturalHeight * 0.75);

    // 1. Draw Background (mirrored or standard)
    if (isMirrored) {
      this.ctx.save();
      this.ctx.translate(destX + 192, 0);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.bookBg, 0, 0, srcW, srcH, 0, 0, 192, 192);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(this.bookBg, 0, 0, srcW, srcH, destX, 0, 192, 192);
    }

    const side = isMirrored ? 'left' : (destX === 0 ? 'single' : 'right');
    const pageRect: PageRect = { x: destX, y: 0, w: 192, h: 192 };
    for (const plugin of this.plugins) {
      if (plugin.onBeforeRenderPage) {
        plugin.onBeforeRenderPage(this.ctx, pageIndex, side, pageRect);
      }
    }

    // 2. Draw Page Indicator ("Page X of Y") - toggleable, off by default
    if (this.showPageIndicator) {
      const pageMsg = `Page ${pageIndex + 1} of ${Math.max(1, this.paginatedPages.length)}`;
      this.renderTextLineRightAligned(pageMsg, pageIndicatorRightX, 16, '#000000');
    }

    // 3. Draw text lines (up to 14 lines, clipped strictly to book page area)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(textStartX - 2, 26, BOOK_TEXT_WIDTH + 8, LINES_PER_PAGE * 9 + 4);
    this.ctx.clip();

    const pageLines = this.paginatedPages[pageIndex] || [];
    for (let i = 0; i < Math.min(LINES_PER_PAGE, pageLines.length); i++) {
      const line = pageLines[i];
      const y = 30 + i * 9;
      let cursorX = textStartX;

      for (const span of line.spans) {
        for (let charToDraw of span.text) {
          if (span.obfuscated && charToDraw !== ' ') {
            charToDraw = this.getRandomCharFor(charToDraw, span.bold);
          }

          let glyphChar = charToDraw;
          let forceAdvance: number | null = null;
          if (charToDraw === '⏼' && this.isWitchcraftMagazine) {
            this.eyeHitBoxes.push({ x: cursorX - 2, y: y - 2, w: 12, h: 12 });
            if (this.isBlinkingEye) {
              glyphChar = '◡';
              forceAdvance = this.atlas.getAdvance('⏼', span.bold);
            }
          }

          for (const plugin of this.plugins) {
            if (plugin.onRenderChar) {
              const res = plugin.onRenderChar(this.ctx, {
                char: charToDraw,
                x: cursorX,
                y,
                style: span,
                pageIndex,
              });
              if (res) {
                if (res.char !== undefined) glyphChar = res.char;
                if (res.advance !== undefined) forceAdvance = res.advance;
              }
            }
          }

          const glyphInfo = this.atlas.getGlyphDrawInfo(glyphChar, span.color, span.bold);
          if (glyphInfo) {
            const destW = glyphInfo.dWidth ?? glyphInfo.sWidth;
            const destH = glyphInfo.dHeight ?? glyphInfo.sHeight;
            const drawY = y + (glyphInfo.yOffset ?? 0);

            if (span.italic) {
              this.ctx.save();
              this.ctx.transform(1, 0, -0.15, 1, (drawY + destH) * 0.15, 0);
            }

            this.ctx.drawImage(
              glyphInfo.image,
              glyphInfo.sx,
              glyphInfo.sy,
              glyphInfo.sWidth,
              glyphInfo.sHeight,
              cursorX,
              drawY,
              destW,
              destH
            );

            if (span.bold) {
              this.ctx.drawImage(
                glyphInfo.image,
                glyphInfo.sx,
                glyphInfo.sy,
                glyphInfo.sWidth,
                glyphInfo.sHeight,
                cursorX + 1,
                drawY,
                destW,
                destH
              );
            }

            if (span.italic) {
              this.ctx.restore();
            }

            const charAdvance = forceAdvance !== null ? forceAdvance : glyphInfo.advance;

            if (span.underlined) {
              this.ctx.fillStyle = span.color;
              this.ctx.fillRect(cursorX - 1, y + 8, charAdvance + 1, 1);
            }

            if (span.strikethrough) {
              this.ctx.fillStyle = span.color;
              this.ctx.fillRect(cursorX - 1, y + 4, charAdvance + 1, 1);
            }

            cursorX += charAdvance;
          } else {
            cursorX += forceAdvance !== null ? forceAdvance : this.atlas.getAdvance(glyphChar, span.bold);
          }
        }
      }
    }
    this.ctx.restore();

    // 3.5. Draw Debug Layout Grid (if inspector grid toggle active)
    if (this.showLayoutGrid) {
      this.ctx.save();
      // Draw 114px right margin guide line
      this.ctx.strokeStyle = 'rgba(230, 40, 40, 0.45)';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([2, 2]);
      this.ctx.beginPath();
      this.ctx.moveTo(textStartX + BOOK_TEXT_WIDTH, 26);
      this.ctx.lineTo(textStartX + BOOK_TEXT_WIDTH, 30 + LINES_PER_PAGE * 9);
      this.ctx.stroke();

      // Draw horizontal line baselines and highlight selected line
      for (let i = 0; i < LINES_PER_PAGE; i++) {
        const lineY = 30 + i * 9;
        const isHighlighted = this.highlightedLineIndex === i;

        if (isHighlighted) {
          this.ctx.fillStyle = 'rgba(255, 170, 0, 0.28)';
          this.ctx.fillRect(textStartX - 2, lineY - 1, BOOK_TEXT_WIDTH + 4, 10);
        }

        this.ctx.strokeStyle = isHighlighted ? 'rgba(255, 170, 0, 0.8)' : 'rgba(120, 120, 120, 0.2)';
        this.ctx.setLineDash(isHighlighted ? [] : [1, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(textStartX, lineY + 8);
        this.ctx.lineTo(textStartX + BOOK_TEXT_WIDTH, lineY + 8);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // 4. Draw Navigation Buttons
    // Backward button (bottom-left)
    const canGoBack = pageIndex > 0;
    if (allowBackward && canGoBack) {
      const bwdImg = (this.hoveredButton === 'backward') ? this.pageBackwardHoverBtn : this.pageBackwardBtn;
      if (bwdImg) {
        this.ctx.drawImage(bwdImg, 0, 0, bwdImg.naturalWidth, bwdImg.naturalHeight, backwardButtonX, 157, 23, 13);
      }
    }

    // Forward button (bottom-right)
    const canGoForward = pageIndex < this.paginatedPages.length - 1;
    if (allowForward && canGoForward) {
      const fwdImg = (this.hoveredButton === 'forward') ? this.pageForwardHoverBtn : this.pageForwardBtn;
      if (fwdImg) {
        this.ctx.drawImage(fwdImg, 0, 0, fwdImg.naturalWidth, fwdImg.naturalHeight, forwardButtonX, 157, 23, 13);
      }
    }

    for (const plugin of this.plugins) {
      if (plugin.onAfterRenderPage) {
        plugin.onAfterRenderPage(this.ctx, pageIndex, side, pageRect);
      }
    }
  }

  private renderTextLineRightAligned(text: string, rightEdgeX: number, y: number, color: string): void {
    let totalWidth = 0;
    for (const ch of text) {
      totalWidth += this.atlas.getAdvance(ch, false);
    }

    let cursorX = rightEdgeX - totalWidth;
    for (const ch of text) {
      const glyphInfo = this.atlas.getGlyphDrawInfo(ch, color, false);
      if (glyphInfo) {
        const destW = glyphInfo.dWidth ?? glyphInfo.sWidth;
        const destH = glyphInfo.dHeight ?? glyphInfo.sHeight;
        const drawY = y + (glyphInfo.yOffset ?? 0);

        this.ctx.drawImage(
          glyphInfo.image,
          glyphInfo.sx,
          glyphInfo.sy,
          glyphInfo.sWidth,
          glyphInfo.sHeight,
          cursorX,
          drawY,
          destW,
          destH
        );
        cursorX += glyphInfo.advance;
      } else {
        cursorX += this.atlas.getAdvance(ch, false);
      }
    }
  }

  private setupListeners(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const baseW = this.viewMode === 'double' ? TWO_PAGE_WIDTH : 192;
      const baseH = 192;
      const unscaledX = rect.width ? (e.clientX - rect.left) * (baseW / rect.width) : 0;
      const unscaledY = rect.height ? (e.clientY - rect.top) * (baseH / rect.height) : 0;

      const prevHover = this.hoveredButton;
      this.hoveredButton = this.hitTestButtons(unscaledX, unscaledY);

      if (prevHover !== this.hoveredButton) {
        this.canvas.style.cursor = this.hoveredButton ? 'pointer' : 'default';
        this.render();
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.hoveredButton !== null) {
        this.hoveredButton = null;
        this.canvas.style.cursor = 'default';
        this.render();
      }
    });

    // Touch events for mobile devices (swiping and tapping)
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = Date.now();
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      const deltaTime = Date.now() - this.touchStartTime;

      const rect = this.canvas.getBoundingClientRect();
      const baseW = this.viewMode === 'double' ? TWO_PAGE_WIDTH : 192;
      const baseH = 192;
      const unscaledX = rect.width ? (touch.clientX - rect.left) * (baseW / rect.width) : 0;
      const unscaledY = rect.height ? (touch.clientY - rect.top) * (baseH / rect.height) : 0;

      // 1. Horizontal swipe gesture
      if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && deltaTime < 600) {
        this.lastTouchTurnTime = Date.now();
        if (deltaX < 0) {
          this.nextPage();
        } else {
          this.prevPage();
        }
        return;
      }

      // 2. Tap gesture on touchscreen
      if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
        this.lastTouchTurnTime = Date.now();

        // Check if tapped directly on arrow buttons
        const hit = this.hitTestButtons(unscaledX, unscaledY);
        if (hit === 'forward') {
          this.nextPage();
          return;
        } else if (hit === 'backward') {
          this.prevPage();
          return;
        }

        // Tap on right half -> next page; left half -> prev page
        const midX = baseW / 2;
        if (unscaledX >= midX) {
          this.nextPage();
        } else {
          this.prevPage();
        }
      }
    }, { passive: true });

    let pointerDownX = 0;
    let pointerDownY = 0;

    this.stageElement.addEventListener('pointerdown', (e) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    });

    this.stageElement.addEventListener('click', (e) => {
      // Ignore simulated click events fired right after touchend
      if (Date.now() - this.lastTouchTurnTime < 450) return;

      const rect = this.canvas.getBoundingClientRect();
      const baseW = this.viewMode === 'double' ? TWO_PAGE_WIDTH : 192;
      const baseH = 192;
      const unscaledX = rect.width ? (e.clientX - rect.left) * (baseW / rect.width) : 0;
      const unscaledY = rect.height ? (e.clientY - rect.top) * (baseH / rect.height) : 0;

      // 1. Navigation buttons always take precedence (never blocked by selection)
      const hit = this.hitTestButtons(unscaledX, unscaledY);
      if (hit === 'forward') {
        if (typeof window !== 'undefined' && window.getSelection) {
          window.getSelection()?.removeAllRanges();
        }
        this.nextPage();
        return;
      } else if (hit === 'backward') {
        if (typeof window !== 'undefined' && window.getSelection) {
          window.getSelection()?.removeAllRanges();
        }
        this.prevPage();
        return;
      }

      // Check plugin clicks
      for (const plugin of this.plugins) {
        if (plugin.onClick) {
          const isDouble = this.viewMode === 'double';
          const side = isDouble ? (unscaledX < 172 ? 'left' : 'right') : 'single';
          const handled = plugin.onClick(unscaledX, unscaledY, this.currentPage, side);
          if (handled) return;
        }
      }

      // 1.5. Eye click interaction
      if (this.isWitchcraftMagazine && this.hasEyeOnCurrentPage && this.eyeHitBoxes.length > 0) {
        for (const box of this.eyeHitBoxes) {
          if (
            unscaledX >= box.x &&
            unscaledX <= box.x + box.w &&
            unscaledY >= box.y &&
            unscaledY <= box.y + box.h
          ) {
            this.triggerBlink();
            soundManager.playWink();
            return;
          }
        }
      }

      // 2. When text selection is enabled, prevent page turning only if user was dragging to select
      if (this.textSelectionEnabled) {
        if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) > 5) return;
        const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
        if (sel && sel.toString().trim().length > 0) return;
      }

      // 3. Click on right page turns forward, left page turns back
      const midX = baseW / 2;
      if (unscaledX >= midX) {
        this.nextPage();
      } else {
        this.prevPage();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        this.nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.prevPage();
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.setPage(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        this.setPage(this.paginatedPages.length - 1);
      }
    });
  }

  public hitTestButtons(x: number, y: number): 'forward' | 'backward' | null {
    const isDouble = this.viewMode === 'double';

    if (!isDouble) {
      if (this.currentPage > 0 && x >= 43 && x <= 43 + 23 && y >= 157 && y <= 157 + 13) {
        return 'backward';
      }
      if (this.currentPage < this.paginatedPages.length - 1 && x >= 116 && x <= 116 + 23 && y >= 157 && y <= 157 + 13) {
        return 'forward';
      }
    } else {
      // Left Page backward button at (53, 157, 23, 13) - symmetrical with right button at 53px from outer edge
      if (this.currentPage > 0 && x >= 53 && x <= 53 + 23 && y >= 157 && y <= 157 + 13) {
        return 'backward';
      }
      // Right Page forward button at (RIGHT_PAGE_X + 116, 157, 23, 13) -> (266, 157, 23, 13)
      const rightPageIndex = this.currentPage + 1;
      const rightBtnX = RIGHT_PAGE_X + 116;
      if (rightPageIndex < this.paginatedPages.length - 1 && x >= rightBtnX && x <= rightBtnX + 23 && y >= 157 && y <= 157 + 13) {
        return 'forward';
      }
    }

    return null;
  }

  /**
   * Updates the accessible DOM text layer overlay positioned directly above the canvas.
   * This enables native browser text selection, copy/paste, and screen reader announcements.
   */
  public updateTextLayer(): void {
    if (!this.textLayerElement) return;

    this.textLayerElement.innerHTML = '';
    const totalPages = this.paginatedPages.length;
    const isDouble = this.viewMode === 'double';

    if (!isDouble) {
      // Single Page Mode
      const pageIndex = this.currentPage;
      const pageSection = this.buildAccessiblePageSection({
        pageIndex,
        totalPages,
        textStartX: 36,
        backwardButtonX: 43,
        forwardButtonX: 116,
        allowBackward: pageIndex > 0,
        allowForward: pageIndex < totalPages - 1,
      });
      this.textLayerElement.appendChild(pageSection);
    } else {
      // Double Page Mode (Left & Right pages)
      const leftPageIndex = this.currentPage;
      const rightPageIndex = this.currentPage + 1;

      // 1. Left Page
      const leftSection = this.buildAccessiblePageSection({
        pageIndex: leftPageIndex,
        totalPages,
        textStartX: 42,
        backwardButtonX: 53,
        forwardButtonX: null,
        allowBackward: leftPageIndex > 0,
        allowForward: false,
      });
      this.textLayerElement.appendChild(leftSection);

      // 2. Right Page
      if (rightPageIndex < totalPages) {
        const rightSection = this.buildAccessiblePageSection({
          pageIndex: rightPageIndex,
          totalPages,
          textStartX: RIGHT_PAGE_X + 36,
          backwardButtonX: null,
          forwardButtonX: RIGHT_PAGE_X + 116,
          allowBackward: false,
          allowForward: rightPageIndex < totalPages - 1,
        });
        this.textLayerElement.appendChild(rightSection);
      }
    }
  }

  private buildAccessiblePageSection(opts: {
    pageIndex: number;
    totalPages: number;
    textStartX: number;
    backwardButtonX: number | null;
    forwardButtonX: number | null;
    allowBackward: boolean;
    allowForward: boolean;
  }): HTMLElement {
    const section = document.createElement('section');
    section.className = 'accessible-page';
    section.setAttribute('aria-label', `Page ${opts.pageIndex + 1} of ${opts.totalPages}`);

    const srHeading = document.createElement('h3');
    srHeading.className = 'sr-only';
    srHeading.textContent = `Page ${opts.pageIndex + 1} of ${opts.totalPages}`;
    section.appendChild(srHeading);

    const baseW = this.viewMode === 'double' ? TWO_PAGE_WIDTH : 192;
    const baseH = 192;
    const canvasRect = this.canvas && this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
    const stageRect = this.stageElement && this.stageElement.getBoundingClientRect ? this.stageElement.getBoundingClientRect() : null;

    let actualW = baseW * this.scale;
    let actualH = baseH * this.scale;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasRect && canvasRect.width > 0 && canvasRect.height > 0) {
      actualW = canvasRect.width;
      actualH = canvasRect.height;
      if (stageRect) {
        offsetX = canvasRect.left - stageRect.left;
        offsetY = canvasRect.top - stageRect.top;
      }
    }

    const scaleX = actualW / baseW;
    const scaleY = actualH / baseH;

    const pageLines = this.paginatedPages[opts.pageIndex] || [];
    for (let i = 0; i < Math.min(LINES_PER_PAGE, pageLines.length); i++) {
      const line = pageLines[i];
      const lineY = offsetY + (30 + i * 9) * scaleY;
      const lineX = offsetX + opts.textStartX * scaleX;
      const rawText = line.spans.map(s => s.text).join('');

      if (rawText.length > 0) {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'accessible-line';
        lineDiv.setAttribute('role', 'text');
        lineDiv.style.left = `${lineX}px`;
        lineDiv.style.top = `${lineY}px`;
        lineDiv.style.height = `${9 * scaleY}px`;
        lineDiv.style.fontSize = `${9 * scaleY}px`;
        lineDiv.style.lineHeight = `${9 * scaleY}px`;
        lineDiv.textContent = stripFormatting(rawText);
        section.appendChild(lineDiv);
      }
    }

    // Accessible Previous Page button
    if (opts.backwardButtonX !== null && opts.allowBackward) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'accessible-nav-btn accessible-prev-btn';
      prevBtn.setAttribute('aria-label', `Turn back to page ${opts.pageIndex}`);
      prevBtn.setAttribute('title', 'Previous Page (Left Arrow)');
      prevBtn.style.left = `${offsetX + opts.backwardButtonX * scaleX}px`;
      prevBtn.style.top = `${offsetY + 157 * scaleY}px`;
      prevBtn.style.width = `${23 * scaleX}px`;
      prevBtn.style.height = `${13 * scaleY}px`;
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.prevPage();
      });
      section.appendChild(prevBtn);
    }

    // Accessible Next Page button
    if (opts.forwardButtonX !== null && opts.allowForward) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'accessible-nav-btn accessible-next-btn';
      nextBtn.setAttribute('aria-label', `Turn forward to page ${opts.pageIndex + 2}`);
      nextBtn.setAttribute('title', 'Next Page (Right Arrow)');
      nextBtn.style.left = `${offsetX + opts.forwardButtonX * scaleX}px`;
      nextBtn.style.top = `${offsetY + 157 * scaleY}px`;
      nextBtn.style.width = `${23 * scaleX}px`;
      nextBtn.style.height = `${13 * scaleY}px`;
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextPage();
      });
      section.appendChild(nextBtn);
    }

    return section;
  }

  private startAnimLoop(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    const tick = (now: number) => {
      let needsRender = false;

      // 1. Obfuscated text animation (§k): ~12.5 FPS (80ms ticks)
      if (now - this.lastAnimTick >= 80) {
        if (this.hasObfuscatedTextOnCurrentPage()) {
          needsRender = true;
        }
        this.lastAnimTick = now;
      }

      // 2. Eye blinking animation:
      if (this.isWitchcraftMagazine && this.hasEyeOnCurrentPage) {
        if (!this.isBlinkingEye && now >= this.nextBlinkTimestamp) {
          this.isBlinkingEye = true;
          this.blinkEndTimestamp = now + 160; // 160ms blink duration
          this.scheduleNextBlink(now + 160);
          needsRender = true;
        } else if (this.isBlinkingEye && now >= this.blinkEndTimestamp) {
          this.isBlinkingEye = false;
          needsRender = true;
        }
      } else if (this.isBlinkingEye) {
        this.isBlinkingEye = false;
        needsRender = true;
      }

      // 3. Plugin animation ticks
      for (const plugin of this.plugins) {
        if (plugin.onTick) {
          if (plugin.onTick(now)) {
            needsRender = true;
          }
        }
      }

      if (needsRender) {
        this.render();
      }

      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private hasObfuscatedTextOnCurrentPage(): boolean {
    const pagesToCheck = [this.currentPage];
    if (this.viewMode === 'double') {
      pagesToCheck.push(this.currentPage + 1);
    }

    for (const pIdx of pagesToCheck) {
      const page = this.paginatedPages[pIdx];
      if (!page) continue;
      for (const line of page) {
        for (const span of line.spans) {
          if (span.obfuscated) return true;
        }
      }
    }
    return false;
  }

  private getRandomCharFor(char: string, isBold: boolean): string {
    const adv = this.atlas.getAdvance(char, isBold);
    const baseAdv = isBold ? Math.max(1, adv - 1) : adv;
    const pool = this.randomCharsByAdvance.get(baseAdv);
    if (pool && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      return pool[idx];
    }
    const randIdx = Math.floor(Math.random() * this.randomCharPool.length);
    return this.randomCharPool[randIdx];
  }

  public toDataURL(): string {
    return this.canvas.toDataURL('image/png');
  }

  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.gifOverlayElement) {
      this.gifOverlayElement.remove();
    }
    this.canvas.remove();
  }
}
