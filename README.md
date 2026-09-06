# Solar System Model

An interactive 3D model of the Sun, planets, and major moons. Travel between bodies, read a few facts, and toggle view layers. Built with [Three.js](https://threejs.org/).

**Live demo:** [kylegough.github.io/solar-system](https://kylegough.github.io/solar-system/)

## How to explore

- Click a body to travel to it.
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

<img width="2560" height="1287" alt="Mars" src="https://github.com/user-attachments/assets/75501202-2021-446b-a0a6-34db18a30922" />
<img width="2560" height="1287" alt="Solar System Model" src="https://github.com/user-attachments/assets/84b4c0e6-51f7-4a39-a33f-f72042f21a54" />
<img width="2560" height="1287" alt="Earth" src="https://github.com/user-attachments/assets/bc4d3c77-1e48-4a79-a2d2-43fc2030e0ec" />
<img width="2560" height="1287" alt="Moon" src="https://github.com/user-attachments/assets/d2fd0ce8-ea86-448f-a91a-c2db5d5f2b63" />
<img width="2560" height="1287" alt="Neptune" src="https://github.com/user-attachments/assets/57d17e91-0202-4b98-8f56-974b9e42f765" />

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
