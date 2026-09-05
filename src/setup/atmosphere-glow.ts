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
}

const DEFAULT_MIE_COLOR: [number, number, number] = [1.0, 0.78, 0.48];

let sharedGeometry: THREE.SphereGeometry | null = null;

const getGeometry = (): THREE.SphereGeometry => {
  if (!sharedGeometry) {
    sharedGeometry = new THREE.SphereGeometry(1, 72, 72);
  }
  return sharedGeometry;
};

const glowVertex = /* glsl */ `
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  varying vec3 vPlanetCenter;
  varying vec3 vWorldPosition;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vPlanetCenter = modelMatrix[3].xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewNormal = normalize(normalMatrix * normal);
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

  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  varying vec3 vPlanetCenter;
  varying vec3 vWorldPosition;

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
    // Atmosphere stays lit a little past the ground terminator.
    float daylight = smoothstep(-0.22, 0.48, ndotl);
    float twilight = exp(-ndotl * ndotl * 5.5);
    float wrap = daylight * 0.88 + twilight * 0.22;

    // Forward scatter when the sun sits near the limb.
    float towardSun = pow(max(0.0, dot(-viewDir, sunDir)), 4.0);

    vec3 color = mix(uSunset, uColor, clamp(ndotl * 0.55 + 0.5, 0.0, 1.0));
    float glow = rim * wrap * uIntensity;
    glow += rim * towardSun * uIntensity * (0.4 + uMieBoost * 1.15);

    if (glow < 0.004) {
      discard;
    }

    gl_FragColor = vec4(color * glow, 1.0);
  }
`;

const makeMaterial = (
  params: AtmosphereGlowParams,
  inner: boolean
): THREE.ShaderMaterial => {
  const sunset = params.mieColor ?? DEFAULT_MIE_COLOR;
  const height = params.height;
  const innerPower = THREE.MathUtils.clamp(3.1 + (0.02 - height) * 40.0, 2.7, 5.5);
  const outerPower = THREE.MathUtils.clamp(2.4 + (0.02 - height) * 28.0, 2.0, 4.0);
  const innerIntensity = params.intensity * 0.25;
  const outerIntensity = params.intensity * 1.6;

  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color().fromArray(params.color) },
      uSunset: { value: new THREE.Color().fromArray(sunset) },
      uIntensity: { value: inner ? innerIntensity : outerIntensity },
      uPower: { value: inner ? innerPower : outerPower },
      uBias: { value: inner ? 0.0 : 0.63 },
      uInner: { value: inner ? 1 : 0 },
      uMieBoost: { value: params.mie ?? 0.3 },
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
};

const decorate = (mesh: THREE.Mesh, name: string): THREE.Mesh => {
  mesh.name = name;
  mesh.renderOrder = 2;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  mesh.userData.ignorePick = true;
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
  inner.scale.setScalar(radius * (1 + (params.scale - 1) * 0.22));

  const outer = decorate(
    new THREE.Mesh(getGeometry(), makeMaterial(params, false)),
    "atmosphere-glow-outer"
  );
  outer.scale.setScalar(radius * params.scale);

  group.add(inner, outer);
  group.raycast = () => {};
  group.userData.ignorePick = true;
  return group;
};
