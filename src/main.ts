import "./style.css";
import "./challenge/selfcheck";
import { Game } from "./game";

const game = new Game(document.getElementById("game") as HTMLCanvasElement);
// `window.game` is the canvas, because that element has id="game".
if (import.meta.env.DEV) (window as unknown as { lumen: Game }).lumen = game;
