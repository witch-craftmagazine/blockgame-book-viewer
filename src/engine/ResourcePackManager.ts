import JSZip from 'jszip';

export interface FontTexturePaths {
  ascii?: string | HTMLImageElement;
  accented?: string | HTMLImageElement;
  nonlatin?: string | HTMLImageElement;
}

export interface BookTextures {
  book: string;
  pageForward: string;
  pageForwardHover: string;
  pageBackward: string;
  pageBackwardHover: string;
}

export interface ResourcePackInfo {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  fontBaseUrl?: string;
  fontProviders?: any[];
  fontTextureResolver?: (file: string) => Promise<HTMLImageElement | null>;
  fontTextures?: FontTexturePaths;
  textures?: Partial<BookTextures>;
}

export interface CompositeFontProviderEntry {
  providers?: any[];
  resolver?: (file: string) => Promise<HTMLImageElement | null>;
  baseUrl?: string;
}

export interface CompositeResourcePack extends ResourcePackInfo {
  activePackIds: string[];
  textures: BookTextures;
  fontProvidersList: CompositeFontProviderEntry[];
}

export class ResourcePackManager {
  private activeStack: string[] = ['vanilla'];
  private packs: Map<string, ResourcePackInfo> = new Map();
  private baseAssetPath: string;

  constructor(baseAssetPath = './assets') {
    this.baseAssetPath = baseAssetPath;
    this.registerBuiltInPacks();
  }

  /**
   * Registers standard Vanilla Minecraft (16x) baseline textures.
   */
  private registerBuiltInPacks(): void {
    this.packs.set('vanilla', {
      id: 'vanilla',
      name: 'Vanilla (Default 16x)',
      description: 'Classic Minecraft written book texture and 16x font',
      iconUrl: `${this.baseAssetPath}/textures/gui/book.png`,
      textures: {
        book: `${this.baseAssetPath}/textures/gui/book.png`,
        pageForward: `${this.baseAssetPath}/textures/gui/page_forward.png`,
        pageForwardHover: `${this.baseAssetPath}/textures/gui/page_forward_highlighted.png`,
        pageBackward: `${this.baseAssetPath}/textures/gui/page_backward.png`,
        pageBackwardHover: `${this.baseAssetPath}/textures/gui/page_backward_highlighted.png`,
      },
      fontTextures: {
        ascii: `${this.baseAssetPath}/textures/font/ascii.png`,
        accented: `${this.baseAssetPath}/textures/font/accented.png`,
        nonlatin: `${this.baseAssetPath}/textures/font/nonlatin_european.png`,
      },
    });
  }

  /**
   * Registers a resource pack into the manager's library.
   */
  public registerPack(pack: ResourcePackInfo): void {
    this.packs.set(pack.id, pack);
  }

  /**
   * Unregisters a resource pack from the library and removes it from the active stack if present.
   * Note: The 'vanilla' base pack cannot be unregistered.
   */
  public unregisterPack(packId: string): void {
    if (packId === 'vanilla') return;
    this.deactivatePack(packId);
    this.packs.delete(packId);
  }

  public getAvailablePacks(): ResourcePackInfo[] {
    return Array.from(this.packs.values());
  }

  public getPack(packId: string): ResourcePackInfo | undefined {
    return this.packs.get(packId);
  }

  /**
   * Returns a copy of the active priority stack IDs (bottom [0] = vanilla, top [length-1] = highest priority).
   */
  public getActiveStack(): string[] {
    return [...this.activeStack];
  }

  public isPackActive(packId: string): boolean {
    return this.activeStack.includes(packId);
  }

  /**
   * Activates a pack and pushes it onto the active stack (or moves it to the desired priority index).
   */
  public activatePack(packId: string, priority?: number): CompositeResourcePack {
    if (!this.packs.has(packId)) {
      return this.getCompositePack();
    }
    const idx = this.activeStack.indexOf(packId);
    if (idx !== -1) {
      this.activeStack.splice(idx, 1);
    }
    if (priority !== undefined && priority > 0 && priority < this.activeStack.length) {
      this.activeStack.splice(priority, 0, packId);
    } else {
      this.activeStack.push(packId);
    }
    // Guarantee vanilla is always index 0
    if (this.activeStack[0] !== 'vanilla') {
      const vIdx = this.activeStack.indexOf('vanilla');
      if (vIdx !== -1) this.activeStack.splice(vIdx, 1);
      this.activeStack.unshift('vanilla');
    }
    return this.getCompositePack();
  }

  /**
   * Deactivates a pack and removes it from the active stack.
   * Note: The 'vanilla' baseline cannot be deactivated.
   */
  public deactivatePack(packId: string): CompositeResourcePack {
    if (packId === 'vanilla') return this.getCompositePack();
    const idx = this.activeStack.indexOf(packId);
    if (idx !== -1) {
      this.activeStack.splice(idx, 1);
    }
    return this.getCompositePack();
  }

  /**
   * Deactivates all custom packs, leaving only the Vanilla baseline.
   */
  public deactivateAllCustom(): CompositeResourcePack {
    this.activeStack = ['vanilla'];
    return this.getCompositePack();
  }

  /**
   * Reorders an active pack to a new position in the priority stack.
   * Index 0 is reserved for Vanilla; valid range is 1 to activeStack.length - 1.
   */
  public reorderPack(packId: string, newIndex: number): CompositeResourcePack {
    if (packId === 'vanilla') return this.getCompositePack();
    const currentIdx = this.activeStack.indexOf(packId);
    if (currentIdx === -1) return this.getCompositePack();

    this.activeStack.splice(currentIdx, 1);
    const targetIdx = Math.max(1, Math.min(newIndex, this.activeStack.length));
    this.activeStack.splice(targetIdx, 0, packId);
    return this.getCompositePack();
  }

  /**
   * Selects a single pack, deactivating other custom packs. (Backwards compatibility helper).
   */
  public setPack(packId: string): ResourcePackInfo | null {
    if (!this.packs.has(packId)) return null;
    this.activeStack = packId === 'vanilla' ? ['vanilla'] : ['vanilla', packId];
    return this.getCompositePack();
  }

  /**
   * Returns the current composite active pack.
   */
  public getCurrentPack(): ResourcePackInfo {
    return this.getCompositePack();
  }

  /**
   * Resolves the effective configuration by cascading the active resource pack stack.
   * Higher priority packs override GUI textures and font textures, and layer their font providers.
   */
  public getCompositePack(): CompositeResourcePack {
    const vanilla = this.packs.get('vanilla')!;
    const resolvedTextures: BookTextures = {
      book: vanilla.textures?.book || `${this.baseAssetPath}/textures/gui/book.png`,
      pageForward: vanilla.textures?.pageForward || `${this.baseAssetPath}/textures/gui/page_forward.png`,
      pageForwardHover: vanilla.textures?.pageForwardHover || `${this.baseAssetPath}/textures/gui/page_forward_highlighted.png`,
      pageBackward: vanilla.textures?.pageBackward || `${this.baseAssetPath}/textures/gui/page_backward.png`,
      pageBackwardHover: vanilla.textures?.pageBackwardHover || `${this.baseAssetPath}/textures/gui/page_backward_highlighted.png`,
    };

    let resolvedFontTextures: FontTexturePaths | undefined;
    const fontProvidersList: CompositeFontProviderEntry[] = [];

    // Traverse stack from bottom (index 0 = vanilla) to top (highest priority)
    for (const packId of this.activeStack) {
      const pack = this.packs.get(packId);
      if (!pack) continue;

      // 1. Textures override
      if (pack.textures) {
        if (pack.textures.book) resolvedTextures.book = pack.textures.book;
        if (pack.textures.pageForward) resolvedTextures.pageForward = pack.textures.pageForward;
        if (pack.textures.pageForwardHover) resolvedTextures.pageForwardHover = pack.textures.pageForwardHover;
        if (pack.textures.pageBackward) resolvedTextures.pageBackward = pack.textures.pageBackward;
        if (pack.textures.pageBackwardHover) resolvedTextures.pageBackwardHover = pack.textures.pageBackwardHover;
      }

      // 2. Font textures override
      if (pack.fontTextures) {
        if (!resolvedFontTextures) resolvedFontTextures = {};
        if (pack.fontTextures.ascii) resolvedFontTextures.ascii = pack.fontTextures.ascii;
        if (pack.fontTextures.accented) resolvedFontTextures.accented = pack.fontTextures.accented;
        if (pack.fontTextures.nonlatin) resolvedFontTextures.nonlatin = pack.fontTextures.nonlatin;
      }

      // 3. Font providers layer
      if (pack.fontBaseUrl || (pack.fontProviders && pack.fontProviders.length > 0)) {
        fontProvidersList.push({
          providers: pack.fontProviders,
          resolver: pack.fontTextureResolver,
          baseUrl: pack.fontBaseUrl,
        });
      }
    }

    const topPack = this.packs.get(this.activeStack[this.activeStack.length - 1]) || vanilla;

    return {
      id: `composite_${this.activeStack.join('+')}`,
      name: this.activeStack.length === 1 ? vanilla.name : `Composite (${this.activeStack.length} active)`,
      description: `Active stack: ${this.activeStack.join(' → ')}`,
      iconUrl: topPack.iconUrl || resolvedTextures.book,
      activePackIds: [...this.activeStack],
      textures: resolvedTextures,
      fontTextures: resolvedFontTextures,
      fontProvidersList,
    };
  }

  /**
   * Loads a custom Minecraft resource pack .zip file and activates it at the top of the stack.
   */
  public async loadZipResourcePack(file: File): Promise<ResourcePackInfo> {
    const zip = await JSZip.loadAsync(file);

    let packName = file.name.replace(/\.zip$/i, '');
    let packDesc = 'Custom uploaded resource pack';
    let iconUrl: string | undefined;

    // Read pack.mcmeta if present
    const mcmetaFile = zip.file('pack.mcmeta');
    if (mcmetaFile) {
      try {
        const text = await mcmetaFile.async('text');
        const json = JSON.parse(text);
        if (json.pack && json.pack.description) {
          packDesc = typeof json.pack.description === 'string'
            ? json.pack.description
            : JSON.stringify(json.pack.description);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Read pack.png if present
    const packPng = zip.file('pack.png');
    if (packPng) {
      const blob = await packPng.async('blob');
      iconUrl = URL.createObjectURL(blob);
    }

    // Search for book.png
    let bookFile = zip.file('assets/minecraft/textures/gui/book.png');
    if (!bookFile) {
      const found = zip.file(/textures\/gui\/.*book.*\.png$/i);
      if (found.length > 0) bookFile = found[0];
    }
    const bookUrl = bookFile ? URL.createObjectURL(await bookFile.async('blob')) : undefined;

    // Search for arrow button textures
    const findSprite = async (exactPath: string, regex: RegExp): Promise<string | undefined> => {
      let f = zip.file(exactPath);
      if (!f) {
        const matches = zip.file(regex);
        if (matches.length > 0) f = matches[0];
      }
      if (f) {
        const b = await f.async('blob');
        return URL.createObjectURL(b);
      }
      return undefined;
    };

    const pageForward = await findSprite(
      'assets/minecraft/textures/gui/sprites/widget/page_forward.png',
      /page_forward\.png$/i
    );

    const pageForwardHover = await findSprite(
      'assets/minecraft/textures/gui/sprites/widget/page_forward_highlighted.png',
      /page_forward_highlighted\.png$/i
    );

    const pageBackward = await findSprite(
      'assets/minecraft/textures/gui/sprites/widget/page_backward.png',
      /page_backward\.png$/i
    );

    const pageBackwardHover = await findSprite(
      'assets/minecraft/textures/gui/sprites/widget/page_backward_highlighted.png',
      /page_backward_highlighted\.png$/i
    );

    const customTextures: Partial<BookTextures> = {};
    if (bookUrl) customTextures.book = bookUrl;
    if (pageForward) customTextures.pageForward = pageForward;
    if (pageForwardHover) customTextures.pageForwardHover = pageForwardHover;
    if (pageBackward) customTextures.pageBackward = pageBackward;
    if (pageBackwardHover) customTextures.pageBackwardHover = pageBackwardHover;

    // Check for font/default.json (custom bitmap font providers e.g. server emojis)
    let fontProviders: any[] | undefined;
    let fontTextureResolver: ((file: string) => Promise<HTMLImageElement | null>) | undefined;
    let fontJsonFile = zip.file('assets/minecraft/font/default.json');
    if (!fontJsonFile) {
      const matches = zip.file(/font\/default\.json$/i);
      if (matches.length > 0) fontJsonFile = matches[0];
    }

    if (fontJsonFile) {
      try {
        const text = await fontJsonFile.async('text');
        const json = JSON.parse(text);
        if (json.providers && Array.isArray(json.providers)) {
          fontProviders = json.providers;
          fontTextureResolver = async (texFile: string): Promise<HTMLImageElement | null> => {
            let f = zip.file(`assets/minecraft/textures/${texFile}`);
            if (!f) f = zip.file(`textures/${texFile}`);
            if (!f) {
              const cleaned = texFile.replace(/^\/+/, '');
              const matches = zip.file(new RegExp(`textures/${cleaned}$`, 'i'));
              if (matches.length > 0) f = matches[0];
            }
            if (!f) return null;
            const blob = await f.async('blob');
            const url = URL.createObjectURL(blob);
            return new Promise((res) => {
              const img = new Image();
              img.onload = () => res(img);
              img.onerror = () => res(null);
              img.src = url;
            });
          };
        }
      } catch {
        // ignore font json parse errors
      }
    }

    // Search for font textures (ascii.png, accented.png, nonlatin_european.png)
    const findFontTexture = async (fileName: string): Promise<string | undefined> => {
      let f = zip.file(`assets/minecraft/textures/font/${fileName}`);
      if (!f) f = zip.file(`textures/font/${fileName}`);
      if (!f) {
        const matches = zip.file(new RegExp(`textures/font/${fileName}$`, 'i'));
        if (matches.length > 0) f = matches[0];
      }
      if (f) {
        const blob = await f.async('blob');
        return URL.createObjectURL(blob);
      }
      return undefined;
    };

    const zipAscii = await findFontTexture('ascii.png');
    const zipAccented = await findFontTexture('accented.png');
    const zipNonlatin = await findFontTexture('nonlatin_european.png');
    const fontTextures: FontTexturePaths | undefined = (zipAscii || zipAccented || zipNonlatin) ? {
      ascii: zipAscii,
      accented: zipAccented,
      nonlatin: zipNonlatin,
    } : undefined;

    const customPackId = `custom_${Date.now()}`;
    const packInfo: ResourcePackInfo = {
      id: customPackId,
      name: packName,
      description: packDesc,
      iconUrl: iconUrl || bookUrl,
      fontProviders,
      fontTextureResolver,
      fontTextures,
      textures: customTextures,
    };

    this.registerPack(packInfo);
    this.activatePack(customPackId);
    return packInfo;
  }
}
