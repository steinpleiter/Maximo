import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/render/assets', () => ({ urlFor: () => null }));

import { winTier } from '../src/render/ui/celebrations';

describe('win presentation tiers', () => {
  it.each([
    [0, 'ordinary'],
    [0.09, 'ordinary'],
    [9.99, 'ordinary'],
    [10, 'big'],
    [16.94, 'big'],
    [24.99, 'big'],
    [25, 'super'],
    [49.99, 'super'],
    [50, 'mega'],
    [74.12, 'mega'],
    [99.99, 'mega'],
    [100, 'epic'],
    [135, 'epic'],
    [278.27, 'epic'],
  ] as const)('presents a %sx return as %s', (multiplier, expected) => {
    expect(winTier(multiplier)).toBe(expected);
  });
});
