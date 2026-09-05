import * as THREE from "three";
import { RING_OUTER } from "./rings";
import type { SolarSystem } from "./solar-system";
import { LAYERS } from "../constants";

const SHADOW_MAP_SIZE = 2048;
const SHADOW_MAP_SIZE_TRANSIT = 4096;
/** Last heliocentric body that still gets a fitted shadow frustum. */
const SHADOW_LIMIT_BODY = "Saturn";
const FRUSTUM_PADDING = 1.65;
const TRANSIT_MAP_DISTANCE = 6;
const SUN_INTENSITY = 1;

const hostWorld = new THREE.Vector3();
const cameraWorld = new THREE.Vector3();

let layeredHost: string | null = null;

export type Lights = {
  ambientLight: THREE.AmbientLight;
  pointLight: THREE.PointLight;
  spotLight: THREE.SpotLight;
  shadowTarget: THREE.Object3D;
};

export const createLights = (): Lights => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.02);
  ambientLight.layers.enable(0);
  ambientLight.layers.enable(LAYERS.SUN_SPOT);

  // Omnidirectional fill. Shadowing is the spotlight’s job: a point-light
  // cubemap cannot tighten around one planet, and VSM does not run on it.
  const pointLight = new THREE.PointLight(0xffffff, SUN_INTENSITY);
  pointLight.castShadow = false;
  pointLight.layers.set(0);

  const shadowTarget = new THREE.Object3D();
  shadowTarget.name = "sun-shadow-target";

  const spotLight = new THREE.SpotLight(0xffffff, 0);
  spotLight.name = "sun-shadow";
  spotLight.position.set(0, 0, 0);
  spotLight.target = shadowTarget;
  spotLight.castShadow = false;
  spotLight.penumbra = 0.25;
  spotLight.layers.set(LAYERS.SUN_SPOT);
  spotLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  spotLight.shadow.bias = -0.0002;
  spotLight.shadow.normalBias = 0.02;
  spotLight.shadow.radius = 4;
  spotLight.shadow.blurSamples = 8;

  return { ambientLight, pointLight, spotLight, shadowTarget };
};

const hostNameOf = (name: string, solarSystem: SolarSystem): string => {
  const body = solarSystem[name];
  if (body?.orbits && body.orbits !== "Sun") {
    return body.orbits;
  }
  return name;
};

const heliocentricDistance = (
  name: string,
  solarSystem: SolarSystem
): number => {
  const hostName = hostNameOf(name, solarSystem);
  const host = solarSystem[hostName];
  if (!host || hostName === "Sun") {
    return 0;
  }
  return host.distance;
};

/**
 * Radius of the local system that must fit in the shadow frustum: globe,
 * rings, and moons.
 */
const localCastRadius = (hostName: string, solarSystem: SolarSystem): number => {
  const host = solarSystem[hostName];
  let radius = host.radius;

  for (const child of Object.values(solarSystem)) {
    if (child.orbits !== hostName) {
      continue;
    }
    if (child.type === "ring") {
      radius = Math.max(radius, host.radius * RING_OUTER);
    } else {
      radius = Math.max(radius, child.distance + child.radius);
    }
  }

  return radius;
};

const hasTransitCasters = (
  hostName: string,
  solarSystem: SolarSystem
): boolean => {
  return Object.values(solarSystem).some(
    (body) => body.orbits === hostName && body.type === "moon"
  );
};

const setShadowMapSize = (light: THREE.SpotLight, size: number) => {
  if (light.shadow.mapSize.width === size) {
    return;
  }
  light.shadow.mapSize.set(size, size);
  if (light.shadow.map) {
    light.shadow.map.dispose();
    light.shadow.map = null;
  }
  light.shadow.needsUpdate = true;
};

const forLocalMeshes = (
  solarSystem: SolarSystem,
  hostName: string,
  visit: (mesh: THREE.Mesh) => void
) => {
  const visitMesh = (object: THREE.Object3D) => {
    if ((object as THREE.Mesh).isMesh) {
      visit(object as THREE.Mesh);
    }
  };

  solarSystem[hostName].origin.traverse(visitMesh);
};

const setSpotLit = (
  solarSystem: SolarSystem,
  hostName: string,
  enabled: boolean
) => {
  forLocalMeshes(solarSystem, hostName, (mesh) => {
    if (enabled) {
      mesh.layers.enable(LAYERS.SUN_SPOT);
      mesh.layers.disable(0);
    } else {
      mesh.layers.disable(LAYERS.SUN_SPOT);
      mesh.layers.enable(0);
    }
  });
};

const assignSpotLayers = (solarSystem: SolarSystem, hostName: string | null) => {
  if (layeredHost === hostName) {
    return;
  }
  if (layeredHost && solarSystem[layeredHost]) {
    setSpotLit(solarSystem, layeredHost, false);
  }
  layeredHost = hostName;
  if (hostName && solarSystem[hostName]) {
    setSpotLit(solarSystem, hostName, true);
  }
};

/**
 * Turn off casters past Saturn (Uranus, Neptune, Triton). Rings do not
 * cast or receive the sun shadow map.
 */
export const applyShadowCasters = (solarSystem: SolarSystem) => {
  const limit = solarSystem[SHADOW_LIMIT_BODY].distance;

  for (const [name, body] of Object.entries(solarSystem)) {
    if (body.type === "ring") {
      body.mesh.castShadow = false;
      body.mesh.receiveShadow = false;
      continue;
    }
    const enabled =
      body.type !== "star" && heliocentricDistance(name, solarSystem) <= limit;
    body.mesh.castShadow = enabled;
    body.mesh.receiveShadow = enabled;
  }
};

/**
 * Aim the sun spotlight at the focused planet (or its host) and clip the
 * shadow camera to that local system. Outer-planet and Sun focus fall back
 * to unshadowed fill lighting.
 */
export const updateSunShadows = (
  lights: Lights,
  solarSystem: SolarSystem,
  focusName: string,
  camera: THREE.Camera
) => {
  const { pointLight, spotLight, shadowTarget } = lights;
  const limit = solarSystem[SHADOW_LIMIT_BODY].distance;
  const hostName = hostNameOf(focusName, solarSystem);
  const host = solarSystem[hostName];
  const inRange =
    Boolean(host) &&
    hostName !== "Sun" &&
    heliocentricDistance(hostName, solarSystem) <= limit;

  if (!inRange || !host) {
    assignSpotLayers(solarSystem, null);
    spotLight.visible = false;
    spotLight.castShadow = false;
    spotLight.intensity = 0;
    pointLight.intensity = SUN_INTENSITY;
    return;
  }

  host.mesh.getWorldPosition(hostWorld);
  const dist = hostWorld.length();
  if (dist < 1e-4) {
    assignSpotLayers(solarSystem, null);
    spotLight.visible = false;
    spotLight.castShadow = false;
    spotLight.intensity = 0;
    pointLight.intensity = SUN_INTENSITY;
    return;
  }

  const radius = localCastRadius(hostName, solarSystem);
  const padded = radius * FRUSTUM_PADDING;
  const near = Math.max(0.05, dist - padded);
  const far = dist + padded;
  const angle = Math.min(Math.atan(padded / dist), Math.PI / 2 - 0.05);

  shadowTarget.position.copy(hostWorld);
  shadowTarget.updateMatrixWorld();
  assignSpotLayers(solarSystem, hostName);

  spotLight.visible = true;
  spotLight.angle = angle;
  spotLight.distance = far;
  spotLight.castShadow = true;
  spotLight.intensity = SUN_INTENSITY;
  spotLight.shadow.camera.near = near;
  spotLight.shadow.camera.far = far;
  spotLight.shadow.camera.updateProjectionMatrix();
  pointLight.intensity = SUN_INTENSITY;

  camera.getWorldPosition(cameraWorld);
  const closeToTransit =
    hasTransitCasters(hostName, solarSystem) &&
    cameraWorld.distanceTo(hostWorld) < radius * TRANSIT_MAP_DISTANCE;
  setShadowMapSize(
    spotLight,
    closeToTransit ? SHADOW_MAP_SIZE_TRANSIT : SHADOW_MAP_SIZE
  );
};
