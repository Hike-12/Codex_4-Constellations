import catalog from './catalog.json';

const atlas = [
  ['Ori','Orion','The Hunter','Rigel',860,'Three blue stars mark the hunter’s belt. Below it, the Orion Nebula is still making stars.'],
  ['UMa','Ursa Major','The Great Bear','Alioth',83,'Seven stars form the Big Dipper along the bear’s back and tail. Follow the two outer stars of its bowl toward Polaris.'],
  ['UMi','Ursa Minor','The Little Bear','Polaris',447,'Polaris holds the tip of the little bear’s tail. The rest of the northern sky appears to wheel around it.'],
  ['Cas','Cassiopeia','The Queen','Schedar',228,'Five bright stars sketch a throne across the Milky Way. As the night turns, its W becomes an M.'],
  ['Cyg','Cygnus','The Swan','Deneb',2600,'Deneb shines at the tail of a swan flying down the Milky Way. The star at its beak, Albireo, splits into gold and blue through a telescope.'],
  ['Lyr','Lyra','The Lyre','Vega',25,'Vega lights one corner of this tiny lyre. Between two of its fainter stars lies a shell of gas shed by a dying star.'],
  ['Sco','Scorpius','The Scorpion','Antares',550,'Antares burns red at the scorpion’s heart. Its tail curls back toward the dense star fields of the Milky Way.'],
  ['Leo','Leo','The Lion','Regulus',79,'A backward question mark traces the lion’s mane. Regulus sits at its base, almost directly in the Sun’s path across the sky.'],
  ['Tau','Taurus','The Bull','Aldebaran',65,'Aldebaran marks the eye of the bull against the V of the Hyades. It sits much closer to us than the cluster behind it.'],
  ['Gem','Gemini','The Twins','Pollux',34,'Pollux and Castor light the heads of the twins. Through a telescope, Castor begins to reveal a family of six stars.'],
  ['And','Andromeda','The Chained Maiden','Alpheratz',97,'A chain of stars leads away from the Great Square. Above it sits the faint glow of the Andromeda Galaxy.'],
  ['Peg','Pegasus','The Winged Horse','Enif',690,'Enif marks the muzzle of the winged horse. Its wide square shares a corner with neighboring Andromeda.'],
  ['Aql','Aquila','The Eagle','Altair',17,'Altair anchors the eagle astride the Milky Way. The star spins so fast that it bulges around its equator.'],
  ['Boo','Boötes','The Herdsman','Arcturus',37,'Follow the curve of the Big Dipper’s handle to Arcturus. Its orange light comes from a giant near the end of its life.'],
  ['CMa','Canis Major','The Great Dog','Sirius',8.6,'Sirius is the brightest star in Earth’s night sky. A faint white dwarf circles it in the glare.'],
  ['Cen','Centaurus','The Centaur','Alpha Centauri',4.37,'The foot of the centaur holds Alpha Centauri. Its family includes Proxima, our nearest stellar neighbor.'],
  ['Cru','Crux','The Southern Cross','Acrux',321,'The long arm of the cross points toward the south celestial pole. Beside it, the Coalsack is a dark window cut into the Milky Way.'],
  ['Dra','Draco','The Dragon','Eltanin',154,'Draco winds between the two bears. Its star Thuban lay near the celestial pole when the pyramids were built.'],
  ['Her','Hercules','The Strongman','Kornephoros',139,'Four stars make the Keystone at the strongman’s center. A globular cluster glows along one of its sides.'],
  ['Per','Perseus','The Hero','Mirfak',510,'Mirfak lights the middle of a loose gathering of stars. Nearby Algol dims when one star passes in front of another.'],
  ['Sgr','Sagittarius','The Archer','Kaus Australis',143,'The archer’s brightest stars make a teapot. Beyond its spout lies the dust veiling the center of our galaxy.'],
  ['Vir','Virgo','The Maiden','Spica',250,'Spica is a close pair wrapped in blue light. Far behind it, a crowded cluster of galaxies fills this stretch of sky.'],
  ['Aur','Auriga','The Charioteer','Capella',43,'Capella looks like one steady golden light. Two giant stars account for most of its glow.'],
  ['CrB','Corona Borealis','The Northern Crown','Alphecca',75,'A small arc of stars makes the northern crown. Alphecca shines at its center like a jewel.'],
  ['Ari','Aries','The Ram','Hamal',66,'Hamal and Sheratan form a small bend beside Pisces. The ram is easiest to find on autumn evenings in the north.'],
  ['Lib','Libra','The Scales','Zubeneschamali',185,'The two brightest stars once marked the claws of Scorpius. Today they balance the only inanimate figure in the zodiac.'],
  ['Psc','Pisces','The Fishes','Alpherg',350,'Two faint chains meet at the knot of a celestial cord. One end curls into the Circlet below Pegasus.'],
  ['Cet','Cetus','The Sea Monster','Diphda',96,'Diphda shines at the tail of this sprawling figure. Nearby Mira swells and fades over the course of nearly a year.'],
  ['Del','Delphinus','The Dolphin','Rotanev',101,'A tiny diamond and a short tail mark the dolphin. Look for it east of Altair, alongside the Milky Way.'],
  ['Col','Columba','The Dove','Phact',261,'A small handful of stars marks the dove below Canis Major. Its soft outline is clearest far from city lights.'],
  ['CMi','Canis Minor','The Little Dog','Procyon',11.5,'Procyon, Sirius and Betelgeuse form the Winter Triangle. Procyon itself has a faint white dwarf companion.'],
  ['Eri','Eridanus','The River','Achernar',139,'The river winds from the foot of Orion into the southern sky. Achernar marks the far end of its long course.'],
] as const;

export type Star = [ra: number, dec: number, magnitude: number, colorIndex: number];
export const constellations = atlas.map(([id, name, translation, brightest, distance, note]) => ({
  id, name, translation, brightest, distance, note,
  points: catalog[id].points as Star[],
  edges: catalog[id].edges as [number, number][],
}));

const radians = Math.PI / 180;
export function projectStar(ra: number, dec: number, radius = 1): [number, number, number] {
  const latitude = dec * radians;
  const longitude = ra * radians;
  const plane = radius * Math.cos(latitude);
  return [plane * Math.cos(longitude), radius * Math.sin(latitude), -plane * Math.sin(longitude)];
}

export function spectralColor(bv: number) {
  if (bv < 0.05) return '#CAD8FF';
  if (bv < 0.40) return '#F8F7FF';
  if (bv < 0.60) return '#FFF5E8';
  if (bv < 1.38) return '#FFE4B5';
  return '#FFB482';
}

export function waypointProgress(seconds: number, duration: number) {
  const t = Math.min(1, Math.max(0, seconds / duration));
  return t * t * (3 - 2 * t);
}

export function canLinkStar(edges: readonly [number, number][], visited: ReadonlySet<number>, star: number) {
  if (visited.has(star) || !edges.some(edge => edge.includes(star))) return false;
  if (!visited.size || edges.some(([a, b]) =>
    (a === star && visited.has(b)) || (b === star && visited.has(a)))) return true;
  // A detached stroke becomes available when the current stroke is complete.
  return !edges.some(([a, b]) => visited.has(a) !== visited.has(b));
}

export function connectStar(edges: readonly [number, number][], visited: ReadonlySet<number>, star: number) {
  return canLinkStar(edges, visited, star) ? new Set([...visited, star]) : visited;
}
