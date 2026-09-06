import { getBody } from "./catalog";
import type { PointOfInterest } from "./label";

const kickerEl = () => document.getElementById("identity-kicker");
const titleEl = () => document.getElementById("identity-title");

const poiTypeLabel = (type?: string): string => {
  if (!type) return "Feature";
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export const updateIdentity = (name: string, poi?: PointOfInterest): void => {
  const body = getBody(name);
  if (!body) return;
  const kicker = kickerEl();
  const title = titleEl();
  if (poi) {
    if (kicker) kicker.textContent = poiTypeLabel(poi.type);
    if (title) title.textContent = poi.name;
    return;
  }
  if (kicker) kicker.textContent = body.type;
  if (title) title.textContent = body.name;
};
