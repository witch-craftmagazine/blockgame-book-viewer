import { MinecraftBook, ViewMode, BookAppearance, BookEngine } from '../engine/types';
import { MinecraftBookViewer } from '../ui/MinecraftBookViewer';
import { parseBook } from '../io/BookParser';

const BaseElement: typeof HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as any);

export class MinecraftBookElement extends BaseElement {
  private viewer: MinecraftBookViewer | null = null;
  private isInitialized = false;

  static get observedAttributes() {
    return ['src', 'view-mode', 'scale', 'sound', 'controls', 'theme', 'page', 'base-path', 'appearance', 'engine', 'high-contrast'];
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

    let initialMode: ViewMode = 'double';
    if (viewMode === 'single' || viewMode === 'double') {
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

    // Check for inline content in <script> or <pre>
    const scriptEl = this.querySelector('script[type="text/plain"], pre');
    if (scriptEl && scriptEl.textContent) {
      const parsed = parseBook(scriptEl.textContent.trim());
      if (parsed) {
        this.viewer.setBook(parsed);
      }
    } else if (this.hasAttribute('src')) {
      const src = this.getAttribute('src');
      if (src) {
        await this.viewer.loadFromUrl(src);
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
    } else if (name === 'page' && newValue) {
      this.viewer.setPage(parseInt(newValue, 10) - 1);
    } else if (name === 'view-mode' && (newValue === 'single' || newValue === 'double')) {
      this.viewer.getCanvas().setViewMode(newValue as ViewMode);
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
