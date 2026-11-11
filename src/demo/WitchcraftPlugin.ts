/**
 * Demo only: not part of the library or its public exports.
 *
 * Shows how a host configures the generic easter-egg features for one particular magazine
 * (Witchcraft Magazine) and layers click behaviour on top with an ordinary BookPlugin.
 *
 *  - `witchcraftEggOptions()` returns the `blankPageImage` and `animatedChars` options.
 *  - `WitchcraftPlugin` adds the wink: clicking the eye or the picture plays the blink and a sound.
 */
import type { BookPlugin, CharRenderContext } from '../plugin/BookPlugin';
import type { BookCanvas } from '../render/BookCanvas';
import type { AnimatedChar, BlankPageImageOptions } from '../render/EasterEggs';
import { soundManager } from '../render/SoundEffects';

export const EYE_CHAR = '⏼';

export function witchcraftEggOptions(baseAssetPath: string): {
  blankPageImage: BlankPageImageOptions;
  animatedChars: AnimatedChar[];
} {
  return {
    blankPageImage: {
      src: `${baseAssetPath}/textures/starsweetpea.gif`,
      alt: 'StarSweetpea',
      title: 'StarSweetpea ~ Author of Witchcraft Magazine',
    },
    animatedChars: [{ char: EYE_CHAR, frames: ['◡'], frameMs: 160 }],
  };
}

export class WitchcraftPlugin implements BookPlugin {
  public readonly name = 'witchcraft-plugin';

  private canvas: BookCanvas | null = null;
  private hitBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  private stage: HTMLElement | null = null;

  private readonly onStageClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (target?.classList?.contains('book-blank-page-image')) this.wink();
  };

  public init(canvas: BookCanvas): void {
    this.canvas = canvas;
    this.stage = canvas.getStageElement() ?? null;
    // Capture phase: the overlay image stops its own clicks from bubbling.
    this.stage?.addEventListener('click', this.onStageClick, true);
  }

  public destroy(): void {
    this.stage?.removeEventListener('click', this.onStageClick, true);
    this.stage = null;
    this.canvas = null;
  }

  private wink(): void {
    this.canvas?.playAnimatedChar(EYE_CHAR);
    soundManager.playWink();
  }

  public onBeforeRenderPage(): void {
    this.hitBoxes = [];
  }

  public onRenderChar(_ctx: CanvasRenderingContext2D, context: CharRenderContext): void {
    if (context.char === EYE_CHAR) {
      this.hitBoxes.push({ x: context.x - 2, y: context.y - 2, w: 12, h: 12 });
    }
  }

  public onClick(x: number, y: number): boolean | void {
    for (const box of this.hitBoxes) {
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        this.wink();
        return true;
      }
    }
  }
}
