import { MinecraftBook, ViewMode } from '../engine/types';
import { BookCanvas, BookCanvasOptions } from '../render/BookCanvas';
import { soundManager } from '../render/SoundEffects';
import { ResourcePackManager } from '../engine/ResourcePackManager';
import { parseBook } from '../io/BookParser';
import { ExportModal } from './ExportModal';
import { ImportModal } from './ImportModal';
import { ResourcePackModal } from './ResourcePackModal';
import { BookPlugin } from '../plugin/BookPlugin';

export interface ViewerControlsOptions {
  pagination?: boolean;
  pageIndicator?: boolean;
  viewModeToggle?: boolean;
  soundToggle?: boolean;
  zoomControls?: boolean;
  exportButton?: boolean;
  importButton?: boolean;
  resourcePackButton?: boolean;
}

export interface MinecraftBookViewerOptions {
  book?: MinecraftBook | string;
  bookUrl?: string;
  baseAssetPath?: string;
  defaultViewMode?: ViewMode;
  theme?: 'dark' | 'light' | 'parchment' | 'minimal' | 'transparent';
  controls?: boolean | ViewerControlsOptions;
  scale?: number;
  plugins?: BookPlugin[];
  includeWitchcraftPlugin?: boolean;
  onPageChange?: (page: number, total: number) => void;
  onBookChange?: (book: MinecraftBook) => void;
}

export class MinecraftBookViewer {
  private container: HTMLElement;
  private canvasWrapper!: HTMLElement;
  private toolbarElement?: HTMLElement;
  private bookCanvas!: BookCanvas;
  private packManager: ResourcePackManager;
  private options: MinecraftBookViewerOptions;
  private currentBook: MinecraftBook = { title: '', author: '', pages: [''] };

  private exportModal?: ExportModal;
  private importModal?: ImportModal;
  private packModal?: ResourcePackModal;

  private pageIndicatorEl?: HTMLElement;
  private soundBtn?: HTMLButtonElement;
  private viewModeBtn?: HTMLButtonElement;

  constructor(container: HTMLElement, options: MinecraftBookViewerOptions = {}) {
    this.container = container;
    this.options = options;
    const baseAssetPath = options.baseAssetPath || './assets';
    this.packManager = new ResourcePackManager(baseAssetPath);

    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 680;
    const defaultMode = this.options.defaultViewMode || (isNarrow ? 'single' : 'double');

    // Setup wrapper layout
    this.buildDOM();

    // Init BookCanvas
    const canvasOptions: BookCanvasOptions = {
      container: this.canvasWrapper,
      baseAssetPath,
      defaultViewMode: defaultMode,
      plugins: this.options.plugins,
      includeWitchcraftPlugin: this.options.includeWitchcraftPlugin ?? false,
      onPageChange: (page, total) => {
        this.updatePageIndicator(page, total);
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

    this.container.appendChild(this.exportModal.getElement());
    this.container.appendChild(this.importModal.getElement());
    this.container.appendChild(this.packModal.getElement());

    // Load initial book URL if provided
    if (this.options.bookUrl) {
      await this.loadFromUrl(this.options.bookUrl);
    }
  }

  private buildDOM(): void {
    const theme = this.options.theme || 'dark';
    this.container.classList.add('mc-book-viewer-root', `mc-theme-${theme}`);

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
      const showExport = ctrlOpts.exportButton !== false;
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
          ${showImport ? `<button class="mc-btn mc-btn-import" title="Open Book">📂</button>` : ''}
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
      this.bookCanvas.setViewMode(current === 'double' ? 'single' : 'double');
    });

    this.soundBtn?.addEventListener('click', () => {
      const active = soundManager.toggle();
      if (this.soundBtn) {
        this.soundBtn.textContent = active ? '🔊' : '🔇';
      }
    });

    this.toolbarElement.querySelector('.mc-btn-zoom-in')?.addEventListener('click', () => {
      this.bookCanvas.setScale(this.bookCanvas.getScale() + 1);
    });

    this.toolbarElement.querySelector('.mc-btn-zoom-out')?.addEventListener('click', () => {
      this.bookCanvas.setScale(this.bookCanvas.getScale() - 1);
    });

    this.toolbarElement.querySelector('.mc-btn-export')?.addEventListener('click', () => {
      this.exportModal?.open(this.currentBook);
    });

    this.toolbarElement.querySelector('.mc-btn-import')?.addEventListener('click', () => {
      this.importModal?.open();
    });

    this.toolbarElement.querySelector('.mc-btn-packs')?.addEventListener('click', () => {
      this.packModal?.open();
    });
  }

  public setBook(book: MinecraftBook): void {
    this.currentBook = book;
    this.bookCanvas.setBook(book);
    this.updatePageIndicator(this.bookCanvas.getCurrentPage(), this.bookCanvas.getTotalPages());
    if (this.options.onBookChange) {
      this.options.onBookChange(book);
    }
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

  public getBook(): MinecraftBook {
    return this.currentBook;
  }

  public getCanvas(): BookCanvas {
    return this.bookCanvas;
  }

  public getResourcePackManager(): ResourcePackManager {
    return this.packManager;
  }

  private updatePageIndicator(page: number, total: number): void {
    if (!this.pageIndicatorEl) return;
    const isDouble = this.bookCanvas.getViewMode() === 'double';
    if (isDouble && page + 1 < total && page % 2 === 0) {
      this.pageIndicatorEl.textContent = `${page + 1}-${page + 2} / ${total}`;
    } else {
      this.pageIndicatorEl.textContent = `${page + 1} / ${total}`;
    }
  }

  public destroy(): void {
    this.bookCanvas?.destroy();
    this.container.innerHTML = '';
  }
}
