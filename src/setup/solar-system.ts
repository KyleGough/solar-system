import { PlanetaryObject } from "./planetary-object";
import planetData from "../planets.json";
import { Body } from "./planetary-object";
import { createLabel } from "./label";

export type SolarSystem = Record<string, PlanetaryObject>;

export const createSolarSystem = (scene: THREE.Scene): SolarSystem => {
  const solarSystem: SolarSystem = {};

  const planets: Body[] = planetData;

  for (const planet of planets) {
    const name = planet.name;
    const object = new PlanetaryObject(planet);

    solarSystem[name] = object;

    if (object.orbits) {
      const parentMesh = solarSystem[object.orbits].mesh;
      parentMesh.add(object.mesh);
      object.path && scene.add(object.path);
    }

    if (planet.labels) {
      planet.labels.forEach((label) => {
        createLabel(label.name, label.y, label.z, object);
      });
    }
  }

  scene.add(solarSystem["Sun"].mesh);

  return solarSystem;
};
