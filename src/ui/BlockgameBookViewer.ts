import { BlockgameBook, ViewMode, BookAppearance, BookEngine, BlockgameDyeColor } from '../engine/types';
import { BookCanvas, BookCanvasOptions } from '../render/BookCanvas';
import { soundManager } from '../render/SoundEffects';
import { ResourcePackManager } from '../engine/ResourcePackManager';
import { parseBook, parseRawTextLossless } from '../io/BookParser';
import { PageMemoryManager } from '../engine/PageMemoryManager';
import { ExportModal } from './ExportModal';
import { ImportModal } from './ImportModal';
import { ResourcePackModal } from './ResourcePackModal';
import { BookEditorModal } from './BookEditorModal';
import { BookPlugin } from '../plugin/BookPlugin';

export interface ViewerControlsOptions {
  pagination?: boolean;
  pageIndicator?: boolean;
  viewModeToggle?: boolean;
  soundToggle?: boolean;
  zoomControls?: boolean;
  editButton?: boolean;
  exportButton?: boolean;
  exportPageButton?: boolean;
  importButton?: boolean;
  resourcePackButton?: boolean;
}

export interface BlockgameBookViewerOptions {
  book?: BlockgameBook | string;
  bookUrl?: string;
  baseAssetPath?: string;
  defaultViewMode?: ViewMode;
  appearance?: BookAppearance;
  engine?: BookEngine;
  highContrast?: boolean;
  coverColor?: BlockgameDyeColor | string;
  showBookmark?: boolean;
  bookmarkColor?: string;
  onClose?: () => void;
  theme?: 'dark' | 'light' | 'parchment' | 'minimal' | 'transparent' | 'high-contrast';
  controls?: boolean | ViewerControlsOptions;
  scale?: number;
  plugins?: BookPlugin[];
  includeWitchcraftPlugin?: boolean;
  persistReadingProgress?: boolean;
  onPageChange?: (page: number, total: number) => void;
  onBookChange?: (book: BlockgameBook, viewer?: BlockgameBookViewer) => void;
}

/** @deprecated Use BlockgameBookViewerOptions instead */
export type MinecraftBookViewerOptions = BlockgameBookViewerOptions;

export class BlockgameBookViewer {
  private container: HTMLElement;
  private canvasWrapper!: HTMLElement;
  private toolbarElement?: HTMLElement;
  private bookCanvas!: BookCanvas;
  private packManager: ResourcePackManager;
  private pageMemory: PageMemoryManager;
  private options: BlockgameBookViewerOptions;
  private currentBook: BlockgameBook = { title: '', author: '', pages: [''] };

  private exportModal?: ExportModal;
  private importModal?: ImportModal;
  private packModal?: ResourcePackModal;
  private editorModal?: BookEditorModal;

  private pageIndicatorEl?: HTMLElement;
  private soundBtn?: HTMLButtonElement;
  private viewModeBtn?: HTMLButtonElement;

  constructor(container: HTMLElement, options: BlockgameBookViewerOptions = {}) {
    this.container = container;
    this.options = options;
    const baseAssetPath = options.baseAssetPath || './assets';
    this.packManager = new ResourcePackManager(baseAssetPath);
    this.pageMemory = new PageMemoryManager({ enabled: options.persistReadingProgress ?? false });

    const containerW = container.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    const isNarrow = containerW < 680;
    const defaultMode = this.options.defaultViewMode || (isNarrow ? 'single' : 'double');

    // Setup wrapper layout
    this.buildDOM();

    // Init BookCanvas
    const canvasOptions: BookCanvasOptions = {
      container: this.canvasWrapper,
      baseAssetPath,
      defaultViewMode: defaultMode,
      appearance: this.options.appearance,
      engine: this.options.engine,
      highContrast: this.options.highContrast,
      coverColor: this.options.coverColor,
      showBookmark: this.options.showBookmark,
      bookmarkColor: this.options.bookmarkColor,
      onClose: this.options.onClose,
      plugins: this.options.plugins,
      includeWitchcraftPlugin: this.options.includeWitchcraftPlugin ?? false,
      onProgressSave: (page) => {
        if (this.pageMemory.isEnabled()) {
          this.pageMemory.save(this.currentBook, page);
        }
      },
      onPageChange: (page, total) => {
        this.updatePageIndicator(page, total);
        if (this.pageMemory.isEnabled()) {
          this.pageMemory.save(this.currentBook, page);
        }
        if (this.options.onPageChange) {
          this.options.onPageChange(page, total);
        }
      },
    };

    this.bookCanvas = new BookCanvas(canvasOptions);
    if (this.options.scale) {
      this.bookCanvas.setScale(this.options.scale);
    }

    if (this.options.book) {
      if (typeof this.options.book === 'string') {
        const parsed = parseBook(this.options.book);
        if (parsed) this.setBook(parsed);
      } else {
        this.setBook(this.options.book);
      }
    }

    this.setupListeners();
  }

  public async init(): Promise<void> {
    await this.bookCanvas.init();

    // Initialize modals
    this.exportModal = new ExportModal(() => this.bookCanvas.getCanvasDataUrl());
    this.importModal = new ImportModal((book) => this.setBook(book));
    this.packModal = new ResourcePackModal(this.packManager, async (pack) => {
      await this.bookCanvas.applyResourcePack(pack);
    });
    this.editorModal = new BookEditorModal((book) => this.setBook(book));

    this.container.appendChild(this.exportModal.getElement());
    this.container.appendChild(this.importModal.getElement());
    this.container.appendChild(this.packModal.getElement());
    this.container.appendChild(this.editorModal.getElement());

    // Load initial book URL if provided
    if (this.options.bookUrl) {
      try {
        await this.loadFromUrl(this.options.bookUrl);
      } catch (err) {
        console.error('Failed to load initial bookUrl:', err);
      }
    }
  }

  private buildDOM(): void {
    const theme = this.options.theme || 'dark';
    this.container.classList.add('mc-book-viewer-root', `mc-theme-${theme}`);
    if (this.options.highContrast) {
      this.container.classList.add('mc-theme-high-contrast');
    }

    // Create Canvas wrapper
    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.className = 'mc-book-canvas-wrapper';
    this.container.appendChild(this.canvasWrapper);

    // Build Toolbar if enabled
    const controls = this.options.controls;
    const showControls = controls !== false;
    if (showControls) {
      const ctrlOpts: ViewerControlsOptions = typeof controls === 'object' ? controls : {};
      const showPagination = ctrlOpts.pagination !== false;
      const showPageIndicator = ctrlOpts.pageIndicator !== false;
      const showViewMode = ctrlOpts.viewModeToggle !== false;
      const showSound = ctrlOpts.soundToggle !== false;
      const showZoom = ctrlOpts.zoomControls !== false;
      const showEdit = ctrlOpts.editButton !== false;
      const showExport = ctrlOpts.exportButton !== false;
      const showExportPage = ctrlOpts.exportPageButton === true;
      const showImport = ctrlOpts.importButton !== false;
      const showPacks = ctrlOpts.resourcePackButton !== false;

      const toolbar = document.createElement('div');
      toolbar.className = 'mc-book-toolbar';
      toolbar.innerHTML = `
        <div class="mc-toolbar-group mc-toolbar-left">
          ${showPagination ? `<button class="mc-btn mc-btn-prev" title="Previous page">◀</button>` : ''}
          ${showPageIndicator ? `<span class="mc-page-indicator">1 / 1</span>` : ''}
          ${showPagination ? `<button class="mc-btn mc-btn-next" title="Next page">▶</button>` : ''}
        </div>
        <div class="mc-toolbar-group mc-toolbar-right">
          ${showViewMode ? `<button class="mc-btn mc-btn-mode" title="Toggle Single/Double page">📖</button>` : ''}
          ${showSound ? `<button class="mc-btn mc-btn-sound" title="Toggle Sound">🔊</button>` : ''}
          ${showZoom ? `
            <button class="mc-btn mc-btn-zoom-out" title="Zoom out">-</button>
            <button class="mc-btn mc-btn-zoom-in" title="Zoom in">+</button>
          ` : ''}
          ${showPacks ? `<button class="mc-btn mc-btn-packs" title="Resource Packs">🎨</button>` : ''}
          ${showEdit ? `<button class="mc-btn mc-btn-edit" title="Edit Book (Markup)">✏️</button>` : ''}
          ${showImport ? `<button class="mc-btn mc-btn-import" title="Open Book">📂</button>` : ''}
          ${showExportPage ? `<button class="mc-btn mc-btn-export-page" title="Export Current Page">📷</button>` : ''}
          ${showExport ? `<button class="mc-btn mc-btn-export" title="Export Book">💾</button>` : ''}
        </div>
      `;
      this.container.appendChild(toolbar);
      this.toolbarElement = toolbar;

      this.pageIndicatorEl = toolbar.querySelector('.mc-page-indicator') as HTMLElement;
      this.soundBtn = toolbar.querySelector('.mc-btn-sound') as HTMLButtonElement;
      this.viewModeBtn = toolbar.querySelector('.mc-btn-mode') as HTMLButtonElement;
    }
  }

  private setupListeners(): void {
    if (!this.toolbarElement) return;

    this.toolbarElement.querySelector('.mc-btn-prev')?.addEventListener('click', () => {
      this.bookCanvas.prevPage();
    });

    this.toolbarElement.querySelector('.mc-btn-next')?.addEventListener('click', () => {
      this.bookCanvas.nextPage();
    });

    this.viewModeBtn?.addEventListener('click', () => {
      const current = this.bookCanvas.getViewMode();
      const nextMode: ViewMode =
        current === 'single' ? 'double' :
        current === 'double' ? 'scroll-single' :
        current === 'scroll-single' ? 'scroll-double' : 'single';
      this.setViewMode(nextMode);
    });

    this.soundBtn?.addEventListener('click', () => {
      const active = soundManager.toggle();
      if (this.soundBtn) {
        this.soundBtn.textContent = active ? '🔊' : '🔇';
      }
    });

    this.toolbarElement.querySelector('.mc-btn-zoom-in')?.addEventListener('click', () => {
      const currentScale = this.bookCanvas.getScale();
      const maxFitting = this.bookCanvas.getMaxFittingScale();
      if (currentScale < maxFitting) {
        this.bookCanvas.setScale(currentScale + 1);
        this.updateZoomButtons();
      }
    });

    this.toolbarElement.querySelector('.mc-btn-zoom-out')?.addEventListener('click', () => {
      const currentScale = this.bookCanvas.getScale();
      if (currentScale > 1) {
        this.bookCanvas.setScale(currentScale - 1);
        this.updateZoomButtons();
      }
    });

    this.updateZoomButtons();

    this.toolbarElement.querySelector('.mc-btn-export')?.addEventListener('click', () => {
      this.exportModal?.open(this.currentBook);
    });

    this.toolbarElement.querySelector('.mc-btn-export-page')?.addEventListener('click', () => {
      this.exportCurrentPage();
    });

    this.toolbarElement.querySelector('.mc-btn-import')?.addEventListener('click', () => {
      this.importModal?.open();
    });

    this.toolbarElement.querySelector('.mc-btn-packs')?.addEventListener('click', () => {
      this.packModal?.open();
    });

    this.toolbarElement.querySelector('.mc-btn-edit')?.addEventListener('click', () => {
      this.openEditor();
    });
  }

  private updateZoomButtons(): void {
    if (!this.toolbarElement) return;
    const currentScale = this.bookCanvas.getScale();
    const maxFitting = this.bookCanvas.getMaxFittingScale();
    const zoomInBtn = this.toolbarElement.querySelector('.mc-btn-zoom-in') as HTMLButtonElement | null;
    const zoomOutBtn = this.toolbarElement.querySelector('.mc-btn-zoom-out') as HTMLButtonElement | null;
    if (zoomInBtn) {
      const atMax = currentScale >= maxFitting;
      zoomInBtn.disabled = atMax;
      zoomInBtn.style.opacity = atMax ? '0.45' : '1';
      zoomInBtn.style.cursor = atMax ? 'not-allowed' : 'pointer';
    }
    if (zoomOutBtn) {
      const atMin = currentScale <= 1;
      zoomOutBtn.disabled = atMin;
      zoomOutBtn.style.opacity = atMin ? '0.45' : '1';
      zoomOutBtn.style.cursor = atMin ? 'not-allowed' : 'pointer';
    }
  }

  public openEditor(): void {
    this.editorModal?.open(this.currentBook);
  }

  public setBook(book: BlockgameBook, preservePage = false): void {
    this.currentBook = book;
    this.bookCanvas.setBook(book, preservePage);
    if (!preservePage && this.pageMemory.isEnabled()) {
      const savedPage = this.pageMemory.load(book);
      if (savedPage !== null && savedPage > 0) {
        if (this.bookCanvas.isScrollMode()) {
          this.bookCanvas.scrollToPage(savedPage + 1, { behavior: 'auto' });
        } else {
          this.bookCanvas.setPage(savedPage);
        }
      }
    }
    this.updatePageIndicator(this.bookCanvas.getCurrentPage(), this.bookCanvas.getTotalPages());
    this.updateZoomButtons();
    if (this.options.onBookChange) {
      this.options.onBookChange(book, this);
    }
  }

  public scrollToPage(pageNumber: number, options?: { behavior?: 'smooth' | 'auto' }): void {
    this.bookCanvas.scrollToPage(pageNumber, options);
  }

  public setViewMode(mode: ViewMode): void {
    this.bookCanvas.setViewMode(mode);
    this.updateZoomButtons();
  }

  public getViewMode(): ViewMode {
    return this.bookCanvas.getViewMode();
  }

  public setCoverColor(color?: BlockgameDyeColor | string): void {
    this.bookCanvas.setCoverColor(color);
  }

  public getCoverColor(): BlockgameDyeColor | string | undefined {
    return this.bookCanvas.getCoverColor();
  }

  public setShowBookmark(show: boolean): void {
    this.bookCanvas.setShowBookmark(show);
  }

  public isBookmarkVisible(): boolean {
    return this.bookCanvas.isBookmarkVisible();
  }

  public setBookmarkColor(color?: string): void {
    this.bookCanvas.setBookmarkColor(color);
  }

  public getBookmarkColor(): string | undefined {
    return this.bookCanvas.getBookmarkColor();
  }

  public setText(text: string, title = 'Imported Text', author = 'Author'): void {
    const book = parseRawTextLossless(text, title, author, this.options.engine);
    this.setBook(book);
  }

  public setPersistReadingProgress(enabled: boolean): void {
    this.pageMemory.setEnabled(enabled);
  }

  public clearReadingProgress(): void {
    this.pageMemory.clear(this.currentBook);
  }

  public getPageMemoryManager(): PageMemoryManager {
    return this.pageMemory;
  }

  public async loadFromUrl(url: string): Promise<void> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const text = await resp.text();
      const book = parseBook(text);
      if (book) {
        this.setBook(book);
      }
    } catch (err) {
      console.error(`Failed to load book from ${url}:`, err);
      throw err;
    }
  }

  public nextPage(): boolean {
    return this.bookCanvas.nextPage();
  }

  public prevPage(): boolean {
    return this.bookCanvas.prevPage();
  }

  public setPage(pageIndex: number): void {
    this.bookCanvas.setPage(pageIndex);
  }

  public getCurrentPage(): number {
    return this.bookCanvas.getCurrentPage();
  }

  public getTotalPages(): number {
    return this.bookCanvas.getTotalPages();
  }

  public getPageDataUrl(pageIndex?: number): string {
    return this.bookCanvas.getPageDataUrl(pageIndex);
  }

  public async getPageBlob(pageIndex?: number): Promise<Blob> {
    return this.bookCanvas.getPageBlob(pageIndex);
  }

  public async exportCurrentPage(options?: { filename?: string; pageIndex?: number }): Promise<void> {
    const page = options?.pageIndex ?? this.getCurrentPage();
    const title = (this.currentBook.title || 'book').replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
    const filename = options?.filename || `${title}-page-${page + 1}.png`;

    try {
      const blob = await this.getPageBlob(page);
      if (typeof File !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && typeof navigator.share === 'function') {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: this.currentBook.title || 'Blockgame Book',
            text: `Page ${page + 1} of ${this.currentBook.title || 'Blockgame Book'}`,
          });
          return;
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }

    // Fallback: trigger direct PNG download
    const dataUrl = this.getPageDataUrl(page);
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body?.appendChild(a);
      a.click();
      a.remove();
    }
  }

  public getBook(): BlockgameBook {
    return this.currentBook;
  }

  public getCanvas(): BookCanvas {
    return this.bookCanvas;
  }

  public getResourcePackManager(): ResourcePackManager {
    return this.packManager;
  }

  public setAppearance(appearance: BookAppearance): void {
    this.bookCanvas.setAppearance(appearance);
    this.updatePageIndicator(this.bookCanvas.getCurrentPage(), this.bookCanvas.getTotalPages());
  }

  public getAppearance(): BookAppearance {
    return this.bookCanvas.getAppearance();
  }

  public setEngine(engine: BookEngine): void {
    this.bookCanvas.setEngine(engine);
    this.updatePageIndicator(this.bookCanvas.getCurrentPage(), this.bookCanvas.getTotalPages());
  }

  public getEngine(): BookEngine {
    return this.bookCanvas.getEngine();
  }

  public setHighContrast(highContrast: boolean): void {
    this.bookCanvas.setHighContrast(highContrast);
    if (highContrast) {
      this.container.classList.add('mc-theme-high-contrast');
    } else {
      this.container.classList.remove('mc-theme-high-contrast');
    }
  }

  public isHighContrast(): boolean {
    return this.bookCanvas.isHighContrast();
  }

  public setOnClose(cb?: () => void): void {
    this.bookCanvas.setOnClose(cb);
  }

  private updatePageIndicator(page: number, total: number): void {
    if (!this.pageIndicatorEl) return;
    const isDoubleSpread = this.bookCanvas.getViewMode() === 'double' || this.bookCanvas.getAppearance() === 'bedrock';
    if (isDoubleSpread && page + 1 < total && page % 2 === 0) {
      this.pageIndicatorEl.textContent = `${page + 1}-${page + 2} / ${total}`;
    } else {
      this.pageIndicatorEl.textContent = `${page + 1} / ${total}`;
    }
  }

  public setTheme(theme: 'dark' | 'light' | 'parchment' | 'minimal' | 'transparent' | 'high-contrast'): void {
    const oldTheme = this.options.theme || 'dark';
    this.container.classList.remove(`mc-theme-${oldTheme}`);
    this.options.theme = theme;
    this.container.classList.add(`mc-theme-${theme}`);
    if (theme === 'high-contrast') {
      this.setHighContrast(true);
    } else if (oldTheme === 'high-contrast') {
      this.setHighContrast(false);
    }
  }

  public setControlsVisible(visible: boolean): void {
    if (this.toolbarElement) {
      this.toolbarElement.style.display = visible ? '' : 'none';
    }
  }

  public isControlsVisible(): boolean {
    return this.toolbarElement ? this.toolbarElement.style.display !== 'none' : false;
  }

  public destroy(): void {
    this.bookCanvas?.destroy();
    const removeEl = (el?: HTMLElement | null) => {
      if (!el) return;
      if (typeof el.remove === 'function') {
        el.remove();
      } else if (el.parentNode && typeof el.parentNode.removeChild === 'function') {
        el.parentNode.removeChild(el);
      }
    };
    removeEl(this.canvasWrapper);
    removeEl(this.toolbarElement);
    removeEl(this.exportModal?.getElement());
    removeEl(this.importModal?.getElement());
    removeEl(this.packModal?.getElement());
    removeEl(this.editorModal?.getElement());
    if (this.options.theme && this.container.classList) {
      this.container.classList.remove('mc-book-viewer-root', `mc-theme-${this.options.theme}`);
    }
  }
}

/** @deprecated Use BlockgameBookViewer instead */
export const MinecraftBookViewer = BlockgameBookViewer;
