# Solar System Model

An interactive 3D model of the Sun, planets, and major moons. Travel between bodies, read a few facts, and toggle view layers. Built with Three.js.

**Live demo:** [kylegough.github.io/solar-system](https://kylegough.github.io/solar-system/)

## How to explore

- Use the orbit nav to jump between the Sun, planets, and major moons.
- **Labels** shows or hides points of interest. **Trails** shows or hides orbit paths. **Spin** rides the focused body's rotation. **Controls** opens simulation settings.
- The info panel shows a short description and stats for the focused body.
- Link to a body with a hash in the URL, for example `#mars`.

## Capabilities

- The Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune, plus major moons
- Rings, orbit trails, and a bloom effect on the Sun
- Points of interest on some bodies
- Night lights on Earth
- HUD facts for the focused body

## Setup

This project requires [Node.js](https://nodejs.org/en/download/) 24 or later. If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` to pick up the version in `.nvmrc`.

```bash
npm install
npm run dev
```

## Screenshots

<img width="2560" height="1287" alt="Mars" src="https://github.com/user-attachments/assets/e6c0e138-a92f-4e12-bf39-585d35c00838" />
<img width="2560" height="1287" alt="Earth" src="https://github.com/user-attachments/assets/44b6c3bf-19cc-4ddb-8132-30e475e3b36c" />
<img width="2560" height="1287" alt="Moon" src="https://github.com/user-attachments/assets/da05d226-1286-4d04-95cd-efd1432c9fb1" />
<img width="2560" height="1287" alt="Neptune" src="https://github.com/user-attachments/assets/1766f4ba-ae3c-4ae1-870f-6eadb01570ed" />
<img width="2560" height="1287" alt="Saturn" src="https://github.com/user-attachments/assets/545d1fb4-3ef6-454a-89a1-132f9a3298f8" />

## Credits

- **The Sun, Gas giants, Ice giants** - [https://www.solarsystemscope.com/textures/](https://www.solarsystemscope.com/textures/)
- **Terrestrial Planets** - [https://planetpixelemporium.com/planets.html](https://planetpixelemporium.com/planets.html)
- **Mercury** - NASA/JHUAPL/Carnegie Institution, [MESSENGER](https://messenger.jhuapl.edu/)
- **Earth night lights** - NASA Black Marble 2016 (Suomi NPP VIIRS) - [https://www.visibleearth.nasa.gov/images/144898](https://www.visibleearth.nasa.gov/images/144898)
- **Moon** - [https://svs.gsfc.nasa.gov/4720](https://svs.gsfc.nasa.gov/4720)
- **Ganymede** - [https://www.deviantart.com/askaniy/art/Ganymede-Texture-Map-11K-808732114](https://www.deviantart.com/askaniy/art/Ganymede-Texture-Map-11K-808732114)
- **Titan** - [https://planet-texture-maps.fandom.com/wiki/Titan](https://planet-texture-maps.fandom.com/wiki/Titan)
- **Callisto** - [http://bjj.mmedia.is/data/callisto/](http://bjj.mmedia.is/data/callisto/)
- **Io** - [https://phys.org/news/2014-12-solar-worlds-distant-exoplanets.html](https://phys.org/news/2014-12-solar-worlds-distant-exoplanets.html)
- **Europa** - [https://www.johnstonsarchive.net/spaceart/cylmaps.html](https://www.johnstonsarchive.net/spaceart/cylmaps.html)
- **Triton** - [https://www.go-astronomy.com/planets/neptune-moon-triton.htm](https://www.go-astronomy.com/planets/neptune-moon-triton.htm)
- **Phobos** - NASA 3D Resources, [Phobos shape model](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/)
- **Deimos** - NASA/JPL-Caltech, [Deimos shape model](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/)
- **Points of interest** - NASA public-domain photographs:
  - Apollo 11 landing - NASA AS11-40-5948
  - Tycho Crater - NASA/GSFC/Arizona State University, LRO
  - Olympus Mons - NASA/JPL, Viking 1 ([PIA02982](https://science.nasa.gov/photojournal/color-mosaic-of-olympus-mons/))
  - Tharsis Montes - NASA/JPL/GSFC, Mars Global Surveyor MOLA
  - Valles Marineris - NASA/JPL-Caltech, Viking
  - Perseverance - NASA/JPL-Caltech/MSSS ([Selfie with Ingenuity](https://science.nasa.gov/resource/perseverances-selfie-with-ingenuity/))
  - Curiosity - NASA/JPL-Caltech/MSSS ([PIA19807](https://www.jpl.nasa.gov/images/pia19807-curiosity-low-angle-self-portrait-at-buckskin-drilling-site-on-mount-sharp/))
  - Great Red Spot - NASA/JPL, Voyager 1 ([PIA00014](https://www.jpl.nasa.gov/images/pia00014-jupiter-great-red-spot/))
  - Saturn's hexagon - NASA/JPL-Caltech/Space Science Institute, Cassini
  - Great Dark Spot - NASA/JPL, Voyager 2 ([PIA00064](https://photojournal.jpl.nasa.gov/catalog/PIA00064))
