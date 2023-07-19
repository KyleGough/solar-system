import * as THREE from "three";

export const createPath = (radius: number, thickness = 0.04) => {
  const halfWidth = thickness / 2;
  const geometry = new THREE.RingGeometry(
    radius - halfWidth,
    radius + halfWidth,
    256
  );
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.33,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;

  // Align to the ecliptic plane
  mesh.rotation.x = Math.PI / 2;

  return mesh;
};
