import type { Body } from "./planetary-object";
import planetData from "../planets.json";
import { formatDistance, formatKm, formatPeriod } from "./format";

const bodies = planetData as Body[];

const kickerEl = () => document.getElementById("identity-kicker");
const titleEl = () => document.getElementById("identity-title");
const subEl = () => document.getElementById("identity-sub");

const subtitle = (body: Body): string => {
  if (!body.orbits) {
    return `Central star. Radius ${formatKm(body.radius)}.`;
  }
  const dist = formatDistance(body.distance);
  if (body.type === "moon") {
    return `Orbits ${body.orbits} at ${dist}.`;
  }
  return `Orbits ${body.orbits} at ${dist}. ${formatPeriod(body.period)}.`;
};

export const updateIdentity = (name: string): void => {
  const body = bodies.find((entry) => entry.name === name);
  if (!body) return;
  const kicker = kickerEl();
  const title = titleEl();
  const sub = subEl();
  if (kicker) kicker.textContent = body.type;
  if (title) title.textContent = body.name;
  if (sub) sub.textContent = subtitle(body);
};
