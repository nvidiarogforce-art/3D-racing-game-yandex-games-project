import './style.css';
import { Game } from './game/Game';

const root = document.querySelector<HTMLElement>('#app')!;
let game: Game | undefined;

try {
  game = new Game(root);
  await game.init();
} catch (error) {
  game?.dispose();
  root.innerHTML =
    '<section class="fatal"><h1>Couldn’t start the engine.</h1><p id="error-message"></p><p>Use a browser with WebGL 2 and hardware acceleration enabled. Yandex builds must run on Yandex Games or use its SDK development server.</p><button id="retry">Try again</button></section>';
  document.querySelector('#error-message')!.textContent =
    error instanceof Error ? error.message : 'An unexpected startup error occurred.';
  document.querySelector('#retry')!.addEventListener('click', () => location.reload());
  console.error(error);
}

if (import.meta.hot) import.meta.hot.dispose(() => game?.dispose());
