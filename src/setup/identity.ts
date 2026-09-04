import type { Body } from "./planetary-object";
import planetData from "../planets.json";

const bodies = planetData as Body[];

const kickerEl = () => document.getElementById("identity-kicker");
const titleEl = () => document.getElementById("identity-title");

export const updateIdentity = (name: string): void => {
  const body = bodies.find((entry) => entry.name === name);
  if (!body) return;
  const kicker = kickerEl();
  const title = titleEl();
  if (kicker) kicker.textContent = body.type;
  if (title) title.textContent = body.name;
};
