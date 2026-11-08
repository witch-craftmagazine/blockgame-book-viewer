import type { MinecraftBook, LineLayout, FormattedSpan } from '../engine/types';
import type { BookCanvas } from '../render/BookCanvas';

export interface PageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CharRenderContext {
  char: string;
  x: number;
  y: number;
  style: FormattedSpan;
  pageIndex: number;
}

export interface CharRenderResult {
  char?: string;
  advance?: number;
  handled?: boolean;
}

export interface BookPlugin {
  readonly name: string;

  /** Called when plugin is attached to a canvas instance */
  init?(canvas: BookCanvas): void;

  /** Called when plugin is removed or canvas is destroyed */
  destroy?(): void;

  /** Called when a new book is loaded or pages recalculated */
  onBookChange?(book: MinecraftBook, paginatedPages: LineLayout[][]): void;

  /** Called whenever the active page changes */
  onPageChange?(currentPage: number, totalPages: number): void;

  /** Called right before page text is rendered */
  onBeforeRenderPage?(
    ctx: CanvasRenderingContext2D,
    pageIndex: number,
    side: 'left' | 'right' | 'single',
    rect: PageRect
  ): void;

  /** Called right after page text is rendered */
  onAfterRenderPage?(
    ctx: CanvasRenderingContext2D,
    pageIndex: number,
    side: 'left' | 'right' | 'single',
    rect: PageRect
  ): void;

  /**
   * Called for each character during text rendering.
   * Return an object to replace the character or alter advance, or handled: true to skip standard drawing.
   */
  onRenderChar?(
    ctx: CanvasRenderingContext2D,
    context: CharRenderContext
  ): CharRenderResult | void;

  /**
   * Called when canvas is clicked in book space coordinates (0..width, 0..height).
   * Return true if the event was handled and should not trigger page turns.
   */
  onClick?(
    x: number,
    y: number,
    pageIndex: number,
    side: 'left' | 'right' | 'single'
  ): boolean | void;

  /**
   * Called on every animation tick.
   * Return true to trigger a canvas re-render.
   */
  onTick?(timestamp: number): boolean | void;
}
