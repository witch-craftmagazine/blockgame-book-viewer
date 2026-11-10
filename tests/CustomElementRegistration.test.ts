import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Browsers throw NotSupportedError when one constructor is registered under two
 * tag names. This mock registry enforces the same rule so the module's
 * auto-registration is exercised the way a real page exercises it.
 */
function createStrictRegistry() {
  const byName = new Map<string, Function>();
  return {
    byName,
    get: (name: string) => byName.get(name),
    define: (name: string, ctor: Function) => {
      if (byName.has(name)) throw new Error(`NotSupportedError: "${name}" already defined`);
      for (const existing of byName.values()) {
        if (existing === ctor) {
          throw new Error('NotSupportedError: this constructor has already been used with this registry');
        }
      }
      byName.set(name, ctor);
    },
  };
}

describe('custom element auto-registration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers both tags without reusing a constructor', async () => {
    const registry = createStrictRegistry();
    vi.stubGlobal('window', {});
    vi.stubGlobal('customElements', registry);

    const mod = await import('../src/component/blockgame-book');

    expect(registry.byName.get('blockgame-book')).toBe(mod.BlockgameBookElement);
    const legacy = registry.byName.get('minecraft-book') as Function;
    expect(legacy).toBeDefined();
    expect(legacy).not.toBe(mod.BlockgameBookElement);
    expect(legacy.prototype instanceof mod.BlockgameBookElement).toBe(true);
  });

  it('keeps MinecraftBookElement as an identity alias of BlockgameBookElement', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('customElements', createStrictRegistry());
    const mod = await import('../src/component/blockgame-book');
    expect(mod.MinecraftBookElement).toBe(mod.BlockgameBookElement);
  });
});
