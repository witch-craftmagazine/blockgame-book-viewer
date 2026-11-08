# Embedding Guide: Integrating Minecraft Book Viewer into Your Website

This guide walks through how to embed and customize the **Minecraft Book Viewer** on any web page or web application.

---

## 1. Quick Drop-In: Web Component

The simplest way to embed a book is using the `<minecraft-book>` custom element.

### Step 1: Add Script and Stylesheet
```html
<link rel="stylesheet" href="https://unpkg.com/minecraft-book-viewer/dist/style.css" />
<script type="module" src="https://unpkg.com/minecraft-book-viewer/dist/minecraft-book-viewer.js"></script>
```

### Step 2: Add Element
```html
<minecraft-book
  src="./path/to/my-book.stendhal"
  view-mode="double"
  controls="true"
  sound="true">
</minecraft-book>
```

### Supported Attributes:
| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `src` | string | `undefined` | URL to a `.stendhal`, `.json`, or `.txt` file |
| `view-mode` | `'single' \| 'double' \| 'auto'` | `'auto'` | Page display layout |
| `scale` | number | `3` | Integer pixel-scaling multiplier |
| `sound` | `'true' \| 'false'` | `'true'` | Enable or disable page-flip sound effects |
| `controls` | `'true' \| 'false'` | `'true'` | Show or hide the bottom control toolbar |
| `theme` | `'dark' \| 'light' \| 'transparent'` | `'dark'` | Visual theme of the container |
| `page` | number | `1` | Initial page to open (1-based index) |
| `base-path` | string | `'./assets'` | Base URL where textures and fonts are located |

---

## 2. JavaScript / TypeScript Integration

For single-page applications (React, Vue, Svelte, Angular, etc.), use the `MinecraftBookViewer` class.

### Example in React:
```tsx
import React, { useEffect, useRef } from 'react';
import { MinecraftBookViewer } from 'minecraft-book-viewer';
import 'minecraft-book-viewer/style.css';

export function BookViewerComponent({ bookData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<MinecraftBookViewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    viewerRef.current = new MinecraftBookViewer(containerRef.current, {
      book: bookData,
      viewMode: 'double',
      theme: 'dark',
      controls: true,
      onPageChange: (current, total) => {
        console.log(`Current page: ${current + 1}/${total}`);
      }
    });

    viewerRef.current.init();

    return () => {
      viewerRef.current?.destroy();
    };
  }, [bookData]);

  return <div ref={containerRef} style={{ width: '100%', height: '600px' }} />;
}
```

---

## 3. Supported Book Formats & Converters

The library exports headless parsers and exporters that work in browser and Node.js environments:

```typescript
import {
  parseBook,
  exportToStendhal,
  exportToGiveCommandModern,
  exportToBookCopyJson,
  exportToCmiText
} from 'minecraft-book-viewer';

// Auto-detects and parses Stendhal, BookCopy JSON, CMI, /give command, or plain text
const book = parseBook(rawInput);

// Convert to in-game /give command (1.20.5+ format):
const giveCommand = exportToGiveCommandModern(book);

// Convert to Stendhal format:
const stendhalString = exportToStendhal(book);
```

---

## 4. Customizing Resource Packs

To load a custom resource pack (e.g. Faithful, Sphax, or custom server pack):

```typescript
import { MinecraftBookViewer } from 'minecraft-book-viewer';

const viewer = new MinecraftBookViewer(container, options);
await viewer.init();

// Load a .zip pack
const response = await fetch('/packs/my-server-pack.zip');
const blob = await response.blob();
const file = new File([blob], 'my-server-pack.zip');

const packInfo = await viewer.getResourcePackManager().loadZipResourcePack(file);
await viewer.getCanvas().applyResourcePack(packInfo);
```

---

## 5. Writing Custom Plugins

You can add interactive Easter eggs, custom page borders, or animated elements using the `BookPlugin` interface:

```typescript
import { BookPlugin, BookCanvas } from 'minecraft-book-viewer';

export class CustomWatermarkPlugin implements BookPlugin {
  name = 'watermark-plugin';

  onAfterRenderPage(ctx, pageIndex, side, rect) {
    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
    ctx.fillText('CONFIDENTIAL', rect.x + 40, rect.y + 170);
    ctx.restore();
  }

  onClick(x, y, pageIndex, side) {
    if (x > 40 && x < 120 && y > 160 && y < 180) {
      alert(`Secret watermark clicked on page ${pageIndex + 1}!`);
      return true; // prevent default page-turn
    }
  }
}
```
Register your plugin when constructing the canvas or viewer:
```typescript
const viewer = new MinecraftBookViewer(container, {
  plugins: [new CustomWatermarkPlugin()]
});
```
