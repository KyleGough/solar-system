import * as THREE from "three";
import { SolarSystem } from "./script";
import { createRingMesh } from "./rings";

const rotationFactor = Math.PI * 2 * 24; // 1 second = 24 hours

const getRelativeRadius = (distance: number): number => {
  return Math.pow(distance, 0.4) / 2;
};

const getRelativeSpeed = (period: number): number => {
  return 500 / period;
};

export class PlanetaryObject {
  static loader = new THREE.TextureLoader();
  radius: number; // in km
  distance: number; // in million km
  period: number; // in days
  daylength: number; // in hours
  texture: THREE.Texture;
  type: string;
  orbits: string;
  mesh: THREE.Mesh;
  rng: number;

  constructor(
    radius: number,
    distance: number,
    period: number,
    daylength: number,
    texture: string,
    orbits = "sun",
    type: string
  ) {
    this.radius = radius;
    this.distance = getRelativeRadius(distance);
    this.period = period;
    this.daylength = daylength;
    this.texture = PlanetaryObject.loader.load(texture);
    this.type = type;
    this.orbits = orbits;
    this.rng = Math.random() * 2 * Math.PI;
    this.mesh = this.createMesh();
  }

  createMesh = () => {
    if (this.type === "ring") {
      return createRingMesh(this.texture);
    }

    const geometry = new THREE.SphereGeometry(
      Math.sqrt(this.radius) / 500,
      32,
      32
    );
    let material;
    if (this.type === "star") {
      material = new THREE.MeshBasicMaterial({ map: this.texture });
    } else {
      material = new THREE.MeshPhongMaterial({ map: this.texture });
      material.shininess = 10;
    }
    const sphere = new THREE.Mesh(geometry, material);
    sphere.receiveShadow = true;
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
