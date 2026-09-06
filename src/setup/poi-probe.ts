import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import GUI from "lil-gui";
import { poiAnglesFromLocal, poiLocalPosition } from "./label";
import { isIntroActive } from "./loading";
import type { SolarSystem } from "./solar-system";
import type { PlanetaryObject } from "./planetary-object";

const ANGLE_RANGE = Math.PI;
const DRAG_PX = 8;
const SURFACE_LIFT = 1.006;
const BRASS = 0xe0b45c;
const INK = 0x1c1810;

const round2 = (n: number): number => Math.round(n * 100) / 100;

const jsonSnippet = (y: number, z: number): string =>
  `"y": ${round2(y)},\n"z": ${round2(z)}`;

const coordsText = (y: number, z: number): string =>
  `y ${round2(y).toFixed(2)}  z ${round2(z).toFixed(2)}`;

export const createPoiProbe = (
  gui: GUI,
  camera: THREE.Camera,
  canvas: HTMLElement,
  solarSystem: SolarSystem,
  getFocus: () => string
) => {
  const state = {
    enabled: false,
    y: 0,
    z: 0,
    copyJson() {
      const text = jsonSnippet(state.y, state.z);
      void navigator.clipboard.writeText(text).then(flashCopied);
    },
  };

  const raycaster = new THREE.Raycaster();
  raycaster.layers.enableAll();
  const pointer = new THREE.Vector2();
  const localHit = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const outward = new THREE.Vector3(0, 0, 1);
  const worldCam = new THREE.Vector3();
  const toCamera = new THREE.Vector3();

  const group = new THREE.Group();
  group.userData.ignorePick = true;
  group.visible = false;

  const brassMat = new THREE.MeshBasicMaterial({
    color: BRASS,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const inkMat = new THREE.MeshBasicMaterial({
    color: INK,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const ringInk = new THREE.Mesh(new THREE.RingGeometry(0.048, 0.07, 48), inkMat);
  const ringBrass = new THREE.Mesh(
    new THREE.RingGeometry(0.022, 0.048, 48),
    brassMat
  );
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 16), brassMat);
  pin.position.z = 0.018;
  group.add(ringInk, ringBrass, pin);

  const readoutEl = document.createElement("button");
  readoutEl.type = "button";
  readoutEl.className = "poi-probe";
  readoutEl.title = "Copy y, z JSON";

  const mark = document.createElement("span");
  mark.className = "poi-probe-mark";
  mark.setAttribute("aria-hidden", "true");

  const coords = document.createElement("span");
  coords.className = "poi-probe-coords";
  coords.textContent = coordsText(0, 0);

  readoutEl.append(mark, coords);

  const readout = new CSS2DObject(readoutEl);
  readout.center.set(0, 0.5);
  readout.position.set(0.12, 0, 0.02);
  readout.userData.ignorePick = true;
  group.add(readout);
  group.traverse((child) => {
    child.userData.ignorePick = true;
    child.frustumCulled = false;
  });

  let attached: PlanetaryObject | null = null;
  let copiedTimer = 0;
  let downX = 0;
  let downY = 0;
  let downValid = false;

  const focusedBody = (): PlanetaryObject | null => {
    const object = solarSystem[getFocus()];
    if (!object || object.type === "ring") return null;
    return object;
  };

  const attachTo = (object: PlanetaryObject) => {
    if (attached === object) return;
    attached?.mesh.remove(group);
    object.mesh.add(group);
    attached = object;
  };

  const syncReadout = () => {
    if (copiedTimer) return;
    coords.textContent = coordsText(state.y, state.z);
  };

  const flashCopied = () => {
    window.clearTimeout(copiedTimer);
    coords.textContent = "Copied";
    copiedTimer = window.setTimeout(() => {
      copiedTimer = 0;
      coords.textContent = coordsText(state.y, state.z);
    }, 1100);
  };

  const apply = () => {
    const object = focusedBody();
    if (!object || !state.enabled) {
      group.visible = false;
      return;
    }

    attachTo(object);
    group.scale.setScalar(object.meshLocalRadius);
    poiLocalPosition(
      object.meshLocalRadius * SURFACE_LIFT,
      state.y,
      state.z,
      group.position
    );
    radial.copy(group.position).normalize();
    group.quaternion.setFromUnitVectors(outward, radial);
    group.visible = true;
    syncReadout();
  };

  const sampleWorldPoint = (worldPoint: THREE.Vector3) => {
    const object = focusedBody();
    if (!object) return;
    localHit.copy(worldPoint);
    object.mesh.worldToLocal(localHit);
    const angles = poiAnglesFromLocal(localHit);
    state.y = round2(angles.y);
    state.z = round2(angles.z);
    yCtrl.updateDisplay();
    zCtrl.updateDisplay();
    apply();
  };

  const hitFocused = (clientX: number, clientY: number): THREE.Vector3 | null => {
    const object = focusedBody();
    if (!object) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(object.mesh, false);
    if (!hits[0]) return null;
    return hitPoint.copy(hits[0].point);
  };

  const folder = gui.addFolder("POI Probe");
  folder
    .add(state, "enabled")
    .name("Click to sample")
    .onChange(() => {
      apply();
    });
  const yCtrl = folder
    .add(state, "y", -ANGLE_RANGE, ANGLE_RANGE, 0.01)
    .name("Y")
    .onChange(apply);
  const zCtrl = folder
    .add(state, "z", -ANGLE_RANGE, ANGLE_RANGE, 0.01)
    .name("Z")
    .onChange(apply);
  folder.add(state, "copyJson").name("Copy JSON");

  readoutEl.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.copyJson();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.enabled || isIntroActive()) {
      downValid = false;
      return;
    }
    if (event.button !== 0) {
      downValid = false;
      return;
    }
    downValid = true;
    downX = event.clientX;
    downY = event.clientY;
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!downValid || !state.enabled || isIntroActive()) return;
    downValid = false;
    if (event.button !== 0) return;
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > DRAG_PX) {
      return;
    }
    const point = hitFocused(event.clientX, event.clientY);
    if (point) {
      sampleWorldPoint(point);
    }
  });

  return {
    sync: apply,
    isHovering: (clientX: number, clientY: number): boolean => {
      if (!state.enabled || isIntroActive()) return false;
      return hitFocused(clientX, clientY) !== null;
    },
    update: (renderCamera: THREE.Camera) => {
      if (!state.enabled || !attached || !group.visible) return;
      renderCamera.getWorldPosition(worldCam);
      attached.mesh.worldToLocal(worldCam);
      toCamera.copy(worldCam).normalize();
      radial.copy(group.position).normalize();
      const facing = radial.dot(toCamera);
      const show = facing > 0.18;
      readoutEl.style.opacity = show ? "1" : "0";
      readoutEl.style.pointerEvents = show ? "auto" : "none";
    },
  };
};
