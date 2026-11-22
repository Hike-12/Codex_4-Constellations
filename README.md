# Astral Drift

Day 4 of 30 projects. A procedural Three.js observatory with 32 real constellation figures, 18 flight destinations, and a continuous stereo soundscape.

Run `npm install` and `npm run dev`. Run `npm test` for the atlas checks or `npm run build` for the Vercel output.

Scroll down or press W to fly forward. Scroll up or press S to reverse, and drag to turn. The plus and minus controls also work on touch screens. Space streams around you as you travel. Choose Observatory in Destinations to return to the starting view. Choose a constellation to return to the charted sky. Connect Mode lets you trace adjacent stars, Sound enables the ambient score, and H toggles the interface.

Constellation positions, visual magnitudes, and colors come from [d3-celestial](https://github.com/ofrohn/d3-celestial), under the [catalog license](src/data/CATALOG-LICENSE). [NASA Science](https://science.nasa.gov/solar-system/planets/) and [Hubble’s Messier catalog](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/) inform the destination notes and features. The flybys use artistic distances, sizes, and layouts. The coastline of Earth comes from [Natural Earth](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/).

Stars, nebulae, planets, rings, and sound are synthesized locally. A fixed pool of nearby sectors fills with seeded stars and uncharted worlds as you fly. The browser downloads no imagery, models, sound recordings, or third party data at runtime.
