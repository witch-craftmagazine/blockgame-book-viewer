import { MinecraftBookViewer } from './ui/MinecraftBookViewer';
import { WitchcraftPlugin } from './plugins/WitchcraftPlugin';
import { parseBook } from './io/BookParser';
import { exportToStendhal, exportToGiveCommandModern } from './io/BookExporter';

const welcomeBook = {
  title: 'Welcome to Book Viewer',
  author: 'Minecraft Book Engine',
  pages: [
    '§0§lWelcome!§r\n\nThis is a §2modular§r, pixel-perfect §6Minecraft Book Viewer§r.\n\nEdit this text live in the editor on the right to see instant page updates!\n\n§8Turn page to continue...§r',
    '§1§lSupported Formats§r\n\n§0Native export & import for:\n\n§4• Stendhal (.stendhal)\n§2• Scribble JSON (.json)\n§9• BookCopy (.json)\n§5• CMI BookExport (<NextPage>)\n§6• Vanilla /give commands\n\n§8Type your own content anytime!§r',
    '§5§lCustom Resource Packs§r\n\n§0Engine support for:\n- Vanilla (16x)\n- Lithos (32x HD)\n- Server packs (Craftadia)\n- Custom bitmap unicode fonts\n\nFull Symbol Chat included.',
    '§6§lModular Plugin System§r\n\n§0Extend the reader with custom plugins, click hitboxes, interactive sound effects, and animated page overlays.'
  ]
};

function insertTextAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length;
  const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : textarea.value.length;
  const current = textarea.value || '';
  textarea.value = current.substring(0, start) + text + current.substring(end);
  const newPos = start + text.length;
  if (typeof textarea.setSelectionRange === 'function') {
    textarea.setSelectionRange(newPos, newPos);
  } else {
    textarea.selectionStart = textarea.selectionEnd = newPos;
  }
  if (typeof textarea.focus === 'function') {
    textarea.focus();
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('viewer-container') as HTMLElement;
  if (!container) return;

  const witchcraftPlugin = new WitchcraftPlugin({
    gifUrl: './assets/textures/starsweetpea.gif'
  });

  const pageIndicator = document.getElementById('showcase-page-indicator');
  const updatePageDisplay = (page: number, total: number) => {
    if (pageIndicator) {
      pageIndicator.textContent = `Page ${page + 1} / ${Math.max(1, total)}`;
    }
  };

  let viewer: MinecraftBookViewer;
  viewer = new MinecraftBookViewer(container, {
    book: welcomeBook,
    baseAssetPath: './assets',
    theme: 'transparent',
    defaultViewMode: 'single', // Single-page showcase
    controls: false, // Hide toolbar for main showcase
    plugins: [witchcraftPlugin],
    onPageChange: (page, total) => {
      updatePageDisplay(page, total);
    },
    onBookChange: (_book, v) => {
      const activeViewer = v || viewer;
      if (activeViewer) {
        updatePageDisplay(activeViewer.getCurrentPage(), activeViewer.getTotalPages());
      }
    }
  });

  await viewer.init();
  updatePageDisplay(viewer.getCurrentPage(), viewer.getTotalPages());

  // Showcase navigation buttons
  document.getElementById('showcase-prev-btn')?.addEventListener('click', () => {
    viewer.prevPage();
  });
  document.getElementById('showcase-next-btn')?.addEventListener('click', () => {
    viewer.nextPage();
  });
  document.getElementById('showcase-export-btn')?.addEventListener('click', () => {
    viewer.exportCurrentPage();
  });

  // Keyboard navigation when not typing in textarea
  window.addEventListener('keydown', (e) => {
    if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') {
      viewer.prevPage();
    } else if (e.key === 'ArrowRight') {
      viewer.nextPage();
    }
  });

  // Live Markup Editor Setup
  const textarea = document.getElementById('live-markup-textarea') as HTMLTextAreaElement | null;
  if (textarea) {
    textarea.value = exportToStendhal(welcomeBook);

    let debounceTimer: any = null;
    textarea.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const text = textarea.value;
        const parsed = parseBook(text);
        if (parsed) {
          viewer.setBook(parsed, true); // preservePage = true
        }
      }, 40);
    });

    // Format chip insertion
    const buttons = document.querySelectorAll('.markup-toolbar .tag-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const code = btn.getAttribute('data-code');
        if (!code || !textarea) return;
        const unescaped = code.replace('\\n', '\n');
        insertTextAtCursor(textarea, unescaped);

        // Immediately update preview
        const parsed = parseBook(textarea.value);
        if (parsed) {
          viewer.setBook(parsed, true);
        }
      });
    });

    // Reset Sample Button
    document.getElementById('live-reset-btn')?.addEventListener('click', () => {
      textarea.value = exportToStendhal(welcomeBook);
      viewer.setBook(welcomeBook, false);
      updatePageDisplay(0, viewer.getTotalPages());
    });

    // Copy /give command button
    const copyGiveBtn = document.getElementById('live-copy-give-btn') as HTMLButtonElement | null;
    if (copyGiveBtn) {
      copyGiveBtn.addEventListener('click', async () => {
        const cmd = exportToGiveCommandModern(viewer.getBook());
        try {
          await navigator.clipboard.writeText(cmd);
          const orig = copyGiveBtn.textContent;
          copyGiveBtn.textContent = 'Copied!';
          setTimeout(() => { copyGiveBtn.textContent = orig; }, 1500);
        } catch {
          textarea.value = cmd;
        }
      });
    }
  }

  // Theme toggle handler (Nectar dark / light)
  const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement | null;
  if (themeToggle) {
    const updateTheme = (isDark: boolean) => {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      themeToggle.textContent = isDark ? '🌙 Dark' : '☀️ Light';
      themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    };

    const isInitiallyDark =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    updateTheme(isInitiallyDark);

    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      updateTheme(!isDark);
    });
  }

  // Book selection handler
  const bookSelect = document.getElementById('book-select') as HTMLSelectElement | null;
  if (bookSelect) {
    bookSelect.addEventListener('change', async (e) => {
      const val = (e.target as HTMLSelectElement).value;
      if (val === 'welcome') {
        viewer.setBook(welcomeBook);
        if (textarea) textarea.value = exportToStendhal(welcomeBook);
      } else {
        try {
          const resp = await fetch(`./assets/books/${val}.stendhal`);
          if (resp.ok) {
            const text = await resp.text();
            const parsed = parseBook(text);
            if (parsed) {
              viewer.setBook(parsed);
              if (textarea) textarea.value = text;
            }
          }
        } catch (err) {
          console.error('Failed to load sample book:', err);
        }
      }
    });
  }
});
