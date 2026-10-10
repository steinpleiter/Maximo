# Max Birds asset pack

Max-themed treasure-game artwork following the supplied Pirots 3 art direction generated with ChatGPT image generation on 10 October 2026.

The current revision follows Pirots 3 throughout the pack. Original v1 assets are retained in `archive/v1/` for history; the active manifest selects the Pirots 3 birds and props, with the latest photographic gems.

Open `preview.html` to see the asset gallery and a sample board composition. This folder contains the separate generated PNGs alongside the preview and pack documentation. `prompts/jobs.json` contains the complete prompt queue. `manifest.json` records actual dimensions and transparency measurements. `CONTENT-PLAN.md` records scope and reference decisions.

## Reference identity
Max was confirmed by the user as the laughing man on the left wearing a cream shirt in photo 4 and the DJ in photo 39. The supplied source photos are unchanged. Reference copies are kept locally in `references/` for future generation; the downloadable ZIP excludes these source photos.

## Colours and symbols
Collector colours and gem colours: blue, red, green, purple. Each sprite keeps its own silhouette so colour is not the only visual distinction. The rival character and cage are separate, allowing the cage to be layered in front of the bird. Gold and inactive bonus skulls share one gameplay role. UI text such as BONUS, counters, balances and button labels should be added by the game engine.

## Integration
- Use manifest IDs as stable asset keys.
- Draw transparent sprite canvases with proportional contain scaling; PNGs include padding, so keep anchor positions consistent. The manifest includes each visible alpha bounding box to help normalize display scale.
- Backgrounds use cover scaling. Add a translucent board panel in the engine if contrast requires it.
- The sample board uses the Pirots 3 reference layout of six columns and seven rows. Board frame and collection meter are artwork layers; generate progress fill and numbers in the engine.
- Layer rival character behind the cage, then padlock above it.
- The title and effects can be used in start/win screens.

## Production boundary
This is a starter image pack with neutral character poses, not an animated spritesheet or a working game. Collect, move, win and reaction animations need additional frames or engine animation. The three original backgrounds are imaginative Venserpolder-inspired scenes. The new neighbourhood daytime background repaints the supplied canal-side street photograph, preserving its camera view and main landmarks; it is stylized artwork rather than a measured reconstruction. No Stockroom application changes, deployment or publication are part of this task.

## Regeneration and archive
The active prompts are in `prompts/jobs.json` and `prompts/jobs-v5.json`; previous prompt sets are retained for history. They record the style and identity references used by the built-in image tool. The local `references/` folder is required to regenerate the pack; private source photos are excluded from the downloadable ZIP. The manifest is an audit of the PNG files, not a claim that game behavior has been implemented.

## Photographic gem revision
Red uses the original cream-shirt laughing photo; blue uses the original DJ photo; green uses the new pool selfie (front-left man). Each uses a distinct original source photograph with photographic facial texture inside the approved faceted gem treatment. Purple uses the smiling man on the right wearing a silver sequined hat in the newly supplied photo. All four colours now use four distinct source photographs.

## Neighbourhood daytime background
The new `background-neighbourhood-day-v1.png` uses the supplied street photograph for its composition and Pirots 3 references for painted game-art rendering. Bright midday light, blue sky and green foliage replace the original overcast appearance. It is the default preview background. The purple photographic gem is complete and connected to all seven purple gem levels in the game.

## Repository package
PNG paths in the manifest, preview, and prompts are relative to this assets folder. Original source photos and historical image variants are excluded. The packaged preview is static and can be opened locally.
