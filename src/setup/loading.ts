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

const loadingTextInterval = setInterval(() => {
  const index = Math.floor(Math.random() * loadingPrompts.length);
  const loadText = document.getElementById("loader-text") as HTMLDivElement;
  loadText.textContent = `${loadingPrompts[index]}...`;
}, 2000);

export const onLoaded = () => {
  clearInterval(loadingTextInterval);
  const loadText = document.getElementById("loader-text") as HTMLDivElement;
  loadText.textContent = "Click to continue...";

  const loadIcon = document.getElementById("loader-circle") as HTMLDivElement;
  const svg = loadIcon.children[0] as HTMLElement;
  svg.style.animation = "none";

  const loadContainer = document.getElementById("loading") as HTMLDivElement;
  loadContainer.style.cursor = "pointer";

  loadContainer.addEventListener("click", () => {
    loadContainer.style.display = "none";
  });
};
