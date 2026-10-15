import { Color, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from 'three';
import type { WorldRect } from './mapLayout';

/** The shader loops over this many room rectangles (15 rooms + the boss room). */
export const MAX_FOG_ROOMS = 16;
/** Distance (world units) over which the fog thickens from the rooms outwards. */
const REACH = 13;

const VERTEX = `
varying vec2 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = `
#define MAX_ROOMS ${MAX_FOG_ROOMS}
uniform vec4 uRooms[MAX_ROOMS];
uniform int uCount;
uniform float uTime;
uniform float uScale;
uniform float uSpeed;
uniform float uThin;
uniform float uThick;
uniform float uReach;
uniform vec3 uDark;
uniform vec3 uLight;
varying vec2 vWorld;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  // Distance to the nearest room rectangle (0 inside a room).
  float d = 100000.0;
  for (int i = 0; i < MAX_ROOMS; i++) {
    if (i >= uCount) break;
    vec4 r = uRooms[i];
    vec2 q = max(vec2(r.x - vWorld.x, r.y - vWorld.y), vec2(vWorld.x - r.z, vWorld.y - r.w));
    d = min(d, length(max(q, 0.0)));
  }
  float t = smoothstep(0.0, uReach, d);
  vec2 drift = vec2(uTime * uSpeed, uTime * uSpeed * 0.55);
  float a = fbm(vWorld * uScale + drift);
  float b = fbm(vWorld * uScale * 2.3 - drift * 1.4 + 5.0);
  float cloud = mix(a, b, 0.4);
  float density = mix(uThin, uThick, t) * (0.55 + 0.95 * cloud);
  // The fog melts away at the walls of the rooms instead of cutting them off.
  float alpha = clamp(density, 0.0, 1.0) * smoothstep(0.0, 3.5, d);
  vec3 color = mix(uDark, uLight, smoothstep(0.25, 0.85, cloud));
  gl_FragColor = vec4(color, alpha);
}
`;

/**
 * A grey, drifting fog over everything that is not a room: thin next to the dungeon, dense far
 * away, with soft cloudy edges. Two layers at different heights give it some depth.
 */
export class MapFog {
  readonly group = new Group();
  private readonly materials: ShaderMaterial[] = [];
  private readonly rects: Vector4[] = Array.from({ length: MAX_FOG_ROOMS }, () => new Vector4());
  private readonly geometry: PlaneGeometry;
  private readonly count = { value: 0 };
  private readonly time = { value: 0 };

  /** `centre` and `size` describe the area (world units) the fog plane covers. */
  constructor(centre: { x: number; z: number }, size: { x: number; z: number }) {
    this.geometry = new PlaneGeometry(size.x, size.z).rotateX(-Math.PI / 2);
    const layers = [
      { y: 0.35, scale: 0.05, speed: 0.12, thin: 0.45, thick: 0.9 },
      { y: 1.5, scale: 0.032, speed: 0.07, thin: 0.3, thick: 0.75 },
    ];
    for (const layer of layers) {
      const material = new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uRooms: { value: this.rects },
          uCount: this.count,
          uTime: this.time,
          uScale: { value: layer.scale },
          uSpeed: { value: layer.speed },
          uThin: { value: layer.thin },
          uThick: { value: layer.thick },
          uReach: { value: REACH },
          uDark: { value: new Color(0x6c727b) },
          uLight: { value: new Color(0xb3b9c1) },
        },
      });
      this.materials.push(material);
      const mesh = new Mesh(this.geometry, material);
      mesh.position.set(centre.x, layer.y, centre.z);
      mesh.renderOrder = 5;
      this.group.add(mesh);
    }
  }

  /** The areas that are rooms (or about to be): the fog stays away from them. */
  setRects(rects: readonly WorldRect[]): void {
    const count = Math.min(rects.length, MAX_FOG_ROOMS);
    for (let i = 0; i < count; i++) {
      const r = rects[i];
      if (r) this.rects[i]?.set(r.minX, r.minZ, r.maxX, r.maxZ);
    }
    this.count.value = count;
  }

  /** Seconds of drift; a still fog (reduced motion) just keeps passing 0. */
  setTime(seconds: number): void {
    this.time.value = seconds;
  }

  dispose(): void {
    this.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}
