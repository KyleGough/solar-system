import planetData from "../planets.json";
import type { Body } from "./planetary-object";
import { isIntroActive } from "./loading";

const bodies = planetData as Body[];

const SWATCH: Record<string, { color: string; size: string }> = {
  Sun: { color: "oklch(0.82 0.14 85)", size: "20px" },
  Mercury: { color: "oklch(0.62 0.03 70)", size: "10px" },
  Venus: { color: "oklch(0.78 0.08 95)", size: "12px" },
  Earth: { color: "oklch(0.62 0.1 230)", size: "12px" },
  Mars: { color: "oklch(0.58 0.12 40)", size: "11px" },
  Jupiter: { color: "oklch(0.72 0.1 65)", size: "18px" },
  Saturn: { color: "oklch(0.78 0.08 85)", size: "16px" },
  Uranus: { color: "oklch(0.72 0.08 200)", size: "14px" },
  Neptune: { color: "oklch(0.52 0.12 250)", size: "14px" },
  Moon: { color: "oklch(0.7 0.015 80)", size: "9px" },
  Io: { color: "oklch(0.78 0.12 95)", size: "9px" },
  Europa: { color: "oklch(0.82 0.04 85)", size: "9px" },
  Ganymede: { color: "oklch(0.58 0.03 70)", size: "9px" },
  Callisto: { color: "oklch(0.45 0.03 60)", size: "9px" },
  Titan: { color: "oklch(0.68 0.1 70)", size: "9px" },
  Triton: { color: "oklch(0.72 0.04 40)", size: "9px" },
};

const FALLBACK_SWATCH = { color: "oklch(0.7 0.02 85)", size: "10px" };

const primaries: Body[] = bodies
  .filter(
    (body) => body.traversable && (body.type === "star" || body.type === "planet")
  )
  .sort((a, b) => a.distance - b.distance);

const moonsByParent = new Map<string, Body[]>();

for (const body of bodies) {
  if (body.type !== "moon" || !body.traversable || !body.orbits) continue;
  const list = moonsByParent.get(body.orbits) ?? [];
  list.push(body);
  moonsByParent.set(body.orbits, list);
}

for (const list of moonsByParent.values()) {
  list.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
}

const bodyByName = new Map(bodies.map((body) => [body.name, body]));

const parentOf = (name: string): string => {
  const body = bodyByName.get(name);
  if (body?.type === "moon" && body.orbits) return body.orbits;
  return name;
};

const keyboardSequence = (focus: string): string[] => {
  const parent = parentOf(focus);
  const moons = moonsByParent.get(parent) ?? [];
  const primaryNames = primaries.map((body) => body.name);
  if (moons.length === 0) return primaryNames;

  const index = primaryNames.indexOf(parent);
  if (index === -1) return primaryNames;

  return [
    ...primaryNames.slice(0, index + 1),
    ...moons.map((body) => body.name),
    ...primaryNames.slice(index + 1),
  ];
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".lil-gui")) return true;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
};

const createBodyButton = (body: Body, extraClass = ""): HTMLButtonElement => {
  const swatch = SWATCH[body.name] ?? FALLBACK_SWATCH;
  const button = document.createElement("button");
  button.type = "button";
  button.className = extraClass ? `orbit-nav-body ${extraClass}` : "orbit-nav-body";
  button.dataset.name = body.name;
  button.style.setProperty("--disc", swatch.color);
  button.style.setProperty("--disc-size", swatch.size);

  const disc = document.createElement("span");
  disc.className = "orbit-nav-disc";
  disc.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "orbit-nav-label";
  label.textContent = body.name;

  button.append(disc, label);
  return button;
};

type OrbitNav = {
  setFocus: (name: string) => void;
};

export const createOrbitalNav = (
  root: HTMLElement,
  onSelect: (name: string) => void
): OrbitNav => {
  root.replaceChildren();
  root.setAttribute("aria-label", "Solar system");

  const row = document.createElement("div");
  row.className = "orbit-nav-row";
  row.setAttribute("role", "list");

  const slots = new Map<
    string,
    {
      slot: HTMLElement;
      button: HTMLButtonElement;
      moons: HTMLElement;
    }
  >();
  const buttons = new Map<string, HTMLButtonElement>();

  for (const planet of primaries) {
    const slot = document.createElement("div");
    slot.className = "orbit-nav-slot";
    slot.setAttribute("role", "listitem");

    const button = createBodyButton(planet);
    buttons.set(planet.name, button);

    const moonsWrap = document.createElement("div");
    moonsWrap.className = "orbit-nav-moons";
    moonsWrap.setAttribute("aria-hidden", "true");
    const moons = moonsByParent.get(planet.name) ?? [];
    if (moons.length > 0) {
      moonsWrap.setAttribute("role", "group");
      moonsWrap.setAttribute("aria-label", `Moons of ${planet.name}`);
      for (const moon of moons) {
        const moonButton = createBodyButton(moon, "is-moon");
        moonButton.tabIndex = -1;
        buttons.set(moon.name, moonButton);
        moonsWrap.append(moonButton);
      }
    }

    slot.append(button, moonsWrap);
    row.append(slot);
    slots.set(planet.name, { slot, button, moons: moonsWrap });
  }

  root.append(row);

  let current = "";

  const setFocus = (name: string) => {
    current = name;
    const system = parentOf(name);

    for (const [planetName, { slot, moons }] of slots) {
      const open = planetName === system && moons.childElementCount > 0;
      slot.classList.toggle("is-open", open);
      slot.classList.toggle("is-system", planetName === system);
      moons.setAttribute("aria-hidden", open ? "false" : "true");
      moons.querySelectorAll("button").forEach((moonButton) => {
        moonButton.tabIndex = open ? 0 : -1;
      });
    }

    for (const [bodyName, button] of buttons) {
      const active = bodyName === name;
      button.classList.toggle("is-current", active);
      if (active) {
        button.setAttribute("aria-current", "location");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  };

  root.addEventListener("click", (event) => {
    if (isIntroActive()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button[data-name]");
    if (!(button instanceof HTMLButtonElement)) return;
    const name = button.dataset.name;
    if (!name) return;
    onSelect(name);
  });

  window.addEventListener("keydown", (event) => {
    if (isIntroActive()) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (isEditableTarget(event.target)) return;

    const sequence = keyboardSequence(current || "Sun");
    const index = sequence.indexOf(current);
    if (index === -1 || sequence.length === 0) return;

    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = sequence[(index + delta + sequence.length) % sequence.length];
    onSelect(next);

    const nextButton = buttons.get(next);
    nextButton?.focus({ preventScroll: true });
  });

  return { setFocus };
};
