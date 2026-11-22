import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import { constellations, projectStar, spectralColor } from '../data/constellations';
import { starPoints } from './sky';

export function makeFigures() {
  const positions: number[] = [], colors: number[] = [], sizes: number[] = [], powers: number[] = [];
  const figures = constellations.map(item => {
    const center = new Vector3();
    const stars = item.points.map(([ra, dec, magnitude, bv]) => {
      const star = new Vector3(...projectStar(ra, dec, 420));
      center.add(star);
      positions.push(...star.toArray());
      const color = new Color(spectralColor(bv)).convertLinearToSRGB();
      colors.push(color.r, color.g, color.b);
      const brightness = Math.min(1, 10 ** (-.23 * (magnitude - .2)));
      sizes.push(6 + 25 * brightness);
      powers.push(.48 + .85 * brightness);
      return star;
    });
    const vertices = new Float32Array(item.edges.length * 6);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    const lines = new LineSegments(geometry, new LineBasicMaterial({
      color: '#b4c6e5', transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    lines.frustumCulled = false;
    let progress = 0;
    let visible = false;
    const tip = new Vector3();
    return {
      stars, center: center.normalize(), lines,
      update(dt: number, opacity: number, visited: ReadonlySet<number> | undefined) {
        if (visible) visible = opacity > .13;
        else visible = opacity > .24;
        const target = visible ? 1 : 0;
        progress += Math.sign(target - progress) * Math.min(Math.abs(target - progress), dt * (visible ? .59 : 1.6));
        lines.material.opacity = opacity;
        lines.visible = opacity > .02 && (progress > 0 || !!visited?.size);
        if (!lines.visible) return;
        item.edges.forEach(([a, b], edge) => {
          const start = stars[a], end = stars[b];
          const fraction = visited
            ? Number(visited.has(a) && visited.has(b))
            : Math.min(1, Math.max(0, progress * 2 - edge / item.edges.length));
          start.toArray(vertices, edge * 6);
          tip.copy(start).lerp(end, fraction).toArray(vertices, edge * 6 + 3);
        });
        geometry.attributes.position.needsUpdate = true;
      },
    };
  });
  return { figures, anchors: starPoints(positions, colors, sizes, powers) };
}
