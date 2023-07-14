import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "lil-gui";

interface Planet {
  radius: number; // (in kilometers)
  distance: number; // (in million kilometers)
  period: number; // (in days)
  daylength: number; // (in hours)
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
const sunTexture = loader.load("/textures/sun.jpg");
const mercuryTexture = loader.load("/textures/mercury.jpg");
const venusTexture = loader.load("/textures/venus.jpg");
const earthTexture = loader.load("/textures/earth.jpg");
const marsTexture = loader.load("/textures/mars.jpg");
const jupiterTexture = loader.load("/textures/jupiter.jpg");
const saturnTexture = loader.load("/textures/saturn.jpg");
const uranusTexture = loader.load("/textures/uranus.jpg");
const neptuneTexture = loader.load("/textures/neptune.jpg");

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

const planets: Planet[] = [
  {
    radius: 432000,
    distance: 0,
    period: 1,
    daylength: 24,
    texture: sunTexture,
  }, // Sun
  {
    radius: 1516,
    distance: 56,
    period: 88,
    daylength: 4222.6,
    texture: mercuryTexture,
  }, // Mercury
  {
    radius: 3760,
    distance: 108,
    period: 224,
    daylength: 2802,
    texture: venusTexture,
  }, // Venus
  {
    radius: 3959,
    distance: 152,
    period: 365,
    daylength: 24,
    texture: earthTexture,
  }, // Earth
  {
    radius: 2106,
    distance: 247,
    period: 686,
    daylength: 24.7,
    texture: marsTexture,
  }, // Mars
  {
    radius: 43441,
    distance: 741,
    period: 4332,
    daylength: 9.9,
    texture: jupiterTexture,
  }, // Jupiter
  {
    radius: 36184,
    distance: 1463,
    period: 10755,
    daylength: 10.7,
    texture: saturnTexture,
  }, // Saturn
  {
    radius: 15759,
    distance: 2938,
    period: 30687,
    daylength: 17.2,
    texture: uranusTexture,
  }, // Uranus
  {
    radius: 15299,
    distance: 4474,
    period: 60190,
    daylength: 16.1,
    texture: neptuneTexture,
  }, // Neptune
];

// Mesh creation.
const meshes = planets.map((planet) =>
  createPlanetMesh(planet.radius, planet.texture)
);
scene.add(...meshes);

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

const rotationFactor = Math.PI * 2 * 24; // 1 second = 24 hours

(function tick() {
  const elapsedTime = clock.getElapsedTime();

  // Update the planets
  for (let i = 0; i < planets.length; i++) {
    const relativeRadius = Math.sqrt(planets[i].distance) / 2;
    const relativeSpeed = 1000 / planets[i].period;
    const elapsedDistance = randomStarts[i] + elapsedTime * relativeSpeed;
    meshes[i].position.x = Math.cos(elapsedDistance) * relativeRadius;
    meshes[i].position.z = -Math.sin(elapsedDistance) * relativeRadius;

    meshes[i].rotation.y =
      (rotationFactor * elapsedTime) / planets[i].daylength;
  }

  // Update controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
})();
