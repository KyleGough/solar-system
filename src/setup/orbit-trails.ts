import { setTrailOpacity } from "./path";
import type { SolarSystem } from "./solar-system";

const TOGGLE_PLANET = 0.55;
const TOGGLE_MOON = 0.42;
const FLIGHT = 0.92;
const LINGER = 1.25;

let lingerFrom = "";
let lingerTo = "";
let lingerLeft = 0;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const hostOf = (name: string, solarSystem: SolarSystem): string => {
  const body = solarSystem[name];
  if (body?.type === "moon" && body.orbits) {
    return body.orbits;
  }
  return name;
};

const addFlightBody = (
  lit: Set<string>,
  name: string,
  solarSystem: SolarSystem
) => {
  if (!name || !solarSystem[name]?.path) {
    return;
  }
  lit.add(name);
  const host = hostOf(name, solarSystem);
  if (host !== name && solarSystem[host]?.path) {
    lit.add(host);
  }
};

export const updateOrbitTrails = (
  solarSystem: SolarSystem,
  dt: number,
  state: {
    showAll: boolean;
    focus: string;
    flying: boolean;
    from: string;
    to: string;
    justFinished: boolean;
  }
) => {
  if (state.justFinished && state.to) {
    lingerFrom = state.from;
    lingerTo = state.to;
    lingerLeft = LINGER;
  }

  if (state.flying) {
    lingerLeft = 0;
  } else if (lingerLeft > 0) {
    lingerLeft -= dt;
  }

  const lit = new Set<string>();
  if (state.flying) {
    addFlightBody(lit, state.from, solarSystem);
    addFlightBody(lit, state.to, solarSystem);
  } else if (lingerLeft > 0) {
    addFlightBody(lit, lingerTo, solarSystem);
    if (lingerLeft > LINGER * 0.45) {
      addFlightBody(lit, lingerFrom, solarSystem);
    }
  }

  const focusSystem = hostOf(state.focus, solarSystem);
  const snap = reducedMotion.matches;

  for (const [name, object] of Object.entries(solarSystem)) {
    if (!object.path) {
      continue;
    }

    let target = 0;
    if (state.showAll && object.type === "planet") {
      target = TOGGLE_PLANET;
    }
    if (
      state.showAll &&
      object.type === "moon" &&
      object.orbits === focusSystem
    ) {
      target = TOGGLE_MOON;
    }
    if (lit.has(name)) {
      target = Math.max(target, FLIGHT);
    }

    const current = (object.path.userData.trailOpacity as number) ?? 0;
    let next = target;
    if (!snap) {
      const rate = target > current ? 10 : 3.8;
      next = current + (target - current) * (1 - Math.exp(-dt * rate));
      if (Math.abs(next - target) < 0.004) {
        next = target;
      }
    }
    setTrailOpacity(object.path, next);
  }
};
