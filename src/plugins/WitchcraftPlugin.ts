import type { BookPlugin, PageRect, CharRenderContext, CharRenderResult } from '../plugin/BookPlugin';
import type { BookCanvas } from '../render/BookCanvas';
import type { MinecraftBook, LineLayout } from '../engine/types';
import { soundManager } from '../render/SoundEffects';

export interface WitchcraftPluginOptions {
  gifUrl?: string;
  autoDetect?: boolean;
}

export class WitchcraftPlugin implements BookPlugin {
  public readonly name = 'witchcraft-plugin';

  private canvas: BookCanvas | null = null;
  private isWitchcraftMagazine = false;
  private isBlinkingEye = false;
  private nextBlinkTimestamp = 0;
  private blinkEndTimestamp = 0;
  private hasEyeOnCurrentPage = false;
  private eyeHitBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];

  private gifUrl: string;
  private autoDetect: boolean;
  private gifImg: HTMLImageElement | null = null;
  private gifOverlayElement: HTMLImageElement | null = null;

  constructor(options: WitchcraftPluginOptions = {}) {
    this.gifUrl = options.gifUrl || './assets/textures/starsweetpea.gif';
    this.autoDetect = options.autoDetect ?? true;
  }

  public init(canvas: BookCanvas): void {
    this.canvas = canvas;

    if (typeof document !== 'undefined') {
      const gifEl = document.createElement('img');
      gifEl.className = 'book-blank-page-gif';
      gifEl.src = this.gifUrl;
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
      canvas.getStageElement()?.appendChild(this.gifOverlayElement);
    }

    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.src = this.gifUrl;
      img.onload = () => {
        this.gifImg = img;
      };
    }
  }

  public destroy(): void {
    if (this.gifOverlayElement && this.gifOverlayElement.parentElement) {
      this.gifOverlayElement.parentElement.removeChild(this.gifOverlayElement);
    }
    this.canvas = null;
  }

  public setEnabled(enabled: boolean): void {
    this.isWitchcraftMagazine = enabled;
    this.updateHasEye();
    if (this.isWitchcraftMagazine) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.scheduleNextBlink(now);
    } else {
      this.isBlinkingEye = false;
    }
    this.canvas?.render();
  }

  public isEnabled(): boolean {
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
    this.canvas?.render();
  }

  public onBookChange(book: MinecraftBook, _pages: LineLayout[][]): void {
    if (this.autoDetect) {
      const author = (book.author || '').toLowerCase();
      const title = (book.title || '').toLowerCase();
      this.isWitchcraftMagazine = author.includes('starsweetpea') || title.includes('witchcraft');
    }
    this.updateHasEye();
    if (this.isWitchcraftMagazine) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.scheduleNextBlink(now);
    }
  }

  public onPageChange(_currentPage: number, _totalPages: number): void {
    this.updateHasEye();
    this.updateGifOverlay();
  }

  public onBeforeRenderPage(_ctx: CanvasRenderingContext2D, _pageIndex: number, _side: string, _rect: PageRect): void {
    this.eyeHitBoxes = [];
  }

  public onRenderChar(
    _ctx: CanvasRenderingContext2D,
    context: CharRenderContext
  ): CharRenderResult | void {
    if (!this.isWitchcraftMagazine) return;

    if (context.char === '⏼') {
      this.eyeHitBoxes.push({
        x: context.x - 2,
        y: context.y - 2,
        w: 12,
        h: 12,
      });

      if (this.isBlinkingEye && this.canvas) {
        return {
          char: '◡',
          advance: this.canvas.getAtlas().getAdvance('⏼', context.style.bold),
        };
      }
    }
  }

  public onAfterRenderPage(
    ctx: CanvasRenderingContext2D,
    pageIndex: number,
    side: 'left' | 'right' | 'single',
    rect: PageRect
  ): void {
    if (!this.isWitchcraftMagazine || !this.canvas) return;

    const totalPages = this.canvas.getTotalPages();
    const isRightPage = side === 'right';
    const isLastPage = pageIndex === totalPages - 1;
    const isOddTotalPages = totalPages % 2 !== 0;
    const isBlankCompanion = isOddTotalPages && isRightPage && isLastPage;
    const isSinglePageModeLastBlank =
      this.canvas.getViewMode() === 'single' && isLastPage && this.canvas.isPageBlank(pageIndex);

    const shouldShow =
      (this.canvas.getViewMode() === 'double' && (isBlankCompanion || (this.canvas.isPageBlank(pageIndex) && isLastPage))) ||
      isSinglePageModeLastBlank;

    if (shouldShow && this.gifImg && this.gifImg.complete) {
      const w = 88;
      const h = 100;
      const x = rect.x + (rect.w - w) / 2;
      const y = rect.y + 43;
      ctx.drawImage(this.gifImg, x, y, w, h);
    }
  }

  public onClick(x: number, y: number): boolean | void {
    if (!this.isWitchcraftMagazine || !this.hasEyeOnCurrentPage) return;

    for (const box of this.eyeHitBoxes) {
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        this.triggerBlink();
        soundManager.playWink();
        return true;
      }
    }
  }

  public onTick(now: number): boolean | void {
    if (!this.isWitchcraftMagazine || !this.hasEyeOnCurrentPage) return;

    let needsRender = false;

    if (this.isBlinkingEye && now >= this.blinkEndTimestamp) {
      this.isBlinkingEye = false;
      this.scheduleNextBlink(now);
      needsRender = true;
    } else if (!this.isBlinkingEye && now >= this.nextBlinkTimestamp) {
      this.isBlinkingEye = true;
      this.blinkEndTimestamp = now + 160;
      needsRender = true;
    }

    return needsRender;
  }

  public getBlankPageGifPlacement(): { x: number; y: number; w: number; h: number } | null {
    if (!this.isWitchcraftMagazine || !this.canvas) return null;
    const totalPages = this.canvas.getTotalPages();
    if (totalPages === 0) return null;

    const w = 88;
    const h = 100;
    const y = 43;
    const isDouble = this.canvas.getViewMode() === 'double';

    if (!isDouble) {
      const isLastPage = this.canvas.getCurrentPage() === totalPages - 1;
      if (isLastPage && this.canvas.isPageBlank(this.canvas.getCurrentPage())) {
        return { x: Math.round((146 - w) / 2), y, w, h };
      }
      return null;
    }

    const currentPage = this.canvas.getCurrentPage();
    const rightPageIdx = currentPage + 1;
    if (totalPages % 2 !== 0 && rightPageIdx >= totalPages) {
      return { x: Math.round(152 + (146 - w) / 2), y, w, h };
    }
    if (rightPageIdx < totalPages && this.canvas.isPageBlank(rightPageIdx) && rightPageIdx === totalPages - 1) {
      return { x: Math.round(152 + (146 - w) / 2), y, w, h };
    }
    return null;
  }

  private updateGifOverlay(): void {
    if (!this.gifOverlayElement || !this.canvas) return;
    const placement = this.getBlankPageGifPlacement();
    if (placement) {
      const scale = this.canvas.getScale();
      this.gifOverlayElement.style.display = 'block';
      this.gifOverlayElement.style.left = `${placement.x * scale}px`;
      this.gifOverlayElement.style.top = `${placement.y * scale}px`;
      this.gifOverlayElement.style.width = `${placement.w * scale}px`;
      this.gifOverlayElement.style.height = `${placement.h * scale}px`;
    } else {
      this.gifOverlayElement.style.display = 'none';
    }
  }

  private scheduleNextBlink(now: number): void {
    this.nextBlinkTimestamp = now + 3500 + Math.random() * 3000;
  }

  private updateHasEye(): void {
    this.hasEyeOnCurrentPage = false;
    if (!this.isWitchcraftMagazine || !this.canvas) return;

    const pages = this.canvas.getPaginatedPages();
    const cur = this.canvas.getCurrentPage();
    const pagesToCheck = [cur];
    if (this.canvas.getViewMode() === 'double' && cur + 1 < pages.length) {
      pagesToCheck.push(cur + 1);
    }

    for (const pIdx of pagesToCheck) {
      const pageLines = pages[pIdx];
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
}
