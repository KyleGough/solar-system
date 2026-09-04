import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import { createEnvironmentMap } from "./setup/environment-map";
import { createLights } from "./setup/lights";
import { createStarfield } from "./setup/starfield";
import { createSolarSystem } from "./setup/solar-system";
import { createGUI, options } from "./setup/gui";
import { isIntroActive, onIntroDismiss } from "./setup/loading";
import { updateIdentity } from "./setup/identity";
import { createSelectiveBloom } from "./setup/bloom";
import { FocusTransition } from "./setup/focus-transition";
import { createBodyPicker } from "./setup/body-pick";
import { createOrbitalNav } from "./setup/orbital-nav";
import {
  onFocusUrlChange,
  readFocusFromUrl,
  writeFocusToUrl,
} from "./setup/focus-url";
import { LAYERS } from "./constants";

THREE.ColorManagement.enabled = false;

// Canvas
const canvas = document.querySelector("canvas.webgl") as HTMLElement;
const identityEl = document.querySelector(".identity") as HTMLElement;
const orbitNavEl = document.getElementById("orbit-nav") as HTMLElement;

// Scene
const scene = new THREE.Scene();

scene.background = createEnvironmentMap("./textures/environment");
const starfield = createStarfield();
scene.add(starfield);
const starfieldCenter = new THREE.Vector3();
const labelWorldPos = new THREE.Vector3();
const labelLocalPos = new THREE.Vector3();

// Lights
const [ambientLight, pointLight] = createLights();
scene.add(ambientLight, pointLight);

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderers
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  selectiveBloom.setSize(sizes.width, sizes.height);
  labelRenderer.setSize(sizes.width, sizes.height);
});

// Solar system
const solarSystem = createSolarSystem(scene);
const urlFocus = readFocusFromUrl();
if (urlFocus) {
  options.focus = urlFocus;
}
updateIdentity(options.focus);

// Camera
const aspect = sizes.width / sizes.height;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.008, 1000);
camera.position.set(0, 20, 0);
camera.layers.enable(LAYERS.POILabel);
scene.add(camera);

// Controls
const fakeCamera = camera.clone();
const controls = new OrbitControls(fakeCamera, canvas);
controls.target = new THREE.Vector3();
controls.enableDamping = true;
controls.enablePan = false;
controls.enabled = false;
onIntroDismiss(() => {
  controls.enabled = true;
});
controls.minDistance = solarSystem["Sun"].getMinDistance();
controls.maxDistance = 50;

const focusTransition = new FocusTransition(
  scene,
  camera,
  fakeCamera,
  controls,
  solarSystem
);

const picker = createBodyPicker(camera, canvas, solarSystem);

const swapFocusUi = (from: string, to: string) => {
  solarSystem[from].labels.hidePOI();
  solarSystem[to].labels.showPOI();
  updateIdentity(to);
};

const setUiOpacity = (opacity: number) => {
  identityEl.style.opacity = String(opacity);
};

let orbitNav: ReturnType<typeof createOrbitalNav>;

const requestFocus = (name: string) => {
  if (!solarSystem[name]) {
    return;
  }
  if (name === options.focus && !focusTransition.isActive()) {
    return;
  }
  if (focusTransition.destination() === name) {
    return;
  }

  const started = focusTransition.begin(options.focus, name);
  if (!started) {
    return;
  }

  options.focus = name;
  canvas.style.cursor = "default";
  orbitNav.setFocus(name);
  writeFocusToUrl(name);
};

orbitNav = createOrbitalNav(orbitNavEl, requestFocus);
orbitNav.setFocus(options.focus);

for (const object of Object.values(solarSystem)) {
  object.tick(0);
}

if (urlFocus) {
  focusTransition.snapTo(urlFocus);
  writeFocusToUrl(urlFocus);
}

solarSystem[options.focus].labels.showPOI();

onFocusUrlChange((name) => {
  if (isIntroActive()) return;
  requestFocus(name);
});

onIntroDismiss(() => {
  const pending = readFocusFromUrl();
  if (pending && pending !== options.focus) {
    requestFocus(pending);
  }
});

const onHoverPick = (clientX: number, clientY: number) => {
  if (isIntroActive()) return;
  if (focusTransition.isActive()) {
    canvas.style.cursor = "default";
    return;
  }

  const name = picker.pick(clientX, clientY);
  canvas.style.cursor = name ? "pointer" : "default";
};

canvas.addEventListener("pointermove", (event) => {
  onHoverPick(event.clientX, event.clientY);
});

canvas.addEventListener("pointerleave", () => {
  canvas.style.cursor = "default";
});

canvas.addEventListener("dblclick", (event) => {
  if (isIntroActive()) return;
  const name = picker.pick(event.clientX, event.clientY);
  if (name) {
    requestFocus(name);
  }
});

// Label renderer
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(sizes.width, sizes.height);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.left = "0";
labelRenderer.domElement.style.pointerEvents = "none";
document.body.appendChild(labelRenderer.domElement);

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});

renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const selectiveBloom = createSelectiveBloom(renderer, scene, camera, sizes);

// Animate
const clock = new THREE.Clock();
let elapsedTime = 0;
let lastWall = performance.now();

fakeCamera.layers.enable(LAYERS.POILabel);

// GUI
createGUI(ambientLight, solarSystem, clock, fakeCamera, (ride) => {
  focusTransition.setRideSpin(ride, options.focus);
});

(function tick() {
  const wall = performance.now();
  const wallDt = Math.min(0.05, (wall - lastWall) / 1000);
  lastWall = wall;

  elapsedTime += clock.getDelta() * options.speed;

  // Update the solar system objects
  for (const object of Object.values(solarSystem)) {
    object.tick(elapsedTime);
  }

  const wasFlying = focusTransition.isActive();
  const frame = wasFlying
    ? focusTransition.update(wallDt)
    : {
        active: false,
        progress: 1,
        from: "",
        to: "",
        justCrossedMidpoint: false,
        justFinished: false,
      };

  if (!focusTransition.isActive()) {
    focusTransition.follow(options.focus);
    camera.copy(fakeCamera);
  }
  // Keep updating while flying so leftover orbit damping decays instead of
  // applying as a snap when control is restored.
  controls.update();

  camera.updateMatrixWorld();
  starfield.position.copy(camera.getWorldPosition(starfieldCenter));

  if (frame.justCrossedMidpoint || frame.justFinished) {
    swapFocusUi(frame.from, frame.to);
  }

  if (frame.active && !frame.justFinished) {
    const fade =
      frame.progress < 0.5
        ? 1 - frame.progress / 0.5
        : (frame.progress - 0.5) / 0.5;
    setUiOpacity(fade);

    const labelBodyName = frame.progress < 0.5 ? frame.from : frame.to;
    const labelBody = solarSystem[labelBodyName];
    camera.getWorldPosition(labelWorldPos);
    labelLocalPos.copy(labelWorldPos);
    labelBody.mesh.worldToLocal(labelLocalPos);
    labelBody.labels.update(labelLocalPos, fade);
  } else {
    if (frame.justFinished) {
      setUiOpacity(1);
    }
    const labelBody = solarSystem[options.focus];
    camera.getWorldPosition(labelWorldPos);
    labelLocalPos.copy(labelWorldPos);
    labelBody.mesh.worldToLocal(labelLocalPos);
    labelBody.labels.update(labelLocalPos);
  }

  // Render
  selectiveBloom.render(solarSystem["Sun"].mesh);
  labelRenderer.render(scene, camera);

  window.requestAnimationFrame(tick);
})();
