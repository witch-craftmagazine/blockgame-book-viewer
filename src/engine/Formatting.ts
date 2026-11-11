import { FormattedSpan } from './types';

export const BLOCKGAME_COLORS: Record<string, string> = {
  '0': '#000000', // Black
  '1': '#0000AA', // Dark Blue
  '2': '#00AA00', // Dark Green
  '3': '#00AAAA', // Dark Aqua
  '4': '#AA0000', // Dark Red
  '5': '#AA00AA', // Dark Purple
  '6': '#FFAA00', // Gold
  '7': '#AAAAAA', // Gray
  '8': '#555555', // Dark Gray
  '9': '#5555FF', // Blue
  'a': '#55FF55', // Green
  'b': '#55FFFF', // Aqua
  'c': '#FF5555', // Red
  'd': '#FF55FF', // Light Purple
  'e': '#FFFF55', // Yellow
  'f': '#FFFFFF', // White
  // Bedrock Edition & Custom Material Colors
  'g': '#DDD605', // Minecoin Gold
  'h': '#E3D4D1', // Quartz
  'i': '#CECACA', // Iron
  'j': '#443A3B', // Netherite
  'p': '#DEB12D', // Gold Material
  'q': '#47A036', // Emerald
  's': '#2CBAA8', // Diamond
  't': '#21497B', // Lapis
  'u': '#9A5CC6', // Amethyst
};

export const COLOR_NAMES: Record<string, string> = {
  '0': 'Black',
  '1': 'Dark Blue',
  '2': 'Dark Green',
  '3': 'Dark Aqua',
  '4': 'Dark Red',
  '5': 'Dark Purple',
  '6': 'Gold',
  '7': 'Gray',
  '8': 'Dark Gray',
  '9': 'Blue',
  'a': 'Green',
  'b': 'Aqua',
  'c': 'Red',
  'd': 'Light Purple',
  'e': 'Yellow',
  'f': 'White',
  'g': 'Minecoin Gold',
  'h': 'Quartz',
  'i': 'Iron',
  'j': 'Netherite',
  'p': 'Gold',
  'q': 'Emerald',
  's': 'Diamond',
  't': 'Lapis',
  'u': 'Amethyst',
};

export const DEFAULT_BOOK_TEXT_COLOR = '#000000';

export interface StyleState {
  color: string;
  bold: boolean;
  italic: boolean;
  underlined: boolean;
  strikethrough: boolean;
  obfuscated: boolean;
}

export function createDefaultStyle(): StyleState {
  return {
    color: DEFAULT_BOOK_TEXT_COLOR,
    bold: false,
    italic: false,
    underlined: false,
    strikethrough: false,
    obfuscated: false,
  };
}

/**
 * Normalizes ampersand color codes (&0-&f, &l-&r) into section sign (§)
 * while preserving escaped ampersands (&&) if needed.
 */
export function normalizeFormattingCodes(input: string): string {
  // Convert &#RRGGBB to §x§r§r§g§g§b§b
  let text = input.replace(/&#([0-9a-fA-F]{6})/g, (_, hex) => {
    return '§x' + hex.split('').map((c: string) => '§' + c).join('');
  });

  // Convert &x&r&r&g&g&b&b to §x§r...
  text = text.replace(/&x(&[0-9a-fA-F]){6}/gi, (match) => {
    return match.replace(/&/g, '§');
  });

  // Convert &0-&f, &g-&j, &p-&u, &k-&o, &r to §
  text = text.replace(/&([0-9a-fA-Fk-oK-OrRg-jG-Jp-uP-U])/g, '§$1');

  return text;
}

/**
 * Parses a string containing § formatting codes into an array of FormattedSpan objects.
 * If activeStyle is provided, its state is mutated in-place to persist formatting across lines.
 */
export function parseFormattedText(rawText: string, activeStyle?: StyleState): FormattedSpan[] {
  const text = normalizeFormattingCodes(rawText);
  const spans: FormattedSpan[] = [];
  const style: StyleState = activeStyle || createDefaultStyle();

  let currentBuffer = '';

  const flush = () => {
    if (currentBuffer.length > 0) {
      spans.push({
        text: currentBuffer,
        color: style.color,
        bold: style.bold,
        italic: style.italic,
        underlined: style.underlined,
        strikethrough: style.strikethrough,
        obfuscated: style.obfuscated,
      });
      currentBuffer = '';
    }
  };

  let i = 0;
  while (i < text.length) {
    if (text[i] === '§') {
      if (i + 1 < text.length) {
        // Check for §x§r§r§g§g§b§b hex color format
        if ((text[i + 1] === 'x' || text[i + 1] === 'X') && i + 13 < text.length) {
          let isHex = true;
          let hexColor = '#';
          for (let h = 0; h < 6; h++) {
            const prefix = text[i + 2 + h * 2];
            const char = text[i + 3 + h * 2];
            if (prefix !== '§' || !/[0-9a-fA-F]/.test(char)) {
              isHex = false;
              break;
            }
            hexColor += char;
          }

          if (isHex) {
            flush();
            style.color = hexColor;
            // In Minecraft, setting a color clears style flags
            style.bold = false;
            style.italic = false;
            style.underlined = false;
            style.strikethrough = false;
            style.obfuscated = false;
            i += 14;
            continue;
          }
        }

        const code = text[i + 1].toLowerCase();
        flush();

        if (code in BLOCKGAME_COLORS) {
          style.color = BLOCKGAME_COLORS[code];
          // Color codes reset style flags in vanilla Minecraft
          style.bold = false;
          style.italic = false;
          style.underlined = false;
          style.strikethrough = false;
          style.obfuscated = false;
        } else {
          switch (code) {
            case 'k':
              style.obfuscated = true;
              break;
            case 'l':
              style.bold = true;
              break;
            case 'm':
              style.strikethrough = true;
              break;
            case 'n':
              style.underlined = true;
              break;
            case 'o':
              style.italic = true;
              break;
            case 'r':
              style.color = DEFAULT_BOOK_TEXT_COLOR;
              style.bold = false;
              style.italic = false;
              style.underlined = false;
              style.strikethrough = false;
              style.obfuscated = false;
              break;
            default:
              // Unknown formatting code: in Minecraft, § and the following character
              // are consumed without altering format or rendering visible text.
              break;
          }
        }
        i += 2;
      } else {
        // Trailing lone § at the end of text: drop it (never render § as printable text)
        i++;
      }
    } else {
      currentBuffer += text[i];
      i++;
    }
  }

  flush();
  return spans;
}

/**
 * Strips all § and & formatting codes from a string.
 */
export function stripFormatting(text: string): string {
  return normalizeFormattingCodes(text)
    .replace(/§x(§[0-9a-fA-F]){6}/gi, '')
    .replace(/§./g, '')
    .replace(/§/g, '');
}
