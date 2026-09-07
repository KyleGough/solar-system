import * as THREE from "three";

const OUTGOING_LIGHT =
  "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;";

/**
 * Darken the dayside where the cloud alpha is opaque. Applied before night
 * lights so that pass still finds the stock outgoing-light line; city lights
 * then mix from the already-shadowed dayLight.
 */
const CLOUD_SHADOW_OUTGOING_LIGHT = /* glsl */ `
vec2 cloudUv = vec2(fract(vMapUv.x - cloudSpin * RECIPROCAL_PI2), vMapUv.y);
float cloudCover = texture2D(cloudAlphaMap, cloudUv).g;
#if ( NUM_SPOT_LIGHTS > 0 ) || ( NUM_POINT_LIGHTS > 0 )
	#if ( NUM_SPOT_LIGHTS > 0 )
		vec3 cloudLightDir = normalize(spotLights[0].position - geometry.position);
	#else
		vec3 cloudLightDir = normalize(pointLights[0].position - geometry.position);
	#endif
	float cloudDayFactor = smoothstep(-0.05, 0.25, dot(geometry.normal, cloudLightDir));
#else
	float cloudDayFactor = 1.0;
#endif
float cloudShadow = smoothstep(0.15, 0.75, cloudCover) * cloudDayFactor * cloudShadowStrength;
totalDiffuse *= 1.0 - cloudShadow;
totalSpecular *= 1.0 - cloudShadow;
vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
`;

export type CloudShadowUniforms = {
  cloudSpin: { value: number };
  cloudShadowStrength: { value: number };
};

/**
 * Soft cloud shadows on the ground. Samples the cloud alpha in surface UV
 * space with the cloud layer’s relative Y spin so weather and shadow drift
 * together. Dayside-gated so the night hemisphere is unchanged.
 */
export const applyCloudShadows = (
  material: THREE.MeshStandardMaterial,
  cloudAlphaMap: THREE.Texture,
  strength = 0.45
): CloudShadowUniforms => {
  const uniforms: CloudShadowUniforms = {
    cloudSpin: { value: 0 },
    cloudShadowStrength: { value: strength },
  };

  const priorCompile = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${priorKey()}|cloud-shadows`;
  material.onBeforeCompile = (shader, renderer) => {
    priorCompile.call(material, shader, renderer);
    shader.uniforms.cloudAlphaMap = { value: cloudAlphaMap };
    shader.uniforms.cloudSpin = uniforms.cloudSpin;
    shader.uniforms.cloudShadowStrength = uniforms.cloudShadowStrength;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        /* glsl */ `
uniform sampler2D cloudAlphaMap;
uniform float cloudSpin;
uniform float cloudShadowStrength;

void main() {
`
      )
      .replace(OUTGOING_LIGHT, CLOUD_SHADOW_OUTGOING_LIGHT);
  };

  return uniforms;
};
