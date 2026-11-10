import '../src/index';
import type { BlockgameBookElement } from '../src/component/blockgame-book';
import type { BlockgameBook } from '../src/engine/types';

// Sample books illustrating different capabilities
export const SAMPLES: Record<string, BlockgameBook> = {
  guide: {
    title: 'Web Component Guide',
    author: 'Blockgame Book Engine',
    pages: [
      `§0§l<blockgame-book>§r

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
  bedrock (122px)`,

      `§5§lPersistence & API§r

§0• §8persist-progress§0:
  Opt-in reading memory.
• §2setBook(book)§0:
  Swap content live.
• §9nextPage()§0 /
  §9prevPage()§0
• §6scrollToPage(n)§0
• §3exportCurrentPage()§0`,

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
  }
};

function initConfigurator() {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const bookEl = document.getElementById('preview-book') as BlockgameBookElement | null;
  const codeSnippet = document.getElementById('code-snippet');
  const copyBtn = document.getElementById('btn-copy-code');
  const themeToggle = document.getElementById('theme-toggle');

  if (!bookEl) return;

  // Form controls
  const viewModeSelect = document.getElementById('cfg-view-mode') as HTMLSelectElement | null;
  const appearanceSelect = document.getElementById('cfg-appearance') as HTMLSelectElement | null;
  const engineSelect = document.getElementById('cfg-engine') as HTMLSelectElement | null;
  const persistProgressCheck = document.getElementById('cfg-persist-progress') as HTMLInputElement | null;
  const pageNumbersCheck = document.getElementById('cfg-page-numbers') as HTMLInputElement | null;
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
    const persist = persistProgressCheck?.checked;
    const pageNumbers = pageNumbersCheck?.checked ?? true;

    const lines: string[] = ['<blockgame-book'];
    lines.push(`  view-mode="${vm}"`);
    if (app !== 'java') lines.push(`  appearance="${app}"`);
    if (eng !== 'java') lines.push(`  engine="${eng}"`);
    if (persist) lines.push('  persist-progress');
    // page-numbers defaults to on, so the snippet only carries it when turned off.
    if (!pageNumbers) lines.push('  page-numbers="false"');
    lines.push('  controls="true"');
    lines.push('  base-path="../assets">');
    lines.push('  <!-- Inline book content or src="..." -->');
    lines.push('</blockgame-book>');

    codeSnippet.textContent = lines.join('\n');
  }

  // Bind change listeners to update <blockgame-book> live
  viewModeSelect?.addEventListener('change', () => {
    const val = viewModeSelect.value as any;
    bookEl.setAttribute('view-mode', val);
    bookEl.viewMode = val;
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

  persistProgressCheck?.addEventListener('change', () => {
    const checked = persistProgressCheck.checked;
    if (checked) {
      bookEl.setAttribute('persist-progress', '');
    } else {
      bookEl.removeAttribute('persist-progress');
    }
    bookEl.persistProgress = checked;
    updateCodeSnippet();
  });

  pageNumbersCheck?.addEventListener('change', () => {
    // The property keeps the attribute in sync: removed when on (the default), "false" when off.
    bookEl.pageNumbers = pageNumbersCheck.checked;
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
      if (appearanceSelect && appearanceSelect.value === 'bedrock') {
        appearanceSelect.value = 'java';
        bookEl.setAttribute('appearance', 'java');
        bookEl.appearance = 'java';
      }
      if (engineSelect && engineSelect.value === 'bedrock') {
        engineSelect.value = 'java';
        bookEl.setAttribute('engine', 'java');
        bookEl.engine = 'java';
      }
    } else {
      if (appearanceSelect && appearanceSelect.value === 'bedrock') {
        appearanceSelect.value = 'java';
        bookEl.setAttribute('appearance', 'java');
        bookEl.appearance = 'java';
      }
      if (engineSelect && engineSelect.value === 'bedrock') {
        engineSelect.value = 'java';
        bookEl.setAttribute('engine', 'java');
        bookEl.engine = 'java';
      }
      if (viewModeSelect && (viewModeSelect.value === 'scroll-single' || viewModeSelect.value === 'scroll-double')) {
        viewModeSelect.value = 'double';
        bookEl.setAttribute('view-mode', 'double');
        bookEl.viewMode = 'double';
      }
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
