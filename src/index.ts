// Styles
import './styles/viewer.css';

// Web Component registration
export { MinecraftBookElement } from './component/minecraft-book';

// High-level Viewer
export { MinecraftBookViewer, type MinecraftBookViewerOptions, type ViewerControlsOptions } from './ui/MinecraftBookViewer';
export { BookEditorModal, WYSIWYG_BOOK_EDITOR_ENABLED } from './ui/BookEditorModal';

// Canvas & Rendering
export { BookCanvas, type BookCanvasOptions } from './render/BookCanvas';
export { SoundManager, soundManager } from './render/SoundEffects';

// Plugin System
export type { BookPlugin, PageRect, CharRenderContext, CharRenderResult } from './plugin/BookPlugin';
export { WitchcraftPlugin, type WitchcraftPluginOptions } from './plugins/WitchcraftPlugin';

// Engine
export {
  splitTextToLines,
  measureLineWidth,
  measureSpanWidth,
  paginateLines,
  paginateRawText,
  LINES_PER_PAGE,
  BOOK_TEXT_WIDTH,
  LINE_HEIGHT,
} from './engine/StringSplitter';

export {
  parseFormattedText,
  stripFormatting,
  normalizeFormattingCodes,
  createDefaultStyle,
  type StyleState,
  MINECRAFT_COLORS,
  COLOR_NAMES,
  DEFAULT_BOOK_TEXT_COLOR,
} from './engine/Formatting';

export { GlyphAtlas, defaultGlyphAtlas, type GlyphMapEntry, type CustomBitmapGlyphEntry, MINECRAFT_SYMBOL_ADVANCES } from './engine/GlyphAtlas';
export { ResourcePackManager, type ResourcePackInfo, type FontTexturePaths } from './engine/ResourcePackManager';

// I/O
export {
  parseBook,
  parseStendhalBook,
  componentToFormattedString,
} from './io/BookParser';

export {
  exportToStendhal,
  exportToBookCopyJson,
  exportToCmiText,
  exportToGiveCommandModern,
  exportToGiveCommandLegacy,
  exportToUrlHash,
  importFromUrlHash,
} from './io/BookExporter';

// Types
export type {
  MinecraftBook,
  FormattedSpan,
  LineLayout,
  GlyphMetric,
  GlyphDrawInfo,
  ViewMode,
} from './engine/types';
