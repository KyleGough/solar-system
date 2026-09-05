import * as THREE from "three";
import { createRingMesh, RING_OUTER } from "./rings";
import { createPath } from "./path";
import { loadTexture } from "./textures";
import { applyNightLights } from "./night-lights";
import {
  createAtmosphereGlow,
  type AtmosphereGlowParams,
} from "./atmosphere-glow";
import { Label } from "./label";
import { PointOfInterest } from "./label";
import { LAYERS } from "../constants";

export interface Body {
  name: string;
  radius: number;
  /** Mass in kilograms. Omitted for non-physical bodies such as rings. */
  mass?: number;
  distance: number;
  period: number;
  daylength: number;
  /** Hours for one cloud-layer rotation. Faster than daylength so weather drifts. */
  cloudPeriod?: number;
  textures: TexturePaths;
  type: string;
  tilt: number;
  orbits?: string;
  labels?: PointOfInterest[];
  description?: string;
  traversable: boolean;
  offset?: number;
  stats?: Array<[string, string]>;
  /** 0–1 opacity of the cloud-layer mesh. Defaults to 1. */
  atmosphereOpacity?: number;
  /** Limb haze for bodies with a visible atmosphere. */
  atmosphereGlow?: AtmosphereGlowParams;
}

interface TexturePaths {
  map: string;
  bump?: string;
  normal?: string;
  atmosphere?: string;
  atmosphereAlpha?: string;
  specular?: string;
  night?: string;
}

interface Atmosphere {
  map?: THREE.Texture;
  alpha?: THREE.Texture;
}

const timeFactor = 8 * Math.PI * 2; // 1s real-time => 8h simulation time

const normaliseRadius = (radius: number): number => {
  return Math.sqrt(radius) / 500;
};

const normaliseDistance = (distance: number): number => {
  return Math.pow(distance, 0.4);
};

const degreesToRadians = (degrees: number): number => {
  return (Math.PI * degrees) / 180;
};

export class PlanetaryObject {
  radius: number; // in km
  distance: number; // in million km
  period: number; // in days
  daylength: number; // in hours
  cloudPeriod?: number; // in hours
  orbits?: string;
  type: string;
  tilt: number; // degrees
  mesh: THREE.Mesh;
  atmosphereMesh?: THREE.Mesh;
  path?: THREE.Mesh;
  rng: number;
  map!: THREE.Texture;
  bumpMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  specularMap?: THREE.Texture;
  nightMap?: THREE.Texture;
  atmosphere: Atmosphere = {};
  atmosphereOpacity?: number;
  labels!: Label;

  constructor(body: Body, parent?: PlanetaryObject) {
    const { radius, distance, period, daylength, cloudPeriod, orbits, type, tilt } =
      body;

    this.radius = normaliseRadius(radius);
    this.distance = normaliseDistance(distance);
    this.period = period;
    this.daylength = daylength;
    this.cloudPeriod = cloudPeriod;
    this.atmosphereOpacity = body.atmosphereOpacity;
    this.orbits = orbits;
    this.type = type;
    this.tilt = degreesToRadians(tilt);
    this.rng = body.offset ?? Math.random() * 2 * Math.PI;

    this.loadTextures(body.textures);

    if (type === "ring" && !parent) {
      throw new Error(`Ring "${body.name}" must be constructed with its parent`);
    }

    this.mesh = this.createMesh(parent);

    if (this.orbits && this.distance > 0 && type !== "ring") {
      this.path = createPath(this.distance, this.radius, body.name);
    }

    if (this.atmosphere.map) {
      this.atmosphereMesh = this.createAtmosphereMesh();
      this.mesh.add(this.atmosphereMesh);
    }

    if (body.atmosphereGlow) {
      this.mesh.add(createAtmosphereGlow(this.radius, body.atmosphereGlow));
    }

    this.initLabels(body.labels);
  }

  /**
   * Creates label objects for each point-of-interest.
   * @param labels - List of labels to display.
   */
  private initLabels = (labels?: PointOfInterest[]) => {
    this.labels = new Label(this.mesh, this.radius);

    if (labels) {
      labels.forEach((poi) => {
        this.labels.createPOILabel(poi);
      });
    }
  };

  /**
   * Prepare and load textures.
   * @param textures - Object of texture paths to load.
   */
  private loadTextures(textures: TexturePaths) {
    this.map = loadTexture(textures.map);
    if (textures.bump) {
      this.bumpMap = loadTexture(textures.bump);
    }
    if (textures.normal) {
      this.normalMap = loadTexture(textures.normal);
    }
    if (textures.specular) {
      this.specularMap = loadTexture(textures.specular);
    }
    if (textures.night) {
      this.nightMap = loadTexture(textures.night);
    }
    if (textures.atmosphere) {
      this.atmosphere.map = loadTexture(textures.atmosphere);
    }
    if (textures.atmosphereAlpha) {
      this.atmosphere.alpha = loadTexture(textures.atmosphereAlpha);
    }
  }

  /**
   * Creates the main mesh object with textures.
   * @returns celestial body mesh.
   */
  private createMesh = (parent?: PlanetaryObject) => {
    if (this.type === "ring") {
      return createRingMesh(this.map, parent!.radius);
    }

    const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
    let material;
    if (this.type === "star") {
      material = new THREE.MeshBasicMaterial({
        map: this.map,
        toneMapped: false,
        color: new THREE.Color(2.5, 2.5, 2.5),
      });
    } else {
      material = new THREE.MeshPhongMaterial({
        map: this.map,
        shininess: 5,
        toneMapped: true,
      });

      if (this.bumpMap) {
        material.bumpMap = this.bumpMap;
        material.bumpScale = this.radius / 50;
      }

      if (this.normalMap) {
        material.normalMap = this.normalMap;
        material.normalScale.set(1.4, 1.4);
      }

      if (this.specularMap) {
        material.specularMap = this.specularMap;
      }

      if (this.nightMap) {
        applyNightLights(material, this.nightMap);
      }
    }

    const sphere = new THREE.Mesh(geometry, material);
    sphere.rotation.x = this.tilt;
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    if (this.type === "star") {
      // Bloom pass only. Kept off layer 0 so the mix shader does not draw the Sun twice.
      sphere.layers.set(LAYERS.BLOOM);
    }

    return sphere;
  };

  /**
   * Creates the cloud-layer mesh. Kept as a child so it follows orbit and
   * inherits axial tilt; tick() applies a separate spin so weather drifts.
   */
  private createAtmosphereMesh = () => {
    const geometry = new THREE.SphereGeometry(this.radius + 0.0005, 64, 64);

    const material = new THREE.MeshPhongMaterial({
      map: this.atmosphere?.map,
      transparent: true,
      opacity: this.atmosphereOpacity ?? 1,
      depthWrite: false,
      shininess: 0,
    });

    if (this.atmosphere.alpha) {
      material.alphaMap = this.atmosphere.alpha;
    }

    const sphere = new THREE.Mesh(geometry, material);
    sphere.name = "clouds";
    sphere.renderOrder = 1;
    sphere.receiveShadow = true;
    return sphere;
  };

  private getRotation = (elapsedTime: number, periodHours = this.daylength) => {
    return periodHours ? (elapsedTime * timeFactor) / periodHours : 0;
  };

  private getOrbitRotation = (elapsedTime: number) => {
    return this.daylength ? (elapsedTime * timeFactor) / (this.period * 24) : 0;
  };

  /**
   * Updates orbital position and rotation.
   * @param elapsedTime - number of seconds elapsed.
   */
  tick = (elapsedTime: number) => {
    // Convert real-time seconds to rotation.
    const rotation = this.getRotation(elapsedTime);
    const orbitRotation = this.getOrbitRotation(elapsedTime);
    const orbit = orbitRotation + this.rng;

    // Circular rotation around orbit.
    this.mesh.position.x = Math.sin(orbit) * this.distance;
    this.mesh.position.z = Math.cos(orbit) * this.distance;
    if (this.path) {
      this.path.rotation.y = orbit;
    }

    if (this.type === "ring") {
      this.mesh.rotation.z = rotation;
    } else {
      this.mesh.rotation.y = rotation;
    }

    // Parent already spins with the day. Extra local Y is the drift relative
    // to the surface, so world cloud spin equals the cloud period.
    if (this.atmosphereMesh && this.cloudPeriod) {
      this.atmosphereMesh.rotation.y =
        this.getRotation(elapsedTime, this.cloudPeriod) - rotation;
    }
  };

  /**
   * Camera distance used when this body becomes the focus.
   */
  getFocusDistance = (): number => {
    if (this.mesh.getObjectByName("rings")) {
      return this.radius * RING_OUTER * 1.55;
    }
    return this.radius * 2.25;
  };

  /**
   * @returns the minimum orbital control camera distance allowed.
   */
  getMinDistance = (): number => {
    return this.radius * 1.8;
  };
}
