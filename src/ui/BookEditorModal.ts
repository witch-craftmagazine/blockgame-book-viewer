import { BlockgameBook } from '../engine/types';
import { exportToStendhal } from '../io/BookExporter';
import { parseBook } from '../io/BookParser';

/**
 * Feature flag for future visual in-situ / WYSIWYG editor.
 * When enabled, provides a direct canvas / rich-text visual editing surface.
 */
export const WYSIWYG_BOOK_EDITOR_ENABLED = false;

export class BookEditorModal {
  private backdrop: HTMLElement;
  private currentBook: BlockgameBook | null = null;
  private onApply: (book: BlockgameBook) => void;
  private textarea!: HTMLTextAreaElement;

  constructor(onApply: (book: BlockgameBook) => void) {
    this.onApply = onApply;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.style.display = 'none';

    this.backdrop.innerHTML = `
      <div class="modal-card book-editor-card">
        <div class="modal-header">
          <div class="editor-header-tabs">
            <button class="editor-tab-btn active" data-mode="markup">📝 Markup Editor</button>
            <button class="editor-tab-btn disabled" data-mode="wysiwyg" title="Visual WYSIWYG editor is planned for a future release">
              🎨 Visual WYSIWYG <span class="badge-roadmap">Planned</span>
            </button>
          </div>
          <button class="modal-close-btn" id="editor-close-btn" aria-label="Close editor">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">
            Edit book markup in Stendhal format. Use <code>#-</code> for page breaks and <code>§</code> formatting codes.
          </p>

          <div class="markup-toolbar">
            <div class="markup-toolbar-row">
              <span class="toolbar-label">Colors:</span>
              <button type="button" class="tag-btn tag-color" data-code="§0" style="background:#000; color:#fff;" title="Black">§0</button>
              <button type="button" class="tag-btn tag-color" data-code="§1" style="background:#00a; color:#fff;" title="Dark Blue">§1</button>
              <button type="button" class="tag-btn tag-color" data-code="§2" style="background:#0a0; color:#fff;" title="Dark Green">§2</button>
              <button type="button" class="tag-btn tag-color" data-code="§3" style="background:#0aa; color:#fff;" title="Dark Aqua">§3</button>
              <button type="button" class="tag-btn tag-color" data-code="§4" style="background:#a00; color:#fff;" title="Dark Red">§4</button>
              <button type="button" class="tag-btn tag-color" data-code="§5" style="background:#a0a; color:#fff;" title="Dark Purple">§5</button>
              <button type="button" class="tag-btn tag-color" data-code="§6" style="background:#fa0; color:#000;" title="Gold">§6</button>
              <button type="button" class="tag-btn tag-color" data-code="§7" style="background:#aaa; color:#000;" title="Gray">§7</button>
              <button type="button" class="tag-btn tag-color" data-code="§8" style="background:#555; color:#fff;" title="Dark Gray">§8</button>
              <button type="button" class="tag-btn tag-color" data-code="§9" style="background:#55f; color:#fff;" title="Blue">§9</button>
              <button type="button" class="tag-btn tag-color" data-code="§a" style="background:#5f5; color:#000;" title="Green">§a</button>
              <button type="button" class="tag-btn tag-color" data-code="§b" style="background:#5ff; color:#000;" title="Aqua">§b</button>
              <button type="button" class="tag-btn tag-color" data-code="§c" style="background:#f55; color:#fff;" title="Red">§c</button>
              <button type="button" class="tag-btn tag-color" data-code="§d" style="background:#f5f; color:#000;" title="Light Purple">§d</button>
              <button type="button" class="tag-btn tag-color" data-code="§e" style="background:#ff5; color:#000;" title="Yellow">§e</button>
              <button type="button" class="tag-btn tag-color" data-code="§f" style="background:#fff; color:#000; border: 1px solid #999;" title="White">§f</button>
            </div>
            <div class="markup-toolbar-row">
              <span class="toolbar-label">Styles:</span>
              <button type="button" class="tag-btn" data-code="§l" title="Bold"><b>Bold (§l)</b></button>
              <button type="button" class="tag-btn" data-code="§o" title="Italic"><i>Italic (§o)</i></button>
              <button type="button" class="tag-btn" data-code="§n" title="Underline"><u>Under (§n)</u></button>
              <button type="button" class="tag-btn" data-code="§m" title="Strikethrough"><s>Strike (§m)</s></button>
              <button type="button" class="tag-btn" data-code="§k" title="Magic Obfuscated">Magic (§k)</button>
              <button type="button" class="tag-btn" data-code="§r" title="Reset Formatting">Reset (§r)</button>
              <button type="button" class="tag-btn tag-page" data-code="\\n#- " title="Insert Page Break">+ Page Break</button>
            </div>
          </div>

          <div class="editor-textarea-container">
            <textarea id="book-editor-markup" class="editor-textarea" spellcheck="false" placeholder="title: Book Title&#10;author: Author Name&#10;pages:&#10;#- First page text..."></textarea>
          </div>

          <div class="editor-roadmap-notice">
            <span class="roadmap-icon">💡</span>
            <span>WYSIWYG editor mode is flagged for future development (<code>WYSIWYG_BOOK_EDITOR = false</code>). Markup editing provides 100% fidelity with in-game formatting.</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="editor-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="editor-apply-btn">Apply to Book</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.backdrop);
    this.setupListeners();
  }

  private setupListeners(): void {
    const closeBtn = this.backdrop.querySelector('#editor-close-btn') as HTMLElement;
    const cancelBtn = this.backdrop.querySelector('#editor-cancel-btn') as HTMLElement;
    const applyBtn = this.backdrop.querySelector('#editor-apply-btn') as HTMLElement;
    this.textarea = this.backdrop.querySelector('#book-editor-markup') as HTMLTextAreaElement;

    const close = () => this.hide();
    closeBtn.onclick = close;
    cancelBtn.onclick = close;
    this.backdrop.onclick = (e) => {
      if (e.target === this.backdrop) close();
    };

    // Format chip insertion at cursor position
    const buttons = this.backdrop.querySelectorAll('.tag-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const code = btn.getAttribute('data-code');
        if (!code || !this.textarea) return;
        this.insertTextAtCursor(code.replace('\\n', '\n'));
      });
    });

    applyBtn.onclick = () => this.apply();
  }

  public apply(): void {
    const text = this.textarea?.value || '';
    if (!text.trim()) {
      if (typeof alert !== 'undefined') alert('Book content cannot be empty.');
      return;
    }
    try {
      const parsed = parseBook(text);
      this.currentBook = parsed;
      this.onApply(parsed);
      this.hide();
    } catch (err: any) {
      if (typeof alert !== 'undefined') alert(`Failed to parse book markup: ${err?.message || err}`);
    }
  }

  private insertTextAtCursor(text: string): void {
    if (!this.textarea) return;
    const start = typeof this.textarea.selectionStart === 'number' ? this.textarea.selectionStart : (this.textarea.value?.length || 0);
    const end = typeof this.textarea.selectionEnd === 'number' ? this.textarea.selectionEnd : (this.textarea.value?.length || 0);
    const current = this.textarea.value || '';

    this.textarea.value = current.substring(0, start) + text + current.substring(end);
    if (typeof this.textarea.setSelectionRange === 'function') {
      this.textarea.setSelectionRange(start + text.length, start + text.length);
    } else {
      this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
    }
    if (typeof this.textarea.focus === 'function') {
      this.textarea.focus();
    }
  }

  public open(book: BlockgameBook | null): void {
    this.currentBook = book;
    if (this.textarea) {
      if (book) {
        this.textarea.value = exportToStendhal(book);
      } else {
        this.textarea.value = 'title: New Book\nauthor: Player\npages:\n#- Welcome to your book!\n';
      }
    }
    if (this.backdrop) {
      this.backdrop.style.display = 'flex';
    }
    if (typeof this.textarea?.focus === 'function') {
      setTimeout(() => {
        if (typeof this.textarea?.focus === 'function') {
          this.textarea.focus();
        }
      }, 50);
    }
  }

  public close(): void {
    this.hide();
  }

  public hide(): void {
    this.backdrop.style.display = 'none';
  }

  public getElement(): HTMLElement {
    return this.backdrop;
  }

  public getTextarea(): HTMLTextAreaElement {
    return this.textarea;
  }

  public getCurrentBook(): BlockgameBook | null {
    return this.currentBook;
  }
}
