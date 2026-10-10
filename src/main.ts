import { loadAssets } from './render/assets';
import { Game } from './game';

/**
 * Boot: load whatever art the manifest points at (nothing, to begin with —
 * every symbol falls back to a legible placeholder), then start the game.
 */
async function boot(): Promise<void> {
  const report = await loadAssets();
  if (import.meta.env.DEV) {
    console.info(
      `[maximo] ${report.loaded} texture(s) from the art pack, ` +
        `${report.placeholders} drawn as placeholders. ` +
        'Map more keys in src/assets/manifest.json — see ASSETS.md.',
    );
    for (const problem of report.missing) console.warn(`[maximo] ${problem}`);
  }

  const game = new Game();
  await game.start();
}

// The game owns DOM listeners and a running round, so a hot update would leave
// a second instance driving the same elements. Take a full reload instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

boot().catch((error) => {
  console.error('[maximo] failed to start', error);
  const stage = document.getElementById('stage');
  if (stage) {
    stage.textContent = 'Something went wrong starting the game — check the console.';
  }
});
