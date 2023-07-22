import * as dat from "lil-gui";
import { SolarSystem } from "./solar-system";

export const options = {
  showPaths: false,
  showMoons: true,
  focus: "Sun",
  clock: true,
  speed: 0.125,
  zangle: 0,
  yangle: 0,
  showLabels: true,
};

export const createGUI = (
  ambientLight: THREE.AmbientLight,
  solarSystem: SolarSystem,
  clock: THREE.Clock,
  camera: THREE.Camera
) => {
  const gui = new dat.GUI();

  gui.title("Simulation Controls");

  gui
    .add(options, "showLabels")
    .name("Show Labels")
    .onChange(() => {
      camera.layers.toggle(2);
    });

  // TODO TEMP
  gui.add(options, "zangle", -Math.PI, Math.PI, 0.002);
  gui.add(options, "yangle", -Math.PI, Math.PI, 0.002);

  // Adjust ambient light intensity
  gui.add(ambientLight, "intensity", 0, 0.5, 0.001).name("Ambient Intensity");

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

  document.getElementById("btn-settings")?.addEventListener("click", () => {
    const controls = document.getElementsByClassName(
      "lil-gui"
    )[0] as HTMLElement;
    controls.style.display =
      controls.style.display === "none" ? "flex" : "none";
  });
};
