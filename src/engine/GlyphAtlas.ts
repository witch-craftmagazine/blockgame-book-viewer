import { GlyphDrawInfo } from './types';
import glyphsData from '../../public/assets/font/glyphs.json';
import { getUnifontAdvance, UNIFONT_BOLD_OFFSET } from './UnifontAdvances';

export interface GlyphMapEntry {
  sheet: 'ascii' | 'accented' | 'nonlatin';
  col: number;
  row: number;
  colsInSheet: number;
  rowsInSheet: number;
  cellWidth: number;
  cellHeight: number;
  yOffset: number;
  rawWidth: number;
  advance: number;
}

export interface CustomBitmapGlyphEntry {
  image: HTMLImageElement;
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  dWidth: number;
  dHeight: number;
  yOffset: number;
  advance: number;
  ascent: number;
  isColor: boolean;
  file: string;
}

/**
 * Pinned advances for formatting and control characters. Every other glyph is resolved the way
 * vanilla's font providers do: space provider, bitmap sheets (glyphs.json), then the exact
 * Unifont table (UnifontAdvances.ts).
 */
export const BLOCKGAME_SYMBOL_ADVANCES: Record<string, number> = {
  '§': 0,
  '\n': 0,
  '\r': 0,
};

/** @deprecated Use BLOCKGAME_SYMBOL_ADVANCES instead */
export const MINECRAFT_SYMBOL_ADVANCES = BLOCKGAME_SYMBOL_ADVANCES;

// Server resource pack bitmap overrides to explicitly ignore.
// (e.g. Craftadia later mapped custom weapon textures to standard Unicode stars like ✯ (U+272F),
// which broke pre-existing written books that used the star character).
export const IGNORED_BITMAP_CHARS = new Set([
  '✯', // U+272F: Craftadia noxium weapon override
]);

/** Advance of the "missing glyph" box vanilla draws for code points no font provider covers. */
export const MISSING_GLYPH_ADVANCE = 6;

export class GlyphAtlas {
  private advances: Map<string, number> = new Map();
  private glyphMap: Map<string, GlyphMapEntry> = new Map();
  private customGlyphs: Map<string, CustomBitmapGlyphEntry> = new Map();
  private sheets: Record<string, HTMLImageElement> = {};
  private vanillaSheets: Record<string, HTMLImageElement> = {};
  private tintedSheets: Map<string, HTMLCanvasElement> = new Map();
  private fallbackCache: Map<string, GlyphDrawInfo> = new Map();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor() {
    // 1. Bitmap sheet advances (ascii.png, accented.png, nonlatin_european.png). These providers
    // come before Unifont in default.json, so they win for every character they map.
    for (const item of glyphsData) {
      if (item.char === ' ') {
        this.advances.set(item.char, item.pixels); // space is 4
      } else {
        this.advances.set(item.char, item.pixels + 1); // standard character advance is width + 1
      }
    }

    // 2. Formatting and control characters
    for (const [char, adv] of Object.entries(BLOCKGAME_SYMBOL_ADVANCES)) {
      this.advances.set(char, adv);
    }

    // 3. Space provider (include/space.json): ' ' = 4, ZWNJ = 0
    this.advances.set(' ', 4);
    this.advances.set('\u200c', 0);
  }

  /**
   * Returns true if character is a Unicode non-spacing combining mark (0px advance).
   */
  public isCombining(char: string): boolean {
    const code = char.codePointAt(0) || 0;
    return (
      (code >= 0x0300 && code <= 0x036f) ||
      (code >= 0x0483 && code <= 0x0489) ||
      (code >= 0x0591 && code <= 0x05bd) ||
      (code >= 0x0610 && code <= 0x061a) ||
      (code >= 0x064b && code <= 0x065f) ||
      (code >= 0x1dc0 && code <= 0x1dff) ||
      (code >= 0x20d0 && code <= 0x20ff) ||
      (code >= 0xfe20 && code <= 0xfe2f)
    );
  }

  /**
   * Returns the advance (cursor delta) in pixels for any Unicode character, resolved like
   * vanilla's font providers, in order:
   *   1. space provider (' ' = 4, U+200C = 0), then custom resource pack glyphs
   *   2. bitmap sheets (width + 1) and control characters
   *   3. Unifont via the exact UnihexProvider table (multiples of 0.5)
   *   4. the missing glyph (6)
   * Bold adds 1 for space, bitmap and missing glyphs, and 0.5 for Unifont glyphs.
   */
  public getAdvance(char: string, isBold = false): number {
    if (char === '§' || char === '\n' || char === '\r') return 0;
    // Spaces are 4px and, like every other glyph, gain the 1px bold offset (5px when bold).
    // Verified in-game on 26.3, where a bold 20-character title (97px regular + 20px bold
    // offset = 117px) wraps at 114px.
    if (char === ' ') return isBold ? 5 : 4;

    const custom = this.customGlyphs.get(char);
    if (custom) {
      return isBold ? custom.advance + 1 : custom.advance;
    }

    const bitmapAdvance = this.advances.get(char);
    if (bitmapAdvance !== undefined) {
      return isBold ? bitmapAdvance + 1 : bitmapAdvance;
    }

    const unifont = getUnifontAdvance(char.codePointAt(0) ?? 0);
    if (unifont !== undefined) {
      return isBold ? unifont + UNIFONT_BOLD_OFFSET : unifont;
    }

    // Unverified: the missing glyph's bold offset is assumed to be 1 like other non-Unihex glyphs.
    return isBold ? MISSING_GLYPH_ADVANCE + 1 : MISSING_GLYPH_ADVANCE;
  }

  /**
   * Initializes and loads all font textures and character maps.
   */
  public async load(basePath = './assets'): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const [asciiImg, accentedImg, nonlatinImg, defaultJson] = await Promise.all([
        this.loadImage(`${basePath}/textures/font/ascii.png`),
        this.loadImage(`${basePath}/textures/font/accented.png`).catch(() => null),
        this.loadImage(`${basePath}/textures/font/nonlatin_european.png`).catch(() => null),
        fetch(`${basePath}/font/default.json`).then(r => r.json()).catch(() => null),
      ]);

      this.sheets['ascii'] = asciiImg;
      if (accentedImg) this.sheets['accented'] = accentedImg;
      if (nonlatinImg) this.sheets['nonlatin'] = nonlatinImg;

      this.vanillaSheets['ascii'] = asciiImg;
      if (accentedImg) this.vanillaSheets['accented'] = accentedImg;
      if (nonlatinImg) this.vanillaSheets['nonlatin'] = nonlatinImg;

      // Map providers from default.json (ascii, accented, nonlatin_european)
      if (defaultJson && defaultJson.providers) {
        for (const provider of defaultJson.providers) {
          if (provider.type === 'bitmap' && provider.chars && provider.file) {
            let sheetName: 'ascii' | 'accented' | 'nonlatin' = 'nonlatin';
            if (provider.file.includes('accented')) sheetName = 'accented';
            else if (provider.file.includes('ascii')) sheetName = 'ascii';

            const rows = provider.chars.length;
            const cols = provider.chars[0].length;
            const img = this.sheets[sheetName];
            const cellHeight = provider.height ?? 8;
            const ascent = provider.ascent ?? 7;
            const yOffset = 7 - ascent;
            let imgData: ImageData | null = null;

            if (img && typeof document !== 'undefined') {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                try {
                  imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                } catch {
                  // ignore
                }
              }
            }

            for (let r = 0; r < rows; r++) {
              const rowStr = provider.chars[r];
              for (let c = 0; c < rowStr.length; c++) {
                const char = rowStr[c];
                if (char === '\u0000') continue;

                let advance = (char === ' ' || char === '\u00a0') ? 4 : this.advances.get(char);
                if (advance === undefined) {
                  let actualWidth = 7;
                  if (imgData && img) {
                    const d = imgData.data;
                    const imgW = img.naturalWidth || img.width;
                    const cellW = Math.floor(imgW / cols);
                    const cellH = Math.floor((img.naturalHeight || img.height) / rows);
                    const scaleRatio = 8 / cellW;
                    for (let w = cellW - 1; w >= 0; w--) {
                      let hasPixel = false;
                      const xPixel = c * cellW + w;
                      for (let y = 0; y < cellH; y++) {
                        const yPixel = r * cellH + y;
                        const alpha = d[(yPixel * imgW + xPixel) * 4 + 3];
                        if (alpha > 0) {
                          hasPixel = true;
                          break;
                        }
                      }
                      if (hasPixel) {
                        actualWidth = Math.round((w + 1) * scaleRatio);
                        break;
                      }
                    }
                  }
                  advance = char === ' ' ? 4 : Math.max(1, actualWidth + 1);
                  this.advances.set(char, advance);
                }

                const rawWidth = char === ' ' ? 4 : Math.max(1, advance - 1);

                this.glyphMap.set(char, {
                  sheet: sheetName,
                  col: c,
                  row: r,
                  colsInSheet: cols,
                  rowsInSheet: rows,
                  cellWidth: 8,
                  cellHeight,
                  yOffset,
                  rawWidth,
                  advance,
                });
              }
            }
          }
        }
      } else {
        // Fallback ASCII 0..255 if default.json is unavailable
        for (let code = 0; code < 256; code++) {
          const char = String.fromCharCode(code);
          const col = code % 16;
          const row = Math.floor(code / 16);
          const advance = this.getAdvance(char, false);
          const rawWidth = char === ' ' ? 4 : Math.max(1, advance - 1);

          this.glyphMap.set(char, {
            sheet: 'ascii',
            col,
            row,
            colsInSheet: 16,
            rowsInSheet: 16,
            cellWidth: 8,
            cellHeight: 8,
            yOffset: 0,
            rawWidth,
            advance,
          });
        }
      }

      this.isLoaded = true;
    })();

    return this.loadPromise;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (typeof Image === 'undefined') {
        resolve({ naturalWidth: 256, naturalHeight: 256, width: 256, height: 256 } as any);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load font image: ${src} (${e})`));
      img.src = src;
    });
  }

  /**
   * Replaces the base font sheets (e.g. ascii, accented, nonlatin) with custom pack textures (such as Lithos HD 32x).
   */
  public async loadFontTextures(textures: {
    ascii?: string | HTMLImageElement;
    accented?: string | HTMLImageElement;
    nonlatin?: string | HTMLImageElement;
  }): Promise<void> {
    const promises: Promise<void>[] = [];

    if (textures.ascii) {
      promises.push(
        (async () => {
          const img = typeof textures.ascii === 'string' ? await this.loadImage(textures.ascii) : textures.ascii;
          if (img) this.sheets['ascii'] = img;
        })()
      );
    }
    if (textures.accented) {
      promises.push(
        (async () => {
          const img = typeof textures.accented === 'string' ? await this.loadImage(textures.accented) : textures.accented;
          if (img) this.sheets['accented'] = img;
        })()
      );
    }
    if (textures.nonlatin) {
      promises.push(
        (async () => {
          const img = typeof textures.nonlatin === 'string' ? await this.loadImage(textures.nonlatin) : textures.nonlatin;
          if (img) this.sheets['nonlatin'] = img;
        })()
      );
    }

    await Promise.all(promises);
    this.tintedSheets.clear();
    this.fallbackCache.clear();
  }

  /**
   * Clears all custom bitmap provider glyphs and cached tinted textures.
   * Leaves base vanilla sheets and calibrated symbol advances intact.
   */
  public resetCustomGlyphs(): void {
    this.customGlyphs.clear();
    this.tintedSheets.clear();
    this.fallbackCache.clear();
  }

  /**
   * Restores base vanilla font textures (ascii, accented, nonlatin) if previously
   * replaced by a custom resource pack.
   */
  public restoreVanillaFontTextures(): void {
    if (this.vanillaSheets['ascii']) this.sheets['ascii'] = this.vanillaSheets['ascii'];
    if (this.vanillaSheets['accented']) this.sheets['accented'] = this.vanillaSheets['accented'];
    if (this.vanillaSheets['nonlatin']) this.sheets['nonlatin'] = this.vanillaSheets['nonlatin'];
    this.tintedSheets.clear();
    this.fallbackCache.clear();
  }

  public async loadFromFontDirectory(fontDir: string): Promise<void> {
    try {
      const resp = await fetch(`${fontDir}/font/default.json`);
      if (!resp.ok) return;
      const json = await resp.json();
      if (!json.providers) return;

      await this.loadBitmapProviders(json.providers, async (file: string) => {
        const textureUrl = `${fontDir}/textures/${file}`;
        return this.loadImage(textureUrl).catch(() => null);
      });
    } catch (err) {
      console.warn(`Could not load fonts from ${fontDir}:`, err);
    }
  }

  public async loadBitmapProviders(
    providers: any[],
    textureResolver: (file: string) => Promise<HTMLImageElement | null>
  ): Promise<void> {
    await Promise.all(
      providers.map(async (provider) => {
        if (provider.type !== 'bitmap' || !provider.file || !provider.chars || provider.chars.length === 0) {
          return;
        }

        try {
          const img = await textureResolver(provider.file);
          if (!img) return;

          const rows = provider.chars.length;
          const cols = provider.chars[0].length;
          if (rows === 0 || cols === 0) return;

          const cellW = Math.floor(img.naturalWidth / cols);
          const cellH = Math.floor(img.naturalHeight / rows);
          if (cellW <= 0 || cellH <= 0) return;

          const targetHeight = provider.height ?? 8;
          const ascent = provider.ascent ?? 7;
          const pixelScale = targetHeight / cellH;
          const yOffset = 7 - ascent;

          let isColor = false;
          let imgData: ImageData | null = null;

          if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              try {
                imgData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
                const d = imgData.data;
                for (let p = 0; p < d.length; p += 4) {
                  if (d[p + 3] > 0 && (Math.abs(d[p] - d[p + 1]) > 8 || Math.abs(d[p + 1] - d[p + 2]) > 8)) {
                    isColor = true;
                    break;
                  }
                }
              } catch {
                // ignore
              }
            }
          }

          for (let r = 0; r < rows; r++) {
            const rowStr = provider.chars[r];
            for (let c = 0; c < rowStr.length; c++) {
              const char = rowStr[c];
              if (!char || char === '\u0000' || IGNORED_BITMAP_CHARS.has(char)) continue;

              let actualWidth = cellW;
              if (imgData) {
                const d = imgData.data;
                const imgW = img.naturalWidth;
                for (let w = cellW - 1; w >= 0; w--) {
                  let hasPixel = false;
                  const xPixel = c * cellW + w;
                  for (let y = 0; y < cellH; y++) {
                    const yPixel = r * cellH + y;
                    const alpha = d[(yPixel * imgW + xPixel) * 4 + 3];
                    if (alpha > 0) {
                      hasPixel = true;
                      break;
                    }
                  }
                  if (hasPixel) {
                    actualWidth = w + 1;
                    break;
                  }
                }
              }

              const advance = Math.max(1, Math.floor(0.5 + actualWidth * pixelScale) + 1);
              const dWidth = Math.round(cellW * pixelScale);
              const dHeight = targetHeight;

              this.customGlyphs.set(char, {
                image: img,
                sx: c * cellW,
                sy: r * cellH,
                sWidth: cellW,
                sHeight: cellH,
                dWidth,
                dHeight,
                yOffset,
                advance,
                ascent,
                isColor,
                file: provider.file,
              });

              this.advances.set(char, advance);
            }
          }
        } catch (e) {
          console.warn(`Failed loading provider for ${provider.file}:`, e);
        }
      })
    );
  }

  private getTintedCustomImage(file: string, img: HTMLImageElement, colorHex: string): HTMLCanvasElement | null {
    const cacheKey = `custom_${file}_${colorHex.toLowerCase()}`;
    if (this.tintedSheets.has(cacheKey)) {
      return this.tintedSheets.get(cacheKey)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.tintedSheets.set(cacheKey, canvas);
    return canvas;
  }

  public getTintedSheet(sheetName: string, colorHex: string): HTMLCanvasElement | null {
    const original = this.sheets[sheetName];
    if (!original) return null;

    const cacheKey = `${sheetName}_${colorHex.toLowerCase()}`;
    if (this.tintedSheets.has(cacheKey)) {
      return this.tintedSheets.get(cacheKey)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = original.width;
    canvas.height = original.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(original, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.tintedSheets.set(cacheKey, canvas);
    return canvas;
  }

  /**
   * Retrieves glyph rendering information.
   * If the character exists in Minecraft's bitmap font sheets, blits from the sheet.
   * If the character is any extended Unicode symbol (Unifont, CJK, runes, math symbols),
   * dynamically generates a pixelated fallback glyph matching Minecraft's Unifont style!
   */
  public getGlyphDrawInfo(char: string, colorHex: string, isBold: boolean): GlyphDrawInfo | null {
    // 1. Check custom bitmap provider glyphs (e.g. from server resource pack default.json)
    const custom = this.customGlyphs.get(char);
    if (custom) {
      let imgToDraw: HTMLImageElement | HTMLCanvasElement = custom.image;
      if (!custom.isColor && colorHex.toLowerCase() !== '#ffffff') {
        const tinted = this.getTintedCustomImage(custom.file, custom.image, colorHex);
        if (tinted) imgToDraw = tinted;
      }
      return {
        image: imgToDraw,
        sx: custom.sx,
        sy: custom.sy,
        sWidth: custom.sWidth,
        sHeight: custom.sHeight,
        dWidth: custom.dWidth,
        dHeight: custom.dHeight,
        yOffset: custom.yOffset,
        advance: isBold ? custom.advance + 1 : custom.advance,
        ascent: custom.ascent,
      };
    }

    // 2. Check standard Minecraft bitmap sheets
    const entry = this.glyphMap.get(char);
    if (entry) {
      const sheetCanvas = this.getTintedSheet(entry.sheet, colorHex);
      if (sheetCanvas) {
        const cellW = sheetCanvas.width / entry.colsInSheet;
        const cellH = sheetCanvas.height / entry.rowsInSheet;
        const sx = entry.col * cellW;
        const sy = entry.row * cellH;

        return {
          image: sheetCanvas as unknown as HTMLImageElement,
          sx,
          sy,
          sWidth: cellW,
          sHeight: cellH,
          dWidth: entry.cellWidth ?? 8,
          dHeight: entry.cellHeight ?? 8,
          yOffset: entry.yOffset ?? 0,
          advance: isBold ? entry.advance + 1 : entry.advance,
          ascent: 7,
        };
      }
    }

    // 3. Dynamic Unicode Fallback (covers Unifont, CJK, Math, Runes, Emojis, etc.)
    return this.getOrCreateFallbackGlyph(char, colorHex, isBold);
  }

  /**
   * Generates a crisp, pixelated Minecraft-style fallback glyph for extended Unicode characters.
   * Renders at 16px (Unifont native grid) and binarizes pixel alpha to eliminate anti-aliasing blur.
   */
  private getOrCreateFallbackGlyph(char: string, colorHex: string, isBold: boolean): GlyphDrawInfo {
    const cacheKey = `${char}_${colorHex}_${isBold}`;
    if (this.fallbackCache.has(cacheKey)) {
      return this.fallbackCache.get(cacheKey)!;
    }

    const advance = this.getAdvance(char, isBold);
    const cellW = 16;
    const cellH = 16;

    const canvas = document.createElement('canvas');
    canvas.width = cellW;
    canvas.height = cellH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = colorHex;

      const code = char.charCodeAt(0);
      if (code >= 0x2580 && code <= 0x2588) {
        // Block elements: draw exact solid geometric pixel blocks without system font margins
        if (code === 0x2580) {
          // Upper half block
          ctx.fillRect(0, 0, 16, 8);
        } else {
          // Lower 1/8 to 8/8 blocks (U+2581..U+2588)
          const eighths = code - 0x2580; // 1 to 8
          const blockH = eighths * 2;
          ctx.fillRect(0, 16 - blockH, 16, blockH);
        }
      } else {
        ctx.font = `${isBold ? 'bold ' : ''}16px "Unifont", "Minecraftia", monospace, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(char, 0, 13);
      }

      // Eliminate subpixel anti-aliasing blur and crooked lines by thresholding alpha
      try {
        const imgData = ctx.getImageData(0, 0, cellW, cellH);
        const data = imgData.data;

        // Parse colorHex into RGB
        let r = 0;
        let g = 0;
        let b = 0;
        if (colorHex.startsWith('#') && colorHex.length >= 7) {
          r = parseInt(colorHex.slice(1, 3), 16) || 0;
          g = parseInt(colorHex.slice(3, 5), 16) || 0;
          b = parseInt(colorHex.slice(5, 7), 16) || 0;
        }

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha >= 70) {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
          } else {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } catch {
        // Fallback for mock environments without getImageData
      }
    }

    const drawInfo: GlyphDrawInfo = {
      image: canvas as unknown as HTMLImageElement,
      sx: 0,
      sy: 0,
      sWidth: cellW,
      sHeight: cellH,
      dWidth: 8,
      dHeight: 8,
      advance,
      ascent: 7,
    };

    this.fallbackCache.set(cacheKey, drawInfo);
    return drawInfo;
  }
}

export const defaultGlyphAtlas = new GlyphAtlas();
