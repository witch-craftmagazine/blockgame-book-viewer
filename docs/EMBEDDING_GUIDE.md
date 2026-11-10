# Embedding Guide: Integrating Blockgame Book Viewer into Your Website

This guide walks through how to embed and customize the **Blockgame Book Viewer** on any web page or web application.

---

## 1. Quick Drop-In: Web Component

The simplest way to embed a book is using the `<blockgame-book>` custom element (backwards-compatible alias `<minecraft-book>` is also registered).

### Step 1: Add Script and Stylesheet
```html
<link rel="stylesheet" href="https://unpkg.com/blockgame-book-viewer/dist/style.css" />
<script type="module" src="https://unpkg.com/blockgame-book-viewer/dist/blockgame-book-viewer.js"></script>
```

### Step 2: Add Element
```html
<blockgame-book
  src="./path/to/my-book.stendhal"
  view-mode="double"
  controls="true"
  sound="true">
</blockgame-book>
```

### Supported Attributes & Properties:
| Attribute | Property | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `src` | `.src` | `string` | `''` | URL to a `.stendhal`, `.json`, or raw book file |
| `text` | `.text` | `string` | `''` | Raw continuous text content to paginate automatically |
| `book-title` | `.bookTitle` | `string` | `''` | Book title metadata |
| `author` | `.author` | `string` | `''` | Author metadata |
| `view-mode` | `.viewMode` | `'single' \| 'double' \| 'scroll-single' \| 'scroll-double' \| 'auto'` | `'auto'` | Page display layout |
| `appearance` | `.appearance` | `'java' \| 'bedrock'` | `'java'` | Book GUI appearance |
| `engine` | `.engine` | `'java' \| 'bedrock'` | `'java'` | Text width engine (114px Java vs 122px Bedrock) |
| `experimental` | `.experimental` | `boolean` | `false` | Enables the experimental features below. While off they are ignored |
| `high-contrast`| `.highContrast`| `boolean` | `false` | Experimental: Bedrock high-contrast reading mode (needs `experimental`) |
| `cover-color` | `.coverColor` | `string` | `undefined` | Experimental: 16 Minecraft dye cover tint colors (needs `experimental`) |
| `bookmark` | `.bookmark` | `boolean` | `false` | Experimental: silk ribbon bookmark (needs `experimental`) |
| `bookmark-color`| `.bookmarkColor`| `string` | `undefined` | Experimental: custom ribbon color hex (needs `experimental`) |
| `scale` | `.scale` | `number` | Auto | Integer pixel-scaling multiplier |
| `sound` | `.sound` | `boolean` | `true` | Enable or disable page-turn sound effects |
| `controls` | `.controls` | `boolean` | `true` | Show or hide the bottom control toolbar |
| `page-numbers` | `.pageNumbers` | `boolean` | `true` | Page number drawn on the book itself (Java `Page X of Y`, Bedrock `N of M`). Use `page-numbers="false"` to hide it; the property setter keeps the attribute in sync. Separate from the toolbar page text |
| `page` | `.page` | `number` | `1` | Current active page (1-based index) |
| `persist-progress` | `.persistProgress` | `boolean` | `false` | Opt-in localStorage reading progress save |
| `split-mode` | `.splitMode` | `'lossless' \| 'standard'` | `'lossless'` | Lossless split mode |
| `base-path` | `.basePath` | `string` | `'./assets'` | Base URL where textures and fonts are located |
| `shadow` | `.shadow` | `boolean` | `false` | Open Shadow DOM isolation with `<slot>` |

### Custom Events:
Dispatched with `{ bubbles: true, composed: true }`:
- `pagechange` / `page-change`: detail `{ page: number, total: number }`
- `bookload` / `book-load`: detail `{ book: BlockgameBook }`
- `pageexport` / `page-export`: detail `{ page: number, dataUrl: string }`
- `close`: fired when book close is requested
- `ready`: detail `{ viewer: BlockgameBookViewer }` fired when viewer is initialized
- `error`: detail `{ error: Error, src?: string }` fired when URL fetch fails

### Public JavaScript Methods:
- `el.whenReady(): Promise<BlockgameBookViewer>`
- `el.nextPage(): boolean`
- `el.prevPage(): boolean`
- `el.firstPage(): boolean`
- `el.lastPage(): boolean`
- `el.goToPage(pageOneIndexed: number): void`
- `el.scrollToPage(pageNumber: number, options?)`
- `el.setText(text, title?, author?)`
- `el.setBook(book)`
- `el.getBook(): BlockgameBook | null`
- `el.zoomIn()` / `el.zoomOut()`
- `el.toggleSound(): boolean`
- `el.exportCurrentPage(options?)`
- `el.getPageDataUrl(pageIndex?): string`
- `el.getPageBlob(pageIndex?): Promise<Blob | null>`
- `el.resetProgress()`

---

## 2. JavaScript / TypeScript Integration

For single-page applications (React, Vue, Svelte, Angular, etc.), use the `BlockgameBookViewer` class.

### Example in React:
```tsx
import React, { useEffect, useRef } from 'react';
import { BlockgameBookViewer } from 'blockgame-book-viewer';
import 'blockgame-book-viewer/style.css';

export function BookViewerComponent({ bookData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<BlockgameBookViewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    viewerRef.current = new BlockgameBookViewer(containerRef.current, {
      book: bookData,
      viewMode: 'double',
      controls: true,
      pageNumbers: true, // default; false hides the page number on the book
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
} from 'blockgame-book-viewer';

// Auto-detects and parses Stendhal, BookCopy JSON, CMI, /give command, or plain text
const book = parseBook(rawInput);

// Convert to in-game /give command for Minecraft 1.21.5+ (incl. 26.x).
// Use exportToGiveCommandJsonPages for 1.20.5-1.21.4, exportToGiveCommandLegacy for 1.13-1.20.4.
const giveCommand = exportToGiveCommandModern(book);

// Convert to Stendhal format:
const stendhalString = exportToStendhal(book);
```

---

## 4. Customizing Resource Packs

To load a custom resource pack (e.g. Faithful, Sphax, or custom server pack):

```typescript
import { BlockgameBookViewer } from 'blockgame-book-viewer';

const viewer = new BlockgameBookViewer(container, options);
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
import { BookPlugin, BookCanvas } from 'blockgame-book-viewer';

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
const viewer = new BlockgameBookViewer(container, {
  plugins: [new CustomWatermarkPlugin()]
});
```
