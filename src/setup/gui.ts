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

  document.getElementById("btn-labels")?.addEventListener("click", () => {
    if (isIntroActive()) return;
    camera.layers.toggle(LAYERS.POILabel);
  });

  document.getElementById("btn-paths")?.addEventListener("click", () => {
    if (isIntroActive()) return;
    options.showPaths = !options.showPaths;

    for (const name in solarSystem) {
      const object = solarSystem[name];
      if (object.path) {
        object.path.visible = options.showPaths;
      }
    }
  });

  const spinButton = document.getElementById("btn-spin");
  if (spinButton) {
    spinButton.addEventListener("click", () => {
      if (isIntroActive()) return;
      const ride = spinButton.getAttribute("aria-pressed") !== "true";
      spinButton.setAttribute("aria-pressed", String(ride));
      spinButton.classList.toggle("is-active", ride);
      onRideSpin?.(ride);
    });
  }

  // Toggle GUI panel
  document.getElementById("btn-settings")?.addEventListener("click", () => {
    if (isIntroActive()) return;
    gui.show(gui._hidden);
  });
};
