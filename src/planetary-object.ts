import * as THREE from "three";
import { SolarSystem, environmentMap } from "./utils";
import { createRingMesh } from "./rings";
import { createPath } from "./path";

interface TexturePaths {
  map: string;
  bump?: string;
  atmosphere?: string;
  atmosphereAlpha?: string;
  specular?: string;
}

interface Atmosphere {
  mesh?: THREE.Mesh;
  map?: THREE.Texture;
  alpha?: THREE.Texture;
}

const timeFactor = 8; // 1s real-time => 8h simulation time

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
  orbits: string;
  type: string;
  tilt: number; // degrees
  mesh: THREE.Mesh;
  path?: THREE.Mesh;
  rng: number;
  map: THREE.Texture;
  bumpMap?: THREE.Texture;
  specularMap?: THREE.Texture;
  atmosphere: Atmosphere = {};

  constructor(
    radius: number,
    distance: number,
    period: number,
    daylength: number,
    textures: TexturePaths,
    orbits = "Sun",
    type: string,
    tilt = 0
  ) {
    this.radius = normaliseRadius(radius);
    this.distance = type === "moon" ? distance : normaliseDistance(distance);
    this.period = period;
    this.daylength = daylength;
    this.orbits = orbits;
    this.type = type;
    this.tilt = degreesToRadians(tilt);
    this.rng = Math.random() * 2 * Math.PI;

    this.loadTextures(textures);

    if (type === "planet") {
      this.path = createPath(this.distance);
    }

    this.mesh = this.createMesh();

    if (this.atmosphere.map) {
      this.atmosphere.mesh = this.createAtmosphereMesh();
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
      return createRingMesh(this.map, this.tilt);
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
        shininess: 10,
      });

      if (this.bumpMap) {
        material.bumpMap = this.bumpMap;
        material.bumpScale =
          this.type === "moon" ? this.radius / 200 : this.radius / 50;
      }

      if (this.specularMap) {
        material.specularMap = this.specularMap;
        material.environmentMap = environmentMap;
      }
    }

    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.rotation.x += this.tilt;
    return sphere;
  };

  createAtmosphereMesh = () => {
    const geometry = new THREE.SphereGeometry(this.radius + 0.0001, 64, 64);

    const material = new THREE.MeshPhongMaterial({
      map: this.atmosphere?.map,
    });

    if (this.atmosphere.alpha) {
      material.alphaMap = this.atmosphere.alpha;
      material.transparent = true;
    }

    const sphere = new THREE.Mesh(geometry, material);
    sphere.receiveShadow = true;
    sphere.rotation.x = this.tilt;
    return sphere;
  };

  tickMesh = (
    mesh: THREE.Mesh,
    elapsedTime: number,
    solarSystem: SolarSystem
  ) => {
    // Convert real-time seconds to rotation.
    const rotation = (elapsedTime * Math.PI * 2 * timeFactor) / this.daylength;
    const orbitRotation =
      (elapsedTime * Math.PI * 2 * timeFactor) / (this.period * 24);
    const orbit = orbitRotation + this.rng;

    // Initially fix position to orbiting object or the origin.
    const orbitX = solarSystem[this.orbits]?.mesh?.position?.x || 0;
    const orbitZ = solarSystem[this.orbits]?.mesh?.position?.z || 0;

    // Circular rotation around orbit.
    mesh.position.x = orbitX + Math.cos(orbit) * this.distance;
    mesh.position.z = orbitZ - Math.sin(orbit) * this.distance;

    if (this.type === "ring") {
      mesh.rotation.z = rotation;
    } else {
      mesh.rotation.y = rotation;
    }
  };

  tick = (elapsedTime: number, solarSystem: SolarSystem) => {
    this.tickMesh(this.mesh, elapsedTime, solarSystem);
    this.atmosphere.mesh &&
      this.tickMesh(this.atmosphere.mesh, elapsedTime, solarSystem);
  };
}
