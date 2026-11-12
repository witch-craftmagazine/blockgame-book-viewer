# Blockgame Book Viewer & Web Engine

[![CI](https://github.com/witch-craftmagazine/blockgame-book-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/witch-craftmagazine/blockgame-book-viewer/actions/workflows/ci.yml)
[![Demo](https://github.com/witch-craftmagazine/blockgame-book-viewer/actions/workflows/deploy.yml/badge.svg)](https://witch-craftmagazine.github.io/blockgame-book-viewer/)
[![npm](https://img.shields.io/npm/v/blockgame-book-viewer.svg)](https://www.npmjs.com/package/blockgame-book-viewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.2+-black?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue?logo=typescript)](https://www.typescriptlang.org/)

A modular, pixel-perfect, zero-dependency blockgame written book web emulator, renderer, and Web Component. Designed to allow any website to embed and render authentic written books with custom resource packs, accurate typography, page-turn sounds, and multi-format import/export.

[**Explore Live Demo & Interactive Workbench →**](https://witch-craftmagazine.github.io/blockgame-book-viewer/)

> [!TIP]
> **Try the Workbench:** Visit [witch-craftmagazine.github.io/blockgame-book-viewer](https://witch-craftmagazine.github.io/blockgame-book-viewer/) to test custom text splitting, toggle between Java and Bedrock editions, upload `.zip` resource packs, and edit book markup live.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [1. Web Component (`<blockgame-book>`)](#1-web-component-html--cdn)
  - [2. JavaScript / TypeScript API](#2-javascript--typescript-api)
  - [3. Framework Integration (React, Next.js, Vue)](#3-framework-integration)
  - [4. Low-Level Canvas Renderer](#4-low-level-canvas-renderer)
- [Web Component Reference](#web-component-reference)
  - [Attributes & Properties](#supported-attributes)
  - [Easter Eggs](#easter-eggs)
  - [Experimental Features](#experimental-features)
- [Writing a Custom Plugin](#writing-a-custom-plugin)
- [Loading Custom Resource Packs](#loading-custom-resource-packs)
- [Documentation & Guides](#documentation--guides)
- [Development & Testing](#development--testing)
- [License](#license)

---

## Features

- 📖 **Authentic Book GUI**: Pixel-perfect rendering of written books in single-page (1:1 in-game GUI) and two-page spread (magazine/tome) modes.
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
  - **Vanilla `/give` commands** (1.21.5+ SNBT text components incl. 26.x, 1.20.5–1.21.4 item components with JSON string pages, and 1.13–1.20.4 NBT syntax)
  - **Plain Text / Markdown**
  - **URL Hash Sharing** (zero-backend instant link sharing)
- 🧩 **Extensible Plugin System**:
  - Lifecycle hooks for custom rendering, animations, character replacements, and click handling.
  - Built-in, opt-in easter eggs: animated characters (e.g. blinking eyes) and image on blank final page.
- 🌐 **Web Component `<blockgame-book>`**:
  - Zero-configuration drop-in tag for HTML, React, Next.js, Vue, Svelte, or WordPress.
- 🔊 **Web Audio Sound Effects**: Realistic page-turn sounds with synthesized audio fallback.
- ♿ **Accessibility**: Invisible DOM text overlay with ARIA labels for screen readers and selectable text.

---

## Installation

### Package Manager

```bash
# npm
npm install blockgame-book-viewer

# pnpm
pnpm add blockgame-book-viewer

# yarn
yarn add blockgame-book-viewer

# bun
bun add blockgame-book-viewer
```

### CDN / Standalone Script

```html
<!-- unpkg -->
<link rel="stylesheet" href="https://unpkg.com/blockgame-book-viewer/dist/style.css" />
<script type="module" src="https://unpkg.com/blockgame-book-viewer/dist/blockgame-book-viewer.js"></script>

<!-- jsDelivr -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/blockgame-book-viewer/dist/style.css" />
<script type="module" src="https://cdn.jsdelivr.net/npm/blockgame-book-viewer/dist/blockgame-book-viewer.js"></script>
```

---

## Quick Start

### 1. Web Component (HTML / CDN)

Include the script and stylesheet, then use the `<blockgame-book>` tag:

```html
<link rel="stylesheet" href="https://unpkg.com/blockgame-book-viewer/dist/style.css" />
<script type="module" src="https://unpkg.com/blockgame-book-viewer/dist/blockgame-book-viewer.js"></script>

<!-- Embedded with PDF-style continuous scroll, Bedrock GUI, and reading-progress memory -->
<blockgame-book
  view-mode="scroll-double"
  appearance="bedrock"
  engine="bedrock"
  persist-progress="true"
  controls="true"
  sound="true"
  base-path="https://unpkg.com/blockgame-book-viewer/dist/assets">
  <script type="text/plain">
    title: Server Rules
    author: Steve
    pages:
    #- §1§lWelcome!
    §0Rule 1: Be nice.
    Rule 2: Have fun!
  </script>
</blockgame-book>
```

### 2. JavaScript / TypeScript API

```typescript
import { BlockgameBookViewer, parseBook } from 'blockgame-book-viewer';
import 'blockgame-book-viewer/style.css';

// 1. Mount to any container
const container = document.getElementById('book-container')!;
const viewer = new BlockgameBookViewer(container, {
  viewMode: 'double', // 'single' | 'double' | 'auto'
  controls: true,     // built-in toolbar
  pageNumbers: true,  // page number drawn on the book (default true)
  sound: true,        // page-turn audio
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

### 3. Framework Integration

#### React / Next.js

In Next.js (App Router), import the component inside a client component:

```tsx
'use client';

import { useEffect } from 'react';
import 'blockgame-book-viewer/style.css';

export default function BookPreview() {
  useEffect(() => {
    import('blockgame-book-viewer');
  }, []);

  return (
    <div style={{ width: '800px', height: '600px' }}>
      {/* @ts-ignore custom element */}
      <blockgame-book
        src="/books/guide.stendhal"
        view-mode="double"
        controls="true"
      />
    </div>
  );
}
```

#### Vue 3

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import 'blockgame-book-viewer/style.css';

onMounted(async () => {
  await import('blockgame-book-viewer');
});
</script>

<template>
  <blockgame-book
    src="/books/rules.json"
    view-mode="double"
    controls="true"
  />
</template>
```

### 4. Low-Level Canvas Renderer

For complete custom control over rendering cycles and canvases:

```typescript
import { BookCanvas } from 'blockgame-book-viewer';

const canvas = new BookCanvas({
  container: document.getElementById('canvas-wrapper')!,
  defaultViewMode: 'double',
  onPageChange: (current, total) => console.log(`Page ${current + 1} of ${total}`)
});

await canvas.init();
canvas.setBook({ title: 'My Book', author: 'Author', pages: ['Page 1 content'] });
```

---

## Web Component Reference

### Supported Attributes

| Attribute | Property | Type / Values | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `src` | `.src` | `string` | `undefined` | Remote book file (`.stendhal`, `.json`, `.txt`) |
| `text` | `.text` | `string` | `""` | Raw continuous text to paginate automatically |
| `book-title` | `.bookTitle` | `string` | `""` | Book title metadata |
| `author` | `.author` | `string` | `""` | Book author metadata |
| `view-mode` | `.viewMode` | `'single' \| 'double' \| 'scroll-single' \| 'scroll-double' \| 'auto'` | `'auto'` | Flipbook modes or PDF-style continuous vertical scrolling |
| `appearance` | `.appearance` | `'java' \| 'bedrock'` | `'java'` | Visual GUI texture shell ($512\times256$ Bedrock or Java parchment) |
| `engine` | `.engine` | `'java' \| 'bedrock'` | `'java'` | Layout engine: $114\text{px}$ Java vs $122\text{px}$ Bedrock line width and `§g`–`§u` palette |
| `sound` | `.sound` | `boolean` | `true` | Toggle page-turn sound effects |
| `controls` | `.controls` | `boolean` | `true` | Built-in reader bottom toolbar |
| `page-numbers` | `.pageNumbers` | `boolean` | `true` | Page number drawn on the book canvas (Java `Page X of Y`, Bedrock `N of M`) |
| `page` | `.page` | `number` | `1` | 1-indexed initial active page number |
| `scale` | `.scale` | `number` | `auto` | Canvas pixel-scaling factor |
| `split-mode` | `.splitMode` | `'lossless' \| 'legacy'` | `'lossless'` | Continuous text splitting engine |
| `persist-progress` | `.persistProgress` | `boolean` | `false` | Opt-in `localStorage` reading progress memory |
| `blank-page-image` | `.blankPageImage` | `string \| object` | `none` | Image shown on final page when blank (Java single/double views) |
| `animated-chars` | `.animatedChars` | `array` | `none` | JSON array of character glyph swap animations |
| `experimental` | `.experimental` | `boolean` | `false` | Opt in to experimental features below |
| `high-contrast` | `.highContrast` | `boolean` | `false` | **Experimental.** Bedrock slate high-contrast mode with white text |
| `cover-color` | `.coverColor` | `string` | `un-dyed` | **Experimental.** 16 Minecraft dye cover tints (e.g. `'purple'`, `'cyan'`) |
| `bookmark` | `.bookmark` | `boolean` | `false` | **Experimental.** Hanging silk ribbon bookmark |
| `bookmark-color`| `.bookmarkColor`| `string` | `'#B02E26'` | **Experimental.** Hex or CSS color of ribbon bookmark |

### Easter Eggs

Both are opt-in and off until configured:

```html
<blockgame-book
  src="/books/issue.stendhal"
  blank-page-image="/img/author.gif"
  animated-chars='[{ "char": "⏼", "frames": ["◡"], "frameMs": 160 }]'>
</blockgame-book>
```

- **`blank-page-image`**: Shown when the last page is blank, including the empty right page of an odd-length spread. Supports animated GIFs. From JS, set `el.blankPageImage` to a URL or `{ src, width, height, alt, title }`.
- **`animated-chars`**: Swaps one character for the glyphs in `frames`, each shown for `frameMs` (default 160), then restores it without reflowing text. `delayMs` is the rest time between runs. From JS, set `el.animatedChars = [...]`.

### Experimental Features

Scholar-style dye covers, silk ribbon bookmarks, and high-contrast rendering require the `experimental` flag:

```html
<blockgame-book experimental cover-color="purple" bookmark appearance="bedrock" high-contrast>
  ...
</blockgame-book>
```

---

## Writing a Custom Plugin

Plugins let you hook into the rendering cycle to add custom particle effects, animations, or interactive element overlays:

```typescript
import { BookPlugin, BookCanvas } from 'blockgame-book-viewer';

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

Load custom resource packs containing custom fonts and GUI textures dynamically from `.zip` files:

```typescript
import { ResourcePackManager } from 'blockgame-book-viewer';

const packManager = new ResourcePackManager('./assets');

// Load from a user-uploaded .zip file
const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const packInfo = await packManager.loadZipResourcePack(file);
    await canvas.applyResourcePack(packInfo);
  }
});
```

---

## Documentation & Guides

- [**Embedding Guide (docs/EMBEDDING_GUIDE.md)**](docs/EMBEDDING_GUIDE.md): Detailed web component configuration, CSS styling, responsive layout recipes, and custom event reference.
- [**Developer References (docs/DEV_REFERENCES.md)**](docs/DEV_REFERENCES.md): Architecture breakdown, Minecraft book mod references, font advance tables, and formatting specifications.

---

## Development & Testing

### Prerequisites

- [Bun](https://bun.sh/) (v1.2+) or Node.js (v20+)

### Setup

```bash
# Clone repository
git clone https://github.com/witch-craftmagazine/blockgame-book-viewer.git
cd blockgame-book-viewer

# Install dependencies
bun install

# Start development server (Playground & Workbench)
bun run dev

# Run unit and integration tests (243 tests across 25 files)
bun test

# Typecheck TypeScript
bun run typecheck

# Build library and demo application
bun run build
```

---

## License

MIT © [witch-craftmagazine](https://github.com/witch-craftmagazine)
