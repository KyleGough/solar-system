import * as THREE from "three";

const cubeTextureLoader = new THREE.CubeTextureLoader();

export const createEnvironmentMap = (directory: string) =>
  cubeTextureLoader.load([
    `${directory}/px.png`,
    `${directory}/nx.png`,
    `${directory}/py.png`,
    `${directory}/ny.png`,
    `${directory}/pz.png`,
    `${directory}/nz.png`,
  ]);
