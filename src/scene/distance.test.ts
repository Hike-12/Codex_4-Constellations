import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { blendBetween, detailRange, keepOutside, placeForView } from './distance';

describe('deep space rendering and flight', () => {
  it('preserves the bearing and apparent size of a world well beyond the old far plane', () => {
    const world = new Vector3(70, 30, -90);
    const nearEye = new Vector3(0, 0, 12);
    const farEye = new Vector3(2300, -450, 19300);
    const visibleAt = new Vector3();
    expect(placeForView(world, nearEye, visibleAt)).toBe(1);
    expect(visibleAt.equals(world)).toBe(true);

    const scale = placeForView(world, farEye, visibleAt);
    const apparent = visibleAt.clone().sub(farEye);
    const actual = world.clone().sub(farEye);
    expect(apparent.length()).toBeCloseTo(detailRange);
    expect(apparent.clone().normalize().dot(actual.clone().normalize())).toBeCloseTo(1);
    expect(15 * scale / apparent.length()).toBeCloseTo(15 / actual.length(), 12);
    placeForView(world, nearEye, visibleAt);
    expect(visibleAt.equals(world)).toBe(true);
  });

  it('hands off a close body gradually in both directions', () => {
    expect([125, 130, 162.5, 195, 220].map(x => blendBetween(x, 130, 195)))
      .toEqual([0, 0, .5, 1, 1]);
  });

  it('stops a fast sweep at a small moon and lets the camera back away again', () => {
    const center = new Vector3();
    const start = new Vector3(0, 0, 4);
    const end = new Vector3(0, 0, -5);
    keepOutside(start, end, center, 2);
    expect(end.z).toBeCloseTo(2);
    const reverse = new Vector3(0, 0, 7);
    keepOutside(end, reverse, center, 2);
    expect(reverse.z).toBe(7);
  });

  it('allows a glancing step around the limb without entering the globe', () => {
    const next = new Vector3(1.7, 0, 1.3);
    keepOutside(new Vector3(2.2, 0, 0), next, new Vector3(), 2.2);
    expect(next.z).toBeGreaterThan(1.3);
    expect(next.length()).toBeCloseTo(2.2);
  });
});
