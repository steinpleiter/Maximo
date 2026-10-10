import { Assets, Texture } from 'pixi.js';
import manifest from '../assets/manifest.json';
import pack from '../../assets/manifest.json';
import type { Cell, GemColor, SymbolKind } from '../math/types';

type TextureMap = Record<string, string | null>;

const KEYS = manifest.textures as TextureMap;

/** Nominal cell size in pixels; the board scales from this. */
export const CELL_SIZE: number = manifest.cellSize ?? 96;

/**
 * Every PNG in the art pack, as a bundled URL. Vite resolves the glob at build
 * time, so files get hashed names in production and no copy step is needed.
 */
const FILES = import.meta.glob('/assets/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/**
 * The alpha bounding box the art pack measured for each file.
 *
 * The PNGs are padded square canvases, so scaling the full canvas into a cell
 * would make every sprite a different visual size depending on how much empty
 * space its artist left. Normalising on the visible box instead keeps a bird
 * and a gem reading at the same weight on the board.
 */
const BOUNDS = new Map<string, { x: number; y: number; w: number; h: number }>();

for (const asset of pack.assets) {
  const bounds = (asset as { visible_bounds?: number[] | null }).visible_bounds;
  if (!bounds || bounds.length !== 4) continue;
  const [x0, y0, x1, y1] = bounds;
  BOUNDS.set(asset.file, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
}

const loaded = new Map<string, Texture>();
const fileFor = new Map<string, string>();

export interface AssetReport {
  loaded: number;
  placeholders: number;
  missing: string[];
}

/**
 * Loads whatever the manifest points at. A key mapped to `null` — or to a file
 * that is not in the pack — falls through to the built-in procedural
 * placeholder, so a partial art pass still runs.
 */
export async function loadAssets(): Promise<AssetReport> {
  const wanted = Object.entries(KEYS).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
  );

  const missing: string[] = [];

  await Promise.all(
    wanted.map(async ([key, file]) => {
      const url = FILES[`/assets/${file}`];
      if (!url) {
        missing.push(`${key} -> ${file} (not in /assets)`);
        return;
      }

      try {
        loaded.set(key, await Assets.load<Texture>(url));
        fileFor.set(key, file);
      } catch {
        missing.push(`${key} -> ${file} (failed to decode)`);
      }
    }),
  );

  return {
    loaded: loaded.size,
    placeholders: Object.keys(KEYS).length - loaded.size,
    missing,
  };
}

export function textureFor(key: string): Texture | null {
  return loaded.get(key) ?? null;
}

export function hasTexture(key: string): boolean {
  return loaded.has(key);
}

/** The measured visible box for a key's texture, in texture pixels. */
export function boundsFor(key: string): { x: number; y: number; w: number; h: number } | null {
  const file = fileFor.get(key);
  return file ? (BOUNDS.get(file) ?? null) : null;
}

/** A plain URL for a key, for DOM chrome that is not drawn by Pixi. */
export function urlFor(key: string): string | null {
  const file = KEYS[key];
  return file ? (FILES[`/assets/${file}`] ?? null) : null;
}

/** The manifest key for a cell as it currently stands. */
export function keyForCell(cell: Cell, gemLevels: Record<GemColor, number>): string {
  switch (cell.kind) {
    case 'gem':
      return `gem.${cell.color}.${gemLevels[cell.color as GemColor] ?? 1}`;
    case 'bird':
      return `bird.${cell.color}`;
    case 'bandit':
      return 'bandit';
    default:
      return `special.${cell.kind as SymbolKind}`;
  }
}
