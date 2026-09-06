import { traversableBodies } from "./catalog";

const DEFAULT_TITLE = "Solar System Model";

const bySlug = new Map(
  traversableBodies.map((body) => [body.name.toLowerCase(), body.name])
);

const slugOf = (name: string): string => name.toLowerCase();

const resolveName = (raw: string): string | null => {
  let slug: string;
  try {
    slug = decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return null;
  }
  if (!slug) return null;
  return bySlug.get(slug) ?? null;
};

export const readFocusFromUrl = (): string | null => {
  return resolveName(window.location.hash.replace(/^#/, ""));
};

export const writeFocusToUrl = (name: string): void => {
  if (!bySlug.has(slugOf(name))) return;

  const hash = `#${slugOf(name)}`;
  if (window.location.hash !== hash) {
    history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${hash}`
    );
  }

  document.title = name === "Sun" ? DEFAULT_TITLE : `${name} · ${DEFAULT_TITLE}`;
};

export const onFocusUrlChange = (callback: (name: string) => void): void => {
  window.addEventListener("hashchange", () => {
    callback(readFocusFromUrl() ?? "Sun");
  });
};
