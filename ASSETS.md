# Swapping in your own art

Nothing in the code references a file path. Every sprite is looked up by a
**logical key**, and `src/assets/manifest.json` maps keys to files. A key left
as `null` draws a built-in procedural placeholder, which is why the game is
fully playable before any art exists.

## How to replace a symbol

1. Drop your image into `src/assets/` (any subfolder you like).
2. Point its key at the file:

```json
"gem.blue.1": "/src/assets/gems/blue-1.png"
```

3. Reload. That is the whole process — no code changes, no rebuild step.

Unknown or missing files are not fatal: the loader warns once in the console
and falls back to the placeholder for that key, so a half-finished art pass
still runs.

## Sizing

`manifest.json` has a `cellSize` (default `96`). Images are scaled to fit
**92% of a cell** on their longest edge, preserving aspect ratio, and drawn
from their centre.

- Square art at **2× cell size (192×192)** is the safe default.
- Transparent PNG or WebP. SVG works but rasterises at load size.
- Art may overflow its cell a little (a hat, a muzzle flash); it is not clipped.

## The keys

### Gems — 28 keys

`gem.<colour>.<level>` for each of `blue`, `green`, `purple`, `red` and levels
`1`–`7`.

Level is a visible upgrade, so the seven steps should read as a clear
progression — the placeholder does it with brightness plus a row of pips. The
player needs to tell level 5 from level 6 at a glance, in peripheral vision,
mid-cascade.

### Collectors — 5 keys

| Key | What it is |
| --- | --- |
| `bird.blue` | Always on the grid |
| `bird.green`, `bird.purple`, `bird.red` | Land on the drop |
| `bandit` | The vulture, released by a key |

Birds walk along their collection trail, so give them a clear facing direction.
The placeholders point right.

### Specials — 11 keys

| Key | What it does |
| --- | --- |
| `special.wild` | Stands in for any gem |
| `special.wildBandit` | Wild that pays as the top gem |
| `special.upgrade` | Upgrades one colour by 1–3 levels |
| `special.upgradeAll` | Upgrades all four colours |
| `special.coin` | Instant win — **the value is drawn over your art**, so leave the centre readable |
| `special.dynamite` | Explodes and grows the grid |
| `special.peanut` | Fills a gap so a bird can cross |
| `special.transform` | Repaints neighbouring gems |
| `special.key` | Releases the bandit |
| `special.bonus` | Scatter |
| `special.superBonus` | Scatter that upgrades the bonus to Super |

`special.upgrade` and `special.upgradeAll` also get a `+1`/`+2`/`+3` badge drawn
over the top right, so keep that corner clear.

### Board and coin game — 5 keys

| Key | Notes |
| --- | --- |
| `board.background` | Behind the grid |
| `board.cell` | One empty cell |
| `board.trainCell` | A cell wearing the train backdrop — must read as **different** from a normal cell, since robbing both edges is what triggers the heist |
| `coinGame.bag`, `coinGame.scorpion` | The coin game pieces |

## What is still drawn in code

These are CSS and canvas drawing, not images, and are styled rather than
replaced:

- the HUD, meter, buttons and quiz modal — `src/render/ui/style.css`
- shot lines, blast rings and the train sweep — `src/render/board.ts`
- symbol placeholders themselves — `src/render/symbols.ts`

Colours live as CSS custom properties at the top of `style.css` and as
`GEM_TINTS` in `src/render/symbols.ts`. Change both to reskin the palette.
