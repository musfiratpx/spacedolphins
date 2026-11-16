# CLAUDE.md — Hardware Hunters 4052

Read this whole file before changing anything. It is the source of truth for scope,
architecture and facts. The full design lives in the team's "Full Project Outline" doc;
this file is the build-facing summary.

## The game in one paragraph

A first-person browser rhythm game for ages 10–14. It's 4052, Earth's shield is failing,
and the Numans (a new life form) will shatter incoming asteroids if you play their
two-lane rhythm games. Each cleared round lets you **scan** one real NASA machine
(1960s–2026) into the Archive and read its hardware card. The rhythm drives the story;
the hardware teaches the science. Working title: "Hardware Hunters 4052".

Decision: **scan, don't recover.** Machines are scanned into hologram copies for the
Archive; originals stay where they rest as monuments.

## Hard rules

1. **Accuracy.** Every fact on a card must come from the "Facts" section below or a NASA
   page linked in `hardware.json`. If a fact isn't listed, write `TODO_VERIFY` instead of
   guessing. No invented quotes presented as real (Opportunity never "said" its battery
   was low; that was a reporter's paraphrase).
2. **Real vs Story.** All player-facing text is tagged `real` or `story`.
3. **No copied art.** All art is original and made in code (SVG, Canvas, shaders, Three.js).
   Real hardware uses NASA's own 3D models. No NASA insignia/logotype, no astronaut photos,
   no Anthropic mascot, no Voyager Golden Record music.
4. **Licensing.** Music: CC0 or written by us as code. NASA sounds and models: credit the
   mission/source in `CREDITS.md` and `assets/manifest.json` even though they're
   generally not copyrighted. Skip anything credited to a third party.
5. **Timing.** All gameplay and music timing uses the audio clock
   (`AudioContext.currentTime`), never `Date.now()` or frame counts. Music is scheduled
   with a lookahead scheduler.
6. **Charts come from the score.** Note charts are generated from the same song score the
   sequencer plays, so notes always line up with the music.
7. **Main always runs.** Build in small steps; the game must be playable after each one.
8. **Don't build later phases early.** Add the hook if one is needed, nothing more.
9. **Accessibility.** Left notes are circles, right notes are diamonds. Body text ≥ 16 px.
   Every effect respects `settings.reducedMotion`. Never more than 3 flashes per second.
10. Plain words, ≤ 25 words per card field. Kids skim.

## Tech

- Static site: HTML, CSS, JavaScript (ES modules), Three.js, Web Audio. Vite for dev/build.
- `npm run dev` to play, `npm run build` → `dist/` (relative paths, runs from any static
  server / GitHub Pages).
- `data/` and `assets/` are fetched at runtime and copied into `dist/` by the build.

## File structure

```
index.html
src/
  main.js            start-up, screen switching
  core/              bus.js, config.js, settings.js, state.js, fx.js, manifest.js, data.js
  audio/             clock.js, synth.js, sequencer.js, charts.js, sampler.js, sfx.js
  rhythm/            round.js (lanes, input, judging, scoring, drawing)
  three/             viewer.js (hardware model viewer)
  screens/           one file per screen
  styles.css
data/
  hardware.json      regions + machines
  songs/             song scores (one JSON per song)
  asteroids.json     NeoWs snapshot (Phase 3)
assets/
  manifest.json      every model/sound with source URL + credit
  models/            NASA .glb files
  sounds/nasa/raw/   original NASA downloads
  sounds/nasa/       processed .ogg/.mp3 (scripts/prep-audio.sh)
  art/               our SVG art
scripts/             fetch-asteroids.js, prep-audio.sh
CREDITS.md  ROADMAP.md
```

## Phases

### Phase 1 — Base demo (Mars only)
Title → radio intro (typed captions, skippable) → ship hub → pre-round (pick a Mars
machine + difficulty) → rhythm round (two lanes, tap notes, Perfect/Great/Miss, accuracy,
combo, pause) → results (grade, clear/fail) → hardware card (3D model or marked
placeholder, card fields) → back to hub. Simple Hardwaredex grid. Credits screen.
One Mars song using only the synth backbone. Progress saved to localStorage.

**Done when:** a player can go from the title screen through a round to an unlocked Mars
card, repeat until all 4 Mars machines are unlocked, progress survives a reload, and
`npm run build` output runs from a static server.

### Phase 2 — Real content and core loop
Real NASA models on cards (centered, scaled, auto-rotate, loading indicator, memory
freed on close, size/triangle logging); starter hotspots with F3 debug. NASA music system:
`prep-audio.sh`, `sampler.js`, three songs (Moon/Mars/Deep space), data breaks, Easy/Normal/
Hard charts, "What you're hearing" pop-ups. Hold notes, scan-to-unlock, clickable
hotspots, machine logs on card backs, Real/Story tags, radio reactions (3 variants for
great/OK/fail), one-lane easy mode, Moon and Deep space regions (unlock with 3 of the
previous region's 4), ship hub as a cockpit screen.

### Phase 3 — Immersion and polish
Asteroid layer from `data/asteroids.json`; Numan frequency meter and pulse; music-reactive
lights/lanes/stars; unlock cinematic; juice (`fx.shake/flash/hitStop/burst`); hardware
powers; warp transition and Mars dust storm; spatial audio; original art (SVG cockpit,
nebula skies, mission patches); post-processing on High only with auto quality.

### Phase 4 — Ship
Feature freeze, full playthrough bug list, credits/manifest check, TODO_VERIFY list,
performance check, production build on a static server, deploy, demo.

### Planned later (hooks only until scheduled)
Earth shield meter and repair rounds, radio check quiz, Hardwaredex family tree, 3D
explore map, Fact-or-Story round, signal ruler, size compare, then-and-now slider,
timeline scrubber, gamepad + vibration, live NeoWs refresh, finale boss asteroid,
settings screen with calibration, record mode for charts, Surveyor 3 bonus.

## Required hooks (must exist from Phase 1)

- **Event bus** `core/bus.js`: `on/off/once/emit`. Events: `beat {beat, bar, time}`,
  `bar`, `round:start`, `round:end`, `note:hit {judgement, lane, offsetMs}`,
  `note:miss`, `combo`, `unlock {id}`, `screen:change`, `radio:line`,
  `sample:firstPlay {id}`, `dataBreak:start/end`, `settings:change`.
- **Screen registry** in `main.js`: `registerScreen(id, {mount, unmount})`, `go(id, params)`.
- **Config flags** `core/config.js`: `features.*` for every Phase 2–4 / later feature
  (all `false` until built).
- **Settings** `core/settings.js`: volumes (master/music/sfx/radio), noteSpeed,
  audioOffsetMs, reducedMotion, oneLane, captions, quality, colorblind, dyslexiaFont.
- **Audio clock** `audio/clock.js`: `getAudioTime()`, `getAnalyser()`, music/sfx/radio buses.
- **FX** `core/fx.js`: `shake, flash, hitStop, burst` as no-ops that already check
  `reducedMotion` and the 3-flashes-per-second limit.
- **Full `hardware.json` schema** (see below) even where values are `TODO_VERIFY`.
- **Song score format** with `dataBreak` (see below).
- **Manifest loader** `core/manifest.js`: real file if present, marked placeholder if
  missing, logs what's missing.

## Data formats

### hardware.json machine
```json
{
  "id": "insight", "name": "InSight lander", "region": "mars",
  "place": "Elysium Planitia", "lat": 4.5, "lon": 135.6, "arrived": 2018,
  "why": "...", "howItWorked": "...", "found": "...",
  "status": "...", "statusAsOf": "2026-11-14",
  "log": ["..."], "numanNote": "...", "teaser": "...",
  "power": "quake-sense", "model": "insight", "sound": "marsquake",
  "hotspots": [{ "part": "Seismometer", "position": [0, 0, 0], "label": "..." }],
  "source": "https://science.nasa.gov/mission/insight/",
  "tags": { "why": "real", "numanNote": "story" }
}
```

### Song score (data/songs/*.json)
```json
{
  "id": "mars-drive", "title": "...", "region": "mars", "bpm": 112,
  "stepsPerBar": 16, "swing": 0,
  "instruments": { "kick": { "type": "synth.kick", "gain": 0.9, "role": "backbone" } },
  "patterns": { "kick": { "a": "x...x...x...x..." } },
  "sections": [ { "name": "intro", "bars": 4, "play": { "kick": "a" } } ],
  "chart": { "kick": { "lane": "L", "from": "easy" }, "snare": { "lane": "R", "from": "easy" } },
  "dataBreak": null
}
```
Drum patterns are 16-char strings (`x` hit, `o` accent, `.` rest). Melodic patterns are
arrays of 16 tokens (`"C2"`, `"-"` rest, `"_"` hold previous). `chart` says which tracks
become notes, on which lane (`L`, `R`, or `alt`), and from which difficulty up. Optional
`"hold": true` on a chart entry makes sustained notes into holds (needs
`features.holdNotes`). `dataBreak`: `{ "startBar": 33, "bars": 4, "sample": "marsquake",
"lanes": "alt" }` — notes are placed on the sample's loudest peaks (≥150 ms apart per lane).

## Judging
Perfect ≤ 50 ms, Great ≤ 100 ms, Good ≤ 150 ms (assumption: counts 0.25; tune in
playtesting), Miss beyond 150 ms. Accuracy = (Perfect×1 + Great×0.5 + Good×0.25) / notes.
Clear: 50% Easy, 60% Normal/Hard (lowered from 60/70 on 2026-11-14 at the team's request). Grades: S ≥ 95, A ≥ 85, B ≥ 70, C below.

## Musical roles

| Role | Job | Phase 1 (synth) | NASA layer (Phase 2) |
|---|---|---|---|
| Kick | Downbeats, the pulse players lock onto | synth kick | marsquake sub hit layered on top |
| Snare | Backbeat (2 and 4) | noise snare | Jupiter lightning accents (Deep space) |
| Hats | Subdivision, keeps eighths audible | noise hat | spacecraft beeps as percussion (Moon) |
| Bass | Harmony root, groove | saw bass | Ingenuity hum drone (Mars) |
| Pad | Mood, region color | soft chord pad | Mars wind / LCROSS / Voyager plasma |
| Lead | Melody, hooks | square lead | Kepler star sound (Deep space) |
| Riser | Section transitions | noise sweep | Atlas V launch roar |
| Data break | 2–4 bars where the backbone drops and a real recording plays; notes on its peaks | — | marsquake (Mars), Voyager plasma (Deep space) |

The backbone (kick, snare, hats, bass) always keeps the beat clear. NASA layers never mask it.
Song targets: Moon ~100 BPM calm, Mars ~112 BPM driving, Deep space ~140 BPM intense.

## Facts (verified for use on cards)

Anything not here is `TODO_VERIFY` until a teammate checks it against the NASA source.

**InSight** — Landed Nov 26, 2018, Elysium Planitia. Set a seismometer (SEIS) on the
ground under a dome-shaped wind and thermal shield. Detected more than 1,300 marsquakes;
the largest was about magnitude 5 (May 4, 2022). Dust covered its solar panels; NASA ended
the mission in December 2022. Studied the deep interior of Mars.
Source: https://science.nasa.gov/mission/insight/

**Opportunity** — Landed Jan 2004, Meridiani Planum. Planned for 90 Martian days; worked
almost 15 years and drove about 28 miles (45 km). Found evidence that Mars once had water
(hematite "blueberries"). A planet-wide dust storm in June 2018 blocked the Sun; last
contact June 10, 2018; mission declared over Feb 2019.
Source: https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/

**Viking 1 Lander** — Landed July 20, 1976, Chryse Planitia; first US spacecraft to land
successfully on Mars and send back pictures from the surface. Carried biology experiments
that tested Martian soil for signs of life; results were not taken as proof of life.
Worked until November 1982. (Viking 2 landed Sept 1976 at Utopia Planitia.)
Source: https://science.nasa.gov/mission/viking-1/

**Ingenuity** — Arrived Feb 18, 2021 in Jezero Crater, carried under Perseverance. First
powered, controlled flight on another planet (April 19, 2021). Two rotors spin in opposite
directions, very fast, to grip Mars's thin air. Flew 72 times; rotor damage ended the
mission in January 2024. Carried a small piece of fabric from the Wright brothers' 1903 Flyer.
Source: https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/

Coordinates are approximate and marked TODO_VERIFY in data until checked.

## Palette and type
Team palette (changed 2026-11-15): Navy `#0b1f3a` background, Blue `#133769` panels,
Light blue `#c2dde4` text and main accent, Red `#c9374c` Mars / warnings / fills,
Wine `#76101e` deep accents and Story tags, bright Purple `#A66CFF` for Deep Space,
data breaks and the cockpit glow. Small red text on dark uses the tint `#E37B8B`
for readability; muted text uses `#9DB7C2`. Nunito for UI, Space Mono for radio captions
(OFL). Fall back to system fonts if offline.
