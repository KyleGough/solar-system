import * as THREE from "three";

/** Oceans stay a little glossy; land stays matte. */
const OCEAN_ROUGHNESS = 0.28;
const LAND_ROUGHNESS = 1.0;

const canvasFromImageData = (imageData: ImageData): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas is unavailable");
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

const imageDataFromTexture = (texture: THREE.Texture): ImageData => {
  const image = texture.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("2D canvas is unavailable");
  }
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * PlanetPixel-style specular (bright water) becomes a roughness map.
 */
export const applyGlossToRoughness = (texture: THREE.Texture) => {
  const src = imageDataFromTexture(texture);
  const { data } = src;
  const span = LAND_ROUGHNESS - OCEAN_ROUGHNESS;

  for (let i = 0; i < data.length; i += 4) {
    const gloss = data[i] / 255;
    const rough = (OCEAN_ROUGHNESS + span * (1 - gloss)) * 255;
    data[i] = rough;
    data[i + 1] = rough;
    data[i + 2] = rough;
  }

  texture.image = canvasFromImageData(src);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
};
