import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { SAMPLES } from '../examples/web-component';
import { BlockgameBookElement, MinecraftBookElement } from '../src/component/blockgame-book';

describe('Web Component Live Preview & Configurator Options', () => {
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      drawImage: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      setLineDash: () => {},
      clearRect: () => {},
      rect: () => {},
      clip: () => {},
      fillText: () => {},
      measureText: () => ({ width: 10 }),
      getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
      imageSmoothingEnabled: false,
    };

    const makeEl = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: {
          classes: new Set<string>(),
          add(...tokens: string[]) {
            for (const c of tokens) this.classes.add(c);
            el.className = Array.from(this.classes).join(' ');
          },
          remove(...tokens: string[]) {
            for (const c of tokens) this.classes.delete(c);
            el.className = Array.from(this.classes).join(' ');
          },
          toggle(c: string, force?: boolean) {
            if (force !== undefined) {
              if (force) this.add(c);
              else this.remove(c);
              return force;
            }
            if (this.classes.has(c)) {
              this.remove(c);
              return false;
            } else {
              this.add(c);
              return true;
            }
          },
          contains(c: string) {
            return this.classes.has(c) || el.className.split(' ').includes(c);
          },
        },
        style: {},
        dataset: {} as Record<string, string>,
        children: [] as any[],
        attributes: {} as Record<string, string>,
        _innerHTML: '',
        get innerHTML() {
          return this._innerHTML;
        },
        set innerHTML(val: string) {
          this._innerHTML = val;
          if (val === '') {
            this.children = [];
          }
        },
        textContent: '',
        value: '',
        setAttribute(k: string, v: string) {
          this.attributes[k] = v;
        },
        getAttribute(k: string) {
          return this.attributes[k];
        },
        hasAttribute(k: string) {
          return k in this.attributes;
        },
        removeAttribute(k: string) {
          delete this.attributes[k];
        },
        appendChild(child: any) {
          this.children.push(child);
          child.parentElement = this;
          return child;
        },
        removeChild(child: any) {
          const idx = this.children.indexOf(child);
          if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentElement = null;
          }
          return child;
        },
        remove() {
          if (this.parentElement) {
            this.parentElement.removeChild(this);
          }
        },
        querySelector(sel: string): any {
          const all = this.querySelectorAll(sel);
          if (all.length > 0) return all[0];
          const fallback = makeEl(sel.includes('btn') || sel.includes('button') ? 'button' : 'div');
          if (sel.startsWith('#')) fallback.id = sel.slice(1);
          if (sel.startsWith('.')) fallback.className = sel.slice(1);
          return fallback;
        },
        querySelectorAll(sel: string): any[] {
          const results: any[] = [];
          const check = (node: any) => {
            let match = false;
            if (sel.startsWith('.')) {
              const cls = sel.slice(1);
              if (node.classList?.contains(cls) || node.className?.split(' ').includes(cls)) match = true;
            } else if (sel.startsWith('#')) {
              if (node.id === sel.slice(1) || node.attributes?.id === sel.slice(1)) match = true;
            } else if (node.tagName?.toLowerCase() === sel.toLowerCase()) {
              match = true;
            }
            if (match) results.push(node);
            for (const child of node.children || []) {
              check(child);
            }
          };
          for (const child of this.children || []) {
            check(child);
          }
          return results;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 616, height: 384 }),
      };

      if (tag === 'canvas') {
        el.getContext = () => mockCtx;
        el.toDataURL = () => 'data:image/png;base64,mock';
      }
      return el;
    };

    class MockImage {
      private _src = '';
      onload: any = null;
      onerror: any = null;
      naturalWidth = 256;
      naturalHeight = 256;
      width = 256;
      height = 256;
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    (globalThis as any).Image = MockImage;

    (globalThis as any).document = {
      createElement: makeEl,
      body: makeEl('body'),
    };
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      getSelection: () => ({ removeAllRanges: () => {}, toString: () => '' }),
      innerWidth: 1024,
      innerHeight: 768,
    };
  });

  it('provides the 3 production sample presets with valid pages and metadata', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(['bedrock', 'continuous', 'guide']);
    expect(SAMPLES.guide.pages.length).toBeGreaterThanOrEqual(4);
    expect(SAMPLES.continuous.pages.length).toBe(7);
    expect(SAMPLES.bedrock).toBeDefined();
    expect(SAMPLES.scholar).toBeUndefined();
  });

  it('guide sample documents only core attributes (no Scholar, Braille, or any theme)', () => {
    const text = SAMPLES.guide.pages.join('\n');
    for (const core of ['view-mode', 'appearance', 'engine', 'persist-progress', 'setBook', 'scrollToPage']) {
      expect(text).toContain(core);
    }
    for (const gone of ['cover-color', 'bookmark', 'Scholar', 'Braille', 'classic', 'high-contrast', 'theme']) {
      expect(text).not.toContain(gone);
    }
  });

  describe('examples/web-component.html configurator', () => {
    let html = '';
    let ts = '';

    beforeAll(async () => {
      // The repo has no @types/node, so load node:fs through a variable specifier.
      const fsModule = 'node:fs';
      const fs: any = await import(/* @vite-ignore */ fsModule);
      html = fs.readFileSync(new URL('../examples/web-component.html', import.meta.url), 'utf8');
      ts = fs.readFileSync(new URL('../examples/web-component.ts', import.meta.url), 'utf8');
    });

    it('no longer renders Scholar, bookmark, or high-contrast controls', () => {
      for (const id of ['cfg-cover-color', 'cfg-high-contrast', 'cfg-bookmark', 'cfg-bookmark-color']) {
        expect(html).not.toContain(`id="${id}"`);
        expect(ts).not.toContain(id);
      }
    });

    it('has no theme control or theme attribute and no scholar sample', () => {
      expect(html).not.toContain('cfg-theme');
      // `\s` excludes the page's own `[data-theme="dark"]` CSS selectors.
      expect(html).not.toMatch(/\stheme="/);

      const sampleSelect = html.match(/<select id="cfg-sample"[\s\S]*?<\/select>/)![0];
      const samples = [...sampleSelect.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
      expect(samples).toEqual(['guide', 'continuous', 'bedrock']);
    });

    it('keeps the production controls and has no Scholar or Braille copy', () => {
      for (const id of ['cfg-view-mode', 'cfg-appearance', 'cfg-engine', 'cfg-persist-progress', 'cfg-sample']) {
        expect(html).toContain(`id="${id}"`);
      }
      expect(html).not.toMatch(/braille|scholar|dye|silk/i);
    });
  });

  it('updates live options on MinecraftBookElement dynamically', async () => {
    const bookEl = new MinecraftBookElement();
    const classListSet = new Set<string>();
    (bookEl as any).classList = {
      add: (...tokens: string[]) => tokens.forEach((t) => classListSet.add(t)),
      remove: (...tokens: string[]) => tokens.forEach((t) => classListSet.delete(t)),
      contains: (c: string) => classListSet.has(c),
      toggle: (c: string, force?: boolean) => {
        if (force !== undefined) {
          if (force) classListSet.add(c);
          else classListSet.delete(c);
          return force;
        }
        if (classListSet.has(c)) {
          classListSet.delete(c);
          return false;
        } else {
          classListSet.add(c);
          return true;
        }
      },
    };
    const attrs: Record<string, string> = {
      'view-mode': 'double',
      'base-path': './assets',
      controls: 'true',
    };
    (bookEl as any).getAttribute = (k: string) => attrs[k] ?? null;
    (bookEl as any).hasAttribute = (k: string) => k in attrs;
    (bookEl as any).setAttribute = (k: string, v: string) => {
      attrs[k] = v;
      bookEl.attributeChangedCallback(k, null, v);
    };
    (bookEl as any).removeAttribute = (k: string) => {
      delete attrs[k];
      bookEl.attributeChangedCallback(k, null, null);
    };
    (bookEl as any).clientWidth = 800;
    const parentContainer = (globalThis as any).document.createElement('div');
    (bookEl as any).appendChild = parentContainer.appendChild.bind(parentContainer);

    await bookEl.connectedCallback();
    const viewer = bookEl.getViewer();
    expect(viewer).toBeDefined();

    // 1. Update view-mode to scroll-double
    bookEl.setAttribute('view-mode', 'scroll-double');
    expect(bookEl.viewMode).toBe('scroll-double');

    // 2. Update appearance to bedrock
    bookEl.setAttribute('appearance', 'bedrock');
    expect(bookEl.appearance).toBe('bedrock');

    // 3. Update engine to bedrock
    bookEl.setAttribute('engine', 'bedrock');
    expect(bookEl.engine).toBe('bedrock');

    // 4. Update cover-color to purple
    bookEl.setAttribute('cover-color', 'purple');
    expect(bookEl.coverColor).toBe('purple');

    // 5. Update bookmark and bookmark-color
    bookEl.setAttribute('bookmark', 'true');
    expect(bookEl.bookmark).toBe(true);
    bookEl.setAttribute('bookmark-color', '#2F4A3A');
    expect(bookEl.bookmarkColor).toBe('#2F4A3A');

    // 6. Update high-contrast
    bookEl.setAttribute('high-contrast', 'true');
    expect(bookEl.highContrast).toBe(true);

    // 7. A legacy theme attribute is ignored
    bookEl.setAttribute('theme', 'dark');
    expect(bookEl.theme).toBe('transparent');

    // 8. Load continuous sample and test scrollToPage
    bookEl.setBook(SAMPLES.continuous);
    expect(viewer!.getTotalPages()).toBe(7);
    expect(() => bookEl.scrollToPage(3)).not.toThrow();

    bookEl.disconnectedCallback();
  });
});
