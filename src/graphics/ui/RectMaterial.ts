import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Shared unit plane reused by every `Box`/`Rect`/`Image` mesh. Sizing is
 * done via `mesh.scale`, so geometry never needs to be rebuilt on resize.
 */
export const unitPlaneGeometry = new THREE.PlaneGeometry(1, 1)

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec2 uSize;
  uniform vec4 uRadius;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uBorderWidth;
  uniform vec3 uBorderColor;
  uniform bool uHasGradient;
  uniform sampler2D uGradientTex;
  uniform float uGradientAngle;
  uniform bool uHasTexture;
  uniform sampler2D uTexture;
  uniform vec4 uUvRect;

  varying vec2 vUv;

  // Signed distance to a box with per-corner rounding.
  // https://iquilezles.org/articles/distfunctions2d/
  float sdRoundBox(vec2 p, vec2 halfSize, vec4 r) {
    r.xy = (p.x > 0.0) ? r.xy : r.zw;
    r.x = (p.y > 0.0) ? r.x : r.y;
    vec2 q = abs(p) - halfSize + r.x;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
  }

  void main() {
    vec2 halfSize = max(uSize * 0.5, vec2(0.0001));
    vec2 p = (vUv - 0.5) * uSize;

    float maxRadius = min(halfSize.x, halfSize.y);
    // uRadius is (topLeft, topRight, bottomRight, bottomLeft); sdRoundBox wants (topRight, bottomRight, topLeft, bottomLeft).
    vec4 r = clamp(uRadius.yzxw, 0.0, maxRadius);

    float dist = sdRoundBox(p, halfSize, r);
    float aa = max(fwidth(dist), 0.0001);
    float shapeAlpha = 1.0 - smoothstep(-aa, aa, dist);
    if (shapeAlpha <= 0.001) discard;

    vec3 color = uColor;

    if (uHasGradient) {
      vec2 dir = vec2(cos(uGradientAngle), sin(uGradientAngle));
      float proj = dot(p, dir);
      float maxProj = max(abs(dir.x) * halfSize.x + abs(dir.y) * halfSize.y, 0.0001);
      float t = clamp(proj / (2.0 * maxProj) + 0.5, 0.0, 1.0);
      color = texture2D(uGradientTex, vec2(t, 0.5)).rgb;
    }

    float texAlpha = 1.0;
    if (uHasTexture) {
      vec2 uv = (vUv - 0.5) * uUvRect.zw + 0.5 + uUvRect.xy;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        texAlpha = 0.0;
      } else {
        vec4 tex = texture2D(uTexture, uv);
        color = tex.rgb;
        texAlpha = tex.a;
      }
    }

    if (uBorderWidth > 0.0) {
      vec4 innerR = clamp(r - uBorderWidth, 0.0, maxRadius);
      float innerDist = sdRoundBox(p, halfSize - vec2(uBorderWidth), innerR);
      float borderMask = smoothstep(-aa, aa, innerDist);
      color = mix(color, uBorderColor, borderMask);
    }

    gl_FragColor = vec4(color, uOpacity * shapeAlpha * texAlpha);
  }
`

export const RectMaterialImpl = shaderMaterial(
  {
    uSize: new THREE.Vector2(1, 1),
    uRadius: new THREE.Vector4(0, 0, 0, 0),
    uColor: new THREE.Color('white'),
    uOpacity: 1,
    uBorderWidth: 0,
    uBorderColor: new THREE.Color('black'),
    uHasGradient: false,
    uGradientTex: null as THREE.Texture | null,
    uGradientAngle: 0,
    uHasTexture: false,
    uTexture: null as THREE.Texture | null,
    uUvRect: new THREE.Vector4(0, 0, 1, 1),
  },
  vertexShader,
  fragmentShader,
  (material) => {
    if (!material) return
    material.transparent = true
    material.depthTest = false
    material.depthWrite = false
    material.toneMapped = false
    material.clipping = true
    material.side = THREE.DoubleSide
  },
)

extend({ RectMaterial: RectMaterialImpl })

declare module '@react-three/fiber' {
  interface ThreeElements {
    rectMaterial: ThreeElements['shaderMaterial'] & {
      uSize?: THREE.Vector2
      uRadius?: THREE.Vector4
      uColor?: THREE.ColorRepresentation
      uOpacity?: number
      uBorderWidth?: number
      uBorderColor?: THREE.ColorRepresentation
      uHasGradient?: boolean
      uGradientTex?: THREE.Texture | null
      uGradientAngle?: number
      uHasTexture?: boolean
      uTexture?: THREE.Texture | null
      uUvRect?: THREE.Vector4
    }
  }
}

export type RectMaterial = InstanceType<typeof RectMaterialImpl>
