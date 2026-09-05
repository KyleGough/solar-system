import * as THREE from "three";

const NORMAL_MAPS = "#include <normal_fragment_maps>";

// geometryNormal is the sphere. After bump/normal maps, `normal` can tilt
// into the sun on the night side. Fade relief out as the geometric face
// turns away from the sun (at the origin).
const DAYSIDE_RELIEF = /* glsl */ `
#include <normal_fragment_maps>
vec3 sunDirView = normalize(viewMatrix[3].xyz + vViewPosition);
float geoNL = dot(geometryNormal, sunDirView);
normal = normalize(mix(geometryNormal, normal, smoothstep(0.0, 0.2, geoNL)));
`;

/**
 * Keep bump/normal relief on the daylit hemisphere so crater walls cannot
 * light up after the terminator.
 */
export const applyDaysideRelief = (material: THREE.MeshStandardMaterial) => {
  const priorCompile = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey.bind(material);

  material.customProgramCacheKey = () => `${priorKey()}|dayside-relief`;
  material.onBeforeCompile = (shader, renderer) => {
    priorCompile.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      NORMAL_MAPS,
      DAYSIDE_RELIEF
    );
  };
};
