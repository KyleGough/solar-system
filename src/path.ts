import * as THREE from "three";

export const createPath = (radius: number) => {
  const geometry = new THREE.RingGeometry(radius, radius + 0.03, 256);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;

  return mesh;
};
