# Art

The game draws from the **Max Birds** pack in [`assets/`](assets/README.md).

Nothing in the code references a file path. Every sprite is looked up by a
**logical key**, and `src/assets/manifest.json` maps keys to file names inside
`/assets`. A key mapped to `null` — or to a file that is not in the pack —
draws a built-in procedural placeholder instead, so a partial art pass still
runs and the game never fails to boot over a missing image.

## How to change a symbol

1. Put the image in `assets/`.
2. Point its key at the file name:

```json
"gem.purple.1": "gem-purple-v4.png"
```

3. Reload. That is the whole process — no code changes, no copy step. Vite
   bundles everything matching `/assets/*.png` and hashes it for production.

On a dev boot the console reports how many keys resolved, how many fell back to
placeholders, and names any file it could not find.

## Sizing and framing

The pack ships padded square canvases — a 1254×1254 PNG whose artwork might only
occupy the middle 900px. Scaling the whole canvas into a cell would make every
sprite a different visual weight depending on how much empty space it was drawn
with.

So sprites are scaled and centred on their **visible alpha box**, read from
`assets/manifest.json` (`visible_bounds`), which the art pack measures. Keep
that manifest up to date when adding art and sizing takes care of itself.

Relative to one grid cell, the visible art is drawn at:

| | Share of a cell |
| --- | --- |
| Characters (birds, rival) | 98% |
| Specials | 84% |
| Gems | 78% |

## What the engine draws on top

Some information cannot live in a static image, so it is composited over
whatever art a key supplies:

- **Gem level** — a row of pips under the gem. The pack has one gem per colour,
  not seven, and the level is the difference between a 0.02x gem and a 2.70x
  one, so it has to be legible at a glance mid-cascade.
- **Coin value** — a plate over the money bag with its multiplier.
- **Upgrade steps** — a `+1`/`+2`/`+3` pill in the top-right corner. Keep that
  corner clear in upgrade art.

## The keys

### Gems — 28 keys

`gem.<colour>.<level>` for `blue`, `green`, `purple`, `red` and levels `1`–`7`.
All seven levels of a colour currently point at the same file; the level reads
from the pips. Point them at distinct files if you ever draw per-level gems.

### Collectors — 5 keys

| Key | Pack file |
| --- | --- |
| `bird.blue` | `bird-blue-captain-v2.png` |
| `bird.green` | `bird-green-explorer-v2.png` |
| `bird.purple` | `bird-purple-dj-v2.png` |
| `bird.red` | `bird-red-trickster-v2.png` |
| `bandit` | `bird-rival-v2.png` — also used for the cage and quiz portraits |

### Specials — 11 keys

| Key | What it does | Art |
| --- | --- | --- |
| `special.wild` | Stands in for any gem | horseshoe |
| `special.peanut` | Fills a gap so a bird can cross | jar |
| `special.bonus` | Scatter | inactive skull |
| `special.superBonus` | Scatter that upgrades the bonus to Super | gold skull |
| `special.wildBandit` | Wild paying as the top gem | dark gunmetal W |
| `special.upgrade` | Upgrades one colour by 1–3 levels | silver horseshoe |
| `special.upgradeAll` | Upgrades all four colours | gold horseshoe |
| `special.coin` | Instant win, value drawn over it | gold-filled money bag |
| `special.dynamite` | Explodes and grows the grid | red dynamite bundle |
| `special.transform` | Repaints neighbouring gems | moonshine jug |
| `special.key` | Releases the rival | brass key |

The two scatters use the pack's gold skull for the **Super** scatter and the
inactive one for the ordinary scatter, so gold reads as the rarer of the two.
The pack documents them as one gameplay role, so repoint them if you would
rather they matched that.

### Board and chrome — 8 keys

| Key | Pack file | Notes |
| --- | --- | --- |
| `board.background` | `background-neighbourhood-day-v1.png` | Full-bleed, cover-scaled, dimmed for contrast |
| `board.frame` | `overlay-board-frame-v2.png` | Nine-sliced around the grid, so corners keep their curve while the straight runs stretch |
| `ui.meter` | `overlay-meter-v2.png` | The fill is drawn in the channel behind it |
| `ui.cage` | `overlay-cage-v2.png` | Bars, drawn in front of the rival |
| `ui.padlock` | `overlay-padlock-v2.png` | In front of the bars |
| `ui.title` | `title-emblem-v2.png` | Top-left brand |
| `board.cell`, `board.trainCell` | *placeholder* | Cells are currently drawn, not textured |

### Effects and coin game — 4 keys

`effect.collect`, `effect.win` are mapped but not yet drawn by the renderer.
`coinGame.bag` and `coinGame.scorpion` have no art and fall back to coloured
rings.

## Tuning the frame and meter

Two things are fitted to the current art and will need adjusting if it changes:

- **`FRAME_SCALE` and `FRAME_CORNER`** in `src/render/board.ts` — how the track
  frame is nine-sliced and how thick it renders. `PAD` must stay large enough
  to clear it, or the rails sit on the outer row and column.
- **`--meter-left/right/top/bottom`** in `src/render/ui/style.css` — where the
  usable channel sits inside the meter image, as percentages.

## Known gaps

- The coin game has no art of its own.

## What is still drawn in code

Styled rather than replaced: the HUD, meter fill, buttons and quiz modal
(`src/render/ui/style.css`), the shot lines, blast rings and train sweep
(`src/render/board.ts`), and the symbol placeholders themselves
(`src/render/symbols.ts`). Palette lives as CSS custom properties at the top of
`style.css` and as `GEM_TINTS` in `src/render/symbols.ts`.

## Purple portrait gem — 10 October 2026
`gem-purple-v4.png` uses the smiling man on the right in the new silver-hat photograph, with photographic facial detail inside an amethyst hexagonal gem. All seven purple gem levels now load this PNG, matching the other colours; level pips still distinguish values. Its alpha bounds are recorded in assets/manifest.json.

## Seven feature icons — 10 October 2026
The seven previously missing board icons now use generated PNGs based on ELK Studios’ official Pirots 3 promotion package and paytable screenshots. Upgrade and Upgrade All are silver and gold horseshoes; Coin is a money bag; Transform is a moonshine jug. See [source research](assets/SYMBOL-REFERENCE-RESEARCH.md). Coin values and upgrade steps remain dynamic renderer labels.
