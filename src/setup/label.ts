import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { LAYERS } from "../constants";

export interface PointOfInterest {
  name: string;
  y: number;
  z: number;
  type?: string;
  fact?: string;
  image?: string;
  imageAlt?: string;
}

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** Surface point from the `y` / `z` angles used in planets.json. */
export const poiLocalPosition = (
  radius: number,
  y: number,
  z: number,
  target = new THREE.Vector3()
): THREE.Vector3 => {
  return target
    .set(radius, 0, 0)
    .applyAxisAngle(AXIS_Y, y)
    .applyAxisAngle(AXIS_Z, z);
};

/** Inverse of `poiLocalPosition`. `y` is in [-π/2, π/2], `z` in [-π, π]. */
export const poiAnglesFromLocal = (
  local: THREE.Vector3
): { y: number; z: number } => {
  const hypot = Math.hypot(local.x, local.y);
  return {
    y: Math.atan2(-local.z, hypot),
    z: hypot < 1e-10 ? 0 : Math.atan2(local.y, local.x),
  };
};

export class Label {
  parent: THREE.Object3D;
  radius: number;
  elements: CSS2DObject[];
  onSelect: ((poi: PointOfInterest, localPosition: THREE.Vector3) => void) | null =
    null;

  private readonly toCamera = new THREE.Vector3();
  private readonly viewRight = new THREE.Vector3();
  private readonly localUp = new THREE.Vector3(0, 1, 0);

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
    const button = document.createElement("button");
    button.type = "button";
    button.className = "poi";
    button.setAttribute("aria-pressed", "false");

    const mark = document.createElement("span");
    mark.className = "poi-mark";
    mark.setAttribute("aria-hidden", "true");

    const tick = document.createElement("span");
    tick.className = "poi-tick";
    tick.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "poi-name";
    text.textContent = poi.name;

    button.append(mark, tick, text);

    const label = new CSS2DObject(button);
    label.center.set(0, 0.5);
    label.layers.set(LAYERS.POILabel);
    label.layers.disable(LAYERS.POILabel);
    label.userData.poi = poi;

    poiLocalPosition(this.radius, poi.y, poi.z, label.position);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onSelect?.(poi, label.position);
    });

    this.parent.add(label);
    this.elements.push(label);
  };

  /**
   * Show all point-of-interest labels.
   */
  showPOI = () => {
    this.elements.forEach((label) => {
      label.visible = true;
      label.layers.enable(LAYERS.POILabel);
      label.element.style.removeProperty("opacity");
    });
  };

  /**
   * Hides all point-of-interest labels.
   */
  hidePOI = () => {
    this.elements.forEach((label) => {
      label.visible = false;
      label.layers.disable(LAYERS.POILabel);
      label.element.style.opacity = "0";
      label.element.style.pointerEvents = "none";
      label.element.setAttribute("tabindex", "-1");
    });
  };

  setActive = (name: string | null) => {
    this.elements.forEach((label) => {
      const poi = label.userData.poi as PointOfInterest | undefined;
      const active = Boolean(name && poi?.name === name);
      label.element.classList.toggle("is-active", active);
      label.element.setAttribute("aria-pressed", String(active));
    });
  };

  positionOf = (name: string): THREE.Vector3 | null => {
    const label = this.elements.find((entry) => {
      const poi = entry.userData.poi as PointOfInterest | undefined;
      return poi?.name === name;
    });
    return label?.position ?? null;
  };

  /**
   * Update label opacities depending on camera position and direction.
   * @param localCameraPosition - Camera position in the parent body's local space.
   * @param fadeMultiplier - Extra 0–1 fade applied on top of geometric opacity.
   */
  update = (localCameraPosition: THREE.Vector3, fadeMultiplier = 1) => {
    this.toCamera.copy(localCameraPosition).normalize();
    this.viewRight.crossVectors(this.localUp, this.toCamera);
    const canFlip = this.viewRight.lengthSq() > 0.04;
    if (canFlip) {
      this.viewRight.normalize();
    }

    this.elements.forEach((label) => {
      const rotationOpacity = this.getRotationOpacity(
        localCameraPosition,
        label
      );
      const distanceOpacity = this.getDistanceOpacity(localCameraPosition);
      const opacity = rotationOpacity * distanceOpacity * fadeMultiplier;
      const element = label.element;
      element.style.opacity = opacity.toString();
      element.style.pointerEvents = opacity > 0.2 ? "auto" : "none";
      if (opacity > 0.2) {
        element.removeAttribute("tabindex");
      } else {
        element.setAttribute("tabindex", "-1");
      }

      if (canFlip) {
        const side = label.position.dot(this.viewRight);
        if (Math.abs(side) > 0.12) {
          const flipped = side < 0;
          element.classList.toggle("is-flip", flipped);
          label.center.set(flipped ? 1 : 0, 0.5);
        }
      }
    });
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
