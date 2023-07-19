import * as THREE from "three";
import { SolarSystem } from "./script";
import { createRingMesh } from "./rings";
import { createPath } from "./path";

const rotationFactor = Math.PI * 2 * 24; // 1 second = 24 hours

const normaliseRadius = (radius: number): number => {
  return Math.sqrt(radius) / 500;
};

const normaliseDistance = (distance: number): number => {
  return Math.pow(distance, 0.4) / 2;
};

const getRelativeSpeed = (period: number): number => {
  return 25 / period;
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
  texture: THREE.Texture;
  bumpMap?: THREE.Texture;
  orbits: string;
  type: string;
  tilt: number; // degrees
  mesh: THREE.Mesh;
  path?: THREE.Mesh;
  rng: number;

  constructor(
    radius: number,
    distance: number,
    period: number,
    daylength: number,
    texture: string,
    orbits = "Sun",
    type: string,
    tilt = 0,
    bumpMap?: string
  ) {
    this.radius = normaliseRadius(radius);
    this.distance = type === "moon" ? distance : normaliseDistance(distance);
    this.period = period;
    this.daylength = daylength;
    this.texture = PlanetaryObject.loader.load(texture);
    this.orbits = orbits;
    this.type = type;
    this.tilt = degreesToRadians(tilt);
    this.rng = Math.random() * 2 * Math.PI;

    if (type === "planet") {
      this.path = createPath(this.distance);
    }

    if (bumpMap) {
      this.bumpMap = PlanetaryObject.loader.load(bumpMap);
    }

    this.mesh = this.createMesh();
  }

  createMesh = () => {
    if (this.type === "ring") {
      const mesh = createRingMesh(this.texture);
      mesh.rotation.x += this.tilt;
      return mesh;
    }

    const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    let material;
    if (this.type === "star") {
      material = new THREE.MeshBasicMaterial({
        map: this.texture,
        lightMapIntensity: 2,
      });
    } else {
      material = new THREE.MeshPhongMaterial({
        map: this.texture,
        shininess: 10,
      });
      if (this.bumpMap) {
        material.bumpMap = this.bumpMap;
        material.bumpScale = 0.01;
      }
    }
    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.rotation.x = this.tilt;
    return sphere;
  };

  tick = (elapsedTime: number, solarSystem: SolarSystem) => {
    const relativeSpeed = getRelativeSpeed(this.period);
    const elapsedDistance = this.rng + elapsedTime * relativeSpeed;

    const orbitX = solarSystem[this.orbits]?.mesh?.position?.x || 0;
    const orbitZ = solarSystem[this.orbits]?.mesh?.position?.z || 0;

    this.mesh.position.x = orbitX + Math.cos(elapsedDistance) * this.distance;
    this.mesh.position.z = orbitZ - Math.sin(elapsedDistance) * this.distance;

    const rotation = (rotationFactor * elapsedTime) / this.daylength;

    if (this.type === "ring") {
      this.mesh.rotation.z = rotation;
    } else {
      this.mesh.rotation.y = rotation;
    }
  };
}
