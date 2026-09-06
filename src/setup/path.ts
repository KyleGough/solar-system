import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { bodyColorThree } from "./swatch";

const ARC_SEGS = 48;
const TRAIL_FRACTION = 0.16;
const LINE_WIDTH = 2.4;

const trailResolution = new THREE.Vector2(1, 1);

export const setTrailResolution = (width: number, height: number) => {
  trailResolution.set(width, height);
};

const createTrailGeometry = (
  orbitRadius: number,
  bodyRadius: number,
  color: THREE.Color
): LineGeometry => {
  const trailAngle = Math.PI * 2 * TRAIL_FRACTION;
  const gap = Math.asin(
    Math.min(0.85, (bodyRadius * 1.45) / Math.max(orbitRadius, bodyRadius * 2))
  );

  const positions: number[] = [];
  const colors: number[] = [];

  for (let i = 0; i <= ARC_SEGS; i++) {
    const t = i / ARC_SEGS;
    const theta = -(gap + trailAngle * (1 - t));
    positions.push(
      Math.sin(theta) * orbitRadius,
      0,
      Math.cos(theta) * orbitRadius
    );
    const fade = t * t;
    colors.push(color.r * fade, color.g * fade, color.b * fade);
  }

  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  geometry.setColors(colors);
  return geometry;
};

export const createPath = (
  orbitRadius: number,
  bodyRadius: number,
  name: string
): THREE.Mesh => {
  const color = bodyColorThree(name);
  const material = new LineMaterial({
    color: 0xffffff,
    linewidth: LINE_WIDTH,
    vertexColors: true,
    dashed: false,
    worldUnits: false,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  material.uniforms.resolution.value = trailResolution;

  const mesh = new Line2(createTrailGeometry(orbitRadius, bodyRadius, color), material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.userData.ignorePick = true;
  mesh.userData.trailOpacity = 0;
  mesh.userData.pathOrbit = orbitRadius;
  mesh.userData.pathBody = bodyRadius;
  mesh.renderOrder = 2;
  return mesh;
};

export const setTrailOpacity = (trail: THREE.Mesh, opacity: number) => {
  const material = trail.material as LineMaterial;
  material.opacity = opacity;
  trail.userData.trailOpacity = opacity;
  trail.visible = opacity > 0.01;
};

export const updatePath = (
  trail: THREE.Mesh,
  orbitRadius: number,
  bodyRadius: number,
  name: string
) => {
  const prevOrbit = trail.userData.pathOrbit as number | undefined;
  const prevBody = trail.userData.pathBody as number | undefined;
  if (
    prevOrbit !== undefined &&
    prevBody !== undefined &&
    Math.abs(prevOrbit - orbitRadius) < 1e-8 &&
    Math.abs(prevBody - bodyRadius) < 1e-8
  ) {
    return;
  }

  const old = trail.geometry;
  trail.geometry = createTrailGeometry(
    orbitRadius,
    bodyRadius,
    bodyColorThree(name)
  );
  old.dispose();
  trail.userData.pathOrbit = orbitRadius;
  trail.userData.pathBody = bodyRadius;
};
