import * as THREE from "three";

type BodySwatch = {
  color: string;
  size: string;
};

export const BODY_SWATCH: Record<string, BodySwatch> = {
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

export const FALLBACK_SWATCH: BodySwatch = {
  color: "oklch(0.7 0.02 85)",
  size: "10px",
};

const OKLCH_RE = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i;

const toSrgb = (value: number): number => {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped <= 0.0031308
    ? 12.92 * clamped
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
};

const oklchToSrgb = (l: number, c: number, hDeg: number): THREE.Color => {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return new THREE.Color(toSrgb(r), toSrgb(g), toSrgb(bl));
};

const bodyColorCss = (name: string): string =>
  (BODY_SWATCH[name] ?? FALLBACK_SWATCH).color;

export const bodyColorThree = (name: string): THREE.Color => {
  const css = bodyColorCss(name);
  const match = css.match(OKLCH_RE);
  if (!match) {
    return new THREE.Color("#c8b48a");
  }
  const lightness = Math.min(0.8, Number(match[1]) + 0.04);
  const chroma = Math.max(Number(match[2]), 0.055);
  return oklchToSrgb(lightness, chroma, Number(match[3]));
};
