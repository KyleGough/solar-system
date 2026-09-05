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
const figureEl = () => document.getElementById("body-info-figure");
const imageEl = () =>
  document.getElementById("body-info-image") as HTMLImageElement | null;
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

  const restore = document.getElementById("body-info-restore");
  const minimise = document.getElementById("body-info-minimise");
  const maximise = document.getElementById("body-info-maximise");
  restore?.toggleAttribute("hidden", !minimised);
  minimise?.toggleAttribute("hidden", minimised);
  maximise?.toggleAttribute("hidden", !minimised);

  if (!moveFocus) return;
  if (minimised) {
    maximise?.focus();
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

  if (body.inclination) {
    rows.push(["Orbital inclination", formatTilt(body.inclination)]);
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

const clearPoiImage = () => {
  const figure = figureEl();
  const image = imageEl();
  if (image) {
    image.removeAttribute("src");
    image.alt = "";
  }
  if (figure) figure.hidden = true;
};

const fillPoiImage = (poi: PointOfInterest) => {
  const figure = figureEl();
  const image = imageEl();
  if (!figure || !image) return;

  if (!poi.image) {
    clearPoiImage();
    return;
  }

  image.src = poi.image;
  image.alt = poi.imageAlt ?? "";
  figure.hidden = false;
};

const appendPip = (
  root: HTMLElement,
  label: string,
  current: boolean,
  dataset: Record<string, string>
) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "body-info-pip";
  Object.assign(button.dataset, dataset);
  button.setAttribute("aria-label", label);
  button.classList.toggle("is-current", current);
  if (current) {
    button.setAttribute("aria-current", "true");
  }
  root.append(button);
};

const fillPips = (
  bodyName: string,
  pois: PointOfInterest[],
  activeName: string | null = null
) => {
  const pips = pipsEl();
  if (!pips) return;

  pipBodyName = bodyName;
  pipList = pois;
  pips.replaceChildren();

  const showPips = pois.length > 0;
  pips.hidden = !showPips;
  panelEl()?.classList.toggle("has-pips", showPips);
  if (!showPips) return;

  appendPip(pips, "Overview", activeName === null, { page: "stats" });

  for (const poi of pois) {
    appendPip(pips, poi.name, poi.name === activeName, { poi: poi.name });
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
  clearPoiImage();
  fillPips(name, body.labels ?? []);
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
  fillPoiImage(poi);
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
    const button = target.closest("button.body-info-pip");
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.classList.contains("is-current")) return;
    if (button.dataset.page === "stats") {
      onPoiClose?.();
      return;
    }
    const name = button.dataset.poi;
    if (!name || !pipBodyName) return;
    const poi = pipList.find((entry) => entry.name === name);
    if (!poi) return;
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
