// Styles
import './styles/viewer.css';

// Web Component registration
export { BlockgameBookElement, MinecraftBookElement } from './component/blockgame-book';

// High-level Viewer
export {
  BlockgameBookViewer,
  MinecraftBookViewer,
  type BlockgameBookViewerOptions,
  type MinecraftBookViewerOptions,
  type ViewerControlsOptions,
} from './ui/BlockgameBookViewer';
export { BookEditorModal, WYSIWYG_BOOK_EDITOR_ENABLED } from './ui/BookEditorModal';

// Canvas & Rendering
export { BookCanvas, type BookCanvasOptions } from './render/BookCanvas';
export { ContinuousScrollView, type ContinuousScrollViewOptions } from './render/ContinuousScrollView';
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
  JAVA_BOOK_TEXT_WIDTH,
  BEDROCK_BOOK_TEXT_WIDTH,
  getTextWidthForEngine,
  LINE_HEIGHT,
} from './engine/StringSplitter';

export {
  parseFormattedText,
  stripFormatting,
  normalizeFormattingCodes,
  createDefaultStyle,
  type StyleState,
  BLOCKGAME_COLORS,
  MINECRAFT_COLORS,
  COLOR_NAMES,
  DEFAULT_BOOK_TEXT_COLOR,
} from './engine/Formatting';

export {
  GlyphAtlas,
  defaultGlyphAtlas,
  type GlyphMapEntry,
  type CustomBitmapGlyphEntry,
  BLOCKGAME_SYMBOL_ADVANCES,
  MINECRAFT_SYMBOL_ADVANCES,
} from './engine/GlyphAtlas';
export { getBlockgameGlyphSizes, getMinecraftGlyphSizes } from './engine/glyphSizesData';
export {
  ResourcePackManager,
  type ResourcePackInfo,
  type FontTexturePaths,
  type BookTextures,
  type CompositeResourcePack,
  type CompositeFontProviderEntry,
} from './engine/ResourcePackManager';
export { createLithosPack, createCraftadiaPack } from './presets/example-packs';

export {
  splitTextLossless,
  paginateTextLossless,
  isSafeSplitBoundary,
  getSafeSplitBoundary,
  type LosslessSplitOptions,
} from './engine/LosslessSplit';

export {
  PageMemoryManager,
  getBookStorageKey,
} from './engine/PageMemoryManager';

// I/O
export {
  parseBook,
  parseRawTextLossless,
  parseStendhalBook,
  parseScribbleBook,
  parseBedrockBook,
  parseCocoapebblesBook,
  componentToFormattedString,
} from './io/BookParser';

export {
  exportToStendhal,
  exportToBookCopyJson,
  exportToScribbleJson,
  exportToCmiText,
  exportToGiveCommandModern,
  exportToGiveCommandJsonPages,
  exportToGiveCommandLegacy,
  exportToBedrockJson,
  exportToCocoapebblesJson,
  exportToUrlHash,
  importFromUrlHash,
} from './io/BookExporter';

// Types
export type {
  BlockgameBook,
  MinecraftBook,
  FormattedSpan,
  LineLayout,
  GlyphMetric,
  GlyphDrawInfo,
  ViewMode,
  BookAppearance,
  BookEngine,
  BlockgameDyeColor,
  MinecraftDyeColor,
} from './engine/types';

export { BLOCKGAME_DYE_HEX, MINECRAFT_DYE_HEX } from './engine/types';
