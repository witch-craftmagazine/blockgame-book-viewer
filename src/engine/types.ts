export interface BlockgameBook {
  id?: string;         // Optional server-assigned identifier (e.g. Spigot cocoapebbles-book)
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

export type ViewMode = 'single' | 'double' | 'scroll-single' | 'scroll-double';
export type BookAppearance = 'java' | 'bedrock';
export type BookEngine = 'java' | 'bedrock';

export type BlockgameDyeColor =
  | 'white'
  | 'orange'
  | 'magenta'
  | 'light_blue'
  | 'yellow'
  | 'lime'
  | 'pink'
  | 'gray'
  | 'light_gray'
  | 'cyan'
  | 'purple'
  | 'blue'
  | 'brown'
  | 'green'
  | 'red'
  | 'black';

export const BLOCKGAME_DYE_HEX: Record<BlockgameDyeColor, string> = {
  white: '#F9FFFE',
  orange: '#F9801D',
  magenta: '#C74EBD',
  light_blue: '#3AB3DA',
  yellow: '#FED83D',
  lime: '#80C71F',
  pink: '#F38BAA',
  gray: '#474F52',
  light_gray: '#9D9D97',
  cyan: '#169C9C',
  purple: '#8932B8',
  blue: '#3C44AA',
  brown: '#835432',
  green: '#5E7C16',
  red: '#B02E26',
  black: '#1D1D21',
};
