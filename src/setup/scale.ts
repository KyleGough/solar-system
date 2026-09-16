import { getBody, isParentOrbiter, parentOf } from "./catalog";
import type { SolarSystem } from "./solar-system";
import type { PlanetaryObject } from "./planetary-object";

/** Matches the original `sqrt(radius)` compression. 1 is linear in km. */
export const DEFAULT_RADIUS_EXPONENT = 0.5;
/** Matches the original `distance^0.4` compression. 1 is linear in million km. */
export const DEFAULT_DISTANCE_EXPONENT = 0.75;

const earth = getBody("Earth");
if (!earth) {
  throw new Error("Earth catalog entry required for scene scale");
}

const EARTH_RADIUS_KM = earth.radius;
const EARTH_DISTANCE_MKM = earth.distance;

/** Scene radius of Earth at the default size exponent. Anchors the slider. */
const EARTH_SCENE_RADIUS =
  Math.pow(EARTH_RADIUS_KM, DEFAULT_RADIUS_EXPONENT) / 500;
/** Scene orbit radius of Earth at the default distance exponent. */
const EARTH_SCENE_DISTANCE = Math.pow(
  EARTH_DISTANCE_MKM,
  DEFAULT_DISTANCE_EXPONENT
);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

type ScaleFlight = {
  from: string;
  to: string;
  progress: number;
};

export type ScaleState = {
  radiusExponent: number;
  distanceExponent: number;
  focus: string;
  flight: ScaleFlight | null;
};

/**
 * Overview globe size. Earth keeps a constant scene radius so the exponent
 * changes relative proportions, not the whole system's on-screen scale.
 */
export const overviewRadius = (
  radiusKm: number,
  exponent: number
): number => {
  if (radiusKm <= 0) {
    return 0;
  }
  return Math.pow(radiusKm / EARTH_RADIUS_KM, exponent) * EARTH_SCENE_RADIUS;
};

/**
 * Overview orbit radius. Earth's heliocentric distance stays constant so
 * raising the exponent spreads (or packs) the other orbits around it.
 */
export const overviewDistance = (
  distanceMkm: number,
  exponent: number
): number => {
  if (distanceMkm <= 0) {
    return 0;
  }
  return (
    Math.pow(distanceMkm / EARTH_DISTANCE_MKM, exponent) * EARTH_SCENE_DISTANCE
  );
};

/** True size relative to a parent whose scene radius is already known. */
const localRadius = (
  radiusKm: number,
  parentRadiusKm: number,
  parentSceneRadius: number
): number => {
  if (parentRadiusKm <= 0) {
    return 0;
  }
  return (radiusKm / parentRadiusKm) * parentSceneRadius;
};

/**
 * Focused moon orbit as a power of true parent-radii distance. 1 would be
 * linear (Moon at ~60 Earth radii); 0.75 keeps the order of magnitude
 * without the full empty gap. Bodies with `trueScaleOrbit` always use 1.
 */
const LOCAL_MOON_DISTANCE_EXPONENT = 0.75;

const localDistance = (
  distanceMkm: number,
  parentRadiusKm: number,
  parentSceneRadius: number,
  exponent: number = LOCAL_MOON_DISTANCE_EXPONENT
): number => {
  if (parentRadiusKm <= 0) {
    return 0;
  }
  const parentRadii = (distanceMkm * 1_000_000) / parentRadiusKm;
  return Math.pow(parentRadii, exponent) * parentSceneRadius;
};

export const localMoonOrbitRadius = (
  moon: PlanetaryObject,
  parent: PlanetaryObject
): number =>
  localDistance(
    moon.catalogDistance,
    parent.catalogRadius,
    parent.radius,
    moon.trueScaleOrbit ? 1 : LOCAL_MOON_DISTANCE_EXPONENT
  );

const moonLocalWeight = (
  moon: PlanetaryObject,
  state: ScaleState
): number => {
  if (!isParentOrbiter(moon.type) || !moon.orbits) {
    return 0;
  }

  const host = moon.orbits;
  const fromHost = parentOf(state.flight?.from ?? state.focus);
  const toHost = parentOf(state.flight?.to ?? state.focus);
  const weightFor = (name: string): number =>
    name !== "Sun" && name === host ? 1 : 0;

  const fromWeight = weightFor(fromHost);
  const toWeight = weightFor(toHost);
  if (!state.flight || fromWeight === toWeight) {
    return toWeight;
  }

  return lerp(fromWeight, toWeight, smoothstep(state.flight.progress));
};

const sceneSize = (
  body: PlanetaryObject,
  parent: PlanetaryObject | undefined,
  state: ScaleState
): { radius: number; distance: number } => {
  const overviewR = overviewRadius(body.catalogRadius, state.radiusExponent);
  const overviewD = overviewDistance(
    body.catalogDistance,
    state.distanceExponent
  );

  const keepOutsideParent = (
    radius: number,
    distance: number,
    allowTrueScale: boolean
  ): number => {
    if (!isParentOrbiter(body.type) || !parent) {
      return distance;
    }
    // Focused true-scale LEO must keep catalog altitude; overview still
    // clamps so tiny orbits are not buried inside the parent globe.
    if (allowTrueScale && body.trueScaleOrbit) {
      return distance;
    }
    return Math.max(distance, parent.radius + radius * 2);
  };

  const weight = moonLocalWeight(body, state);
  if (weight <= 0 || !parent) {
    return {
      radius: overviewR,
      distance: keepOutsideParent(overviewR, overviewD, false),
    };
  }

  const radius = lerp(
    overviewR,
    localRadius(body.catalogRadius, parent.catalogRadius, parent.radius),
    weight
  );
  const localExponent = body.trueScaleOrbit ? 1 : LOCAL_MOON_DISTANCE_EXPONENT;
  return {
    radius,
    distance: keepOutsideParent(
      radius,
      lerp(
        overviewD,
        localDistance(
          body.catalogDistance,
          parent.catalogRadius,
          parent.radius,
          localExponent
        ),
        weight
      ),
      true
    ),
  };
};

/**
 * Apply overview exponents and, when a planet (or its moon) is in focus,
 * lerp that planet's moons toward true size and a 0.75-power of true distance.
 */
export const applySceneScale = (
  solarSystem: SolarSystem,
  state: ScaleState
): void => {
  for (const body of Object.values(solarSystem)) {
    if (body.type === "ring") {
      const parent = body.orbits ? solarSystem[body.orbits] : undefined;
      if (parent) {
        body.setRingScale(parent.radius);
      }
      continue;
    }

    const parent = body.orbits ? solarSystem[body.orbits] : undefined;
    const { radius, distance } = sceneSize(body, parent, state);
    body.setSceneSize(radius, distance);
  }
};

export const outerOrbitRadius = (solarSystem: SolarSystem): number => {
  let max = 0;
  for (const body of Object.values(solarSystem)) {
    if (body.type === "planet") {
      max = Math.max(max, body.distance);
    }
  }
  return max;
};
