const loadingPrompts = [
  "Detecting neutrinos",
  "Forming event horizons",
  "Annihilating particles",
  "Tunneling electrons",
  "Entangling photons",
  "Collapsing wavefunctions",
  "Quantising gravity",
  "Evaporating black holes",
  "Increasing entropy",
];

const BACKGROUND_SELECTORS = [".webgl", ".identity", ".btn-group", ".orbit-nav"];

let introActive = true;
let ready = false;
const dismissCallbacks: Array<() => void> = [];

const overlay = () => document.getElementById("intro");

const setBackgroundInert = (inert: boolean) => {
  for (const selector of BACKGROUND_SELECTORS) {
    const el = document.querySelector(selector);
    if (!el) continue;
    if (inert) {
      el.setAttribute("inert", "");
    } else {
      el.removeAttribute("inert");
    }
  }
};

setBackgroundInert(true);
document.body.classList.add("intro-open");

const switchLoadText = setInterval(() => {
  if (ready) return;
  const loadText = document.getElementById("loader-text");
  if (!loadText) return;
  const index = Math.floor(Math.random() * loadingPrompts.length);
  loadText.textContent = `${loadingPrompts[index]}...`;
}, 2000);

export const isIntroActive = () => introActive;

export const onIntroDismiss = (callback: () => void) => {
  if (!introActive) {
    callback();
    return;
  }
  dismissCallbacks.push(callback);
};

export const setLoadProgress = (percent: number) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const percentageEl = document.getElementById("loader-percentage");
  const fillEl = document.getElementById("loader-bar-fill") as HTMLElement | null;
  const barEl = document.getElementById("loader-bar");

  if (percentageEl) {
    percentageEl.textContent = `${clamped.toFixed(0)}%`;
  }
  if (fillEl) {
    fillEl.style.width = `${clamped}%`;
  }
  if (barEl) {
    barEl.setAttribute("aria-valuenow", String(Math.round(clamped)));
  }
};

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const dismissIntro = () => {
  if (!introActive || !ready) return;

  introActive = false;
  const loadContainer = overlay();
  if (!loadContainer) return;

  loadContainer.style.pointerEvents = "none";
  loadContainer.removeEventListener("click", dismissIntro);
  window.removeEventListener("keydown", onKeyDismiss);

  const finish = () => {
    loadContainer.hidden = true;
    document.body.classList.remove("intro-open");
    setBackgroundInert(false);
    for (const callback of dismissCallbacks) {
      callback();
    }
    dismissCallbacks.length = 0;
  };

  if (prefersReducedMotion()) {
    finish();
    return;
  }

  const animation = loadContainer.animate(
    { opacity: [1, 0] },
    {
      duration: 200,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
      fill: "forwards",
    }
  );
  animation.onfinish = finish;
};

const onKeyDismiss = (event: KeyboardEvent) => {
  if (!ready || !introActive) return;
  if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
    event.preventDefault();
    dismissIntro();
  }
};

/**
 * Marks textures as loaded and allows the intro panel to be dismissed.
 */
export const onLoaded = () => {
  ready = true;
  clearInterval(switchLoadText);
  setLoadProgress(100);

  const loadText = document.getElementById("loader-text");
  if (loadText) {
    loadText.textContent = "Ready";
  }

  const loadContainer = overlay();
  if (!loadContainer) return;
  loadContainer.classList.add("is-ready");
  loadContainer.setAttribute("aria-busy", "false");
  loadContainer.style.cursor = "pointer";
  document.getElementById("intro-hint")?.removeAttribute("aria-hidden");
  loadContainer.addEventListener("click", dismissIntro);
  window.addEventListener("keydown", onKeyDismiss);
};
