import { Color, Group, Sphere, Vector3 } from 'three';
import { destinations } from '../data/destinations';
import { projectStar } from '../data/constellations';
import { sphere } from './celestialBodies';
import { blendBetween, distantBodies, keepOutside } from './distance';
import { random, starPoints } from './sky';

const span = 210;
const marks = 138;
const paints = ['#ab8f7b', '#8da9b1', '#bc876b', '#9d9aba', '#c7af92']
  .map(tint => new Color(tint).convertLinearToSRGB());
const landmarks = destinations.map(item => ({
  center: new Vector3(...projectStar(item.ra, item.dec, item.depth)),
  clearance: item.radius * 2 + 44,
}));

function seed(x: number, y: number, z: number) {
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791) ^ 0x5e25d913) >>> 0;
}

interface World {
  center: Vector3;
  radius: number;
  tint: Color;
  kind: number;
}

function worldAt(x: number, y: number, z: number): World | undefined {
  const key = seed(x, y, z);
  if (key % 11 >= 3) return;
  const rng = random(key ^ 0x28c569da);
  const center = new Vector3(x + .17 + rng() * .66, y + .18 + rng() * .64, z + .17 + rng() * .66).multiplyScalar(span);
  if (center.lengthSq() < 195 ** 2 || landmarks.some(item => center.distanceToSquared(item.center) < item.clearance ** 2)) return;
  return { center, radius: 5 + rng() ** 1.7 * 17, tint: paints[key % paints.length],
    kind: key % 3 === 0 ? 1 : key % 3 === 1 ? 3 : 5 };
}

function cell() {
  const root = new Group();
  const specks = starPoints(Array(marks * 3).fill(0), Array(marks * 3).fill(0), Array(marks).fill(1), Array(marks).fill(1));
  specks.geometry.boundingSphere = new Sphere(new Vector3(span / 2, span / 2, span / 2), span * Math.sqrt(3) / 2);
  specks.material.uniforms.nearby.value = 1;
  const world = sphere(1, 3, '#ab8f7b', 26);
  world.material.transparent = true;
  root.add(specks, world);
  return { root, specks, world, spec: undefined as World | undefined };
}

export function sectors() {
  const root = new Group();
  const far = distantBodies(1400);
  root.add(far.mesh);
  const free = Array.from({ length: 27 }, cell);
  for (const tile of free) root.add(tile.root);
  const active = new Map<string, ReturnType<typeof cell>>();
  const seen = new Map<string, World>();
  let vicinity = new Map<string, World>();
  let previous = '';

  function populate(tile: ReturnType<typeof cell>, x: number, y: number, z: number, spec?: World) {
    const rng = random(seed(x, y, z));
    tile.root.position.set(x * span, y * span, z * span);
    const { position, tint, size, power } = tile.specks.geometry.attributes;
    for (let i = 0; i < marks; i++) {
      position.setXYZ(i, rng() * span, rng() * span, rng() * span);
      const hue = rng(), bright = rng() ** 6;
      tint.setXYZ(i, hue < .3 ? .98 : .61, .76, hue < .3 ? .53 : 1);
      size.setX(i, 3 + rng() * 5 + bright * 5);
      power.setX(i, .11 + bright * .46);
    }
    for (const attribute of [position, tint, size, power]) attribute.needsUpdate = true;
    tile.spec = spec;
    if (!spec) { tile.world.visible = false; return; }
    tile.world.position.copy(spec.center).sub(tile.root.position);
    tile.world.scale.setScalar(spec.radius);
    tile.world.material.uniforms.kind.value = spec.kind;
    tile.world.material.uniforms.tint.value.copy(spec.tint);
  }

  return { root, avoid(start: Vector3, next: Vector3) {
    for (const tile of active.values()) if (tile.spec) keepOutside(start, next, tile.spec.center, tile.spec.radius * 1.12);
  }, update(eye: Vector3, time: number, ratio: number, pixels: number) {
    const x = Math.floor(eye.x / span), y = Math.floor(eye.y / span), z = Math.floor(eye.z / span);
    const current = [x, y, z].join(':');
    if (current !== previous) {
      const around = new Map<string, [number, number, number]>();
      const next = new Map<string, World>();
      for (let a = x - 4; a <= x + 4; a++) for (let b = y - 4; b <= y + 4; b++) {
        for (let c = z - 4; c <= z + 4; c++) {
          const key = [a,b,c].join(':');
          const spec = vicinity.get(key) ?? seen.get(key) ?? worldAt(a,b,c);
          if (spec) next.set(key, spec);
          if (Math.max(Math.abs(a - x), Math.abs(b - y), Math.abs(c - z)) <= 1) around.set(key, [a,b,c]);
        }
      }
      vicinity = next;
      for (const [key, tile] of active) if (!around.has(key)) {
        free.push(tile);
        active.delete(key);
      }
      for (const [key, coord] of around) if (!active.has(key)) {
        const tile = free.pop()!;
        populate(tile, ...coord, vicinity.get(key));
        active.set(key, tile);
      }
      previous = current;
    }
    for (const tile of active.values()) {
      const uniforms = tile.specks.material.uniforms;
      uniforms.time.value = time;
      uniforms.pixelRatio.value = ratio;
      if (!tile.spec) continue;
      const range = tile.spec.center.distanceTo(eye);
      const opacity = 1 - blendBetween(range, 130, 195);
      tile.world.visible = opacity > 0;
      tile.world.rotation.y = time * .013;
      tile.world.material.uniforms.opacity.value = opacity;
    }
    far.begin(pixels);
    for (const [key, spec] of vicinity) {
      const range = spec.center.distanceTo(eye);
      if (range < 345) seen.set(key, spec);
      const presence = seen.has(key) ? 1 : 1 - blendBetween(range, 645, 835);
      far.add(spec.center, eye, spec.radius, spec.tint, presence * blendBetween(range, 130, 195), spec.kind === 3 ? 0 : 1);
    }
    for (const [key, spec] of seen) {
      if (!vicinity.has(key)) far.add(spec.center, eye, spec.radius, spec.tint, .86, spec.kind === 3 ? 0 : 1);
    }
    far.end();
    return current;
  }};
}
