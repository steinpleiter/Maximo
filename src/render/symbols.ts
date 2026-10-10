import { Container, Graphics, Sprite, Text, TextStyle, type Texture } from 'pixi.js';
import { CELL_SIZE, boundsFor, keyForCell, textureFor } from './assets';
import type { Cell, GemColor, SymbolKind } from '../math/types';

export const GEM_TINTS: Record<GemColor, number> = {
  blue: 0x4f9ce8,
  green: 0x5fc27e,
  purple: 0xb072dd,
  red: 0xe2614f,
};

const INK = 0x17110d;
const SAND = 0xe8dcc8;
const AMBER = 0xe9a33a;
const BANDIT_DARK = 0x2c2c33;

/** Short glyphs for the placeholder art — replaced wholesale by real icons. */
const SPECIAL_GLYPH: Partial<Record<SymbolKind, string>> = {
  wild: 'W',
  wildBandit: 'W',
  upgrade: '↑',
  upgradeAll: '⇈',
  coin: '$',
  dynamite: 'TNT',
  peanut: 'o',
  transform: '◈',
  key: '⚿',
  bonus: '★',
  superBonus: '✪',
};

const SPECIAL_TINT: Partial<Record<SymbolKind, number>> = {
  wild: 0xf2e4c4,
  wildBandit: BANDIT_DARK,
  upgrade: 0x7fd08a,
  upgradeAll: 0x4fb463,
  coin: AMBER,
  dynamite: 0xc8483a,
  peanut: 0xb9895a,
  transform: 0x6fc8d8,
  key: 0xd8c068,
  bonus: 0xe86fb0,
  superBonus: 0xd04fe8,
};

const labelStyle = (size: number, fill: number, bold = true) =>
  new TextStyle({
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    fontSize: size,
    fontWeight: bold ? '700' : '500',
    fill,
    align: 'center',
  });

/**
 * One symbol on the board.
 *
 * It draws a texture when the manifest supplies one for its key, and a legible
 * procedural placeholder when it does not — so the game plays and reads
 * correctly with no art at all, and swapping art in changes nothing else.
 */
export class SymbolView extends Container {
  cellId: number;
  kind: SymbolKind;
  /** Gem/bird colour, so a colour-wide re-skin can tell which views it owns. */
  color: GemColor | null = null;
  private art: Container | null = null;
  private currentKey = '';

  /** The manifest key this view is currently drawn from. */
  get artKey(): string {
    return this.currentKey;
  }

  constructor(cell: Cell, gemLevels: Record<GemColor, number>) {
    super();
    this.cellId = cell.id;
    this.kind = cell.kind;
    this.render(cell, gemLevels);
  }

  /** Rebuilds the art if the cell's appearance key has changed. */
  render(cell: Cell, gemLevels: Record<GemColor, number>): void {
    const key = keyForCell(cell, gemLevels);
    if (key === this.currentKey && this.art) return;
    this.currentKey = key;
    this.kind = cell.kind;
    this.color = cell.color ?? null;

    this.art?.destroy({ children: true });
    this.art = buildArt(cell, gemLevels, key);
    this.addChild(this.art);
  }
}

/**
 * A sprite scaled and centred on its *visible* pixels rather than its canvas.
 *
 * The pack ships padded square PNGs, so going by canvas size would make each
 * sprite a different visual weight depending on how much empty space it was
 * drawn with. The art pack measures the alpha box for exactly this reason.
 */
function texturedSprite(key: string, texture: Texture, target: number): Sprite {
  const sprite = new Sprite(texture);
  const box = boundsFor(key);

  if (box && box.w > 0 && box.h > 0) {
    sprite.anchor.set(
      (box.x + box.w / 2) / texture.width,
      (box.y + box.h / 2) / texture.height,
    );
    sprite.scale.set(target / Math.max(box.w, box.h));
  } else {
    sprite.anchor.set(0.5);
    sprite.scale.set(target / Math.max(texture.width, texture.height));
  }

  return sprite;
}

/**
 * The upgrade level, as a row of pips under the gem.
 *
 * The art pack has one gem per colour, not seven, so the level has to be shown
 * by the engine — and it has to be legible at a glance mid-cascade, because it
 * is the difference between a 0.02x gem and a 2.70x one.
 */
function levelPips(level: number, width: number, y: number): Container {
  const box = new Container();
  if (level <= 1) return box;

  const count = Math.min(level, 7);
  const spacing = width * 0.13;
  const startX = -((count - 1) * spacing) / 2;

  const backing = new Graphics();
  backing.roundRect(startX - spacing * 0.55, y - spacing * 0.42, (count - 1) * spacing + spacing * 1.1, spacing * 0.84, spacing * 0.42);
  backing.fill({ color: 0x120d0a, alpha: 0.72 });

  const pips = new Graphics();
  for (let i = 0; i < count; i++) pips.circle(startX + i * spacing, y, width * 0.036);
  pips.fill({ color: level >= 6 ? AMBER : SAND, alpha: 0.95 });

  box.addChild(backing, pips);
  return box;
}

function buildArt(cell: Cell, gemLevels: Record<GemColor, number>, key: string): Container {
  const texture = textureFor(key);

  if (texture) {
    const box = new Container();

    if (cell.kind === 'gem') {
      const level = gemLevels[cell.color as GemColor] ?? 1;
      box.addChild(texturedSprite(key, texture, S * 0.78));
      box.addChild(levelPips(level, S * 0.78, S * 0.4));
      return box;
    }

    // Characters carry the scene, so they are allowed to fill more of a cell.
    const target = cell.kind === 'bird' || cell.kind === 'bandit' ? S * 0.98 : S * 0.84;
    box.addChild(texturedSprite(key, texture, target));

    if (cell.kind === 'coin') box.addChild(coinValueBadge(cell.coinValue ?? 0));
    if (cell.kind === 'upgrade' || cell.kind === 'upgradeAll') {
      box.addChild(stepsBadge(cell.upgradeSteps ?? 1));
    }

    return box;
  }

  switch (cell.kind) {
    case 'gem':
      return gemPlaceholder(cell.color as GemColor, gemLevels[cell.color as GemColor] ?? 1);
    case 'bird':
      return birdPlaceholder(cell.color as GemColor);
    case 'bandit':
      return banditPlaceholder();
    case 'coin':
      return coinPlaceholder(cell.coinValue ?? 0);
    case 'upgrade':
      return specialPlaceholder('upgrade', `+${cell.upgradeSteps ?? 1}`);
    case 'upgradeAll':
      return specialPlaceholder('upgradeAll', `+${cell.upgradeSteps ?? 1}`);
    default:
      return specialPlaceholder(cell.kind);
  }
}

const S = CELL_SIZE;

function gemPlaceholder(color: GemColor, level: number): Container {
  const box = new Container();
  const tint = GEM_TINTS[color];
  const size = S * 0.72;

  // A cut-cornered gem shape, brighter as the level climbs.
  const lift = 0.1 + (level - 1) * 0.055;
  const g = new Graphics();
  const h = size / 2;
  const notch = size * 0.22;
  g.poly([
    -h + notch, -h,
    h - notch, -h,
    h, -h + notch,
    h, h - notch,
    h - notch, h,
    -h + notch, h,
    -h, h - notch,
    -h, -h + notch,
  ]);
  g.fill({ color: tint, alpha: 0.9 });
  g.stroke({ width: 2, color: lighten(tint, lift + 0.25) });

  // An inner facet, so the shape reads as a gem rather than a blob.
  const facet = new Graphics();
  facet.poly([0, -h * 0.5, h * 0.5, 0, 0, h * 0.5, -h * 0.5, 0]);
  facet.fill({ color: lighten(tint, lift), alpha: 0.75 });

  box.addChild(g, facet);

  // Level pips, so an upgrade is legible without real art.
  if (level > 1) {
    const pips = new Graphics();
    const count = Math.min(level, 7);
    const spacing = size * 0.11;
    const startX = -((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      pips.circle(startX + i * spacing, h * 0.74, size * 0.032);
    }
    pips.fill({ color: SAND, alpha: 0.9 });
    box.addChild(pips);
  }

  return box;
}

function birdPlaceholder(color: GemColor): Container {
  const box = new Container();
  const tint = GEM_TINTS[color];
  const r = S * 0.36;

  const body = new Graphics();
  body.circle(0, 0, r);
  body.fill({ color: tint });
  body.stroke({ width: 3, color: lighten(tint, 0.35) });

  // Beak and eye give it a facing direction, which helps read the walk.
  const beak = new Graphics();
  beak.poly([r * 0.72, -r * 0.1, r * 1.22, 0.0, r * 0.72, r * 0.18]);
  beak.fill({ color: AMBER });

  const eye = new Graphics();
  eye.circle(r * 0.26, -r * 0.24, r * 0.17);
  eye.fill({ color: 0xffffff });
  eye.circle(r * 0.31, -r * 0.24, r * 0.08);
  eye.fill({ color: INK });

  // A hat brim, to read as a western bird rather than a plain dot.
  const brim = new Graphics();
  brim.ellipse(0, -r * 0.72, r * 0.86, r * 0.18);
  brim.fill({ color: darken(tint, 0.45) });
  brim.rect(-r * 0.4, -r * 1.12, r * 0.8, r * 0.42);
  brim.fill({ color: darken(tint, 0.35) });

  box.addChild(body, beak, eye, brim);
  return box;
}

function banditPlaceholder(): Container {
  const box = new Container();
  const r = S * 0.37;

  const body = new Graphics();
  body.circle(0, 0, r);
  body.fill({ color: BANDIT_DARK });
  body.stroke({ width: 3, color: 0xe2614f });

  const collar = new Graphics();
  collar.ellipse(0, r * 0.62, r * 0.7, r * 0.2);
  collar.fill({ color: 0xf1ece2 });

  const hat = new Graphics();
  hat.ellipse(0, -r * 0.68, r * 1.0, r * 0.2);
  hat.fill({ color: 0x15151a });
  hat.rect(-r * 0.46, -r * 1.32, r * 0.92, r * 0.62);
  hat.fill({ color: 0x1d1d23 });

  const eye = new Graphics();
  eye.circle(r * 0.24, -r * 0.2, r * 0.15);
  eye.fill({ color: 0xe2614f });

  const beak = new Graphics();
  beak.poly([r * 0.7, -r * 0.08, r * 1.2, r * 0.04, r * 0.7, r * 0.22]);
  beak.fill({ color: 0xd8c068 });

  box.addChild(body, collar, beak, eye, hat);
  return box;
}

function coinPlaceholder(value: number): Container {
  const box = new Container();
  const r = S * 0.34;

  const disc = new Graphics();
  disc.circle(0, 0, r);
  disc.fill({ color: AMBER });
  disc.stroke({ width: 3, color: 0x8a5712 });
  disc.circle(0, 0, r * 0.78);
  disc.stroke({ width: 1.5, color: 0xf6d189, alpha: 0.8 });

  const label = new Text({
    text: value >= 1000 ? `${value / 1000}k` : `${value}`,
    style: labelStyle(value >= 1000 ? S * 0.22 : S * 0.26, 0x3a2405),
  });
  label.anchor.set(0.5);

  box.addChild(disc, label);
  return box;
}

function specialPlaceholder(kind: SymbolKind, badge?: string): Container {
  const box = new Container();
  const tint = SPECIAL_TINT[kind] ?? SAND;
  const size = S * 0.68;

  const plate = new Graphics();
  plate.roundRect(-size / 2, -size / 2, size, size, size * 0.26);
  plate.fill({ color: tint, alpha: 0.92 });
  plate.stroke({ width: 2.5, color: lighten(tint, 0.35) });

  const glyph = new Text({
    text: SPECIAL_GLYPH[kind] ?? '?',
    style: labelStyle(kind === 'dynamite' ? S * 0.2 : S * 0.34, pickInk(tint)),
  });
  glyph.anchor.set(0.5);

  box.addChild(plate, glyph);

  if (badge) {
    const badgeText = new Text({ text: badge, style: labelStyle(S * 0.17, INK) });
    badgeText.anchor.set(0.5);
    const pill = new Graphics();
    pill.roundRect(size * 0.1, -size * 0.58, size * 0.42, size * 0.3, size * 0.12);
    pill.fill({ color: SAND });
    badgeText.position.set(size * 0.31, -size * 0.43);
    box.addChild(pill, badgeText);
  }

  return box;
}

/** The coin's value, drawn over whatever art the coin uses. */
function coinValueBadge(value: number): Container {
  const box = new Container();
  const text = new Text({
    text: value >= 1000 ? `${value / 1000}k` : `${value}`,
    style: labelStyle(S * 0.24, 0x3a2405),
  });
  text.anchor.set(0.5);

  const plate = new Graphics();
  plate.roundRect(-S * 0.17, S * 0.16, S * 0.34, S * 0.2, S * 0.1);
  plate.fill({ color: SAND, alpha: 0.95 });
  text.position.set(0, S * 0.26);

  box.addChild(plate, text);
  return box;
}

/** The +1/+2/+3 an upgrade symbol grants. */
function stepsBadge(steps: number): Container {
  const box = new Container();
  const pill = new Graphics();
  pill.roundRect(S * 0.1, -S * 0.42, S * 0.3, S * 0.22, S * 0.11);
  pill.fill({ color: SAND });

  const text = new Text({ text: `+${steps}`, style: labelStyle(S * 0.17, INK) });
  text.anchor.set(0.5);
  text.position.set(S * 0.25, -S * 0.31);

  box.addChild(pill, text);
  return box;
}

/** Picks dark or light text so the glyph stays readable on its plate. */
function pickInk(bg: number): number {
  const r = (bg >> 16) & 0xff;
  const g = (bg >> 8) & 0xff;
  const b = bg & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? INK : 0xfdf7ea;
}

function lighten(color: number, amount: number): number {
  return mix(color, 0xffffff, amount);
}

function darken(color: number, amount: number): number {
  return mix(color, 0x000000, amount);
}

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
