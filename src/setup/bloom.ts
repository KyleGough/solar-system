import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { LAYERS } from "../constants";

type Size = {
  width: number;
  height: number;
};

const mixVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const mixFragment = `
  #include <packing>

  uniform sampler2D baseTexture;
  uniform sampler2D bloomTexture;
  uniform sampler2D tDepth;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float sunViewZ;

  varying vec2 vUv;

  void main() {
    vec4 base = texture2D(baseTexture, vUv);
    vec4 bloom = texture2D(bloomTexture, vUv);

    float depth = texture2D(tDepth, vUv).x;
    float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);

    // viewZ and sunViewZ are negative in front of the camera.
    // Closer pixels have a greater (less negative) viewZ — hide bloom there.
    float visible = step(viewZ, sunViewZ);

    gl_FragColor = base + bloom * visible;
  }
`;

/**
 * Bloom only objects on LAYERS.BLOOM (the Sun), then composite over the scene.
 * Scene depth masks the glow so nearer bodies occlude it.
 */
export const createSelectiveBloom = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  size: Size
) => {
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.width, size.height),
    0.75,
    0.2,
    1
  );

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);

  const pixelRatio = renderer.getPixelRatio();
  const depthTexture = new THREE.DepthTexture(
    size.width * pixelRatio,
    size.height * pixelRatio
  );
  const sceneTarget = new THREE.WebGLRenderTarget(
    size.width * pixelRatio,
    size.height * pixelRatio,
    {
      type: THREE.HalfFloatType,
      depthTexture,
    }
  );

  const sunView = new THREE.Vector3();
  const mixMaterial = new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: sceneTarget.texture },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
      tDepth: { value: depthTexture },
      cameraNear: { value: camera.near },
      cameraFar: { value: camera.far },
      sunViewZ: { value: 0 },
    },
    vertexShader: mixVertex,
    fragmentShader: mixFragment,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mixQuad = new FullScreenQuad(mixMaterial);

  const setSize = (width: number, height: number) => {
    const ratio = renderer.getPixelRatio();
    bloomComposer.setPixelRatio(ratio);
    bloomComposer.setSize(width, height);
    sceneTarget.setSize(width * ratio, height * ratio);
  };

  const render = (sun: THREE.Object3D) => {
    const layersMask = camera.layers.mask;
    const background = scene.background;

    scene.background = null;
    camera.layers.set(LAYERS.BLOOM);
    bloomComposer.render();

    scene.background = background;
    camera.layers.mask = layersMask;

    renderer.setRenderTarget(sceneTarget);
    renderer.autoClear = true;
    renderer.render(scene, camera);

    sun.getWorldPosition(sunView);
    sunView.applyMatrix4(camera.matrixWorldInverse);
    mixMaterial.uniforms.sunViewZ.value = sunView.z;
    mixMaterial.uniforms.cameraNear.value = camera.near;
    mixMaterial.uniforms.cameraFar.value = camera.far;

    renderer.setRenderTarget(null);
    mixQuad.render(renderer);
  };

  return { setSize, render };
};
