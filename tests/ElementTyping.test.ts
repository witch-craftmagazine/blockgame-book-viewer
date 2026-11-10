import { describe, it, expect } from 'vitest';
import type { BlockgameBookElement } from '../src/component/blockgame-book';

// Compile-time contract. `bun run typecheck` fails if the HTMLElementTagNameMap
// entries are removed (createElement would fall back to HTMLElement) or loosened to `any`.
function typedUsage(): void {
  const el = document.createElement('blockgame-book');
  const typed: BlockgameBookElement = el;
  const legacy: BlockgameBookElement = document.createElement('minecraft-book');
  document.querySelector('blockgame-book')?.nextPage();
  // @ts-expect-error unknown members must stay an error
  el.notARealMethod();
  void typed;
  void legacy;
}

describe('Element typings', () => {
  it('declares blockgame-book and minecraft-book in HTMLElementTagNameMap (checked by tsc)', () => {
    expect(typeof typedUsage).toBe('function');
  });
});
