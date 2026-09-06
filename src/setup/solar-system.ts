import type { Scene } from "three";
import { bodies } from "./catalog";
import { PlanetaryObject } from "./planetary-object";
import { setTextureCount } from "./textures";

export type SolarSystem = Record<string, PlanetaryObject>;

export const createSolarSystem = (scene: Scene): SolarSystem => {
  const solarSystem: SolarSystem = {};
  let textureCount = 0;

  for (const planet of bodies) {
    const name = planet.name;

    const parent = planet.orbits ? solarSystem[planet.orbits] : undefined;
    const object = new PlanetaryObject(planet, parent);
    object.mesh.userData.bodyName = name;
    object.mesh.userData.traversable = planet.traversable;

    solarSystem[name] = object;

    if (planet.textures) {
      textureCount += Object.keys(planet.textures).length;
    }
    if (planet.model) {
      textureCount += 1;
    }

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
