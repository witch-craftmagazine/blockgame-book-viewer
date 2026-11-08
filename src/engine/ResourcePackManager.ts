import JSZip from 'jszip';

export interface FontTexturePaths {
  ascii?: string | HTMLImageElement;
  accented?: string | HTMLImageElement;
  nonlatin?: string | HTMLImageElement;
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
  textures: {
    book: string;
    pageForward: string;
    pageForwardHover: string;
    pageBackward: string;
    pageBackwardHover: string;
  };
}

export class ResourcePackManager {
  private currentPackId = 'vanilla';
  private packs: Map<string, ResourcePackInfo> = new Map();
  private baseAssetPath: string;

  constructor(baseAssetPath = './assets') {
    this.baseAssetPath = baseAssetPath;
    this.registerBuiltInPacks();
  }

  private registerBuiltInPacks(): void {
    // 1. Vanilla 16x
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

    // 2. Lithos 32x (HD)
    this.packs.set('lithos', {
      id: 'lithos',
      name: 'Lithos (HD 32x)',
      description: 'High-definition 32x book texture and Lithos font by Eleazzaar',
      iconUrl: `${this.baseAssetPath}/packs/lithos/pack.png`,
      textures: {
        book: `${this.baseAssetPath}/packs/lithos/textures/gui/book.png`,
        pageForward: `${this.baseAssetPath}/packs/lithos/textures/gui/page_forward.png`,
        pageForwardHover: `${this.baseAssetPath}/packs/lithos/textures/gui/page_forward_highlighted.png`,
        pageBackward: `${this.baseAssetPath}/packs/lithos/textures/gui/page_backward.png`,
        pageBackwardHover: `${this.baseAssetPath}/packs/lithos/textures/gui/page_backward_highlighted.png`,
      },
      fontTextures: {
        ascii: `${this.baseAssetPath}/packs/lithos/textures/font/ascii.png`,
        accented: `${this.baseAssetPath}/packs/lithos/textures/font/accented.png`,
        nonlatin: `${this.baseAssetPath}/packs/lithos/textures/font/nonlatin_european.png`,
      },
    });

    // 3. Craftadia Server Pack (Custom Emojis, Logo & Icons + Lithos HD Book)
    this.packs.set('craftadia', {
      id: 'craftadia',
      name: 'Craftadia (Server Pack)',
      description: 'Official server pack with custom emoji fonts, banner logos, and rank tags with Lithos HD font',
      iconUrl: `${this.baseAssetPath}/packs/craftadia/pack.png`,
      fontBaseUrl: `${this.baseAssetPath}/packs/craftadia/assets/minecraft`,
      textures: {
        book: `${this.baseAssetPath}/packs/lithos/textures/gui/book.png`,
        pageForward: `${this.baseAssetPath}/packs/lithos/textures/gui/page_forward.png`,
        pageForwardHover: `${this.baseAssetPath}/packs/lithos/textures/gui/page_forward_highlighted.png`,
        pageBackward: `${this.baseAssetPath}/packs/lithos/textures/gui/page_backward.png`,
        pageBackwardHover: `${this.baseAssetPath}/packs/lithos/textures/gui/page_backward_highlighted.png`,
      },
      fontTextures: {
        ascii: `${this.baseAssetPath}/packs/lithos/textures/font/ascii.png`,
        accented: `${this.baseAssetPath}/packs/lithos/textures/font/accented.png`,
        nonlatin: `${this.baseAssetPath}/packs/lithos/textures/font/nonlatin_european.png`,
      },
    });
  }

  public getAvailablePacks(): ResourcePackInfo[] {
    return Array.from(this.packs.values());
  }

  public getPack(packId: string): ResourcePackInfo | undefined {
    return this.packs.get(packId);
  }

  public getCurrentPack(): ResourcePackInfo {
    return this.packs.get(this.currentPackId) || this.packs.get('vanilla')!;
  }

  public setPack(packId: string): ResourcePackInfo | null {
    if (this.packs.has(packId)) {
      this.currentPackId = packId;
      return this.packs.get(packId)!;
    }
    return null;
  }

  /**
   * Loads a custom Minecraft resource pack .zip file.
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

    const vanilla = this.packs.get('vanilla')!;
    const bookUrl = bookFile ? URL.createObjectURL(await bookFile.async('blob')) : vanilla.textures.book;

    // Search for arrow button textures
    const findSprite = async (exactPath: string, regex: RegExp, fallbackUrl: string): Promise<string> => {
      let f = zip.file(exactPath);
      if (!f) {
        const matches = zip.file(regex);
        if (matches.length > 0) f = matches[0];
      }
      if (f) {
        const b = await f.async('blob');
        return URL.createObjectURL(b);
      }
      return fallbackUrl;
    };

    const pageForward = await findSprite(
      'assets/minecraft/textures/gui/sprites/widget/page_forward.png',
      /page_forward\.png$/i,
      vanilla.textures.pageForward
    );

    const pageForwardHover = await findSprite(
      'assets/minecraft/textures/gui/sprites/widget/page_forward_highlighted.png',
      /page_forward_highlighted\.png$/i,
      vanilla.textures.pageForwardHover
    );

    const pageBackward = await findSprite(
      'assets/minecraft/textures/gui/sprites/widget/page_backward.png',
      /page_backward\.png$/i,
      vanilla.textures.pageBackward
    );

    const pageBackwardHover = await findSprite(
      'assets/minecraft/textures/gui/sprites/widget/page_backward_highlighted.png',
      /page_backward_highlighted\.png$/i,
      vanilla.textures.pageBackwardHover
    );

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
      textures: {
        book: bookUrl,
        pageForward,
        pageForwardHover,
        pageBackward,
        pageBackwardHover,
      },
    };

    this.packs.set(customPackId, packInfo);
    this.currentPackId = customPackId;
    return packInfo;
  }
}
