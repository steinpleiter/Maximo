# Pirots 3 missing symbols — official image research

Date: 10 October 2026. These designs are based on ELK Studios' published PNGs and paytable screenshots, not on placeholder glyphs or another assistant's design suggestions.

## Primary sources

- [Official Pirots 3 page](https://www.elk-studios.com/games/pirots3/)
- [Official asset directory](https://www.elk-studios.com/promo-package/)
- [Promotion package linked by ELK](https://elkpromo.s3.eu-west-1.amazonaws.com/Pirots3/Promotion+Package.zip)

The archive downloaded successfully through the CLI. Reference files were extracted unchanged from `Promotion Package/Symbols/` and `Promotion Package/Game play images/` and inspected visually. The web reader's encoded archive request returned 403; the exact published URL worked through the CLI.

| Game key | Official PNG | Observed design | New file |
|---|---|---|---|
| special.wildBandit | WildBlack.png | Dark gunmetal W, silver bevels | symbol-bandit-wild-v1.png |
| special.upgrade | LevelUp.png | Upright silver horseshoe | symbol-upgrade-v1.png |
| special.upgradeAll | LevelUpAll.png | Upright gold horseshoe | symbol-upgrade-all-v1.png |
| special.coin | Coin2.png | Dark money bag with red tie and gold coins | symbol-coin-v1.png |
| special.dynamite | Bomb.png | Red dynamite bundle, broad gold band, twisted fuse | symbol-dynamite-v1.png |
| special.transform | Transform.png | Brown-and-cream corked moonshine jug with XXX marks | symbol-transform-v1.png |
| special.key | Key.png | Diagonal ornate brass key with round ring bow | symbol-key-v1.png |

Paytable screenshots 2–5 corroborate these roles and their appearance in the official game. The generated icons recreate the source designs at larger scale with transparent exteriors. Coin's printed 2x is removed so the game can display its actual payout dynamically. Upgrade amounts also remain game-rendered badges.

Original ELK artwork remains reference material. Generated PNGs are new image-tool outputs; game mathematics and feature behavior are outside this art change.
