import * as THREE from "three";

export interface AtmosphereGlowParams {
  /** Limb scatter colour (linear RGB). */
  color: [number, number, number];
  /** Sunset colour on the terminator. Defaults to a warm white. */
  mieColor?: [number, number, number];
  /** Exposure. 1 is a faint limb. */
  intensity: number;
  /** Atmosphere radius as a multiple of the body radius. */
  scale: number;
  /** Scale height as a fraction of body radius. Thinner = sharper limb. */
  height: number;
  /** Mie strength; boosts the sunward limb. */
  mie?: number;
  /**
   * Optical scatter. Higher values extinguish light past the terminator so
   * the night side does not keep a full atmospheric halo.
   */
  scatter?: number;
}

const DEFAULT_MIE_COLOR: [number, number, number] = [1.0, 0.78, 0.48];
/** Extra outer radius so the fade to zero is not clipped by the mesh. */
const OUTER_EXTEND = 1.06;
const INNER_INTENSITY = 0.7;
const OUTER_INTENSITY = 1.35;

let sharedGeometry: THREE.SphereGeometry | null = null;

const getGeometry = (): THREE.SphereGeometry => {
  if (!sharedGeometry) {
    sharedGeometry = new THREE.SphereGeometry(1, 96, 96);
  }
  return sharedGeometry;
};

const glowVertex = /* glsl */ `
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  varying vec3 vPlanetCenter;
  varying vec3 vWorldPosition;
  varying vec3 vViewPos;
  varying vec3 vCenterView;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vPlanetCenter = modelMatrix[3].xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewNormal = normalize(normalMatrix * normal);
    vViewPos = (viewMatrix * world).xyz;
    vCenterView = (viewMatrix * vec4(modelMatrix[3].xyz, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunset;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uBias;
  uniform float uInner;
  uniform float uMieBoost;
  uniform float uScatter;
  uniform float uPlanetRatio;
  uniform float uHeight;

  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  varying vec3 vPlanetCenter;
  varying vec3 vWorldPosition;
  varying vec3 vViewPos;
  varying vec3 vCenterView;

  void main() {
    vec3 viewN = normalize(vViewNormal);
    vec3 worldN = normalize(vWorldNormal);
    vec3 sunDir = normalize(-vPlanetCenter);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    float ndotv = dot(viewN, vec3(0.0, 0.0, 1.0));
    float rim = pow(max(0.0, uBias - ndotv), uPower);
    if (uInner > 0.5) {
      rim = pow(max(0.0, 1.0 - max(ndotv, 0.0)), uPower);
    }

    float ndotl = dot(worldN, sunDir);
    // From the sun the silhouette is the terminator (ndotl ~ 0), so wrap
    // cannot distinguish a dayside rim from a night-side ring. Fade wrap
    // tightness with whether the camera is on the sunlit side instead.
    float viewSun = dot(normalize(cameraPosition - vPlanetCenter), sunDir);
    float daysideView = smoothstep(-0.15, 0.4, viewSun);
    float viewAdapt = mix(1.0, daysideView, uScatter);

    float wrapLo = mix(0.06, -0.22, viewAdapt);
    float wrapHi = mix(0.42, 0.48, viewAdapt);
    float daylight = smoothstep(wrapLo, wrapHi, ndotl);
    float twilight = exp(-ndotl * ndotl * mix(16.0, 5.5, viewAdapt));
    float wrap = daylight * 0.88 + twilight * mix(0.04, 0.22, viewAdapt);

    // Forward scatter when the sun sits near the limb.
    float towardSun = pow(max(0.0, dot(-viewDir, sunDir)), 4.0);
    towardSun *= mix(1.0, wrap, uScatter);

    vec3 color = mix(uSunset, uColor, clamp(ndotl * 0.55 + 0.5, 0.0, 1.0));
    float glow = rim * wrap * uIntensity;
    glow += rim * towardSun * uIntensity * (0.4 + uMieBoost * 1.15);
    glow *= mix(1.0, smoothstep(-0.7, -0.05, viewSun), uScatter);

    // Apparent height: 0 against the planet, 1 at this shell's mesh.
    float dist = length(vCenterView);
    float meshR = length(vViewPos - vCenterView);
    float pixelAng = acos(clamp(dot(normalize(vViewPos), normalize(vCenterView)), -1.0, 1.0));
    float meshAng = asin(clamp(meshR / max(dist, meshR + 1e-4), 0.0, 0.999));
    float planetAng = asin(clamp(meshR * uPlanetRatio / max(dist, meshR + 1e-4), 0.0, 0.999));
    float atm = max(meshAng - planetAng, 1e-5);
    float h = clamp((pixelAng - planetAng) / atm, 0.0, 1.0);

    // Densest at the surface, thinning toward space. Small uHeight keeps
    // a tight inner limb; larger values fade more slowly.
    float falloff = mix(2.55, 0.85, clamp(uHeight / 0.09, 0.0, 1.0));
    if (uInner > 0.5) {
      falloff *= 0.7;
    }
    glow *= pow(max(1.0 - h, 0.0), falloff);
    glow *= 1.0 - smoothstep(0.84, 0.97, h);

    if (glow < 0.00008) {
      discard;
    }

    gl_FragColor = vec4(color * glow, 1.0);
  }
`;

const innerScaleFactor = (scale: number): number => 1 + (scale - 1) * 0.55;
const outerScaleFactor = (scale: number): number => scale * OUTER_EXTEND;

const powerFromHeight = (height: number, inner: boolean): number =>
  inner
    ? THREE.MathUtils.clamp(3.1 + (0.02 - height) * 40.0, 2.7, 5.5)
    : THREE.MathUtils.clamp(2.4 + (0.02 - height) * 28.0, 2.0, 4.0);

const writeUniforms = (
  uniforms: THREE.ShaderMaterial["uniforms"],
  params: AtmosphereGlowParams,
  inner: boolean
) => {
  const sunset = params.mieColor ?? DEFAULT_MIE_COLOR;
  const meshScale = inner
    ? innerScaleFactor(params.scale)
    : outerScaleFactor(params.scale);

  uniforms.uColor.value.fromArray(params.color);
  uniforms.uSunset.value.fromArray(sunset);
  uniforms.uIntensity.value =
    params.intensity * (inner ? INNER_INTENSITY : OUTER_INTENSITY);
  uniforms.uPower.value = powerFromHeight(params.height, inner);
  uniforms.uMieBoost.value = params.mie ?? 0.3;
  uniforms.uScatter.value = THREE.MathUtils.clamp(params.scatter ?? 0, 0, 1);
  uniforms.uPlanetRatio.value = 1 / Math.max(meshScale, 1e-4);
  uniforms.uHeight.value = Math.max(params.height, 0);
};

const makeMaterial = (
  params: AtmosphereGlowParams,
  inner: boolean
): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color() },
      uSunset: { value: new THREE.Color() },
      uIntensity: { value: 0 },
      uPower: { value: 0 },
      uBias: { value: inner ? 0.0 : 0.63 },
      uInner: { value: inner ? 1 : 0 },
      uMieBoost: { value: 0 },
      uScatter: { value: 0 },
      uPlanetRatio: { value: 1 },
      uHeight: { value: 0 },
    },
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    side: inner ? THREE.FrontSide : THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  writeUniforms(material.uniforms, params, inner);
  return material;
};

const decorate = (mesh: THREE.Mesh, name: string): THREE.Mesh => {
  mesh.name = name;
  mesh.renderOrder = 2;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  return mesh;
};

export const createAtmosphereGlow = (
  radius: number,
  params: AtmosphereGlowParams
): THREE.Group => {
  const group = new THREE.Group();
  group.name = "atmosphere-glow";

  const inner = decorate(
    new THREE.Mesh(getGeometry(), makeMaterial(params, true)),
    "atmosphere-glow-inner"
  );
  const outer = decorate(
    new THREE.Mesh(getGeometry(), makeMaterial(params, false)),
    "atmosphere-glow-outer"
  );
  inner.scale.setScalar(radius * innerScaleFactor(params.scale));
  outer.scale.setScalar(radius * outerScaleFactor(params.scale));

  group.add(inner, outer);
  group.raycast = () => {};
  return group;
};
