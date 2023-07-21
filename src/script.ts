import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "lil-gui";
import planetData from "./planets.json";
import { PlanetaryObject } from "./planetary-object";
import { SolarSystem, environmentMap } from "./utils";

THREE.ColorManagement.enabled = false;

// Debug
const gui = new dat.GUI();

// Canvas
const canvas = document.querySelector("canvas.webgl") as HTMLElement;

// Scene
const scene = new THREE.Scene();

// Environment map
scene.background = environmentMap;

// Ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
const ambientFolder = gui.addFolder("Ambient Light");
ambientFolder.add(ambientLight, "intensity", 0, 1, 0.001).name("Intensity");
scene.add(ambientLight);

// Point Light.
const pointLight = new THREE.PointLight(0xf4e99b, 1);
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 4096;
pointLight.shadow.mapSize.height = 4096;
pointLight.shadow.camera.near = 1.5;
pointLight.shadow.camera.far = 15;
pointLight.shadow.radius = 16;
scene.add(pointLight);

const solarSystem: SolarSystem = {};

for (const planet of planetData) {
  const name = planet.name;
  const object = new PlanetaryObject(
    planet.radius,
    planet.distance,
    planet.period,
    planet.daylength,
    planet.textures,
    planet.orbits,
    planet.type,
    planet.tilt
  );

  solarSystem[name] = object;
  scene.add(object.mesh);
  object.atmosphere.mesh && scene.add(object.atmosphere.mesh);
  object.path && scene.add(object.path);
}

const options = {
  showPaths: false,
  showMoons: true,
  focus: "Sun",
  clock: true,
  speed: 1,
};

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

const changeFocus = (value: string) => {
  const position = solarSystem[value].mesh.position;
  const targetRadius = solarSystem[value].radius;
  const signX = !position.x ? 0 : position.x / Math.abs(position.x);
  const signZ = !position.z ? 0 : position.z / Math.abs(position.z);
  controls.target = position;
  controls.minDistance = solarSystem[value].radius + 0.1;
  camera.position.x = position.x - signX * targetRadius * 2;
  camera.position.z = position.z - signZ * targetRadius * 2;
  (document.querySelector(".caption p") as HTMLElement).innerHTML = value;
};

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
    if (value) {
      clock.start();
    } else {
      clock.stop();
    }
  });

// Control the simulation speed
gui.add(options, "speed", 0.1, 20, 0.1).name("Speed");

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
  changeFocus(focus);
});

document.getElementById("btn-next")?.addEventListener("click", () => {
  const index = (planetNames.indexOf(options.focus) + 1) % planetNames.length;
  const focus = planetNames[index];
  options.focus = focus;
  changeFocus(focus);
});

// Camera
const aspect = sizes.width / sizes.height;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.x = 0;
camera.position.y = 2;
camera.position.z = 8;
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.target = solarSystem["Sun"].mesh.position;
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = solarSystem["Sun"].radius * 1.1;
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

(function tick() {
  elapsedTime += clock.getDelta() * options.speed;

  // Update the solar system objects
  for (const object of Object.values(solarSystem)) {
    object.tick(elapsedTime, solarSystem);
  }

  // Update controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
})();
