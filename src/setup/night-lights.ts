import * as THREE from "three";

const OUTGOING_LIGHT =
  "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;";

// Mix the night map over Standard lighting as N·L goes negative (the dark
// hemisphere). Twilight is a soft band around the terminator so city lights
// fade in rather than popping on. A luma gate boosts only the urban texels;
// land and ocean stay at the darkened map values.
const NIGHT_OUTGOING_LIGHT = /* glsl */ `
vec3 dayLight = totalDiffuse + totalSpecular;
float nightLuma = max(totalEmissiveRadiance.r, max(totalEmissiveRadiance.g, totalEmissiveRadiance.b));
totalEmissiveRadiance *= 1.0 + 1.0 * smoothstep(0.05, 0.25, nightLuma);
#if ( NUM_SPOT_LIGHTS > 0 ) || ( NUM_POINT_LIGHTS > 0 )
	#if ( NUM_SPOT_LIGHTS > 0 )
		vec3 nightLightDir = normalize(spotLights[0].position - geometry.position);
	#else
		vec3 nightLightDir = normalize(pointLights[0].position - geometry.position);
	#endif
	float nightFactor = 1.0 - smoothstep(-0.15, 0.22, dot(geometry.normal, nightLightDir));
	vec3 outgoingLight = mix(dayLight, totalEmissiveRadiance, nightFactor);
#else
	vec3 outgoingLight = dayLight + totalEmissiveRadiance;
#endif
`;

/**
 * City lights on the night side. Uses the stock Standard program so normals
 * and roughness stay intact; only the final lighting combine is patched.
 */
export const applyNightLights = (
  material: THREE.MeshStandardMaterial,
  nightMap: THREE.Texture
) => {
  material.emissive = new THREE.Color(1, 1, 1);
  material.emissiveMap = nightMap;
  material.emissiveIntensity = 1.0;
  const priorCompile = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${priorKey()}|night-lights`;
  material.onBeforeCompile = (shader, renderer) => {
    priorCompile.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      OUTGOING_LIGHT,
      NIGHT_OUTGOING_LIGHT
    );
  };
};
