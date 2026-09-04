import * as THREE from "three";
import { onLoaded, setLoadProgress } from "./loading";

let textureCount = 0;
let texturesLoaded = 0;
const textureLoader = new THREE.TextureLoader();

export const loadTexture = (path: string) => {
  return textureLoader.load(path, () => {
    texturesLoaded++;
    setLoadProgress((100 * texturesLoaded) / textureCount);

    if (texturesLoaded === textureCount) {
      onLoaded();
    }
  });
};

export const setTextureCount = (n: number) => {
  textureCount = n;
};
