import { describe, it, expect } from 'vitest';
import * as viewerModule from '../src/ui/BlockgameBookViewer';
import * as legacyViewerModule from '../src/ui/MinecraftBookViewer';
import * as elementModule from '../src/component/blockgame-book';
import * as legacyElementModule from '../src/component/minecraft-book';

describe('Legacy module path shims', () => {
  it('src/ui/MinecraftBookViewer re-exports the BlockgameBookViewer bindings', () => {
    expect(legacyViewerModule.BlockgameBookViewer).toBe(viewerModule.BlockgameBookViewer);
    expect(legacyViewerModule.MinecraftBookViewer).toBe(viewerModule.BlockgameBookViewer);
  });

  it('src/component/minecraft-book re-exports the BlockgameBookElement bindings', () => {
    expect(legacyElementModule.BlockgameBookElement).toBe(elementModule.BlockgameBookElement);
    expect(legacyElementModule.MinecraftBookElement).toBe(elementModule.BlockgameBookElement);
  });
});
