import * as dat from "lil-gui";
import { SolarSystem } from "./solar-system";
import { LAYERS } from "../constants";
import { isIntroActive } from "./loading";

export const options = {
  showPaths: false,
  showMoons: true,
  focus: "Sun",
  clock: true,
  speed: 0.125,
};

export const createGUI = (
  ambientLight: THREE.AmbientLight,
  solarSystem: SolarSystem,
  clock: THREE.Clock,
  camera: THREE.Camera,
  onRideSpin?: (ride: boolean) => void
) => {
  const gui = new dat.GUI();

  gui.title("Simulation Controls");

  // Pause the simulation
  gui
    .add(options, "clock")
    .name("Run")
    .onChange((value: boolean) => {
      value ? clock.start() : clock.stop();
    });

  // Control the simulation speed
  gui.add(options, "speed", 0, 5, 0.01).name("Speed");

  gui.hide();

  const setToggle = (button: HTMLElement, on: boolean) => {
    button.setAttribute("aria-pressed", String(on));
    button.classList.toggle("is-active", on);
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

    for (const name in solarSystem) {
      const object = solarSystem[name];
      if (object.path) {
        object.path.visible = options.showPaths;
      }
    }
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
};
