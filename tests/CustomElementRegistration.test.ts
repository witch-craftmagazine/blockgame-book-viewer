import { describe, it, expect } from 'vitest';
import { BlockgameBookElement, defineBlockgameBookElement } from '../src/component/blockgame-book';

/**
 * Browsers throw NotSupportedError when a tag name or a constructor is registered twice.
 * This mock registry enforces the same rules, so the registration function is exercised
 * the way a real page exercises it.
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
  it('registers <blockgame-book> with the element class', () => {
    const registry = createStrictRegistry();
    expect(() => defineBlockgameBookElement(registry)).not.toThrow();
    expect(registry.byName.get('blockgame-book')).toBe(BlockgameBookElement);
    expect(registry.byName.size).toBe(1);
  });

  it('is idempotent when the tag is already defined', () => {
    const registry = createStrictRegistry();
    defineBlockgameBookElement(registry);
    expect(() => defineBlockgameBookElement(registry)).not.toThrow();
  });
});
