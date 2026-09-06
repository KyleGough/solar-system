import * as THREE from "three";
import { onLoaded, setLoadProgress } from "./loading";
import { applyGlossToRoughness } from "./height-normal";

type TextureRole = "color" | "data" | "glossRoughness";

let textureCount = 0;
let texturesLoaded = 0;
const textureLoader = new THREE.TextureLoader();

const markLoaded = () => {
  texturesLoaded++;
  setLoadProgress((100 * texturesLoaded) / textureCount);

  if (texturesLoaded === textureCount) {
    onLoaded();
  }
};

/** Count a finished texture, cubemap face, or glTF model toward the intro bar. */
export const markAssetLoaded = markLoaded;

/**
 * Color maps are sRGB albedo. Data maps (normals, bump, roughness, alpha)
 * stay linear.
 */
export const loadTexture = (path: string, role: TextureRole = "color") => {
  const texture = textureLoader.load(path, (loaded) => {
    if (role === "glossRoughness") {
      applyGlossToRoughness(loaded);
    }
    markLoaded();
  });

  texture.colorSpace =
    role === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;

  return texture;
};

export const setTextureCount = (n: number) => {
  textureCount = n;
};
