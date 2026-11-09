# Minecraft Book Viewer & Web Engine

A modular, pixel-perfect, zero-dependency Minecraft written book web emulator, renderer, and Web Component. Designed to allow any website to embed and render authentic Minecraft books with custom resource packs, accurate typography, page-turn sounds, and multi-format import/export.

![Demo](public/assets/textures/gui/book.png)

## Features

- 📖 **Authentic Minecraft Book GUI**: Pixel-perfect rendering of Minecraft written books in single-page (1:1 in-game GUI) and two-page spread (magazine/tome) modes.
- 🔤 **High-Fidelity Typography**:
  - Exact 114px line wrapping and 14 lines/page pagination matching vanilla `StringSplitter.java`.
  - Full support for Minecraft formatting codes (`§0`–`§f`, `§l`, `§o`, `§n`, `§m`, `§k` animated obfuscation, `§r`).
  - Extended color support for Bedrock Edition and hex colors (`§x...`).
  - Accurate glyph advances and side-bearings for Unicode, CJK, and Unifont glyphs.
- 🎨 **Resource Pack System**:
  - Minecraft-faithful prioritized resource pack stack (`[Vanilla, ...CustomPacks]`) with cascading texture and font conflict resolution.
  - Dynamically load any Minecraft resource pack `.zip` file from disk or remote URL.
  - Custom bitmap font provider and HD texture sheet support.
- 📦 **Multi-Format Book I/O**:
  - **Stendhal** (`.stendhal` files)
  - **BookCopy** (`.json` files)
  - **CMI BookExport** (`.txt` files with `<NextPage>` / `<AutoPage>`)
  - **Vanilla `/give` commands** (both modern 1.20.5+ item components and 1.13-1.20.4 NBT syntax)
  - **Plain Text / Markdown**
  - **URL Hash Sharing** (zero-backend instant link sharing)
- 🧩 **Extensible Plugin System**:
  - Lifecycle hooks for custom rendering, animations, character replacements, and click handling.
  - Ships with `WitchcraftPlugin` (custom animated ending page celebration GIF and interactive hooks).
- 🌐 **Web Component `<minecraft-book>`**:
  - Drop a single `<script>` tag on any HTML page, React, Vue, Svelte, or WordPress site.
- 🔊 **Web Audio Sound Effects**: Realistic page-turn sounds with synthesized audio fallback.
- ♿ **Accessibility**: Invisible DOM text overlay with ARIA labels for screen readers and selectable text.

---

## Quick Start

### 1. Web Component (HTML / CDN)

Include the script and stylesheet, then use the `<minecraft-book>` tag:

```html
<link rel="stylesheet" href="https://unpkg.com/minecraft-book-viewer/dist/style.css" />
<script type="module" src="https://unpkg.com/minecraft-book-viewer/dist/minecraft-book-viewer.js"></script>

<!-- Load from a remote .stendhal, .json, or .txt file -->
<minecraft-book
  src="./assets/books/rules.stendhal"
  view-mode="double"
  controls="true"
  sound="true">
</minecraft-book>

<!-- Or embed inline book content -->
<minecraft-book view-mode="double">
  <script type="text/plain">
    title: Server Rules
    author: Steve
    pages:
    #- §1§lWelcome!
    §0Rule 1: Be nice.
    Rule 2: Have fun!
  </script>
</minecraft-book>
```

### 2. JavaScript / TypeScript API

```bash
npm install minecraft-book-viewer
# or
bun add minecraft-book-viewer
```

```typescript
import { MinecraftBookViewer, parseBook } from 'minecraft-book-viewer';
import 'minecraft-book-viewer/style.css';

// 1. Mount to any container
const container = document.getElementById('book-container')!;
const viewer = new MinecraftBookViewer(container, {
  viewMode: 'double', // 'single' | 'double' | 'auto'
  theme: 'dark',      // 'dark' | 'light' | 'parchment' | 'minimal'
  controls: true,     // built-in toolbar
  book: {
    title: 'The Great Journey',
    author: 'Alex',
    pages: [
      '§2Chapter 1\n\nOnce upon a time in a blocky world...',
      '§3Chapter 2\n\nDeep beneath the surface...'
    ]
  }
});

await viewer.init();

// 2. Programmatic controls
viewer.nextPage();
viewer.prevPage();
viewer.setPage(0);
```

### 3. Low-Level Canvas Renderer

```typescript
import { BookCanvas, defaultGlyphAtlas } from 'minecraft-book-viewer';

const canvas = new BookCanvas({
  container: document.getElementById('canvas-wrapper')!,
  defaultViewMode: 'double',
  onPageChange: (current, total) => console.log(`Page ${current + 1} of ${total}`)
});

await canvas.init();
canvas.setBook({ title: 'My Book', author: 'Author', pages: ['Page 1 content'] });
```

---

## Writing a Custom Plugin

Plugins let you hook into the rendering cycle to add animations, interactive elements, or custom graphics:

```typescript
import { BookPlugin, BookCanvas } from 'minecraft-book-viewer';

const myCustomPlugin: BookPlugin = {
  name: 'gold-text-glow',
  onRenderChar(ctx, { char, x, y, style }) {
    if (style.color === '#FFAA00') {
      ctx.shadowColor = 'rgba(255, 170, 0, 0.5)';
      ctx.shadowBlur = 4;
    }
  },
  onClick(x, y, pageIndex, side) {
    console.log(`Clicked on ${side} page at (${x}, ${y})`);
  }
};

const canvas = new BookCanvas({
  container: document.getElementById('canvas-wrapper')!,
  plugins: [myCustomPlugin]
});
```

---

## Loading Custom Resource Packs

```typescript
import { ResourcePackManager } from 'minecraft-book-viewer';

const packManager = new ResourcePackManager('./assets');

// Load from a .zip file
const fileInput = document.querySelector('input[type="file"]')!;
fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const packInfo = await packManager.loadZipResourcePack(file);
    await canvas.applyResourcePack(packInfo);
  }
});
```

---

## Running the Demos

```bash
# Install dependencies
bun install

# Start development server (Playground & Demos)
bun run dev

# Run unit and integration tests (99 tests)
bun test

# Build production library and demo app
bun run build
```

---

## License

MIT
