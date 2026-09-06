import * as THREE from "three";

/** D-ring inner and A-ring outer, as multiples of the parent planet’s mesh radius. */
const RING_INNER = 1.11;
export const RING_OUTER = 2.27;

const RING_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vPlanetCenter;
varying vec3 vRingNormal;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vWorldPos = world.xyz;
  vPlanetCenter = modelMatrix[ 3 ].xyz;
  vRingNormal = normalize( mat3( modelMatrix ) * vec3( 0.0, 0.0, 1.0 ) );
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const RING_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec3 diffuse;
uniform float uPlanetRadius;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vPlanetCenter;
varying vec3 vRingNormal;

float saturnUmbra() {
  vec3 sunDir = normalize( -vPlanetCenter );
  vec3 oc = vWorldPos - vPlanetCenter;
  float along = dot( oc, sunDir );
  vec3 perp = oc - sunDir * along;
  float q = length( perp ) / max( uPlanetRadius, 1e-5 );
  float radial = 1.0 - smoothstep( 0.97, 1.06, q );
  float farSide = smoothstep( 0.08, -0.04, along / max( uPlanetRadius, 1e-5 ) );
  return 1.0 - radial * farSide;
}

void main() {
  vec4 texel = texture2D( map, vUv );
  if ( texel.a < 0.04 ) {
    discard;
  }

  vec3 sunDir = normalize( -vPlanetCenter );
  vec3 normal = normalize( vRingNormal ) * ( gl_FrontFacing ? 1.0 : -1.0 );
  float ndotl = dot( normal, sunDir );
  float incidence = max( abs( ndotl ), 0.1 );
  float scatter = 0.50 + 0.38 * pow( incidence, 0.32 );
  float face = mix( 0.38, 0.52, smoothstep( -0.05, 0.12, ndotl ) );
  vec3 viewDir = normalize( cameraPosition - vWorldPos );
  float towardSun = pow( clamp( dot( -viewDir, sunDir ), 0.0, 1.0 ), 5.0 );
  face = mix( face, max( face, 0.54 ), towardSun );
  float lit = scatter * face * saturnUmbra();
  vec3 color = texel.rgb * diffuse * lit + texel.rgb * 0.045;

  gl_FragColor = vec4( color, texel.a );
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}
`;

/**
 * Saturn’s ring disk, sized from the parent planet’s scaled mesh radius so the
 * inner edge stays outside the globe. The texture is a radial strip (U = radius).
 */
export const createRingMesh = (
  texture: THREE.Texture,
  planetRadius: number
): THREE.Mesh => {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  const innerRadius = planetRadius * RING_INNER;
  const outerRadius = planetRadius * RING_OUTER;
  const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 192, 8);
  const pos = ringGeometry.attributes.position;
  const uv = ringGeometry.attributes.uv;
  const v3 = new THREE.Vector3();
  const span = outerRadius - innerRadius;

  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    uv.setXY(i, (v3.length() - innerRadius) / span, 0.5);
  }
  uv.needsUpdate = true;

  const ringMaterial = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      diffuse: { value: new THREE.Color(1.32, 1.20, 1.02) },
      uPlanetRadius: { value: planetRadius },
    },
    vertexShader: RING_VERTEX,
    fragmentShader: RING_FRAGMENT,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.04,
    depthWrite: true,
    toneMapped: true,
  });

  const rings = new THREE.Mesh(ringGeometry, ringMaterial);
  rings.name = "rings";
  rings.renderOrder = 1;
  rings.castShadow = false;
  rings.receiveShadow = false;
  rings.rotation.x = Math.PI / 2;

  return rings;
};

export const setRingPlanetRadius = (
  mesh: THREE.Mesh,
  planetRadius: number,
  sourceRadius: number
) => {
  if (sourceRadius <= 0) {
    return;
  }
  mesh.scale.setScalar(planetRadius / sourceRadius);
  const material = mesh.material as THREE.ShaderMaterial;
  material.uniforms.uPlanetRadius.value = planetRadius;
};
