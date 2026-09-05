import * as THREE from "three";
import { SolarSystem } from "./solar-system";

export const createBodyPicker = (
  camera: THREE.Camera,
  canvas: HTMLElement,
  solarSystem: SolarSystem
) => {
  const raycaster = new THREE.Raycaster();
  raycaster.layers.enableAll();
  const pointer = new THREE.Vector2();
  const sun = solarSystem["Sun"].orbit;

  const pick = (clientX: number, clientY: number): string | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(sun, true);
    for (const hit of hits) {
      const name = resolveBodyName(hit.object);
      if (name) {
        return name;
      }
    }
    return null;
  };

  return { pick };
};

const resolveBodyName = (object: THREE.Object3D): string | null => {
  let current: THREE.Object3D | null = object;
  if (current.userData.ignorePick) {
    return null;
  }

  while (current) {
    if (current.userData.traversable === false) {
      return null;
    }
    if (current.userData.traversable && current.userData.bodyName) {
      return current.userData.bodyName as string;
    }
    current = current.parent;
  }

  return null;
};
