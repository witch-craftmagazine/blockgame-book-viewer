import {
  LineLayout,
  BlockgameBook,
  ViewMode,
  BookAppearance,
  BookEngine,
  FormattedSpan,
  BlockgameDyeColor,
  BLOCKGAME_DYE_HEX,
} from '../engine/types';
import { defaultGlyphAtlas, GlyphAtlas } from '../engine/GlyphAtlas';
import {
  splitTextToLines,
  measureLineWidth,
  LINES_PER_PAGE,
  BOOK_TEXT_WIDTH,
  getTextWidthForEngine,
  LINE_HEIGHT,
} from '../engine/StringSplitter';
import { parseFormattedText, stripFormatting, DEFAULT_BOOK_TEXT_COLOR } from '../engine/Formatting';
import { soundManager } from './SoundEffects';
import { ResourcePackInfo, BookTextures, CompositeResourcePack } from '../engine/ResourcePackManager';
import { BookPlugin, PageRect } from '../plugin/BookPlugin';
import { ContinuousScrollView } from './ContinuousScrollView';
import {
  AnimatedCharController,
  normalizeBlankPageImage,
  DEFAULT_BLANK_PAGE_IMAGE_WIDTH,
  DEFAULT_BLANK_PAGE_IMAGE_HEIGHT,
  type AnimatedChar,
  type BlankPageImageOptions,
} from './EasterEggs';

// Dimensions and layout
const TWO_PAGE_OVERLAP = 40; // Exact touch at spine seam with 0 overlapping non-transparent pixels
const TWO_PAGE_WIDTH = 384 - TWO_PAGE_OVERLAP; // 344px base width
const RIGHT_PAGE_X = 192 - TWO_PAGE_OVERLAP;   // 152px base offset

// Bedrock Dimensions and layout
export const BEDROCK_BASE_WIDTH = 308;
export const BEDROCK_BASE_HEIGHT = 192;
export const BEDROCK_TEX_X = 102;
export const BEDROCK_TEX_Y = 16;
export const BEDROCK_TEX_W = 308;
export const BEDROCK_TEX_H = 192;

export interface BookCanvasOptions {
  container: HTMLElement;
  atlas?: GlyphAtlas;
  onPageChange?: (page: number, total: number) => void;
  onProgressSave?: (page: number) => void;
  baseAssetPath?: string;
  defaultViewMode?: ViewMode;
  appearance?: BookAppearance;
  engine?: BookEngine;
  /**
   * Enable experimental Scholar/accessibility features.
   * When false (default), highContrast, coverColor, and bookmark are ignored.
   */
  experimental?: boolean;
  highContrast?: boolean;
  coverColor?: BlockgameDyeColor | string;
  showBookmark?: boolean;
  bookmarkColor?: string;
  onClose?: () => void;
  /**
   * Draw the page number inside the book canvas: Java "Page X of Y" or Bedrock "N of M".
   * Defaults to true. This is separate from the toolbar text indicator.
   */
  showPageIndicator?: boolean;
  textSelectionEnabled?: boolean;
  scale?: number;
  plugins?: BookPlugin[];
  /** Image shown on the final page when it is blank (Java layouts, single and double view). */
  blankPageImage?: string | BlankPageImageOptions;
  /** Characters whose glyph is briefly swapped for other glyphs, e.g. a blinking eye. */
  animatedChars?: AnimatedChar[];
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
  private continuousScrollView?: ContinuousScrollView;

  // Aesthetic & Art Extensions (Scholar covers & bookmarks) — experimental only
  private experimental = false;
  private coverColor?: BlockgameDyeColor | string;
  private showBookmark = false;
  private bookmarkColor?: string;

  private book: BlockgameBook = { title: '', author: '', pages: [''] };
  private paginatedPages: LineLayout[][] = [];
  private currentPage = 0; // 0-indexed
  private viewMode: ViewMode = 'double';
  private scale = 3; // Integer scaling factor
  private isScaleLocked = false;
  private resizeObserver: any = null;
  private showPageIndicator = true;
  private textSelectionEnabled = false; // Off by default

  // Layout Debug & Inspector support
  private showLayoutGrid = false;
  private highlightedLineIndex: number | null = null;

  // Decoupled Appearance & Engine
  private appearance: BookAppearance = 'java';
  private engine: BookEngine = 'java';
  private highContrast = false;
  private onClose?: () => void;

  // Java Textures
  private bookBg: HTMLImageElement | null = null;
  private pageForwardBtn: HTMLImageElement | null = null;
  private pageForwardHoverBtn: HTMLImageElement | null = null;
  private pageBackwardBtn: HTMLImageElement | null = null;
  private pageBackwardHoverBtn: HTMLImageElement | null = null;

  // Bedrock Textures
  private bedrockBg: HTMLImageElement | null = null;
  private bedrockBgHc: HTMLImageElement | null = null;
  private bedrockForwardBtn: HTMLImageElement | null = null;
  private bedrockForwardHoverBtn: HTMLImageElement | null = null;
  private bedrockBackwardBtn: HTMLImageElement | null = null;
  private bedrockBackwardHoverBtn: HTMLImageElement | null = null;
  private bedrockCloseBtn: HTMLImageElement | null = null;
  private bedrockCloseHoverBtn: HTMLImageElement | null = null;

  // Interaction
  private hoveredButton: 'forward' | 'backward' | 'close' | null = null;
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

  // Easter eggs (generic, opt-in): animated characters and a blank-page image
  private animatedChars: AnimatedCharController;
  private animatedCharsOnPage = new Set<string>();
  private blankPageImage: ReturnType<typeof normalizeBlankPageImage> = null;
  private blankPageImg: HTMLImageElement | null = null;
  private blankPageOverlayElement: HTMLImageElement | null = null;

  constructor(options: BookCanvasOptions) {
    this.container = options.container;
    this.atlas = options.atlas || defaultGlyphAtlas;
    this.baseAssetPath = options.baseAssetPath || './assets';
    this.animatedChars = new AnimatedCharController(options.animatedChars);
    this.blankPageImage = normalizeBlankPageImage(options.blankPageImage);
    this.onPageChange = options.onPageChange;
    this.showPageIndicator = options.showPageIndicator ?? true;
    this.textSelectionEnabled = options.textSelectionEnabled ?? false;
    this.appearance = options.appearance || 'java';
    this.engine = options.engine || 'java';
    this.experimental = options.experimental ?? false;
    this.highContrast = options.highContrast || false;
    this.coverColor = options.coverColor;
    this.showBookmark = options.showBookmark ?? false;
    this.bookmarkColor = options.bookmarkColor;
    this.onClose = options.onClose;
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
    this.stageElement.setAttribute('aria-label', 'Blockgame Book Reader');

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

    this.syncBlankPageOverlay();

    this.container.appendChild(this.stageElement);
    this.setupListeners();

    // Initialize Continuous Scroll View
    this.continuousScrollView = new ContinuousScrollView({
      container: this.container,
      bookCanvas: this,
      onPageChange: (page) => {
        this.currentPage = page;
        this.notifyPageChange();
      },
      onProgressSave: (page) => {
        if (options.onProgressSave) {
          options.onProgressSave(page);
        }
      },
    });

    if (this.viewMode === 'scroll-single' || this.viewMode === 'scroll-double') {
      this.stageElement.style.display = 'none';
      this.continuousScrollView.setViewMode(this.viewMode);
      this.continuousScrollView.show();
    }

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
    return typeof this.canvas.toDataURL === 'function' ? this.canvas.toDataURL('image/png') : '';
  }

  public getPageDataUrl(pageIndex?: number): string {
    if (pageIndex === undefined || (pageIndex === this.currentPage && this.viewMode === 'single')) {
      return this.getCanvasDataUrl();
    }

    if (pageIndex < 0 || pageIndex >= this.paginatedPages.length) {
      return this.getCanvasDataUrl();
    }

    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return this.getCanvasDataUrl();
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = 192 * this.scale;
    offCanvas.height = 192 * this.scale;
    const offCtx = offCanvas.getContext ? offCanvas.getContext('2d') : null;
    if (!offCtx || typeof offCanvas.toDataURL !== 'function') {
      return this.getCanvasDataUrl();
    }

    offCtx.imageSmoothingEnabled = false;
    const originalCtx = this.ctx;
    try {
      this.ctx = offCtx;
      this.ctx.save();
      this.ctx.scale(this.scale, this.scale);
      this.renderSinglePage({
        destX: 0,
        pageIndex,
        textStartX: 36,
        pageIndicatorRightX: 148,
        backwardButtonX: 43,
        forwardButtonX: 116,
        isMirrored: false,
        allowForward: pageIndex < this.paginatedPages.length - 1,
        allowBackward: pageIndex > 0,
      });
      this.ctx.restore();
      return offCanvas.toDataURL('image/png');
    } finally {
      this.ctx = originalCtx;
    }
  }

  public async getPageBlob(pageIndex?: number): Promise<Blob> {
    const dataUrl = this.getPageDataUrl(pageIndex);
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return new Blob([], { type: 'image/png' });
    }
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const base64Data = parts[1] || '';
    try {
      if (typeof atob === 'function') {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mime });
      }
    } catch {
      // Fallback if string is not valid base64
    }
    return new Blob([base64Data], { type: mime });
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
      this.loadBedrockTextures({
        background: `${this.baseAssetPath}/textures/gui/bedrock/view_background.png`,
        backgroundHc: `${this.baseAssetPath}/textures/gui/bedrock/view_background_hc.png`,
        close: `${this.baseAssetPath}/textures/gui/bedrock/close.png`,
        closeHover: `${this.baseAssetPath}/textures/gui/bedrock/close_hover.png`,
        pageForward: `${this.baseAssetPath}/textures/gui/bedrock/page_forward.png`,
        pageForwardHover: `${this.baseAssetPath}/textures/gui/bedrock/page_forward_hover.png`,
        pageBackward: `${this.baseAssetPath}/textures/gui/bedrock/page_backward.png`,
        pageBackwardHover: `${this.baseAssetPath}/textures/gui/bedrock/page_backward_hover.png`,
      }).catch(() => {
        // Fallback gracefully if bedrock textures not found
      }),
      this.loadBlankPageImage(),
      soundManager.load(this.baseAssetPath),
    ]);

    this.fitToContainer();
    this.updateCanvasDimensions();
    this.render();
    this.startAnimLoop();
    this.setupResizeObserver();
  }

  public async applyResourcePack(pack: ResourcePackInfo | CompositeResourcePack): Promise<void> {
    if (pack.textures) {
      await this.loadTexturesFromPaths(pack.textures as BookTextures);
    }

    // Reset custom bitmap glyphs and caches so no ghost overrides persist across pack switches
    this.atlas.resetCustomGlyphs();

    const composite = pack as CompositeResourcePack;
    if (composite.fontProvidersList && composite.fontProvidersList.length > 0) {
      if (composite.fontTextures) {
        await this.atlas.loadFontTextures(composite.fontTextures);
      } else {
        this.atlas.restoreVanillaFontTextures();
      }

      // Apply layered font providers in stack order (lower first, higher overrides)
      for (const entry of composite.fontProvidersList) {
        if (entry.baseUrl) {
          await this.atlas.loadFromFontDirectory(entry.baseUrl);
        } else if (entry.providers && entry.resolver) {
          await this.atlas.loadBitmapProviders(entry.providers, entry.resolver);
        }
      }
    } else {
      if (pack.fontTextures) {
        await this.atlas.loadFontTextures(pack.fontTextures);
      } else {
        this.atlas.restoreVanillaFontTextures();
      }

      if (pack.fontBaseUrl) {
        await this.atlas.loadFromFontDirectory(pack.fontBaseUrl);
      } else if (pack.fontProviders && pack.fontTextureResolver) {
        await this.atlas.loadBitmapProviders(pack.fontProviders, pack.fontTextureResolver);
      }
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

  private async loadBedrockTextures(paths: {
    background: string;
    backgroundHc: string;
    close: string;
    closeHover: string;
    pageForward: string;
    pageForwardHover: string;
    pageBackward: string;
    pageBackwardHover: string;
  }): Promise<void> {
    const [bg, bgHc, close, closeH, fwd, fwdH, bwd, bwdH] = await Promise.all([
      this.loadImage(paths.background),
      this.loadImage(paths.backgroundHc),
      this.loadImage(paths.close),
      this.loadImage(paths.closeHover),
      this.loadImage(paths.pageForward),
      this.loadImage(paths.pageForwardHover),
      this.loadImage(paths.pageBackward),
      this.loadImage(paths.pageBackwardHover),
    ]);

    this.bedrockBg = bg;
    this.bedrockBgHc = bgHc;
    this.bedrockCloseBtn = close;
    this.bedrockCloseHoverBtn = closeH;
    this.bedrockForwardBtn = fwd;
    this.bedrockForwardHoverBtn = fwdH;
    this.bedrockBackwardBtn = bwd;
    this.bedrockBackwardHoverBtn = bwdH;
  }

  public setBook(book: BlockgameBook, preservePage = false): void {
    const savedPage = this.currentPage;
    this.book = book;
    this.recalculatePages();
    if (preservePage) {
      this.currentPage = Math.max(0, Math.min(this.paginatedPages.length - 1, savedPage));
    } else {
      this.currentPage = 0;
    }
    this.animatedChars.reset();
    this.updateAnimatedCharPresence();
    for (const plugin of this.plugins) {
      if (plugin.onBookChange) {
        plugin.onBookChange(this.book, this.paginatedPages);
      }
    }
    this.notifyPageChange();
    if (this.isScrollMode()) {
      this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
    } else {
      this.render();
    }
  }

  /** Replaces the animated characters. An empty list turns the feature off. */
  public setAnimatedChars(defs: AnimatedChar[] | null | undefined): void {
    this.animatedChars.setDefs(defs ?? []);
    this.updateAnimatedCharPresence();
    this.render();
  }

  /** Starts an animation run for `char` now. Returns false if it is not animated or not on screen. */
  public playAnimatedChar(char: string): boolean {
    if (!this.animatedCharsOnPage.has(char)) return false;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!this.animatedChars.play(char, now)) return false;
    this.render();
    return true;
  }

  public isAnimatedCharPlaying(char?: string): boolean {
    return this.animatedChars.isAnimating(char);
  }

  public hasAnimatedCharOnCurrentPage(): boolean {
    return this.animatedCharsOnPage.size > 0;
  }

  /** Recomputes which animated characters appear on the visible page(s). */
  public updateAnimatedCharPresence(): void {
    this.animatedCharsOnPage = new Set();
    if (this.animatedChars.size === 0) return;

    const pagesToCheck = [this.currentPage];
    if ((this.viewMode === 'double' || this.appearance === 'bedrock') && this.currentPage + 1 < this.paginatedPages.length) {
      pagesToCheck.push(this.currentPage + 1);
    }
    for (const pIdx of pagesToCheck) {
      for (const line of this.paginatedPages[pIdx] ?? []) {
        for (const span of line.spans) {
          for (const ch of span.text) {
            if (this.animatedChars.has(ch)) this.animatedCharsOnPage.add(ch);
          }
        }
      }
    }
  }

  /** Sets, replaces or (with null) clears the blank-page image. */
  public setBlankPageImage(image: string | BlankPageImageOptions | null | undefined): void {
    this.blankPageImage = normalizeBlankPageImage(image);
    this.blankPageImg = null;
    this.syncBlankPageOverlay();
    void this.loadBlankPageImage().then(() => this.render());
    this.render();
  }

  public getBlankPageImage(): BlankPageImageOptions | null {
    return this.blankPageImage ? { ...this.blankPageImage } : null;
  }

  private loadBlankPageImage(): Promise<void> {
    const cfg = this.blankPageImage;
    if (!cfg) {
      this.blankPageImg = null;
      return Promise.resolve();
    }
    return this.loadImage(cfg.src)
      .then((img) => {
        // Ignore the result if the image was changed while loading.
        if (this.blankPageImage?.src === cfg.src) this.blankPageImg = img;
      })
      .catch(() => {});
  }

  /** Creates, updates or removes the DOM overlay that shows the (possibly animated) image. */
  private syncBlankPageOverlay(): void {
    const cfg = this.blankPageImage;
    if (!cfg) {
      this.blankPageOverlayElement?.remove();
      this.blankPageOverlayElement = null;
      return;
    }
    if (typeof document === 'undefined') return;
    if (!this.blankPageOverlayElement) {
      const el = document.createElement('img');
      el.className = 'book-blank-page-image';
      el.style.display = 'none';
      el.style.pointerEvents = 'auto';
      // Keep clicks on the image from turning the page.
      el.addEventListener('click', (e) => e.stopPropagation());
      this.blankPageOverlayElement = el;
      this.stageElement.appendChild(el);
    }
    this.blankPageOverlayElement.src = cfg.src;
    this.blankPageOverlayElement.alt = cfg.alt ?? '';
    this.blankPageOverlayElement.title = cfg.title ?? '';
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

  public getBlankPageImagePlacement(): { x: number; y: number; w: number; h: number } | null {
    const cfg = this.blankPageImage;
    if (!cfg) return null;
    // The coordinates below describe the Java book layout in single or double view only.
    if (this.appearance === 'bedrock') return null;
    if (this.viewMode !== 'single' && this.viewMode !== 'double') return null;

    const totalPages = this.paginatedPages.length;
    if (totalPages === 0) return null;

    const w = cfg.width;
    const h = cfg.height;
    // Centre custom sizes around the default 88 x 100 slot.
    const dx = (DEFAULT_BLANK_PAGE_IMAGE_WIDTH - w) / 2;
    const y = 43 + (DEFAULT_BLANK_PAGE_IMAGE_HEIGHT - h) / 2;

    if (this.viewMode === 'single') {
      if (this.currentPage === totalPages - 1 && this.isPageBlank(this.currentPage)) {
        return { x: 49 + dx, y, w, h };
      }
      return null;
    }

    const leftIdx = this.currentPage;
    const rightIdx = this.currentPage + 1;

    // Left page is the last page and is blank
    if (leftIdx === totalPages - 1 && this.isPageBlank(leftIdx)) {
      return { x: 55 + dx, y, w, h };
    }

    // Right page is the companion blank page of an odd-length book that ends with text,
    // or is the last page and blank.
    if (rightIdx >= totalPages) {
      if (!this.isPageBlank(leftIdx)) {
        return { x: RIGHT_PAGE_X + 49 + dx, y, w, h };
      }
    } else if (rightIdx === totalPages - 1 && this.isPageBlank(rightIdx)) {
      return { x: RIGHT_PAGE_X + 49 + dx, y, w, h };
    }

    return null;
  }

  public updateBlankPageOverlay(): void {
    const overlay = this.blankPageOverlayElement;
    if (!overlay) return;

    const placement = this.getBlankPageImagePlacement();
    if (!placement) {
      overlay.style.display = 'none';
      return;
    }

    const baseDim = this.getBaseDimensions();
    const baseW = baseDim.width;
    const baseH = baseDim.height;

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

    overlay.style.display = 'block';
    overlay.style.left = `${offsetX + placement.x * scaleX}px`;
    overlay.style.top = `${offsetY + placement.y * scaleY}px`;
    overlay.style.width = `${placement.w * scaleX}px`;
    overlay.style.height = `${placement.h * scaleY}px`;
  }

  public getBaseDimensions(): { width: number; height: number } {
    if (this.appearance === 'bedrock') {
      return { width: BEDROCK_BASE_WIDTH, height: BEDROCK_BASE_HEIGHT };
    }
    return {
      width: this.viewMode === 'double' ? TWO_PAGE_WIDTH : 192,
      height: 192,
    };
  }

  public recalculatePages(): void {
    const allPages: LineLayout[][] = [];
    const textWidth = getTextWidthForEngine(this.engine);

    // Each Stendhal page (delimited by #-) corresponds strictly 1-to-1 with a reader page.
    // In Minecraft Java Edition, written book pages have a fixed 14-line capacity and never auto-split.
    for (const rawPage of this.book.pages) {
      const lines = splitTextToLines(rawPage, textWidth, this.atlas);
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

  public isScrollMode(): boolean {
    return this.viewMode === 'scroll-single' || this.viewMode === 'scroll-double';
  }

  public setViewMode(mode: ViewMode): void {
    if (this.viewMode !== mode) {
      this.viewMode = mode;
      const isScroll = mode === 'scroll-single' || mode === 'scroll-double';
      if (isScroll) {
        this.stageElement.style.display = 'none';
        this.continuousScrollView?.setViewMode(mode);
        this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
        this.continuousScrollView?.show();
        this.continuousScrollView?.scrollToPage(this.currentPage + 1, { behavior: 'auto' });
        this.notifyPageChange();
      } else {
        this.continuousScrollView?.hide();
        this.stageElement.style.display = 'inline-block';
        if (mode === 'double' && this.currentPage % 2 !== 0) {
          this.currentPage--;
        }
        this.updateAnimatedCharPresence();
        this.fitToContainer();
        this.updateCanvasDimensions();
        this.notifyPageChange();
        this.render();
      }
    }
  }

  public getContinuousScrollView(): ContinuousScrollView | undefined {
    return this.continuousScrollView;
  }

  public scrollToPage(pageNumber: number, options?: { behavior?: 'smooth' | 'auto' }): void {
    if (this.isScrollMode()) {
      this.currentPage = Math.max(0, Math.min(this.paginatedPages.length - 1, pageNumber - 1));
      this.continuousScrollView?.scrollToPage(pageNumber, options);
      this.notifyPageChange();
    } else {
      this.setPage(pageNumber - 1);
    }
  }

  public setCoverColor(color?: BlockgameDyeColor | string): void {
    this.coverColor = color;
    if (this.isScrollMode()) {
      this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
    } else {
      this.render();
    }
  }

  public getCoverColor(): BlockgameDyeColor | string | undefined {
    return this.coverColor;
  }

  public setShowBookmark(show: boolean): void {
    this.showBookmark = show;
    if (this.isScrollMode()) {
      this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
    } else {
      this.render();
    }
  }

  public isBookmarkVisible(): boolean {
    return this.showBookmark;
  }

  public setBookmarkColor(color?: string): void {
    this.bookmarkColor = color;
    if (this.isScrollMode()) {
      this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
    } else {
      this.render();
    }
  }

  public getBookmarkColor(): string | undefined {
    return this.bookmarkColor;
  }

  public getViewMode(): ViewMode {
    return this.viewMode;
  }

  public setAppearance(appearance: BookAppearance): void {
    if (this.appearance !== appearance) {
      this.appearance = appearance;
      if (appearance === 'bedrock' && this.currentPage % 2 !== 0) {
        this.currentPage--;
      }
      this.updateAnimatedCharPresence();
      this.fitToContainer();
      this.updateCanvasDimensions();
      this.notifyPageChange();
      if (this.isScrollMode()) {
        this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
      } else {
        this.render();
      }
    }
  }

  public getAppearance(): BookAppearance {
    return this.appearance;
  }

  public setEngine(engine: BookEngine): void {
    if (this.engine !== engine) {
      this.engine = engine;
      this.recalculatePages();
      this.fitToContainer();
      this.updateCanvasDimensions();
      this.notifyPageChange();
      if (this.isScrollMode()) {
        this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
      } else {
        this.render();
      }
    }
  }

  public getEngine(): BookEngine {
    return this.engine;
  }

  public setHighContrast(highContrast: boolean): void {
    if (this.highContrast !== highContrast) {
      this.highContrast = highContrast;
      if (this.isScrollMode()) {
        this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
      } else {
        this.render();
      }
    }
  }

  public isHighContrast(): boolean {
    return this.highContrast;
  }

  public setExperimental(experimental: boolean): void {
    if (this.experimental !== experimental) {
      this.experimental = experimental;
      if (this.isScrollMode()) {
        this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
      } else {
        this.render();
      }
    }
  }

  public isExperimental(): boolean {
    return this.experimental;
  }

  /** High contrast is an experimental feature: it only takes effect when both flags are set. */
  private isHighContrastActive(): boolean {
    return this.experimental && this.highContrast;
  }

  /**
   * Resolves the draw color for a span. In active high-contrast mode, text that uses the
   * default book color (#000000 or unset) is drawn with `hcColor` (white for body text,
   * yellow for indicators) so it stays readable on the dark slate. Otherwise the span's
   * own color wins and `hcColor` is only used when the span has none.
   */
  private resolveTextColor(spanColor: string | undefined, hcColor: string): string {
    if (this.isHighContrastActive() && (!spanColor || spanColor.toLowerCase() === DEFAULT_BOOK_TEXT_COLOR)) {
      return hcColor;
    }
    return spanColor || hcColor;
  }

  public setOnClose(cb?: () => void): void {
    this.onClose = cb;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public setShowPageIndicator(show: boolean): void {
    if (this.showPageIndicator !== show) {
      this.showPageIndicator = show;
      if (this.isScrollMode()) {
        this.continuousScrollView?.setBookData(this.paginatedPages, this.currentPage);
      } else {
        this.render();
      }
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

    // Allocate margin/padding and space for toolbar if directly within parent
    const hasInternalToolbar = !!(parent.querySelector && parent.querySelector('.mc-book-toolbar'));
    const toolbarOffset = hasInternalToolbar ? 48 : 0;
    const availW = Math.max(containerW - 16, 192);
    const availH = Math.max(containerH - 16 - toolbarOffset, 192);

    const baseDim = this.getBaseDimensions();
    const baseW = baseDim.width;
    const baseH = baseDim.height;

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
          this.updateBlankPageOverlay();
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
      this.animatedChars.reset();
      this.updateAnimatedCharPresence();
      soundManager.playPageTurn();
      this.notifyPageChange();
      this.render();
    }
  }

  public nextPage(): boolean {
    if (this.appearance === 'bedrock') {
      let changed = false;
      const leftIdx = this.currentPage - (this.currentPage % 2);
      if (leftIdx + 2 < this.paginatedPages.length) {
        this.currentPage = leftIdx + 2;
        changed = true;
      }
      if (changed) {
        this.highlightedLineIndex = null;
        this.animatedChars.reset();
        this.updateAnimatedCharPresence();
        soundManager.playPageTurn();
        this.notifyPageChange();
        this.render();
      }
      return changed;
    }

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
      this.animatedChars.reset();
      this.updateAnimatedCharPresence();
      soundManager.playPageTurn();
      this.notifyPageChange();
      this.render();
    }
    return changed;
  }

  public prevPage(): boolean {
    if (this.appearance === 'bedrock') {
      let changed = false;
      const leftIdx = this.currentPage - (this.currentPage % 2);
      if (leftIdx > 0) {
        this.currentPage = Math.max(0, leftIdx - 2);
        changed = true;
      }
      if (changed) {
        this.highlightedLineIndex = null;
        this.animatedChars.reset();
        this.updateAnimatedCharPresence();
        soundManager.playPageTurn();
        this.notifyPageChange();
        this.render();
      }
      return changed;
    }

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
      this.animatedChars.reset();
      this.updateAnimatedCharPresence();
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
    const baseDim = this.getBaseDimensions();
    const baseW = baseDim.width;
    const baseH = baseDim.height;

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
    this.updateBlankPageOverlay();
  }

  public render(): void {
    if (this.appearance === 'bedrock') {
      if (!this.bedrockBg && !this.bookBg) return;
    } else {
      if (!this.bookBg) return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);

    if (this.appearance === 'bedrock') {
      this.renderBedrockSpread();
      this.ctx.restore();
      this.updateTextLayer();
      this.updateBlankPageOverlay();
      return;
    }

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
      } else if (this.bookBg) {
        // Draw blank parchment background for empty right page
        const srcW = Math.round(this.bookBg.naturalWidth * 0.75);
        const srcH = Math.round(this.bookBg.naturalHeight * 0.75);
        this.ctx.drawImage(this.bookBg, 0, 0, srcW, srcH, RIGHT_PAGE_X, 0, 192, 192);
      }
    }

    if (this.coverColor) {
      this.renderCoverTint(this.ctx, isDouble ? TWO_PAGE_WIDTH : 192, 192);
    }
    if (this.showBookmark || this.bookmarkColor) {
      this.renderBookmarkRibbon(this.ctx, isDouble ? 152 : 18, 192);
    }

    // Blank-page image (drawn on the canvas so exports include it; the overlay animates GIFs)
    const imagePlacement = this.getBlankPageImagePlacement();
    if (imagePlacement && this.blankPageImg) {
      this.ctx.drawImage(
        this.blankPageImg,
        imagePlacement.x,
        imagePlacement.y,
        imagePlacement.w,
        imagePlacement.h
      );
    }

    this.ctx.restore();
    this.updateTextLayer();
    this.updateBlankPageOverlay();
  }

  /**
   * Renders an isolated single page onto a target canvas element.
   */
  public renderPageToCanvas(
    pageIndex: number,
    targetCanvas: HTMLCanvasElement,
    targetScale = this.scale,
    options?: { isMirrored?: boolean }
  ): void {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.save();
    ctx.scale(targetScale, targetScale);

    if (this.appearance === 'bedrock') {
      this.renderBedrockSpread(ctx, pageIndex - (pageIndex % 2));
      ctx.restore();
      return;
    }

    this.renderSinglePage({
      ctx,
      destX: 0,
      pageIndex,
      textStartX: 36,
      pageIndicatorRightX: 148,
      backwardButtonX: 43,
      forwardButtonX: 116,
      isMirrored: options?.isMirrored ?? false,
      allowForward: false,
      allowBackward: false,
    });

    if (this.coverColor) {
      this.renderCoverTint(ctx, 192, 192);
    }
    if (this.showBookmark || this.bookmarkColor) {
      this.renderBookmarkRibbon(ctx, 18, 192);
    }

    ctx.restore();
  }

  /**
   * Renders an authentic two-page spread onto a target canvas element.
   */
  public renderSpreadToCanvas(
    leftPageIndex: number,
    targetCanvas: HTMLCanvasElement,
    targetScale = this.scale
  ): void {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.save();
    ctx.scale(targetScale, targetScale);

    if (this.appearance === 'bedrock') {
      this.renderBedrockSpread(ctx, leftPageIndex);
    } else {
      // 1. Render Left Page (Mirrored background, binding in middle)
      this.renderSinglePage({
        ctx,
        destX: 0,
        pageIndex: leftPageIndex,
        textStartX: 42,
        pageIndicatorRightX: 150,
        backwardButtonX: 53,
        forwardButtonX: 116,
        isMirrored: true,
        allowForward: false,
        allowBackward: false,
      });

      // 2. Render Right Page (Standard background, moved closer to meet central spine)
      if (leftPageIndex + 1 < this.paginatedPages.length) {
        this.renderSinglePage({
          ctx,
          destX: RIGHT_PAGE_X,
          pageIndex: leftPageIndex + 1,
          textStartX: RIGHT_PAGE_X + 36,
          pageIndicatorRightX: RIGHT_PAGE_X + 148,
          backwardButtonX: RIGHT_PAGE_X + 53,
          forwardButtonX: RIGHT_PAGE_X + 116,
          isMirrored: false,
          allowForward: false,
          allowBackward: false,
        });
      } else if (this.bookBg) {
        const srcW = Math.round(this.bookBg.naturalWidth * 0.75);
        const srcH = Math.round(this.bookBg.naturalHeight * 0.75);
        ctx.drawImage(this.bookBg, 0, 0, srcW, srcH, RIGHT_PAGE_X, 0, 192, 192);
      }

      if (this.coverColor) {
        this.renderCoverTint(ctx, TWO_PAGE_WIDTH, 192);
      }
      if (this.showBookmark || this.bookmarkColor) {
        this.renderBookmarkRibbon(ctx, 152, 192);
      }
    }

    ctx.restore();
  }

  public renderCoverTint(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.experimental) return;
    if (!this.coverColor) return;
    const hex = BLOCKGAME_DYE_HEX[this.coverColor as BlockgameDyeColor] || this.coverColor;

    ctx.save();
    ctx.strokeStyle = hex;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.65;
    ctx.strokeRect(1.5, 1.5, width - 3, height - 3);
    ctx.restore();
  }

  public renderBookmarkRibbon(ctx: CanvasRenderingContext2D, spineX: number, bottomY = 192): void {
    if (!this.experimental) return;
    if (!this.showBookmark && !this.bookmarkColor) return;
    const ribbonColor = this.bookmarkColor
      ? (BLOCKGAME_DYE_HEX[this.bookmarkColor as BlockgameDyeColor] || this.bookmarkColor)
      : '#B02E26';

    ctx.save();
    const ribbonW = 8;
    const rx = spineX - Math.floor(ribbonW / 2);
    const topY = bottomY - 22;
    const dropH = 26;
    const endY = topY + dropH;

    ctx.fillStyle = ribbonColor;
    ctx.beginPath();
    ctx.moveTo(rx, topY);
    ctx.lineTo(rx + ribbonW, topY);
    ctx.lineTo(rx + ribbonW, endY);
    ctx.lineTo(rx + ribbonW / 2, endY - 4); // pointed ribbon tail notch
    ctx.lineTo(rx, endY);
    ctx.closePath();
    ctx.fill();

    // Subtle 1px shine on left edge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(rx, topY, 1, dropH - 4);

    // Subtle 1px shadow on right edge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(rx + ribbonW - 1, topY, 1, dropH - 4);

    ctx.restore();
  }

  /**
   * Renders the authentic Bedrock Edition two-page spread (308x192px canvas region).
   */
  private renderBedrockSpread(customCtx?: CanvasRenderingContext2D, customLeftIdx?: number): void {
    const ctx = customCtx || this.ctx;
    const isCustom = customCtx !== undefined;
    const bg = this.isHighContrastActive() ? (this.bedrockBgHc || this.bedrockBg) : (this.bedrockBg || this.bookBg);
    if (bg) {
      if (bg.naturalWidth >= 512) {
        // Crop non-transparent (102, 16, 308, 192) book region from 512x256 texture
        ctx.drawImage(
          bg,
          BEDROCK_TEX_X,
          BEDROCK_TEX_Y,
          BEDROCK_TEX_W,
          BEDROCK_TEX_H,
          0,
          0,
          BEDROCK_BASE_WIDTH,
          BEDROCK_BASE_HEIGHT
        );
      } else {
        ctx.drawImage(bg, 0, 0, BEDROCK_BASE_WIDTH, BEDROCK_BASE_HEIGHT);
      }
    }

    const totalPages = this.paginatedPages.length;
    const leftIdx = customLeftIdx !== undefined ? customLeftIdx : (this.currentPage - (this.currentPage % 2));
    const rightIdx = leftIdx + 1;

    // 1. Close 'X' Button at (285, 11, 9, 9)
    if (!isCustom) {
      const closeImg = this.hoveredButton === 'close'
        ? (this.bedrockCloseHoverBtn || this.bedrockCloseBtn)
        : this.bedrockCloseBtn;
      if (closeImg) {
        ctx.drawImage(closeImg, 285, 11, 9, 9);
      }
    }

    // 2. Navigation Turn Buttons (24x24)
    const allowBack = !isCustom && leftIdx > 0;
    const allowForward = !isCustom && leftIdx + 2 < totalPages;

    if (allowBack) {
      const bwdImg = this.hoveredButton === 'backward'
        ? (this.bedrockBackwardHoverBtn || this.bedrockBackwardBtn)
        : this.bedrockBackwardBtn;
      if (bwdImg) {
        ctx.drawImage(bwdImg, 7, 159, 24, 24);
      }
    }

    if (allowForward) {
      const fwdImg = this.hoveredButton === 'forward'
        ? (this.bedrockForwardHoverBtn || this.bedrockForwardBtn)
        : this.bedrockForwardBtn;
      if (fwdImg) {
        ctx.drawImage(fwdImg, 277, 159, 24, 24);
      }
    }

    // 3. Page Indicators in Bedrock parchment tan (#BCA387) or yellow in HC (#FFFF55), toggleable, on by default
    if (this.showPageIndicator) {
      const indicatorColor = this.isHighContrastActive() ? '#FFFF55' : '#BCA387';
      const leftIndicatorText = `${leftIdx + 1} of ${Math.max(totalPages, 1)}`;
      const leftSpans = parseFormattedText(leftIndicatorText);
      const leftIndicatorW = measureLineWidth(leftSpans, this.atlas);
      this.renderSpans(leftSpans, Math.round(82 - leftIndicatorW / 2), 13, indicatorColor, undefined, ctx);

      if (rightIdx < totalPages) {
        const rightIndicatorText = `${rightIdx + 1} of ${totalPages}`;
        const rightSpans = parseFormattedText(rightIndicatorText);
        const rightIndicatorW = measureLineWidth(rightSpans, this.atlas);
        this.renderSpans(rightSpans, Math.round(226 - rightIndicatorW / 2), 13, indicatorColor, undefined, ctx);
      }
    }

    // 4. Text Content (Left Page X = 25, Right Page X = 169)
    const defaultColor = this.isHighContrastActive() ? '#FFFFFF' : '#000000';

    // Left Page Lines
    const leftLines = this.paginatedPages[leftIdx] || [];
    for (let i = 0; i < Math.min(leftLines.length, LINES_PER_PAGE); i++) {
      const line = leftLines[i];
      const y = 33 + i * LINE_HEIGHT;
      this.renderSpans(line.spans, 25, y, defaultColor, leftIdx, ctx);
    }

    // Right Page Lines
    if (rightIdx < totalPages) {
      const rightLines = this.paginatedPages[rightIdx] || [];
      for (let i = 0; i < Math.min(rightLines.length, LINES_PER_PAGE); i++) {
        const line = rightLines[i];
        const y = 33 + i * LINE_HEIGHT;
        this.renderSpans(line.spans, 169, y, defaultColor, rightIdx, ctx);
      }
    }

    if (this.coverColor) {
      this.renderCoverTint(ctx, BEDROCK_BASE_WIDTH, BEDROCK_BASE_HEIGHT);
    }
    if (this.showBookmark || this.bookmarkColor) {
      this.renderBookmarkRibbon(ctx, 154, BEDROCK_BASE_HEIGHT);
    }
  }

  private renderSpans(
    spans: FormattedSpan[],
    startX: number,
    y: number,
    fallbackColor = '#000000',
    pageIndex?: number,
    customCtx?: CanvasRenderingContext2D
  ): void {
    const ctx = customCtx || this.ctx;
    let cursorX = startX;
    for (const span of spans) {
      const color = this.resolveTextColor(span.color, fallbackColor);
      for (let charToDraw of span.text) {
        if (span.obfuscated && charToDraw !== ' ') {
          charToDraw = this.getRandomCharFor(charToDraw, span.bold);
        }

        let glyphChar = charToDraw;
        let forceAdvance: number | null = null;
        const animatedFrame = this.animatedChars.frameFor(charToDraw);
        if (animatedFrame !== null) {
          // Keep the original glyph's advance so text never reflows while animating
          glyphChar = animatedFrame;
          forceAdvance = this.atlas.getAdvance(charToDraw, span.bold);
        }

        if (pageIndex !== undefined) {
          for (const plugin of this.plugins) {
            if (plugin.onRenderChar) {
              const res = plugin.onRenderChar(ctx, {
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
        }

        const glyphInfo = this.atlas.getGlyphDrawInfo(glyphChar, color, span.bold);
        if (glyphInfo) {
          const destW = glyphInfo.dWidth ?? glyphInfo.sWidth;
          const destH = glyphInfo.dHeight ?? glyphInfo.sHeight;
          const drawY = y + (glyphInfo.yOffset ?? 0);

          if (span.italic) {
            ctx.save();
            ctx.transform(1, 0, -0.15, 1, (drawY + destH) * 0.15, 0);
          }

          ctx.drawImage(
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
            ctx.drawImage(
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
            ctx.restore();
          }

          const adv = forceAdvance ?? glyphInfo.advance;
          if (span.strikethrough) {
            ctx.fillStyle = color;
            ctx.fillRect(cursorX, y + 4, adv, 1);
          }
          if (span.underlined) {
            ctx.fillStyle = color;
            ctx.fillRect(cursorX, y + 8, adv, 1);
          }
          cursorX += adv;
        } else {
          cursorX += forceAdvance ?? this.atlas.getAdvance(glyphChar, span.bold);
        }
      }
    }
  }

  /**
   * Renders a single book page with customizable geometry and mirroring.
   */
  private renderSinglePage(opts: {
    ctx?: CanvasRenderingContext2D;
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

    const ctx = opts.ctx || this.ctx;
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
      ctx.save();
      ctx.translate(destX + 192, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.bookBg, 0, 0, srcW, srcH, 0, 0, 192, 192);
      ctx.restore();
    } else {
      ctx.drawImage(this.bookBg, 0, 0, srcW, srcH, destX, 0, 192, 192);
    }

    const side = isMirrored ? 'left' : (destX === 0 ? 'single' : 'right');
    const pageRect: PageRect = { x: destX, y: 0, w: 192, h: 192 };
    for (const plugin of this.plugins) {
      if (plugin.onBeforeRenderPage) {
        plugin.onBeforeRenderPage(ctx, pageIndex, side, pageRect);
      }
    }

    // 2. Draw Page Indicator ("Page X of Y") - toggleable, on by default
    if (this.showPageIndicator) {
      const pageMsg = `Page ${pageIndex + 1} of ${Math.max(1, this.paginatedPages.length)}`;
      this.renderTextLineRightAligned(
        pageMsg,
        pageIndicatorRightX,
        16,
        this.isHighContrastActive() ? '#FFFF55' : '#000000',
        ctx
      );
    }

    // 3. Draw text lines (up to 14 lines, clipped strictly to book page area)
    ctx.save();
    ctx.beginPath();
    ctx.rect(textStartX - 2, 26, BOOK_TEXT_WIDTH + 8, LINES_PER_PAGE * 9 + 4);
    ctx.clip();

    const pageLines = this.paginatedPages[pageIndex] || [];
    for (let i = 0; i < Math.min(LINES_PER_PAGE, pageLines.length); i++) {
      const line = pageLines[i];
      const y = 30 + i * 9;
      let cursorX = textStartX;

      for (const span of line.spans) {
        const spanColor = this.resolveTextColor(span.color, '#FFFFFF');
        for (let charToDraw of span.text) {
          if (span.obfuscated && charToDraw !== ' ') {
            charToDraw = this.getRandomCharFor(charToDraw, span.bold);
          }

          let glyphChar = charToDraw;
          let forceAdvance: number | null = null;
          const animatedFrame = this.animatedChars.frameFor(charToDraw);
          if (animatedFrame !== null) {
            // Keep the original glyph's advance so text never reflows while animating
            glyphChar = animatedFrame;
            forceAdvance = this.atlas.getAdvance(charToDraw, span.bold);
          }

          for (const plugin of this.plugins) {
            if (plugin.onRenderChar) {
              const res = plugin.onRenderChar(ctx, {
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

          const glyphInfo = this.atlas.getGlyphDrawInfo(glyphChar, spanColor, span.bold);
          if (glyphInfo) {
            const destW = glyphInfo.dWidth ?? glyphInfo.sWidth;
            const destH = glyphInfo.dHeight ?? glyphInfo.sHeight;
            const drawY = y + (glyphInfo.yOffset ?? 0);

            if (span.italic) {
              ctx.save();
              ctx.transform(1, 0, -0.15, 1, (drawY + destH) * 0.15, 0);
            }

            ctx.drawImage(
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
              ctx.drawImage(
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
              ctx.restore();
            }

            const charAdvance = forceAdvance !== null ? forceAdvance : glyphInfo.advance;

            if (span.underlined) {
              ctx.fillStyle = spanColor;
              ctx.fillRect(cursorX - 1, y + 8, charAdvance + 1, 1);
            }

            if (span.strikethrough) {
              ctx.fillStyle = spanColor;
              ctx.fillRect(cursorX - 1, y + 4, charAdvance + 1, 1);
            }

            cursorX += charAdvance;
          } else {
            cursorX += forceAdvance !== null ? forceAdvance : this.atlas.getAdvance(glyphChar, span.bold);
          }
        }
      }
    }
    ctx.restore();

    // 3.5. Draw Debug Layout Grid (if inspector grid toggle active)
    if (this.showLayoutGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(230, 40, 40, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(textStartX + BOOK_TEXT_WIDTH, 26);
      ctx.lineTo(textStartX + BOOK_TEXT_WIDTH, 30 + LINES_PER_PAGE * 9);
      ctx.stroke();

      for (let i = 0; i < LINES_PER_PAGE; i++) {
        const lineY = 30 + i * 9;
        const isHighlighted = this.highlightedLineIndex === i;

        if (isHighlighted) {
          ctx.fillStyle = 'rgba(255, 170, 0, 0.28)';
          ctx.fillRect(textStartX - 2, lineY - 1, BOOK_TEXT_WIDTH + 4, 10);
        }

        ctx.strokeStyle = isHighlighted ? 'rgba(255, 170, 0, 0.8)' : 'rgba(120, 120, 120, 0.2)';
        ctx.setLineDash(isHighlighted ? [] : [1, 3]);
        ctx.beginPath();
        ctx.moveTo(textStartX, lineY + 8);
        ctx.lineTo(textStartX + BOOK_TEXT_WIDTH, lineY + 8);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Draw Navigation Buttons
    const canGoBack = pageIndex > 0;
    if (allowBackward && canGoBack) {
      const bwdImg = (this.hoveredButton === 'backward') ? this.pageBackwardHoverBtn : this.pageBackwardBtn;
      if (bwdImg) {
        ctx.drawImage(bwdImg, 0, 0, bwdImg.naturalWidth, bwdImg.naturalHeight, backwardButtonX, 157, 23, 13);
      }
    }

    const canGoForward = pageIndex < this.paginatedPages.length - 1;
    if (allowForward && canGoForward) {
      const fwdImg = (this.hoveredButton === 'forward') ? this.pageForwardHoverBtn : this.pageForwardBtn;
      if (fwdImg) {
        ctx.drawImage(fwdImg, 0, 0, fwdImg.naturalWidth, fwdImg.naturalHeight, forwardButtonX, 157, 23, 13);
      }
    }

    for (const plugin of this.plugins) {
      if (plugin.onAfterRenderPage) {
        plugin.onAfterRenderPage(ctx, pageIndex, side, pageRect);
      }
    }
  }

  private renderTextLineRightAligned(
    text: string,
    rightEdgeX: number,
    y: number,
    color: string,
    customCtx?: CanvasRenderingContext2D
  ): void {
    const ctx = customCtx || this.ctx;
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

        ctx.drawImage(
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
      const baseDim = this.getBaseDimensions();
      const baseW = baseDim.width;
      const baseH = baseDim.height;
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
      const baseDim = this.getBaseDimensions();
      const baseW = baseDim.width;
      const baseH = baseDim.height;
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
        if (hit === 'close') {
          soundManager.playButtonClick();
          this.onClose?.();
          return;
        } else if (hit === 'forward') {
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
      const baseDim = this.getBaseDimensions();
      const baseW = baseDim.width;
      const baseH = baseDim.height;
      const unscaledX = rect.width ? (e.clientX - rect.left) * (baseW / rect.width) : 0;
      const unscaledY = rect.height ? (e.clientY - rect.top) * (baseH / rect.height) : 0;

      // 1. Navigation buttons always take precedence (never blocked by selection)
      const hit = this.hitTestButtons(unscaledX, unscaledY);
      if (hit === 'close') {
        soundManager.playButtonClick();
        this.onClose?.();
        return;
      } else if (hit === 'forward') {
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

  public hitTestButtons(x: number, y: number): 'forward' | 'backward' | 'close' | null {
    if (this.appearance === 'bedrock') {
      // 1. Close 'X' button at (285, 11, 9, 9)
      if (x >= 283 && x <= 285 + 11 && y >= 9 && y <= 11 + 11) {
        return 'close';
      }
      // 2. Backward button at (7, 159, 24, 24)
      const leftIdx = this.currentPage - (this.currentPage % 2);
      if (leftIdx > 0 && x >= 7 && x <= 7 + 24 && y >= 159 && y <= 159 + 24) {
        return 'backward';
      }
      // 3. Forward button at (277, 159, 24, 24)
      if (leftIdx + 2 < this.paginatedPages.length && x >= 277 && x <= 277 + 24 && y >= 159 && y <= 159 + 24) {
        return 'forward';
      }
      return null;
    }

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

    if (this.appearance === 'bedrock') {
      const leftPageIndex = this.currentPage - (this.currentPage % 2);
      const rightPageIndex = leftPageIndex + 1;

      // 1. Left Page (Bedrock text start X = 25)
      const leftSection = this.buildAccessiblePageSection({
        pageIndex: leftPageIndex,
        totalPages,
        textStartX: 25,
        backwardButtonX: 7,
        forwardButtonX: null,
        allowBackward: leftPageIndex > 0,
        allowForward: false,
      });
      this.textLayerElement.appendChild(leftSection);

      // 2. Right Page (Bedrock text start X = 169)
      if (rightPageIndex < totalPages) {
        const rightSection = this.buildAccessiblePageSection({
          pageIndex: rightPageIndex,
          totalPages,
          textStartX: 169,
          backwardButtonX: null,
          forwardButtonX: 277,
          allowBackward: false,
          allowForward: leftPageIndex + 2 < totalPages,
        });
        this.textLayerElement.appendChild(rightSection);
      }
      return;
    }

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

    const baseDim = this.getBaseDimensions();
    const baseW = baseDim.width;
    const baseH = baseDim.height;
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

      // 2. Animated characters (generic easter egg)
      if (this.animatedChars.tick(now, this.animatedCharsOnPage)) {
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
    this.continuousScrollView?.destroy();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.blankPageOverlayElement?.remove();
    this.canvas.remove();
  }
}
