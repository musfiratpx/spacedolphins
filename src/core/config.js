// Feature flags. Every Phase 2-4 / "planned later" feature has a flag here.
// Flip one to true only when that feature is actually built.
export const features = {
  // Phase 2
  realModels: true,        // loads .glb when present, placeholder otherwise
  nasaSamples: false,      // sampler.js + NASA layers in songs
  dataBreaks: false,
  holdNotes: false,
  scanUnlock: false,
  hotspots: false,
  machineLogs: false,      // log on card back with flip
  realStoryTags: false,
  radioReactions: false,
  oneLaneMode: false,
  moonRegion: false,
  deepSpaceRegion: false,
  cockpitHub: false,
  whatYoureHearing: false,
  // Phase 3
  asteroids: false,
  numanMeter: false,
  musicReactive: false,
  unlockCinematic: false,
  juice: false,            // fx.shake / flash / hitStop / burst do real work
  powers: false,
  warp: false,
  dustStorm: false,
  spatialAudio: false,
  originalArt: false,
  postFx: false,
  // Planned later
  shield: false,
  radioCheckQuiz: false,
  familyTree: false,
  exploreMap3d: false,
  factOrStory: false,
  signalRuler: false,
  gamepad: false,
  liveNeoWs: false,
  settingsScreen: false,
  recordMode: false,
};

export const judging = {
  perfectMs: 50,
  greatMs: 100,
  goodMs: 150,       // assumption: hits 100-150 ms count 0.25 (tune in playtesting)
  weights: { perfect: 1, great: 0.5, good: 0.25, miss: 0 },
  clear: { easy: 0.6, normal: 0.7, hard: 0.7 },
  grades: [ ['S', 0.95], ['A', 0.85], ['B', 0.7], ['C', 0] ],
};

export const audio = {
  lookaheadMs: 25,          // how often the scheduler wakes up
  scheduleAheadSec: 0.12,   // how far ahead it schedules
  leadInSec: 2.0,           // silence before bar 1 so players can get ready
};

export const debug = {
  // F2 click track (Prompt 2) and F3 hotspot coords (Prompt 3) hook into these.
  clickTrack: false,
  hotspotCoords: false,
};
