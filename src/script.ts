import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import { createEnvironmentMap } from "./setup/environment-map";
import { createLights } from "./setup/lights";
import { createSolarSystem } from "./setup/solar-system";
import { createGUI, options } from "./setup/gui";
import { createLabel, getLabelOpacity, rotateLabel } from "./setup/label";

THREE.ColorManagement.enabled = false;

// Canvas
const canvas = document.querySelector("canvas.webgl") as HTMLElement;

// Scene
const scene = new THREE.Scene();

// Environment map
scene.background = createEnvironmentMap("/textures/environment");

// Lights
const [ambientLight, pointLight] = createLights();
scene.add(ambientLight, pointLight);

// Solar system
const [solarSystem, planetNames] = createSolarSystem(scene);

const changeFocus = (oldFocus: string, newFocus: string) => {
  solarSystem[oldFocus].mesh.remove(camera);
  solarSystem[newFocus].mesh.add(camera);
  const minDistance = solarSystem[newFocus].getMinDistance();
  controls.minDistance = minDistance;
  fakeCamera.position.set(minDistance, minDistance / 3, 0);
  solarSystem[oldFocus].hideLabels();
  solarSystem[newFocus].showLabels();
  (document.querySelector(".caption p") as HTMLElement).innerHTML = newFocus;
};

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
  labelRenderer.setSize(sizes.width, sizes.height);
});

document.getElementById("btn-previous")?.addEventListener("click", () => {
  const index = planetNames.indexOf(options.focus);
  const newIndex = index === 0 ? planetNames.length - 1 : index - 1;
  const focus = planetNames[newIndex];
  changeFocus(options.focus, focus);
  options.focus = focus;
});

document.getElementById("btn-next")?.addEventListener("click", () => {
  const index = (planetNames.indexOf(options.focus) + 1) % planetNames.length;
  const focus = planetNames[index];
  changeFocus(options.focus, focus);
  options.focus = focus;
});

// Camera
const aspect = sizes.width / sizes.height;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.set(0, 20, 0);
solarSystem["Sun"].mesh.add(camera);

// Controls
const fakeCamera = camera.clone();
const controls = new OrbitControls(fakeCamera, canvas);
controls.target = solarSystem["Sun"].mesh.position;
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = solarSystem["Sun"].getMinDistance();
controls.maxDistance = 50;

// Label renderer
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(sizes.width, sizes.height);
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

// Animate
const clock = new THREE.Clock();
let elapsedTime = 0;

fakeCamera.layers.enable(2);

// GUI
createGUI(ambientLight, solarSystem, clock, fakeCamera);

(function tick() {
  elapsedTime += clock.getDelta() * options.speed;

  // Update the solar system objects
  for (const object of Object.values(solarSystem)) {
    object.tick(elapsedTime);
  }

  // Update camera
  camera.copy(fakeCamera);

  // Update controls
  controls.update();

  // Update labels
  const currentBody = solarSystem[options.focus];
  currentBody.labels.forEach((l) => {
    l.container.style.opacity = getLabelOpacity(
      fakeCamera,
      l.label,
      currentBody.radius
    ).toString();
  });

  // Render
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
})();
