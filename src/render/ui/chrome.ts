import { urlFor } from '../assets';
import type { GemColor } from '../../math/types';

/**
 * Dresses the DOM chrome with the art pack: painted backdrop, title emblem,
 * the caged rival and the collection meter.
 *
 * Every piece is optional. A key with no art simply leaves its element empty,
 * and the CSS hides image elements that never received a `src`, so the game
 * still runs on a partial pack.
 */
export function applyChrome(): void {
  const backdrop = urlFor('board.background');
  if (backdrop) {
    const node = document.getElementById('backdrop');
    if (node) node.style.backgroundImage = `url("${backdrop}")`;
  }

  setImage('title-emblem', urlFor('ui.title'));
  setImage('cage-bird', urlFor('bandit'));
  setImage('cage-bars', urlFor('ui.cage'));
  setImage('cage-lock', urlFor('ui.padlock'));
  setImage('meter-art', urlFor('ui.meter'));
}

/** Greys out the cage once the rival is loose on the board. */
export function setCageOpen(open: boolean): void {
  document.getElementById('cage')?.classList.toggle('open', open);
}

/** Portrait art for a duelist in the quiz modal, if the pack has it. */
export function portraitFor(color: GemColor | null, isBandit: boolean): string | null {
  return urlFor(isBandit ? 'bandit' : `bird.${color}`);
}

function setImage(id: string, url: string | null): void {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLImageElement)) return;
  if (url) node.src = url;
  else node.removeAttribute('src');
}
