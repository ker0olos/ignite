import { applySettings, loadSettings } from "./settings";
import { startTimer } from "./timer";
import "./styles.css";

applySettings(loadSettings());
startTimer(document.querySelector<HTMLElement>(".timer")!);
