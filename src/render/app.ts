import { Application, Container } from 'pixi.js';
import { Board } from './board';

/**
 * Owns the Pixi application and keeps the board centred and scaled to whatever
 * space the stage element gives it. The board draws at a fixed logical cell
 * size; fitting is a single scale on its wrapper, so nothing downstream has to
 * think about pixels.
 */
export class GameStage {
  readonly app = new Application();
  readonly board = new Board();
  private readonly wrapper = new Container();
  private host!: HTMLElement;

  async init(host: HTMLElement): Promise<void> {
    this.host = host;

    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      preference: 'webgl',
    });

    host.appendChild(this.app.canvas);
    this.wrapper.addChild(this.board);
    this.app.stage.addChild(this.wrapper);

    this.board.resize(6, 7);

    const observer = new ResizeObserver(() => this.fit());
    observer.observe(host);
    window.addEventListener('orientationchange', () => this.fit());
    this.fit();
  }

  /** Recentres and rescales after a resize or a grid expansion. */
  fit(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);

    this.app.renderer.resize(width, height);

    const scale = Math.min(width / this.board.boardWidth, height / this.board.boardHeight);
    this.wrapper.scale.set(scale);
    this.wrapper.position.set(
      (width - this.board.boardWidth * scale) / 2,
      (height - this.board.boardHeight * scale) / 2,
    );
  }
}
