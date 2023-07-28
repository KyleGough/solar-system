import { PlanetaryObject } from "./planetary-object";
import planetData from "../planets.json";
import { Body } from "./planetary-object";
import { createLabel } from "./label";
import { setTextureCount } from "./textures";

export type SolarSystem = Record<string, PlanetaryObject>;

export const createSolarSystem = (
  scene: THREE.Scene
): [SolarSystem, string[]] => {
  const solarSystem: SolarSystem = {};
  let textureCount = 0;

  const planets: Body[] = planetData;
  const traversable: string[] = [];

  for (const planet of planets) {
    const name = planet.name;

    if (planet.period === 0 && planet.orbits) {
      planet.period = planet.daylength / solarSystem[planet.orbits].daylength;
    }

    const object = new PlanetaryObject(planet);

    solarSystem[name] = object;

    textureCount += Object.keys(planet.textures).length;

    if (object.orbits) {
      const parentMesh = solarSystem[object.orbits].mesh;
      parentMesh.add(object.mesh);
      object.atmosphere.mesh && parentMesh.add(object.atmosphere.mesh);
      object.path && parentMesh.add(object.path);
    }

    if (planet.labels) {
      planet.labels.forEach((label) => {
        createLabel(label.name, label.y, label.z, object, label.type || "");
      });
    }

    if (planet.traversable) {
      traversable.push(planet.name);
    }
  }

  scene.add(solarSystem["Sun"].mesh);
  setTextureCount(textureCount);

  return [solarSystem, traversable];
};
