import { PlanetaryObject } from "./planetary-object";
import planetData from "../planets.json";

export type SolarSystem = Record<string, PlanetaryObject>;

export const createSolarSystem = (scene: THREE.Scene): SolarSystem => {
  const solarSystem: SolarSystem = {};

  for (const planet of planetData) {
    const name = planet.name;
    const object = new PlanetaryObject(
      planet.radius,
      planet.distance,
      planet.period,
      planet.daylength,
      planet.textures,
      planet.type,
      planet.tilt,
      planet.orbits
    );

    solarSystem[name] = object;

    if (object.orbits) {
      const parentMesh = solarSystem[object.orbits].mesh;
      parentMesh.add(object.mesh);
      object.atmosphere.mesh && parentMesh.add(object.atmosphere.mesh);
      object.path && scene.add(object.path);
    }
  }

  scene.add(solarSystem["Sun"].mesh);

  return solarSystem;
};
