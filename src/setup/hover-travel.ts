import * as THREE from "three";
import { BODY_SWATCH, FALLBACK_SWATCH } from "./swatch";
import { isIntroActive } from "./loading";
import type { SolarSystem } from "./solar-system";

const CLICK_DRAG_PX = 8;
const GAP_X = 14;
const GAP_Y = 10;
const EDGE = 8;

type HoverTravel = {
  hide: () => void;
};

const createHoverChip = () => {
  const root = document.createElement("div");
  root.className = "hover-chip";
  root.setAttribute("aria-hidden", "true");

  const disc = document.createElement("span");
  disc.className = "hover-chip-disc";

  const nameEl = document.createElement("span");
  nameEl.className = "hover-chip-name";

  root.append(disc, nameEl);
  document.body.append(root);

  let shownName: string | null = null;
  let x = 0;
  let y = 0;

  const place = () => {
    const width = root.offsetWidth;
    const height = root.offsetHeight;
    let left = x + GAP_X;
    let top = y + GAP_Y;
    if (left + width > window.innerWidth - EDGE) {
      left = x - GAP_X - width;
    }
    if (top + height > window.innerHeight - EDGE) {
      top = y - GAP_Y - height;
    }
    left = Math.max(EDGE, left);
    top = Math.max(EDGE, top);
    root.style.transform = `translate(${left}px, ${top}px)`;
  };

  const hide = () => {
    if (!shownName) return;
    shownName = null;
    root.classList.remove("is-on");
  };

  const show = (name: string, clientX: number, clientY: number) => {
    x = clientX;
    y = clientY;
    if (shownName !== name) {
      shownName = name;
      nameEl.textContent = name;
      const swatch = BODY_SWATCH[name] ?? FALLBACK_SWATCH;
      disc.style.setProperty("--disc", swatch.color);
      root.classList.add("is-on");
    }
    place();
  };

  return { show, hide };
};

const resolveBodyName = (object: THREE.Object3D): string | null => {
  let current: THREE.Object3D | null = object;
  if (current.userData.ignorePick) {
    return null;
  }

  while (current) {
    if (current.userData.traversable === false) {
      return null;
    }
    if (current.userData.traversable && current.userData.bodyName) {
      return current.userData.bodyName as string;
    }
    current = current.parent;
  }

  return null;
};

const createBodyPicker = (
  camera: THREE.Camera,
  canvas: HTMLElement,
  solarSystem: SolarSystem
) => {
  const raycaster = new THREE.Raycaster();
  raycaster.layers.enableAll();
  const pointer = new THREE.Vector2();
  const sun = solarSystem["Sun"].orbit;

  const pick = (clientX: number, clientY: number): string | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(sun, true);
    for (const hit of hits) {
      const name = resolveBodyName(hit.object);
      if (name) {
        return name;
      }
    }
    return null;
  };

  return { pick };
};

export const createHoverTravel = (opts: {
  camera: THREE.Camera;
  canvas: HTMLElement;
  solarSystem: SolarSystem;
  getFocus: () => string;
  isTraveling: () => boolean;
  isPoiHover: (clientX: number, clientY: number) => boolean;
  onTravel: (name: string) => void;
}): HoverTravel => {
  const picker = createBodyPicker(opts.camera, opts.canvas, opts.solarSystem);
  const chip = createHoverChip();
  const canvas = opts.canvas;

  const onHoverPick = (
    clientX: number,
    clientY: number,
    pointerType: string,
    buttons: number
  ) => {
    if (isIntroActive()) return;
    if (opts.isTraveling()) {
      canvas.style.cursor = "default";
      chip.hide();
      return;
    }

    if (opts.isPoiHover(clientX, clientY)) {
      canvas.style.cursor = "crosshair";
      chip.hide();
      return;
    }

    const name = picker.pick(clientX, clientY);
    canvas.style.cursor = name ? "pointer" : "default";

    if (
      name &&
      name !== opts.getFocus() &&
      pointerType !== "touch" &&
      buttons === 0
    ) {
      chip.show(name, clientX, clientY);
    } else {
      chip.hide();
    }
  };

  let pointerDownX = 0;
  let pointerDownY = 0;

  canvas.addEventListener("pointermove", (event) => {
    onHoverPick(event.clientX, event.clientY, event.pointerType, event.buttons);
  });

  canvas.addEventListener("pointerleave", () => {
    canvas.style.cursor = "default";
    chip.hide();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    chip.hide();
  });

  canvas.addEventListener("click", (event) => {
    if (isIntroActive()) return;
    if (Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > CLICK_DRAG_PX) {
      return;
    }
    if (opts.isPoiHover(event.clientX, event.clientY)) {
      return;
    }
    const name = picker.pick(event.clientX, event.clientY);
    if (name) {
      opts.onTravel(name);
    }
  });

  return { hide: chip.hide };
};
