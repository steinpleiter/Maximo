import { Assets, Texture } from 'pixi.js';
import manifest from '../assets/manifest.json';
import type { Cell, GemColor, SymbolKind } from '../math/types';

type TextureMap = Record<string, string | null>;

const TEXTURES = manifest.textures as TextureMap;

/** Nominal cell size in pixels; the board scales from this. */
export const CELL_SIZE: number = manifest.cellSize ?? 96;

const loaded = new Map<string, Texture>();

/**
 * Loads whatever the manifest actually points at. Keys left as `null` are
 * skipped and fall through to the built-in procedural placeholder, so the game
 * is fully playable before a single asset exists.
 */
export async function loadAssets(): Promise<{ loaded: number; skipped: number }> {
  const entries = Object.entries(TEXTURES).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
  );

  let failed = 0;

  await Promise.all(
    entries.map(async ([key, path]) => {
      try {
        loaded.set(key, await Assets.load<Texture>(path));
      } catch {
        // A missing file is not fatal — the placeholder covers for it. Say so
        // once rather than failing the whole boot.
        failed++;
        console.warn(`[assets] could not load "${key}" from "${path}"; using placeholder`);
      }
    }),
  );

  return {
    loaded: loaded.size,
    skipped: Object.keys(TEXTURES).length - loaded.size - failed,
  };
}

export function textureFor(key: string): Texture | null {
  return loaded.get(key) ?? null;
}

export function hasTexture(key: string): boolean {
  return loaded.has(key);
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
