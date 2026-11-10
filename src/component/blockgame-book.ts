import { BlockgameBook, ViewMode, BookAppearance, BookEngine } from '../engine/types';
import { BlockgameBookViewer } from '../ui/BlockgameBookViewer';
import { parseBook } from '../io/BookParser';
import { soundManager } from '../render/SoundEffects';

const BaseElement: typeof HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as any);

export class BlockgameBookElement extends BaseElement {
  private viewer: BlockgameBookViewer | null = null;
  private isInitialized = false;
  private hostContainer: HTMLElement | ShadowRoot;
  private internalRoot: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private scriptObserver: MutationObserver | null = null;
  private lastParsedInlineContent: string | null = null;
  private isInternalUpdating = false;
  private isProgrammaticBook = false;

  public ready: Promise<BlockgameBookViewer>;
  private readyResolve?: (viewer: BlockgameBookViewer) => void;
  private readyReject?: (err: unknown) => void;

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
      'shadow',
    ];
  }

  constructor() {
    super();
    this.hostContainer = this;
    this.ready = new Promise<BlockgameBookViewer>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  private dispatchCustomEvent(name: string, detail?: any): void {
    if (typeof this.dispatchEvent === 'function') {
      try {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
      } catch {
        // Fallback if environment doesn't support EventInit in CustomEvent
        this.dispatchEvent(new CustomEvent(name, { detail }));
      }
    }
  }

  private updateAriaSemantics(): void {
    if (typeof this.setAttribute !== 'function') return;
    if (typeof this.hasAttribute === 'function') {
      if (!this.hasAttribute('role')) this.setAttribute('role', 'region');
      if (!this.hasAttribute('aria-roledescription')) this.setAttribute('aria-roledescription', 'book');
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    }
    const title = this.getAttribute('book-title') || this.viewer?.getBook()?.title || 'Blockgame Book';
    const author = this.getAttribute('author') || this.viewer?.getBook()?.author;
    const label = author ? `${title} by ${author}` : title;
    this.setAttribute('aria-label', label);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Ignore keyboard shortcuts if the user is typing in an input or textarea
    const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement) : null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        this.nextPage();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        this.prevPage();
        break;
      case 'Home':
        e.preventDefault();
        this.firstPage();
        break;
      case 'End':
        e.preventDefault();
        this.lastPage();
        break;
    }
  };

  async connectedCallback() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const isShadow = typeof this.hasAttribute === 'function' && this.hasAttribute('shadow') && this.getAttribute('shadow') !== 'false';
    if (isShadow && typeof this.attachShadow === 'function' && !this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' });
      // Add slot for projection of inline light DOM markup
      const slot = document.createElement('slot');
      shadow.appendChild(slot);
      const innerWrapper = document.createElement('div');
      innerWrapper.className = 'mc-book-shadow-root';
      innerWrapper.style.width = '100%';
      innerWrapper.style.height = '100%';
      innerWrapper.style.position = 'relative';
      shadow.appendChild(innerWrapper);
      this.hostContainer = innerWrapper;
      this.internalRoot = innerWrapper;
    } else {
      this.hostContainer = this;
      this.internalRoot = null;
    }

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

    try {
      this.viewer = new BlockgameBookViewer(this.hostContainer as HTMLElement, {
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
          this.dispatchCustomEvent('close');
        },
        onPageChange: (page, total) => {
          this.dispatchCustomEvent('pagechange', { page: page + 1, total });
          this.dispatchCustomEvent('page-change', { page: page + 1, total });
        },
        onBookChange: (book) => {
          this.updateAriaSemantics();
          this.dispatchCustomEvent('bookload', { book });
          this.dispatchCustomEvent('book-load', { book });
        },
      });

      await this.viewer.init();

      // Ingest initial content
      await this.loadInitialContent(engine, splitMode, bookTitle, author);

      if (this.hasAttribute('page')) {
        const p = parseInt(this.getAttribute('page') || '1', 10);
        this.viewer.setPage(p - 1);
      }

      this.updateAriaSemantics();

      // Keyboard navigation
      if (typeof this.addEventListener === 'function') {
        this.addEventListener('keydown', this.handleKeyDown);
      }

      // Responsive observer
      this.setupResizeObserver();

      // Mutation observer for reactive inline content
      this.setupMutationObserver();

      this.readyResolve?.(this.viewer);
      this.dispatchCustomEvent('ready', { viewer: this.viewer });
    } catch (err) {
      this.readyReject?.(err);
      this.dispatchCustomEvent('error', { error: err });
      console.error('Failed to initialize <blockgame-book>:', err);
    }
  }

  private async loadInitialContent(engine: BookEngine, splitMode: string, bookTitle?: string, author?: string): Promise<void> {
    if (!this.viewer) return;

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
        this.lastParsedInlineContent = content;
        const parsed = parseBook(content, { engine, splitContinuous: splitMode === 'lossless' });
        if (bookTitle) parsed.title = bookTitle;
        if (author) parsed.author = author;
        this.viewer.setBook(parsed);
      } else if (typeof this.hasAttribute === 'function' && this.hasAttribute('src')) {
        const src = this.getAttribute('src');
        if (src) {
          try {
            await this.viewer.loadFromUrl(src);
          } catch (err) {
            this.dispatchCustomEvent('error', { error: err, src });
          }
        }
      }
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && this.viewer) {
          const currentMode = this.getAttribute('view-mode');
          if (!currentMode || currentMode === 'auto') {
            const desiredMode: ViewMode = width < 680 ? 'single' : 'double';
            if (this.viewer.getViewMode() !== desiredMode) {
              this.viewer.setViewMode(desiredMode);
            }
          }
          this.viewer.getCanvas().fitToContainer();
        }
      }
    });
    this.resizeObserver.observe(this);
  }

  private setupMutationObserver(): void {
    if (typeof MutationObserver === 'undefined') return;

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.scriptObserver) {
      this.scriptObserver.disconnect();
      this.scriptObserver = null;
    }

    const handleInlineChange = () => {
      if (this.isInternalUpdating || !this.viewer) return;
      if (this.hasAttribute('text') || this.hasAttribute('src')) return;

      const scriptEl = this.querySelector ? this.querySelector('script[type="text/plain"], pre') : null;
      const content = scriptEl?.textContent?.trim() || '';
      if (!content || content === this.lastParsedInlineContent) return;

      this.lastParsedInlineContent = content;
      this.isProgrammaticBook = false;

      this.isInternalUpdating = true;
      try {
        const engine = this.engine;
        const splitMode = this.splitMode;
        const parsed = parseBook(content, { engine, splitContinuous: splitMode === 'lossless' });
        const overrideTitle = this.getAttribute('book-title');
        if (overrideTitle) parsed.title = overrideTitle;
        const overrideAuthor = this.getAttribute('author');
        if (overrideAuthor) parsed.author = overrideAuthor;
        this.viewer.setBook(parsed);
      } finally {
        this.isInternalUpdating = false;
      }
    };

    const scriptEl = this.querySelector ? this.querySelector('script[type="text/plain"], pre') : null;
    if (scriptEl) {
      this.scriptObserver = new MutationObserver(() => {
        handleInlineChange();
      });
      this.scriptObserver.observe(scriptEl, { characterData: true, childList: true, subtree: true });
    }

    // Observe shallow childList additions/removals directly on <blockgame-book> (never subtree)
    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.isInternalUpdating) return;
      let scriptAffected = false;
      for (const m of mutations) {
        for (let i = 0; i < m.addedNodes.length; i++) {
          const node = m.addedNodes[i] as HTMLElement;
          if (node.tagName === 'SCRIPT' || node.tagName === 'PRE') scriptAffected = true;
        }
        for (let i = 0; i < m.removedNodes.length; i++) {
          const node = m.removedNodes[i] as HTMLElement;
          if (node.tagName === 'SCRIPT' || node.tagName === 'PRE') scriptAffected = true;
        }
      }
      if (scriptAffected) {
        const newScriptEl = this.querySelector ? this.querySelector('script[type="text/plain"], pre') : null;
        if (newScriptEl && this.scriptObserver) {
          this.scriptObserver.disconnect();
          this.scriptObserver.observe(newScriptEl, { characterData: true, childList: true, subtree: true });
        }
        handleInlineChange();
      }
    });

    this.mutationObserver.observe(this, { childList: true, subtree: false });
  }

  disconnectedCallback() {
    if (typeof this.removeEventListener === 'function') {
      this.removeEventListener('keydown', this.handleKeyDown);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.scriptObserver) {
      this.scriptObserver.disconnect();
      this.scriptObserver = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
      this.isInitialized = false;
    }
    this.ready = new Promise<BlockgameBookViewer>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    if (this.internalRoot && typeof this.internalRoot.remove === 'function') {
      this.internalRoot.remove();
      this.internalRoot = null;
    }
  }

  async attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (!this.isInitialized || oldValue === newValue || !this.viewer) return;

    if (name === 'src' && newValue) {
      try {
        await this.viewer.loadFromUrl(newValue);
      } catch (err) {
        this.dispatchCustomEvent('error', { error: err, src: newValue });
      }
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
    } else if (name === 'theme' && newValue) {
      this.viewer.setTheme(newValue as any);
    } else if (name === 'sound') {
      soundManager.setEnabled(newValue !== null && newValue !== 'false');
    } else if (name === 'controls') {
      this.viewer.setControlsVisible(newValue !== null && newValue !== 'false');
    } else if (name === 'book-title') {
      const currentBook = this.viewer.getBook();
      if (currentBook) {
        currentBook.title = newValue || '';
      }
      this.updateAriaSemantics();
    } else if (name === 'author') {
      const currentBook = this.viewer.getBook();
      if (currentBook) {
        currentBook.author = newValue || '';
      }
      this.updateAriaSemantics();
    } else if (name === 'split-mode') {
      if (this.hasAttribute('text')) {
        const rawText = this.getAttribute('text') || '';
        if (newValue === 'lossless') {
          this.viewer.setText(rawText, this.getAttribute('book-title') || undefined, this.getAttribute('author') || undefined);
        } else {
          this.viewer.setBook(parseBook(rawText));
        }
      }
    } else if (name === 'appearance') {
      const app = (newValue === 'bedrock' ? 'bedrock' : 'java') as BookAppearance;
      this.viewer.setAppearance(app);
    } else if (name === 'engine') {
      const eng = (newValue === 'bedrock' ? 'bedrock' : 'java') as BookEngine;
      this.viewer.setEngine(eng);
    } else if (name === 'high-contrast') {
      this.viewer.setHighContrast(newValue !== null && newValue !== 'false');
    } else if (name === 'scale' && newValue) {
      this.viewer.getCanvas().setScale(parseInt(newValue, 10));
    }
  }

  // Properties

  get src(): string {
    return this.getAttribute('src') || '';
  }

  set src(val: string) {
    if (val) this.setAttribute('src', val);
    else this.removeAttribute('src');
  }

  get text(): string {
    return this.getAttribute('text') || '';
  }

  set text(val: string) {
    if (val) this.setAttribute('text', val);
    else this.removeAttribute('text');
  }

  get bookTitle(): string {
    return this.getAttribute('book-title') || (this.viewer?.getBook()?.title ?? '');
  }

  set bookTitle(val: string) {
    if (val) this.setAttribute('book-title', val);
    else this.removeAttribute('book-title');
    this.updateAriaSemantics();
  }

  get author(): string {
    return this.getAttribute('author') || (this.viewer?.getBook()?.author ?? '');
  }

  set author(val: string) {
    if (val) this.setAttribute('author', val);
    else this.removeAttribute('author');
    this.updateAriaSemantics();
  }

  get page(): number {
    return this.viewer ? this.viewer.getCurrentPage() + 1 : parseInt(this.getAttribute('page') || '1', 10);
  }

  set page(val: number) {
    this.setAttribute('page', String(val));
    if (this.viewer) this.viewer.setPage(val - 1);
  }

  get totalPages(): number {
    return this.viewer ? this.viewer.getTotalPages() : 0;
  }

  get total(): number {
    return this.totalPages;
  }

  get theme(): string {
    return this.getAttribute('theme') || 'dark';
  }

  set theme(val: string) {
    this.setAttribute('theme', val);
    if (this.viewer) this.viewer.setTheme(val as any);
  }

  get controls(): boolean {
    return this.getAttribute('controls') !== 'false';
  }

  set controls(val: boolean) {
    this.setAttribute('controls', val ? 'true' : 'false');
    if (this.viewer) this.viewer.setControlsVisible(val);
  }

  get sound(): boolean {
    return soundManager.isEnabled();
  }

  set sound(val: boolean) {
    this.setAttribute('sound', val ? 'true' : 'false');
    soundManager.setEnabled(val);
  }

  get scale(): number | undefined {
    const s = this.getAttribute('scale');
    return s ? parseInt(s, 10) : (this.viewer?.getCanvas()?.getScale() ?? undefined);
  }

  set scale(val: number | undefined) {
    if (val !== undefined) {
      this.setAttribute('scale', String(val));
      this.viewer?.getCanvas()?.setScale(val);
    } else {
      this.removeAttribute('scale');
    }
  }

  get splitMode(): 'lossless' | 'standard' {
    return (this.getAttribute('split-mode') as any) || 'lossless';
  }

  set splitMode(val: 'lossless' | 'standard') {
    this.setAttribute('split-mode', val);
  }

  get basePath(): string {
    return this.getAttribute('base-path') || './assets';
  }

  set basePath(val: string) {
    this.setAttribute('base-path', val);
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
    return this.viewer ? this.viewer.isHighContrast() : (this.hasAttribute('high-contrast') && this.getAttribute('high-contrast') !== 'false');
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
      : typeof this.hasAttribute === 'function' && this.hasAttribute('persist-progress') && this.getAttribute('persist-progress') !== 'false';
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
    return this.viewer ? this.viewer.isBookmarkVisible() : (this.hasAttribute('bookmark') && this.getAttribute('bookmark') !== 'false');
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

  get shadow(): boolean {
    return this.hasAttribute('shadow') && this.getAttribute('shadow') !== 'false';
  }

  set shadow(val: boolean) {
    if (val) {
      this.setAttribute('shadow', '');
    } else {
      this.removeAttribute('shadow');
    }
  }

  // Public Methods

  public whenReady(): Promise<BlockgameBookViewer> {
    return this.ready;
  }

  public setText(text: string, title?: string, author?: string): void {
    if (!this.viewer) return;
    this.isProgrammaticBook = true;
    this.isInternalUpdating = true;
    try {
      this.viewer.setText(text, title, author);
      this.updateAriaSemantics();
    } finally {
      this.isInternalUpdating = false;
    }
  }

  public resetProgress(): void {
    if (this.viewer) {
      this.viewer.clearReadingProgress();
    }
  }

  public setBook(book: BlockgameBook | string): void {
    if (!this.viewer) return;
    this.isProgrammaticBook = true;
    this.isInternalUpdating = true;
    try {
      if (typeof book === 'string') {
        const parsed = parseBook(book);
        if (parsed) this.viewer.setBook(parsed);
      } else {
        this.viewer.setBook(book);
      }
      this.updateAriaSemantics();
    } finally {
      this.isInternalUpdating = false;
    }
  }

  public getBook(): BlockgameBook | null {
    return this.viewer ? this.viewer.getBook() : null;
  }

  public isProgrammatic(): boolean {
    return this.isProgrammaticBook;
  }

  public nextPage(): boolean {
    return this.viewer ? this.viewer.nextPage() : false;
  }

  public prevPage(): boolean {
    return this.viewer ? this.viewer.prevPage() : false;
  }

  public firstPage(): boolean {
    if (!this.viewer) return false;
    this.viewer.setPage(0);
    return true;
  }

  public lastPage(): boolean {
    if (!this.viewer) return false;
    this.viewer.setPage(Math.max(0, this.viewer.getTotalPages() - 1));
    return true;
  }

  public zoomIn(): void {
    if (!this.viewer) return;
    const canvas = this.viewer.getCanvas();
    const current = canvas.getScale();
    const maxFitting = canvas.getMaxFittingScale();
    if (current < maxFitting) {
      canvas.setScale(current + 1);
    }
  }

  public zoomOut(): void {
    if (!this.viewer) return;
    const canvas = this.viewer.getCanvas();
    const current = canvas.getScale();
    if (current > 1) {
      canvas.setScale(current - 1);
    }
  }

  public toggleSound(): boolean {
    return soundManager.toggle();
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

  public getViewer(): BlockgameBookViewer | null {
    return this.viewer;
  }

  public async exportCurrentPage(options?: { filename?: string; pageIndex?: number }): Promise<void> {
    if (!this.viewer) return;
    await this.viewer.exportCurrentPage(options);
    const page = options?.pageIndex ?? this.viewer.getCurrentPage();
    const dataUrl = this.getPageDataUrl(page);
    this.dispatchCustomEvent('pageexport', { page: page + 1, dataUrl });
    this.dispatchCustomEvent('page-export', { page: page + 1, dataUrl });
  }

  public getPageDataUrl(pageIndex?: number): string {
    return this.viewer ? this.viewer.getPageDataUrl(pageIndex) : '';
  }

  public async getPageBlob(pageIndex?: number): Promise<Blob | null> {
    return this.viewer ? this.viewer.getPageBlob(pageIndex) : null;
  }
}

/** @deprecated Use BlockgameBookElement instead */
export const MinecraftBookElement = BlockgameBookElement;

// Auto-register custom element if window is available
if (typeof window !== 'undefined') {
  if (!customElements.get('blockgame-book')) {
    customElements.define('blockgame-book', BlockgameBookElement);
  }
  if (!customElements.get('minecraft-book')) {
    customElements.define('minecraft-book', BlockgameBookElement);
  }
}
