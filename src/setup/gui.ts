import * as dat from "lil-gui";
import { LAYERS } from "../constants";
import type { Lights } from "./lights";
import { isIntroActive } from "./loading";

export const options = {
  showPaths: true,
  focus: "Sun",
  clock: true,
  speed: 0.125,
};

export const createGUI = (
  clock: THREE.Clock,
  camera: THREE.Camera,
  lights: Lights,
  onRideSpin?: (ride: boolean) => void
) => {
  const gui = new dat.GUI();

  gui.title("Simulation Controls");

  // Pause the simulation
  gui
    .add(options, "clock")
    .name("Run")
    .onChange((value: boolean) => {
      if (value) {
        clock.start();
      } else {
        clock.stop();
      }
    });

  // Control the simulation speed
  gui.add(options, "speed", 0, 5, 0.01).name("Speed");

  gui
    .add(lights.ambientLight, "intensity", 0, 1, 0.01)
    .name("Ambient");

  gui.hide();

  const setToggle = (button: HTMLElement, on: boolean) => {
    button.setAttribute("aria-pressed", String(on));
  };

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
  spinButton?.addEventListener("click", () => {
    if (isIntroActive()) return;
    const ride = spinButton.getAttribute("aria-pressed") !== "true";
    setToggle(spinButton, ride);
    onRideSpin?.(ride);
  });

  const settingsButton = document.getElementById("btn-settings");
  settingsButton?.addEventListener("click", () => {
    if (isIntroActive()) return;
    gui.show(gui._hidden);
    setToggle(settingsButton, !gui._hidden);
  });

  return gui;
};
