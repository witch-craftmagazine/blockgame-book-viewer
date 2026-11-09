import { ResourcePackInfo, ResourcePackManager } from '../engine/ResourcePackManager';

export class ResourcePackModal {
  private backdrop: HTMLElement;
  private packManager: ResourcePackManager;
  private onPackSelect: (pack: ResourcePackInfo) => void;

  constructor(packManager: ResourcePackManager, onPackSelect: (pack: ResourcePackInfo) => void) {
    this.packManager = packManager;
    this.onPackSelect = onPackSelect;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.style.display = 'none';

    this.backdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Resource Packs</h3>
          <button class="modal-close-btn" id="pack-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">
            Change the book background and button textures. Select a preset or drop a Minecraft <strong>.zip</strong> resource pack!
          </p>

          <div class="pack-list" id="pack-list"></div>

          <div class="drop-zone" id="pack-drop-zone">
            <span class="drop-icon">📦</span>
            <span>Drag & drop a Minecraft Resource Pack <strong>(.zip)</strong> here</span>
            <span class="drop-sub">or click to browse your computer</span>
            <input type="file" id="pack-file-input" accept=".zip" style="display: none;" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="pack-done-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.backdrop);
    this.setupListeners();
  }

  private setupListeners(): void {
    const closeBtn = this.backdrop.querySelector('#pack-close-btn') as HTMLElement;
    const doneBtn = this.backdrop.querySelector('#pack-done-btn') as HTMLElement;
    const dropZone = this.backdrop.querySelector('#pack-drop-zone') as HTMLElement;
    const fileInput = this.backdrop.querySelector('#pack-file-input') as HTMLInputElement;

    const close = () => this.hide();
    closeBtn.onclick = close;
    doneBtn.onclick = close;
    this.backdrop.onclick = (e) => {
      if (e.target === this.backdrop) close();
    };

    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-active');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-active');
    dropZone.ondrop = async (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        await this.handleZipUpload(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = async () => {
      if (fileInput.files && fileInput.files.length > 0) {
        await this.handleZipUpload(fileInput.files[0]);
      }
    };
  }

  private async handleZipUpload(file: File): Promise<void> {
    try {
      await this.packManager.loadZipResourcePack(file);
      const composite = this.packManager.getCompositePack();
      this.refreshPackList();
      this.onPackSelect(composite);
    } catch (err: any) {
      alert(`Failed to load resource pack: ${err?.message || err}`);
    }
  }

  public refreshPackList(): void {
    const list = this.backdrop.querySelector('#pack-list') as HTMLElement;
    list.innerHTML = '';

    const packs = this.packManager.getAvailablePacks();
    const activeStack = this.packManager.getActiveStack();

    for (const pack of packs) {
      const isActive = this.packManager.isPackActive(pack.id);
      const isVanilla = pack.id === 'vanilla';
      const stackIndex = activeStack.indexOf(pack.id);

      const item = document.createElement('div');
      item.className = `pack-item ${isActive ? 'active' : ''}`;
      
      let buttonLabel = 'Enable';
      let buttonClass = 'btn-secondary';
      if (isVanilla) {
        buttonLabel = activeStack.length === 1 ? 'Default Baseline' : 'Reset to Vanilla';
        buttonClass = activeStack.length === 1 ? 'btn-success' : 'btn-secondary';
      } else if (isActive) {
        buttonLabel = activeStack.length > 2 ? `Active (#${stackIndex})` : 'Active';
        buttonClass = 'btn-success';
      }

      item.innerHTML = `
        <div class="pack-icon-wrapper">
          ${pack.iconUrl ? `<img src="${pack.iconUrl}" alt="${pack.name}" class="pack-icon" />` : `<span class="pack-icon-fallback">📖</span>`}
        </div>
        <div class="pack-info">
          <div class="pack-title">${pack.name}</div>
          <div class="pack-desc">${pack.description}</div>
        </div>
        <button class="btn btn-sm ${buttonClass}">
          ${buttonLabel}
        </button>
      `;

      item.onclick = () => {
        if (isVanilla) {
          if (activeStack.length > 1) {
            this.packManager.deactivateAllCustom();
          }
        } else if (isActive) {
          this.packManager.deactivatePack(pack.id);
        } else {
          this.packManager.activatePack(pack.id);
        }
        const composite = this.packManager.getCompositePack();
        this.refreshPackList();
        this.onPackSelect(composite);
      };

      list.appendChild(item);
    }
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
    this.refreshPackList();
    this.backdrop.style.display = 'flex';
  }

  public hide(): void {
    this.backdrop.style.display = 'none';
  }
}
