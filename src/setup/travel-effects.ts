import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { parentOf } from "./catalog";
import type { SolarSystem } from "./solar-system";

const BRASS = new THREE.Color(0xe0b45c);
const STARFIELD_BASE_OPACITY = 0.75;
const STARFIELD_DIM_OPACITY = 0.18;
const BACKGROUND_BASE = 1;
const BACKGROUND_DIM = 0.12;
const EXPOSURE_BASE = 1.15;
const EXPOSURE_DIM = 0.55;
const ARC_SEGS = 64;
const ARC_LINE_WIDTH = 4.0;
const WAKE_COUNT = 64;
const WAKE_LIFE = 0.7;
const LIMB_START = 0.48;
const LIMB_END = 0.95;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** Long-haul = not a hop inside one moon system. */
const isLongHaul = (from: string, to: string): boolean =>
  parentOf(from) !== parentOf(to);

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

const veilOpacity = (progress: number): number => {
  if (progress < 0.12) return progress / 0.12;
  if (progress < 0.55) return 1;
  return Math.max(0, 1 - (progress - 0.55) / 0.45);
};

const starfieldDim = (progress: number): number => {
  // Fast settle into a dark mid-course veil; restore on approach.
  if (progress < 0.1) return progress / 0.1;
  if (progress < 0.62) return 1;
  return Math.max(0, 1 - (progress - 0.62) / 0.38);
};

const limbRevealVertex = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec3 vPlanetCenter;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vPlanetCenter = modelMatrix[3].xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const limbRevealFragment = /* glsl */ `
  precision mediump float;
  uniform float uReveal;
  uniform float uStrength;
  uniform vec3 uBrass;
  uniform vec3 uInk;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec3 vPlanetCenter;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 sunDir = normalize(-vPlanetCenter);
    float ndotl = dot(n, sunDir);

    float terminator = exp(-ndotl * ndotl * 36.0);
    float dayside = smoothstep(-0.15, 0.5, ndotl);
    float peel = smoothstep(0.0, 1.0, uReveal * 1.2 - (1.0 - dayside) * 0.9);
    float cover = (1.0 - peel) * (1.0 - terminator * 0.85);

    float limbGlow = terminator * (1.0 - smoothstep(0.2, 0.9, uReveal));
    float alpha = max(cover * 0.99, limbGlow * 0.9) * uStrength;
    if (alpha < 0.008) discard;

    vec3 color = mix(uInk, uBrass, clamp(limbGlow * 1.7, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
  }
`;

type WakeParticle = {
  alive: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

export type TravelEffectsHandle = {
  begin: (from: string, to: string) => void;
  update: (frame: {
    progress: number;
    dt: number;
    active: boolean;
    justFinished: boolean;
    mode: "travel" | "pan";
  }) => void;
  setResolution: (width: number, height: number) => void;
};

/**
 * Transit veil, limb reveal, and wake trail for body-to-body camera flights.
 */
export const createTravelEffects = (
  scene: THREE.Scene,
  camera: THREE.Camera,
  starfield: THREE.Points,
  solarSystem: SolarSystem,
  renderer: THREE.WebGLRenderer
): TravelEffectsHandle => {
  const starMat = starfield.material as THREE.PointsMaterial;
  starMat.opacity = STARFIELD_BASE_OPACITY;
  scene.backgroundIntensity = BACKGROUND_BASE;
  const exposureBase = renderer.toneMappingExposure || EXPOSURE_BASE;
  renderer.toneMappingExposure = exposureBase;

  const fromPos = new THREE.Vector3();
  const toPos = new THREE.Vector3();
  const sunPos = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const dirA = new THREE.Vector3();
  const dirB = new THREE.Vector3();
  const arcPoint = new THREE.Vector3();
  const wakePrev = new THREE.Vector3();
  let wakePrevValid = false;

  let running = false;
  let longHaul = false;
  let toName = "";
  let fromName = "";

  // --- Transit arc (brass great-circle) ---
  const arcPositions = new Float32Array((ARC_SEGS + 1) * 3);
  const arcColors = new Float32Array((ARC_SEGS + 1) * 3);
  const arcGeometry = new LineGeometry();
  for (let i = 0; i <= ARC_SEGS; i++) {
    arcPositions[i * 3 + 2] = i * 0.001;
    arcColors[i * 3] = BRASS.r;
    arcColors[i * 3 + 1] = BRASS.g;
    arcColors[i * 3 + 2] = BRASS.b;
  }
  arcGeometry.setPositions(arcPositions);
  arcGeometry.setColors(arcColors);

  const arcMaterial = new LineMaterial({
    color: BRASS.getHex(),
    linewidth: ARC_LINE_WIDTH,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  arcMaterial.resolution.set(window.innerWidth, window.innerHeight);

  const arc = new Line2(arcGeometry, arcMaterial);
  arc.visible = false;
  arc.frustumCulled = false;
  arc.renderOrder = 10;
  scene.add(arc);

  const writeArc = () => {
    solarSystem["Sun"].mesh.getWorldPosition(sunPos);
    solarSystem[fromName].mesh.getWorldPosition(fromPos);
    solarSystem[toName].mesh.getWorldPosition(toPos);
    camera.getWorldPosition(camPos);

    dirA.subVectors(fromPos, sunPos);
    dirB.subVectors(toPos, sunPos);
    const r0 = Math.max(dirA.length(), 1e-4);
    const r1 = Math.max(dirB.length(), 1e-4);
    dirA.multiplyScalar(1 / r0);
    dirB.multiplyScalar(1 / r1);

    const omega = Math.acos(Math.min(1, Math.max(-1, dirA.dot(dirB))));
    const sinOmega = Math.sin(omega);

    for (let i = 0; i <= ARC_SEGS; i++) {
      const t = i / ARC_SEGS;
      const radius = r0 + (r1 - r0) * t;
      if (omega < 1e-4) {
        arcPoint.copy(dirA);
      } else {
        arcPoint
          .copy(dirA)
          .multiplyScalar(Math.sin((1 - t) * omega) / sinOmega)
          .addScaledVector(dirB, Math.sin(t * omega) / sinOmega);
      }
      arcPoint.multiplyScalar(radius).add(sunPos);
      // Bow the chord toward the camera so it reads as an instrument mark
      // in the view rather than lying flat among orbit trails.
      const lift = 0.28 * Math.sin(Math.PI * t);
      arcPoint.lerp(camPos, lift);

      arcPositions[i * 3] = arcPoint.x;
      arcPositions[i * 3 + 1] = arcPoint.y;
      arcPositions[i * 3 + 2] = arcPoint.z;

      const tip = Math.sin(Math.PI * t);
      const fade = 0.35 + 0.65 * tip * tip;
      arcColors[i * 3] = BRASS.r * fade;
      arcColors[i * 3 + 1] = BRASS.g * fade;
      arcColors[i * 3 + 2] = BRASS.b * fade;
    }

    arcGeometry.setPositions(arcPositions);
    arcGeometry.setColors(arcColors);
    arc.computeLineDistances();
  };

  // --- Limb reveal shell ---
  const limbMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uReveal: { value: 0 },
      uStrength: { value: 0 },
      uBrass: { value: BRASS.clone() },
      uInk: { value: new THREE.Color(0x0c0a08) },
    },
    vertexShader: limbRevealVertex,
    fragmentShader: limbRevealFragment,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.FrontSide,
  });
  const limbMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    limbMaterial
  );
  limbMesh.name = "limb-reveal";
  limbMesh.visible = false;
  limbMesh.renderOrder = 4;
  limbMesh.raycast = () => {};
  limbMesh.castShadow = false;
  limbMesh.receiveShadow = false;

  const detachLimb = () => {
    if (limbMesh.parent) {
      limbMesh.parent.remove(limbMesh);
    }
    limbMesh.visible = false;
    limbMaterial.uniforms.uReveal.value = 1;
    limbMaterial.uniforms.uStrength.value = 0;
  };

  const attachLimb = (name: string) => {
    detachLimb();
    const body = solarSystem[name];
    if (!body || body.type === "star") return;
    const localR = Math.max(body.meshLocalRadius, 1e-4);
    limbMesh.scale.setScalar(localR * 1.012);
    limbMaterial.uniforms.uReveal.value = 0;
    limbMaterial.uniforms.uStrength.value = 0;
    // Hidden until approach; only the arrival beat uses the veil.
    limbMesh.visible = false;
    body.mesh.add(limbMesh);
  };

  // --- Wake trail (mesh sparks — more reliable than Points on software GL) ---
  const wakeGeo = new THREE.SphereGeometry(1, 6, 6);
  const wakeMat = new THREE.MeshBasicMaterial({
    color: BRASS,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  const wakeGroup = new THREE.Group();
  wakeGroup.name = "travel-wake";
  wakeGroup.visible = false;
  wakeGroup.renderOrder = 9;
  scene.add(wakeGroup);

  type WakeMesh = WakeParticle & {
    mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  };
  const particles: WakeMesh[] = Array.from({ length: WAKE_COUNT }, () => {
    const mesh = new THREE.Mesh(wakeGeo, wakeMat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    wakeGroup.add(mesh);
    return {
      alive: false,
      age: 0,
      life: WAKE_LIFE,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      mesh,
    };
  });

  const resetWake = () => {
    for (const p of particles) {
      p.alive = false;
      p.mesh.visible = false;
    }
    wakeGroup.visible = false;
    wakePrevValid = false;
  };

  const spawnWake = (count: number, speed: number) => {
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir);
    camUp.set(0, 1, 0).transformDirection(camera.matrixWorld).normalize();
    camRight.crossVectors(camDir, camUp).normalize();

    const spread = Math.min(0.9, Math.max(0.08, speed * 0.45));
    const behindBase = Math.min(1.4, Math.max(0.1, speed * 0.6));
    const radius = Math.min(0.11, Math.max(0.016, speed * 0.045));

    let spawned = 0;
    for (let i = 0; i < WAKE_COUNT && spawned < count; i++) {
      const p = particles[i];
      if (p.alive) continue;
      const lateral = (Math.random() - 0.5) * spread;
      const vertical = (Math.random() - 0.5) * spread * 0.7;
      const behind = behindBase * (0.5 + Math.random() * 0.9);
      p.x =
        camPos.x -
        camDir.x * behind +
        camRight.x * lateral +
        camUp.x * vertical;
      p.y =
        camPos.y -
        camDir.y * behind +
        camRight.y * lateral +
        camUp.y * vertical;
      p.z =
        camPos.z -
        camDir.z * behind +
        camRight.z * lateral +
        camUp.z * vertical;
      const drift = speed * (0.35 + Math.random() * 0.8);
      p.vx = -camDir.x * drift + (Math.random() - 0.5) * spread * 0.5;
      p.vy = -camDir.y * drift + (Math.random() - 0.5) * spread * 0.5;
      p.vz = -camDir.z * drift + (Math.random() - 0.5) * spread * 0.5;
      p.age = 0;
      p.life = WAKE_LIFE * (0.7 + Math.random() * 0.5);
      p.alive = true;
      p.mesh.visible = true;
      p.mesh.scale.setScalar(radius * (0.55 + Math.random()));
      p.mesh.position.set(p.x, p.y, p.z);
      spawned++;
    }
  };

  const updateWake = (dt: number, progress: number, flying: boolean) => {
    camera.getWorldPosition(camPos);
    const moved = wakePrevValid ? wakePrev.distanceTo(camPos) : 0;
    const speed = dt > 1e-6 ? moved / dt : 0;
    const moving = flying && moved > 1e-5;

    if (flying && progress < 0.8 && moving) {
      const rate = (1 - progress / 0.8) * 18;
      const n = Math.min(6, Math.max(1, Math.round(rate * dt * 60)));
      spawnWake(n, speed);
      wakeGroup.visible = true;
    }

    wakePrev.copy(camPos);
    wakePrevValid = true;

    let any = false;
    let maxFade = 0;
    for (const p of particles) {
      if (!p.alive) {
        p.mesh.visible = false;
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        p.mesh.visible = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.age / p.life;
      const fade = (1 - t) * (1 - t);
      maxFade = Math.max(maxFade, fade);
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.visible = true;
      any = true;
    }
    // Shared material: drive opacity from the brightest living spark.
    wakeMat.opacity = any ? Math.max(0.2, maxFade * 0.95) : 0;

    if (!any && !flying) {
      wakeGroup.visible = false;
    }
  };

  const endEffects = () => {
    running = false;
    starMat.opacity = STARFIELD_BASE_OPACITY;
    scene.backgroundIntensity = BACKGROUND_BASE;
    renderer.toneMappingExposure = exposureBase;
    arc.visible = false;
    arcMaterial.opacity = 0;
    detachLimb();
  };

  const begin = (from: string, to: string) => {
    if (reducedMotion.matches) {
      endEffects();
      resetWake();
      return;
    }

    fromName = from;
    toName = to;
    longHaul = isLongHaul(from, to);
    running = true;
    wakePrevValid = false;

    starMat.opacity = STARFIELD_BASE_OPACITY;
    scene.backgroundIntensity = BACKGROUND_BASE;
    renderer.toneMappingExposure = exposureBase;
    arc.visible = false;
    arcMaterial.opacity = 0;

    if (longHaul) {
      writeArc();
      arc.visible = true;
    }

    attachLimb(to);
    resetWake();
  };

  const update = (frame: {
    progress: number;
    dt: number;
    active: boolean;
    justFinished: boolean;
    mode: "travel" | "pan";
  }) => {
    if (reducedMotion.matches) {
      if (starMat.opacity !== STARFIELD_BASE_OPACITY) {
        starMat.opacity = STARFIELD_BASE_OPACITY;
      }
      if (scene.backgroundIntensity !== BACKGROUND_BASE) {
        scene.backgroundIntensity = BACKGROUND_BASE;
      }
      if (renderer.toneMappingExposure !== exposureBase) {
        renderer.toneMappingExposure = exposureBase;
      }
      return;
    }

    const flying =
      running &&
      frame.active &&
      frame.mode === "travel" &&
      !frame.justFinished;

    if (flying) {
      const p = frame.progress;

      if (longHaul) {
        writeArc();
        const v = veilOpacity(p);
        arcMaterial.opacity = v * 0.95;
        arc.visible = v > 0.01;
        const dim = starfieldDim(p);
        starMat.opacity =
          STARFIELD_BASE_OPACITY +
          (STARFIELD_DIM_OPACITY - STARFIELD_BASE_OPACITY) * dim;
        scene.backgroundIntensity =
          BACKGROUND_BASE + (BACKGROUND_DIM - BACKGROUND_BASE) * dim;
        renderer.toneMappingExposure =
          exposureBase + (EXPOSURE_DIM - exposureBase) * dim;
      }

      if (limbMesh.parent) {
        if (p < LIMB_START) {
          limbMesh.visible = false;
          limbMaterial.uniforms.uReveal.value = 0;
          limbMaterial.uniforms.uStrength.value = 0;
        } else {
          limbMesh.visible = true;
          const t = Math.min(1, (p - LIMB_START) / (LIMB_END - LIMB_START));
          // Fade the veil in, hold terminator, then peel dayside open.
          const strength =
            t < 0.18
              ? t / 0.18
              : 1 - Math.max(0, (t - 0.82) / 0.18);
          const reveal = t < 0.2 ? 0 : easeOutCubic((t - 0.2) / 0.8);
          limbMaterial.uniforms.uStrength.value = Math.min(
            1,
            Math.max(0, strength)
          );
          limbMaterial.uniforms.uReveal.value = reveal;
        }
      }

      updateWake(frame.dt, p, true);
    } else {
      updateWake(frame.dt, 1, false);
      if (frame.justFinished || (running && !frame.active)) {
        endEffects();
      }
    }
  };

  const setResolution = (width: number, height: number) => {
    arcMaterial.resolution.set(width, height);
  };

  return { begin, update, setResolution };
};
