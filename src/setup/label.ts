import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { PlanetaryObject } from "./planetary-object";

const hideThreshold = 1;
const fadeThreshold = 0.75;

export const labelVisibility = (
  camera: THREE.Camera,
  label: CSS2DObject,
  container: HTMLElement
) => {
  const cameraVector = camera.position.clone().normalize();
  const labelVector = label.position.clone().normalize();
  const delta = Math.acos(cameraVector.dot(labelVector));

  if (delta > hideThreshold) {
    container.style.opacity = "0";
  } else if (delta > fadeThreshold) {
    const o = (hideThreshold - delta) / (hideThreshold - fadeThreshold);
    container.style.opacity = o.toString();
  } else {
    container.style.opacity = "1";
  }
};

export const rotateLabel = (radius: number, y: number, z: number) => {
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
  label.visible = false;
  label.center.set(0, 0);
  label.layers.set(2);

  const labelPosition = rotateLabel(parent.radius, y, z).toArray();
  label.position.set(...labelPosition);

  parent.addLabel(label, container);

  return [label, container];
};
