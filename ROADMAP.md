# Roadmap

Deadline: Nov 15, 2026, 11:59 PM (aim for 9:00 PM). Human tasks live in the team's private to-do list (TODOME.md, kept out of the public repo).

## Phase 1: Base demo (Mars) ✅

- [x] Vite + Three.js project, static build with relative paths
- [x] Required hooks: event bus (incl. `beat`), screen registry, feature flags, settings, audio clock + analyser, fx no-ops, manifest loader, full hardware.json schema, song score format with `dataBreak`
- [x] Audio clock, lookahead sequencer, synth backbone (kick, snare, hats, bass, pad, lead, riser)
- [x] Mars song score (112 BPM, ~81 s) and Easy/Normal/Hard charts generated from it
- [x] Rhythm round: two lanes, circle/diamond notes, Perfect/Great/Good/Miss, combo, accuracy, Early/Late, pause, lead-in countdown
- [x] Title, radio intro, ship hub (with quick settings), pre-round, results, hardware card, Hardwaredex, credits
- [x] 4 Mars cards from verified facts; model placeholders until NASA .glb files arrive
- [x] Progress and best grades saved to localStorage
- [x] F2 click track (debug)
- [x] NeoWs snapshot script (`scripts/fetch-asteroids.js`)

## Phase 2: Real content and core loop

- [ ] Hook and timing check (Prompt 2)
- [ ] Real NASA models on cards, loading indicator, size/triangle logging, F3 hotspot debug (Prompt 3, needs downloads)
- [ ] NASA music system: prep-audio.sh, sampler, 3 songs, data breaks, "What you're hearing" pop-ups (Prompt 4, needs downloads)
- [ ] Hold notes
- [ ] Scan-to-unlock effect
- [ ] Clickable hotspots
- [ ] Machine logs on card backs (flip)
- [ ] Real/Story tags everywhere
- [ ] Radio reactions (3 variants for great/OK/fail)
- [ ] One-lane easy mode
- [ ] Moon and Deep space regions (unlock with 3 of the previous region's 4)
- [ ] Ship hub as a cockpit screen

## Phase 3: Immersion and polish

- [ ] Asteroid layer from data/asteroids.json (real names, sizes, speeds)
- [ ] Numan frequency meter and pulse
- [ ] Music-reactive lights, lanes and stars
- [ ] Unlock cinematic
- [ ] Juice: shake, flash, hit-stop, burst
- [ ] Hardware powers
- [ ] Warp transition, Mars dust storm
- [ ] Spatial audio
- [ ] Original art: SVG cockpit, nebula skies, mission patches
- [ ] Post-processing on High; auto quality

## Phase 4: Ship

- [ ] Feature freeze; full playthrough bug list
- [ ] Credits and manifest cover every model and sound
- [ ] TODO_VERIFY list cleared
- [ ] Performance check on Low/Medium/High
- [ ] Production build on a static host; demo recorded; submitted

## Planned later

Earth shield meter, radio check quiz, family tree, 3D explore map, Fact-or-Story round, signal ruler,
size compare, then-and-now slider, timeline scrubber, gamepad, live NeoWs refresh, finale boss
asteroid, settings screen with calibration, chart record mode, Surveyor 3 bonus.
