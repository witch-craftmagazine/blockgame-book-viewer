import { LineLayout } from '../engine/types';
import { BookCanvas } from './BookCanvas';

export interface ContinuousScrollViewOptions {
  container: HTMLElement;
  bookCanvas: BookCanvas;
  onPageChange?: (page: number, total: number) => void;
  onProgressSave?: (page: number) => void;
}

export class ContinuousScrollView {
  private container: HTMLElement;
  private bookCanvas: BookCanvas;
  private viewportEl: HTMLElement;
  private floatingBadgeEl: HTMLElement;

  private viewMode: 'scroll-single' | 'scroll-double' = 'scroll-single';
  private paginatedPages: LineLayout[][] = [];
  private totalPages = 1;
  private currentPage = 0; // 0-indexed

  private pageWrappers: HTMLElement[] = [];
  private mountedCanvases: Map<number, HTMLCanvasElement> = new Map();
  private intersectionObserver: any = null;
  private resizeObserver: any = null;
  private debounceTimer: any = null;
  private isVisible = false;

  private onPageChange?: (page: number, total: number) => void;
  private onProgressSave?: (page: number) => void;

  constructor(options: ContinuousScrollViewOptions) {
    this.container = options.container;
    this.bookCanvas = options.bookCanvas;
    this.onPageChange = options.onPageChange;
    this.onProgressSave = options.onProgressSave;

    // Viewport element
    this.viewportEl = document.createElement('div');
    this.viewportEl.className = 'mc-book-scroll-viewport';
    this.viewportEl.setAttribute('role', 'region');
    this.viewportEl.setAttribute('aria-label', 'Continuous Scroll Book Reader');
    this.viewportEl.setAttribute('tabindex', '0');
    this.viewportEl.style.display = 'none';

    // Floating progress badge
    this.floatingBadgeEl = document.createElement('div');
    this.floatingBadgeEl.className = 'mc-floating-badge';
    this.floatingBadgeEl.setAttribute('role', 'status');
    this.floatingBadgeEl.setAttribute('aria-live', 'polite');
    this.floatingBadgeEl.style.display = 'none';
    this.floatingBadgeEl.textContent = 'Page 1 of 1';

    this.container.appendChild(this.viewportEl);
    this.container.appendChild(this.floatingBadgeEl);

    this.setupListeners();
  }

  public setViewMode(mode: 'scroll-single' | 'scroll-double'): void {
    if (this.viewMode !== mode) {
      this.viewMode = mode;
      if (this.isVisible) {
        this.rebuildDOM();
      }
    }
  }

  public getViewMode(): 'scroll-single' | 'scroll-double' {
    return this.viewMode;
  }

  public setBookData(paginatedPages: LineLayout[][], initialPage = 0): void {
    this.paginatedPages = paginatedPages;
    this.totalPages = Math.max(1, paginatedPages.length);
    this.currentPage = Math.max(0, Math.min(initialPage, this.totalPages - 1));

    if (this.isVisible) {
      this.rebuildDOM();
      this.scrollToPage(this.currentPage + 1, { behavior: 'auto' });
    }
  }

  public show(): void {
    this.isVisible = true;
    this.viewportEl.style.display = 'flex';
    this.floatingBadgeEl.style.display = 'block';
    this.rebuildDOM();
  }

  public hide(): void {
    this.isVisible = false;
    this.viewportEl.style.display = 'none';
    this.floatingBadgeEl.style.display = 'none';
    this.clearCanvases();
  }

  public getViewportElement(): HTMLElement {
    return this.viewportEl;
  }

  public getFloatingBadgeElement(): HTMLElement {
    return this.floatingBadgeEl;
  }

  public getCurrentPage(): number {
    return this.currentPage;
  }

  public getPaginatedPages(): LineLayout[][] {
    return this.paginatedPages;
  }

  public scrollToPage(pageNumber: number, options?: { behavior?: 'smooth' | 'auto' }): void {
    const targetIdx = Math.max(0, Math.min(pageNumber - 1, this.totalPages - 1));
    this.currentPage = targetIdx;

    if (this.pageWrappers.length === 0) return;

    let targetEl: HTMLElement | undefined;
    if (this.isDoubleModeEffective()) {
      const spreadIdx = Math.floor(targetIdx / 2);
      targetEl = this.pageWrappers[spreadIdx];
    } else {
      targetEl = this.pageWrappers[targetIdx];
    }

    if (targetEl) {
      if (typeof targetEl.scrollIntoView === 'function') {
        targetEl.scrollIntoView({
          behavior: options?.behavior || 'smooth',
          block: 'center',
        });
      } else {
        this.viewportEl.scrollTop = targetEl.offsetTop - 40;
      }
      this.updateBadge();
    }
  }

  private isDoubleModeEffective(): boolean {
    if (this.viewMode !== 'scroll-double') return false;
    const containerW = this.container.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    // Responsive reflow: automatic fallback to single page on narrow containers (< 680px)
    return containerW >= 680;
  }

  private rebuildDOM(): void {
    this.clearCanvases();
    this.viewportEl.innerHTML = '';
    this.pageWrappers = [];

    const isDouble = this.isDoubleModeEffective();
    const appearance = this.bookCanvas.getAppearance();
    const scale = this.bookCanvas.getScale() || 2;

    const baseW = isDouble
      ? (appearance === 'bedrock' ? 308 : 344)
      : 192;
    const baseH = 192;

    const itemWidth = baseW * scale;
    const itemHeight = baseH * scale;

    const count = isDouble ? Math.ceil(this.totalPages / 2) : this.totalPages;

    for (let i = 0; i < count; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = isDouble ? 'mc-book-scroll-spread' : 'mc-book-scroll-page';
      if (!wrapper.dataset) wrapper.dataset = {} as any;
      wrapper.dataset.index = String(i);
      wrapper.setAttribute('data-index', String(i));
      wrapper.style.width = `${itemWidth}px`;
      wrapper.style.height = `${itemHeight}px`;
      wrapper.style.minHeight = `${itemHeight}px`;
      wrapper.style.aspectRatio = `${baseW} / ${baseH}`;

      if (isDouble) {
        const leftPage = i * 2;
        const rightPage = leftPage + 1;
        wrapper.dataset.pageStart = String(leftPage);
        wrapper.setAttribute('data-page-start', String(leftPage));
        wrapper.setAttribute('aria-label', rightPage < this.totalPages
          ? `Spread: Pages ${leftPage + 1} and ${rightPage + 1} of ${this.totalPages}`
          : `Spread: Page ${leftPage + 1} of ${this.totalPages}`
        );
      } else {
        wrapper.dataset.pageIndex = String(i);
        wrapper.setAttribute('data-page-index', String(i));
        wrapper.setAttribute('aria-label', `Page ${i + 1} of ${this.totalPages}`);
      }

      this.viewportEl.appendChild(wrapper);
      this.pageWrappers.push(wrapper);
    }

    this.setupVirtualization();
    this.updateBadge();
  }

  private setupVirtualization(): void {
    const hasIntersectionObserver = typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'undefined';

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    if (!hasIntersectionObserver) {
      // Non-browser / test environment fallback: immediately mount all canvases
      for (let i = 0; i < this.pageWrappers.length; i++) {
        this.mountCanvasForItem(i);
      }
      return;
    }

    this.intersectionObserver = new window.IntersectionObserver(
      (entries: any[]) => {
        for (const entry of entries) {
          const idx = parseInt(entry.target.dataset.index || '0', 10);
          if (entry.isIntersecting) {
            this.mountCanvasForItem(idx);
          } else {
            this.unmountCanvasForItem(idx);
          }
        }
      },
      {
        root: this.viewportEl,
        rootMargin: '300px 0px',
        threshold: 0.01,
      }
    );

    for (const wrapper of this.pageWrappers) {
      this.intersectionObserver.observe(wrapper);
    }
  }

  public mountCanvasForItem(itemIndex: number): void {
    if (this.mountedCanvases.has(itemIndex)) return;
    const wrapper = this.pageWrappers[itemIndex];
    if (!wrapper) return;

    const isDouble = this.isDoubleModeEffective();
    const appearance = this.bookCanvas.getAppearance();
    const scale = this.bookCanvas.getScale() || 2;
    const baseW = isDouble
      ? (appearance === 'bedrock' ? 308 : 344)
      : 192;
    const baseH = 192;

    const canvas = document.createElement('canvas');
    canvas.width = baseW * scale;
    canvas.height = baseH * scale;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.imageRendering = 'pixelated';

    if (isDouble) {
      const leftPageIdx = itemIndex * 2;
      this.bookCanvas.renderSpreadToCanvas(leftPageIdx, canvas, scale);
    } else {
      this.bookCanvas.renderPageToCanvas(itemIndex, canvas, scale);
    }

    wrapper.appendChild(canvas);
    this.mountedCanvases.set(itemIndex, canvas);
  }

  public unmountCanvasForItem(itemIndex: number): void {
    const canvas = this.mountedCanvases.get(itemIndex);
    if (!canvas) return;

    const wrapper = this.pageWrappers[itemIndex];
    if (wrapper && canvas.parentElement === wrapper) {
      wrapper.removeChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    this.mountedCanvases.delete(itemIndex);
  }

  private clearCanvases(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    for (const [idx] of this.mountedCanvases) {
      this.unmountCanvasForItem(idx);
    }
    this.mountedCanvases.clear();
  }

  private setupListeners(): void {
    // Scroll listener for real-time progress update
    this.viewportEl.addEventListener('scroll', () => {
      this.handleScroll();
    }, { passive: true });

    // Keyboard navigation
    this.viewportEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        this.viewportEl.scrollBy({ top: 140, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        this.viewportEl.scrollBy({ top: -140, behavior: 'smooth' });
      } else if (e.key === ' ') {
        e.preventDefault();
        this.viewportEl.scrollBy({
          top: e.shiftKey ? -this.viewportEl.clientHeight * 0.75 : this.viewportEl.clientHeight * 0.75,
          behavior: 'smooth',
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.viewportEl.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'End') {
        e.preventDefault();
        this.viewportEl.scrollTo({ top: this.viewportEl.scrollHeight, behavior: 'smooth' });
      }
    });

    // Resize observer for responsive reflow
    if (typeof window !== 'undefined' && typeof window.ResizeObserver !== 'undefined') {
      let lastWidth = this.container.clientWidth;
      this.resizeObserver = new window.ResizeObserver(() => {
        const currentW = this.container.clientWidth;
        if (Math.abs(currentW - lastWidth) > 30) {
          lastWidth = currentW;
          if (this.isVisible && this.viewMode === 'scroll-double') {
            this.rebuildDOM();
          }
        }
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private handleScroll(): void {
    if (this.pageWrappers.length === 0) return;

    const viewportRect = this.viewportEl.getBoundingClientRect();
    const viewportCenterY = viewportRect.top + viewportRect.height / 2;

    let closestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < this.pageWrappers.length; i++) {
      const rect = this.pageWrappers[i].getBoundingClientRect();
      const itemCenterY = rect.top + rect.height / 2;
      const dist = Math.abs(itemCenterY - viewportCenterY);

      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    const isDouble = this.isDoubleModeEffective();
    const newPage = isDouble ? closestIdx * 2 : closestIdx;

    if (newPage !== this.currentPage) {
      this.currentPage = newPage;
      this.updateBadge();

      if (this.onPageChange) {
        this.onPageChange(this.currentPage, this.totalPages);
      }

      // Debounced progress save
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        if (this.onProgressSave) {
          this.onProgressSave(this.currentPage);
        }
      }, 150);
    }
  }

  private updateBadge(): void {
    const isDouble = this.isDoubleModeEffective();
    if (isDouble) {
      const left = this.currentPage + 1;
      const right = this.currentPage + 2;
      if (right <= this.totalPages) {
        this.floatingBadgeEl.textContent = `Pages ${left}-${right} of ${this.totalPages}`;
      } else {
        this.floatingBadgeEl.textContent = `Page ${left} of ${this.totalPages}`;
      }
    } else {
      this.floatingBadgeEl.textContent = `Page ${this.currentPage + 1} of ${this.totalPages}`;
    }
  }

  public destroy(): void {
    this.clearCanvases();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.viewportEl.remove();
    this.floatingBadgeEl.remove();
  }
}
