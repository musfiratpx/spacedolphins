// Juice hooks. Phase 1: these are safe no-ops that already respect reducedMotion
// and the photosensitivity limit (max 3 flashes per second). Phase 3 fills them in
// behind features.juice.
import { settings } from './settings.js';
import { features } from './config.js';

const flashTimes = [];

function motionAllowed() {
  return features.juice && !settings.reducedMotion;
}

export function canFlash(now = performance.now()) {
  while (flashTimes.length && now - flashTimes[0] > 1000) flashTimes.shift();
  return flashTimes.length < 3;
}

export const fx = {
  shake(/* strength = 1, ms = 150 */) {
    if (!motionAllowed()) return;
    // Phase 3: shake #app
  },
  flash(/* color = '#fff', ms = 80 */) {
    if (!motionAllowed()) return;
    const now = performance.now();
    if (!canFlash(now)) return;
    flashTimes.push(now);
    // Phase 3: animate #fx-flash
  },
  hitStop(/* ms = 40 */) {
    if (!motionAllowed()) return;
    // Phase 3: pause visual updates briefly (never the audio clock)
  },
  burst(/* x, y, color */) {
    if (!motionAllowed()) return;
    // Phase 3: particle burst on the lane canvas
  },
};
