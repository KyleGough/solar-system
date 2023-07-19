import * as THREE from "three";
import { PlanetaryObject } from "./planetary-object";

const cubeTextureLoader = new THREE.CubeTextureLoader();

export const environmentMap = cubeTextureLoader.load([
  "/textures/environment/px.png",
  "/textures/environment/nx.png",
  "/textures/environment/py.png",
  "/textures/environment/ny.png",
  "/textures/environment/pz.png",
  "/textures/environment/nz.png",
]);

export type SolarSystem = Record<string, PlanetaryObject>;
