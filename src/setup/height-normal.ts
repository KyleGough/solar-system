import * as THREE from "three";

/** Oceans keep a soft sheen; land stays matte. */
const OCEAN_ROUGHNESS = 0.55;
const LAND_ROUGHNESS = 1.0;
/** Point-light GGX still blows out water; scale the specular lobe. */
const OCEAN_SPECULAR_SCALE = 0.12;

const OUTGOING_LIGHT =
  "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;";

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

/**
 * Dim the sun glint on glossy (ocean) texels only. Land stays at full
 * Standard specular, which is already ~0 at roughness 1.
 */
export const applySoftOceanSpecular = (
  material: THREE.MeshStandardMaterial
) => {
  const priorCompile = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey.bind(material);
  const oceanMask = `1.0 - smoothstep(${OCEAN_ROUGHNESS.toFixed(2)}, ${LAND_ROUGHNESS.toFixed(2)}, roughnessFactor)`;
  const scaled = `totalSpecular *= mix(1.0, ${OCEAN_SPECULAR_SCALE.toFixed(2)}, ${oceanMask});`;

  material.customProgramCacheKey = () => `${priorKey()}|soft-ocean-spec`;
  material.onBeforeCompile = (shader, renderer) => {
    priorCompile.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      OUTGOING_LIGHT,
      `${scaled}\n${OUTGOING_LIGHT}`
    );
  };
};
