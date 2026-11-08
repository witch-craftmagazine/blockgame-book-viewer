/**
 * AsciiAmbientManager: Ambient animated ASCII art backdrop for Minecraft Magazine.
 * 
 * Features:
 * - Flows seamlessly across the viewport and behind the book (no artificial bounding box barrier).
 * - High-contrast, vibrant, and atmospheric colors with text-shadow glow.
 * - Mobile responsive: adaptively fills top and bottom margins on portrait screens
 *   and side flanks on widescreen displays.
 * - Slow, hypnotic animation (~8-10 FPS).
 * - Dynamic scene selection:
 *   - Witch's Study (Candle, Sleeping Cat, Potted Fern & Apothecary): Issues 1, 3, 5, 9, 13, 15, 18.
 *   - Night Meadow (Treeline, Crescent Moon & Bioluminescent Fireflies): Issues 2, 4, 8, 10, 14, 16, 20.
 *   - Holiday editions: "Halloween" (Spider, Owl, Jack-o'-Lanterns) for Issues 6, 11, 17;
 *     "Winter" (Snowfall & Frost) for Issues 7, 12, 19.
 *   - Issue X: Corrupted "Static" (CRT TV Static, glitch scanlines, corrupted mantras).
 *   - Intro: "Celestial" (Moon Phases, Constellations & Starlight).
 */

export type AmbientSceneType = 'study' | 'meadow' | 'halloween' | 'winter' | 'static' | 'celestial';

interface CellDimensions {
  width: number;
  height: number;
}

export class AsciiAmbientManager {
  private container: HTMLElement;
  private preElement: HTMLPreElement;
  private currentScene: AmbientSceneType = 'meadow';
  private defaultStandardScene: AmbientSceneType;
  private isRunning = false;
  private animFrameId: number | null = null;
  private lastFrameTimestamp = 0;
  private frameDurationMs = 1000 / 8; // ~125ms per frame (~8 FPS)
  private simTime = 0;
  private enabled = true;
  private cellDim: CellDimensions = { width: 7.2, height: 13.5 };

  // Reusable grid buffers
  private cols = 80;
  private rows = 30;

  constructor(container: HTMLElement) {
    this.container = container;
    
    // Randomize standard reading scene on load between 'study' and 'meadow'
    this.defaultStandardScene = Math.random() < 0.5 ? 'study' : 'meadow';
    this.currentScene = this.defaultStandardScene;

    // Load persisted preference if available
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('witchcraft_ascii_ambient');
        if (stored !== null) {
          this.enabled = stored === 'true';
        }
      }
    } catch {}

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      this.preElement = document.createElement('pre');
      this.preElement.className = 'ascii-ambient-pre';
      this.preElement.setAttribute('aria-hidden', 'true');
      this.container?.appendChild?.(this.preElement);
    } else {
      this.preElement = {
        style: { setProperty: () => {}, removeProperty: () => {}, display: 'block' },
        setAttribute: () => {},
        getAttribute: () => null,
        remove: () => {},
        textContent: '',
      } as unknown as HTMLPreElement;
    }

    this.measureCellDimensions();
    this.updateGridSize();
    this.updateSceneStyles();

    // Listeners for window resize and visibility
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', this.handleResize);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  public setCanvasElement(_canvas: HTMLCanvasElement | null): void {
    // Retained for interface compatibility; boundary masking is removed.
  }

  public setBoundsProvider(_provider: (() => DOMRect | null) | null): void {
    // Retained for interface compatibility; boundary masking is removed.
  }

  public setIssue(issueId: string): void {
    const scene = this.resolveSceneForIssue(issueId);
    if (scene !== this.currentScene) {
      this.currentScene = scene;
      this.simTime = 0; // Reset scene time for fresh entrance
      this.updateSceneStyles();
    }
  }

  public resolveSceneForIssue(issueId: string): AmbientSceneType {
    if (issueId === 'intro') {
      return 'celestial';
    }
    if (issueId === 'issue2023' || issueId === 'issueX' || issueId === 'issue11.5' || issueId === 'halloween-special-2023') {
      return 'static';
    }
    if (['issue6', 'issue11', 'issue17'].includes(issueId)) {
      return 'halloween';
    }
    if (['issue7', 'issue12', 'issue19'].includes(issueId)) {
      return 'winter';
    }
    // Specific issues switched to the night meadow design
    if (['issue2', 'issue4', 'issue8', 'issue10', 'issue14', 'issue16', 'issue20'].includes(issueId)) {
      return 'meadow';
    }
    // Specific issues assigned to witch's study design
    if (['issue1', 'issue3', 'issue5', 'issue9', 'issue13', 'issue15', 'issue18'].includes(issueId)) {
      return 'study';
    }
    return this.defaultStandardScene;
  }

  public getCurrentScene(): AmbientSceneType {
    return this.currentScene;
  }

  public getPreElement(): HTMLPreElement | null {
    return this.preElement;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('witchcraft_ascii_ambient', String(this.enabled));
      }
    } catch {}

    if (this.enabled) {
      this.start();
      if (this.preElement?.style) {
        this.preElement.style.display = 'block';
      }
    } else {
      this.stop();
      if (this.preElement?.style) {
        this.preElement.style.display = 'none';
        this.preElement.textContent = '';
      }
    }
    return this.enabled;
  }

  public start(): void {
    if (this.isRunning || !this.enabled) return;
    this.isRunning = true;
    this.lastFrameTimestamp = performance.now();
    this.loop(this.lastFrameTimestamp);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.animFrameId);
      } else {
        clearTimeout(this.animFrameId as any);
      }
      this.animFrameId = null;
    }
  }

  public destroy(): void {
    this.stop();
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this.handleResize);
    }
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof this.preElement?.remove === 'function') {
      this.preElement.remove();
    }
  }

  private handleResize = (): void => {
    this.measureCellDimensions();
    this.updateGridSize();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stop();
    } else if (this.enabled) {
      this.start();
    }
  };

  private measureCellDimensions(): void {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      const testSpan = document.createElement('span');
      testSpan.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      testSpan.style.fontSize = '12px';
      testSpan.style.lineHeight = '1.15';
      testSpan.style.position = 'absolute';
      testSpan.style.visibility = 'hidden';
      testSpan.textContent = 'MMMMMMMMMM'; // 10 chars
      document.body.appendChild(testSpan);
      const rect = testSpan.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        this.cellDim = {
          width: rect.width / 10,
          height: rect.height,
        };
      }
      testSpan.remove();
    } catch {}
  }

  private updateGridSize(): void {
    const w = (typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth > 0) 
      ? window.innerWidth 
      : 1200;
    const h = (typeof window !== 'undefined' && typeof window.innerHeight === 'number' && window.innerHeight > 0) 
      ? window.innerHeight 
      : 800;
    this.cols = Math.max(20, Math.floor(w / this.cellDim.width));
    this.rows = Math.max(10, Math.floor(h / this.cellDim.height));
  }

  private updateSceneStyles(): void {
    if (!this.preElement) return;
    if (typeof this.preElement.setAttribute === 'function') {
      this.preElement.setAttribute('data-scene', this.currentScene);
    }
    if (this.container && typeof this.container.setAttribute === 'function') {
      this.container.setAttribute('data-scene', this.currentScene);
    }
    // Remove inline style properties so stylesheet rules for both dark mode
    // and high-contrast light mode (@media prefers-color-scheme: light) take precedence
    if (this.preElement.style?.removeProperty) {
      this.preElement.style.removeProperty('--ascii-color');
      this.preElement.style.removeProperty('--ascii-glow');
    }
  }

  private loop = (timestamp: number): void => {
    if (!this.isRunning) return;

    const delta = timestamp - this.lastFrameTimestamp;
    if (delta >= this.frameDurationMs) {
      this.lastFrameTimestamp = timestamp - (delta % this.frameDurationMs);
      this.simTime += 0.05;
      this.renderFrame();
    }

    if (typeof requestAnimationFrame === 'function') {
      this.animFrameId = requestAnimationFrame(this.loop);
    } else {
      this.animFrameId = setTimeout(() => this.loop(performance.now()), 16) as any;
    }
  };

  /**
   * Renders the active ASCII scene across the entire viewport.
   * Characters flow seamlessly behind the book with no artificial boundary mask.
   */
  public renderFrame(): string {
    const grid: string[][] = Array.from({ length: this.rows }, () => new Array<string>(this.cols).fill(' '));
    const isPortrait = this.cols < 72 || this.cols < this.rows;

    // 1. Generate expansive scene content into grid
    switch (this.currentScene) {
      case 'study':
        this.drawStudyScene(grid, this.simTime, isPortrait);
        break;
      case 'meadow':
        this.drawMeadowScene(grid, this.simTime, isPortrait);
        break;
      case 'halloween':
        this.drawHalloweenScene(grid, this.simTime, isPortrait);
        break;
      case 'winter':
        this.drawWinterScene(grid, this.simTime, isPortrait);
        break;
      case 'static':
        this.drawStaticScene(grid, this.simTime);
        break;
      case 'celestial':
        this.drawCelestialScene(grid, this.simTime, isPortrait);
        break;
    }

    // 2. Serialize grid to pre element (flows behind book)
    const text = grid.map(row => row.join('')).join('\n');
    this.preElement.textContent = text;
    return text;
  }

  /**
   * Optional helper kept for backwards compatibility.
   * No longer called automatically by renderFrame().
   */
  public maskBookBoundary(_grid: string[][]): void {
    // Deliberately removed: ASCII background flows naturally behind the book.
  }

  /* ------------------------------------------------------------- */
  /* SCENE 1: THE WITCH'S STUDY (Desk, Candle, Fern & Cat)         */
  /* ------------------------------------------------------------- */
  private drawStudyScene(grid: string[][], t: number, isPortrait: boolean): void {
    // 1. Top Ceiling: Wooden beams & hanging dried herbs (below toolbar on mobile)
    const beamRow = isPortrait ? 4 : Math.min(3, Math.floor(this.rows * 0.08));
    if (beamRow >= 0 && beamRow < this.rows) {
      for (let c = 0; c < this.cols; c++) {
        grid[beamRow][c] = c % 12 === 0 ? '╦' : '═';
      }
      if (beamRow + 1 < this.rows) {
        for (let c = 0; c < this.cols; c += 12) {
          if (c + 6 < this.cols) {
            grid[beamRow + 1][c + 6] = '|';
            if (beamRow + 2 < this.rows) {
              const herb = c % 24 === 0 ? '✿' : '✦';
              grid[beamRow + 2][c + 6] = herb;
            }
          }
        }
      }
    }

    // 2. Gentle magical dust motes floating in the room
    const moteCount = Math.min(20, Math.floor(this.cols * 0.25));
    for (let i = 0; i < moteCount; i++) {
      const seed = i * 47.1;
      const c = Math.floor((seed * 3.7 + t * 0.5) % this.cols);
      const r = Math.floor(beamRow + 2 + ((seed * 1.9) % Math.max(1, this.rows - 10)));
      const twinkle = Math.sin(t * 1.6 + seed);
      if (r >= 0 && r < this.rows && c >= 0 && c < this.cols && twinkle > 0.65) {
        grid[r][c] = twinkle > 0.88 ? '✦' : '·';
      }
    }

    // 3. Desk surface across the entire bottom (placed further down on mobile)
    const deskY = isPortrait ? (this.rows - 2) : Math.max(this.rows - 7, Math.floor(this.rows * 0.86));
    if (deskY < this.rows) {
      for (let c = 0; c < this.cols; c++) {
        grid[deskY][c] = '─';
      }
    }

    // 4. Stamping Fern, Candle, Cat & Potion Flask
    if (isPortrait) {
      // Mobile Portrait: Arrange comfortably in the bottom margin below the book
      const baseRow = deskY - 9;

      // Left: Glowing Candle
      const candleCol = Math.max(1, Math.floor(this.cols * 0.03));
      this.stampCandle(grid, candleCol, baseRow, t);

      // Center: Potted Fern (if enough room)
      if (this.cols >= 44) {
        const fernCol = Math.floor(this.cols * 0.36);
        this.stampFern(grid, fernCol, baseRow + 1, t);
      }

      // Right: Sleeping Cat
      const catCol = Math.min(this.cols - 14, Math.floor(this.cols * 0.68));
      this.stampCat(grid, catCol, baseRow + 4, t);
    } else {
      // Desktop Widescreen:
      // Left side: Lush Potted Fern & Glowing Brass Candle
      const fernCol = Math.max(2, Math.floor(this.cols * 0.04));
      const candleCol = Math.min(Math.floor(this.cols * 0.22), fernCol + 15);
      const baseRow = Math.min(this.rows - 10, deskY - 9);

      this.stampFern(grid, fernCol, baseRow + 1, t);
      this.stampCandle(grid, candleCol, baseRow, t);

      // Right side: Potion Flask & Sleeping Cat
      const catCol = Math.min(this.cols - 16, Math.floor(this.cols * 0.82));
      const flaskCol = Math.max(catCol - 12, Math.floor(this.cols * 0.68));

      this.stampPotionFlask(grid, flaskCol, baseRow + 4, t);
      this.stampCat(grid, catCol, baseRow + 4, t);
    }
  }

  private stampCandle(grid: string[][], col: number, row: number, t: number): void {
    const flicker = Math.sin(t * 3.5);
    const flameShape = flicker > 0.4 ? ')' : flicker < -0.4 ? '(' : '!';
    const ember = Math.sin(t * 2.2) > 0.2 ? '✦' : '·';
    const haloChar = Math.sin(t * 1.8) > 0.35 ? '*' : ' ';
    const smokeWisp = Math.sin(t * 1.5) > 0.4 ? '~' : Math.sin(t * 1.5) < -0.4 ? '(' : ' ';

    // Wax drip running down the candlestick side
    const dripPhase = Math.floor((t * 0.8) % 4);
    const leftDrip = dripPhase === 1 ? '.' : dripPhase === 2 ? '|' : ' ';
    const rightDrip = dripPhase === 3 ? '.' : ' ';

    const sprite = [
      `     ${smokeWisp}     `,
      `    ${haloChar}${ember}${haloChar}    `,
      `    (${flameShape})    `,
      '   ( * )   ',
      '    |i|    ',
      '   [---]   ',
      `  ${leftDrip}|   |${rightDrip}  `,
      '   |===|   ',
      '  (     )  ',
      ' _(_____)_c',
      '[_________]',
    ];

    for (let r = 0; r < sprite.length; r++) {
      const targetRow = row + r;
      if (targetRow >= 0 && targetRow < this.rows) {
        const line = sprite[r];
        for (let c = 0; c < line.length; c++) {
          const targetCol = col + c;
          if (targetCol >= 0 && targetCol < this.cols && line[c] !== ' ') {
            grid[targetRow][targetCol] = line[c];
          }
        }
      }
    }
  }

  private stampFern(grid: string[][], col: number, row: number, t: number): void {
    const sway = Math.sin(t * 1.4);
    // Animated lush fern fronds swaying in the room breeze
    const tipRow = sway > 0.35 
      ? '   \\  |  .   '
      : sway < -0.35
        ? '   .  |  /   '
        : '   .  |  .   ';
    const midRow = sway > 0.35
      ? ' .  \\ | /    '
      : sway < -0.35
        ? '    \\ | /  . '
        : ' .  \\ | /  . ';

    const sprite = [
      tipRow,
      midRow,
      '-( (\\ | /) )-',
      ' (( (\\|/) )) ',
      '  ( (\\|/) )  ',
      ' ._________. ',
      ' |=========| ',
      ' \\         / ',
      '  `=======\'  ',
    ];

    for (let r = 0; r < sprite.length; r++) {
      const targetRow = row + r;
      if (targetRow >= 0 && targetRow < this.rows) {
        const line = sprite[r];
        for (let c = 0; c < line.length; c++) {
          const targetCol = col + c;
          if (targetCol >= 0 && targetCol < this.cols && line[c] !== ' ') {
            grid[targetRow][targetCol] = line[c];
          }
        }
      }
    }
  }

  private stampCat(grid: string[][], col: number, row: number, t: number): void {
    // 4-second breath cycle: back rises on inhalation, relaxes on exhalation
    const breath = Math.sin(t * 1.57); // ~4 sec period
    const isInhaling = breath > 0.3;
    const isDeepInhale = breath > 0.75;

    // Periodic tail tip flick and ear twitch
    const flick = Math.sin(t * 0.8) > 0.65;
    const tailTip = flick ? '.-`' : Math.sin(t * 1.4) > 0.3 ? '~' : '-';
    
    // Ear twitch: right ear flattens slightly during intermittent flicks
    const earTwitch = Math.sin(t * 0.5) > 0.88;
    const ears = earTwitch ? '   /\\_.-   ' : '   /\\_/\\   ';

    // Face features relaxing during deep sleep
    const face = isDeepInhale ? '  (=u.u=)  ' : '  (=-.-=)  ';

    // Animated back and striped body rising with breath
    const backLine = isDeepInhale
      ? ' _(~~~~~)_. '
      : isInhaling
        ? ' _(_____)_  '
        : '  (_____)_  ';

    const sprite = [
      ears,
      face,
      ' /\'     \'\\ ',
      backLine,
      `|_________${tailTip}`,
    ];

    // Drifting gentle sleep Z's with organic diagonal sway
    const zPhase = Math.floor((t * 0.8) % 4);
    if (row - 1 >= 0 && col + 10 < this.cols && zPhase >= 1) {
      grid[row - 1][col + 10] = 'z';
    }
    if (row - 2 >= 0 && col + 12 < this.cols && zPhase >= 2) {
      grid[row - 2][col + 12] = 'Z';
    }
    if (row - 3 >= 0 && col + 14 < this.cols && zPhase >= 3) {
      grid[row - 3][col + 14] = '·';
    }

    for (let r = 0; r < sprite.length; r++) {
      const targetRow = row + r;
      if (targetRow >= 0 && targetRow < this.rows) {
        const line = sprite[r];
        for (let c = 0; c < line.length; c++) {
          const targetCol = col + c;
          if (targetCol >= 0 && targetCol < this.cols && line[c] !== ' ') {
            grid[targetRow][targetCol] = line[c];
          }
        }
      }
    }
  }

  private stampPotionFlask(grid: string[][], col: number, row: number, t: number): void {
    const bubble = Math.sin(t * 2.5) > 0 ? '✦' : '·';
    const sprite = [
      '   ( )   ',
      '  [---]  ',
      '  /   \\  ',
      ` |  ${bubble}  | `,
      '  \\___/  ',
    ];

    for (let r = 0; r < sprite.length; r++) {
      const targetRow = row + r;
      if (targetRow >= 0 && targetRow < this.rows) {
        const line = sprite[r];
        for (let c = 0; c < line.length; c++) {
          const targetCol = col + c;
          if (targetCol >= 0 && targetCol < this.cols && line[c] !== ' ') {
            grid[targetRow][targetCol] = line[c];
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------- */
  /* SCENE 2: THE NIGHT MEADOW (Premade fireflies.ts artwork)     */
  /* ------------------------------------------------------------- */
  private drawMeadowScene(grid: string[][], t: number, isPortrait: boolean): void {
    // 1. Crescent moon from premade fireflies.ts
    const MOON = ['   _.._', ' .\' .-\'', '/  /', '|  |', '\\  \\', ' `._`-.'];
    const moonCol = Math.max(4, Math.floor(this.cols * (isPortrait ? 0.80 : 0.88)));
    const moonRow = isPortrait ? 4 : 2;
    for (let r = 0; r < MOON.length; r++) {
      if (moonRow + r < this.rows) {
        for (let c = 0; c < MOON[r].length; c++) {
          if (moonCol + c < this.cols && MOON[r][c] !== ' ') {
            grid[moonRow + r][moonCol + c] = MOON[r][c];
          }
        }
      }
    }

    // 2. Stars across the upper night sky
    const horizon = isPortrait ? (this.rows - 5) : Math.min(this.rows - 5, Math.floor(this.rows * 0.78));
    const ground = isPortrait ? (this.rows - 1) : Math.min(this.rows - 1, horizon + 4);
    const minStarRow = isPortrait ? 4 : 1;
    const maxStarRow = Math.max(minStarRow + 2, horizon - 4);
    const starCount = Math.min(30, Math.floor(this.cols * 0.45));
    for (let i = 0; i < starCount; i++) {
      const seed = i * 61.3;
      const c = Math.floor(seed % Math.max(1, this.cols - 14));
      const r = minStarRow + Math.floor((seed * 0.3) % Math.max(1, maxStarRow - minStarRow));
      const pulse = Math.sin(t * 1.3 + seed);
      if (r < this.rows && c < this.cols && pulse > 0.35 && grid[r][c] === ' ') {
        grid[r][c] = pulse > 0.85 ? '+' : pulse > 0.6 ? '·' : '.';
      }
    }

    // 3. Rolling treeline canopy from premade fireflies.ts
    const TREES = [
      '                  .-.                         _',
      '     .-.   .--. .\'   `.  .-.       .--.    .-\' `-.   .-.',
      '__.-\'   `-\'    `       `-\'   `-.__.\'    `--\'      `-\'   `-._',
    ];
    for (let r = 0; r < TREES.length; r++) {
      const row = horizon - 3 + r;
      if (row >= 0 && row < this.rows) {
        const line = TREES[r];
        for (let c = 0; c < this.cols; c++) {
          const ch = line[c % line.length];
          if (ch !== ' ') grid[row][c] = ch;
        }
      }
    }

    // 4. Ground base line from premade fireflies.ts
    if (ground >= 0 && ground < this.rows) {
      for (let c = 0; c < this.cols; c++) {
        grid[ground][c] = '_';
      }
    }

    // 5. Dynamic tufts of fanned grass blades swaying (from fireflies.ts)
    const FANS = [[-1, 0, 1], [-1, 0, 1], [0, 1], [-1, 0], [-1, 1]];
    for (let x = 2; x < this.cols - 2; x += 4) {
      const seed = x * 17.3;
      const h = 2 + Math.floor((Math.sin(seed) * 0.5 + 0.5) * 3);
      const ph = x * 0.23;
      const fanIdx = Math.floor(Math.abs(Math.sin(seed * 2.1)) * FANS.length) % FANS.length;
      const fan = FANS[fanIdx];
      const sway = 0.6 * Math.sin(t * 1.6 - ph);

      for (const lean of fan) {
        const bladeH = lean !== 0 ? Math.max(1, h - 1) : h;
        let px = x + 0.5;
        for (let k = 1; k <= bladeH; k++) {
          const currX = x + 0.5 + lean * k + sway * (k / bladeH) ** 2;
          const d = currX - px;
          const charCol = Math.floor(currX);
          const charRow = ground - k;
          if (charCol >= 0 && charCol < this.cols && charRow >= horizon && charRow < this.rows) {
            grid[charRow][charCol] = d > 0.4 ? '/' : d < -0.4 ? '\\' : '|';
          }
          px = currX;
        }
      }
    }

    // 6. Sweeping wave fireflies with halo glows (from fireflies.ts)
    const GLOW: [number, string][] = [[0.6, '*'], [0.34, '+'], [0.17, '·'], [0.07, '.']];
    const HALO: [number, number, number][] = [
      [0, 0, 1], [-1, 0, 0.45], [1, 0, 0.45], [-2, 0, 0.13], [2, 0, 0.13], [0, -1, 0.16], [0, 1, 0.16]
    ];
    const WAVE = 11;
    const flyCount = Math.min(44, Math.floor(this.cols * 0.6));
    for (let i = 0; i < flyCount; i++) {
      const seed = i * 113.7;
      const fx = 3 + (seed % Math.max(1, this.cols - 6));
      const fy = horizon + 1 + ((seed * 0.5) % Math.max(1, ground - horizon - 2));

      const w0 = 0.05 + (i % 5) * 0.02;
      const w1 = 0.11 + (i % 4) * 0.03;
      const w2 = 0.07 + (i % 3) * 0.02;
      const p0 = (seed * 0.7) % 6.28;
      const p1 = (seed * 1.3) % 6.28;
      const p2 = (seed * 2.1) % 6.28;

      const x = fx + 6 * Math.sin(w0 * t + p0) + 2.5 * Math.sin(w1 * t + p1);
      const y = fy + 1.4 * Math.sin(w2 * t + p2) + 0.6 * Math.sin(w1 * 1.7 * t + p0);

      // Traveling wave flash across the meadow
      const waveProgress = (t % WAVE) / WAVE;
      const waveFront = waveProgress * this.cols;
      const distToWave = Math.abs(x - waveFront);
      const pulse = distToWave < 6
        ? Math.max(0, 1 - distToWave / 6)
        : Math.sin(t * 2.0 + seed);

      if (pulse > 0.15) {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        for (const [dc, dr, k] of HALO) {
          const cc = cx + dc;
          const rr = cy + dr;
          if (cc >= 0 && cc < this.cols && rr >= horizon && rr < ground) {
            const val = pulse * k;
            const match = GLOW.find(([minVal]) => val >= minVal);
            if (match && grid[rr][cc] === ' ') {
              grid[rr][cc] = match[1];
            }
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------- */
  /* SCENE 3: HALLOWEEN (Web Hub, Silk Spider, Owl & Pumpkins)     */
  /* ------------------------------------------------------------- */
  private drawHalloweenScene(grid: string[][], t: number, isPortrait: boolean): void {
    // 1. Sprawling webs across upper corners (below toolbar on mobile)
    const webStartRow = isPortrait ? 4 : 0;
    const webRows = Math.min(6, Math.floor(this.rows * 0.18));
    for (let r = 0; r < webRows; r++) {
      const targetR = webStartRow + r;
      for (let c = 0; c < 16; c++) {
        if (targetR < this.rows && c < this.cols) {
          if ((c + r * 2) % 4 === 0) grid[targetR][c] = '\\';
          else if (r === 0 || (c === 0 && r > 0)) grid[targetR][c] = '_';
        }
      }
      for (let c = this.cols - 16; c < this.cols; c++) {
        if (targetR < this.rows && c >= 0 && (c - r * 2) % 4 === 0) {
          grid[targetR][c] = '/';
        }
      }
    }

    // 2. Spider descending on silk line with leg motion from spider.ts
    const spiderCol = Math.max(4, Math.floor(this.cols * (isPortrait ? 0.16 : 0.10)));
    const dropRange = Math.max(5, Math.floor(this.rows * 0.32));
    const dropCycle = (t * 0.4) % 6.28;
    const dropNorm = Math.abs(Math.sin(dropCycle));
    const spiderY = Math.floor(webStartRow + 1 + dropNorm * dropRange);

    for (let r = webStartRow; r < spiderY; r++) {
      if (r < this.rows && spiderCol < this.cols) grid[r][spiderCol] = '|';
    }

    // Stepping legs (alternating poses)
    const isStep = Math.sin(t * 1.8) > 0;
    const leftLegs = isStep ? [' \\ ', ' | ', '/  '] : ['  |', ' / ', '  /'];
    const rightLegs = isStep ? [' / ', ' | ', '  \\'] : ['|  ', ' \\ ', '\\  '];
    const spiderBody = [
      `${leftLegs[0]}(##)${rightLegs[0]}`,
      `${leftLegs[1]}(@)${rightLegs[1]}`,
      `${leftLegs[2]}\\V/${rightLegs[2]}`,
    ];
    for (let r = 0; r < spiderBody.length; r++) {
      const tr = spiderY + r;
      if (tr < this.rows) {
        const line = spiderBody[r];
        const sc = spiderCol - 3;
        for (let c = 0; c < line.length; c++) {
          if (sc + c >= 0 && sc + c < this.cols && line[c] !== ' ') {
            grid[tr][sc + c] = line[c];
          }
        }
      }
    }

    // 3. Horned Owl perched on branch with head-turning and blinking (from owl.ts)
    const owlCol = Math.min(this.cols - 16, Math.floor(this.cols * (isPortrait ? 0.72 : 0.82)));
    const owlRow = isPortrait ? 4 : Math.max(2, Math.floor(this.rows * 0.14));

    // Turn head: -1 looking left, 0 facing front, 1 looking right
    const headCycle = (t * 0.25) % (Math.PI * 2);
    const headTurn = Math.sin(headCycle);
    const isLeft = headTurn < -0.4;
    const isRight = headTurn > 0.4;

    // Slow organic blink cycle
    const isBlink = Math.sin(t * 0.45) > 0.82;
    const eyes = isBlink
      ? (isLeft ? '[- -]' : isRight ? '[- -]' : '[- -]')
      : (isLeft ? '[o ·]' : isRight ? '[· o]' : '[o o]');
    const beak = isLeft ? '<' : isRight ? '>' : 'v';
    const tufts = isLeft ? '  /\\   /| ' : isRight ? ' |\\   /\\  ' : ' /\\   /\\  ';

    const owlSprite = [
      tufts,
      ` ${eyes}  `,
      `  \\ ${beak} /  `,
      '  /)_(\\  ',
      '  /"""\\  ',
      '~~═════~' // Perched dead branch
    ];

    for (let r = 0; r < owlSprite.length; r++) {
      if (owlRow + r < this.rows) {
        const line = owlSprite[r];
        for (let c = 0; c < line.length; c++) {
          if (owlCol + c < this.cols && line[c] !== ' ') {
            grid[owlRow + r][owlCol + c] = line[c];
          }
        }
      }
    }

    // 4. Jack-o'-Lanterns along the bottom ground with candle flicker
    const groundY = isPortrait ? (this.rows - 3) : Math.min(this.rows - 4, Math.floor(this.rows * 0.88));
    const pumpkinCols = isPortrait 
      ? [Math.floor(this.cols * 0.22), Math.floor(this.cols * 0.78)]
      : [Math.floor(this.cols * 0.12), Math.floor(this.cols * 0.88)];

    const grin = Math.sin(t * 2.1) > 0 ? '\\_/' : 'v-v';
    const pumpkin = [
      '  _/_  ',
      ' /o.o\\ ',
      `( ${grin} )`,
      ' `===\' ',
    ];

    for (const pCol of pumpkinCols) {
      for (let r = 0; r < pumpkin.length; r++) {
        if (groundY + r < this.rows) {
          for (let c = 0; c < pumpkin[r].length; c++) {
            if (pCol + c < this.cols && pumpkin[r][c] !== ' ') {
              grid[groundY + r][pCol + c] = pumpkin[r][c];
            }
          }
        }
      }
    }

    // Bats in flight across open space (wing flap cycle)
    const batX = Math.floor(((t * 12) % this.cols + this.cols) % this.cols);
    const batY = Math.floor(Math.sin(t * 0.8) * 3 + this.rows * 0.28);
    const wingPose = Math.floor((t * 6) % 3);
    const batChars = wingPose === 0 ? ['/', '^', '\\'] : wingPose === 1 ? ['^', 'v', '^'] : ['-', 'o', '-'];
    if (batY >= 0 && batY < this.rows && batX + 3 < this.cols) {
      grid[batY][batX] = batChars[0];
      grid[batY][batX + 1] = batChars[1];
      grid[batY][batX + 2] = batChars[2];
    }
  }

  /* ------------------------------------------------------------- */
  /* SCENE 4: WINTER / CHRISTMAS (Dense Snowstorm & Fences)        */
  /* ------------------------------------------------------------- */
  private drawWinterScene(grid: string[][], t: number, isPortrait: boolean): void {
    // 1. Snow clouds in the upper sky (below toolbar on mobile)
    const cloudRow = isPortrait ? 4 : 1;
    for (let c = 4; c < this.cols - 12; c += 22) {
      const cloud = '.( ___ ).';
      for (let i = 0; i < cloud.length; i++) {
        if (c + i < this.cols && cloudRow < this.rows) grid[cloudRow][c + i] = cloud[i];
      }
    }

    const ground = isPortrait ? (this.rows - 1) : Math.min(this.rows - 2, Math.floor(this.rows * 0.92));

    // 2. Three-Tier Parallax Snowfall (from snowfall.ts)
    // Layer 1: Fine distant micro-snow (40 flakes)
    const farCount = Math.min(42, Math.floor(this.cols * 0.5));
    for (let i = 0; i < farCount; i++) {
      const seed = i * 29.7;
      const v = 0.9;
      const wind = 0.4 * Math.sin(t * 0.6 + seed);
      const r = Math.floor((seed * 1.7 + t * v * 5) % ground);
      const c = Math.floor(((seed * 3.1 + wind) % this.cols + this.cols) % this.cols);
      if (r >= 0 && r < ground && c >= 0 && c < this.cols && grid[r][c] === ' ') {
        grid[r][c] = '.';
      }
    }

    // Layer 2: Midfield flakes with steady drift (30 flakes)
    const midCount = Math.min(32, Math.floor(this.cols * 0.4));
    for (let i = 0; i < midCount; i++) {
      const seed = i * 47.3;
      const v = 1.7;
      const sway = 1.1 * Math.sin(t * 1.1 + seed);
      const r = Math.floor((seed * 2.3 + t * v * 5) % ground);
      const c = Math.floor(((seed * 2.7 + sway) % this.cols + this.cols) % this.cols);
      if (r >= 0 && r < ground && c >= 0 && c < this.cols && grid[r][c] === ' ') {
        grid[r][c] = (i % 2 === 0) ? '+' : '·';
      }
    }

    // Layer 3: Foreground fluffy snow crystals (15 large flakes)
    const nearCount = Math.min(18, Math.floor(this.cols * 0.25));
    for (let i = 0; i < nearCount; i++) {
      const seed = i * 71.9;
      const v = 2.6;
      const sway = 2.2 * Math.sin(t * 1.5 + seed);
      const r = Math.floor((seed * 1.1 + t * v * 6) % ground);
      const c = Math.floor(((seed * 3.9 + sway) % this.cols + this.cols) % this.cols);
      if (r >= 0 && r < ground && c >= 0 && c < this.cols) {
        grid[r][c] = (i % 3 === 0) ? '❅' : '*';
      }
    }

    // 3. Wooden fence with snow caps and rail drifts (from snowfall.ts)
    const fenceRow = ground - 2;
    if (fenceRow >= 0 && fenceRow < this.rows) {
      for (let c = 0; c < this.cols; c++) {
        if (c % 8 === 0) {
          // Post with accumulated snow cap
          if (fenceRow - 1 >= 0) grid[fenceRow - 1][c] = '▁';
          grid[fenceRow][c] = '|';
          if (fenceRow + 1 < this.rows) grid[fenceRow + 1][c] = '|';
        } else {
          // Top rail with snow ridge
          if (fenceRow - 1 >= 0 && c % 2 === 0) grid[fenceRow - 1][c] = '▔';
          grid[fenceRow][c] = '─';
        }
      }
    }

    // 4. Little snowman in open bottom area with blowing scarf
    const snowmanCol = Math.max(2, Math.floor(this.cols * (isPortrait ? 0.75 : 0.85)));
    const snowmanRow = fenceRow - 3;
    if (snowmanRow >= 0 && snowmanRow + 3 < this.rows && snowmanCol + 7 < this.cols) {
      const scarf = Math.sin(t * 1.8) > 0 ? '~-' : '~~';
      const snowman = [
        ' _[===]_ ',
        `  ('.') ${scarf}`,
        '  ( : )  ',
        ' (  :  ) ',
      ];
      for (let r = 0; r < snowman.length; r++) {
        for (let c = 0; c < snowman[r].length; c++) {
          if (snowman[r][c] !== ' ') {
            grid[snowmanRow + r][snowmanCol + c] = snowman[r][c];
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------- */
  /* SCENE 5: ISSUE X (Corrupted CRT Television Static & Glitch)   */
  /* ------------------------------------------------------------- */
  private drawStaticScene(grid: string[][], t: number): void {
    // 1. CRT Curved Frame on widescreen desktop displays
    if (this.cols >= 60 && this.rows >= 16) {
      const topY = 1;
      const botY = this.rows - 2;
      const leftX = 2;
      const rightX = this.cols - 3;
      
      grid[topY][leftX] = '╭';
      grid[topY][rightX] = '╮';
      grid[botY][leftX] = '╰';
      grid[botY][rightX] = '╯';
      for (let c = leftX + 1; c < rightX; c++) {
        grid[topY][c] = '─';
        grid[botY][c] = '─';
      }
      for (let r = topY + 1; r < botY; r++) {
        grid[r][leftX] = '│';
        grid[r][rightX] = '│';
      }
    }

    // 2. Rolling Horizontal Hum Bar and Static Snow (from tv-static.ts)
    const chars = ' .:+░▒▓█#X%§Ӝ';
    const humY = Math.floor((t * 7) % this.rows);

    for (let r = 0; r < this.rows; r++) {
      const distToHum = Math.abs(r - humY);
      const isHumBar = distToHum <= 2;
      const density = isHumBar ? 0.55 : 0.12;

      for (let c = 0; c < this.cols; c += 2) {
        const n = Math.sin(r * 12.9898 + c * 78.233 + t * 50);
        if (Math.abs(n) > 1 - density) {
          const chIdx = isHumBar
            ? Math.floor(Math.abs(n) * 6 + 6) % chars.length
            : Math.floor(Math.abs(n) * chars.length) % chars.length;
          grid[r][c] = chars[chIdx];
        }
      }
    }

    // 3. Corrupted lore mantras with glitch spill
    const glitches = [
      '403 FORBIDDEN',
      'WAKE UP',
      'CORRUPTED',
      '{THIS BOOK SHOULD NOT EXIST}',
      'ɨȶ',
      'BEWARE THE SHADOWS',
      'DEATHCAP VOID',
    ];
    const glitchIdx = Math.floor(t * 0.7) % glitches.length;
    const gText = glitches[glitchIdx];
    const gRow = Math.floor(((t * 2.5) % (this.rows - 6)) + 3);
    const gCol = Math.floor(((t * 5.3) % Math.max(1, this.cols - gText.length)));

    if (Math.sin(t * 2.2) > 0.35 && gRow < this.rows) {
      for (let i = 0; i < gText.length; i++) {
        if (gCol + i < this.cols) grid[gRow][gCol + i] = gText[i];
      }
      // Runic glitch echo
      const runes = 'ᚦᛟ§k';
      for (let i = 0; i < 4; i++) {
        const rc = gCol - 2 + i * 2;
        if (rc >= 0 && rc < this.cols && gRow + 1 < this.rows) {
          grid[gRow + 1][rc] = runes[i % runes.length];
        }
      }
    }
  }

  /* ------------------------------------------------------------- */
  /* SCENE 6: INTRO (Celestial Moon Phases & Nebula Starlight)     */
  /* ------------------------------------------------------------- */
  private drawCelestialScene(grid: string[][], t: number, isPortrait: boolean): void {
    // 1. Detailed Moon with Lunar Maria and Phase Sweep (from moon-phases.ts)
    const moonCol = Math.max(4, Math.floor(this.cols * (isPortrait ? 0.5 : 0.78)) - 5);
    const moonRow = isPortrait ? 4 : Math.max(1, Math.floor(this.rows * 0.08));

    // Phase cycle: 0 = new crescent, 1 = half moon, 2 = full moon with maria, 3 = gibbous
    const phaseStep = Math.floor((t * 0.15) % 4);
    let moonSprite: string[];

    if (phaseStep === 0) {
      // Waxing crescent
      moonSprite = [
        '    .---.    ',
        '   / .-\' \\   ',
        '  | /     |  ',
        '  | |     |  ',
        '  | \\     |  ',
        '   \\ `-. /   ',
        '    `---\'    ',
      ];
    } else if (phaseStep === 1) {
      // First quarter (half moon)
      moonSprite = [
        '    .---.    ',
        '   / |   \\   ',
        '  |  |    |  ',
        '  |  |    |  ',
        '  |  |    |  ',
        '   \\ |   /   ',
        '    `---\'    ',
      ];
    } else if (phaseStep === 2) {
      // Full moon with lunar maria (Oceanus Procellarum, Imbrium)
      moonSprite = [
        '    .---.    ',
        '   / ··. \\   ',
        '  | ::::  |  ',
        '  | (··)  |  ',
        '  | .---. |  ',
        '   \\ \'` /   ',
        '    `---\'    ',
      ];
    } else {
      // Waning gibbous with Tycho rays
      moonSprite = [
        '    .---.    ',
        '   /   . \\   ',
        '  |  .::: |  ',
        '  |  (··) |  ',
        '  |   ::: |  ',
        '   \\   \' /   ',
        '    `---\'    ',
      ];
    }

    for (let r = 0; r < moonSprite.length; r++) {
      if (moonRow + r < this.rows) {
        for (let c = 0; c < moonSprite[r].length; c++) {
          if (moonCol + c < this.cols && moonSprite[r][c] !== ' ') {
            grid[moonRow + r][moonCol + c] = moonSprite[r][c];
          }
        }
      }
    }

    // 2. Constellation stars with multi-magnitude twinkle
    const starCount = Math.min(60, Math.floor(this.cols * 0.8));
    const minStarRow = isPortrait ? 4 : 1;
    for (let i = 0; i < starCount; i++) {
      const seed = i * 79.3;
      const c = Math.floor(seed % this.cols);
      const r = minStarRow + Math.floor((seed * 0.45) % Math.max(1, this.rows - minStarRow));
      const pulse = Math.sin(t * 1.3 + seed);

      if (r < this.rows && c < this.cols && pulse > 0.35 && grid[r][c] === ' ') {
        const glyph = pulse > 0.88 ? '✦' : pulse > 0.65 ? '*' : (i % 2 === 0) ? '+' : '·';
        grid[r][c] = glyph;
      }
    }

    // Occasional shooting star streak across the upper firmament
    const shootingStarT = (t * 0.5) % 8;
    if (shootingStarT < 1.2) {
      const sx = Math.floor((shootingStarT / 1.2) * (this.cols * 0.6) + 4);
      const sy = Math.floor(minStarRow + (shootingStarT / 1.2) * 4);
      if (sy < this.rows && sx + 3 < this.cols) {
        grid[sy][sx] = '━';
        grid[sy][sx + 1] = '━';
        grid[sy][sx + 2] = '✦';
      }
    }

    // 3. Ancient Astrolabe / Planetary Alignment at bottom (further down on mobile)
    const astrolabeRow = isPortrait ? (this.rows - 2) : Math.min(this.rows - 3, Math.floor(this.rows * 0.9));
    if (astrolabeRow < this.rows) {
      const ring = '---( ( ( ⏼ ) ) )---';
      const startC = Math.max(2, Math.floor((this.cols - ring.length) / 2));
      for (let i = 0; i < ring.length; i++) {
        if (startC + i < this.cols) grid[astrolabeRow][startC + i] = ring[i];
      }
    }
  }
}
