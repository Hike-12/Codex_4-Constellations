import { describe, expect, it } from 'vitest';
import { connectStar, constellations, projectStar, spectralColor, waypointProgress } from './constellations';

describe('sky atlas', () => {
  it('contains 24 unique annotated constellations with valid catalog stars and links', () => {
    expect(constellations).toHaveLength(24);
    expect(new Set(constellations.map(c => c.id)).size).toBe(24);
    for (const c of constellations) {
      expect(c.name && c.translation && c.brightest && c.note).toBeTruthy();
      expect(c.distance).toBeGreaterThan(0);
      expect(c.edges.length).toBeGreaterThan(0);
      for (const [a, b] of c.edges) {
        expect(a).not.toBe(b);
        for (const index of [a, b]) {
          expect(Number.isInteger(index) && index >= 0 && index < c.points.length).toBe(true);
        }
      }
      for (const [ra, dec, magnitude, bv] of c.points) {
        expect(ra >= 0 && ra < 360 && Math.abs(dec) <= 90).toBe(true);
        expect(Number.isFinite(magnitude) && Number.isFinite(bv)).toBe(true);
      }
    }
  });

  it('maps blue, white, yellow and red stars to distinct colors', () => {
    expect([-0.25, 0.15, 0.65, 1.85].map(spectralColor))
      .toEqual(['#CAD8FF', '#F8F7FF', '#FFE4B5', '#FFB482']);
  });

  it('projects the equator and pole in the correct directions', () => {
    expect(projectStar(0, 0, 5)).toEqual([5, 0, -0]);
    expect(projectStar(90, 0, 5)[2]).toBeCloseTo(-5);
    expect(projectStar(20, 90, 5)[1]).toBeCloseTo(5);
    expect(Math.hypot(...projectStar(52, -22, 5))).toBeCloseTo(5);
  });

  it('eases into and out of a waypoint and clamps overshoot', () => {
    expect(waypointProgress(-1, 2)).toBe(0);
    expect(waypointProgress(0.5, 2)).toBeLessThan(0.25);
    expect(waypointProgress(1, 2)).toBe(0.5);
    expect(waypointProgress(1.5, 2)).toBeGreaterThan(0.75);
    expect(waypointProgress(3, 2)).toBe(1);
  });

  it('links neighbors, ignores duplicates and advances to detached strokes', () => {
    const edges: [number, number][] = [[0, 1], [1, 2], [3, 4]];
    const first = connectStar(edges, new Set(), 0);
    expect([...first]).toEqual([0]);
    for (const invalid of [0, 2, 3, 99]) expect(connectStar(edges, first, invalid)).toBe(first);
    const stroke = connectStar(edges, connectStar(edges, first, 1), 2);
    expect([...connectStar(edges, stroke, 3)]).toEqual([0, 1, 2, 3]);
  });
});
