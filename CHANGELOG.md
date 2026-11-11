# Changelog

## 1.0.0 (unreleased, never published to npm)

### Breaking
- Only the transparent theme remains. The `.mc-theme-dark`, `.mc-theme-light`, `.mc-theme-parchment` and `.mc-theme-nectar` classes are gone, so host CSS targeting them no longer matches. Theme through the `--mc-*` custom properties instead.
- The `theme` property and `setTheme()` are deprecated no-ops.
- Removed the deprecated Minecraft-named aliases: the `<minecraft-book>` tag, `MinecraftBookElement`, `MinecraftBookViewer`, `MinecraftBookViewerOptions`, `MinecraftBook`, `MinecraftDyeColor`, `MINECRAFT_COLORS`, `MINECRAFT_DYE_HEX`, `MINECRAFT_SYMBOL_ADVANCES` and `getMinecraftGlyphSizes`, along with the `src/ui/MinecraftBookViewer` and `src/component/minecraft-book` shim modules. Use the `Blockgame*` / `BLOCKGAME_*` names and `<blockgame-book>`.
- The registration helper is now `defineBlockgameBookElement()` and defines only `<blockgame-book>`.
- Removed the unused `WYSIWYG_BOOK_EDITOR_ENABLED` export. The markup editor no longer shows a disabled "Visual WYSIWYG - Planned" tab or a roadmap notice.
- Removed `BookCanvas.getBookPageRect()`. It only existed to position the site-specific ASCII backdrop, which is gone from the repo; it was never part of the web component.

### Added
- `page-numbers` attribute, `pageNumbers` property and `pageNumbers` viewer option (plus `setPageNumbers()` / `isPageNumbersEnabled()`) control the page number drawn on the book itself: Java `Page X of Y` and Bedrock `N of M`. It is separate from the toolbar `1 / 12` text, which `controls` governs. Set `page-numbers="false"` to hide it.

### Changed
- The Java `Page X of Y` number is now drawn by default. It was previously built in but off with no way to enable it. Bedrock already drew `N of M` unconditionally, so Bedrock output is unchanged by default. Hosts that want the previous Java look should set `page-numbers="false"`.
- `style.css` is 11 KB instead of 6 MB. Unifont is no longer inlined as base64; the build ships only `unifont-latin-400-normal.woff2` in `dist/assets/fonts` and `style.css` references it by relative URL, so no extra font setup is needed. The 3 MB `.woff` fallback is no longer shipped.
- Assets ship once, in `dist/assets` (the package no longer includes a second copy under `public/`). The tarball is 4.2 MB, down from 8.9 MB.
- `npm test` runs `bun test`, matching CI. `npm run test:vitest` runs vitest. CI now also runs `typecheck`.

- Glyph advances now follow vanilla 26.2's font providers exactly: space provider, then the bitmap sheets, then an exact `UnihexProvider` table for Unifont (half-pixel advances such as `✧` 8.5 and `ₑ` 3.5), then the missing glyph (6). Unifont glyphs bold by 0.5, other glyphs by 1. This replaces the legacy `glyph_sizes.bin` lookup, the canvas-measured fallback and the hand-calibrated symbol overrides. Text containing non-bitmap symbols can wrap differently: NBSP is 5.5 (was 4), `▁▂▃▅▆▇` are 5 (were 9), combining marks advance instead of being zero-width, and `✧ ✦` are 8.5 (were 5). `getBlockgameGlyphSizes()` is still exported but no longer used by the engine.

### Fixed
- Package `types` and `exports["./style.css"]` pointed at files that did not exist (`dist/types/index.d.ts`, `dist/style.css`).
- Importing the package where a bare `window` exists without `customElements` (SSR shims, test runners) threw a `ReferenceError`.
- Bold spaces are now 5px wide instead of 4px. The emulator under-measured bold lines, so text that wrapped in Minecraft 26.3 (for example a bold `II. The Ink of Souls`) stayed on one line in the viewer.
- `/give` export produced books showing raw JSON and stripped colours in Minecraft 1.21.5+ (including 26.x). Pages were JSON wrapped in strings, which 1.21.5+ treats as plain text, and `§` codes were typed into the command, which the chat box strips. `exportToGiveCommandModern` now emits SNBT text components with colours and styles as properties and never writes `§`. Titles are capped at 32 characters and `generation` is written when set.
- The old 1.20.5-1.21.4 format moved to the new `exportToGiveCommandJsonPages`; the export dialog has a radio for it. The legacy exporter also stopped emitting `§`.
- Importing `/give` commands now parses real SNBT (unquoted keys, `{raw:...}`, nested lists) and resolves style inheritance like Minecraft: `extra` children inherit from their parent, and in a list the first element is the parent of the rest. Exported pages hang their runs off an unstyled empty parent (`{text:"",extra:[...]}`) so a bold first run cannot bleed into the whole page.
- Package `types` and `exports["./style.css"]` pointed at files that did not exist.
- Bedrock `scroll-single` mis-labelled spreads and `scrollToPage` targeted the wrong one.
- `document.createElement('blockgame-book')` is now typed.
