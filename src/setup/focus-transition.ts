import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SolarSystem } from "./solar-system";

const MIN_DURATION = 0.6;
const MAX_DURATION = 4.0;
const MIN_DIST = 1;
const MAX_DIST = 25;

const easeInOut = (t: number): number => t * t * (3 - 2 * t);

const durationFromDistance = (distance: number): number => {
  const t = Math.min(
    1,
    Math.max(0, (distance - MIN_DIST) / (MAX_DIST - MIN_DIST))
  );
  return MIN_DURATION + t * (MAX_DURATION - MIN_DURATION);
};

export type FocusFlightFrame = {
  active: boolean;
  progress: number;
  from: string;
  to: string;
  justCrossedMidpoint: boolean;
  justFinished: boolean;
};

type Flight = {
  from: string;
  to: string;
  elapsed: number;
  duration: number;
  swapped: boolean;
};

const writeFocusOffset = (
  body: { getFocusDistance: () => number },
  target: THREE.Vector3
) => {
  const distance = body.getFocusDistance();
  target.set(distance, distance / 3, 0);
};

export class FocusTransition {
  private flight: Flight | null = null;
  private readonly startPos = new THREE.Vector3();
  private readonly startLookAt = new THREE.Vector3();
  private readonly startUp = new THREE.Vector3();
  private readonly destPos = new THREE.Vector3();
  private readonly destLookAt = new THREE.Vector3();
  private readonly destUp = new THREE.Vector3();
  private readonly currentLookAt = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly fakeCamera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
    private readonly solarSystem: SolarSystem
  ) {}

  isActive = (): boolean => this.flight !== null;

  destination = (): string | null => this.flight?.to ?? null;

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

    writeFocusOffset(toBody, this.offset);
    toBody.mesh.localToWorld(this.destPos.copy(this.offset));
    const distance = this.startPos.distanceTo(this.destPos);

    this.flight = {
      from: this.flight?.swapped ? this.flight.to : this.flight?.from ?? from,
      to,
      elapsed: 0,
      duration: durationFromDistance(distance),
      swapped: false,
    };

    this.controls.enabled = false;
    this.currentLookAt.copy(this.startLookAt);
    this.camera.position.copy(this.startPos);
    this.camera.up.copy(this.startUp);
    this.camera.lookAt(this.currentLookAt);

    return true;
  };

  update = (dt: number): FocusFlightFrame => {
    if (!this.flight) {
      return {
        active: false,
        progress: 1,
        from: "",
        to: "",
        justCrossedMidpoint: false,
        justFinished: false,
      };
    }

    const toBody = this.solarSystem[this.flight.to];
    writeFocusOffset(toBody, this.offset);
    toBody.mesh.localToWorld(this.destPos.copy(this.offset));
    toBody.mesh.getWorldPosition(this.destLookAt);
    this.destUp
      .set(0, 1, 0)
      .transformDirection(toBody.mesh.matrixWorld)
      .normalize();

    this.flight.elapsed += dt;
    const progress = Math.min(1, this.flight.elapsed / this.flight.duration);
    const eased = easeInOut(progress);

    this.camera.position.lerpVectors(this.startPos, this.destPos, eased);
    this.currentLookAt.lerpVectors(this.startLookAt, this.destLookAt, eased);
    this.camera.up.lerpVectors(this.startUp, this.destUp, eased).normalize();
    this.camera.lookAt(this.currentLookAt);

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
      justCrossedMidpoint,
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

    const toBody = this.solarSystem[this.flight.to];
    toBody.mesh.attach(this.camera);
    this.camera.up.set(0, 1, 0);

    this.fakeCamera.position.copy(this.camera.position);
    this.fakeCamera.quaternion.copy(this.camera.quaternion);
    this.fakeCamera.up.set(0, 1, 0);

    this.controls.minDistance = toBody.getMinDistance();
    this.controls.enabled = true;
    this.flight = null;
  };
}
