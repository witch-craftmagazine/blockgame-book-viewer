# Changelog

## 1.0.0 (unreleased, never published to npm)

### Breaking
- Only the transparent theme remains. The `.mc-theme-dark`, `.mc-theme-light`, `.mc-theme-parchment` and `.mc-theme-nectar` classes are gone, so host CSS targeting them no longer matches. Theme through the `--mc-*` custom properties instead.
- The `theme` property and `setTheme()` are deprecated no-ops.

### Added
- `page-numbers` attribute, `pageNumbers` property and `pageNumbers` viewer option (plus `setPageNumbers()` / `isPageNumbersEnabled()`) control the page number drawn on the book itself: Java `Page X of Y` and Bedrock `N of M`. It is separate from the toolbar `1 / 12` text, which `controls` governs. Set `page-numbers="false"` to hide it.

### Changed
- The Java `Page X of Y` number is now drawn by default. It was previously built in but off with no way to enable it. Bedrock already drew `N of M` unconditionally, so Bedrock output is unchanged by default. Hosts that want the previous Java look should set `page-numbers="false"`.
- `style.css` no longer bundles Unifont (it was 6 MB of base64). Load `@fontsource/unifont` or `unifont.css` alongside it; without it, uncommon glyphs fall back to monospace.
- Assets ship once, in `dist/assets`.

### Fixed
- Package `types` and `exports["./style.css"]` pointed at files that did not exist.
- Bedrock `scroll-single` mis-labelled spreads and `scrollToPage` targeted the wrong one.
- `document.createElement('blockgame-book')` is now typed.
