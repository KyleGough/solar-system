import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "lil-gui";

interface Planet {
  radius: number; // (in kilometers)
  distance: number; // (in million kilometers)
  period: number; // (in days)
  daylength: number; // (in hours)
  texture: THREE.Texture;
  isSun?: boolean;
}

interface Moon extends Planet {
  orbits: THREE.Mesh;
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

const moonTexture = loader.load("/textures/moon.jpg");
const saturnRingTexture = loader.load("/textures/saturn-ring.png");

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

const createPlanetMesh = (planet: Planet) => {
  const geometry = new THREE.SphereGeometry(
    Math.sqrt(planet.radius) / 500,
    32,
    32
  );
  let material;
  if (planet.isSun) {
    material = new THREE.MeshBasicMaterial({ map: planet.texture });
  } else {
    material = new THREE.MeshPhongMaterial({ map: planet.texture });
    material.shininess = 10;
  }
  const sphere = new THREE.Mesh(geometry, material);
  sphere.receiveShadow = true;
  return sphere;
};

// Planets
const planets: Planet[] = [
  {
    radius: 432000,
    distance: 0,
    period: 1,
    daylength: 24 * 25,
    texture: sunTexture,
    isSun: true,
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

const planetMeshes = planets.map((planet) => createPlanetMesh(planet));
scene.add(...planetMeshes);

// Moons
const moons: Moon[] = [
  {
    radius: 1737,
    distance: 0.38,
    period: 28,
    daylength: 28,
    texture: moonTexture,
    orbits: planetMeshes[3],
  },
];

const moonMeshes = moons.map((moon) => createPlanetMesh(moon));
scene.add(...moonMeshes);

// Saturn's rings
const ringGeometry = new THREE.RingGeometry(0.2, 2, 64);
const pos = ringGeometry.attributes.position;
const v3 = new THREE.Vector3();
for (let i = 0; i < pos.count; i++) {
  v3.fromBufferAttribute(pos, i);
  ringGeometry.attributes.uv.setXY(i, v3.length() < 1 ? 0 : 1, 1);
}
const ringMaterial = new THREE.MeshPhongMaterial({
  map: saturnRingTexture,
  side: THREE.DoubleSide,
  transparent: true,
});
const saturnsRings = new THREE.Mesh(ringGeometry, ringMaterial);
saturnsRings.receiveShadow = true;
saturnsRings.position.y = planetMeshes[6].position.y;
saturnsRings.rotation.x = Math.PI / 2;
scene.add(saturnsRings);

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

const rngStartsPlanets = planets.map((_) => Math.random() * 2 * Math.PI);
const rngStartsMoons = moons.map((_) => Math.random() * 2 * Math.PI);

const rotationFactor = Math.PI * 2 * 24; // 1 second = 24 hours

const getRelativeRadius = (distance: number): number =>
  Math.pow(distance, 0.4) / 2;

const getRelativeSpeed = (period: number): number => 200 / period;

(function tick() {
  const elapsedTime = clock.getElapsedTime();

  // Update the planets
  for (let i = 0; i < planets.length; i++) {
    const relativeRadius = getRelativeRadius(planets[i].distance);
    const relativeSpeed = getRelativeSpeed(planets[i].period);
    const elapsedDistance = rngStartsPlanets[i] + elapsedTime * relativeSpeed;
    planetMeshes[i].position.x = Math.cos(elapsedDistance) * relativeRadius;
    planetMeshes[i].position.z = -Math.sin(elapsedDistance) * relativeRadius;
    planetMeshes[i].rotation.y =
      (rotationFactor * elapsedTime) / planets[i].daylength;
  }

  // Update the moons
  for (let i = 0; i < moons.length; i++) {
    const relativeRadius = getRelativeRadius(moons[i].distance);
    const relativeSpeed = getRelativeSpeed(moons[i].period);
    const elapsedDistance = rngStartsMoons[i] + elapsedTime * relativeSpeed;
    moonMeshes[i].position.x =
      moons[i].orbits.position.x + Math.cos(elapsedDistance) * relativeRadius;
    moonMeshes[i].position.z =
      moons[i].orbits.position.z - Math.sin(elapsedDistance) * relativeRadius;
    moonMeshes[i].rotation.y =
      (rotationFactor * elapsedTime) / moons[i].daylength;
  }

  // Update Saturn's rings
  saturnsRings.position.x = planetMeshes[6].position.x;
  saturnsRings.position.z = planetMeshes[6].position.z;
  saturnsRings.rotation.z =
    (rotationFactor * elapsedTime) / planets[6].daylength;

  // Update controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
})();
