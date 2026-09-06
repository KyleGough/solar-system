import planetData from "../planets.json";
import type { AtmosphereGlowParams } from "./atmosphere-glow";
import type { PointOfInterest } from "./label";

export type BodyType = "star" | "planet" | "moon" | "ring";

export interface TexturePaths {
  map: string;
  bump?: string;
  normal?: string;
  atmosphere?: string;
  atmosphereAlpha?: string;
  specular?: string;
  night?: string;
}

export interface Body {
  name: string;
  radius: number;
  /** Mass in kilograms. Omitted for non-physical bodies such as rings. */
  mass?: number;
  distance: number;
  period: number;
  daylength: number;
  /** Hours for one cloud-layer rotation. Faster than daylength so weather drifts. */
  cloudPeriod?: number;
  /** Sphere albedo maps. Omit when `model` supplies the surface. */
  textures?: TexturePaths;
  /** glTF path for irregular bodies, scaled to `radius`. */
  model?: string;
  type: BodyType;
  tilt: number;
  /** Orbital inclination in degrees to the parent’s orbital plane. */
  inclination?: number;
  /**
   * If true, this orbit is attached to the parent’s equator (tilted, not
   * spinning). Moons and rings default to that; planets use the parent’s
   * inertial frame so inclination is measured from the ecliptic.
   */
  equatorialOrbit?: boolean;
  orbits?: string;
  labels?: PointOfInterest[];
  description?: string;
  traversable: boolean;
  offset?: number;
  stats?: Array<[string, string]>;
  /** 0–1 opacity of the cloud-layer mesh. Defaults to 1. */
  atmosphereOpacity?: number;
  /** Limb haze for bodies with a visible atmosphere. */
  atmosphereGlow?: AtmosphereGlowParams;
}

export const bodies: readonly Body[] = planetData as Body[];

export const bodyByName: ReadonlyMap<string, Body> = new Map(
  bodies.map((body) => [body.name, body])
);

export const getBody = (name: string): Body | undefined => bodyByName.get(name);

export const traversableBodies: readonly Body[] = bodies.filter(
  (body) => body.traversable
);

/** The Sun and planets, in order of heliocentric distance. */
export const primaries: readonly Body[] = traversableBodies
  .filter((body) => body.type === "star" || body.type === "planet")
  .sort((a, b) => a.distance - b.distance);

const moonLists = new Map<string, Body[]>();

for (const body of traversableBodies) {
  if (body.type !== "moon" || !body.orbits) continue;
  const list = moonLists.get(body.orbits) ?? [];
  list.push(body);
  moonLists.set(body.orbits, list);
}

for (const list of moonLists.values()) {
  list.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
}

export const moonsByParent: ReadonlyMap<string, readonly Body[]> = moonLists;

/** Nav parent: a moon’s host planet, otherwise the body itself. */
export const parentOf = (name: string): string => {
  const body = bodyByName.get(name);
  if (body?.type === "moon" && body.orbits) return body.orbits;
  return name;
};
