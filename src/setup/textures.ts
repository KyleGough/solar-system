import * as THREE from "three";
import { onLoaded } from "./loading";

let textureCount = 0;
let texturesLoaded = 0;
const textureLoader = new THREE.TextureLoader();

export const loadTexture = (path: string) => {
  return textureLoader.load(path, () => {
    texturesLoaded++;

    const percentageContainer = document.getElementById(
      "loader-percentage"
    ) as HTMLElement;
    percentageContainer.textContent = getProgress();

    if (texturesLoaded === textureCount) {
      onLoaded();
    }
  });
};

export const setTextureCount = (n: number) => {
  textureCount = n;
};

const getProgress = (): string => {
  const percentage = (100 * texturesLoaded) / textureCount;
  return `${percentage.toFixed(0)}%`;
};
