import { loadAssets } from './render/assets';
import { Game } from './game';

/**
 * Boot: load whatever art the manifest points at (nothing, to begin with —
 * every symbol falls back to a legible placeholder), then start the game.
 */
async function boot(): Promise<void> {
  const { loaded, skipped } = await loadAssets();
  if (import.meta.env.DEV) {
    console.info(
      `[maximo] ${loaded} texture(s) loaded, ${skipped} using placeholders. ` +
        'Point src/assets/manifest.json at your own files to replace them.',
    );
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
