import planetData from "../planets.json";
import { Body, PlanetaryObject } from "./planetary-object";
import { setTextureCount } from "./textures";

export type SolarSystem = Record<string, PlanetaryObject>;

export const createSolarSystem = (scene: THREE.Scene): SolarSystem => {
  const solarSystem: SolarSystem = {};
  let textureCount = 0;

  const planets: Body[] = (planetData as Body[]).map((planet) => ({ ...planet }));

  for (const planet of planets) {
    const name = planet.name;

    if (planet.period === 0 && planet.orbits) {
      planet.period = planet.daylength / solarSystem[planet.orbits].daylength;
    }

    const parent = planet.orbits ? solarSystem[planet.orbits] : undefined;
    const object = new PlanetaryObject(planet, parent);
    object.mesh.userData.bodyName = name;
    object.mesh.userData.traversable = planet.traversable;

    solarSystem[name] = object;

    textureCount += Object.keys(planet.textures).length;

    if (object.orbits) {
      const parentMesh = solarSystem[object.orbits].mesh;
      parentMesh.add(object.mesh);
      object.path && parentMesh.add(object.path);
    }
  }

  scene.add(solarSystem["Sun"].mesh);
  setTextureCount(textureCount);

  return solarSystem;
};
