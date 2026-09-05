# Solar System Model

An interactive 3D model of the Sun, planets, and major moons. Travel between bodies, read a few facts, and toggle view layers. Built with [Three.js](https://threejs.org/).

**Live demo:** [kylegough.github.io/solar-system](https://kylegough.github.io/solar-system/)

## How to explore

- Double-click a body to travel to it.
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

![Sun](https://github.com/KyleGough/solar-system/assets/24881448/194f78d5-b35b-4661-bdae-85fd06f7a94f)
![Earth](https://github.com/KyleGough/solar-system/assets/24881448/ca9ca06e-36a7-46f8-91cc-5942df1e3906)
![Moon](https://github.com/KyleGough/solar-system/assets/24881448/d22fcdad-d7bc-4bf1-b026-9967317b1a69)
![Mars](https://github.com/KyleGough/solar-system/assets/24881448/7b6806d4-d8ff-400e-8405-afb8f189acbc)
![Neptune](https://github.com/KyleGough/solar-system/assets/24881448/a5677621-40ab-4aa5-a14e-f928010e1806)

## Credits

- **The Sun, Jupiter, Saturn, Uranus, and Neptune** - [https://www.solarsystemscope.com/textures/](https://www.solarsystemscope.com/textures/)
- **Terrestrial Planets** - [https://planetpixelemporium.com/planets.html](https://planetpixelemporium.com/planets.html)
- **Moon** - [https://svs.gsfc.nasa.gov/4720](https://svs.gsfc.nasa.gov/4720)
- **Ganymede** - [https://www.deviantart.com/askaniy/art/Ganymede-Texture-Map-11K-808732114](https://www.deviantart.com/askaniy/art/Ganymede-Texture-Map-11K-808732114)
- **Titan** - [https://planet-texture-maps.fandom.com/wiki/Titan](https://planet-texture-maps.fandom.com/wiki/Titan)
- **Callisto** - [http://bjj.mmedia.is/data/callisto/](http://bjj.mmedia.is/data/callisto/)
- **Io** - [https://phys.org/news/2014-12-solar-worlds-distant-exoplanets.html](https://phys.org/news/2014-12-solar-worlds-distant-exoplanets.html)
- **Europa** - [https://www.johnstonsarchive.net/spaceart/cylmaps.html](https://www.johnstonsarchive.net/spaceart/cylmaps.html)
- **Triton** - [https://www.go-astronomy.com/planets/neptune-moon-triton.htm](https://www.go-astronomy.com/planets/neptune-moon-triton.htm)
