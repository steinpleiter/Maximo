# Game artwork

The renderer combines the original **Max Birds** art in `assets/` with the supplied
**Pirots 3 Promotion Package** gameplay icons in `assets/icons/`. The Max portrait
gems, collectors, rival, backgrounds, board frame, meter, cage and title remain
in use. Promotional screenshots are visual references, not flattened game UI.

`src/assets/manifest.json` maps logical keys to files. Vite bundles PNG and SVG
files recursively below `/assets`, including the previously unreachable icons
folder. The renderer reports missing files on boot. A null key uses procedural
art; only `board.cell` and `board.trainCell` intentionally remain null.

## Symbols and variants

| Logical key | Artwork |
| --- | --- |
| `gem.<colour>.<1–7>` | Existing Max portrait gem per colour; level pips remain live |
| `bird.<colour>`, `bandit` | Existing Max Birds characters |
| `special.wild` | Promotional `Wild.png` |
| `special.wildBandit` | Promotional `WildBlack.png` |
| `special.upgrade.<1–3>` | `LevelUp.png`, `LevelUp_2.png`, `LevelUp_3.png` |
| `special.upgradeAll.<1–3>` | Corresponding `LevelUpAll` variants |
| `special.coin.<value>` | Exact matching promotional money bag |
| `special.coin` | Neutral SVG money bag with live denomination |
| `special.dynamite`, `special.bigDynamite` | `Bomb.png` and `BigBomb.png` |
| `special.peanut` | Promotional `Peanut.png` |
| `special.transform` | Promotional `Transform.png` |
| `special.key` | Promotional `Key.png` |
| `special.bonus`, `special.superBonus` | Promotional `Bonus.png`, `SuperBonus.png` |
| `special.crossover`, `special.nest` | Registered promotional artwork; no separate engine symbol kind |

The promotional bags have numbers baked into their artwork. Their denominations
are 2, 5, 10, 25, 50, 100, 500, 1000, 2500 and MAX WIN (the engine's 10000× cap).
The engine also awards 1, 3, 15, 20, 75 and 250×. These use the neutral bag with
an exact live value, never a differently numbered promotional image. Baked
upgrade counts and coin denominations do not receive duplicate value badges.

The supplied pack also includes alternative gems, colour-specific wild levels,
characters and marketing banners. They remain available in the supplied pack;
they do not replace the Max identities or introduce game rules absent from the
engine. The game icon copies already in `assets/icons/` are retained.

## Sizing

Promotional PNGs have large transparent margins. Every actively mapped PNG's
alpha bounds are recorded in `assets/manifest.json`; sprites scale and centre
around those visible pixels, not the padded canvas. Authored SVG effects use
bounds within their view boxes. Characters occupy 98% of a cell, specials 84%,
and portrait gems 78%; gem-level pips sit below the portrait.

To add art, copy the file below `assets/`, register its logical key in
`src/assets/manifest.json`, and record its dimensions and visible bounds in
`assets/manifest.json`. A valid file path is required even for nested folders.

## Effects and feature presentations

| Key | Use |
| --- | --- |
| `effect.collect` | Original supplied Max sparkle, animated on collections and feature landings |
| `effect.win` | Original supplied Max sunburst for win presentation |
| `effect.coin` | New embossed M gold SVG coin for animated showers |
| `coinGame.bag` | New neutral SVG money bag used before a coin-game reveal |
| `coinGame.scorpion` | New illustrated SVG scorpion used on a losing reveal |

The promotional package supplies static PNG symbols and screenshot references;
it does not supply a scorpion, isolated shower coin, standalone locomotive,
animated sprite sheets or transparent win-title overlays. The neutral bag,
scorpion and shower coin are intentionally authored SVGs in `assets/effects/`.
The locomotive is vector art drawn in Pixi. These are application additions,
not extracted promotional artwork.

`src/render/board.ts` exposes composable animations:

- `collectSparkle(pos, color)` blooms the sparkle and emits coloured facets.
- `floatingPayout(pos, value)` lifts the exact engine multiplier from a cell.
- `dynamiteBlast(pos)` shows the large dynamite bundle, fuse shake, fire and embers.
- `coinPick(pos, kind, value)` flips a bag into the denomination or scorpion.
- `meterBurst(cells)` sends golden trails from the meter toward awarded cells.
- `trainSweep()` drives a locomotive and coin carriage around the board rails,
  with turning wheels and trailing steam.

These effects remove their temporary display objects after completion. Their
speed follows the common tween runner, including turbo and reduced-motion
handling. Game event animators compose them with symbol movement and the
separate DOM win/bonus presentations. Feature payouts always come from engine
events; art does not determine winnings.

## Frame and meter fitting

`FRAME_SCALE`, `FRAME_CORNER` and `PAD` in `src/render/board.ts` fit the existing
nine-sliced rail frame. Meter CSS channel offsets in `src/render/ui/features.css`
fit its transparent artwork. Both must be adjusted if those images change.

## Purple portrait gem — 10 October 2026

`gem-purple-v4.png` uses the smiling man on the right in the new silver-hat
photograph, with photographic facial detail inside an amethyst hexagonal gem.
All seven purple levels retain this PNG; live pips distinguish their values.

## Sound

The original six supplied MP3s live in `assets/audio/`. Base music uses the
separate `music000-background.mp3` derivative starting at 00:34; bonus music
uses `music001.mp3`. Fourteen short effects were extracted from all four banks.
`assets/audio/cues.json` records source offsets, gains and acoustic confidence;
`assets/audio/CUES.md` records the spectrogram/classification analysis. These
are inferred event roles, not original publisher cue names.
