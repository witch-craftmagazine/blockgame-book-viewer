import { BookCanvas } from '../src/render/BookCanvas';
import { ResourcePackManager } from '../src/engine/ResourcePackManager';
import { createCraftadiaPack } from '../src/presets/example-packs';
import { WitchcraftPlugin, witchcraftEggOptions } from '../src/demo/WitchcraftPlugin';
import { AsciiAmbientManager } from '../src/demo/AsciiAmbientManager';
import { WITCHCRAFT_MAGAZINE_ISSUES } from '../src/samples/sampleBooks';
import { parseStendhalBook } from '../src/io/BookParser';
import { soundManager } from '../src/render/SoundEffects';
import { parseBookUrl, buildBookHash, buildShareableUrl } from '../src/ui/urlNavigation';

class WitchcraftApp {
  private container: HTMLElement;
  private canvasWrapper!: HTMLElement;
  private bookCanvas!: BookCanvas;
  private packManager!: ResourcePackManager;
  private asciiAmbient: AsciiAmbientManager | null = null;
  private currentIssueId = 'intro';
  private initialPage: number | null = null;
  private toastTimeout: any = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.packManager = new ResourcePackManager('../assets');
    this.resolveInitialStateFromUrl();
    this.buildLayout();

    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 680;
    const initialViewMode = isNarrow ? 'single' : 'double';

    const witchcraftPlugin = new WitchcraftPlugin();

    this.bookCanvas = new BookCanvas({
      container: this.canvasWrapper,
      baseAssetPath: '../assets',
      defaultViewMode: initialViewMode,
      plugins: [witchcraftPlugin],
      ...witchcraftEggOptions('../assets'),
      onPageChange: (page, total) => this.updatePageIndicator(page, total),
    });

    this.setupListeners();

    // Initialize ASCII ambient backdrop
    const ambientWrapper = this.container.querySelector('#ascii-ambient-wrapper') as HTMLElement;
    if (ambientWrapper) {
      this.asciiAmbient = new AsciiAmbientManager(ambientWrapper);
      this.asciiAmbient.setCanvasElement(this.bookCanvas.getCanvas());
      this.asciiAmbient.setBoundsProvider(() => this.bookCanvas.getBookPageRect());
      this.asciiAmbient.setIssue(this.currentIssueId);
      this.asciiAmbient.start();
    }

    // Initialize canvas textures and load initial magazine issue
    await Promise.all([
      this.bookCanvas.init(),
      this.loadIssue(this.currentIssueId, this.initialPage ?? 1),
    ]);

    // Apply Craftadia server pack preset (custom emoji fonts + Lithos HD 32x book & font)
    const craftadiaPack = createCraftadiaPack('../assets');
    this.packManager.registerPack(craftadiaPack);
    this.packManager.activatePack('craftadia');
    await this.bookCanvas.applyResourcePack(this.packManager.getCompositePack()).catch((err) => {
      console.warn('Could not apply server resource pack:', err);
    });
  }

  private resolveInitialStateFromUrl(): void {
    if (typeof window === 'undefined') return;
    const validIds = WITCHCRAFT_MAGAZINE_ISSUES.flatMap(m => [m.id, ...(m.aliases || [])]);
    const parsed = parseBookUrl(window.location.href, validIds);
    if (parsed.issueId) {
      this.currentIssueId = parsed.issueId;
    }
    if (parsed.page !== null) {
      this.initialPage = parsed.page;
    }
  }

  private buildLayout(): void {
    this.container.innerHTML = `
      <main class="reader-viewport">
        <div class="ascii-ambient-wrapper" id="ascii-ambient-wrapper" aria-hidden="true"></div>
        <div class="canvas-wrapper" id="canvas-wrapper"></div>
      </main>

      <header class="magazine-nav" id="magazine-nav">
        <div class="magazine-nav-inner">
          <a class="magazine-brand" href="https://linktr.ee/StarSweetpea" target="_blank" rel="noopener noreferrer" title="StarSweetpea on Linktree">
            <span class="magazine-brand-icon">✨</span>
            <span class="magazine-brand-title">witchcraft...magazine</span>
          </a>

          <div class="magazine-selector-wrapper">
            <button class="nav-arrow-btn" id="btn-prev-issue" title="Previous Issue (Shift+Left or [)">◀</button>
            <div class="issue-scroll-container" id="issue-scroll-container" role="tablist" aria-label="Witch-Craft Magazine Issues">
              <div class="issue-scroll-track" id="issue-scroll-track">
                ${WITCHCRAFT_MAGAZINE_ISSUES.map(
                  m => `
                    <button class="issue-chip ${m.id === this.currentIssueId ? 'active' : ''}" 
                            data-issue-id="${m.id}" 
                            title="${m.title}"
                            role="tab"
                            aria-selected="${m.id === this.currentIssueId ? 'true' : 'false'}">
                      ${m.title}
                    </button>
                  `
                ).join('')}
              </div>
            </div>
            <button class="nav-arrow-btn" id="btn-next-issue" title="Next Issue (Shift+Right or ])">▶</button>
          </div>

          <div class="magazine-meta">
            <span class="magazine-page-info" id="magazine-page-info">1-2 / 16</span>
            <button class="nav-icon-btn" id="btn-ambient-toggle" title="Toggle ASCII Backdrop (A)">🕯️</button>
            <button class="nav-icon-btn" id="btn-share-page" title="Share link to this page (copies URL)" aria-label="Share link to this page">🔗</button>
            <button class="nav-icon-btn" id="btn-sound-toggle" title="Toggle Page Flip Sound">🔊</button>
          </div>
        </div>
      </header>

      <div class="share-toast" id="share-toast" role="status" aria-live="polite"></div>
    `;

    this.canvasWrapper = this.container.querySelector('#canvas-wrapper') as HTMLElement;
  }

  private async loadIssue(issueId: string, targetPage?: number): Promise<void> {
    const issue = WITCHCRAFT_MAGAZINE_ISSUES.find(m => m.id === issueId || m.aliases?.includes(issueId));
    if (!issue) return;

    this.currentIssueId = issue.id;
    this.asciiAmbient?.setIssue(issue.id);

    const chips = this.container.querySelectorAll('.issue-chip') as NodeListOf<HTMLButtonElement>;
    chips.forEach(chip => {
      const match = chip.getAttribute('data-issue-id') === issue.id;
      chip.classList.toggle('active', match);
      chip.setAttribute('aria-selected', match ? 'true' : 'false');
      if (match) {
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });

    try {
      const resp = await fetch(`../assets/books/${issue.filename}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const book = parseStendhalBook(text);
      if (book) {
        this.bookCanvas.setBook(book);

        const pageToOpen = targetPage ?? (this.initialPage ?? 1);
        this.initialPage = null; // consume
        const total = this.bookCanvas.getTotalPages();
        let targetIndex = Math.max(0, Math.min(Math.max(0, total - 1), pageToOpen - 1));

        if (this.bookCanvas.getViewMode() === 'double' && targetIndex % 2 === 1) {
          targetIndex -= 1;
        }

        this.bookCanvas.setPage(targetIndex);
        document.title = `${issue.title} · witchcraft...magazine`;
      }
    } catch (err) {
      console.error('Failed to load magazine issue:', err);
    }
  }

  private switchIssue(issueId: string, page: number = 1): void {
    if (issueId === this.currentIssueId) {
      const total = this.bookCanvas.getTotalPages();
      let targetIndex = Math.max(0, Math.min(Math.max(0, total - 1), page - 1));
      if (this.bookCanvas.getViewMode() === 'double' && targetIndex % 2 === 1) {
        targetIndex -= 1;
      }
      this.bookCanvas.setPage(targetIndex);
      return;
    }
    window.location.hash = buildBookHash(issueId, page);
    this.loadIssue(issueId, page);
  }

  private stepIssue(delta: number): void {
    const currentIndex = WITCHCRAFT_MAGAZINE_ISSUES.findIndex(m => m.id === this.currentIssueId);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + delta;
    if (nextIndex >= 0 && nextIndex < WITCHCRAFT_MAGAZINE_ISSUES.length) {
      this.switchIssue(WITCHCRAFT_MAGAZINE_ISSUES[nextIndex].id, 1);
    }
  }

  private setupListeners(): void {
    const prevIssueBtn = this.container.querySelector('#btn-prev-issue') as HTMLButtonElement;
    const nextIssueBtn = this.container.querySelector('#btn-next-issue') as HTMLButtonElement;
    const scrollContainer = this.container.querySelector('#issue-scroll-container') as HTMLElement;
    const chips = this.container.querySelectorAll('.issue-chip') as NodeListOf<HTMLButtonElement>;
    const shareBtn = this.container.querySelector('#btn-share-page') as HTMLButtonElement;
    const soundBtn = this.container.querySelector('#btn-sound-toggle') as HTMLButtonElement;
    const ambientBtn = this.container.querySelector('#btn-ambient-toggle') as HTMLButtonElement;

    // Issue scroll selector dragging and mouse wheel navigation
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasDragged = false;

    if (scrollContainer) {
      scrollContainer.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0 && e.deltaX === 0) {
          e.preventDefault();
          scrollContainer.scrollLeft += e.deltaY;
        }
      }, { passive: false });

      scrollContainer.addEventListener('mousedown', (e) => {
        isDown = true;
        hasDragged = false;
        startX = e.pageX - scrollContainer.offsetLeft;
        scrollLeft = scrollContainer.scrollLeft;
      });

      window.addEventListener('mouseup', () => {
        isDown = false;
      });

      scrollContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const x = e.pageX - scrollContainer.offsetLeft;
        const walk = x - startX;
        if (Math.abs(walk) > 4) {
          hasDragged = true;
          scrollContainer.scrollLeft = scrollLeft - walk;
        }
      });
    }

    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (hasDragged) {
          e.preventDefault();
          return;
        }
        const id = chip.getAttribute('data-issue-id');
        if (id) {
          this.switchIssue(id, 1);
        }
      });
    });

    prevIssueBtn?.addEventListener('click', () => this.stepIssue(-1));
    nextIssueBtn?.addEventListener('click', () => this.stepIssue(1));

    shareBtn?.addEventListener('click', () => this.handleShare());

    if (ambientBtn && this.asciiAmbient) {
      ambientBtn.style.opacity = this.asciiAmbient.isEnabled() ? '1' : '0.5';
      ambientBtn.addEventListener('click', () => {
        const active = this.asciiAmbient!.toggle();
        ambientBtn.style.opacity = active ? '1' : '0.5';
        this.showToast(active ? 'Ambient Backdrop: Enabled' : 'Ambient Backdrop: Disabled');
      });
    }

    soundBtn?.addEventListener('click', () => {
      const active = soundManager.toggle();
      soundBtn.textContent = active ? '🔊' : '🔇';
      soundBtn.title = active ? 'Mute Sound' : 'Enable Sound';
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if ((e.shiftKey && e.key === 'ArrowLeft') || e.key === '[') {
        e.preventDefault();
        this.stepIssue(-1);
      } else if ((e.shiftKey && e.key === 'ArrowRight') || e.key === ']') {
        e.preventDefault();
        this.stepIssue(1);
      } else if (!e.ctrlKey && !e.metaKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (this.asciiAmbient) {
          const active = this.asciiAmbient.toggle();
          if (ambientBtn) ambientBtn.style.opacity = active ? '1' : '0.5';
          this.showToast(active ? 'Ambient Backdrop: Enabled' : 'Ambient Backdrop: Disabled');
        }
      }
    });

    // Responsive screen width adjustments
    window.addEventListener('resize', () => {
      const isNarrowScreen = window.innerWidth < 680;
      const targetMode = isNarrowScreen ? 'single' : 'double';
      if (this.bookCanvas.getViewMode() !== targetMode) {
        this.bookCanvas.setViewMode(targetMode);
      }
    });

    // Hash change listener for browser back/forward buttons
    window.addEventListener('hashchange', () => {
      const validIds = WITCHCRAFT_MAGAZINE_ISSUES.flatMap(m => [m.id, ...(m.aliases || [])]);
      const parsed = parseBookUrl(window.location.hash, validIds);
      if (parsed.issueId && parsed.issueId !== this.currentIssueId) {
        this.loadIssue(parsed.issueId, parsed.page ?? 1);
      } else if (parsed.page !== null) {
        const total = this.bookCanvas.getTotalPages();
        let targetIndex = Math.max(0, Math.min(Math.max(0, total - 1), parsed.page - 1));
        if (this.bookCanvas.getViewMode() === 'double' && targetIndex % 2 === 1) {
          targetIndex -= 1;
        }
        if (this.bookCanvas.getCurrentPage() !== targetIndex) {
          this.bookCanvas.setPage(targetIndex);
        }
      }
    });
  }

  private updatePageIndicator(currentPage: number, totalPages: number): void {
    const pageInfo = this.container.querySelector('#magazine-page-info') as HTMLElement;
    if (pageInfo) {
      const isDouble = this.bookCanvas.getViewMode() === 'double';
      if (isDouble && currentPage + 1 < totalPages && currentPage % 2 === 0) {
        pageInfo.textContent = `${currentPage + 1}-${currentPage + 2} / ${totalPages}`;
      } else {
        pageInfo.textContent = `${currentPage + 1} / ${totalPages}`;
      }
    }

    // Keep URL hash updated with current page without polluting history stack
    const humanPage = currentPage + 1;
    const canonicalHash = buildBookHash(this.currentIssueId, humanPage);
    if (typeof window !== 'undefined' && window.location.hash !== canonicalHash) {
      window.history.replaceState(null, '', canonicalHash);
    }
  }

  private showToast(messageHtml: string): void {
    const toast = this.container.querySelector('#share-toast') as HTMLElement;
    if (toast) {
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }
      toast.innerHTML = messageHtml;
      toast.classList.add('show');
      this.toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 2600);
    }
  }

  private async handleShare(): Promise<void> {
    const shareBtn = this.container.querySelector('#btn-share-page') as HTMLButtonElement;
    const humanPage = this.bookCanvas.getCurrentPage() + 1;
    const issue = WITCHCRAFT_MAGAZINE_ISSUES.find(m => m.id === this.currentIssueId);
    const issueTitle = issue ? issue.title : 'Magazine';
    const shareUrl = buildShareableUrl(this.currentIssueId, humanPage);

    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied && typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    if (shareBtn) {
      const origText = shareBtn.textContent;
      shareBtn.textContent = '✓';
      shareBtn.classList.add('active');
      setTimeout(() => {
        shareBtn.textContent = origText;
        shareBtn.classList.remove('active');
      }, 1800);
    }

    this.showToast(
      copied
        ? `<span>✨</span> Copied link to <strong>${issueTitle}</strong> (Page ${humanPage})!`
        : `<span>🔗</span> Link: <code>${shareUrl}</code>`
    );
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (app) {
    const instance = new WitchcraftApp(app);
    await instance.init();
  }
});
