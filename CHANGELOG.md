# Changelog

## 1.0.0 (unreleased, never published to npm)

### Breaking
- Only the transparent theme remains. The `.mc-theme-dark`, `.mc-theme-light`, `.mc-theme-parchment` and `.mc-theme-nectar` classes are gone, so host CSS targeting them no longer matches. Theme through the `--mc-*` custom properties instead.
- The `theme` property and `setTheme()` are deprecated no-ops.

### Changed
- `style.css` no longer bundles Unifont (it was 6 MB of base64). Load `@fontsource/unifont` or `unifont.css` alongside it; without it, uncommon glyphs fall back to monospace.
- Assets ship once, in `dist/assets`.

### Fixed
- Package `types` and `exports["./style.css"]` pointed at files that did not exist.
- Bedrock `scroll-single` mis-labelled spreads and `scrollToPage` targeted the wrong one.
- `document.createElement('blockgame-book')` is now typed.
