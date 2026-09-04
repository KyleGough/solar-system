import type { Body } from "./planetary-object";
import planetData from "../planets.json";

const bodies = planetData as Body[];

const kickerEl = () => document.getElementById("identity-kicker");
const titleEl = () => document.getElementById("identity-title");
const subEl = () => document.getElementById("identity-sub");

const formatKm = (km: number): string =>
  `${Math.round(km).toLocaleString("en-GB")} km`;

const formatDistance = (millionKm: number): string => {
  if (millionKm < 1) {
    return `${Math.round(millionKm * 1_000_000).toLocaleString("en-GB")} km`;
  }
  return `${millionKm.toLocaleString("en-GB")} million km`;
};

const formatPeriod = (days: number): string => {
  if (days >= 365) {
    const years = days / 365.25;
    const rounded = years >= 10 ? years.toFixed(0) : years.toFixed(1);
    return `${rounded} year orbit`;
  }
  return `${Math.round(days)} day orbit`;
};

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
