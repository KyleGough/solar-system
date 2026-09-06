import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { markAssetLoaded } from "./textures";

const loader = new GLTFLoader();
const box = new THREE.Box3();
const sphere = new THREE.Sphere();

/**
 * Load a glTF scene, then count it toward the intro progress bar.
 */
export const loadGltf = (
  path: string,
  onLoad: (root: THREE.Group) => void
): void => {
  loader.load(
    path,
    (gltf) => {
      onLoad(gltf.scene);
      markAssetLoaded();
    },
    undefined,
    (error) => {
      console.error(`Failed to load model ${path}`, error);
      markAssetLoaded();
    }
  );
};

/**
 * Centre the model on the origin and scale its bounding sphere to `radius`.
 */
export const fitModelToRadius = (root: THREE.Object3D, radius: number): void => {
  box.setFromObject(root);
  box.getBoundingSphere(sphere);
  if (sphere.radius <= 0 || radius <= 0) {
    return;
  }
  const scale = radius / sphere.radius;
  root.scale.setScalar(scale);
  root.position.copy(sphere.center).multiplyScalar(-scale);
};

export const decorateModelMeshes = (
  root: THREE.Object3D,
  source: THREE.Object3D
): void => {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    mesh.castShadow = source.castShadow;
    mesh.receiveShadow = source.receiveShadow;
    mesh.layers.mask = source.layers.mask;

    const material = mesh.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.metalness = 0;
      material.roughness = 0.9;
      material.toneMapped = true;
    }
  });
};
