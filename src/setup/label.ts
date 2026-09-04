import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { LAYERS } from "../constants";

export interface PointOfInterest {
  name: string;
  y: number;
  z: number;
  type?: string;
}

export class Label {
  parent: THREE.Object3D;
  radius: number;
  elements: CSS2DObject[];

  /**
   * Represents a collection of labels for a celestial body.
   * @constructor
   * @param parent - Parent object for the labels.
   * @param radius - Distance between parent centre and label positions.
   */
  constructor(parent: THREE.Object3D, radius: number) {
    this.parent = parent;
    this.radius = radius;
    this.elements = [];
  }

  createPOILabel = (poi: PointOfInterest) => {
    const container = document.createElement("div");
    container.className = "label";

    if (poi.type) {
      const img = document.createElement("img");
      img.src = `./icons/${poi.type}.svg`;
      container.appendChild(img);
    }

    const text = document.createElement("p");
    text.textContent = poi.name;
    container.appendChild(text);

    const label = new CSS2DObject(container);
    label.center.set(0, 0);
    label.layers.set(LAYERS.POILabel);
    label.layers.disable(LAYERS.POILabel);

    const labelPosition = this.rotateLabel(poi.y, poi.z).toArray();
    label.position.set(...labelPosition);

    this.parent.add(label);
    this.elements.push(label);
  };

  /**
   * Show all point-of-interest labels.
   */
  showPOI = () => {
    this.elements.forEach((label) => {
      label.layers.enable(LAYERS.POILabel);
    });
  };

  /**
   * Hides all point-of-interest labels.
   */
  hidePOI = () => {
    this.elements.forEach((label) => {
      label.layers.disable(LAYERS.POILabel);
    });
  };

  /**
   * Update label opacities depending on camera position and direction.
   * @param localCameraPosition - Camera position in the parent body's local space.
   * @param fadeMultiplier - Extra 0–1 fade applied on top of geometric opacity.
   */
  update = (localCameraPosition: THREE.Vector3, fadeMultiplier = 1) => {
    this.elements.forEach((label) => {
      const rotationOpacity = this.getRotationOpacity(
        localCameraPosition,
        label
      );
      const distanceOpacity = this.getDistanceOpacity(localCameraPosition);
      const opacity = rotationOpacity * distanceOpacity * fadeMultiplier;
      label.element.style.opacity = opacity.toString();
    });
  };

  private rotateLabel = (y: number, z: number) => {
    const vector = new THREE.Vector3(this.radius, 0, 0);
    vector.applyAxisAngle(new THREE.Vector3(0, 1, 0), y);
    vector.applyAxisAngle(new THREE.Vector3(0, 0, 1), z);
    return vector;
  };

  private getRotationOpacity = (
    localCameraPosition: THREE.Vector3,
    label: CSS2DObject
  ): number => {
    const hideThreshold = 1;
    const fadeThreshold = 0.75;

    // Calculates the great-circle distance between the camera and label with normalised vectors.
    const cameraVector = localCameraPosition.clone().normalize();
    const labelVector = label.position.clone().normalize();
    const delta = Math.acos(
      Math.min(1, Math.max(-1, cameraVector.dot(labelVector)))
    );

    if (delta > hideThreshold) {
      return 0;
    } else if (delta > fadeThreshold) {
      return (hideThreshold - delta) / (hideThreshold - fadeThreshold);
    } else {
      return 1;
    }
  };

  private getDistanceOpacity = (localCameraPosition: THREE.Vector3): number => {
    const hideThreshold = this.radius * 12;
    const fadeThreshold = this.radius * 8;
    const distance = localCameraPosition.length();

    if (distance > hideThreshold) {
      return 0;
    } else if (distance > fadeThreshold) {
      return (hideThreshold - distance) / (hideThreshold - fadeThreshold);
    } else {
      return 1;
    }
  };
}
