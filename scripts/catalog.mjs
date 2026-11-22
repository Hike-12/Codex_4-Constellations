import { readFileSync, writeFileSync } from 'node:fs';

// Inputs: d3-celestial's constellations.lines.json and stars.6.json.
const [lines, stars] = process.argv.slice(2).map(path => JSON.parse(readFileSync(path)).features);
const ids = 'Ori UMa UMi Cas Cyg Lyr Sco Leo Tau Gem And Peg Aql Boo CMa Cen Cru Dra Her Per Sgr Vir Aur CrB Ari Lib Psc Cet Del Col CMi Eri'.split(' ');
const byCoordinate = new Map(stars.map(s => [s.geometry.coordinates.join(','), s.properties]));
const catalog = Object.fromEntries(ids.map(id => {
  const points = [], edges = [], indices = new Map();
  for (const stroke of lines.find(line => line.id === id).geometry.coordinates) {
    const sequence = stroke.map(([ra, dec]) => {
      const key = [ra, dec].join(',');
      if (!indices.has(key)) {
        const star = byCoordinate.get(key) ?? stars.find(s =>
          Math.abs(s.geometry.coordinates[0] - ra) < 0.004 &&
          Math.abs(s.geometry.coordinates[1] - dec) < 0.004)?.properties;
        if (!star) throw new Error('Missing catalog star ' + id + ' ' + key);
        indices.set(key, points.length);
        points.push([((ra + 360) % 360).toFixed(4) * 1, dec, star.mag, Number(star.bv) || 0]);
      }
      return indices.get(key);
    });
    for (let i = 1; i < sequence.length; i++) edges.push([sequence[i - 1], sequence[i]]);
  }
  return [id, { points, edges }];
}));
writeFileSync('src/data/catalog.json', JSON.stringify(catalog) + '\n');

