import * as THREE from "three";

const OUTPUT_FRAGMENT = "#include <output_fragment>";

/**
 * Darken final dayside colour where the cloud alpha is opaque. Injected just
 * before output so it runs after night lights have mixed city lights; dayFactor
 * keeps the night hemisphere untouched.
 *
 * Cover is sampled slightly toward the sun and dilated so the shadow falls on
 * open ground next to cloud banks — otherwise the opaque cloud mesh hides it.
 *
 * Patches `#include <output_fragment>` because onBeforeCompile runs before
 * ShaderChunk includes are resolved (same reason night lights patches the
 * inline outgoingLight line rather than an include).
 */
const CLOUD_SHADOW_BEFORE_OUTPUT = /* glsl */ `
vec2 cloudBaseUv = vec2(fract(vMapUv.x - cloudSpin * RECIPROCAL_PI2), vMapUv.y);
#if ( NUM_SPOT_LIGHTS > 0 ) || ( NUM_POINT_LIGHTS > 0 )
	#if ( NUM_SPOT_LIGHTS > 0 )
		vec3 cloudLightDir = normalize(spotLights[0].position - geometry.position);
	#else
		vec3 cloudLightDir = normalize(pointLights[0].position - geometry.position);
	#endif
	float cloudDayFactor = smoothstep(-0.05, 0.25, dot(geometry.normal, cloudLightDir));
	vec2 cloudCast = normalize(vec2(cloudLightDir.x, cloudLightDir.y) + 1e-5) * 0.018;
#else
	float cloudDayFactor = 1.0;
	vec2 cloudCast = vec2(0.0);
#endif
vec2 cloudUv = vec2(fract(cloudBaseUv.x + cloudCast.x), clamp(cloudBaseUv.y + cloudCast.y, 0.0, 1.0));
float cloudCover = texture2D(cloudAlphaMap, cloudUv).g;
cloudCover = max(cloudCover, texture2D(cloudAlphaMap, cloudUv + vec2(0.018, 0.0)).g);
cloudCover = max(cloudCover, texture2D(cloudAlphaMap, cloudUv - vec2(0.018, 0.0)).g);
cloudCover = max(cloudCover, texture2D(cloudAlphaMap, cloudUv + vec2(0.0, 0.018)).g);
cloudCover = max(cloudCover, texture2D(cloudAlphaMap, cloudUv - vec2(0.0, 0.018)).g);
float cloudShadow = smoothstep(0.04, 0.4, cloudCover) * cloudDayFactor * cloudShadowStrength;
outgoingLight *= 1.0 - cloudShadow;
#include <output_fragment>
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
  strength = 0.78
): CloudShadowUniforms => {
  const uniforms: CloudShadowUniforms = {
    cloudSpin: { value: 0 },
    cloudShadowStrength: { value: strength },
  };

  // Keep the map referenced on the material so the renderer keeps it uploaded
  // even though only the custom shader samples it.
  material.userData.cloudAlphaMap = cloudAlphaMap;

  const priorCompile = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${priorKey()}|cloud-shadows-v4`;
  material.onBeforeCompile = (shader, renderer) => {
    priorCompile.call(material, shader, renderer);
    shader.uniforms.cloudAlphaMap = { value: cloudAlphaMap };
    shader.uniforms.cloudSpin = uniforms.cloudSpin;
    shader.uniforms.cloudShadowStrength = uniforms.cloudShadowStrength;

    const withUniforms = shader.fragmentShader.replace(
      "void main() {",
      /* glsl */ `
uniform sampler2D cloudAlphaMap;
uniform float cloudSpin;
uniform float cloudShadowStrength;

void main() {
`
    );
    const patched = withUniforms.replace(
      OUTPUT_FRAGMENT,
      CLOUD_SHADOW_BEFORE_OUTPUT
    );
    if (patched === withUniforms || !patched.includes("cloudShadow")) {
      console.warn("[cloud-shadows] fragment patch did not apply");
    }
    shader.fragmentShader = patched;
  };

  return uniforms;
};
