import * as THREE from "three";

/** D-ring inner and A-ring outer, as multiples of the parent planet’s mesh radius. */
const RING_INNER = 1.11;
export const RING_OUTER = 2.27;

/**
 * Saturn’s ring disk, sized from the parent planet’s scaled mesh radius so the
 * inner edge stays outside the globe. The texture is a radial strip (U = radius).
 */
export const createRingMesh = (
  texture: THREE.Texture,
  planetRadius: number
): THREE.Mesh => {
  const innerRadius = planetRadius * RING_INNER;
  const outerRadius = planetRadius * RING_OUTER;
  const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128, 8);
  const pos = ringGeometry.attributes.position;
  const uv = ringGeometry.attributes.uv;
  const v3 = new THREE.Vector3();
  const span = outerRadius - innerRadius;

  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    uv.setXY(i, (v3.length() - innerRadius) / span, 0.5);
  }
  uv.needsUpdate = true;

  const ringMaterial = new THREE.MeshPhongMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.05,
    shininess: 0,
  });
  ringMaterial.shadowSide = THREE.DoubleSide;

  const rings = new THREE.Mesh(ringGeometry, ringMaterial);
  rings.castShadow = true;
  rings.receiveShadow = true;
  rings.rotation.x = Math.PI / 2;

  return rings;
};
