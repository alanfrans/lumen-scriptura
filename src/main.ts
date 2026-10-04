import "./style.css";
import { Game } from "./game";

const game = new Game(document.getElementById("game") as HTMLCanvasElement);
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
