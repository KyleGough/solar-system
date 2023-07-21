import * as dat from "lil-gui";
import { SolarSystem } from "./solar-system";

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
  clock: THREE.Clock
) => {
  const gui = new dat.GUI();

  // Adjust ambient light intensity
  gui.add(ambientLight, "intensity", 0, 1, 0.001).name("Ambient Intensity");

  // Toggle planetary paths
  gui
    .add(options, "showPaths")
    .name("Show Paths")
    .onChange((value: boolean) => {
      for (const name in solarSystem) {
        const object = solarSystem[name];
        if (object.path) {
          object.path.visible = value;
        }
      }
    });

  // Toggle moons
  gui
    .add(options, "showMoons")
    .name("Show Moons")
    .onChange((value: boolean) => {
      for (const name in solarSystem) {
        const object = solarSystem[name];
        if (object.type === "moon") {
          object.mesh.visible = value;
        }
      }
    });

  // Pause the simulation
  gui
    .add(options, "clock")
    .name("Run")
    .onChange((value: boolean) => {
      value ? clock.start() : clock.stop();
    });

  // Control the simulation speed
  gui.add(options, "speed", 0.1, 20, 0.1).name("Speed");
};
