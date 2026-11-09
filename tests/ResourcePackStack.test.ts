import { describe, it, expect } from 'vitest';
import { ResourcePackManager, ResourcePackInfo } from '../src/engine/ResourcePackManager';
import { GlyphAtlas } from '../src/engine/GlyphAtlas';

describe('Resource Pack Priority Stack & Conflict Resolution', () => {
  it('starts with a neutral, vanilla-only baseline stack', () => {
    const manager = new ResourcePackManager('./assets');
    expect(manager.getAvailablePacks()).toHaveLength(1);
    expect(manager.getActiveStack()).toEqual(['vanilla']);
    expect(manager.isPackActive('vanilla')).toBe(true);

    const composite = manager.getCompositePack();
    expect(composite.activePackIds).toEqual(['vanilla']);
    expect(composite.textures.book).toContain('textures/gui/book.png');
    expect(composite.textures.pageForward).toContain('page_forward.png');
  });

  it('cascades texture overrides and falls back to vanilla for missing keys', () => {
    const manager = new ResourcePackManager('./assets');

    const packA: ResourcePackInfo = {
      id: 'pack_a',
      name: 'Pack A (Book Skin)',
      description: 'Provides only book skin',
      textures: {
        book: 'custom/packA/book.png',
      },
    };

    const packB: ResourcePackInfo = {
      id: 'pack_b',
      name: 'Pack B (Arrow Skin)',
      description: 'Provides only page turn buttons',
      textures: {
        pageForward: 'custom/packB/page_forward.png',
      },
    };

    manager.registerPack(packA);
    manager.registerPack(packB);

    manager.activatePack('pack_a');
    manager.activatePack('pack_b');

    expect(manager.getActiveStack()).toEqual(['vanilla', 'pack_a', 'pack_b']);

    const composite = manager.getCompositePack();
    // book comes from packA
    expect(composite.textures.book).toBe('custom/packA/book.png');
    // pageForward comes from packB
    expect(composite.textures.pageForward).toBe('custom/packB/page_forward.png');
    // pageBackward was not provided by either, so falls back to vanilla
    expect(composite.textures.pageBackward).toContain('textures/gui/page_backward.png');
  });

  it('resolves direct texture conflicts by stack priority (higher pack wins)', () => {
    const manager = new ResourcePackManager('./assets');

    const lowerPack: ResourcePackInfo = {
      id: 'lower_pack',
      name: 'Lower Pack',
      description: '',
      textures: {
        book: 'lower/book.png',
      },
    };

    const higherPack: ResourcePackInfo = {
      id: 'higher_pack',
      name: 'Higher Pack',
      description: '',
      textures: {
        book: 'higher/book.png',
      },
    };

    manager.registerPack(lowerPack);
    manager.registerPack(higherPack);

    manager.activatePack('lower_pack');
    manager.activatePack('higher_pack');

    // Higher pack wins
    expect(manager.getCompositePack().textures.book).toBe('higher/book.png');

    // Deactivating higher pack cleanly falls back to lower pack
    manager.deactivatePack('higher_pack');
    expect(manager.getCompositePack().textures.book).toBe('lower/book.png');

    // Deactivating lower pack cleanly falls back to vanilla
    manager.deactivatePack('lower_pack');
    expect(manager.getCompositePack().textures.book).toContain('textures/gui/book.png');
  });

  it('reorders packs in the priority stack', () => {
    const manager = new ResourcePackManager('./assets');

    manager.registerPack({
      id: 'pack_1',
      name: 'Pack 1',
      description: '',
      textures: { book: 'pack1/book.png' },
    });

    manager.registerPack({
      id: 'pack_2',
      name: 'Pack 2',
      description: '',
      textures: { book: 'pack2/book.png' },
    });

    manager.activatePack('pack_1');
    manager.activatePack('pack_2');
    expect(manager.getActiveStack()).toEqual(['vanilla', 'pack_1', 'pack_2']);
    expect(manager.getCompositePack().textures.book).toBe('pack2/book.png');

    // Move pack_1 to top priority
    manager.reorderPack('pack_1', 2);
    expect(manager.getActiveStack()).toEqual(['vanilla', 'pack_2', 'pack_1']);
    expect(manager.getCompositePack().textures.book).toBe('pack1/book.png');
  });

  it('protects vanilla from being deactivated, unregistered, or moved from base index 0', () => {
    const manager = new ResourcePackManager('./assets');
    manager.registerPack({ id: 'custom', name: 'Custom', description: '' });
    manager.activatePack('custom');

    // Attempting to deactivate vanilla does nothing
    manager.deactivatePack('vanilla');
    expect(manager.getActiveStack()[0]).toBe('vanilla');

    // Attempting to unregister vanilla does nothing
    manager.unregisterPack('vanilla');
    expect(manager.getPack('vanilla')).toBeDefined();

    // Reordering custom pack maintains vanilla at 0
    manager.reorderPack('custom', 0);
    expect(manager.getActiveStack()[0]).toBe('vanilla');
  });

  it('layers font providers in bottom-to-top stack order', () => {
    const manager = new ResourcePackManager('./assets');

    const providerA = [{ type: 'bitmap', file: 'font/a.png', chars: ['\uE001'] }];
    const providerB = [{ type: 'bitmap', file: 'font/b.png', chars: ['\uE001', '\uE002'] }];

    manager.registerPack({
      id: 'font_a',
      name: 'Font A',
      description: '',
      fontProviders: providerA,
    });

    manager.registerPack({
      id: 'font_b',
      name: 'Font B',
      description: '',
      fontProviders: providerB,
    });

    manager.activatePack('font_a');
    manager.activatePack('font_b');

    const composite = manager.getCompositePack();
    expect(composite.fontProvidersList).toHaveLength(2);
    expect(composite.fontProvidersList[0].providers).toBe(providerA);
    expect(composite.fontProvidersList[1].providers).toBe(providerB);
  });

  it('GlyphAtlas.resetCustomGlyphs cleanses custom glyph state without leaving ghost overrides', async () => {
    const atlas = new GlyphAtlas();
    const baseAdvance = atlas.getAdvance('★');

    // Simulate custom bitmap glyph registration
    (atlas as any).customGlyphs.set('★', {
      image: {} as any,
      sx: 0,
      sy: 0,
      sWidth: 8,
      sHeight: 8,
      dWidth: 8,
      dHeight: 8,
      yOffset: 0,
      advance: 15,
      ascent: 7,
      file: 'custom.png',
      isColor: false,
    });

    expect(atlas.getAdvance('★')).toBe(15);

    // Call reset
    atlas.resetCustomGlyphs();

    // Should immediately revert to base advance
    expect(atlas.getAdvance('★')).toBe(baseAdvance);
  });
});
