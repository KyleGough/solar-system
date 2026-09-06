import * as dat from "lil-gui";
import { LAYERS } from "../constants";
import type { Lights } from "./lights";
import { isIntroActive } from "./loading";
import {
  DEFAULT_DISTANCE_EXPONENT,
  DEFAULT_RADIUS_EXPONENT,
} from "./scale";

export const BASE_SPEED = 0.125;
export const SPEED_STEPS = [1, 2, 5, 10, 20] as const;

export const options = {
  showPaths: true,
  focus: "Sun",
  clock: true,
  speed: 1,
  radiusExponent: DEFAULT_RADIUS_EXPONENT,
  distanceExponent: DEFAULT_DISTANCE_EXPONENT,
};

const formatSpeed = (speed: number) => `x${Number(speed)}`;

const nextSpeed = (current: number) => {
  const index = SPEED_STEPS.findIndex((step) => step === Number(current));
  return SPEED_STEPS[(index + 1) % SPEED_STEPS.length];
};

export const createGUI = (
  clock: THREE.Clock,
  camera: THREE.Camera,
  lights: Lights,
  onRideSpin?: (ride: boolean) => void
) => {
  const gui = new dat.GUI();

  gui.title("Simulation Controls");

  const setToggle = (button: HTMLElement, on: boolean) => {
    button.setAttribute("aria-pressed", String(on));
  };

  const syncRunButton = (running: boolean) => {
    const button = document.getElementById("btn-run");
    if (!button) return;
    setToggle(button, running);
    button.setAttribute(
      "aria-label",
      running ? "Pause simulation" : "Play simulation"
    );
    const label = button.querySelector(".hud-ctrl-label");
    if (label) {
      label.textContent = running ? "Pause" : "Play";
    }
  };

  const syncSpeedButton = () => {
    const button = document.getElementById("btn-speed");
    if (!button) return;
    const value = formatSpeed(options.speed);
    button.setAttribute("aria-label", `Simulation speed ${value}`);
    const readout = button.querySelector(".hud-ctrl-value");
    if (readout) {
      readout.textContent = value;
    }
  };

  const applyRunState = (running: boolean) => {
    options.clock = running;
    if (running) {
      clock.start();
    } else {
      clock.stop();
    }
    syncRunButton(running);
  };

  gui
    .add(options, "radiusExponent", DEFAULT_RADIUS_EXPONENT, 1, 0.01)
    .name("Size exponent");
  gui
    .add(options, "distanceExponent", 0.2, 1, 0.01)
    .name("Distance exponent");

  gui
    .add(lights.ambientLight, "intensity", 0, 1, 0.01)
    .name("Ambient");

  gui.hide();

  const runButton = document.getElementById("btn-run");
  runButton?.addEventListener("click", () => {
    if (isIntroActive()) return;
    applyRunState(!options.clock);
  });

  const speedButton = document.getElementById("btn-speed");
  speedButton?.addEventListener("click", () => {
    if (isIntroActive()) return;
    options.speed = nextSpeed(options.speed);
    syncSpeedButton();
  });

  const labelsButton = document.getElementById("btn-labels");
  labelsButton?.addEventListener("click", () => {
    if (isIntroActive()) return;
    camera.layers.toggle(LAYERS.POILabel);
    setToggle(labelsButton, camera.layers.isEnabled(LAYERS.POILabel));
  });

  const pathsButton = document.getElementById("btn-paths");
  pathsButton?.addEventListener("click", () => {
    if (isIntroActive()) return;
    options.showPaths = !options.showPaths;
    setToggle(pathsButton, options.showPaths);
  });

  const spinButton = document.getElementById("btn-spin");
  const settingsButton = document.getElementById("btn-settings");
  if (!import.meta.env.DEV) {
    spinButton?.remove();
    settingsButton?.remove();
  } else {
    if (spinButton) {
      spinButton.removeAttribute("hidden");
      spinButton.addEventListener("click", () => {
        if (isIntroActive()) return;
        const ride = spinButton.getAttribute("aria-pressed") !== "true";
        setToggle(spinButton, ride);
        onRideSpin?.(ride);
      });
    }
    if (settingsButton) {
      settingsButton.removeAttribute("hidden");
      settingsButton.addEventListener("click", () => {
        if (isIntroActive()) return;
        gui.show(gui._hidden);
        setToggle(settingsButton, !gui._hidden);
      });
    }
  }

  return gui;
};
