import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AsciiAmbientManager } from '../src/ambient/AsciiAmbientManager';
import { BookCanvas } from '../src/render/BookCanvas';

describe('AsciiAmbientManager Backdrop System', () => {
  let mockContainer: any;
  let manager: AsciiAmbientManager;

  beforeEach(() => {
    mockContainer = {
      appendChild: (el: any) => el,
      removeChild: (el: any) => el,
    };
    manager = new AsciiAmbientManager(mockContainer as unknown as HTMLElement);
  });

  afterEach(() => {
    manager.destroy();
  });

  it('resolves study scene for designated indoor study issues', () => {
    expect(manager.resolveSceneForIssue('issue1')).toBe('study');
    expect(manager.resolveSceneForIssue('issue3')).toBe('study');
    expect(manager.resolveSceneForIssue('issue5')).toBe('study');
    expect(manager.resolveSceneForIssue('issue9')).toBe('study');
    expect(manager.resolveSceneForIssue('issue13')).toBe('study');
    expect(manager.resolveSceneForIssue('issue15')).toBe('study');
    expect(manager.resolveSceneForIssue('issue18')).toBe('study');
  });

  it('resolves meadow scene for designated night meadow issues', () => {
    expect(manager.resolveSceneForIssue('issue2')).toBe('meadow');
    expect(manager.resolveSceneForIssue('issue4')).toBe('meadow');
    expect(manager.resolveSceneForIssue('issue8')).toBe('meadow');
    expect(manager.resolveSceneForIssue('issue10')).toBe('meadow');
    expect(manager.resolveSceneForIssue('issue14')).toBe('meadow');
    expect(manager.resolveSceneForIssue('issue16')).toBe('meadow');
    expect(manager.resolveSceneForIssue('issue20')).toBe('meadow');
  });

  it('resolves celestial scene for intro', () => {
    expect(manager.resolveSceneForIssue('intro')).toBe('celestial');
  });

  it('resolves corrupted static scene for Issue X and its aliases', () => {
    expect(manager.resolveSceneForIssue('issue2023')).toBe('static');
    expect(manager.resolveSceneForIssue('issueX')).toBe('static');
    expect(manager.resolveSceneForIssue('issue11.5')).toBe('static');
  });

  it('resolves halloween scene for Halloween editions', () => {
    expect(manager.resolveSceneForIssue('issue6')).toBe('halloween');
    expect(manager.resolveSceneForIssue('issue11')).toBe('halloween');
    expect(manager.resolveSceneForIssue('issue17')).toBe('halloween');
  });

  it('resolves winter scene for Christmas editions', () => {
    expect(manager.resolveSceneForIssue('issue7')).toBe('winter');
    expect(manager.resolveSceneForIssue('issue12')).toBe('winter');
    expect(manager.resolveSceneForIssue('issue19')).toBe('winter');
  });

  it('allows ascii background to flow continuously behind the book without artificial boundary holes', () => {
    manager.setIssue('issue1');
    const frame = manager.renderFrame();
    // Grid has content throughout without empty square cutouts
    expect(frame).toContain('═'); // Ceiling beams
    expect(frame).toContain('─'); // Clean desk line
    expect(frame).toContain('/\\_/\\'); // Cat ears
    expect(frame).toContain('|=========|'); // Potted fern rim
    expect(frame).not.toContain('[|||||]'); // No barcode bookshelf stripes
    expect(frame).not.toContain('[////]'); // No diagonal stripes
  });

  it('renders the night meadow using premade fireflies.ts treeline, moon, and swaying grass blades', () => {
    manager.setIssue('issue2'); // Meadow scene
    const frame = manager.renderFrame();
    expect(frame).toContain('_.._'); // Premade crescent moon
    expect(frame).toContain('.-.'); // Premade treeline canopy
    expect(frame).toContain('__'); // Ground line
  });

  it('renders Halloween scene with silk spider, horned owl on branch, and jack-o-lanterns', () => {
    manager.setIssue('issue11'); // Halloween scene
    const frame = manager.renderFrame();
    expect(frame).toContain('##'); // Silk spider body
    expect(frame).toContain('═════'); // Owl branch
    expect(frame).toContain('_/_'); // Pumpkin stem
  });

  it('renders Winter scene with multi-layer snow, wooden fence snowdrifts, and snowman', () => {
    manager.setIssue('issue12'); // Winter scene
    const frame = manager.renderFrame();
    expect(frame).toContain('_[===]_'); // Snowman top hat
    expect(frame).toContain('─'); // Fence rails
    expect(frame).toContain('▁'); // Fence post snow caps
  });

  it('renders Static scene with CRT frame, hum bar, and corrupted lore', () => {
    (manager as any).cols = 80;
    (manager as any).rows = 30;
    manager.setIssue('issue2023'); // Static scene
    const frame = manager.renderFrame();
    expect(frame).toContain('╭'); // CRT frame corner
    expect(frame).toContain('╯'); // CRT frame corner
  });

  it('renders Celestial scene with moon surface and astrolabe alignment ring', () => {
    manager.setIssue('intro'); // Celestial scene
    const frame = manager.renderFrame();
    expect(frame).toContain('.---.'); // Moon disc boundary
    expect(frame).toContain('⏼'); // Astrolabe center rune
  });

  it('positions top elements below the toolbar and anchors bottom elements near the bottom edge on portrait screens', () => {
    // Simulate portrait dimensions (e.g. 50 cols, 60 rows)
    (manager as any).cols = 50;
    (manager as any).rows = 60;
    manager.setIssue('issue1'); // Study scene
    const frame = manager.renderFrame();
    const lines = frame.split('\n');

    // Rows 0-3 are clear for the toolbar
    expect(lines[0]).not.toContain('╦');
    expect(lines[1]).not.toContain('╦');
    expect(lines[2]).not.toContain('╦');
    expect(lines[3]).not.toContain('╦');
    // Row 4 has the ceiling beam safely below the toolbar
    expect(lines[4]).toContain('╦');

    // Desk line is anchored near the true bottom at row 58 (rows - 2)
    expect(lines[58]).toContain('─');
  });

  it('toggles ambient backdrop on and off', () => {
    expect(manager.isEnabled()).toBe(true);
    const toggledOff = manager.toggle();
    expect(toggledOff).toBe(false);
    expect(manager.isEnabled()).toBe(false);

    const toggledOn = manager.toggle();
    expect(toggledOn).toBe(true);
    expect(manager.isEnabled()).toBe(true);
  });

  it('sets data-scene attribute on preElement for light and dark responsive CSS styling', () => {
    manager.setIssue('issue1');
    expect(manager.getPreElement()?.getAttribute('data-scene')).toBe('study');

    manager.setIssue('issue2');
    expect(manager.getPreElement()?.getAttribute('data-scene')).toBe('meadow');

    manager.setIssue('issue6');
    expect(manager.getPreElement()?.getAttribute('data-scene')).toBe('halloween');

    manager.setIssue('issue7');
    expect(manager.getPreElement()?.getAttribute('data-scene')).toBe('winter');

    manager.setIssue('issue2023');
    expect(manager.getPreElement()?.getAttribute('data-scene')).toBe('static');

    manager.setIssue('intro');
    expect(manager.getPreElement()?.getAttribute('data-scene')).toBe('celestial');
  });

  it('renders frame output without undefined or NaN tokens', () => {
    const scenes: ('study' | 'meadow' | 'halloween' | 'winter' | 'static' | 'celestial')[] = [
      'study', 'meadow', 'halloween', 'winter', 'static', 'celestial'
    ];

    for (const sc of scenes) {
      if (sc === 'celestial') manager.setIssue('intro');
      else if (sc === 'static') manager.setIssue('issue2023');
      else if (sc === 'halloween') manager.setIssue('issue11');
      else if (sc === 'winter') manager.setIssue('issue12');
      else manager.setIssue('issue1');

      const frame = manager.renderFrame();
      expect(typeof frame).toBe('string');
      expect(frame).not.toContain('undefined');
      expect(frame).not.toContain('NaN');
      expect(frame.length).toBeGreaterThan(50);
    }
  });

  it('correctly calculates the visible book page rectangle excluding transparent canvas margins', () => {
    const container = document.createElement('div');
    const bookCanvas = new BookCanvas({ container });
    const canvas = bookCanvas.getCanvas();
    canvas.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 1132,
      bottom: 626,
      width: 1032, // 344 * 3 (double mode)
      height: 576, // 192 * 3
      x: 100,
      y: 50,
      toJSON: () => {},
    } as DOMRect);

    // Double page mode: [26, 318] * 3 = [78, 954] offset
    const doubleRect = bookCanvas.getBookPageRect();
    expect(doubleRect).not.toBeNull();
    expect(doubleRect!.left).toBe(100 + 26 * 3); // 178
    expect(doubleRect!.right).toBe(100 + 318 * 3); // 1054
    expect(doubleRect!.top).toBe(50 + 1 * 3); // 53
    expect(doubleRect!.bottom).toBe(50 + 181 * 3); // 593

    // Single page mode: [20, 166] * 3 = [60, 498] offset
    bookCanvas.setViewMode('single');
    canvas.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 676,
      bottom: 626,
      width: 576, // 192 * 3 (single mode)
      height: 576, // 192 * 3
      x: 100,
      y: 50,
      toJSON: () => {},
    } as DOMRect);

    const singleRect = bookCanvas.getBookPageRect();
    expect(singleRect).not.toBeNull();
    expect(singleRect!.left).toBe(100 + 20 * 3); // 160
    expect(singleRect!.right).toBe(100 + 166 * 3); // 598
    expect(singleRect!.top).toBe(50 + 1 * 3); // 53
    expect(singleRect!.bottom).toBe(50 + 181 * 3); // 593
  });
});
