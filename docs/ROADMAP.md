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

---

## 🚀 Active Priority: PDF-Style Continuous Scroll Engine (v1.3)

Rather than clicking buttons to flip pages, continuous scroll provides a modern document reading experience tailored for articles, long-form stories, and magazine publications (such as Witchcraft Magazine).

### 1. Continuous Scroll Display Modes
- **One-Page Continuous Scroll (`view-mode="scroll-single"`)**:
  - Pages are stacked in a single vertical column with authentic parchment margins and subtle page separation gutters.
  - Native browser scrolling via mouse wheel, trackpad, and touch swipe.
  - Natural fit for mobile viewports, embedded article sidebars, and responsive containers.
- **Two-Page Spread Continuous Scroll (`view-mode="scroll-double"`)**:
  - Two-page spreads (left + right page with center spine gutter) are stacked vertically with page separators between spreads.
  - Emulates PDF reader "Two Page Scrolling" (e.g. Adobe Acrobat / PDF.js).
  - Responsive reflow: automatically falls back to `scroll-single` on viewports $< 680\text{px}$.
- **Web Component API**:
  - `view-mode="single" | "double" | "scroll-single" | "scroll-double" | "auto"`
  - JavaScript API: `viewer.setViewMode(mode)`, `viewer.getViewMode()`.
  - Programmatic scroll control: `viewer.scrollToPage(pageNumber, { behavior: 'smooth' | 'auto' })`.

### 2. Viewport Virtualization & Memory Efficiency
- **Problem**: Books with 50–100+ pages (or long imported documents) will crash mobile GPU memory if 100 full-resolution canvases are instantiated simultaneously.
- **Solution**:
  - Lightweight scroll container (`.mc-book-scroll-viewport`) containing page wrapper placeholders with fixed aspect ratios ($192 \times 192\text{px}$ or $384 \times 192\text{px}$ scaled).
  - `IntersectionObserver` dynamically mounts canvas rendering only for visible pages plus a 1-spread buffer above and below.
  - Off-screen pages release heavy canvas contexts, keeping memory constant regardless of page count.

### 3. Floating Reader Chrome & Progress Sync
- **Dynamic Floating Page Badge**:
  - In continuous scroll modes, discrete turn arrows fade out.
  - Replaced by an unobtrusive floating page pill (e.g., `Page 14 of 48` or `Spread 7 of 24`) positioned at the bottom or top center.
  - Updates in real-time as the reader scrolls past page intersection thresholds.
- **Seamless `PageMemoryManager` Integration**:
  - When `persistReadingProgress: true` is active, the highest visible page is automatically saved to `localStorage` during scroll (debounced).
  - When reloading the page, the viewer restores reading position by auto-scrolling directly to the saved page.

### 4. Interactive Event Preservation
- JSON text components (`clickEvent: open_url`, `run_command`, `hoverEvent: show_text`) remain fully interactive across all virtualized and scrolled pages.
- Focus and keyboard accessibility: smooth scrolling with `ArrowUp` / `ArrowDown` / `PageUp` / `PageDown` / `Space`.

---

## ⚡ Future Priorities

### Priority 4: Themes & Accessibility (v1.4)
- **Bedrock High-Contrast Accessibility Theme**:
  - High-contrast slate background texture (`bedrock-books/resourcepacks/high_contrast`), `#FFFFFF` high-contrast page text, and `#FFFF55` yellow navigation accents, respecting `prefers-contrast` media queries.
  - Dark mode theme integration for websites embedding `<minecraft-book>`.
- *(Note on MC-61489: Evaluated and rejected as not applicable — MC-61489 was an in-game OpenGL/LWJGL projection matrix bug in vanilla Minecraft's `BookScreen.java` odd-height screen division; HTML5 canvas rendering in the browser uses standard CSS pixel ratio scaling and is unaffected).*

### Priority 5: Format Expansion & Interchange (v1.5)
- **Bedrock Book JSON (`WritableBookContent`)**:
  - Native import and export for Bedrock Edition book payloads (Bedrock Dedicated Server, Geyser/Floodgate, and Bedrock client data).
  - Schema: `{ "title": string, "author": string, "pages": [ { "text": string, "photoname"?: string } ] }`.
  - Pairs with the completed Bedrock Engine ($122\text{px}$) and Bedrock GUI theme to enable 100% round-trip fidelity for Bedrock readers.
- **Spigot & Server Formats (`cocoapebbles-book`)**:
  - Web plugin JSON format support: `{ "id": string, "title": string, "author": string, "pages": string[] }`.
  - Ingestion of `<br/>` HTML/text page break tags generated by web-based book editors.
  - Preservation of server-assigned book identifier (`id`) in metadata.
- **Evaluated Server Formats**:
  - `flexibook` Pack JSON: Candidate for rich component-based book loading.

### Priority 6: Aesthetic & Art Extensions (Backlog)
- **Scholar-Style Dye Covers & Bookmarks (from `Scholar`)**:
  - 16 Minecraft dye colors for leather covers and spines.
  - Visual bookmark ribbons hanging from the bottom of open books.
- **Braille Graphic Art Support (from `BrailleBooks`)**:
  - Demo fixtures demonstrating 76x56 Unicode Braille (`\u2800`–`\u28FF`) pixel art.
  - Playground Braille art generator tool.
- **Evaluated Media Extensions (Out of Scope in Core)**:
  - `DrawInBooks` (3-bit sketches) & `ImagineBook` (inline images) flagged as out of scope for core; available via custom `BookPlugin` hooks.

---

## 📅 Phased Release Plan

| Phase | Milestone | Focus Areas | Target Capabilities |
| :---: | :--- | :--- | :--- |
| **v1.1** | **Bedrock Edition GUI & Engine** | Appearance & Parity | $512\times256$ Bedrock textures, decoupled engine, $122\text{px}$ line wrapping, Bedrock color codes (`§g`–`§u`) |
| **v1.2** | **Lossless Splitting & Ingestion** | Engine & Web Component | `LosslessSplit` engine (`join(pages) === text`), `<minecraft-book text="...">`, opt-in `PageMemoryManager` |
| **v1.3** | **Continuous Scroll Reader** | Web UX & Ergonomics | PDF-style `scroll-single` and `scroll-double` continuous scroll, DOM virtualization, floating page badge, scroll persistence |
| **v1.4** | **Themes & Accessibility** | Accessibility & UX | Bedrock high-contrast accessibility theme, dark mode parchment, `prefers-contrast` support |
| **v1.5** | **Format Interchange** | Serialization | Bedrock Book JSON (`WritableBookContent`), Spigot JSON, Scholar cover customization |
