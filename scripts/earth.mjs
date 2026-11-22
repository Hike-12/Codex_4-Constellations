import { readFileSync, writeFileSync } from 'node:fs';

// Natural Earth ne_110m_land.geojson (public domain). Keep coastlines
// to sub-pixel accuracy for the runtime mask, quantized to quarter degrees.
const { features } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
function simplify(points) {
  const first = points[0], last = points.at(-1);
  const dx = last[0] - first[0], dy = last[1] - first[1], length = dx * dx + dy * dy;
  let distance = .16, split = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const x = points[i][0] - first[0], y = points[i][1] - first[1];
    const t = length > 0 ? Math.min(1, Math.max(0, (x * dx + y * dy) / length)) : 0;
    const d = (x - dx * t) ** 2 + (y - dy * t) ** 2;
    if (d > distance) { distance = d; split = i; }
  }
  return split > 0
    ? [...simplify(points.slice(0, split + 1)).slice(0, -1), ...simplify(points.slice(split))]
    : [first, last];
}
const polygons = features.flatMap(({ geometry }) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
).map(polygon => polygon.map(ring =>
  simplify(ring).slice(0, -1).flatMap(point => point.map(value => Math.round(value * 4)))
).filter(ring => ring.length >= 6)).filter(polygon => polygon.length > 0);
writeFileSync('src/data/earth.json', JSON.stringify(polygons) + '\n');
