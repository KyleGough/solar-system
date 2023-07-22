import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { PlanetaryObject } from "./planetary-object";

export const getLabelOpacity = (
  camera: THREE.Camera,
  label: CSS2DObject,
  radius: number
) => {
  const rotationOpacity = getRotationOpacity(camera, label);
  const distanceOpacity = getDistanceOpacity(camera, radius);
  return rotationOpacity * distanceOpacity;
};

const getRotationOpacity = (
  camera: THREE.Camera,
  label: CSS2DObject
): number => {
  const hideThreshold = 1;
  const fadeThreshold = 0.75;
  const cameraVector = camera.position.clone().normalize();
  const labelVector = label.position.clone().normalize();
  const delta = Math.acos(cameraVector.dot(labelVector));

  if (delta > hideThreshold) {
    return 0;
  } else if (delta > fadeThreshold) {
    return (hideThreshold - delta) / (hideThreshold - fadeThreshold);
  } else {
    return 1;
  }
};

const getDistanceOpacity = (camera: THREE.Camera, radius: number): number => {
  const hideThreshold = radius * 12;
  const fadeThreshold = radius * 8;
  const distance = camera.position.length();

  if (distance > hideThreshold) {
    return 0;
  } else if (distance > fadeThreshold) {
    return (hideThreshold - distance) / (hideThreshold - fadeThreshold);
  } else {
    return 1;
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
  parent: PlanetaryObject,
  type = ""
): [CSS2DObject, HTMLElement] => {
  const container = document.createElement("div");
  container.className = "label";

  if (type) {
    const img = document.createElement("img");
    img.src = `/icons/${type}.svg`;
    container.appendChild(img);
  }

  const text = document.createElement("p");
  text.textContent = name;
  container.appendChild(text);

  const label = new CSS2DObject(container);
  label.visible = false;
  label.center.set(0, 0);
  label.layers.set(2);

  const labelPosition = rotateLabel(parent.radius, y, z).toArray();
  label.position.set(...labelPosition);

  parent.addLabel(label, container);

  return [label, container];
};
