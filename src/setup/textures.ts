import * as THREE from "three";
import { onLoaded } from "./loading";

let textureCount = 0;
let texturesLoaded = 0;
const textureLoader = new THREE.TextureLoader();
const textureLoadSet = new Set<string>();

export const loadTexture = (path: string) => {
  textureLoadSet.add(path);
  return textureLoader.load(path, () => {
    textureLoadSet.delete(path);
    texturesLoaded++;

    if (texturesLoaded === textureCount) {
      onLoaded();
    }
  });
};

export const setTextureCount = (n: number) => {
  textureCount = n;
};
