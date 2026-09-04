import * as THREE from "three";

const STAR_COUNT = 2200;
const DISTANCE = 400;

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
    const mag = 0.35 + Math.random() * 0.65;
    colors[i * 3] = mix.r * mag;
    colors[i * 3 + 1] = mix.g * mag;
    colors[i * 3 + 2] = mix.b * mag;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: false,
    depthWrite: false,
  });

  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  return stars;
};
