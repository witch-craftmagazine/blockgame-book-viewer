# Local Dev References & Mod Sources Guide

This document indexes and analyzes the Minecraft book mods and tooling repositories located on-device in:
`~/Documents/Applications/minecraftprojects/bookstuff/`

It highlights projects that are directly useful for extending, testing, and refining **`minecraft-book-viewer`**.

---

## 1. Top Tier: Projects Most Useful for Book-Viewer

| Project | Primary Value to `book-viewer` | Key Files / References |
| :--- | :--- | :--- |
| **`flexibook`** | TypeScript text measuring, Unihex GNU Unifont font parser, HTML-subset tag parsing, adaptive pagination, theme components | `editor/src/shared/McAtlasTextMeasurer.ts`<br>`editor/src/shared/UnihexFont.ts`<br>`editor/src/shared/TagParser.ts` |
| **`double-books`** | Exact vanilla-compatible GUI texture placement & coordinates for two-page spread (mirrored texture math, padding, clickable text hitboxes) | `src/main/java/me/white/doublebooks/mixin/BookScreenMixin.java` |
| **`bedrock-books`** | Authentic Bedrock Edition book textures (`view_background.png`, `edit_background.png`), 122px line wrapping metrics, high-contrast assets | `src/main/resources/.../textures/gui/book/`<br>`src/main/java/.../BedrockBookViewScreen.java` |
| **`DrawInBooks`** | 114x128 3-bit canvas drawing data format in written books; perfect blueprint for a canvas drawing overlay plugin | `paper/src/main/java/com/drawinbooks/paper/DrawingBlob.java`<br>`src/main/java/com/drawinbooks/component/` |
| **`ImagineBook`** | In-book inline image markup `[url,x,y,w%,h%,rot°]` and binary NBT image serialization | `src/main/java/.../ImageSerializer.java`<br>`src/main/java/.../image/ImageData.java` |
| **`Scholar`** | Advanced two-page spread reader screens (`SpreadBookViewScreen`), 16 dye color book cover textures, bookmark UI | `common/src/main/java/.../SpreadBookViewScreen.java`<br>`common/src/main/resources/resourcepacks/` |
| **`CopyPasteBooks`** | Gold-standard lossless text-to-page splitting algorithm (`join(split(text)) == text`), surrogate pair safety, newline preference | `coretests/src/test/java/.../LosslessSplitTest.java` |
| **`Gutencraft`** | Accurate comparative pagination metrics between Java Edition (114px) and Bedrock Edition (122px); Unicode advance tables | `gutencraft/src/commonMain/kotlin/Gutencraft.kt`<br>`gutencraft/src/commonMain/kotlin/Characters.kt` |
| **`BrailleBooks`** | High-density 76x56 image-to-Braille Unicode (`\u2800`–`\u28FF`) art generator; excellent test fixtures for font rasterization | `Examples/Commands/mario.mcfunction`<br>`Examples/Commands/cube.mcfunction` |
| **`book-tweaks`** | Navigation controls: double-page turn buttons (`<<`, `>>`), jump-to-start/end, and book page memory manager | `src/client/java/.../DoublePageButton.java`<br>`src/client/java/.../PageMemoryManager.java` |
| **`FixBookGUI`** | Documents bug MC-61489: half-pixel vertical jitter and alignment fixes across odd GUI heights and display scales | `src/main/java/.../mixins/MixinBookScreen.java` |
| **`bookresizer`** | Multi-resolution scaling calculations for book view screens | `src/main/kotlin/.../BookGuiScale.kt` |

---

## 2. In-Depth Project Breakdowns

### 2.1. `flexibook`
- **Location**: `~/Documents/Applications/minecraftprojects/bookstuff/flexibook/`
- **What it is**: Adaptive layout book engine for modern NeoForge with an Electron/TypeScript companion editor.
- **Why it's useful**:
  - Contains production-ready TypeScript classes in `editor/src/shared/`:
    - `McAtlasTextMeasurer.ts`: Directly measures strings against Minecraft font textures.
    - `UnihexFont.ts`: Parses GNU Unifont / Unihex font ZIPs and extracts glyph bounding boxes and bitmap metrics.
    - `TagParser.ts`: Rich tag parser supporting `[h1]`, `[b]`, `[color=#hex]`, `[img]`, `[link]`.
    - `layout.ts`: Dynamic multi-column and reflowing page layout engine.
- **Actionable integration**: Can inspire an extended formatting plugin or rich markup mode in `minecraft-book-viewer`.

### 2.2. `double-books`
- **Location**: `~/Documents/Applications/minecraftprojects/bookstuff/double-books/`
- **What it is**: Lightweight Fabric client mod displaying written books as open two-page spreads.
- **Why it's useful**:
  - Provides the exact mathematics and pixel offsets for open two-page spreads using vanilla textures:
    ```java
    int TEXTURE_LEFT_PADDING = 20;
    int TEXTURE_RIGHT_PADDING = 90;
    int TEXTURE_WIDTH = 146;
    // Mirrored book texture for the left page:
    drawTexture(instance, sprite, width / 2 - 256 + TEXTURE_LEFT_PADDING, y, u, v, 256, height, -textureWidth, textureHeight);
    // Right page:
    drawTexture(instance, sprite, width / 2 - TEXTURE_LEFT_PADDING, y, u, v, 256, height, textureWidth, textureHeight);
    // Page button and text offsets:
    int start = width / 2 - 256 + TEXTURE_RIGHT_PADDING;
    // Left text: start + 36, Right text: start + TEXTURE_WIDTH + 36
    ```
  - Crucial reference for aligning two-page mode with in-game mod behavior.

### 2.3. `bedrock-books`
- **Location**: `~/Documents/Applications/minecraftprojects/bookstuff/bedrock-books/`
- **What it is**: Client-side Fabric mod bringing Bedrock Edition book UI and controls to Java Edition.
- **Why it's useful**:
  - Provides clean PNG textures for Bedrock book GUI:
    - `assets/eg_bedrock_books/textures/gui/book/view_background.png`
    - `assets/eg_bedrock_books/textures/gui/book/edit_background.png`
    - `assets/eg_bedrock_books/textures/gui/book/lectern_background.png`
    - High-contrast accessibility variants in `resourcepacks/high_contrast/`.
  - Bedrock Edition features a **122px** line boundary rather than Java's **114px**. Supporting Bedrock book mode in `minecraft-book-viewer` requires this width and styling.

### 2.4. `DrawInBooks`
- **Location**: `~/Documents/Applications/minecraftprojects/bookstuff/DrawInBooks/`
- **What it is**: Fabric mod & Paper plugin that allows freehand drawing on book pages.
- **Why it's useful**:
  - Uses a standardized binary bitmap structure stored in `minecraft:custom_data`:
    - Canvas dimensions: **114 x 128 px** (exact text area).
    - Format v2: **3 bits per pixel** (5 ink colors: none, black, red, green, blue).
    - Format v1: **2 bits per pixel** (3 ink colors).
    - Size per page: `114 * 128 * 3 / 8 = 5,472 bytes`.
  - Enables creating a `DrawInBooksPlugin` for `minecraft-book-viewer` that reads this binary blob and renders player sketches directly on book pages.

### 2.5. `ImagineBook`
- **Location**: `~/Documents/Applications/minecraftprojects/bookstuff/ImagineBook/`
- **What it is**: Client-side mod enabling images inside books.
- **Why it's useful**:
  - Defines safe-mode inline syntax in page text:
    `[<url>,<x>,<y>,<width%>,<height%>,<rotation°>]`
    Example: `[https://i.imgur.com/example.png,10,20,50,50,0]`
  - Also defines compact binary NBT serialization for image coordinates and scales.
  - Can be easily parsed and rendered in `minecraft-book-viewer` via a plugin or built-in hook.

### 2.6. `CopyPasteBooks`
- **Location**: `~/Documents/Applications/minecraftprojects/bookstuff/CopyPasteBooks/`
- **What it is**: Highly tested mod for pasting multi-page books into Minecraft.
- **Why it's useful**:
  - `LosslessSplit.java` provides a mathematically proven splitting algorithm:
    - Invariant: `String.join("", pages) == originalText`.
    - Never breaks Unicode surrogate pairs (e.g. emojis `😀`).
    - Prefers cutting at newlines, then spaces, before forcing a mid-word cut.
    - Prevents page starvation (never rolls back more than half a page for a soft break).

### 2.7. `Scholar`
- **Location**: `~/Documents/Applications/minecraftprojects/bookstuff/Scholar/`
- **What it is**: Comprehensive book overhaul mod by Mortuusars.
- **Why it's useful**:
  - Two-page spread reading interface (`SpreadBookViewScreen.java`).
  - Item and block textures for books dyed in all 16 Minecraft colors (`colored_books/assets/scholar/textures/item/`).
  - Bookmarks and customizable covers.

### 2.8. `Gutencraft`
- **Location**: `~/Documents/Applications/minecraftprojects/bookstuff/Gutencraft/`
- **What it is**: Kotlin Multiplatform (Common, JVM, JS) text-to-book formatter.
- **Why it's useful**:
  - Comprehensive character width mappings for Latin, Cyrillic, Greek, Hebrew, Armenian, Runic, and mathematical Unicode symbols.
  - Formal comparison:
    - **Java Edition**: max 114 columns (px), max 14 lines per page, 4px space.
    - **Bedrock Edition**: max 122 columns (px), max 14 lines per page.

### 2.9. `BrailleBooks`
- **Location**: `~/Documents/Applications/minecraftprojects/bookstuff/BrailleBooks/`
- **What it is**: Converts PNG/GIF images into Minecraft books using 8-dot Braille Unicode characters (`\u2800`–`\u28FF`).
- **Why it's useful**:
  - Produces 76x56 resolution pixel art in 100% vanilla written books without mods or resource packs.
  - Contains verified sample `.mcfunction` files (`mario.mcfunction`, `cube.mcfunction`, `loading.mcfunction`) useful as rendering and performance test cases.

---

## 3. Serialization Formats & IO Interchange

| Mod / Tool | Format | Extension / Structure | Status in `book-viewer` |
| :--- | :--- | :--- | :--- |
| **`Stendhal`** | Plain-text YAML with `#- ` markers | `.stendhal` | Fully Supported (`BookParser.ts`, `BookExporter.ts`) |
| **`BookCopy`** | Java record JSON | `.json` (`{ title, author, generation, pages }`) | Fully Supported |
| **`Scribble`** | Modern Fabric/NeoForge JSON | `.json` (`{ author, pages }`) | Fully Supported |
| **`1MB-CMI-BookExport`** | CMI CustomText with `<NextPage>` | `.txt` | Fully Supported |
| **`Vanilla /give`** | SNBT command | 1.21.5+ (SNBT pages), 1.20.5–1.21.4 (JSON-string pages) & Legacy 1.13–1.20.4 | Fully Supported |
| **`cocoapebbles-book`** | REST / Server JSON | `.json` (`{ id, title, author, pages }`) | Compatible with standard JSON parser |
| **`Textbook`** | Preserved-whitespace text | `.txt` | Compatible with continuous text importer |
| **`flexibook`** | Custom component JSON | `.json` (`{ components: { flexibook: {...} } }`) | High-priority candidate for future pack loader |

---

## 4. Complete Index of All 28 Book Projects in `/bookstuff/`

1. **`1MB-CMI-BookExport`**: Paper administration plugin exporting books to CMI CustomText `.txt` files.
2. **`bedrock-books`**: Fabric client mod bringing Bedrock Edition book GUI and 122px layout to Java.
3. **`BlockBookBinder`**: Java desktop app for splitting large texts into clipboard chunks for pasting into books.
4. **`BlockBookBinder-Chilly`**: Fork of BlockBookBinder with updated char width mappings.
5. **`book-tweaks`**: Client mod adding double-page turn buttons (`<<`, `>>`), home/end jumps, and page memory.
6. **`Book-Writer`**: Client mod automating writing long texts into books with `.write` and multi-volume splits.
7. **`bookcopy`**: Fabric mod exporting books to structured JSON records.
8. **`Bookfiller`**: Utility testing book page limits and character boundaries.
9. **`bookmod`**: Historical 1.3–1.4.2 NBT manipulation mod for written books.
10. **`bookpaste`**: Client mod for smart pasting, automatic page splitting, and sign wrapping with Scribble/Scholar adapters.
11. **`bookresizer`**: Mod dynamically adjusting Minecraft GUI scale specifically when book screens open.
12. **`bookutils`**: Mod providing smaller book GUIs and customizable layout scaling.
13. **`BrailleBooks`**: Tool translating images into 76x56 Braille Unicode characters for vanilla written books.
14. **`cocoapebbles-book`**: Spigot plugin hosting an embedded web server and web editor for server books.
15. **`CopyPasteBooks`**: Production-grade Fabric mod with proven lossless text-to-page splitting.
16. **`double-books`**: Fabric mod rendering written books as mirrored two-page spreads.
17. **`DrawInBooks`**: Mod & Paper plugin adding a 114x128 3-bit drawing layer inside written book NBT.
18. **`FixBookGUI`**: Solves MC-61489 odd-height GUI jitter and text displacement.
19. **`flexibook`**: NeoForge mod and companion Electron/TS editor for adaptive rich-text books.
20. **`Gutencraft`**: Kotlin Multiplatform text wrapper comparing Java and Bedrock formatting constraints.
21. **`ImagineBook`**: Mod rendering inline images in books using `[url,x,y,w,h,rot]` markup.
22. **`minecraft-auto-book`**: Python automation script for pasting CJK text into books.
23. **`minecraft-book`**: Python automation tool typing and signing multiple books sequentially.
24. **`minecraftbookeditor`**: Python exploratory scripts, font bitmap dumps, and character width maps.
25. **`Paste-book-text`**: Mod intercepting clipboard paste in `MultilineTextField` to spread across pages.
26. **`Scholar`**: Modern book mod with two-page spread view, bookmarks, and 16 dyed book variants.
27. **`scribble`**: Rich book editing mod with JSON serialization and formatting shortcuts.
28. **`symbol-chat`**: In-game symbol palette and Unicode character input mod.
29. **`text2book`**: Web application converting arbitrary text into Minecraft `/give` commands.
30. **`Textbook`**: Client mod importing and exporting books to text files with newline preservation.
