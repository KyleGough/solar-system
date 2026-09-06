import * as THREE from "three";

const STAR_COUNT = 2000;
const DISTANCE = 400;

const createStarSprite = (): THREE.CanvasTexture => {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create star sprite");
  }

  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.42)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
};

export const createStarfield = (): THREE.Points => {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const warm = new THREE.Color("#e4d3a8");
  const cool = new THREE.Color("#c9d2c8");
  const mix = new THREE.Color();

  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;
    const sinT = Math.sin(theta);
    positions[i * 3] = DISTANCE * sinT * Math.cos(phi);
    positions[i * 3 + 1] = DISTANCE * Math.cos(theta);
    positions[i * 3 + 2] = DISTANCE * sinT * Math.sin(phi);
    mix.lerpColors(warm, cool, Math.random());
    const mag = 0.18 + Math.random() * 0.38;
    colors[i * 3] = mix.r * mag;
    colors[i * 3 + 1] = mix.g * mag;
    colors[i * 3 + 2] = mix.b * mag;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 4,
    map: createStarSprite(),
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: false,
    depthWrite: false,
    toneMapped: false,
  });

  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  return stars;
};
