import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "lil-gui";

interface Planet {
  radius: number; // (in kilometers)
  distance: number; // (in million kilometers)
  period: number; // (in days)
  texture?: THREE.Texture;
}

THREE.ColorManagement.enabled = false;

// Debug
const gui = new dat.GUI();

// Canvas
const canvas = document.querySelector("canvas.webgl") as HTMLElement;

// Scene
const scene = new THREE.Scene();

// Textures
const loader = new THREE.TextureLoader();
const jupiterTexture = loader.load("/textures/jupiter.jpg");

// Ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
const ambientFolder = gui.addFolder("Ambient Light");
ambientFolder.add(ambientLight, "intensity").min(0).max(1).step(0.001);
scene.add(ambientLight);

// Point Light.
const pointLight = new THREE.PointLight(0xf4e99b, 0.8);

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

// Material
const material = new THREE.MeshStandardMaterial();
material.roughness = 0.7;
const materialFolder = gui.addFolder("Material");
materialFolder.add(material, "metalness").min(0).max(1).step(0.001);
materialFolder.add(material, "roughness").min(0).max(1).step(0.001);

const createPlanetMesh = (radius: number, texture?: any) => {
  const geometry = new THREE.SphereGeometry(Math.sqrt(radius) / 500, 32, 32);
  const tex = new THREE.MeshBasicMaterial({ map: texture });
  const sphere = new THREE.Mesh(geometry, texture ? tex : material);
  return sphere;
};

const meshes: THREE.Mesh[] = [];
const planets: Planet[] = [
  { radius: 432000, distance: 0, period: 1 }, // Sun
  { radius: 1516, distance: 56, period: 88 }, // Mercury
  { radius: 3760, distance: 108, period: 224 }, // Venus
  { radius: 3959, distance: 152, period: 365 }, // Earth
  { radius: 2106, distance: 247, period: 686 }, // Mars
  {
    radius: 43441,
    distance: 741,
    period: 4332,
    texture: jupiterTexture,
  }, // Jupiter
  { radius: 36184, distance: 1463, period: 10755 }, // Saturn
  { radius: 15759, distance: 2938, period: 30687 }, // Uranus
  { radius: 15299, distance: 4474, period: 60190 }, // Neptune
];

// Mesh creation.
for (const planet of planets) {
  meshes.push(createPlanetMesh(planet.radius, planet.texture));
}

scene.add(...meshes);

// Plane
const plane = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), material);
plane.rotation.x = -Math.PI * 0.5;
plane.position.y = -0.5;
plane.receiveShadow = true;
// scene.add(plane);

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

const cameraHelper = new THREE.CameraHelper(camera);

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

const randomStarts = planets.map((_) => Math.random() * 2 * Math.PI);

(function tick() {
  const elapsedTime = clock.getElapsedTime();

  // Update the planets
  for (let i = 0; i < planets.length; i++) {
    const relativeRadius = Math.sqrt(planets[i].distance) / 2;
    const relativeSpeed = 100 / Math.sqrt(planets[i].period);
    const elapsedDistance = randomStarts[i] + elapsedTime * relativeSpeed;
    meshes[i].position.x = Math.cos(elapsedDistance) * relativeRadius;
    meshes[i].position.z = -Math.sin(elapsedDistance) * relativeRadius;
  }

  // Update controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
})();
