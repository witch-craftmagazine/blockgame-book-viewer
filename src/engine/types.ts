export interface MinecraftBook {
  title: string;
  author: string;
  generation?: number; // 0 = Original, 1 = Copy of original, 2 = Copy of copy, 3 = Tattered
  pages: string[];     // Array of raw page strings (may contain § or & or plain text)
}

export interface FormattedSpan {
  text: string;
  color: string;           // Hex color like "#000000" or "#55FFFF"
  bold: boolean;           // §l
  italic: boolean;         // §o
  underlined: boolean;     // §n
  strikethrough: boolean;  // §m
  obfuscated: boolean;     // §k
}

export interface LineLayout {
  spans: FormattedSpan[];
  width: number;
}

export interface GlyphMetric {
  char: string;
  pixels: number; // width in pixels
}

export interface GlyphDrawInfo {
  image: HTMLImageElement | HTMLCanvasElement;
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  dWidth?: number;  // destination width on canvas (defaults to sWidth)
  dHeight?: number; // destination height on canvas (defaults to sHeight)
  yOffset?: number; // Y offset relative to line baseline (defaults to 0)
  advance: number;  // distance to advance cursor for next char
  ascent: number;
}

export type ViewMode = 'single' | 'double';
export type BookAppearance = 'java' | 'bedrock';
export type BookEngine = 'java' | 'bedrock';
