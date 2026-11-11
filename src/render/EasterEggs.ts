/**
 * Generic, book-agnostic "easter egg" features:
 *
 * - Animated characters: a glyph in the text is temporarily swapped for other glyphs
 *   (a blink, a twinkle). Layout never changes because the original glyph's advance is kept.
 * - Blank-page image: an image shown on the final page when that page is blank.
 *
 * Nothing here knows about any particular book or author. Hosts opt in through configuration.
 */

export interface AnimatedChar {
  /** The single character in the book text to animate. */
  char: string;
  /** Glyphs shown in order, each for `frameMs`, then the original character returns. */
  frames: string[];
  /** Milliseconds each frame is shown. Default 160. */
  frameMs?: number;
  /**
   * Pause (ms) at rest between runs. A number is exact, a [min, max] pair is random in that range.
   * Default [3500, 6500]. Use 0 to loop the frames continuously.
   */
  delayMs?: number | [number, number];
}

export interface BlankPageImageOptions {
  src: string;
  /** Display size in unscaled book pixels. Defaults to 88 x 100. */
  width?: number;
  height?: number;
  alt?: string;
  title?: string;
}

export const DEFAULT_BLANK_PAGE_IMAGE_WIDTH = 88;
export const DEFAULT_BLANK_PAGE_IMAGE_HEIGHT = 100;
const DEFAULT_FRAME_MS = 160;
const DEFAULT_DELAY_MS: [number, number] = [3500, 6500];

function isSingleCodePoint(value: unknown): value is string {
  return typeof value === 'string' && [...value].length === 1;
}

function toNonNegative(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Normalises user input to a full options object, or null when there is no usable source. */
export function normalizeBlankPageImage(
  input: string | BlankPageImageOptions | null | undefined
): Required<Pick<BlankPageImageOptions, 'src' | 'width' | 'height'>> & BlankPageImageOptions | null {
  if (!input) return null;
  const opts: BlankPageImageOptions = typeof input === 'string' ? { src: input } : input;
  if (typeof opts.src !== 'string' || opts.src.trim() === '') return null;
  const width = opts.width !== undefined && opts.width > 0 ? opts.width : DEFAULT_BLANK_PAGE_IMAGE_WIDTH;
  const height = opts.height !== undefined && opts.height > 0 ? opts.height : DEFAULT_BLANK_PAGE_IMAGE_HEIGHT;
  return { ...opts, src: opts.src.trim(), width, height };
}

interface NormalizedAnimatedChar {
  char: string;
  frames: string[];
  frameMs: number;
  delay: [number, number];
}

/** Drops invalid entries; when a character is listed twice the last entry wins. */
export function normalizeAnimatedChars(input: unknown): NormalizedAnimatedChar[] {
  if (!Array.isArray(input)) return [];
  const byChar = new Map<string, NormalizedAnimatedChar>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const def = raw as Partial<AnimatedChar>;
    if (!isSingleCodePoint(def.char)) continue;
    if (!Array.isArray(def.frames) || def.frames.length === 0 || !def.frames.every(isSingleCodePoint)) continue;
    let delay: [number, number];
    if (Array.isArray(def.delayMs)) {
      const lo = toNonNegative(def.delayMs[0], DEFAULT_DELAY_MS[0]);
      const hi = toNonNegative(def.delayMs[1], DEFAULT_DELAY_MS[1]);
      delay = [Math.min(lo, hi), Math.max(lo, hi)];
    } else if (typeof def.delayMs === 'number') {
      const d = toNonNegative(def.delayMs, DEFAULT_DELAY_MS[0]);
      delay = [d, d];
    } else {
      delay = DEFAULT_DELAY_MS;
    }
    byChar.set(def.char, {
      char: def.char,
      frames: [...def.frames],
      // A zero-length frame would never be seen, so floor it at one millisecond.
      frameMs: Math.max(1, toNonNegative(def.frameMs, DEFAULT_FRAME_MS)),
      delay,
    });
  }
  return [...byChar.values()];
}

interface CharState {
  def: NormalizedAnimatedChar;
  /** -1 while resting, otherwise the index of the frame currently shown. */
  frameIndex: number;
  /** Timestamp of the next state change; -1 means "not scheduled yet". */
  nextAt: number;
}

/**
 * Drives the animations. Time is supplied by the caller (requestAnimationFrame timestamps) and
 * randomness is injectable, so behaviour is deterministic in tests.
 */
export class AnimatedCharController {
  private states = new Map<string, CharState>();

  constructor(
    defs: unknown = [],
    private random: () => number = Math.random
  ) {
    this.setDefs(defs);
  }

  public setDefs(defs: unknown): void {
    this.states = new Map(
      normalizeAnimatedChars(defs).map((def) => [def.char, { def, frameIndex: -1, nextAt: -1 }] as const)
    );
  }

  public has(char: string): boolean {
    return this.states.has(char);
  }

  public chars(): string[] {
    return [...this.states.keys()];
  }

  public get size(): number {
    return this.states.size;
  }

  /** The glyph to draw in place of `char` right now, or null when it should draw normally. */
  public frameFor(char: string): string | null {
    const state = this.states.get(char);
    if (!state || state.frameIndex < 0) return null;
    return state.def.frames[state.frameIndex];
  }

  public isAnimating(char?: string): boolean {
    if (char !== undefined) return (this.states.get(char)?.frameIndex ?? -1) >= 0;
    for (const s of this.states.values()) if (s.frameIndex >= 0) return true;
    return false;
  }

  /** Starts a run immediately (restarting one in progress). Returns false for unknown characters. */
  public play(char: string, now: number): boolean {
    const state = this.states.get(char);
    if (!state) return false;
    state.frameIndex = 0;
    state.nextAt = now + state.def.frameMs;
    return true;
  }

  /** Returns every character to rest and forgets scheduling. Call on page turns. */
  public reset(): void {
    for (const s of this.states.values()) {
      s.frameIndex = -1;
      s.nextAt = -1;
    }
  }

  private randomDelay(def: NormalizedAnimatedChar): number {
    const [lo, hi] = def.delay;
    return lo === hi ? lo : lo + this.random() * (hi - lo);
  }

  /**
   * Advances animations for characters present on the visible page(s).
   * Characters that are not visible are returned to rest.
   * Returns true when something that affects drawing changed, so the caller should re-render.
   */
  public tick(now: number, present: ReadonlySet<string>): boolean {
    let changed = false;
    for (const state of this.states.values()) {
      const { def } = state;
      if (!present.has(def.char)) {
        if (state.frameIndex >= 0) changed = true;
        state.frameIndex = -1;
        state.nextAt = -1;
        continue;
      }
      if (state.nextAt < 0) {
        state.nextAt = now + this.randomDelay(def);
        // A zero delay means "loop continuously": start straight away.
        if (state.nextAt > now) continue;
      }
      if (now < state.nextAt) continue;

      if (state.frameIndex < 0) {
        state.frameIndex = 0;
        state.nextAt = now + def.frameMs;
        changed = true;
      } else if (state.frameIndex + 1 < def.frames.length) {
        state.frameIndex += 1;
        state.nextAt = now + def.frameMs;
        changed = true;
      } else {
        // Run finished: back to rest, or straight into the next run for a continuous loop.
        const delay = this.randomDelay(def);
        if (delay === 0) {
          state.frameIndex = 0;
          state.nextAt = now + def.frameMs;
        } else {
          state.frameIndex = -1;
          state.nextAt = now + delay;
        }
        changed = true;
      }
    }
    return changed;
  }
}
