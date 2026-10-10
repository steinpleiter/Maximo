import { describe, expect, it, vi } from 'vitest';
import { COIN_VALUES } from '../src/config/paytable';
import { SPECIAL_KINDS, type GemColor } from '../src/math/types';
import manifest from '../src/assets/manifest.json';
import pack from '../assets/manifest.json';

vi.mock('pixi.js', () => ({ Assets: { load: vi.fn(async () => ({})) } }));
import { keyForCell, keyForCoin, loadAssets, urlFor } from '../src/render/assets';

const levels: Record<GemColor, number> = { blue: 1, green: 2, purple: 3, red: 7 };
const textures = manifest.textures as Record<string, string | null>;

describe('gameplay artwork', () => {
  it('bundles nested promotional icons and SVG effects without missing files', async () => {
    const report = await loadAssets();
    expect(report.missing).toEqual([]);
    expect(report.placeholders).toBe(2); // Cell backgrounds intentionally remain vector-drawn.
    expect(urlFor('special.dynamite')).toContain('symbol-dynamite-v1.png');
    expect(urlFor('coinGame.scorpion')).toContain('scorpion.svg');
  });

  it('uses only a matching denomination, otherwise a neutral bag with a live value', () => {
    const supplied = new Set([2, 5, 10, 25, 50, 100, 500, 1000, 2500, 10000]);
    for (const { value } of COIN_VALUES) {
      const expected = supplied.has(value) ? `special.coin.${value}` : 'special.coin';
      expect(keyForCoin(value)).toBe(expected);
      expect(keyForCell({ id: 1, kind: 'coin', coinValue: value }, levels)).toBe(expected);
    }
    expect(textures['special.coin']).toBe('symbol-coin-v1.png');
    expect(keyForCoin(0.09)).toBe('special.coin');
    expect(textures[keyForCoin(10000)]).toBe('icons/CoinMaxWin.png');
  });

  it('selects all single and global upgrade step variants', () => {
    for (const kind of ['upgrade', 'upgradeAll'] as const) {
      for (const upgradeSteps of [1, 2, 3]) {
        const key = keyForCell({ id: 1, kind, upgradeSteps }, levels);
        expect(key).toBe(`special.${kind}.${upgradeSteps}`);
        expect(textures[key]).toBeTruthy();
      }
    }
  });

  it('provides art for every special while preserving Max portrait gems', () => {
    for (const kind of SPECIAL_KINDS) expect(textures[keyForCell({ id: 1, kind }, levels)]).toBeTruthy();
    expect(textures[keyForCell({ id: 1, kind: 'gem', color: 'purple' }, levels)]).toBe('gem-purple-v4.png');
    expect(textures['bird.blue']).toBe('bird-blue-captain-v2.png');
  });

  it('records usable alpha bounds for every active padded promotional image', () => {
    for (const file of Object.values(textures).filter((file): file is string => !!file?.startsWith('icons/'))) {
      const asset = pack.assets.find((entry) => entry.file === file);
      expect(asset, file).toBeDefined();
      const bounds = asset?.visible_bounds;
      expect(bounds?.length, file).toBe(4);
      expect(bounds![2]).toBeGreaterThan(bounds![0]);
      expect(bounds![3]).toBeGreaterThan(bounds![1]);
    }
  });
});
