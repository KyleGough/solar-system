import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { PlanetaryObject } from "./planetary-object";

export const labelVisibility = (
  camera: THREE.Camera,
  label: CSS2DObject,
  container: HTMLElement
) => {
  const cameraVector = camera.position.clone().normalize();
  const labelVector = label.position.clone().normalize();
  const delta = Math.acos(cameraVector.dot(labelVector));

  if (delta > 1) {
    container.style.opacity = "0";
  } else if (delta > 0.75) {
    const o = 1 - 4 * (delta - 0.75);
    container.style.opacity = o.toString();
  } else {
    container.style.opacity = "1";
  }
};

const rotateLabel = (radius: number, y: number, z: number) => {
  const vector = new THREE.Vector3(radius, 0, 0);
  vector.applyAxisAngle(new THREE.Vector3(0, 1, 0), y);
  vector.applyAxisAngle(new THREE.Vector3(0, 0, 1), z);
  return vector;
};

export const createLabel = (
  name: string,
  y: number,
  z: number,
  parent: PlanetaryObject
): [CSS2DObject, HTMLElement] => {
  const container = document.createElement("div");
  container.className = "label";
  container.textContent = name;
  const label = new CSS2DObject(container);
  label.center.set(0, 0);
  const v = rotateLabel(parent.radius, y, z).toArray();
  label.position.set(...v);
  label.visible = false;
  label.layers.set(2);
  parent.mesh.add(label);
  return [label, container];
};
