# Astral Drift

Day 4 of 30 projects. A procedural Three.js observatory with 24 constellation figures, an ambient synthesizer, and a quiet atlas interface.

Run `npm install` and `npm run dev`. Run `npm test` for the atlas and interaction rules, or `npm run build` for the Vercel output.

Choose a figure in the atlas or click a bright star to fly toward it. In Explore, drag to turn and scroll to travel. Connect Mode lets you trace adjacent stars, and Sound enables the Web Audio score. Press H to hide the interface or bring it back.

The catalog uses equatorial coordinates, visual magnitudes, and B−V color indices from [d3-celestial](https://github.com/ofrohn/d3-celestial), under the [catalog license](src/data/CATALOG-LICENSE). Distances in the atlas refer to each entry’s brightest star and are approximate. The planets and free-flight distances are artistic, while the stellar positions are projected from their catalog directions.

The renderer creates its own stars, nebula, dust, planets, and rings. The score and chimes are synthesized in the browser. There are no runtime asset downloads beyond the app itself.
