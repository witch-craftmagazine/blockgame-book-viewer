import type { ResourcePackInfo } from '../engine/ResourcePackManager';

/**
 * Creates the Lithos 32x (HD) resource pack preset.
 * High-definition 32x book texture and Lithos font by Eleazzaar.
 */
export function createLithosPack(baseAssetPath = './assets'): ResourcePackInfo {
  return {
    id: 'lithos',
    name: 'Lithos (HD 32x)',
    description: 'High-definition 32x book texture and Lithos font by Eleazzaar',
    iconUrl: `${baseAssetPath}/packs/lithos/pack.png`,
    textures: {
      book: `${baseAssetPath}/packs/lithos/textures/gui/book.png`,
      pageForward: `${baseAssetPath}/packs/lithos/textures/gui/page_forward.png`,
      pageForwardHover: `${baseAssetPath}/packs/lithos/textures/gui/page_forward_highlighted.png`,
      pageBackward: `${baseAssetPath}/packs/lithos/textures/gui/page_backward.png`,
      pageBackwardHover: `${baseAssetPath}/packs/lithos/textures/gui/page_backward_highlighted.png`,
    },
    fontTextures: {
      ascii: `${baseAssetPath}/packs/lithos/textures/font/ascii.png`,
      accented: `${baseAssetPath}/packs/lithos/textures/font/accented.png`,
      nonlatin: `${baseAssetPath}/packs/lithos/textures/font/nonlatin_european.png`,
    },
  };
}

/**
 * Creates the Craftadia server pack preset.
 * Official server pack with custom emoji fonts, banner logos, and rank tags with Lithos HD font.
 */
export function createCraftadiaPack(baseAssetPath = './assets'): ResourcePackInfo {
  return {
    id: 'craftadia',
    name: 'Craftadia (Server Pack)',
    description: 'Official server pack with custom emoji fonts, banner logos, and rank tags with Lithos HD font',
    iconUrl: `${baseAssetPath}/packs/craftadia/pack.png`,
    fontBaseUrl: `${baseAssetPath}/packs/craftadia/assets/minecraft`,
    textures: {
      book: `${baseAssetPath}/packs/lithos/textures/gui/book.png`,
      pageForward: `${baseAssetPath}/packs/lithos/textures/gui/page_forward.png`,
      pageForwardHover: `${baseAssetPath}/packs/lithos/textures/gui/page_forward_highlighted.png`,
      pageBackward: `${baseAssetPath}/packs/lithos/textures/gui/page_backward.png`,
      pageBackwardHover: `${baseAssetPath}/packs/lithos/textures/gui/page_backward_highlighted.png`,
    },
    fontTextures: {
      ascii: `${baseAssetPath}/packs/lithos/textures/font/ascii.png`,
      accented: `${baseAssetPath}/packs/lithos/textures/font/accented.png`,
      nonlatin: `${baseAssetPath}/packs/lithos/textures/font/nonlatin_european.png`,
    },
  };
}
