import { MinecraftBook, ViewMode, BookAppearance, BookEngine } from '../engine/types';
import { MinecraftBookViewer } from '../ui/MinecraftBookViewer';
import { parseBook } from '../io/BookParser';

const BaseElement: typeof HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as any);

export class MinecraftBookElement extends BaseElement {
  private viewer: MinecraftBookViewer | null = null;
  private isInitialized = false;

  static get observedAttributes() {
    return [
      'src',
      'text',
      'book-title',
      'author',
      'split-mode',
      'persist-progress',
      'view-mode',
      'scale',
      'sound',
      'controls',
      'theme',
      'page',
      'base-path',
      'appearance',
      'engine',
      'high-contrast',
      'cover-color',
      'bookmark',
      'bookmark-color',
    ];
  }

  constructor() {
    super();
  }

  async connectedCallback() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const basePath = this.getAttribute('base-path') || './assets';
    const viewMode = (this.getAttribute('view-mode') || 'auto') as ViewMode | 'auto';
    const scaleAttr = this.getAttribute('scale');
    const scale = scaleAttr ? parseInt(scaleAttr, 10) : undefined;
    const showControls = this.getAttribute('controls') !== 'false';
    const theme = (this.getAttribute('theme') || 'dark') as any;
    const appearance = (this.getAttribute('appearance') || 'java') as BookAppearance;
    const engine = (this.getAttribute('engine') || 'java') as BookEngine;
    const highContrast = this.hasAttribute('high-contrast') && this.getAttribute('high-contrast') !== 'false';
    const coverColor = this.getAttribute('cover-color') || undefined;
    const showBookmark = this.hasAttribute('bookmark') && this.getAttribute('bookmark') !== 'false';
    const bookmarkColor = this.getAttribute('bookmark-color') || undefined;
    const persistProgress = this.hasAttribute('persist-progress') && this.getAttribute('persist-progress') !== 'false';
    const splitMode = this.getAttribute('split-mode') || 'lossless';
    const bookTitle = this.getAttribute('book-title') || undefined;
    const author = this.getAttribute('author') || undefined;

    let initialMode: ViewMode = 'double';
    if (viewMode === 'single' || viewMode === 'double' || viewMode === 'scroll-single' || viewMode === 'scroll-double') {
      initialMode = viewMode;
    } else {
      const containerW = this.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024);
      initialMode = containerW < 680 ? 'single' : 'double';
    }

    this.viewer = new MinecraftBookViewer(this, {
      baseAssetPath: basePath,
      defaultViewMode: initialMode,
      appearance,
      engine,
      highContrast,
      coverColor,
      showBookmark,
      bookmarkColor,
      persistReadingProgress: persistProgress,
      scale,
      controls: showControls,
      theme,
      onClose: () => {
        if (typeof this.dispatchEvent === 'function') {
          this.dispatchEvent(new CustomEvent('close'));
        }
      },
      onPageChange: (page, total) => {
        if (typeof this.dispatchEvent === 'function') {
          this.dispatchEvent(new CustomEvent('pagechange', { detail: { page: page + 1, total } }));
        }
      },
      onBookChange: (book) => {
        if (typeof this.dispatchEvent === 'function') {
          this.dispatchEvent(new CustomEvent('bookload', { detail: { book } }));
        }
      },
    });

    await this.viewer.init();

    // Check for direct text attribute, inline content in <script> or <pre>, or src
    if (typeof this.hasAttribute === 'function' && this.hasAttribute('text')) {
      const rawText = this.getAttribute('text') || '';
      const parsed = parseBook(rawText, { engine, splitContinuous: splitMode === 'lossless' });
      if (bookTitle) parsed.title = bookTitle;
      if (author) parsed.author = author;
      this.viewer.setBook(parsed);
    } else {
      const scriptEl = this.querySelector ? this.querySelector('script[type="text/plain"], pre') : null;
      if (scriptEl && scriptEl.textContent) {
        const content = scriptEl.textContent.trim();
        const parsed = parseBook(content, { engine, splitContinuous: splitMode === 'lossless' });
        if (bookTitle) parsed.title = bookTitle;
        if (author) parsed.author = author;
        this.viewer.setBook(parsed);
      } else if (typeof this.hasAttribute === 'function' && this.hasAttribute('src')) {
        const src = this.getAttribute('src');
        if (src) {
          await this.viewer.loadFromUrl(src);
        }
      }
    }

    if (this.hasAttribute('page')) {
      const p = parseInt(this.getAttribute('page') || '1', 10);
      this.viewer.setPage(p - 1);
    }
  }

  disconnectedCallback() {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
      this.isInitialized = false;
    }
  }

  async attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (!this.isInitialized || oldValue === newValue || !this.viewer) return;

    if (name === 'src' && newValue) {
      await this.viewer.loadFromUrl(newValue);
    } else if (name === 'text' && newValue !== null) {
      const splitMode = this.getAttribute('split-mode') || 'lossless';
      if (splitMode === 'lossless') {
        this.viewer.setText(newValue, this.getAttribute('book-title') || undefined, this.getAttribute('author') || undefined);
      } else {
        this.viewer.setBook(parseBook(newValue));
      }
    } else if (name === 'persist-progress') {
      this.viewer.setPersistReadingProgress(newValue !== null && newValue !== 'false');
    } else if (name === 'page' && newValue) {
      this.viewer.setPage(parseInt(newValue, 10) - 1);
    } else if (name === 'view-mode' && (newValue === 'single' || newValue === 'double' || newValue === 'scroll-single' || newValue === 'scroll-double')) {
      this.viewer.setViewMode(newValue as ViewMode);
    } else if (name === 'cover-color') {
      this.viewer.setCoverColor(newValue || undefined);
    } else if (name === 'bookmark') {
      this.viewer.setShowBookmark(newValue !== null && newValue !== 'false');
    } else if (name === 'bookmark-color') {
      this.viewer.setBookmarkColor(newValue || undefined);
    } else if (name === 'appearance' && (newValue === 'java' || newValue === 'bedrock')) {
      this.viewer.setAppearance(newValue as BookAppearance);
    } else if (name === 'engine' && (newValue === 'java' || newValue === 'bedrock')) {
      this.viewer.setEngine(newValue as BookEngine);
    } else if (name === 'high-contrast') {
      this.viewer.setHighContrast(newValue !== null && newValue !== 'false');
    } else if (name === 'scale' && newValue) {
      this.viewer.getCanvas().setScale(parseInt(newValue, 10));
    }
  }

  get appearance(): BookAppearance {
    return this.viewer ? this.viewer.getAppearance() : ((this.getAttribute('appearance') || 'java') as BookAppearance);
  }

  set appearance(val: BookAppearance) {
    this.setAttribute('appearance', val);
    if (this.viewer) this.viewer.setAppearance(val);
  }

  get engine(): BookEngine {
    return this.viewer ? this.viewer.getEngine() : ((this.getAttribute('engine') || 'java') as BookEngine);
  }

  set engine(val: BookEngine) {
    this.setAttribute('engine', val);
    if (this.viewer) this.viewer.setEngine(val);
  }

  get highContrast(): boolean {
    return this.viewer ? this.viewer.isHighContrast() : this.hasAttribute('high-contrast');
  }

  set highContrast(val: boolean) {
    if (val) {
      this.setAttribute('high-contrast', '');
    } else {
      this.removeAttribute('high-contrast');
    }
    if (this.viewer) this.viewer.setHighContrast(val);
  }

  get persistProgress(): boolean {
    return this.viewer
      ? this.viewer.getPageMemoryManager().isEnabled()
      : typeof this.hasAttribute === 'function' && this.hasAttribute('persist-progress');
  }

  set persistProgress(val: boolean) {
    if (typeof this.setAttribute === 'function' && typeof this.removeAttribute === 'function') {
      if (val) {
        this.setAttribute('persist-progress', '');
      } else {
        this.removeAttribute('persist-progress');
      }
    }
    if (this.viewer) this.viewer.setPersistReadingProgress(val);
  }

  public setText(text: string, title?: string, author?: string): void {
    if (!this.viewer) return;
    this.viewer.setText(text, title, author);
  }

  public resetProgress(): void {
    if (this.viewer) {
      this.viewer.clearReadingProgress();
    }
  }

  public setBook(book: MinecraftBook | string): void {
    if (!this.viewer) return;
    if (typeof book === 'string') {
      const parsed = parseBook(book);
      if (parsed) this.viewer.setBook(parsed);
    } else {
      this.viewer.setBook(book);
    }
  }

  public nextPage(): boolean {
    return this.viewer ? this.viewer.nextPage() : false;
  }

  public prevPage(): boolean {
    return this.viewer ? this.viewer.prevPage() : false;
  }

  get viewMode(): ViewMode {
    return this.viewer ? this.viewer.getViewMode() : ((this.getAttribute('view-mode') || 'double') as ViewMode);
  }

  set viewMode(val: ViewMode) {
    this.setAttribute('view-mode', val);
    if (this.viewer) this.viewer.setViewMode(val);
  }

  get coverColor(): string | undefined {
    return this.viewer ? this.viewer.getCoverColor() : (this.getAttribute('cover-color') || undefined);
  }

  set coverColor(val: string | undefined) {
    if (val) {
      this.setAttribute('cover-color', val);
    } else {
      this.removeAttribute('cover-color');
    }
    if (this.viewer) this.viewer.setCoverColor(val);
  }

  get bookmark(): boolean {
    return this.viewer ? this.viewer.isBookmarkVisible() : this.hasAttribute('bookmark');
  }

  set bookmark(val: boolean) {
    if (val) {
      this.setAttribute('bookmark', '');
    } else {
      this.removeAttribute('bookmark');
    }
    if (this.viewer) this.viewer.setShowBookmark(val);
  }

  get bookmarkColor(): string | undefined {
    return this.viewer ? this.viewer.getBookmarkColor() : (this.getAttribute('bookmark-color') || undefined);
  }

  set bookmarkColor(val: string | undefined) {
    if (val) {
      this.setAttribute('bookmark-color', val);
    } else {
      this.removeAttribute('bookmark-color');
    }
    if (this.viewer) this.viewer.setBookmarkColor(val);
  }

  public setViewMode(mode: ViewMode): void {
    if (this.viewer) {
      this.viewer.setViewMode(mode);
    }
  }

  public getViewMode(): ViewMode {
    return this.viewer ? this.viewer.getViewMode() : ((this.getAttribute('view-mode') || 'double') as ViewMode);
  }

  public scrollToPage(pageNumber: number, options?: { behavior?: 'smooth' | 'auto' }): void {
    if (this.viewer) {
      this.viewer.scrollToPage(pageNumber, options);
    }
  }

  public goToPage(pageOneIndexed: number): void {
    if (this.viewer) {
      this.viewer.setPage(pageOneIndexed - 1);
    }
  }

  public getViewer(): MinecraftBookViewer | null {
    return this.viewer;
  }

  public async exportCurrentPage(options?: { filename?: string; pageIndex?: number }): Promise<void> {
    if (!this.viewer) return;
    await this.viewer.exportCurrentPage(options);
    const page = options?.pageIndex ?? this.viewer.getCurrentPage();
    this.dispatchEvent(
      new CustomEvent('pageexport', {
        detail: { page: page + 1, dataUrl: this.getPageDataUrl(page) },
      })
    );
  }

  public getPageDataUrl(pageIndex?: number): string {
    return this.viewer ? this.viewer.getPageDataUrl(pageIndex) : '';
  }

  public async getPageBlob(pageIndex?: number): Promise<Blob | null> {
    return this.viewer ? this.viewer.getPageBlob(pageIndex) : null;
  }
}

// Auto-register custom element if window is available
if (typeof window !== 'undefined' && !customElements.get('minecraft-book')) {
  customElements.define('minecraft-book', MinecraftBookElement);
}
