import * as THREE from "three";

export const createPath = (radius: number) => {
  const points: THREE.Vector3[] = [];
  const count = 1024;

  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = Math.sin(theta);
    const z = Math.cos(theta);
    points.push(new THREE.Vector3(x, 0, z));
  }

  points.push(new THREE.Vector3(0, 0, 1));

  const material = new THREE.LineBasicMaterial({
    color: "white",
    transparent: true,
    opacity: 0.25,
  });

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  const mesh = new THREE.Line(geometry, material);
  mesh.scale.set(radius, radius, radius);
  mesh.visible = false;

  return mesh;
};
