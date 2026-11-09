import { parseBook } from '../io/BookParser';
import { MinecraftBook } from '../engine/types';

export class ImportModal {
  private backdrop: HTMLElement;
  private onImport: (book: MinecraftBook) => void;

  constructor(onImport: (book: MinecraftBook) => void) {
    this.onImport = onImport;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.style.display = 'none';

    this.backdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Import Minecraft Book</h3>
          <button class="modal-close-btn" id="import-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">
            Upload or paste any exported Minecraft book. Supports <strong>Stendhal (.stendhal)</strong>, <strong>Scribble JSON (.json)</strong>, <strong>BookCopy JSON</strong>,
            <strong>CMI BookExport (&lt;NextPage&gt;)</strong>, <strong>/give commands</strong> (1.20.5+ & legacy), or <strong>raw text</strong>.
          </p>

          <div class="drop-zone" id="import-drop-zone">
            <span class="drop-icon">📂</span>
            <span>Drag & drop a <strong>.stendhal</strong>, <strong>.json</strong>, or <strong>.txt</strong> file here</span>
            <span class="drop-sub">or click to browse your computer</span>
            <input type="file" id="import-file-input" accept=".stendhal,.json,.txt,.nbt" style="display: none;" />
          </div>

          <div class="paste-section">
            <label for="import-textarea">Or paste book content / command below:</label>
            <textarea id="import-textarea" placeholder="Paste Stendhal (.stendhal), Scribble JSON (.json), BookCopy JSON, CMI text with <NextPage>, /give command, or plain text..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="import-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="import-confirm-btn">Load Book</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.backdrop);
    this.setupListeners();
  }

  private setupListeners(): void {
    const closeBtn = this.backdrop.querySelector('#import-close-btn') as HTMLElement;
    const cancelBtn = this.backdrop.querySelector('#import-cancel-btn') as HTMLElement;
    const confirmBtn = this.backdrop.querySelector('#import-confirm-btn') as HTMLElement;
    const dropZone = this.backdrop.querySelector('#import-drop-zone') as HTMLElement;
    const fileInput = this.backdrop.querySelector('#import-file-input') as HTMLInputElement;
    const textarea = this.backdrop.querySelector('#import-textarea') as HTMLTextAreaElement;

    const close = () => this.hide();
    closeBtn.onclick = close;
    cancelBtn.onclick = close;
    this.backdrop.onclick = (e) => {
      if (e.target === this.backdrop) close();
    };

    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-active');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-active');
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        this.readFile(e.dataTransfer.files[0], textarea);
      }
    };

    fileInput.onchange = () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.readFile(fileInput.files[0], textarea);
      }
    };

    confirmBtn.onclick = () => {
      const content = textarea.value.trim();
      if (!content) {
        alert('Please paste some book content or upload a file first.');
        return;
      }

      const book = parseBook(content);
      this.onImport(book);
      this.hide();
    };
  }

  private readFile(file: File, textarea: HTMLTextAreaElement): void {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        textarea.value = reader.result;
      }
    };
    reader.readAsText(file);
  }

  public getElement(): HTMLElement {
    return this.backdrop;
  }

  public open(): void {
    this.show();
  }

  public close(): void {
    this.hide();
  }

  public show(): void {
    this.backdrop.style.display = 'flex';
    const textarea = this.backdrop.querySelector('#import-textarea') as HTMLTextAreaElement;
    if (textarea) textarea.value = '';
  }

  public hide(): void {
    this.backdrop.style.display = 'none';
  }
}
