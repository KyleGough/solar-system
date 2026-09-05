import type { Scene } from "three";
import planetData from "../planets.json";
import { Body, PlanetaryObject } from "./planetary-object";
import { setTextureCount } from "./textures";

export type SolarSystem = Record<string, PlanetaryObject>;

export const createSolarSystem = (scene: Scene): SolarSystem => {
  const solarSystem: SolarSystem = {};
  let textureCount = 0;

  const planets: Body[] = (planetData as Body[]).map((planet) => ({ ...planet }));

  for (const planet of planets) {
    const name = planet.name;

    const parent = planet.orbits ? solarSystem[planet.orbits] : undefined;
    const object = new PlanetaryObject(planet, parent);
    object.mesh.userData.bodyName = name;
    object.mesh.userData.traversable = planet.traversable;

    solarSystem[name] = object;

    textureCount += Object.keys(planet.textures).length;

    if (object.orbits) {
      const host = solarSystem[object.orbits];
      const parentFrame = object.equatorialOrbit ? host.equator : host.origin;
      parentFrame.add(object.orbit);
    } else {
      scene.add(object.orbit);
    }
  }

  setTextureCount(textureCount);

  return solarSystem;
};
