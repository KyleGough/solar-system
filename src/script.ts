import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "lil-gui";
import planetData from "./planets.json";
import { PlanetaryObject } from "./planetary-object";
import { createPath } from "./path";

export type SolarSystem = Record<string, PlanetaryObject>;

THREE.ColorManagement.enabled = false;

// Debug
const gui = new dat.GUI();

// Canvas
const canvas = document.querySelector("canvas.webgl") as HTMLElement;

// Scene
const scene = new THREE.Scene();

// Ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.33);
const ambientFolder = gui.addFolder("Ambient Light");
ambientFolder.add(ambientLight, "intensity").min(0).max(1).step(0.001);
scene.add(ambientLight);

// Point Light.
const pointLight = new THREE.PointLight(0xf4e99b, 1);

// Point Light Shadow.
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 1024;
pointLight.shadow.mapSize.height = 1024;
pointLight.shadow.camera.near = 0.1;
pointLight.shadow.camera.far = 50;

// Point Light Helper.
const pointLightHelper = new THREE.CameraHelper(pointLight.shadow.camera);
pointLightHelper.visible = false;
scene.add(pointLight, pointLightHelper);

const solarSystem: SolarSystem = {};

for (const planet of planetData) {
  const name = planet.name;
  solarSystem[name] = new PlanetaryObject(
    planet.radius,
    planet.distance,
    planet.period,
    planet.daylength,
    planet.texture,
    planet.orbits,
    planet.type
  );
  scene.add(solarSystem[name].mesh);

  if (planet.type === "planet") {
    const path = createPath(solarSystem[name].distance);
    // scene.add(path);
  }
}

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

// Camera
const aspect = sizes.width / sizes.height;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.x = 0;
camera.position.y = 2;
camera.position.z = 2;
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});

renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Animate
const clock = new THREE.Clock();

(function tick() {
  const elapsedTime = clock.getElapsedTime();

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
