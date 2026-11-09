# Minecraft Book Viewer Roadmap

This roadmap outlines upcoming milestones and technical specifications for `minecraft-book-viewer`, informed by local Minecraft Java & Bedrock sources and the mod codebases in `~/Documents/Applications/minecraftprojects/bookstuff/`.

---

## 🏛️ Architectural Strategy: Decoupling Appearance from Engine

> **Key Design Tenet**: Most books people want to view are Java Edition books.
> 
> Therefore, **Bedrock Appearance** (visual GUI theme) and **Bedrock Engine** (text boundary & metrics) are strictly decoupled:
> - **`appearance` (`'java' | 'bedrock'`)**: Controls GUI chrome, parchment textures, buttons, close 'X', spine gutter, and page indicators.
> - **`engine` (`'java' | 'bedrock'`)**: Controls line boundary ($114\text{px}$ vs $122\text{px}$), wrapping logic, and pagination.
> 
> By defaulting to `engine: 'java'`, users can view any standard Minecraft Java book with 100% pagination fidelity ($114\text{px}$, matching in-game `StringSplitter.java` and preserving ASCII art) inside the Bedrock GUI shell—just like the on-device `bedrock-books` mod does in Minecraft Java Edition.

---

## 🎯 Priority 1: Bedrock Edition Appearance (GUI Shell) - [Completed]

The primary objective is first-class, authentic Bedrock Edition book GUI styling that can wrap either Java or Bedrock books.

### 1.1 Authentic Bedrock GUI Textures & Layout
- **Assets to integrate** (from [`bedrock-books`](file://~/Documents/Applications/minecraftprojects/bookstuff/bedrock-books/src/main/resources/assets/eg_bedrock_books/textures/gui/book/)):
  - `view_background.png` ($512 \times 256\text{px}$ 2-page spread).
  - `edit_background.png` (interactive authoring view).
  - Sprites:
    - 24x24 square turn buttons: `page_backward.png` and `page_forward.png` with hover/focus states.
    - 9x9 top-right close 'X': `close.png` / `close_hover.png`.
    - Centered bottom "Done" button ($200\text{px}$ wide).
- **Coordinate & Spacing Parity**:
  - Spine center gutter: `CENTER_PADDING = 22px`.
  - Page indicator: Centered above each page column (e.g. `1 of 10` on left, `2 of 10` on right) rendered in `#BCA387` (parchment tan), rather than Java's top-right right-aligned position.
  - Page button offsets: Bottom outer margins ($y = \text{height}/2 + 47$).
  - Text area: $114\text{px}$ centered inside each page panel when running the Java engine.

### 1.2 High-Contrast Bedrock Accessibility Theme
- Support Bedrock's built-in High-Contrast mode (from `bedrock-books/resourcepacks/high_contrast`):
  - Inverted dark slate background texture.
  - `#FFFFFF` high-contrast page text.
  - `#FFFF55` (soft yellow) page numbers and navigation indicators.

### 1.3 API & Component Ergonomics
- Add `appearance="bedrock" | "java"` and `engine="java" | "bedrock"` attributes to `<minecraft-book>`.
- Add appearance switch in playground UI toolbar to easily toggle between Java and Bedrock rendering.

---

## 📐 Priority 2: Bedrock Engine (Dedicated Layout Mode)

For native Bedrock books and export:

### 2.1 Line Width ($122\text{px}$) & Wrapping
- When `engine: 'bedrock'` is explicitly requested:
  - Line boundary expands from $114\text{px}$ to **$122\text{px}$** (as measured in `Gutencraft.kt` and `bedrock-books`).
  - Max 14 lines per page maintained.
- When `engine: 'java'` (default) is active:
  - Preserves exact vanilla $114\text{px}$ text boundary, ensuring ASCII art and existing book layouts never overflow.

### 2.2 Bedrock Formatting Colors
Full visual parity for Bedrock-specific color codes:
- `§g`: Minecoin Gold (`#DDD605`)
- `§h`: Quartz (`#E3D4D1`)
- `§i`: Iron (`#CECACA`)
- `§j`: Netherite (`#443A3B`)
- `§p`: Gold Material (`#DEB12D`)
- `§q`: Emerald (`#47A036`)
- `§s`: Diamond (`#2CBAA8`)
- `§t`: Lapis (`#21497B`)
- `§u`: Amethyst (`#9A5CC6`)

---

## 🧩 Priority 3: Unicode Art & Evaluated Extensions

### 3.1 Braille Graphic Art Support & Samples
- **Source**: `BrailleBooks` (`Examples/Commands/`).
- **Feature**:
  - Integrate test fixtures and sample books demonstrating 76x56 Unicode Braille (`\u2800`–`\u28FF`) pixel art.
  - 100% vanilla written book compatible without mods or custom resource packs.
  - Add Braille art generator utility into playground tools.

### 3.2 Evaluated Media Extensions (Out of Scope / Not Supported in Core)
- **`DrawInBooks` (Hand-Drawn 3-Bit Sketches)**:
  - *Status*: **Evaluated — Possible via Custom `BookPlugin`, but NOT Supported in Core**.
  - *Rationale*: Requires custom binary payload in `minecraft:custom_data` and is not part of vanilla Minecraft. Excluded from core to preserve lightweight bundle size and pure vanilla fidelity. Third parties can implement via `onAfterRenderPage` hook if desired.
- **`ImagineBook` (Inline Images `[url,x,y,w,h,rot]`)**:
  - *Status*: **Evaluated — Possible via Custom `BookPlugin`, but NOT Supported in Core**.
  - *Rationale*: Mod-specific inline image tagging deviates from vanilla formatting. Excluded from core; developers requiring image rendering can implement a custom `BookPlugin`.

---

## ⚡ Priority 4: Navigation, Ergonomics & Multi-Resolution Scaling

### 4.1 Advanced Navigation Controls (from `book-tweaks`)
- Add fast navigation buttons in toolbar:
  - Jump to Start (`|<`) and Jump to End (`>|`).
  - Fast page skipping (`<<` and `>>` for 2-page or 10-page jumps).

### 4.2 `PageMemoryManager` (Configurable Opt-In Reading Progress)
- **Optional & Off by Default**: `persistReadingProgress?: boolean` (default: `false`).
- **Developer Control**:
  - Embedders and website developers often want books to reset to page 1 when the page reloads (e.g. for landing pages, portfolio showcases, or documentation tutorials).
  - When explicitly enabled (`persistReadingProgress: true` or `<minecraft-book persist-progress>`), saves reading position in `localStorage` keyed by book title or hash.
  - Supports programmatic reset: `viewer.clearReadingProgress()`.

### 4.3 Scholar-Style Bookmarks & Covers (from `Scholar`)
- 16 Minecraft dye colors for book covers and spines.
- Visual bookmark ribbons hanging from the bottom of open books.

### 4.4 MC-61489 Anti-Jitter Subpixel Alignment (from `FixBookGUI`)
- Prevent vertical 1px text jitter during viewport resize by anchoring canvas scaling to even pixel boundaries.

---

## 📦 Priority 5: Advanced Splitting & Interchange

### 5.1 Lossless Text-to-Page Splitting (from `CopyPasteBooks`)
- Upgrade plain-text auto-pagination with `LosslessSplit`:
  - **Zero-Loss Invariant**: Guarantees `String.join("", pages) === originalText`.
  - **Surrogate-Pair Safety**: Eliminates corrupt glyph crashes (e.g. `\uFFFD`) caused by slicing 4-byte Unicode characters (emojis `😀`, `💎`) between high and low surrogates.
  - **Soft Rollback Heuristics**: Automatically cuts at natural paragraph breaks (`\n\n`) or words (` `) instead of awkwardly splitting words across page turns (e.g., "dis-" on page 1, "cussion" on page 2).
  - **Bounded Starvation Prevention**: Never rolls back more than a fraction of a page, ensuring pages remain well-utilized even when dealing with long paragraphs.
  - **Lossless Round-Trip**: Enables users to paste long documents or import raw text files and export them to Minecraft `/give` commands or JSON without losing spaces, newlines, or formatting.

### 5.2 Format Support Expansion
- **Bedrock Book JSON**: Import/export compatible with Bedrock `WritableBookContent` schemas.
- **`cocoapebbles-book` JSON**: Support Spigot web server book format.
- **`flexibook` Pack JSON**: Candidate for rich component-based book loading.

---

## 📅 Phased Release Plan

| Phase | Milestone | Focus Areas | Target Capabilities |
| :---: | :--- | :--- | :--- |
| **v1.1** | **Bedrock Edition GUI** | Appearance & Layout | $512\times256$ Bedrock textures, $122\text{px}$ line wrapping, Bedrock buttons, close 'X', centered page indicators |
| **v1.2** | **Bedrock High-Contrast & Themes** | Accessibility & Fonts | High-contrast Bedrock mode, Bedrock color palette completion, theme switcher |
| **v1.3** | **Navigation & Ergonomics** | Navigation & Progress | Jump-to-start/end buttons, optional `PageMemoryManager` (`persistReadingProgress`), Braille art sample fixtures |
| **v1.4** | **Lossless Splitting & Interchange** | Engine & Pagination | `LosslessSplit` engine (`join(pages) === text`), Bedrock JSON import/export, Spigot format support |
