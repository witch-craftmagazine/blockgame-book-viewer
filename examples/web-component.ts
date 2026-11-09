import '../src/index';
import type { MinecraftBookElement } from '../src/component/minecraft-book';
import type { MinecraftBook } from '../src/engine/types';

// Sample books illustrating different capabilities
export const SAMPLES: Record<string, MinecraftBook> = {
  guide: {
    title: 'Web Component Guide',
    author: 'Minecraft Book Engine',
    pages: [
      `§0§l<minecraft-book>§r

§2A zero-dependency custom
element for embedding
vanilla Minecraft books.§0

Drop the tag into HTML,
React, Vue, or Svelte.

§8Select options in the
toolbar above to test
attributes live!§r`,

      `§1§lEngine Attributes§r

§0• §4view-mode§0:
  single | double |
  scroll-single |
  scroll-double
• §2appearance§0:
  java | bedrock
• §9engine§0:
  java (114px) |
  bedrock (122px)
• §5theme§0:
  transparent | dark |
  classic | high-contrast`,

      `§5§lScholar Extensions§r

§0• §6cover-color§0:
  Supports all 16 Minecraft
  leather dye colors.
• §4bookmark§0:
  Adds an authentic silk
  ribbon bookmark.
• §3bookmark-color§0:
  Custom ribbon hex or
  palette tone.
• §8persist-progress§0:
  Opt-in reading memory.`,

      `§4§lFormatting Codes§r

§cRed §6Gold §eYellow
§aGreen §bAqua §9Blue
§dPink §fWhite §8Gray

§l§nBold & Underline§r
§o§mItalic Strikethrough§r
§0§kMagic Obfuscated§r

§2All formatting codes
persist across lines!§r`
    ]
  },

  continuous: {
    title: 'The Alchemist Tome',
    author: 'Witchcraft Magazine',
    pages: [
      `§4§lI. The Threshold§r

§0Beneath the Obsidian
Spire, ancient shelves
glowed with dormant
enchantments.

Generations of scholars
had transcribed the
forgotten runes onto
bound parchment, seeking
the secrets of redstone
flux and soul flame.`,

      `§1§lII. The Ink of Souls§r

§0To inscribe a tome of
binding, one must grind
amethyst shards with
glowstone dust under a
full moon.

The resulting ink
resists moisture and
withstands Nether heat,
glowing faintly in the
darkest crypts.`,

      `§2§lIII. The Spire Runes§r

§0"Look not upon the
Enderman without a
carved pumpkin helm,
lest his gaze shatter
thy composure."

Such was the first
commandment carved upon
the bedrock monoliths of
the End dimension.`,

      `§6§lIV. Redstone Flux§r

§0A steady pulse of 15
signal strength may be
transmitted through
calibrated repeaters.

When paired with a
sculk sensor and
amethyst resonance,
signals travel silently
across mountain peaks.`,

      `§5§lV. The Nether Gate§r

§0Fourteen blocks of
obsidian frame the tear
between dimensions.

When struck with steel
and flint, the portal
emits a violet haze,
humming with unearthly
frequency.`,

      `§3§lVI. Deep Dark Echoes§r

§0Vibrations in the deep
awaken the Warden from
his subterranean slumber.

Move with stealth; tread
only upon wool carpet,
and cast snowballs to
distract his relentless
pursuit.`,

      `§8§lVII. The Archive§r

§0Here ends the seventh
scroll of the Alchemist.

May these pages guide
future wanderers who
seek wisdom within the
blocky wilderness.

§7Inscribed by Witchcraft
Magazine, Issue XII.§r`
    ]
  },

  bedrock: {
    title: 'Bedrock Edition Engine',
    author: 'Bedrock Scholar',
    pages: [
      `§0§lBedrock GUI & Colors§r

§0Bedrock Edition features a
wider §2122px line boundary§0
and special formatting
codes:

§gMinecoin Gold (§g)§r
§hQuartz White (§h)§r
§iIron Gray (§i)§r
§jNetherite Black (§j)§r`,

      `§0§lSpecial Bedrock Codes§r

§pMaterial Gold (§p)§r
§qMaterial Emerald (§q)§r
§sMaterial Diamond (§s)§r
§tMaterial Lapis (§t)§r
§uMaterial Amethyst (§u)§r

§8Bedrock 512x256 GUI
textures render authentic
corner turn buttons!§r`
    ]
  },

  scholar: {
    title: 'Scholar Dye & Braille Art',
    author: 'Artisans Guild',
    pages: [
      `§0§lScholar Customization§r

§0Transform any book with
authentic Minecraft dyes!

Toggle §2cover-color§0 to
apply leather tints, and
enable §4bookmark§0 to hang
a silk bookmark ribbon
from the bottom edge.

§8Turn page for Braille!§r`,

      `§0§lBraille Graphic Art§r
§0Full Unicode Braille
(U+2800 to U+28FF)
pixel art rendering:

⠀⣠⣴⣶⣶⣶⣦⣄⠀
⢰⣿⣿⣿⣿⣿⣿⣿⣆
⣿⣿⣿⣿⣿⣿⣿⣿⣿
⠻⣿⣿⣿⣿⣿⣿⣿⠟
⠀⠈⠛⠿⠿⠿⠛⠁⠀

§8Calculated pixel advances
fit perfectly in bounds.§r`
    ]
  }
};

function initConfigurator() {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const bookEl = document.getElementById('preview-book') as MinecraftBookElement | null;
  const codeSnippet = document.getElementById('code-snippet');
  const copyBtn = document.getElementById('btn-copy-code');
  const themeToggle = document.getElementById('theme-toggle');

  if (!bookEl) return;

  // Form controls
  const viewModeSelect = document.getElementById('cfg-view-mode') as HTMLSelectElement | null;
  const appearanceSelect = document.getElementById('cfg-appearance') as HTMLSelectElement | null;
  const engineSelect = document.getElementById('cfg-engine') as HTMLSelectElement | null;
  const themeSelect = document.getElementById('cfg-theme') as HTMLSelectElement | null;
  const highContrastCheck = document.getElementById('cfg-high-contrast') as HTMLInputElement | null;
  const coverColorSelect = document.getElementById('cfg-cover-color') as HTMLSelectElement | null;
  const bookmarkCheck = document.getElementById('cfg-bookmark') as HTMLInputElement | null;
  const bookmarkColorInput = document.getElementById('cfg-bookmark-color') as HTMLInputElement | null;
  const persistProgressCheck = document.getElementById('cfg-persist-progress') as HTMLInputElement | null;
  const sampleSelect = document.getElementById('cfg-sample') as HTMLSelectElement | null;

  // Programmatic action buttons
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnScrollPage3 = document.getElementById('btn-scroll-p3');
  const btnScrollEnd = document.getElementById('btn-scroll-end');
  const btnExportPage = document.getElementById('btn-export-page');

  let currentSampleKey = 'guide';

  function updateCodeSnippet() {
    if (!codeSnippet) return;

    const vm = viewModeSelect?.value || 'double';
    const app = appearanceSelect?.value || 'java';
    const eng = engineSelect?.value || 'java';
    const thm = themeSelect?.value || 'transparent';
    const hc = highContrastCheck?.checked;
    const cover = coverColorSelect?.value || '';
    const bm = bookmarkCheck?.checked;
    const bmColor = bookmarkColorInput?.value || '#8b0000';
    const persist = persistProgressCheck?.checked;

    const lines: string[] = ['<minecraft-book'];
    lines.push(`  view-mode="${vm}"`);
    if (app !== 'java') lines.push(`  appearance="${app}"`);
    if (eng !== 'java') lines.push(`  engine="${eng}"`);
    if (thm !== 'transparent') lines.push(`  theme="${thm}"`);
    if (hc) lines.push('  high-contrast');
    if (cover && cover !== 'none') lines.push(`  cover-color="${cover}"`);
    if (bm) {
      lines.push('  bookmark');
      if (bmColor && bmColor !== '#8b0000') lines.push(`  bookmark-color="${bmColor}"`);
    }
    if (persist) lines.push('  persist-progress');
    lines.push('  controls="true"');
    lines.push('  base-path="../assets">');
    lines.push('  <!-- Inline book content or src="..." -->');
    lines.push('</minecraft-book>');

    codeSnippet.textContent = lines.join('\n');
  }

  // Bind change listeners to update <minecraft-book> live
  viewModeSelect?.addEventListener('change', () => {
    const val = viewModeSelect.value as any;
    bookEl.setAttribute('view-mode', val);
    updateCodeSnippet();
  });

  appearanceSelect?.addEventListener('change', () => {
    const val = appearanceSelect.value as any;
    bookEl.setAttribute('appearance', val);
    bookEl.appearance = val;
    updateCodeSnippet();
  });

  engineSelect?.addEventListener('change', () => {
    const val = engineSelect.value as any;
    bookEl.setAttribute('engine', val);
    bookEl.engine = val;
    updateCodeSnippet();
  });

  themeSelect?.addEventListener('change', () => {
    const val = themeSelect.value;
    bookEl.setAttribute('theme', val);
    updateCodeSnippet();
  });

  highContrastCheck?.addEventListener('change', () => {
    if (highContrastCheck.checked) {
      bookEl.setAttribute('high-contrast', '');
    } else {
      bookEl.removeAttribute('high-contrast');
    }
    updateCodeSnippet();
  });

  coverColorSelect?.addEventListener('change', () => {
    const val = coverColorSelect.value;
    if (val && val !== 'none') {
      bookEl.setAttribute('cover-color', val);
    } else {
      bookEl.removeAttribute('cover-color');
    }
    updateCodeSnippet();
  });

  bookmarkCheck?.addEventListener('change', () => {
    if (bookmarkCheck.checked) {
      bookEl.setAttribute('bookmark', '');
    } else {
      bookEl.removeAttribute('bookmark');
    }
    updateCodeSnippet();
  });

  bookmarkColorInput?.addEventListener('input', () => {
    const val = bookmarkColorInput.value;
    bookEl.setAttribute('bookmark-color', val);
    updateCodeSnippet();
  });

  persistProgressCheck?.addEventListener('change', () => {
    if (persistProgressCheck.checked) {
      bookEl.setAttribute('persist-progress', '');
    } else {
      bookEl.removeAttribute('persist-progress');
    }
    updateCodeSnippet();
  });

  sampleSelect?.addEventListener('change', () => {
    currentSampleKey = sampleSelect.value;
    const sample = SAMPLES[currentSampleKey];
    if (sample) {
      bookEl.setBook(sample);
    }
    if (currentSampleKey === 'bedrock') {
      if (appearanceSelect) appearanceSelect.value = 'bedrock';
      bookEl.setAttribute('appearance', 'bedrock');
      bookEl.appearance = 'bedrock';
      if (engineSelect) engineSelect.value = 'bedrock';
      bookEl.setAttribute('engine', 'bedrock');
      bookEl.engine = 'bedrock';
    } else if (currentSampleKey === 'continuous') {
      if (viewModeSelect) viewModeSelect.value = 'scroll-double';
      bookEl.setAttribute('view-mode', 'scroll-double');
      bookEl.viewMode = 'scroll-double';
    }
    updateCodeSnippet();
  });

  // Action buttons
  btnPrev?.addEventListener('click', () => {
    bookEl.prevPage();
  });

  btnNext?.addEventListener('click', () => {
    bookEl.nextPage();
  });

  btnScrollPage3?.addEventListener('click', () => {
    bookEl.scrollToPage(3, { behavior: 'smooth' });
  });

  btnScrollEnd?.addEventListener('click', () => {
    const sample = SAMPLES[currentSampleKey];
    const total = sample ? sample.pages.length : 4;
    bookEl.scrollToPage(total, { behavior: 'smooth' });
  });

  btnExportPage?.addEventListener('click', async () => {
    await bookEl.exportCurrentPage();
  });

  // Copy code snippet
  copyBtn?.addEventListener('click', async () => {
    if (!codeSnippet) return;
    try {
      await navigator.clipboard.writeText(codeSnippet.textContent || '');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    } catch {
      // Fallback
    }
  });

  // Dark/Light theme toggle for page
  themeToggle?.addEventListener('click', () => {
    const doc = document.documentElement;
    const current = doc.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    doc.setAttribute('data-theme', next);
    themeToggle.textContent = next === 'dark' ? '☀️ Light' : '🌙 Dark';
  });

  updateCodeSnippet();
}

if (typeof window !== 'undefined') {
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initConfigurator);
  } else {
    initConfigurator();
  }
}
