import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createEnvironmentMap } from "./setup/environment-map";
import { createLights } from "./setup/lights";
import { createSolarSystem } from "./setup/solar-system";
import { createGUI, options } from "./setup/gui";

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
const solarSystem = createSolarSystem(scene);

const planetNames = [
  "Sun",
  "Mercury",
  "Venus",
  "Earth",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
];

const controlMinDistance = (radius: number): number => {
  return 1.5 * (radius + 0.1);
};

const changeFocus = (oldFocus: string, newFocus: string) => {
  solarSystem[oldFocus].mesh.remove(camera);
  solarSystem[newFocus].mesh.add(camera);
  controls.minDistance = controlMinDistance(solarSystem[newFocus].radius);
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

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

document.getElementById("btn-previous")?.addEventListener("click", () => {
  const index = planetNames.indexOf(options.focus);
  const newIndex = index === 0 ? planetNames.length - 1 : index - 1;
  const focus = planetNames[newIndex];
  options.focus = focus;
  changeFocus(options.focus, focus);
});

document.getElementById("btn-next")?.addEventListener("click", () => {
  const index = (planetNames.indexOf(options.focus) + 1) % planetNames.length;
  const focus = planetNames[index];
  options.focus = focus;
  changeFocus(options.focus, focus);
});

// Camera
const aspect = sizes.width / sizes.height;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.x = 0;
camera.position.y = 2;
camera.position.z = 8;
solarSystem["Sun"].mesh.add(camera);

// Controls
const fakeCamera = camera.clone();
const controls = new OrbitControls(fakeCamera, canvas);
controls.target = solarSystem["Sun"].mesh.position;
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = controlMinDistance(solarSystem["Sun"].radius);
controls.maxDistance = 50;

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

// GUI
createGUI(ambientLight, solarSystem, clock);

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

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
})();
