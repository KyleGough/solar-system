import * as THREE from "three";
import { createRingMesh, RING_OUTER, setRingPlanetRadius } from "./rings";
import { createPath, updatePath } from "./path";
import { loadTexture } from "./textures";
import { applyNightLights } from "./night-lights";
import { applyDaysideRelief } from "./dayside-relief";
import { createAtmosphereGlow } from "./atmosphere-glow";
import type { Body, BodyType, TexturePaths } from "./catalog";
import { Label } from "./label";
import { PointOfInterest } from "./label";
import { LAYERS } from "../constants";
import {
  DEFAULT_DISTANCE_EXPONENT,
  DEFAULT_RADIUS_EXPONENT,
  overviewDistance,
  overviewRadius,
} from "./scale";

interface Atmosphere {
  map?: THREE.Texture;
  alpha?: THREE.Texture;
}

const timeFactor = 8 * Math.PI * 2; // 1s real-time => 8h simulation time

const degreesToRadians = (degrees: number): number => {
  return (Math.PI * degrees) / 180;
};

/** Apparent diameter as a fraction of the viewport width on focus. */
export const FOCUS_VIEWPORT_FILL = 0.95;

/**
 * Distance from a sphere’s centre so its silhouette spans `fill` of the
 * viewport width. Uses NDC so the projected pixel width matches that fraction.
 */
export const distanceToFillViewport = (
  radius: number,
  camera: THREE.PerspectiveCamera,
  fill = FOCUS_VIEWPORT_FILL
): number => {
  const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const tanHorizontal = tanVertical * Math.max(camera.aspect, 1e-6);
  const tanLimb = fill * tanHorizontal;
  if (tanLimb < 1e-6) {
    return radius * 2.25;
  }
  return radius * Math.sqrt(1 + 1 / (tanLimb * tanLimb));
};

export class PlanetaryObject {
  name: string;
  /** Catalog radius in km. */
  catalogRadius: number;
  /** Catalog orbital distance in million km. */
  catalogDistance: number;
  /** Current scene-space globe radius. */
  radius: number;
  /** Current scene-space orbital radius. */
  distance: number;
  /** Sphere geometry radius; mesh.scale maps this to `radius`. */
  readonly meshLocalRadius: number;
  private readonly ringSourceRadius: number;
  period: number; // in days
  daylength: number; // in hours
  cloudPeriod?: number; // in hours
  orbits?: string;
  type: BodyType;
  tilt: number; // radians
  inclination: number; // radians
  equatorialOrbit: boolean;
  /** Inertial frame at the body centre. No axial tilt, no day spin. */
  origin: THREE.Group;
  /** Axial tilt only. Parent of the globe; moons/rings may attach here. */
  equator: THREE.Group;
  /** This body’s orbital plane (inclination). Parent of origin and path. */
  orbit: THREE.Group;
  mesh: THREE.Mesh;
  atmosphereMesh?: THREE.Mesh;
  path?: THREE.Mesh;
  rng: number;
  map!: THREE.Texture;
  bumpMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  nightMap?: THREE.Texture;
  atmosphere: Atmosphere = {};
  atmosphereOpacity?: number;
  labels!: Label;

  constructor(body: Body, parent?: PlanetaryObject) {
    const { radius, distance, period, daylength, cloudPeriod, orbits, type, tilt } =
      body;

    this.name = body.name;
    this.catalogRadius = radius;
    this.catalogDistance = distance;
    this.radius = overviewRadius(radius, DEFAULT_RADIUS_EXPONENT);
    this.distance = overviewDistance(distance, DEFAULT_DISTANCE_EXPONENT);
    this.meshLocalRadius = this.radius;
    this.ringSourceRadius = type === "ring" && parent ? parent.radius : 0;
    this.period = period;
    this.daylength = daylength;
    this.cloudPeriod = cloudPeriod;
    this.atmosphereOpacity = body.atmosphereOpacity;
    this.orbits = orbits;
    this.type = type;
    this.tilt = degreesToRadians(tilt);
    this.inclination = degreesToRadians(body.inclination ?? 0);
    this.equatorialOrbit =
      body.equatorialOrbit ?? (type === "moon" || type === "ring");
    this.rng = body.offset ?? Math.random() * 2 * Math.PI;

    this.loadTextures(body.textures);

    if (type === "ring" && !parent) {
      throw new Error(`Ring "${body.name}" must be constructed with its parent`);
    }

    this.orbit = new THREE.Group();
    this.orbit.name = `${body.name}-orbit`;
    this.orbit.rotation.x = this.inclination;

    this.origin = new THREE.Group();
    this.origin.name = `${body.name}-origin`;
    this.orbit.add(this.origin);

    this.equator = new THREE.Group();
    this.equator.name = `${body.name}-equator`;
    if (type !== "ring") {
      this.equator.rotation.x = this.tilt;
    }
    this.origin.add(this.equator);

    this.mesh = this.createMesh(parent);
    this.equator.add(this.mesh);

    if (this.orbits && this.distance > 0 && type !== "ring") {
      this.path = createPath(this.distance, this.radius, body.name);
      this.orbit.add(this.path);
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
   * Resize the globe and orbit to the current scene scale. Geometry stays
   * at `meshLocalRadius`; uniform mesh scale carries the rest.
   */
  setSceneSize = (radius: number, distance: number) => {
    const radiusChanged = Math.abs(this.radius - radius) > 1e-10;
    const distanceChanged = Math.abs(this.distance - distance) > 1e-10;
    if (!radiusChanged && !distanceChanged) {
      return;
    }
    this.radius = radius;
    this.distance = distance;
    if (this.type === "ring") {
      return;
    }
    if (radiusChanged && this.meshLocalRadius > 0) {
      this.mesh.scale.setScalar(radius / this.meshLocalRadius);
    }
    if (this.path) {
      updatePath(this.path, this.distance, this.radius, this.name);
    }
  };

  /** Keep the ring disk outside the parent globe as that globe's scene size changes. */
  setRingScale = (parentRadius: number) => {
    if (this.type !== "ring") {
      return;
    }
    setRingPlanetRadius(this.mesh, parentRadius, this.ringSourceRadius);
  };

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
      this.bumpMap = loadTexture(textures.bump, "data");
    }
    if (textures.normal) {
      this.normalMap = loadTexture(textures.normal, "data");
    }
    if (textures.specular) {
      this.roughnessMap = loadTexture(textures.specular, "glossRoughness");
    }
    if (textures.night) {
      this.nightMap = loadTexture(textures.night);
    }
    if (textures.atmosphere) {
      this.atmosphere.map = loadTexture(textures.atmosphere);
    }
    if (textures.atmosphereAlpha) {
      this.atmosphere.alpha = loadTexture(textures.atmosphereAlpha, "data");
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
      material = new THREE.MeshStandardMaterial({
        map: this.map,
        roughness: this.roughnessMap ? 1 : 0.9,
        metalness: 0,
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

      if (this.roughnessMap) {
        material.roughnessMap = this.roughnessMap;
      }

      if (this.bumpMap || this.normalMap) {
        applyDaysideRelief(material);
      }

      if (this.nightMap) {
        applyNightLights(material, this.nightMap);
      }
    }

    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    if (this.type === "star") {
      // Bloom pass only. Kept off layer 0 so the mix shader does not draw
      // the Sun twice. Disk occlusion is handled in the bloom composite.
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

    const material = new THREE.MeshStandardMaterial({
      map: this.atmosphere?.map,
      transparent: true,
      opacity: this.atmosphereOpacity ?? 1,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
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
    return this.period ? (elapsedTime * timeFactor) / (this.period * 24) : 0;
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

    // Move the inertial origin; the globe only spins in place.
    this.origin.position.x = Math.sin(orbit) * this.distance;
    this.origin.position.z = Math.cos(orbit) * this.distance;
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
   * Camera distance from the body centre. Uses the less zoomed-in of the
   * 0.95-viewport-width fit and the previous fixed framing, so a traverse
   * never comes in closer than before, but will pull back when the body
   * would overflow the viewport.
   */
  getFocusDistance = (camera: THREE.PerspectiveCamera): number => {
    const fitted = distanceToFillViewport(this.getVisualRadius(), camera);
    const legacy = this.getLegacyFocusDistance();
    return Math.max(this.getMinDistance(), fitted, legacy);
  };

  /** Fixed framing used before viewport-width fitting. */
  getLegacyFocusDistance = (): number => {
    if (this.origin.getObjectByName("rings")) {
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

  /**
   * OrbitControls min distance in the camera parent's local units. Ride-spin
   * parents to the mesh, so the limit must be in geometry space, not scene space.
   */
  getOrbitMinDistance = (parentedToMesh: boolean): number => {
    if (parentedToMesh && this.meshLocalRadius > 0) {
      return this.meshLocalRadius * 1.8;
    }
    return this.getMinDistance();
  };

  /** Bounding radius used when framing the body in the viewport. */
  getVisualRadius = (): number => {
    if (this.origin.getObjectByName("rings")) {
      return this.radius * RING_OUTER;
    }
    return this.radius;
  };
}
