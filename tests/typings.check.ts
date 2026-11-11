// Compile-time contract, enforced by `bun run typecheck` (tsconfig.json includes tests/).
// Deliberately not a *.test.ts file: it has nothing to execute, so a test runner would
// only report a meaningless pass. It fails the typecheck if the HTMLElementTagNameMap
// entry is removed (createElement would fall back to HTMLElement) or loosened to `any`.
import type { BlockgameBookElement } from '../src/component/blockgame-book';

export function typedUsage(): void {
  const el = document.createElement('blockgame-book');
  const typed: BlockgameBookElement = el;
  document.querySelector('blockgame-book')?.nextPage();
  // @ts-expect-error unknown members must stay an error
  el.notARealMethod();
  void typed;
}
