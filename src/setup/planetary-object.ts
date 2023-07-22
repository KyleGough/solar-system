import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { createRingMesh } from "./rings";
import { createPath } from "./path";

export interface Body {
  name: string;
  radius: number;
  distance: number;
  period: number;
  daylength: number;
  textures: TexturePaths;
  type: string;
  tilt: number;
  orbits?: string;
  labels?: PointOfInterest[];
  traversable: boolean;
  offset?: number;
}

interface PointOfInterest {
  name: string;
  y: number;
  z: number;
  type?: string;
}

interface TexturePaths {
  map: string;
  bump?: string;
  atmosphere?: string;
  atmosphereAlpha?: string;
  specular?: string;
}

interface Atmosphere {
  map?: THREE.Texture;
  alpha?: THREE.Texture;
}

interface Label {
  label: CSS2DObject;
  container: HTMLElement;
}

const timeFactor = 8 * Math.PI * 2; // 1s real-time => 8h simulation time

const normaliseRadius = (radius: number): number => {
  return Math.sqrt(radius) / 500;
};

const normaliseDistance = (distance: number): number => {
  return Math.pow(distance, 0.4) / 2;
};

const degreesToRadians = (degrees: number): number => {
  return (Math.PI * degrees) / 180;
};

export class PlanetaryObject {
  static loader = new THREE.TextureLoader();
  radius: number; // in km
  distance: number; // in million km
  period: number; // in days
  daylength: number; // in hours
  orbits?: string;
  type: string;
  tilt: number; // degrees
  mesh: THREE.Mesh;
  path?: THREE.Mesh;
  rng: number;
  map: THREE.Texture;
  bumpMap?: THREE.Texture;
  specularMap?: THREE.Texture;
  atmosphere: Atmosphere = {};
  labels: Label[] = [];

  constructor(body: Body) {
    const { radius, distance, period, daylength, orbits, type, tilt } = body;

    this.radius = normaliseRadius(radius);
    this.distance = type === "moon" ? distance : normaliseDistance(distance);
    this.period = period;
    this.daylength = daylength;
    this.orbits = orbits;
    this.type = type;
    this.tilt = degreesToRadians(tilt);
    this.rng = body.offset ? body.offset : Math.random() * 2 * Math.PI;

    this.loadTextures(body.textures);

    if (type === "planet") {
      this.path = createPath(this.distance);
    }

    this.mesh = this.createMesh();

    if (this.atmosphere.map) {
      this.mesh.add(this.createAtmosphereMesh());
    }
  }

  loadTextures(textures: TexturePaths) {
    this.map = PlanetaryObject.loader.load(textures.map);
    if (textures.bump) {
      this.bumpMap = PlanetaryObject.loader.load(textures.bump);
    }
    if (textures.specular) {
      this.specularMap = PlanetaryObject.loader.load(textures.specular);
    }
    if (textures.atmosphere) {
      this.atmosphere.map = PlanetaryObject.loader.load(textures.atmosphere);
    }
    if (textures.atmosphereAlpha) {
      this.atmosphere.alpha = PlanetaryObject.loader.load(
        textures.atmosphereAlpha
      );
    }
  }

  createMesh = () => {
    if (this.type === "ring") {
      return createRingMesh(this.map);
    }

    const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
    let material;
    if (this.type === "star") {
      material = new THREE.MeshBasicMaterial({
        map: this.map,
        lightMapIntensity: 2,
      });
    } else {
      material = new THREE.MeshPhongMaterial({
        map: this.map,
        shininess: 5,
      });

      if (this.bumpMap) {
        material.bumpMap = this.bumpMap;
        material.bumpScale =
          this.type === "moon" ? this.radius / 200 : this.radius / 50;
      }

      if (this.specularMap) {
        material.specularMap = this.specularMap;
      }
    }

    const sphere = new THREE.Mesh(geometry, material);
    sphere.rotation.x += this.tilt;

    sphere.castShadow = true;
    sphere.receiveShadow = true;

    return sphere;
  };

  createAtmosphereMesh = () => {
    const geometry = new THREE.SphereGeometry(this.radius + 0.0005, 64, 64);

    const material = new THREE.MeshPhongMaterial({
      map: this.atmosphere?.map,
      transparent: true,
    });

    if (this.atmosphere.alpha) {
      material.alphaMap = this.atmosphere.alpha;
    }

    const sphere = new THREE.Mesh(geometry, material);
    sphere.receiveShadow = true;
    sphere.rotation.x = this.tilt;
    return sphere;
  };

  getRotation = (elapsedTime: number) => {
    return this.daylength ? (elapsedTime * timeFactor) / this.daylength : 0;
  };

  getOrbitRotation = (elapsedTime: number) => {
    return this.daylength ? (elapsedTime * timeFactor) / (this.period * 24) : 0;
  };

  tick = (elapsedTime: number) => {
    // Convert real-time seconds to rotation.
    const rotation = this.getRotation(elapsedTime);
    const orbitRotation = this.getOrbitRotation(elapsedTime);
    const orbit = orbitRotation + this.rng;

    // Circular rotation around orbit.
    this.mesh.position.x = Math.sin(orbit) * this.distance;
    this.mesh.position.z = Math.cos(orbit) * this.distance;

    if (this.type === "ring") {
      this.mesh.rotation.z = rotation;
    } else {
      this.mesh.rotation.y = rotation;
    }
  };

  addLabel = (label: CSS2DObject, container: HTMLElement) => {
    this.mesh.add(label);
    this.labels.push({ label, container });
  };

  showLabels = () => {
    this.labels.forEach((label) => (label.label.visible = true));
  };

  hideLabels = () => {
    this.labels.forEach((label) => (label.label.visible = false));
  };
}
