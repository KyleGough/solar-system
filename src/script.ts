import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import { createEnvironmentMap } from "./setup/environment-map";
import {
  applyShadowCasters,
  createLights,
  updateSunShadows,
} from "./setup/lights";
import { createStarfield } from "./setup/starfield";
import { createSolarSystem } from "./setup/solar-system";
import { createGUI, options } from "./setup/gui";
import { createPoiProbe } from "./setup/poi-probe";
import { isIntroActive, onIntroDismiss } from "./setup/loading";
import { updateIdentity } from "./setup/identity";
import { createBodyInfo, updateBodyInfo, updatePoiInfo } from "./setup/body-info";
import { createSelectiveBloom } from "./setup/bloom";
import { FocusTransition } from "./setup/focus-transition";
import { createBodyPicker } from "./setup/body-pick";
import { createOrbitalNav } from "./setup/orbital-nav";
import { updateOrbitTrails } from "./setup/orbit-trails";
import { setTrailResolution } from "./setup/path";
import {
  onFocusUrlChange,
  readFocusFromUrl,
  writeFocusToUrl,
} from "./setup/focus-url";
import { LAYERS } from "./constants";
import {
  applySceneScale,
  outerOrbitRadius,
  type ScaleState,
} from "./setup/scale";
import type { PointOfInterest } from "./setup/label";

THREE.ColorManagement.enabled = true;

// Canvas
const canvas = document.querySelector("canvas.webgl") as HTMLElement;
const hudEndEl = document.querySelector(".hud-end") as HTMLElement;
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
const lights = createLights();
scene.add(
  lights.ambientLight,
  lights.pointLight,
  lights.spotLight,
  lights.shadowTarget
);

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update cameras. OrbitControls drives fakeCamera; copy() would otherwise
  // restore the aspect from when the clone was made.
  const aspect = sizes.width / sizes.height;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  fakeCamera.aspect = aspect;
  fakeCamera.updateProjectionMatrix();

  // Update renderers
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  setTrailResolution(sizes.width, sizes.height);
  selectiveBloom.setSize(sizes.width, sizes.height);
  labelRenderer.setSize(sizes.width, sizes.height);
});

// Solar system
const solarSystem = createSolarSystem(scene);
applyShadowCasters(solarSystem);
const urlFocus = readFocusFromUrl();
if (urlFocus) {
  options.focus = urlFocus;
}

applySceneScale(solarSystem, {
  radiusExponent: options.radiusExponent,
  distanceExponent: options.distanceExponent,
  focus: options.focus,
  flight: null,
});
updateIdentity(options.focus);
updateBodyInfo(options.focus);

// Camera
const aspect = sizes.width / sizes.height;
const MAX_CAMERA_DISTANCE = 50;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.008, 1000);
camera.position.set(0, MAX_CAMERA_DISTANCE, 0);
camera.layers.enable(LAYERS.POILabel);
camera.layers.enable(LAYERS.SUN_SPOT);
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
controls.maxDistance = MAX_CAMERA_DISTANCE;

const focusTransition = new FocusTransition(
  scene,
  camera,
  fakeCamera,
  controls,
  solarSystem
);

const currentScaleState = (dt = 0): ScaleState => ({
  radiusExponent: options.radiusExponent,
  distanceExponent: options.distanceExponent,
  focus: options.focus,
  flight: focusTransition.travelScale(dt),
});

const fitCameraToScale = () => {
  const extent = outerOrbitRadius(solarSystem);
  const maxDistance = Math.max(MAX_CAMERA_DISTANCE, extent * 1.75);
  const far = Math.max(1000, extent * 8);
  controls.maxDistance = maxDistance;
  if (camera.far !== far) {
    camera.far = far;
    fakeCamera.far = far;
    camera.updateProjectionMatrix();
    fakeCamera.updateProjectionMatrix();
  }
};

fitCameraToScale();

const framed = {
  name: options.focus,
  radius: solarSystem[options.focus].getVisualRadius(),
};

const keepFocusFraming = () => {
  const body = solarSystem[options.focus];
  const radius = body.getVisualRadius();
  if (
    options.focus !== framed.name ||
    focusTransition.isActive() ||
    body.type === "star"
  ) {
    framed.name = options.focus;
    framed.radius = radius;
    return;
  }
  if (framed.radius > 1e-8 && Math.abs(radius - framed.radius) > 1e-8) {
    // Ride-spin parents the camera to the globe; mesh.scale already dollies.
    if (camera.parent !== body.mesh) {
      fakeCamera.position.multiplyScalar(radius / framed.radius);
    }
    controls.minDistance = body.getOrbitMinDistance(
      camera.parent === body.mesh
    );
  }
  framed.radius = radius;
};

const picker = createBodyPicker(camera, canvas, solarSystem);

// Assigned after helpers that close over this binding.
let poiProbe: ReturnType<typeof createPoiProbe>; // eslint-disable-line prefer-const

const swapFocusUi = (from: string, to: string) => {
  releasePoiSpin();
  solarSystem[from].labels.hidePOI();
  solarSystem[from].labels.setActive(null);
  solarSystem[to].labels.showPOI();
  solarSystem[to].labels.setActive(null);
  updateIdentity(to);
  updateBodyInfo(to);
  poiProbe?.sync();
};

const setUiOpacity = (opacity: number) => {
  hudEndEl.style.opacity = String(opacity);
};

// Assigned after requestFocus, which closes over this binding.
let orbitNav: ReturnType<typeof createOrbitalNav>; // eslint-disable-line prefer-const
let poiForcedSpin = false;

const spinButton = () => document.getElementById("btn-spin");

const setSpinPressed = (on: boolean) => {
  spinButton()?.setAttribute("aria-pressed", String(on));
};

const isSpinPressed = () => spinButton()?.getAttribute("aria-pressed") === "true";

const releasePoiSpin = () => {
  if (!poiForcedSpin) return;
  poiForcedSpin = false;
  setSpinPressed(false);
  focusTransition.setRideSpin(false, options.focus);
};

const restoreBodyHud = (name: string) => {
  releasePoiSpin();
  solarSystem[name].labels.setActive(null);
  updateIdentity(name);
  updateBodyInfo(name);
};

const selectPoi = (
  bodyName: string,
  poi: PointOfInterest,
  localPos: THREE.Vector3
) => {
  if (isIntroActive()) return;
  if (focusTransition.isTraveling()) return;

  focusTransition.panTo(bodyName, localPos);
  if (!isSpinPressed()) {
    poiForcedSpin = true;
    setSpinPressed(true);
    focusTransition.setRideSpin(true, bodyName);
  }
  solarSystem[bodyName].labels.setActive(poi.name);
  updateIdentity(bodyName, poi);
  updatePoiInfo(bodyName, poi);
};

const requestFocus = (name: string) => {
  if (!solarSystem[name]) {
    return;
  }
  if (name === options.focus && !focusTransition.isActive()) {
    restoreBodyHud(name);
    return;
  }
  if (focusTransition.destination() === name) {
    return;
  }

  const started = focusTransition.begin(options.focus, name);
  if (!started) {
    return;
  }

  releasePoiSpin();
  options.focus = name;
  canvas.style.cursor = "default";
  orbitNav.setFocus(name);
  writeFocusToUrl(name);
};

orbitNav = createOrbitalNav(orbitNavEl, requestFocus);
orbitNav.setFocus(options.focus);
createBodyInfo(
  canvas,
  orbitNavEl,
  (bodyName, poi) => {
    const localPos = solarSystem[bodyName].labels.positionOf(poi.name);
    if (!localPos) return;
    selectPoi(bodyName, poi, localPos);
  },
  () => restoreBodyHud(options.focus)
);

for (const [name, object] of Object.entries(solarSystem)) {
  object.tick(0);
  object.labels.onSelect = (poi, localPos) => selectPoi(name, poi, localPos);
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

  if (poiProbe?.isHovering(clientX, clientY)) {
    canvas.style.cursor = "crosshair";
    return;
  }

  const name = picker.pick(clientX, clientY);
  canvas.style.cursor = name ? "pointer" : "default";
};

const CLICK_DRAG_PX = 8;
let pointerDownX = 0;
let pointerDownY = 0;

canvas.addEventListener("pointermove", (event) => {
  onHoverPick(event.clientX, event.clientY);
});

canvas.addEventListener("pointerleave", () => {
  canvas.style.cursor = "default";
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  pointerDownX = event.clientX;
  pointerDownY = event.clientY;
});

canvas.addEventListener("click", (event) => {
  if (isIntroActive()) return;
  if (Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > CLICK_DRAG_PX) {
    return;
  }
  if (poiProbe?.isHovering(event.clientX, event.clientY)) {
    return;
  }
  const name = picker.pick(event.clientX, event.clientY);
  if (name) {
    requestFocus(name);
  }
});

// Label renderer
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(sizes.width, sizes.height);
labelRenderer.domElement.className = "poi-layer";
if (isIntroActive()) {
  labelRenderer.domElement.setAttribute("inert", "");
}
document.body.appendChild(labelRenderer.domElement);

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
setTrailResolution(sizes.width, sizes.height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const selectiveBloom = createSelectiveBloom(renderer, scene, camera, sizes);

// Animate
const clock = new THREE.Clock();
let elapsedTime = 0;
let lastWall = performance.now();

fakeCamera.layers.enable(LAYERS.POILabel);
fakeCamera.layers.enable(LAYERS.SUN_SPOT);

// GUI
const gui = createGUI(clock, fakeCamera, lights, (ride) => {
  poiForcedSpin = false;
  focusTransition.setRideSpin(ride, options.focus);
});
poiProbe = createPoiProbe(gui, camera, canvas, solarSystem, () => options.focus);
poiProbe.sync();

(function tick() {
  const wall = performance.now();
  const wallDt = Math.min(0.05, (wall - lastWall) / 1000);
  lastWall = wall;

  elapsedTime += clock.getDelta() * options.speed;

  applySceneScale(solarSystem, currentScaleState(wallDt));
  fitCameraToScale();
  keepFocusFraming();

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
        mode: "travel" as const,
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
  updateSunShadows(lights, solarSystem, options.focus, camera);
  starfield.position.copy(camera.getWorldPosition(starfieldCenter));

  updateOrbitTrails(solarSystem, wallDt, {
    showAll: options.showPaths,
    focus: options.focus,
    flying: frame.active && !frame.justFinished && frame.mode === "travel",
    from: frame.from,
    to: frame.to,
    justFinished: frame.justFinished && frame.mode === "travel",
  });

  if (
    frame.mode === "travel" &&
    (frame.justCrossedMidpoint || frame.justFinished)
  ) {
    swapFocusUi(frame.from, frame.to);
  }

  if (frame.active && !frame.justFinished && frame.mode === "travel") {
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

  poiProbe.update(camera);

  // Render
  selectiveBloom.render(solarSystem["Sun"].mesh);
  labelRenderer.render(scene, camera);

  window.requestAnimationFrame(tick);
})();
