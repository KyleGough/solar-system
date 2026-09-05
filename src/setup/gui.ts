import * as dat from "lil-gui";
import { LAYERS } from "../constants";
import type { Lights } from "./lights";
import { isIntroActive } from "./loading";
import type { SolarSystem } from "./solar-system";
import type { AtmosphereGlowParams } from "./atmosphere-glow";

export const options = {
  showPaths: true,
  focus: "Sun",
  clock: true,
  speed: 0.125,
};

const GLOW_BODIES = ["Jupiter", "Titan", "Saturn", "Uranus"] as const;

const roundGlow = (n: number): number => Number(n.toFixed(4));

const glowJson = (params: AtmosphereGlowParams): string =>
  JSON.stringify(
    {
      color: params.color.map(roundGlow),
      mieColor: (params.mieColor ?? [1, 0.78, 0.48]).map(roundGlow),
      intensity: roundGlow(params.intensity),
      scale: roundGlow(params.scale),
      height: roundGlow(params.height),
      mie: roundGlow(params.mie ?? 0.3),
      scatter: roundGlow(params.scatter ?? 0),
    },
    null,
    2
  );

const addAtmosphereGlowControls = (gui: dat.GUI, solarSystem: SolarSystem) => {
  const root = gui.addFolder("Atmosphere Glow");

  for (const name of GLOW_BODIES) {
    const body = solarSystem[name];
    const params = body?.atmosphereGlowParams;
    if (!body || !params) continue;

    const folder = root.addFolder(name);
    const apply = () => body.applyAtmosphereGlow();

    folder.addColor(params, "color").name("Color").onChange(apply);
    folder.addColor(params, "mieColor").name("Mie color").onChange(apply);
    folder.add(params, "intensity", 0, 4, 0.01).name("Intensity").onChange(apply);
    folder.add(params, "scale", 0, 1.2, 0.0005).name("Scale").onChange(apply);
    folder.add(params, "height", 0, 0.5, 0.001).name("Height").onChange(apply);
    folder.add(params, "mie", 0, 2, 0.01).name("Mie").onChange(apply);
    folder.add(params, "scatter", 0, 1, 0.01).name("Scatter").onChange(apply);
    folder
      .add(
        {
          copyJson() {
            void navigator.clipboard.writeText(glowJson(params));
          },
        },
        "copyJson"
      )
      .name("Copy JSON");
    folder.close();
  }
};

export const createGUI = (
  clock: THREE.Clock,
  camera: THREE.Camera,
  lights: Lights,
  solarSystem: SolarSystem,
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

  const applyRunState = (running: boolean) => {
    options.clock = running;
    if (running) {
      clock.start();
    } else {
      clock.stop();
    }
    syncRunButton(running);
  };

  gui.add(options, "speed", 0, 5, 0.01).name("Speed");

  gui
    .add(lights.ambientLight, "intensity", 0, 1, 0.01)
    .name("Ambient");

  addAtmosphereGlowControls(gui, solarSystem);

  gui.hide();

  const runButton = document.getElementById("btn-run");
  runButton?.addEventListener("click", () => {
    if (isIntroActive()) return;
    applyRunState(!options.clock);
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
  spinButton?.addEventListener("click", () => {
    if (isIntroActive()) return;
    const ride = spinButton.getAttribute("aria-pressed") !== "true";
    setToggle(spinButton, ride);
    onRideSpin?.(ride);
  });

  const settingsButton = document.getElementById("btn-settings");
  if (!import.meta.env.DEV) {
    settingsButton?.remove();
  } else if (settingsButton) {
    settingsButton.removeAttribute("hidden");
    settingsButton.addEventListener("click", () => {
      if (isIntroActive()) return;
      gui.show(gui._hidden);
      setToggle(settingsButton, !gui._hidden);
    });
  }

  return gui;
};
