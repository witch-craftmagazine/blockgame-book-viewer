# Minecraft Book Viewer Roadmap

This roadmap outlines the technical architecture, milestones, and implementation specifications for `minecraft-book-viewer`.

---

## 🏛️ Architectural Strategy: Web-First Document Fidelity

> **Core Tenet**: While Minecraft in-game books are constrained by modal inventory GUIs and discrete button-click page turns, **web readers and document consumers prioritize continuous vertical scrolling**.
> 
> By decoupling the rendering engine from the display mode, `minecraft-book-viewer` delivers:
> 1. **100% Vanilla Engine Fidelity**: Exact $114\text{px}$ Java / $122\text{px}$ Bedrock line bounds, 14 lines per page, space advance metrics, formatting codes, and ASCII art preservation.
> 2. **Modern Web-First Reading Modes**: Discrete flip-book modes (`single`, `double`) alongside **PDF-style continuous scrolling** (`scroll-single`, `scroll-double`), fluid trackpad/wheel scrolling, touch swiping, and viewport virtualization.

---

## ✅ Completed Milestones

### Priority 1: Bedrock Edition Appearance & Decoupled Architecture - [Completed in v1.1]
- **Bedrock GUI Shell**: $512 \times 256\text{px}$ two-page spread parchment textures, authentic 24x24 turn buttons, 9x9 top-right close 'X', centered parchment tan (`#BCA387`) page indicators.
- **Engine Decoupling**: Separated visual chrome (`appearance: 'java' | 'bedrock'`) from layout geometry (`engine: 'java' | 'bedrock'`), allowing Java books to be read in the Bedrock shell with zero line overflow.
- **Bedrock Engine**: $122\text{px}$ layout boundary, 14 lines per page, and full Bedrock formatting palette (`§g` Minecoin Gold, `§h` Quartz, `§i` Iron, `§j` Netherite, `§p` Gold, `§q` Emerald, `§s` Diamond, `§t` Lapis, `§u` Amethyst).

### Priority 2: Lossless Text Ingestion & Opt-In Progress - [Completed in v1.2]
- **`LosslessSplit` Engine**: Zero-loss invariant guarantee (`join(pages) === text`), UTF-16 surrogate-pair protection, section-sign (`§`) splitting guards, and bounded soft rollback (paragraphs `\n\n`, newlines `\n`, whitespace `' '`).
- **Web Component Text Ingestion**: `<minecraft-book text="..." split-mode="lossless">` and `.setText()` supporting inline text, raw text, and `<pre>` markup.
- **`PageMemoryManager`**: Deterministic FNV-1a content hashing for `localStorage` progress persistence, strictly opt-in (`persistReadingProgress: false` by default) so landing pages and tutorials reset cleanly on reload.
- **Mobile Export & Web Share**: Native canvas image export and Web Share API integration with PNG download fallback.
- **Core Format Matrix (Implemented)**:
  - **Stendhal** (`.stendhal`): YAML-like multi-page format (`#-` headers).
  - **Scribble JSON** (`.json`): `{ "author": string, "pages": string[] }`.
  - **BookCopy JSON** (`.json`): `{ "title": string, "author": string, "generation": number, "pages": string[] }`.
  - **CMI CustomText** (`.txt`): `<AutoPage>` and `<NextPage>` page separators with `# Title:` / `# Author:` headers.
  - **Modern `/give` SNBT**: Minecraft 1.20.5+ item component syntax (`written_book[written_book_content=...]`).
  - **Legacy `/give` SNBT**: Minecraft 1.13–1.20.4 NBT tag syntax (`written_book{...}`).
  - **URL Hash**: Base64 encoded JSON round-trip for deep linking.
  - **Delimited Text**: Auto-split by `\n---\n` or `=== Page X ===`.

### Priority 3: PDF-Style Continuous Scroll Engine - [Completed in v1.3]
- **Continuous Scroll Display Modes**:
  - `scroll-single`: One-page vertical column with authentic parchment margins and subtle gutters.
  - `scroll-double`: Two-page stacked spreads with center spine gutter and automatic responsive reflow to single column on viewports $< 680\text{px}$.
- **Viewport Virtualization & Constant Memory**:
  - Scroll viewport (`.mc-book-scroll-viewport`) with fixed aspect-ratio placeholder wrappers.
  - `IntersectionObserver` mounting canvas elements only for visible and adjacent pages, releasing off-screen contexts to prevent memory spikes on large books.
- **Floating Badge & Progress Sync**:
  - Dynamic floating progress badge (`Page X of Y` / `Pages X-Y of Z`) positioned at the bottom center.
  - Debounced auto-save integration with `PageMemoryManager` during scroll; auto-scroll on book load when progress persistence is enabled.
- **Keyboard & Navigation**:
  - Smooth scrolling with `ArrowUp`, `ArrowDown`, `PageUp`, `PageDown`, `Space`, `Home`, and `End`.
  - Programmatic API: `scrollToPage(pageNumber, options)`.

### Priority 4: Themes & Accessibility - [Completed in v1.4]
- **Bedrock High-Contrast Theme** *(experimental)*:
  - Authentic high-contrast slate background texture (`#1C1C24`), high-contrast pure white text (`#FFFFFF`), and yellow navigational accents (`#FFFF55`).
  - Canvas rendering is active via the `highContrast: true` option / `high-contrast` attribute **only when `experimental` is also set**. Default text (`#000000`) is drawn white so it stays readable on the slate.
  - Container styling responds to `theme="high-contrast"` and the `@media (prefers-contrast: more)` query without the flag.
- *(Note on MC-61489: Evaluated and confirmed not applicable — MC-61489 was an in-game OpenGL/LWJGL projection matrix bug in vanilla Minecraft's `BookScreen.java`; HTML5 canvas rendering uses CSS pixel ratio scaling and is unaffected).*

### Priority 5: Format Expansion & Interchange - [Completed in v1.5]
- **Bedrock Book JSON (`WritableBookContent`)**:
  - Native parser and exporter for Bedrock Edition book payloads: `{ "title": string, "author": string, "pages": [ { "text": string, "photoname"?: string } ] }`.
  - Export modal and import modal integration.
- **Spigot & Server Formats (`cocoapebbles-book`)**:
  - Web plugin JSON format support: `{ "id": string, "title": string, "author": string, "pages": string[] }`.
  - Ingestion of `<br/>` HTML/text page break tags generated by web-based book editors.
  - Preservation of server-assigned book identifier (`id`) in metadata and export.

### Priority 6: Aesthetic & Scholar Extensions - [Completed in v1.6]
- **Scholar-Style Dye Covers & Bookmarks** *(experimental, opt-in via `experimental`)*:
  - All 16 authentic Minecraft dye colors supported via `coverColor` option / `cover-color` attribute.
  - Classic silk ribbon bookmark (`showBookmark`, `bookmarkColor`, `bookmark` attribute) hanging from the bottom center of open books with authentic V-notch styling.
  - Ignored unless the `experimental` flag is set, so the default rendering stays vanilla-accurate. Not shown in the web component preview configurator.

---

## ⚡ Future & Backlog Ideas

### Advanced Media Plugins (External Ecosystem)
- **`DrawInBooks` & `ImagineBook` Hooks**: Keep core package lightweight and focused on vanilla parity while offering pluggable canvas hooks for 3-bit sketches or inline images.
- **`flexibook` Custom Component Pack Ingestion**: Advanced rich component-based book loading when requested by community servers.

---

## 📅 Phased Release Plan

| Phase | Milestone | Focus Areas | Target Capabilities | Status |
| :---: | :--- | :--- | :--- | :---: |
| **v1.1** | **Bedrock Edition GUI & Engine** | Appearance & Parity | $512\times256$ Bedrock textures, decoupled engine, $122\text{px}$ line wrapping, Bedrock color codes (`§g`–`§u`) | ✅ Done |
| **v1.2** | **Lossless Splitting & Ingestion** | Engine & Web Component | `LosslessSplit` engine (`join(pages) === text`), `<minecraft-book text="...">`, opt-in `PageMemoryManager` | ✅ Done |
| **v1.3** | **Continuous Scroll Reader** | Web UX & Ergonomics | PDF-style `scroll-single` and `scroll-double` continuous scroll, DOM virtualization, floating page badge, scroll persistence | ✅ Done |
| **v1.4** | **Themes & Accessibility** | Accessibility & UX | Bedrock high-contrast accessibility theme (experimental), slate parchment, `prefers-contrast` support | ✅ Done |
| **v1.5** | **Format Interchange** | Serialization | Bedrock Book JSON (`WritableBookContent`), Spigot JSON (`cocoapebbles-book`), `<br/>` splitting | ✅ Done |
| **v1.6** | **Aesthetic & Scholar Extensions** | Customization & Art | 16 Minecraft dye cover tints and silk ribbon bookmark (both experimental) | ✅ Done |
