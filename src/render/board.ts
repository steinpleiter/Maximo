import { Container, Graphics, NineSliceSprite, Text } from 'pixi.js';
import { CELL_SIZE, textureFor } from './assets';
import { GEM_TINTS, SymbolView, texturedSprite } from './symbols';
import { delay, easeInCubic, easeOutBack, easeOutCubic, lerp, linear, tween } from './tween';
import type { Cell, CellSnapshot, GemColor, Pos } from '../math/types';

const GAP = CELL_SIZE * 0.06;

/**
 * Margin between the outer cells and the edge of the board.
 *
 * It has to clear the track frame's thickness (see FRAME_SCALE), or the rails
 * would sit on top of the first row and column.
 */
const PAD = CELL_SIZE * 0.46;

/**
 * Texture pixels to board pixels for the frame art.
 *
 * The frame is nine-sliced so the corners keep their curve while the straight
 * runs stretch. Corners render at native size, so the whole thing is drawn
 * oversized and scaled down by this factor to land at a sane track thickness.
 */
const FRAME_SCALE = 0.27;
const FRAME_CORNER = 330;

/**
 * The playfield: a pool of symbol views keyed by the engine's cell ids, plus
 * the small set of visual primitives the animators compose — drop, move, pop,
 * flash, shot lines and blast rings.
 *
 * Views are addressed by cell id rather than by position, which is what lets a
 * symbol be followed through a cascade instead of being torn down and rebuilt.
 */
export class Board extends Container {
  cols = 6;
  rows = 7;

  private readonly bgLayer = new Container();
  private readonly cellLayer = new Container();
  private readonly symbolLayer = new Container();
  /** Gems and specials, inside the symbol layer. */
  private readonly itemLayer = new Container();
  /**
   * Birds and the bandit ride above everything else, so a collector that is
   * scaled up or walking through a cell is never drawn underneath a gem.
   */
  private readonly collectorLayer = new Container();
  private readonly fxLayer = new Container();
  /** The track frame sits above the symbols, so they ride behind the rails. */
  private readonly frameLayer = new Container();

  private readonly views = new Map<number, SymbolView>();
  /** Logical cell each view occupies, so a position can be resolved to an id. */
  private readonly where = new Map<number, Pos>();
  private gemLevels: Record<GemColor, number> = { blue: 1, green: 1, purple: 1, red: 1 };
  private trainCells: Pos[] = [];
  /** Collectors currently lifted for a duel stand-off. */
  private readonly highlighted = new Set<number>();

  constructor() {
    super();
    this.symbolLayer.addChild(this.itemLayer, this.collectorLayer);
    this.addChild(this.bgLayer, this.cellLayer, this.symbolLayer, this.fxLayer, this.frameLayer);
  }

  // --- geometry ------------------------------------------------------------

  get boardWidth(): number {
    return this.cols * CELL_SIZE + (this.cols - 1) * GAP + PAD * 2;
  }

  get boardHeight(): number {
    return this.rows * CELL_SIZE + (this.rows - 1) * GAP + PAD * 2;
  }

  cellToPoint(r: number, c: number): { x: number; y: number } {
    return {
      x: PAD + c * (CELL_SIZE + GAP) + CELL_SIZE / 2,
      y: PAD + r * (CELL_SIZE + GAP) + CELL_SIZE / 2,
    };
  }

  /** Rebuilds the backdrop for a (possibly new) grid size. */
  resize(cols: number, rows: number, trainCells: Pos[] = this.trainCells): void {
    this.cols = cols;
    this.rows = rows;
    this.trainCells = trainCells;
    this.drawBackdrop();
  }

  private drawBackdrop(): void {
    this.bgLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.cellLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.frameLayer.removeChildren().forEach((child) => child.destroy({ children: true }));

    // A translucent panel so symbols stay readable over the painted backdrop.
    const panel = new Graphics();
    panel.roundRect(PAD * 0.45, PAD * 0.45, this.boardWidth - PAD * 0.9, this.boardHeight - PAD * 0.9, PAD * 0.7);
    panel.fill({ color: 0x120d1c, alpha: 0.82 });
    this.bgLayer.addChild(panel);

    const frameTexture = textureFor('board.frame');
    if (frameTexture) {
      const holder = new Container();
      const frame = new NineSliceSprite({
        texture: frameTexture,
        leftWidth: FRAME_CORNER,
        topHeight: FRAME_CORNER,
        rightWidth: FRAME_CORNER,
        bottomHeight: FRAME_CORNER,
      });
      frame.width = this.boardWidth / FRAME_SCALE;
      frame.height = this.boardHeight / FRAME_SCALE;
      holder.addChild(frame);
      holder.scale.set(FRAME_SCALE);
      this.frameLayer.addChild(holder);
    } else {
      const frame = new Graphics();
      frame.roundRect(0, 0, this.boardWidth, this.boardHeight, PAD * 0.8);
      frame.stroke({ width: 2, color: 0x3d2f25 });
      this.bgLayer.addChild(frame);
    }

    const isTrain = (r: number, c: number) =>
      this.trainCells.some((t) => t.r === r && t.c === c);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const { x, y } = this.cellToPoint(r, c);
        const cell = new Graphics();
        cell.roundRect(
          x - CELL_SIZE / 2,
          y - CELL_SIZE / 2,
          CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE * 0.16,
        );

        if (isTrain(r, c)) {
          // The train backdrop has to be obvious — robbing both edges is how
          // the heist triggers, so the player needs to see the targets.
          cell.fill({ color: 0x5a3f12, alpha: 0.78 });
          cell.stroke({ width: 2, color: 0xe9a33a, alpha: 0.9 });
        } else {
          cell.fill({ color: 0x0d0a14, alpha: 0.3 });
          cell.stroke({ width: 1, color: 0xffffff, alpha: 0.07 });
        }

        this.cellLayer.addChild(cell);
      }
    }
  }

  // --- symbol bookkeeping --------------------------------------------------

  setLevels(levels: Record<GemColor, number>): void {
    this.gemLevels = { ...levels };
  }

  view(cellId: number): SymbolView | undefined {
    return this.views.get(cellId);
  }

  allViews(): Iterable<SymbolView> {
    return this.views.values();
  }

  get levels(): Record<GemColor, number> {
    return this.gemLevels;
  }

  /** The id of whatever currently occupies a cell, or -1. */
  idAt(r: number, c: number): number {
    for (const [id, pos] of this.where) {
      if (pos.r === r && pos.c === c) return id;
    }
    return -1;
  }

  /** Replaces the whole board contents at once, with no animation. */
  sync(cells: CellSnapshot[], levels: Record<GemColor, number>): void {
    this.setLevels(levels);
    for (const view of this.views.values()) view.destroy({ children: true });
    this.views.clear();
    this.where.clear();
    this.highlighted.clear();
    this.itemLayer.removeChildren();
    this.collectorLayer.removeChildren();

    for (const { r, c, cell } of cells) {
      if (cell) this.place(r, c, cell);
    }
  }

  place(r: number, c: number, cell: Cell): SymbolView {
    const view = new SymbolView(cell, this.gemLevels);
    const { x, y } = this.cellToPoint(r, c);
    view.position.set(x, y);
    this.views.set(cell.id, view);
    this.where.set(cell.id, { r, c });
    const isCollector = cell.kind === 'bird' || cell.kind === 'bandit';
    (isCollector ? this.collectorLayer : this.itemLayer).addChild(view);
    return view;
  }

  remove(cellId: number): void {
    const view = this.views.get(cellId);
    if (!view) return;
    this.views.delete(cellId);
    this.where.delete(cellId);
    this.highlighted.delete(cellId);
    view.destroy({ children: true });
  }

  /** The view of the loose bandit, if one is on the board. */
  banditId(): number {
    for (const view of this.views.values()) {
      if (view.kind === 'bandit') return view.cellId;
    }
    return -1;
  }

  /**
   * Snaps the board to the engine's grid.
   *
   * The animators follow the event tape, and any event they misread would
   * otherwise leave a stale view behind for the next refill to land on top
   * of. Run after each batch, this guarantees one view per cell: missing
   * views are placed, strays are dropped, and anything out of place or still
   * mid-tween is put back at rest.
   */
  reconcile(cells: CellSnapshot[], levels: Record<GemColor, number>): void {
    this.setLevels(levels);
    const live = new Set<number>();

    for (const { r, c, cell } of cells) {
      if (!cell) continue;
      live.add(cell.id);

      const view = this.views.get(cell.id);
      if (!view) {
        this.place(r, c, cell);
        continue;
      }

      view.render(cell, this.gemLevels);
      const { x, y } = this.cellToPoint(r, c);
      view.position.set(x, y);
      view.alpha = 1;
      if (!this.highlighted.has(cell.id)) view.scale.set(1);
      this.where.set(cell.id, { r, c });
    }

    for (const id of [...this.views.keys()]) {
      if (!live.has(id)) this.remove(id);
    }
  }

  /**
   * Re-skins the gems of one colour after that colour is upgraded.
   *
   * Only views already holding that colour are touched — re-rendering every
   * gem would repaint the whole board in the upgraded colour.
   */
  refreshGems(color: GemColor, levels: Record<GemColor, number>): SymbolView[] {
    this.setLevels(levels);
    const touched: SymbolView[] = [];
    for (const view of this.views.values()) {
      if (view.kind !== 'gem' || view.color !== color) continue;
      const before = view.artKey;
      view.render({ id: view.cellId, kind: 'gem', color }, this.gemLevels);
      if (view.artKey !== before) touched.push(view);
    }
    return touched;
  }

  /** A decorative board to look at before the first spin. */
  idle(cells: CellSnapshot[], levels: Record<GemColor, number>): void {
    this.sync(cells, levels);
    this.symbolLayer.alpha = 0.55;
  }

  /** Restores full opacity after an idle board. */
  wake(): void {
    this.symbolLayer.alpha = 1;
  }

  /** Re-skins a single cell in place (used by transform). */
  reskin(cell: Cell): SymbolView | undefined {
    const view = this.views.get(cell.id);
    view?.render(cell, this.gemLevels);
    return view;
  }

  // --- primitives ----------------------------------------------------------

  /** The supplied sparkle blooms at a pickup, with a short spray of facets. */
  async collectSparkle(pos: Pos, color = 0xffd268, ms = 350): Promise<void> {
    const point = this.cellToPoint(pos.r, pos.c);
    const effect = new Container();
    effect.position.set(point.x, point.y);
    this.fxLayer.addChild(effect);
    const texture = textureFor('effect.collect');
    const flare = texture ? texturedSprite('effect.collect', texture, CELL_SIZE * 1.4) : null;
    if (flare) { flare.tint = color; effect.addChild(flare); }
    const particles = new Graphics();
    effect.addChild(particles);
    await tween(ms, (t) => {
      particles.clear();
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI * 2 / 10;
        const distance = CELL_SIZE * (0.12 + t * (0.5 + (i % 3) * 0.12));
        const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance;
        const radius = (1 - t) * (i % 2 ? 4 : 6);
        particles.poly([x, y - radius, x + radius, y, x, y + radius, x - radius, y]).fill({ color });
      }
      if (flare) { flare.alpha = Math.sin(t * Math.PI); flare.rotation = t * 0.45; }
      effect.alpha = 1 - t * 0.7;
    }, linear);
    effect.destroy({ children: true });
  }

  /** Exact engine multiplier, floating up independently of the persistent HUD. */
  async floatingPayout(pos: Pos, value: number, color = 0xffdd77): Promise<void> {
    if (value <= 0) return;
    const { x, y } = this.cellToPoint(pos.r, pos.c);
    const text = new Text({
      text: `+${value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}×`,
      style: { fontFamily: 'Georgia, serif', fontSize: CELL_SIZE * 0.28, fontWeight: 'bold', fill: color,
        stroke: { color: 0x251208, width: 4 }, dropShadow: { color: 0x000000, blur: 5, distance: 2 } },
    });
    text.anchor.set(0.5);
    this.fxLayer.addChild(text);
    await tween(650, (t) => {
      text.position.set(x, y - CELL_SIZE * (0.15 + t * 0.75));
      text.scale.set(1 + Math.sin(Math.min(1, t * 3) * Math.PI) * 0.18);
      text.alpha = Math.min(1, (1 - t) * 4);
    }, linear);
    text.destroy();
  }

  /** A fuse flash, hot centre, fire petals and flying embers for dynamite. */
  async dynamiteBlast(pos: Pos): Promise<void> {
    const { x, y } = this.cellToPoint(pos.r, pos.c);
    const effect = new Container();
    effect.position.set(x, y);
    this.fxLayer.addChild(effect);
    const fire = new Graphics();
    effect.addChild(fire);
    const texture = textureFor('special.bigDynamite');
    const bundle = texture ? texturedSprite('special.bigDynamite', texture, CELL_SIZE) : null;
    if (bundle) effect.addChild(bundle);
    await tween(170, (t) => {
      effect.scale.set(1 + t * 0.3);
      effect.rotation = Math.sin(t * Math.PI * 6) * 0.07;
    }, linear);
    bundle?.destroy();
    effect.rotation = 0;
    await Promise.all([this.shake(340), tween(480, (t) => {
      fire.clear();
      const radius = CELL_SIZE * (0.1 + t * 1.5);
      for (let i = 0; i < 9; i++) {
        const angle = i * Math.PI * 2 / 9;
        fire.circle(Math.cos(angle) * radius * 0.6, Math.sin(angle) * radius * 0.6, radius * 0.42)
          .fill({ color: i % 2 ? 0xff8628 : 0xffc64b, alpha: (1 - t) * 0.8 });
      }
      fire.circle(0, 0, radius * 0.55).fill({ color: 0xfff3bc, alpha: 1 - t });
      for (let i = 0; i < 18; i++) {
        const angle = i * Math.PI * 2 / 18;
        const distance = radius * (1 + (i % 4) * 0.12);
        fire.circle(Math.cos(angle) * distance, Math.sin(angle) * distance + t * t * 30, (1 - t) * 5)
          .fill({ color: 0xffd373, alpha: 1 - t });
      }
    }, linear)]);
    effect.destroy({ children: true });
  }

  /** A sealed bag flips into the actual denomination or illustrated scorpion. */
  async coinPick(pos: Pos, kind: 'coin' | 'scorpion', value: number): Promise<void> {
    const { x, y } = this.cellToPoint(pos.r, pos.c);
    const holder = new Container();
    holder.position.set(x, y);
    this.fxLayer.addChild(holder);
    const bagTexture = textureFor('coinGame.bag');
    const bag = bagTexture ? texturedSprite('coinGame.bag', bagTexture, CELL_SIZE * 0.88) : new Graphics();
    holder.addChild(bag);
    await tween(150, (t) => { holder.scale.set(1 + Math.sin(t * Math.PI) * 0.22); holder.rotation = Math.sin(t * Math.PI * 4) * 0.09; }, linear);
    holder.rotation = 0;
    await tween(100, (t) => holder.scale.x = 1 - t, linear);
    bag.destroy();
    if (kind === 'coin') holder.addChild(new SymbolView({ id: -1, kind: 'coin', coinValue: value }, this.gemLevels));
    else {
      const scorpion = textureFor('coinGame.scorpion');
      if (scorpion) holder.addChild(texturedSprite('coinGame.scorpion', scorpion, CELL_SIZE * 0.94));
    }
    await tween(150, (t) => holder.scale.set(t, 1 + Math.sin(t * Math.PI) * 0.18), easeOutBack);
    await Promise.all([this.collectSparkle(pos, kind === 'coin' ? 0xffd76c : 0xe47451), kind === 'coin' ? this.floatingPayout(pos, value) : this.shake(180)]);
    await delay(100);
    await tween(160, (t) => { holder.alpha = 1 - t; holder.position.y = y - t * 12; });
    holder.destroy({ children: true });
  }

  /** Features fall out of the meter in golden arcs toward their board cells. */
  async meterBurst(cells: CellSnapshot[]): Promise<void> {
    const effect = new Graphics();
    this.fxLayer.addChild(effect);
    const origin = { x: this.boardWidth / 2, y: -CELL_SIZE * 0.2 };
    await tween(420, (t) => {
      effect.clear();
      for (const { r, c } of cells) {
        const target = this.cellToPoint(r, c);
        for (let trail = 0; trail < 5; trail++) {
          const progress = Math.max(0, t - trail * 0.035);
          const x = lerp(origin.x, target.x, progress);
          const y = lerp(origin.y, target.y, progress) - Math.sin(progress * Math.PI) * CELL_SIZE;
          effect.circle(x, y, 6 - trail).fill({ color: 0xffd26b, alpha: (1 - trail / 5) * Math.min(1, (1 - t) * 6) });
        }
      }
    }, linear);
    effect.destroy();
    await Promise.all(cells.map((cell) => this.collectSparkle(cell)));
  }

  /** Drops a symbol in from above its final cell. */
  async dropIn(r: number, c: number, cell: Cell, distance = 3): Promise<void> {
    const view = this.place(r, c, cell);
    const { x, y } = this.cellToPoint(r, c);
    const from = y - distance * (CELL_SIZE + GAP);
    view.position.set(x, from);
    view.alpha = 0;

    await tween(220, (t) => {
      view.position.y = lerp(from, y, t);
      view.alpha = Math.min(1, t * 2);
    });
    view.position.set(x, y);
  }

  /** Slides an existing symbol to a new cell. */
  async moveTo(cellId: number, r: number, c: number, ms = 200): Promise<void> {
    const view = this.views.get(cellId);
    if (!view) return;
    // Claim the destination up front so a batch of simultaneous moves cannot
    // resolve two symbols to the same cell mid-flight.
    this.where.set(cellId, { r, c });
    const { x, y } = this.cellToPoint(r, c);
    const sx = view.position.x;
    const sy = view.position.y;

    await tween(ms, (t) => {
      view.position.set(lerp(sx, x, t), lerp(sy, y, t));
    });
    view.position.set(x, y);
  }

  /** Pops a symbol out of existence. */
  async pop(cellId: number, ms = 180): Promise<void> {
    const view = this.views.get(cellId);
    if (!view) return;
    this.views.delete(cellId);
    this.where.delete(cellId);

    await tween(
      ms,
      (t) => {
        view.scale.set(1 + t * 0.35);
        view.alpha = 1 - t;
      },
      easeOutCubic,
    );
    view.destroy({ children: true });
  }

  /** A quick emphasis pulse, for upgrades and transforms. */
  async pulse(cellId: number, ms = 220): Promise<void> {
    const view = this.views.get(cellId);
    if (!view) return;
    await tween(
      ms,
      (t) => {
        const s = 1 + Math.sin(t * Math.PI) * 0.22;
        view.scale.set(s);
      },
      easeOutCubic,
    );
    view.scale.set(1);
  }

  /** Lifts a collector slightly, so a duel stand-off reads before the quiz. */
  async highlight(cellId: number, on: boolean): Promise<void> {
    const view = this.views.get(cellId);
    if (!view) return;
    if (on) this.highlighted.add(cellId);
    else this.highlighted.delete(cellId);
    const target = on ? 1.18 : 1;
    const start = view.scale.x;
    await tween(140, (t) => view.scale.set(lerp(start, target, t)), easeOutBack);
  }

  /** Settles every lifted collector back to its normal size. */
  async clearHighlights(): Promise<void> {
    await Promise.all([...this.highlighted].map((id) => this.highlight(id, false)));
  }

  /** A ring marking a cell — used for the duel stand-off and blasts. */
  async ring(r: number, c: number, color: number, maxRadius = CELL_SIZE * 1.6): Promise<void> {
    const { x, y } = this.cellToPoint(r, c);
    const g = new Graphics();
    this.fxLayer.addChild(g);

    await tween(
      380,
      (t) => {
        g.clear();
        g.circle(x, y, lerp(CELL_SIZE * 0.3, maxRadius, t));
        g.stroke({ width: lerp(5, 1, t), color, alpha: 1 - t });
      },
      easeOutCubic,
    );
    g.destroy();
  }

  /** Draws a shot travelling out from a cell along a direction. */
  async shot(from: Pos, cells: Pos[], color: number): Promise<void> {
    if (cells.length === 0) return;
    const start = this.cellToPoint(from.r, from.c);
    const last = cells[cells.length - 1];
    const end = this.cellToPoint(last.r, last.c);

    const g = new Graphics();
    this.fxLayer.addChild(g);

    await tween(
      170,
      (t) => {
        const hx = lerp(start.x, end.x, t);
        const hy = lerp(start.y, end.y, t);
        g.clear();
        g.moveTo(start.x, start.y);
        g.lineTo(hx, hy);
        g.stroke({ width: 4, color, alpha: 0.9 });
        g.circle(hx, hy, 7);
        g.fill({ color, alpha: 0.95 });
      },
      easeOutCubic,
    );

    await tween(
      140,
      (t) => {
        g.alpha = 1 - t;
      },
      easeInCubic,
    );
    g.destroy();
  }

  /** A locomotive follows the board rails, trailing steam and a gold carriage. */
  async trainSweep(): Promise<void> {
    const layer = new Container();
    this.frameLayer.addChild(layer);
    const steam = new Graphics();
    const locomotive = new Container();
    const body = new Graphics();
    body.roundRect(-39, -19, 38, 38, 4).fill({ color: 0x563b25 }).stroke({ width: 3, color: 0xe2ad50 });
    body.roundRect(-5, -15, 40, 30, 8).fill({ color: 0x383d43 }).stroke({ width: 3, color: 0xad9672 });
    body.rect(-29, -12, 17, 23).fill({ color: 0xffd77d });
    body.rect(12, -23, 13, 46).fill({ color: 0x202731 }).stroke({ width: 2, color: 0xbd9960 });
    body.poly([35, -22, 47, 0, 35, 22]).fill({ color: 0xb35d32 }).stroke({ width: 2, color: 0xf0bd6a });
    body.circle(32, 0, 7).fill({ color: 0xffefb0 });
    // The carriage carries visible coins, instead of an unlabelled block.
    body.roundRect(-100, -18, 49, 36, 3).fill({ color: 0x75502c }).stroke({ width: 3, color: 0xe4af52 });
    for (let i = 0; i < 5; i++) body.circle(-88 + (i % 3) * 12, -6 + Math.floor(i / 3) * 14, 7).fill({ color: 0xf7c34b }).stroke({ width: 1, color: 0xffe593 });
    body.moveTo(-51, 0).lineTo(-40, 0).stroke({ width: 4, color: 0xd5b67c });
    const wheels = new Graphics();
    locomotive.addChild(body, wheels);
    layer.addChild(steam, locomotive);
    const inset = PAD * 0.4;
    const width = this.boardWidth - inset * 2, height = this.boardHeight - inset * 2;
    const perimeter = (width + height) * 2;
    const along = (progress: number) => {
      let distance = ((progress % 1 + 1) % 1) * perimeter;
      if (distance < width) return { x: inset + distance, y: inset, angle: 0 };
      distance -= width;
      if (distance < height) return { x: inset + width, y: inset + distance, angle: Math.PI / 2 };
      distance -= height;
      if (distance < width) return { x: inset + width - distance, y: inset + height, angle: Math.PI };
      return { x: inset, y: inset + height - (distance - width), angle: -Math.PI / 2 };
    };
    await tween(1500, (t) => {
      const head = along(t);
      locomotive.position.set(head.x, head.y);
      locomotive.rotation = head.angle;
      wheels.clear();
      for (const x of [-88, -62, -28, 4, 26]) for (const y of [-21, 21]) {
        wheels.circle(x, y, 6).fill({ color: 0x22232b }).stroke({ color: 0xd8b268, width: 2 });
        wheels.moveTo(x, y).lineTo(x + Math.cos(t * 80) * 5, y + Math.sin(t * 80) * 5).stroke({ color: 0xf9d68b, width: 1 });
      }
      steam.clear();
      for (let i = 1; i <= 7; i++) {
        const point = along(t - i * 0.009);
        steam.circle(point.x, point.y - i * 3, 4 + i * 2).fill({ color: 0xe8dcc9, alpha: (1 - i / 8) * 0.35 });
      }
      layer.alpha = Math.min(1, t * 12, (1 - t) * 12);
    }, linear);
    layer.destroy({ children: true });
  }

  /** Dims the board while a quiz is up. */
  async dim(on: boolean): Promise<void> {
    const target = on ? 0.35 : 1;
    const start = this.symbolLayer.alpha;
    await tween(160, (t) => {
      const a = lerp(start, target, t);
      this.symbolLayer.alpha = a;
      this.cellLayer.alpha = lerp(this.cellLayer.alpha, on ? 0.5 : 1, t);
    });
    this.symbolLayer.alpha = target;
    this.cellLayer.alpha = on ? 0.5 : 1;
  }

  /** A short shake, for a lost duel. */
  async shake(ms = 260): Promise<void> {
    const baseX = this.symbolLayer.position.x;
    await tween(ms, (t) => {
      const decay = 1 - t;
      this.symbolLayer.position.x = baseX + Math.sin(t * Math.PI * 8) * 7 * decay;
    });
    this.symbolLayer.position.x = baseX;
  }

  colorFor(color: GemColor | null): number {
    return color ? GEM_TINTS[color] : 0xe2614f;
  }
}
