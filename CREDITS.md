# Credits

**Hardware Hunters 4052** by Space Dolphins, NASA Space Apps Challenge 2026.
NASA does not endorse this project. NASA's insignia and logotype are not used.

## NASA data and media

| What | Used for | Source | Credit |
|---|---|---|---|
| NASA 3D Resources | Hardware models | https://science.nasa.gov/3d-resources/ | NASA (per-model lines below) |
| NeoWs (Near Earth Object Web Service) | Real asteroid names, sizes, speeds | https://api.nasa.gov/ | NASA/JPL |
| Viking 1 mission page | Card facts | https://science.nasa.gov/mission/viking-1/ | NASA |
| Mars Exploration Rovers mission page | Card facts | https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/ | NASA |
| InSight mission page | Card facts | https://science.nasa.gov/mission/insight/ | NASA |
| Ingenuity mission page | Card facts | https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/ | NASA |

### Models (NASA 3D Resources, https://github.com/nasa/NASA-3D-Resources, downloaded 2026-11-14)
- Viking Lander: `3D Models/Viking Lander`. NASA
- Mars Exploration Rover Opportunity (MER-B): `3D Models/Mars Exploration Rover - Opportunity (MER-B)`. NASA
- InSight: `3D Models/InSight Cruise Lander` ("arm deployed" version). NASA/JPL-Caltech
- Ingenuity Mars Helicopter: `3D Models/Ingenuity Mars Helicopter`. NASA/JPL-Caltech
- Apollo Lunar Module: `3D Models/Apollo Lunar Module`. NASA
- Lunar Reconnaissance Orbiter: `3D Models/Lunar Reconnaissance Orbiter (B)`. NASA
- Voyager: `3D Models/Voyager Probe (B)`. NASA/JPL-Caltech
- Cassini-Huygens: `3D Models/Cassini-Huygens (A)`. NASA/JPL-Caltech
- New Horizons: NASA printable parts, https://science.nasa.gov/3d-resources/new-horizons/ (body, antenna, RTG), assembled per NASA's assembly sheet and colored by our team
- Lunar Roving Vehicle and Blue Ghost lander: original Three.js models by our team (NASA has no 3D model of either), shaped after NASA photos; no company markings
- Asteroid 1999 RQ36 (Bennu): `3D Models/1999 RQ36 asteroid` (downloaded; the game's asteroids are now original procedural rocks)

### Planet textures
- Earth: Blue Marble, NASA Goddard Space Flight Center Scientific Visualization Studio, https://svs.gsfc.nasa.gov/2915/
- Moon color + elevation: CGI Moon Kit (LRO/LROC and LOLA data), NASA's Scientific Visualization Studio, https://svs.gsfc.nasa.gov/4720/
- Mars, Phobos, Deimos: NASA 3D Resources `Images and Textures`
- Deep space ringed planet: original art painted in code (not a NASA image)

### Asteroid data
- NeoWs snapshot (`data/asteroids.json`), NASA/JPL, via https://api.nasa.gov/. Each asteroid links to its JPL Small-Body Database record.

### Sounds (https://www.nasa.gov/historical-sounds/, downloaded 2026-11-14). NASA
- Atlas V: Launch (riser in the Mars song)
- Quindar: Sound #1 (percussion beeps in the Mars song)
- Kepler: Star KIC12268220C Light Curve Waves to Sound (Mars data break until the InSight marsquake is added)
- Voyager: Lightning on Jupiter
- Cassini: Saturn Radio Emissions #2
- LCROSS: Water on the Moon Song
- Stardust: Passing Comet Tempel 1 (Mars song)
- Cassini: Enceladus Sound (Moon song)
- Cassini: Saturn Radio Emissions #1 (Deep space song)
- InSight: First Likely Marsquake (sonification), Perseverance: First Sounds from Mars, and Ingenuity in flight heard by Perseverance: NASA/JPL-Caltech, clips cut from NASA videos on images.nasa.gov (Mars song)
- Not used: Quindar: Sound #1 (contains radio voices) and LCROSS: Water on the Moon Song (may contain vocals; appears to be by an outside artist). The game uses no vocals.
- Skipped: the Sputnik beep (not a NASA spacecraft) and the University of Iowa chorus clip (credited to a third party).

### Code
- Draco mesh decoder (`assets/draco/`), Apache License 2.0, from Google's Draco via Three.js examples

## Music
All music is original, written as code for this game and played with Web Audio synthesizers.

## Code and fonts
- Three.js, MIT License, https://threejs.org
- Vite, MIT License, https://vitejs.dev
- Nunito and Space Mono, SIL Open Font License, via Google Fonts
