import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SolarSystem } from "./solar-system";
import { parentOf, type BodyType } from "./catalog";
import { localMoonOrbitRadius } from "./scale";

const MIN_DURATION = 0.6;
const MAX_DURATION = 4.0;
const MIN_DIST = 1;
const MAX_DIST = 25;
/** Just off the Y pole so lookAt and OrbitControls keep a stable azimuth. */
const OVERHEAD_POLAR = 0.02;
/** North of the equator on the dayside arrival pose. */
const DAYSIDE_LATITUDE_DEG = 2.5; // 2.5° north of the equator
/** Yaw off the Sun–planet line so a sliver of night sits on the left limb. */
const DAYSIDE_LONGITUDE_DEG = 40;

/** Surface pan: symmetric smoothstep. */
const easeInOut = (t: number): number => t * t * (3 - 2 * t);

/**
 * Long-haul body-to-body travel. Quintic ease-in-out coasts into the
 * destination more than smoothstep (zero first and second derivatives at
 * both ends).
 */
const easeTravelQuintic = (t: number): number =>
  t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;

/**
 * Hops inside one moon system (Earth↔Moon, Phobos↔Mars, Deimos↔Phobos).
 * Cubic ease-in-out is snappier than quintic on those short transfers.
 */
const easeTravelCubic = (t: number): number =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

/** Planet and its moons, or two moons of the same planet. */
const sameMoonSystem = (a: string, b: string): boolean =>
  parentOf(a) === parentOf(b);

const durationFromDistance = (distance: number): number => {
  const t = Math.min(
    1,
    Math.max(0, (distance - MIN_DIST) / (MAX_DIST - MIN_DIST))
  );
  return MIN_DURATION + t * (MAX_DURATION - MIN_DURATION);
};

type FlightMode = "travel" | "pan";

type FocusFlightFrame = {
  active: boolean;
  progress: number;
  from: string;
  to: string;
  mode: FlightMode;
  justCrossedMidpoint: boolean;
  justFinished: boolean;
};

type Flight = {
  from: string;
  to: string;
  elapsed: number;
  duration: number;
  swapped: boolean;
  mode: FlightMode;
  cubicEase: boolean;
};

const idleFrame = (): FocusFlightFrame => ({
  active: false,
  progress: 1,
  from: "",
  to: "",
  mode: "travel",
  justCrossedMidpoint: false,
  justFinished: false,
});

const daysideEast = new THREE.Vector3();

/**
 * Camera offset from the body centre: sunward so the dayside faces the
 * lens, a slight polar lift, and a yaw so night sits on the left limb.
 */
const writeDaysideOffset = (
  distance: number,
  planetPos: THREE.Vector3,
  sunPos: THREE.Vector3,
  pole: THREE.Vector3,
  target: THREE.Vector3
) => {
  target.subVectors(sunPos, planetPos);
  if (target.lengthSq() < 1e-10) {
    target.set(1, 0, 0);
  } else {
    target.normalize();
  }
  daysideEast.crossVectors(target, pole);
  if (daysideEast.lengthSq() > 1e-10) {
    daysideEast.normalize();
  } else {
    daysideEast.set(0, 0, 0);
  }
  target.multiplyScalar(distance);
  target.addScaledVector(
    pole,
    -distance * Math.tan(THREE.MathUtils.degToRad(DAYSIDE_LATITUDE_DEG))
  );
  target.addScaledVector(
    daysideEast,
    distance * Math.tan(THREE.MathUtils.degToRad(DAYSIDE_LONGITUDE_DEG))
  );
};

const isOverheadFocus = (body: { type: BodyType }): boolean =>
  body.type === "star";

const writeOverheadOffset = (
  maxDistance: number,
  destOffset: THREE.Vector3,
  fromPos: THREE.Vector3,
  lookAt: THREE.Vector3
) => {
  destOffset.subVectors(fromPos, lookAt);
  destOffset.y = 0;
  if (destOffset.lengthSq() < 1e-10) {
    destOffset.set(0, 0, 1);
  } else {
    destOffset.normalize();
  }
  destOffset.multiplyScalar(maxDistance * Math.sin(OVERHEAD_POLAR));
  destOffset.y = maxDistance * Math.cos(OVERHEAD_POLAR);
};

export class FocusTransition {
  private flight: Flight | null = null;
  private rideSpin = false;
  private readonly inertialRig = new THREE.Object3D();
  private readonly startPos = new THREE.Vector3();
  private readonly startLookAt = new THREE.Vector3();
  private readonly startUp = new THREE.Vector3();
  private readonly destPos = new THREE.Vector3();
  private readonly destLookAt = new THREE.Vector3();
  private readonly destOffset = new THREE.Vector3();
  private readonly destUp = new THREE.Vector3();
  private readonly startQuat = new THREE.Quaternion();
  private readonly destQuat = new THREE.Quaternion();
  private readonly currentLookAt = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly worldTarget = new THREE.Vector3();
  private readonly prevTarget = new THREE.Vector3();
  private readonly targetDelta = new THREE.Vector3();
  private readonly panStartDir = new THREE.Vector3();
  private readonly panLocalDir = new THREE.Vector3();
  private readonly panQuatEnd = new THREE.Quaternion();
  private readonly panQuat = new THREE.Quaternion();
  private readonly identityQuat = new THREE.Quaternion();
  private readonly spinUndo = new THREE.Quaternion();
  private readonly axisY = new THREE.Vector3(0, 1, 0);
  private readonly sunPos = new THREE.Vector3();
  private readonly poleDir = new THREE.Vector3();
  private panRadius = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly fakeCamera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
    private readonly solarSystem: SolarSystem
  ) {
    this.inertialRig.name = "inertial-focus";
    this.scene.add(this.inertialRig);
  }

  isActive = (): boolean => this.flight !== null;

  isTraveling = (): boolean => this.flight?.mode === "travel";

  destination = (): string | null => this.flight?.to ?? null;

  /**
   * Current travel blend for scene scale. `progress` is 0 at takeoff, 1 at
   * landing; pan flights do not change moon scale.
   */
  travelScale = (
    dt = 0
  ): { from: string; to: string; progress: number } | null => {
    if (!this.flight || this.flight.mode !== "travel") {
      return null;
    }
    return {
      from: this.flight.from,
      to: this.flight.to,
      progress: Math.min(1, (this.flight.elapsed + dt) / this.flight.duration),
    };
  };

  /**
   * Keep the camera beside the focused body as it orbits, without inheriting
   * axial spin. Call after bodies tick, while not flying.
   */
  follow = (name: string): void => {
    if (this.rideSpin) {
      return;
    }

    const body = this.solarSystem[name];
    this.syncInertialRig(body);

    if (this.camera.parent === this.inertialRig) {
      return;
    }

    this.targetDelta.subVectors(this.inertialRig.position, this.prevTarget);
    this.fakeCamera.position.add(this.targetDelta);
    this.controls.target.copy(this.inertialRig.position);
    this.prevTarget.copy(this.inertialRig.position);
  };

  /**
   * Parent the camera to the focused mesh (ride spin) or to the inertial rig.
   * Ignored while a flight is in progress; complete() applies the latest mode.
   */
  setRideSpin = (ride: boolean, focusName: string): void => {
    this.rideSpin = ride;
    if (this.flight) {
      return;
    }
    this.applyRig(focusName);
    this.syncOrbitMinDistance(focusName);
  };

  begin = (from: string, to: string): boolean => {
    if (from === to && !this.flight) {
      return false;
    }
    if (this.flight?.to === to) {
      return false;
    }

    const toBody = this.solarSystem[to];
    const fromBody = this.solarSystem[this.flight?.to ?? from];

    if (this.flight) {
      this.startPos.copy(this.camera.position);
      this.startLookAt.copy(this.currentLookAt);
      this.startUp.copy(this.camera.up).normalize();
    } else {
      this.camera.updateWorldMatrix(true, false);
      this.camera.getWorldPosition(this.startPos);
      this.startUp
        .set(0, 1, 0)
        .transformDirection(this.camera.matrixWorld)
        .normalize();
      fromBody.mesh.getWorldPosition(this.startLookAt);
      this.detachToWorld();
    }

    toBody.mesh.updateWorldMatrix(true, false);
    toBody.mesh.getWorldPosition(this.destLookAt);
    if (isOverheadFocus(toBody)) {
      writeOverheadOffset(
        this.controls.maxDistance,
        this.destOffset,
        this.startPos,
        this.destLookAt
      );
      this.destPos.addVectors(this.destLookAt, this.destOffset);
      this.destUp.set(0, 1, 0);
    } else {
      this.writeDaysideDestination(toBody);
    }
    let distance = this.startPos.distanceTo(this.destPos);
    if (toBody.type === "moon" && toBody.orbits) {
      const parent = this.solarSystem[toBody.orbits];
      if (parent) {
        distance = Math.max(distance, localMoonOrbitRadius(toBody, parent));
      }
    }

    const origin = this.flight?.to ?? from;
    this.flight = {
      from: this.flight?.swapped ? this.flight.to : this.flight?.from ?? from,
      to,
      elapsed: 0,
      duration: durationFromDistance(distance),
      swapped: false,
      mode: "travel",
      cubicEase: sameMoonSystem(origin, to),
    };

    this.controls.enabled = false;
    this.currentLookAt.copy(this.startLookAt);

    if (isOverheadFocus(toBody)) {
      this.camera.position.copy(this.destPos);
      this.camera.up.copy(this.destUp);
      this.camera.lookAt(this.destLookAt);
      this.destQuat.copy(this.camera.quaternion);
    }

    this.camera.position.copy(this.startPos);
    this.camera.up.copy(this.startUp);
    this.camera.lookAt(this.currentLookAt);
    this.startQuat.copy(this.camera.quaternion);

    return true;
  };

  /**
   * Orbit around the focused body so a surface point faces the camera.
   * Keeps the current distance; slerps on the sphere so the path does not
   * cut through the globe.
   */
  panTo = (bodyName: string, localPoint: THREE.Vector3): boolean => {
    if (this.flight?.mode === "travel") {
      return false;
    }

    const body = this.solarSystem[bodyName];
    body.mesh.updateWorldMatrix(true, false);

    this.camera.updateWorldMatrix(true, false);
    this.camera.getWorldPosition(this.startPos);
    this.startUp
      .set(0, 1, 0)
      .transformDirection(this.camera.matrixWorld)
      .normalize();
    body.mesh.getWorldPosition(this.startLookAt);

    if (this.camera.parent !== this.scene) {
      this.detachToWorld();
    }

    this.panStartDir.copy(this.startPos);
    body.mesh.worldToLocal(this.panStartDir);
    this.panRadius = Math.max(this.panStartDir.length(), body.getMinDistance());
    if (this.panStartDir.lengthSq() < 1e-10) {
      this.panStartDir.set(1, 0, 0);
    } else {
      this.panStartDir.normalize();
    }

    this.panLocalDir.copy(localPoint);
    if (this.panLocalDir.lengthSq() < 1e-10) {
      this.panLocalDir.set(1, 0, 0);
    } else {
      this.panLocalDir.normalize();
    }

    this.panQuatEnd.setFromUnitVectors(this.panStartDir, this.panLocalDir);

    const angle = Math.acos(
      Math.min(1, Math.max(-1, this.panStartDir.dot(this.panLocalDir)))
    );
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0.01 : 0.28 + (angle / Math.PI) * 0.72;

    this.flight = {
      from: bodyName,
      to: bodyName,
      elapsed: 0,
      duration,
      swapped: true,
      mode: "pan",
      cubicEase: false,
    };

    this.controls.enabled = false;
    this.currentLookAt.copy(this.startLookAt);
    this.camera.lookAt(this.currentLookAt);
    this.startQuat.copy(this.camera.quaternion);

    return true;
  };

  update = (dt: number): FocusFlightFrame => {
    if (!this.flight) {
      return idleFrame();
    }

    if (this.flight.mode === "pan") {
      return this.updatePan(dt);
    }

    const toBody = this.solarSystem[this.flight.to];
    toBody.mesh.updateWorldMatrix(true, false);
    toBody.mesh.getWorldPosition(this.destLookAt);
    const overhead = isOverheadFocus(toBody);
    if (overhead) {
      this.destPos.addVectors(this.destLookAt, this.destOffset);
      this.destUp.set(0, 1, 0);
    } else {
      this.writeDaysideDestination(toBody);
      this.destUp.copy(this.poleDir);
    }

    this.flight.elapsed += dt;
    const progress = Math.min(1, this.flight.elapsed / this.flight.duration);
    const eased = this.flight.cubicEase
      ? easeTravelCubic(progress)
      : easeTravelQuintic(progress);

    this.camera.position.lerpVectors(this.startPos, this.destPos, eased);
    this.currentLookAt.lerpVectors(this.startLookAt, this.destLookAt, eased);
    this.camera.up.lerpVectors(this.startUp, this.destUp, eased).normalize();
    if (overhead) {
      this.camera.quaternion.slerpQuaternions(
        this.startQuat,
        this.destQuat,
        eased
      );
    } else {
      this.camera.lookAt(this.currentLookAt);
    }

    const justCrossedMidpoint = !this.flight.swapped && progress >= 0.5;
    if (justCrossedMidpoint) {
      this.flight.swapped = true;
    }

    const justFinished = progress >= 1;
    const frame: FocusFlightFrame = {
      active: true,
      progress,
      from: this.flight.from,
      to: this.flight.to,
      mode: this.flight.mode,
      justCrossedMidpoint,
      justFinished,
    };

    if (justFinished) {
      this.complete();
    }

    return frame;
  };

  private updatePan = (dt: number): FocusFlightFrame => {
    const flight = this.flight;
    if (!flight) {
      return idleFrame();
    }

    const body = this.solarSystem[flight.to];
    body.mesh.updateWorldMatrix(true, false);
    body.mesh.getWorldPosition(this.destLookAt);
    this.destUp
      .set(0, 1, 0)
      .transformDirection(body.mesh.matrixWorld)
      .normalize();

    flight.elapsed += dt;
    const progress = Math.min(1, flight.elapsed / flight.duration);
    const eased = easeInOut(progress);

    this.panQuat.slerpQuaternions(this.identityQuat, this.panQuatEnd, eased);
    this.offset
      .copy(this.panStartDir)
      .applyQuaternion(this.panQuat)
      .multiplyScalar(this.panRadius);
    this.destPos.copy(this.offset);
    body.mesh.localToWorld(this.destPos);

    this.camera.position.copy(this.destPos);
    this.currentLookAt.copy(this.destLookAt);
    this.camera.up.lerpVectors(this.startUp, this.destUp, eased).normalize();
    this.camera.lookAt(this.currentLookAt);

    const justFinished = progress >= 1;
    const frame: FocusFlightFrame = {
      active: true,
      progress,
      from: flight.from,
      to: flight.to,
      mode: "pan",
      justCrossedMidpoint: false,
      justFinished,
    };

    if (justFinished) {
      this.complete();
    }

    return frame;
  };

  private detachToWorld = () => {
    this.scene.attach(this.camera);
  };

  private complete = () => {
    if (!this.flight) {
      return;
    }

    this.applyRig(this.flight.to);
    this.syncOrbitMinDistance(this.flight.to);
    this.controls.enabled = true;
    this.controls.update();
    this.camera.copy(this.fakeCamera);
    this.flight = null;
  };

  /**
   * Place the camera on the sunlit side of a planet or moon, looking at
   * its centre. Assumes `destLookAt` is already the body world position
   * and the mesh world matrix is current.
   */
  private writeDaysideDestination = (body: {
    getFocusDistance: (camera: THREE.PerspectiveCamera) => number;
    mesh: THREE.Object3D;
  }) => {
    this.solarSystem["Sun"].mesh.getWorldPosition(this.sunPos);
    this.poleDir
      .set(0, 1, 0)
      .transformDirection(body.mesh.matrixWorld)
      .normalize();
    writeDaysideOffset(
      body.getFocusDistance(this.camera),
      this.destLookAt,
      this.sunPos,
      this.poleDir,
      this.destOffset
    );
    this.destPos.addVectors(this.destLookAt, this.destOffset);
  };

  /**
   * Instantly place the camera at the default viewing pose for a body.
   * Used when restoring focus from the URL on load.
   */
  snapTo = (name: string): void => {
    const body = this.solarSystem[name];
    body.mesh.updateWorldMatrix(true, false);
    body.mesh.getWorldPosition(this.worldTarget);
    if (isOverheadFocus(body)) {
      writeOverheadOffset(
        this.controls.maxDistance,
        this.offset,
        this.camera.position,
        this.worldTarget
      );
      this.camera.position.addVectors(this.worldTarget, this.offset);
      this.camera.up.set(0, 1, 0);
    } else {
      this.destLookAt.copy(this.worldTarget);
      this.writeDaysideDestination(body);
      this.camera.position.copy(this.destPos);
      this.camera.up.copy(this.poleDir);
    }
    this.camera.lookAt(this.worldTarget);
    this.applyRig(name);
    this.syncOrbitMinDistance(name);
  };

  /**
   * Snap the camera rig to the current ride/inertial mode without changing
   * the world viewpoint.
   *
   * OrbitControls bakes the orbit axis from `object.up` once, at construction.
   * Both modes therefore keep `up` at (0, 1, 0) and parent the camera into a
   * frame whose local Y is the body's pole, so drag yaw is the same on every
   * body — including Uranus and Triton.
   */
  private applyRig = (focusName: string): void => {
    const body = this.solarSystem[focusName];
    this.syncInertialRig(body);

    if (this.rideSpin) {
      body.mesh.attach(this.camera);
    } else {
      this.inertialRig.attach(this.camera);
    }

    this.fakeCamera.position.copy(this.camera.position);
    this.fakeCamera.quaternion.copy(this.camera.quaternion);
    this.fakeCamera.up.set(0, 1, 0);
    this.camera.up.set(0, 1, 0);
    this.controls.target.set(0, 0, 0);
  };

  private syncOrbitMinDistance = (focusName: string) => {
    const body = this.solarSystem[focusName];
    this.controls.minDistance = body.getOrbitMinDistance(
      this.camera.parent === body.mesh
    );
  };

  /**
   * Place the rig at the body with the same tilt as the mesh, but without
   * daily spin. Local Y is the spin axis; OrbitControls can then use the
   * default (0, 1, 0) up vector.
   */
  private syncInertialRig = (body: { mesh: THREE.Object3D }): void => {
    body.mesh.updateWorldMatrix(true, false);
    body.mesh.getWorldPosition(this.inertialRig.position);
    body.mesh.getWorldQuaternion(this.inertialRig.quaternion);
    this.spinUndo.setFromAxisAngle(this.axisY, -body.mesh.rotation.y);
    this.inertialRig.quaternion.multiply(this.spinUndo);
    this.inertialRig.updateMatrixWorld();
  };
}
