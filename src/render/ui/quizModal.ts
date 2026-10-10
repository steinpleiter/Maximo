import type { QuizPrompt } from '../../math/types';
import { delay } from '../tween';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * The quiz modal — the centre of the whole game.
 *
 * It takes over while a duel is pending and resolves with the chosen option.
 * There is deliberately no timer: the player thinks for as long as they like,
 * which also means autoplay has to stop here, and it does.
 */
export class QuizModal {
  private readonly layer: HTMLElement;

  constructor(layer: HTMLElement) {
    this.layer = layer;
  }

  /**
   * Shows the question and resolves with the index the player picked.
   *
   * `correctIndex` is supplied by the shell rather than carried on the prompt:
   * the engine never tells its host the answer, which is what keeps the math
   * movable to a server later without handing the client a cheat sheet.
   */
  ask(prompt: QuizPrompt, correctIndex: number): Promise<number> {
    return new Promise((resolve) => {
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', 'Duel question');

      const duelists = prompt.duelists
        .map((d) => `<span class="duelist ${d.isBandit ? 'bandit' : d.color}"></span>`)
        .join('<span class="duel-vs">vs</span>');

      panel.innerHTML = `
        <p class="sub">${escape(prompt.category)} · ${
          prompt.versusBandit ? 'Bandit stand-off' : 'Showdown'
        }</p>
        <div class="quiz-duelists">${duelists}</div>
        <h2 class="quiz-question">${escape(prompt.question)}</h2>
        <div class="quiz-options"></div>
        <p class="quiz-stake${prompt.versusBandit ? ' bandit' : ''}"></p>
      `;

      const stake = panel.querySelector('.quiz-stake') as HTMLElement;
      stake.textContent = prompt.versusBandit
        ? 'Answer correctly and the bird takes back everything the bandit stole. Get it wrong and the bandit wins this one.'
        : 'Answer correctly and the showdown fires. Get it wrong and they stand down.';

      const options = panel.querySelector('.quiz-options') as HTMLElement;
      const buttons: HTMLButtonElement[] = [];

      prompt.options.forEach((text, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quiz-option';
        button.innerHTML = `<span class="key">${KEYS[index] ?? index + 1}</span><span class="text"></span>`;
        (button.querySelector('.text') as HTMLElement).textContent = text;
        button.addEventListener('click', () => choose(index));
        options.appendChild(button);
        buttons.push(button);
      });

      const onKey = (event: KeyboardEvent) => {
        const index = KEYS.indexOf(event.key.toUpperCase());
        if (index >= 0 && index < buttons.length) {
          event.preventDefault();
          choose(index);
          return;
        }
        const digit = Number(event.key);
        if (Number.isInteger(digit) && digit >= 1 && digit <= buttons.length) {
          event.preventDefault();
          choose(digit - 1);
        }
      };

      let answered = false;
      const choose = async (index: number) => {
        if (answered) return;
        answered = true;
        window.removeEventListener('keydown', onKey);

        // Show what was right before clearing, so a wrong answer still teaches.
        for (const [i, button] of buttons.entries()) {
          button.disabled = true;
          if (i === correctIndex) button.classList.add('correct');
          else if (i === index) button.classList.add('incorrect');
        }

        await delay(index === correctIndex ? 450 : 900);
        this.close();
        resolve(index);
      };

      window.addEventListener('keydown', onKey);
      this.layer.replaceChildren(panel);
      this.layer.hidden = false;
      buttons[0]?.focus();
    });
  }

  private close(): void {
    this.layer.hidden = true;
    this.layer.replaceChildren();
  }
}

function escape(text: string): string {
  const node = document.createElement('div');
  node.textContent = text;
  return node.innerHTML;
}
