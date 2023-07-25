import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();

const textureLoadSet = new Set<string>();
let textureCount = 0;
let texturesLoaded = 0;

export const loadTexture = (path: string) => {
  textureLoadSet.add(path);
  return textureLoader.load(path, () => {
    textureLoadSet.delete(path);
    texturesLoaded++;

    if (texturesLoaded === textureCount) {
      console.log(path);
      handleTexturesLoaded();
    }
  });
};

const handleTexturesLoaded = () => {
  const loadText = document.getElementById("loader-text")
    ?.children[0] as HTMLParagraphElement;
  loadText.textContent = "Click to continue...";

  const loadIcon = document.getElementById("loader-circle") as HTMLDivElement;
  const svg = loadIcon.children[0] as HTMLElement;
  svg.style.animation = "none";

  const loadContainer = document.getElementById("loading") as HTMLDivElement;
  loadContainer.style.cursor = "pointer";

  loadContainer.addEventListener("click", () => {
    loadContainer.style.display = "none";
  });
};

export const setTextureCount = (n: number) => {
  console.log("set", n);
  textureCount = n;
};
