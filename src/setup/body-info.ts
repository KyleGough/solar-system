import type { Body } from "./planetary-object";
import type { PointOfInterest } from "./label";
import planetData from "../planets.json";
import { isIntroActive } from "./loading";
import {
  formatDistance,
  formatHours,
  formatKm,
  formatMass,
  formatPeriodDuration,
  formatTilt,
} from "./format";

const bodies = planetData as Body[];
const DOCK_BOTTOM_QUERY = "(width < 1450px)";
const NAV_GAP = 12;

const panelEl = () => document.getElementById("body-info");
const kickerEl = () => document.getElementById("body-info-kicker");
const blurbEl = () => document.getElementById("body-info-blurb");
const statsEl = () => document.getElementById("body-info-stats");
const pipsEl = () => document.getElementById("body-info-pips");

let canvasEl: HTMLElement | null = null;
let orbitNavEl: HTMLElement | null = null;
let minimised = false;
let pipBodyName = "";
let pipList: PointOfInterest[] = [];
let onPoiPick: ((bodyName: string, poi: PointOfInterest) => void) | null = null;
let onPoiClose: (() => void) | null = null;

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".lil-gui")) return true;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
};

const isDockedBottom = () => window.matchMedia(DOCK_BOTTOM_QUERY).matches;

const syncPanelDock = () => {
  const nav = orbitNavEl;
  const panel = panelEl();
  if (!panel) return;

  if (!nav || !isDockedBottom()) {
    panel.style.removeProperty("--body-info-nav-offset");
    return;
  }

  const offset = Math.max(
    0,
    Math.round(window.innerHeight - nav.getBoundingClientRect().top + NAV_GAP)
  );
  panel.style.setProperty("--body-info-nav-offset", `${offset}px`);
};

const syncToolbar = (moveFocus = false) => {
  const panel = panelEl();
  if (!panel) return;
  const isPoi = panel.classList.contains("is-poi");

  const restore = document.getElementById("body-info-restore");
  const minimise = document.getElementById("body-info-minimise");
  const close = document.getElementById("body-info-close");
  const maximise = document.getElementById("body-info-maximise");
  restore?.toggleAttribute("hidden", !minimised);
  minimise?.toggleAttribute("hidden", minimised || isPoi);
  close?.toggleAttribute("hidden", minimised || !isPoi);
  maximise?.toggleAttribute("hidden", !minimised);

  if (!moveFocus) return;
  if (minimised) {
    maximise?.focus();
  } else if (isPoi) {
    close?.focus();
  } else {
    minimise?.focus();
  }
};

const setMinimised = (next: boolean, moveFocus = false) => {
  minimised = next;
  const panel = panelEl();
  if (!panel) return;
  panel.classList.toggle("is-minimised", minimised);
  syncToolbar(moveFocus);
};

const setOpen = (open: boolean) => {
  const panel = panelEl();
  if (!panel) return;
  panel.hidden = !open;
  if (open) {
    setMinimised(minimised);
  }
  syncPanelDock();
};

const closePanel = () => {
  setMinimised(false);
  setOpen(false);
  canvasEl?.focus({ preventScroll: true });
};

const appendStat = (root: HTMLElement, label: string, value: string | Node) => {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.append(value);
  root.append(dt, dd);
};

const massValue = (kg: number): DocumentFragment => {
  const { mantissa, exponent } = formatMass(kg);
  const value = document.createDocumentFragment();
  const sup = document.createElement("sup");
  sup.textContent = String(exponent);
  value.append(`${mantissa} × 10`, sup, " kg");
  return value;
};

const fillStats = (body: Body, root: HTMLElement) => {
  root.replaceChildren();
  for (const [label, value] of statsFor(body)) {
    appendStat(root, label, value);
  }
};

const statsFor = (body: Body): Array<[string, string | Node]> => {
  const rows: Array<[string, string | Node]> = [
    ["Radius", formatKm(body.radius)],
  ];

  if (body.mass != null) {
    rows.push(["Mass", massValue(body.mass)]);
  }

  if (body.orbits && body.distance > 0) {
    rows.push(["Distance", formatDistance(body.distance)]);
  }

  if (body.orbits && body.period !== 0) {
    rows.push(["Orbital period", formatPeriodDuration(body.period)]);
  }

  if (body.type !== "moon" && body.type !== "star") {
    rows.push(["Day length", formatHours(body.daylength)]);
  }

  if (body.type !== "star") {
    rows.push(["Axial tilt", formatTilt(body.tilt)]);
  }

  if (body.stats) {
    rows.push(...body.stats);
  }

  return rows;
};

const clearPips = () => {
  const pips = pipsEl();
  if (!pips) return;
  pips.replaceChildren();
  pips.hidden = true;
  pipBodyName = "";
  pipList = [];
};

const fillPips = (
  bodyName: string,
  pois: PointOfInterest[],
  activeName: string
) => {
  const pips = pipsEl();
  if (!pips) return;

  pipBodyName = bodyName;
  pipList = pois;
  pips.replaceChildren();
  pips.hidden = pois.length === 0;

  for (const poi of pois) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "body-info-pip";
    button.dataset.poi = poi.name;
    button.setAttribute("aria-label", poi.name);
    const current = poi.name === activeName;
    button.classList.toggle("is-current", current);
    if (current) {
      button.setAttribute("aria-current", "true");
    }
    pips.append(button);
  }
};

export const updateBodyInfo = (name: string): void => {
  const body = bodies.find((entry) => entry.name === name);
  if (!body || !body.traversable) return;

  const kicker = kickerEl();
  const blurb = blurbEl();
  const stats = statsEl();
  if (kicker) kicker.textContent = body.type;
  if (blurb) blurb.textContent = body.description ?? "";
  if (blurb) blurb.hidden = !body.description;
  if (stats) {
    stats.hidden = false;
    fillStats(body, stats);
  }
  clearPips();
  panelEl()?.classList.remove("is-poi");

  setOpen(true);
};

export const updatePoiInfo = (bodyName: string, poi: PointOfInterest): void => {
  const body = bodies.find((entry) => entry.name === bodyName);
  if (!body || !body.traversable) return;

  const kicker = kickerEl();
  const blurb = blurbEl();
  const stats = statsEl();
  if (kicker) kicker.textContent = poi.name;
  if (blurb) {
    blurb.textContent = poi.fact ?? "";
    blurb.hidden = !poi.fact;
  }
  if (stats) stats.hidden = true;
  fillPips(bodyName, body.labels ?? [], poi.name);
  panelEl()?.classList.add("is-poi");

  setMinimised(false);
  setOpen(true);
};

export const createBodyInfo = (
  canvas: HTMLElement,
  orbitNav: HTMLElement,
  onPick?: (bodyName: string, poi: PointOfInterest) => void,
  onClose?: () => void
): void => {
  canvasEl = canvas;
  orbitNavEl = orbitNav;
  onPoiPick = onPick ?? null;
  onPoiClose = onClose ?? null;
  canvas.setAttribute("tabindex", "-1");

  const minimise = document.getElementById("body-info-minimise");
  minimise?.addEventListener("click", () => {
    if (isIntroActive()) return;
    setMinimised(true, true);
  });

  const close = document.getElementById("body-info-close");
  close?.addEventListener("click", () => {
    if (isIntroActive()) return;
    onPoiClose?.();
    syncToolbar(true);
  });

  const expand = () => {
    if (isIntroActive()) return;
    setMinimised(false, true);
  };

  const restore = document.getElementById("body-info-restore");
  restore?.addEventListener("click", expand);

  const maximise = document.getElementById("body-info-maximise");
  maximise?.addEventListener("click", expand);

  pipsEl()?.addEventListener("click", (event) => {
    if (isIntroActive()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button[data-poi]");
    if (!(button instanceof HTMLButtonElement)) return;
    const name = button.dataset.poi;
    if (!name || button.classList.contains("is-current")) return;
    const poi = pipList.find((entry) => entry.name === name);
    if (!poi || !pipBodyName) return;
    onPoiPick?.(pipBodyName, poi);
  });

  window.addEventListener("keydown", (event) => {
    if (isIntroActive()) return;
    if (event.key !== "Escape") return;
    if (isEditableTarget(event.target)) return;
    const panel = panelEl();
    if (!panel || panel.hidden) return;
    event.preventDefault();
    closePanel();
  });

  window.addEventListener("resize", syncPanelDock);
  new ResizeObserver(syncPanelDock).observe(orbitNav);
  syncPanelDock();
};
