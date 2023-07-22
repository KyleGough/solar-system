import * as THREE from "three";

export const createRingMesh = (texture: THREE.Texture): THREE.Mesh => {
  const ringGeometry = new THREE.RingGeometry(0.4, 1, 128);
  const pos = ringGeometry.attributes.position;
  const v3 = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    ringGeometry.attributes.uv.setXY(i, v3.length() <= 0.75 ? 0 : 1, 1);
  }

  const ringMaterial = new THREE.MeshPhongMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
  });

  const rings = new THREE.Mesh(ringGeometry, ringMaterial);
  rings.receiveShadow = true;
  rings.rotation.x = Math.PI / 2;

  return rings;
};
