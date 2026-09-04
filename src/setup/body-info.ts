import type { Body } from "./planetary-object";
import planetData from "../planets.json";
import { isIntroActive } from "./loading";
import {
  formatDistance,
  formatHours,
  formatKm,
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

let canvasEl: HTMLElement | null = null;
let orbitNavEl: HTMLElement | null = null;
let minimised = false;

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

const setMinimised = (next: boolean, moveFocus = false) => {
  minimised = next;
  const panel = panelEl();
  if (!panel) return;
  panel.classList.toggle("is-minimised", minimised);

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

const appendStat = (root: HTMLElement, label: string, value: string) => {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  root.append(dt, dd);
};

const fillStats = (body: Body, root: HTMLElement) => {
  root.replaceChildren();
  for (const [label, value] of statsFor(body)) {
    appendStat(root, label, value);
  }
};

const statsFor = (body: Body): Array<[string, string]> => {
  const rows: Array<[string, string]> = [["Radius", formatKm(body.radius)]];

  if (body.orbits && body.distance > 0) {
    rows.push(["Distance", formatDistance(body.distance)]);
  }

  if (body.orbits && body.period !== 0) {
    rows.push(["Orbital period", formatPeriodDuration(body.period)]);
  }

  if (body.type !== "moon") {
    rows.push(["Day length", formatHours(body.daylength)]);
  }

  rows.push(["Axial tilt", formatTilt(body.tilt)]);

  return rows;
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
  if (stats) fillStats(body, stats);

  setOpen(true);
};

export const createBodyInfo = (
  canvas: HTMLElement,
  orbitNav: HTMLElement
): void => {
  canvasEl = canvas;
  orbitNavEl = orbitNav;
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
