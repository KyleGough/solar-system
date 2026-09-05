import * as THREE from "three";

export interface AtmosphereGlowParams {
  /** Limb scatter colour (linear RGB). */
  color: [number, number, number];
  /** Sunset colour on the terminator. Defaults to a warm white. */
  mieColor?: [number, number, number];
  /** Thin high-altitude rim. Defaults to a cooler Rayleigh tint of `color`. */
  rimColor?: [number, number, number];
  /** Exposure. 1 is a faint limb. */
  intensity: number;
  /** Atmosphere radius as a multiple of the body radius. */
  scale: number;
  /** Scale height as a fraction of body radius. Thinner = sharper limb. */
  height: number;
  /** Mie strength; boosts the sunward limb. */
  mie?: number;
}

const DEFAULT_MIE_COLOR: [number, number, number] = [1.0, 0.78, 0.48];

let sharedGeometry: THREE.SphereGeometry | null = null;

const getGeometry = (): THREE.SphereGeometry => {
  if (!sharedGeometry) {
    sharedGeometry = new THREE.SphereGeometry(1, 96, 96);
  }
  return sharedGeometry;
};

const defaultRim = (color: [number, number, number]): [number, number, number] => [
  Math.min(1, color[0] * 0.42 + 0.18),
  Math.min(1, color[1] * 0.58 + 0.38),
  Math.min(1, color[2] * 0.32 + 0.78),
];

const glowVertex = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vPlanetCenter;
  varying vec3 vWorldPosition;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vPlanetCenter = modelMatrix[3].xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const glowFragment = /* glsl */ `
  #include <common>
  #include <dithering_pars_fragment>

  uniform vec3 uColor;
  uniform vec3 uSunset;
  uniform vec3 uRim;
  uniform float uIntensity;
  uniform float uPlanetR;
  uniform float uAtmosR;
  uniform float uSoftness;
  uniform float uMieBoost;
  uniform float uInner;
  uniform float uHalo;
  uniform float uRimMix;

  varying vec3 vWorldNormal;
  varying vec3 vPlanetCenter;
  varying vec3 vWorldPosition;

  void main() {
    vec3 center = vPlanetCenter;
    vec3 cam = cameraPosition;
    vec3 sunDir = normalize(-center);
    vec3 worldN = normalize(vWorldNormal);
    vec3 viewDir = normalize(cam - vWorldPosition);

    vec3 camRel = cam - center;
    vec3 rd = normalize(vWorldPosition - cam);
    float b = dot(camRel, rd);
    vec3 closestRel = camRel - rd * b;
    float impact = length(closestRel);
    vec3 limbN = impact > 1e-5 ? closestRel / impact : worldN;

    float sunLit = dot(limbN, sunDir);
    float daylight = smoothstep(-0.38, 0.42, sunLit);
    float twilight = exp(-sunLit * sunLit * 3.2);
    float wrap = daylight * 0.8 + twilight * 0.38;

    float towardSun = pow(max(0.0, dot(-rd, sunDir)), 6.0);
    float mie = towardSun * uMieBoost;

    vec3 color = mix(uSunset, uColor, clamp(sunLit * 0.55 + 0.5, 0.0, 1.0));
    float glow = 0.0;

    if (uInner > 0.5) {
      float ndotv = max(dot(worldN, viewDir), 0.0);
      float innerPower = mix(2.65, 0.92, clamp((uSoftness - 0.4) / 2.0, 0.0, 1.0));
      float rim = pow(1.0 - ndotv, innerPower);
      float wash = pow(1.0 - ndotv, mix(1.15, 0.55, clamp(uSoftness / 2.2, 0.0, 1.0)));
      glow = (rim * 0.72 + wash * 0.22) * wrap * uIntensity;
      glow += rim * mie * uIntensity * 0.35;
    } else {
      float thickness = max(uAtmosR - uPlanetR, 1e-5);
      float t = clamp((impact - uPlanetR) / thickness, 0.0, 1.8);
      float softnessN = clamp((uSoftness - 0.4) / 2.0, 0.0, 1.0);
      float core = exp(-t * t * mix(8.0, 3.1, softnessN));
      float tail = exp(-t * mix(5.2, 1.7, softnessN));
      float cyan = exp(-pow((t - mix(0.08, 0.2, softnessN)) / mix(0.05, 0.12, softnessN), 2.0));
      float fadeOut = 1.0 - smoothstep(0.58, 1.0, t);
      float profile = (core * 0.82 + tail * (uHalo > 0.5 ? 0.78 : 0.3)) * fadeOut;
      glow = profile * wrap * uIntensity;
      glow += profile * mie * uIntensity * (0.45 + uMieBoost * 0.5);
      color = mix(color, uRim, cyan * uRimMix * daylight * fadeOut);
    }

    float energy = max(glow, 0.0);
    float alpha = 1.0 - exp(-energy);
    vec3 rgb = color * (alpha + energy * 0.12);
    gl_FragColor = vec4(rgb, alpha);
    #include <dithering_fragment>
  }
`;

const shellScale = (
  params: AtmosphereGlowParams,
  kind: "inner" | "outer" | "halo"
): number => {
  if (kind === "inner") {
    return 1 + (params.scale - 1) * 0.18;
  }
  if (kind === "halo") {
    return 1 + (params.scale - 1) * 2.35;
  }
  return params.scale;
};

const makeMaterial = (
  radius: number,
  params: AtmosphereGlowParams,
  kind: "inner" | "outer" | "halo"
): THREE.ShaderMaterial => {
  const sunset = params.mieColor ?? DEFAULT_MIE_COLOR;
  const rim = params.rimColor ?? defaultRim(params.color);
  const softness = THREE.MathUtils.clamp(params.height / 0.016, 0.4, 2.4);
  const softnessN = THREE.MathUtils.clamp((softness - 0.4) / 2.0, 0.0, 1.0);
  const intensity =
    kind === "inner"
      ? params.intensity * (0.42 + softnessN * 0.4)
      : kind === "halo"
        ? params.intensity * (0.22 + softnessN * 0.12)
        : params.intensity * 1.18;
  const planetR = radius;
  const atmosR = radius * shellScale(params, kind);

  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color().fromArray(params.color) },
      uSunset: { value: new THREE.Color().fromArray(sunset) },
      uRim: { value: new THREE.Color().fromArray(rim) },
      uIntensity: { value: intensity },
      uPlanetR: { value: planetR },
      uAtmosR: { value: atmosR },
      uSoftness: { value: kind === "halo" ? softness * 1.55 : softness },
      uMieBoost: { value: params.mie ?? 0.3 },
      uInner: { value: kind === "inner" ? 1 : 0 },
      uHalo: { value: kind === "halo" ? 1 : 0 },
      uRimMix: { value: params.rimColor ? 0.95 : 0.38 },
    },
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    side: kind === "inner" ? THREE.FrontSide : THREE.BackSide,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    dithering: true,
  });
};

const decorate = (mesh: THREE.Mesh, name: string, order: number): THREE.Mesh => {
  mesh.name = name;
  mesh.renderOrder = order;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  mesh.userData.ignorePick = true;
  return mesh;
};

/**
 * Tint the globe toward haze at grazing angles so the opaque silhouette
 * does not cut against the volumetric limb.
 */
export const applyLimbHaze = (
  material: THREE.MeshPhongMaterial,
  params: AtmosphereGlowParams
): void => {
  const prevCompile = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  const hazeColor = params.mieColor ?? params.color;
  const strength = THREE.MathUtils.clamp(params.height * 12.0, 0.08, 0.52);

  material.dithering = true;
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ""}|limb-haze`;

  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(material, shader, renderer);
    shader.uniforms.uLimbHazeColor = {
      value: new THREE.Color().fromArray(hazeColor),
    };
    shader.uniforms.uLimbHazeStrength = { value: strength };

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
uniform vec3 uLimbHazeColor;
uniform float uLimbHazeStrength;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      `
      vec3 limbViewDir = normalize(-vViewPosition);
      float limbNdotV = clamp(dot(normal, limbViewDir), 0.0, 1.0);
      float limbHaze = pow(1.0 - limbNdotV, mix(1.8, 1.05, clamp(uLimbHazeStrength * 2.0, 0.0, 1.0)));
      float limbLit = clamp(length(outgoingLight) * 1.85, 0.0, 1.0);
      outgoingLight = mix(outgoingLight, uLimbHazeColor * limbLit, limbHaze * uLimbHazeStrength);
      #include <output_fragment>
      `
    );
  };
};

export const createAtmosphereGlow = (
  radius: number,
  params: AtmosphereGlowParams
): THREE.Group => {
  const group = new THREE.Group();
  group.name = "atmosphere-glow";

  const inner = decorate(
    new THREE.Mesh(getGeometry(), makeMaterial(radius, params, "inner")),
    "atmosphere-glow-inner",
    2
  );
  inner.scale.setScalar(radius * shellScale(params, "inner"));

  const outer = decorate(
    new THREE.Mesh(getGeometry(), makeMaterial(radius, params, "outer")),
    "atmosphere-glow-outer",
    3
  );
  outer.scale.setScalar(radius * shellScale(params, "outer"));

  const halo = decorate(
    new THREE.Mesh(getGeometry(), makeMaterial(radius, params, "halo")),
    "atmosphere-glow-halo",
    4
  );
  halo.scale.setScalar(radius * shellScale(params, "halo"));

  group.add(inner, outer, halo);
  group.raycast = () => {};
  group.userData.ignorePick = true;
  return group;
};
