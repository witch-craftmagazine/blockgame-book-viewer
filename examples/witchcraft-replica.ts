import { BookCanvas } from '../src/render/BookCanvas';
import { ResourcePackManager } from '../src/engine/ResourcePackManager';
import { createCraftadiaPack } from '../src/presets/example-packs';
import { WitchcraftPlugin, witchcraftEggOptions } from '../src/demo/WitchcraftPlugin';
import { WITCHCRAFT_MAGAZINE_ISSUES } from '../src/samples/sampleBooks';
import { parseStendhalBook } from '../src/io/BookParser';
import { soundManager } from '../src/render/SoundEffects';

class WitchcraftApp {
  private container: HTMLElement;
  private canvasWrapper!: HTMLElement;
  private bookCanvas!: BookCanvas;
  private packManager!: ResourcePackManager;
  private currentIssueId = 'issue1';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.packManager = new ResourcePackManager('../assets');
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

    await Promise.all([
      this.bookCanvas.init(),
      this.loadIssue(this.currentIssueId, 1),
    ]);

    const craftadiaPack = createCraftadiaPack('../assets');
    this.packManager.registerPack(craftadiaPack);
    this.packManager.activatePack('craftadia');
    await this.bookCanvas.applyResourcePack(this.packManager.getCompositePack()).catch((err) => {
      console.warn('Could not apply server resource pack:', err);
    });
  }

  private buildLayout(): void {
    this.container.innerHTML = `
      <main class="reader-viewport">
        <div class="canvas-wrapper" id="canvas-wrapper"></div>
      </main>

      <header class="magazine-nav" id="magazine-nav">
        <div class="magazine-nav-inner">
          <a class="magazine-brand" href="https://linktr.ee/StarSweetpea" target="_blank" rel="noopener noreferrer">
            <span class="magazine-brand-icon">✨</span>
            <span class="magazine-brand-title">witchcraft...magazine</span>
          </a>

          <div class="magazine-selector-wrapper">
            <button class="nav-arrow-btn" id="btn-prev-issue">◀</button>
            <div class="issue-scroll-container" id="issue-scroll-container">
              <div class="issue-scroll-track">
                ${WITCHCRAFT_MAGAZINE_ISSUES.map(
                  m => `
                    <button class="issue-chip ${m.id === this.currentIssueId ? 'active' : ''}" 
                            data-issue-id="${m.id}" 
                            title="${m.title}">
                      ${m.title}
                    </button>
                  `
                ).join('')}
              </div>
            </div>
            <button class="nav-arrow-btn" id="btn-next-issue">▶</button>
          </div>

          <div class="magazine-meta">
            <span class="magazine-page-info" id="magazine-page-info">1-2 / 16</span>
            <button class="nav-icon-btn" id="btn-sound-toggle" title="Toggle Sound">🔊</button>
          </div>
        </div>
      </header>
    `;

    this.canvasWrapper = this.container.querySelector('#canvas-wrapper') as HTMLElement;
  }

  private async loadIssue(issueId: string, page: number = 1): Promise<void> {
    const issue = WITCHCRAFT_MAGAZINE_ISSUES.find(m => m.id === issueId || m.aliases?.includes(issueId));
    if (!issue) return;

    this.currentIssueId = issue.id;

    const chips = this.container.querySelectorAll('.issue-chip') as NodeListOf<HTMLButtonElement>;
    chips.forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-issue-id') === issueId);
    });

    try {
      const resp = await fetch(`../assets/books/${issue.filename}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const book = parseStendhalBook(text);
      if (book) {
        this.bookCanvas.setBook(book);
        this.bookCanvas.setPage(page - 1);
        document.title = `${issue.title} · witchcraft...magazine`;
      }
    } catch (err) {
      console.error('Failed to load issue:', err);
    }
  }

  private setupListeners(): void {
    const chips = this.container.querySelectorAll('.issue-chip') as NodeListOf<HTMLButtonElement>;
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.getAttribute('data-issue-id');
        if (id) this.loadIssue(id, 1);
      });
    });

    const soundBtn = this.container.querySelector('#btn-sound-toggle') as HTMLButtonElement;
    soundBtn?.addEventListener('click', () => {
      const active = soundManager.toggle();
      soundBtn.textContent = active ? '🔊' : '🔇';
    });

    const prevIssueBtn = this.container.querySelector('#btn-prev-issue') as HTMLButtonElement;
    const nextIssueBtn = this.container.querySelector('#btn-next-issue') as HTMLButtonElement;

    prevIssueBtn?.addEventListener('click', () => {
      const idx = WITCHCRAFT_MAGAZINE_ISSUES.findIndex(m => m.id === this.currentIssueId);
      if (idx > 0) this.loadIssue(WITCHCRAFT_MAGAZINE_ISSUES[idx - 1].id, 1);
    });

    nextIssueBtn?.addEventListener('click', () => {
      const idx = WITCHCRAFT_MAGAZINE_ISSUES.findIndex(m => m.id === this.currentIssueId);
      if (idx < WITCHCRAFT_MAGAZINE_ISSUES.length - 1) this.loadIssue(WITCHCRAFT_MAGAZINE_ISSUES[idx + 1].id, 1);
    });
  }

  private updatePageIndicator(page: number, total: number): void {
    const info = this.container.querySelector('#magazine-page-info') as HTMLElement;
    if (info) {
      const isDouble = this.bookCanvas.getViewMode() === 'double';
      if (isDouble && page + 1 < total && page % 2 === 0) {
        info.textContent = `${page + 1}-${page + 2} / ${total}`;
      } else {
        info.textContent = `${page + 1} / ${total}`;
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (app) {
    const instance = new WitchcraftApp(app);
    await instance.init();
  }
});
