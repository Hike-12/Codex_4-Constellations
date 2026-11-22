import { Group, Sphere, Vector3 } from 'three';
import { destinations } from '../data/destinations';
import { projectStar } from '../data/constellations';
import { sphere } from './celestialBodies';
import { random, starPoints } from './sky';

const span = 210;
const marks = 138;
const tints = ['#ab8f7b', '#8da9b1', '#bc876b', '#9d9aba', '#c7af92'];
const landmarks = destinations.map(item => ({
  center: new Vector3(...projectStar(item.ra, item.dec, item.depth)),
  clearance: item.radius * 2 + 44,
}));

function seed(x: number, y: number, z: number) {
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791) ^ 0x5e25d913) >>> 0;
}

function cell() {
  const root = new Group();
  const specks = starPoints(Array(marks * 3).fill(0), Array(marks * 3).fill(0), Array(marks).fill(1), Array(marks).fill(1));
  specks.geometry.boundingSphere = new Sphere(new Vector3(span / 2, span / 2, span / 2), span * Math.sqrt(3) / 2);
  specks.material.uniforms.nearby.value = 1;
  const world = sphere(1, 3, '#ab8f7b', 26);
  world.material.transparent = true;
  root.add(specks, world);
  return { root, specks, world, hasWorld: false };
}

export function sectors() {
  const root = new Group();
  const free = Array.from({ length: 27 }, cell);
  for (const tile of free) root.add(tile.root);
  const active = new Map<string, ReturnType<typeof cell>>();
  const worldCenter = new Vector3();
  let previous = '';

  function populate(tile: ReturnType<typeof cell>, x: number, y: number, z: number) {
    const key = seed(x, y, z);
    const rng = random(key);
    tile.root.position.set(x * span, y * span, z * span);
    const { position, tint, size, power } = tile.specks.geometry.attributes;
    for (let i = 0; i < marks; i++) {
      position.setXYZ(i, rng() * span, rng() * span, rng() * span);
      const hue = rng();
      tint.setXYZ(i, hue < .3 ? .98 : .61, .76, hue < .3 ? .53 : 1);
      const bright = rng() ** 6;
      size.setX(i, 4 + rng() * 6 + bright * 7);
      power.setX(i, .13 + bright * .49);
    }
    for (const attribute of [position, tint, size, power]) attribute.needsUpdate = true;

    tile.world.position.set((.17 + rng() * .66) * span, (.18 + rng() * .64) * span, (.17 + rng() * .66) * span);
    worldCenter.copy(tile.root.position).add(tile.world.position);
    tile.hasWorld = key % 5 < 3 && worldCenter.lengthSq() >= 195 ** 2 &&
      landmarks.every(item => worldCenter.distanceToSquared(item.center) > item.clearance ** 2);
    tile.world.scale.setScalar(5 + rng() ** 1.7 * 17);
    tile.world.material.uniforms.kind.value = key % 3 === 0 ? 1 : key % 3 === 1 ? 3 : 5;
    tile.world.material.uniforms.tint.value.set(tints[key % tints.length]).convertLinearToSRGB();
  }

  return { root, update(eye: Vector3, time: number, ratio: number) {
    const x = Math.floor(eye.x / span), y = Math.floor(eye.y / span), z = Math.floor(eye.z / span);
    const current = [x, y, z].join(':');
    if (current !== previous) {
      const around = new Map<string, [number, number, number]>();
      for (let a = x - 1; a <= x + 1; a++) for (let b = y - 1; b <= y + 1; b++) {
        for (let c = z - 1; c <= z + 1; c++) around.set([a,b,c].join(':'), [a,b,c]);
      }
      for (const [key, tile] of active) if (!around.has(key)) {
        free.push(tile);
        active.delete(key);
      }
      for (const [key, coord] of around) if (!active.has(key)) {
        const tile = free.pop()!;
        populate(tile, ...coord);
        active.set(key, tile);
      }
      previous = current;
    }
    for (const tile of active.values()) {
      const uniforms = tile.specks.material.uniforms;
      uniforms.time.value = time;
      uniforms.pixelRatio.value = ratio;
      if (!tile.hasWorld) { tile.world.visible = false; continue; }
      const range = worldCenter.copy(tile.root.position).add(tile.world.position).distanceTo(eye);
      const opacity = Math.max(0, Math.min(1, (span - range) / 54));
      tile.world.visible = opacity > 0;
      tile.world.rotation.y = time * .013;
      tile.world.material.uniforms.opacity.value = opacity;
    }
    return current;
  }};
}
