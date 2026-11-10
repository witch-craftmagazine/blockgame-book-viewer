import { describe, it, expect } from 'vitest';
import { BlockgameBookElement, MinecraftBookElement, defineBlockgameBookElements } from '../src/component/blockgame-book';

/**
 * Browsers throw NotSupportedError when one constructor is registered under two
 * tag names. This mock registry enforces the same rule, so the registration
 * function is exercised the way a real page exercises it.
 */
function createStrictRegistry() {
  const byName = new Map<string, Function>();
  return {
    byName,
    get: (name: string) => byName.get(name) as any,
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

describe('custom element registration', () => {
  it('registers both tags without reusing a constructor', () => {
    const registry = createStrictRegistry();
    expect(() => defineBlockgameBookElements(registry)).not.toThrow();

    expect(registry.byName.get('blockgame-book')).toBe(BlockgameBookElement);
    const legacy = registry.byName.get('minecraft-book') as Function;
    expect(legacy).toBeDefined();
    expect(legacy).not.toBe(BlockgameBookElement);
    expect(legacy.prototype instanceof BlockgameBookElement).toBe(true);
  });

  it('is idempotent when the tags are already defined', () => {
    const registry = createStrictRegistry();
    defineBlockgameBookElements(registry);
    expect(() => defineBlockgameBookElements(registry)).not.toThrow();
  });

  it('keeps MinecraftBookElement as an identity alias of BlockgameBookElement', () => {
    expect(MinecraftBookElement).toBe(BlockgameBookElement);
  });
});
