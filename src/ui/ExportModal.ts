import { MinecraftBook } from '../engine/types';
import {
  exportToBookCopyJson,
  exportToScribbleJson,
  exportToCmiText,
  exportToStendhal,
  exportToGiveCommandModern,
  exportToGiveCommandLegacy,
  exportToUrlHash,
} from '../io/BookExporter';

export class ExportModal {
  private backdrop: HTMLElement;
  private currentBook: MinecraftBook | null = null;
  private getCanvasDataUrl?: () => string;

  constructor(getCanvasDataUrl?: () => string) {
    this.getCanvasDataUrl = getCanvasDataUrl;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.style.display = 'none';

    this.backdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Export Minecraft Book</h3>
          <button class="modal-close-btn" id="export-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="export-tabs">
            <button class="tab-btn active" data-tab="give">/give Command</button>
            <button class="tab-btn" data-tab="stendhal">Stendhal</button>
            <button class="tab-btn" data-tab="scribble">Scribble JSON</button>
            <button class="tab-btn" data-tab="json">BookCopy JSON</button>
            <button class="tab-btn" data-tab="cmi">CMI Text</button>
            <button class="tab-btn" data-tab="share">Shareable URL</button>
            <button class="tab-btn" data-tab="screenshot">Image</button>
          </div>

          <div class="tab-content" id="tab-give">
            <p class="tab-sub">Minecraft Java command to give the written book in-game:</p>
            <div class="give-selector">
              <label><input type="radio" name="give-ver" value="modern" checked /> Modern (1.20.5+)</label>
              <label><input type="radio" name="give-ver" value="legacy" /> Legacy (1.13 - 1.20.4)</label>
            </div>
            <textarea id="export-give-text" readonly></textarea>
            <button class="btn btn-primary" id="copy-give-btn">Copy /give Command</button>
          </div>

          <div class="tab-content" id="tab-stendhal" style="display: none;">
            <p class="tab-sub">Compatible with the Stendhal mod (.stendhal files):</p>
            <textarea id="export-stendhal-text" readonly></textarea>
            <div class="btn-row">
              <button class="btn btn-secondary" id="copy-stendhal-btn">Copy Stendhal</button>
              <button class="btn btn-primary" id="download-stendhal-btn">Download .stendhal</button>
            </div>
          </div>

          <div class="tab-content" id="tab-scribble" style="display: none;">
            <p class="tab-sub">Compatible with the Scribble mod (.json files):</p>
            <textarea id="export-scribble-text" readonly></textarea>
            <div class="btn-row">
              <button class="btn btn-secondary" id="copy-scribble-btn">Copy Scribble JSON</button>
              <button class="btn btn-primary" id="download-scribble-btn">Download .json</button>
            </div>
          </div>

          <div class="tab-content" id="tab-json" style="display: none;">
            <p class="tab-sub">Compatible with the BookCopy client mod:</p>
            <textarea id="export-json-text" readonly></textarea>
            <div class="btn-row">
              <button class="btn btn-secondary" id="copy-json-btn">Copy JSON</button>
              <button class="btn btn-primary" id="download-json-btn">Download .json</button>
            </div>
          </div>

          <div class="tab-content" id="tab-cmi" style="display: none;">
            <p class="tab-sub">Compatible with 1MB-CMI-BookExport and CMI CustomText:</p>
            <textarea id="export-cmi-text" readonly></textarea>
            <div class="btn-row">
              <button class="btn btn-secondary" id="copy-cmi-btn">Copy CMI Text</button>
              <button class="btn btn-primary" id="download-cmi-btn">Download .txt</button>
            </div>
          </div>

          <div class="tab-content" id="tab-share" style="display: none;">
            <p class="tab-sub">Web link with the book state encoded directly in the URL:</p>
            <textarea id="export-share-url" readonly></textarea>
            <button class="btn btn-primary" id="copy-share-btn">Copy Share Link</button>
          </div>

          <div class="tab-content" id="tab-screenshot" style="display: none;">
            <p class="tab-sub">Download high-resolution pixel art image of current view:</p>
            <button class="btn btn-primary" id="download-png-btn">Download Page as PNG</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="export-done-btn">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.backdrop);
    this.setupListeners();
  }

  private setupListeners(): void {
    const closeBtn = this.backdrop.querySelector('#export-close-btn') as HTMLElement;
    const doneBtn = this.backdrop.querySelector('#export-done-btn') as HTMLElement;
    const tabs = this.backdrop.querySelectorAll('.tab-btn');

    const close = () => this.hide();
    closeBtn.onclick = close;
    doneBtn.onclick = close;
    this.backdrop.onclick = (e) => {
      if (e.target === this.backdrop) close();
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const targetTab = tab.getAttribute('data-tab');
        this.backdrop.querySelectorAll('.tab-content').forEach(c => {
          (c as HTMLElement).style.display = 'none';
        });

        const activeContent = this.backdrop.querySelector(`#tab-${targetTab}`) as HTMLElement;
        if (activeContent) activeContent.style.display = 'block';
      });
    });

    // Version selector for give command
    const radioInputs = this.backdrop.querySelectorAll('input[name="give-ver"]');
    radioInputs.forEach(r => {
      r.addEventListener('change', () => this.updateGiveCommand());
    });

    // Copy buttons
    this.setupCopyButton('#copy-give-btn', '#export-give-text');
    this.setupCopyButton('#copy-stendhal-btn', '#export-stendhal-text');
    this.setupCopyButton('#copy-scribble-btn', '#export-scribble-text');
    this.setupCopyButton('#copy-json-btn', '#export-json-text');
    this.setupCopyButton('#copy-cmi-btn', '#export-cmi-text');
    this.setupCopyButton('#copy-share-btn', '#export-share-url');

    // Download buttons
    const downloadStendhalBtn = this.backdrop.querySelector('#download-stendhal-btn') as HTMLElement;
    downloadStendhalBtn.onclick = () => {
      if (!this.currentBook) return;
      const data = exportToStendhal(this.currentBook);
      this.triggerDownload(`${this.sanitizeFilename(this.currentBook.title)}.stendhal`, data, 'text/plain');
    };

    const downloadScribbleBtn = this.backdrop.querySelector('#download-scribble-btn') as HTMLElement;
    if (downloadScribbleBtn) {
      downloadScribbleBtn.onclick = () => {
        if (!this.currentBook) return;
        const data = exportToScribbleJson(this.currentBook);
        this.triggerDownload(`${this.sanitizeFilename(this.currentBook.title || 'scribble')}.json`, data, 'application/json');
      };
    }

    const downloadJsonBtn = this.backdrop.querySelector('#download-json-btn') as HTMLElement;
    downloadJsonBtn.onclick = () => {
      if (!this.currentBook) return;
      const data = exportToBookCopyJson(this.currentBook);
      this.triggerDownload(`${this.sanitizeFilename(this.currentBook.title)}.json`, data, 'application/json');
    };

    const downloadCmiBtn = this.backdrop.querySelector('#download-cmi-btn') as HTMLElement;
    downloadCmiBtn.onclick = () => {
      if (!this.currentBook) return;
      const data = exportToCmiText(this.currentBook);
      this.triggerDownload(`${this.sanitizeFilename(this.currentBook.title)}.txt`, data, 'text/plain');
    };

    const downloadPngBtn = this.backdrop.querySelector('#download-png-btn') as HTMLElement;
    downloadPngBtn.onclick = () => {
      if (this.getCanvasDataUrl && this.currentBook) {
        const dataUrl = this.getCanvasDataUrl();
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${this.sanitizeFilename(this.currentBook.title)}-page.png`;
        a.click();
      }
    };
  }

  private setupCopyButton(btnSelector: string, textSelector: string): void {
    const btn = this.backdrop.querySelector(btnSelector) as HTMLButtonElement;
    const textarea = this.backdrop.querySelector(textSelector) as HTMLTextAreaElement;
    if (btn && textarea) {
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(textarea.value);
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = orig; }, 1500);
        } catch {
          textarea.select();
          document.execCommand('copy');
        }
      };
    }
  }

  private triggerDownload(filename: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private sanitizeFilename(name: string): string {
    return (name || 'book').replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
  }

  private updateGiveCommand(): void {
    if (!this.currentBook) return;
    const checked = this.backdrop.querySelector('input[name="give-ver"]:checked') as HTMLInputElement;
    const isLegacy = checked && checked.value === 'legacy';
    const giveArea = this.backdrop.querySelector('#export-give-text') as HTMLTextAreaElement;
    giveArea.value = isLegacy
      ? exportToGiveCommandLegacy(this.currentBook)
      : exportToGiveCommandModern(this.currentBook);
  }

  public getElement(): HTMLElement {
    return this.backdrop;
  }

  public open(book: MinecraftBook): void {
    this.show(book);
  }

  public close(): void {
    this.hide();
  }

  public show(book: MinecraftBook): void {
    this.currentBook = book;
    this.updateGiveCommand();

    const stendhalArea = this.backdrop.querySelector('#export-stendhal-text') as HTMLTextAreaElement;
    stendhalArea.value = exportToStendhal(book);

    const scribbleArea = this.backdrop.querySelector('#export-scribble-text') as HTMLTextAreaElement;
    if (scribbleArea) {
      scribbleArea.value = exportToScribbleJson(book);
    }

    const jsonArea = this.backdrop.querySelector('#export-json-text') as HTMLTextAreaElement;
    jsonArea.value = exportToBookCopyJson(book);

    const cmiArea = this.backdrop.querySelector('#export-cmi-text') as HTMLTextAreaElement;
    cmiArea.value = exportToCmiText(book);

    const shareArea = this.backdrop.querySelector('#export-share-url') as HTMLTextAreaElement;
    const hash = exportToUrlHash(book);
    shareArea.value = `${window.location.origin}${window.location.pathname}#book=${hash}`;

    this.backdrop.style.display = 'flex';
  }

  public hide(): void {
    this.backdrop.style.display = 'none';
  }
}
