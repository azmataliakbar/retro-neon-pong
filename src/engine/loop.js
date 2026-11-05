/**
 * requestAnimationFrame loop with a fixed-timestep accumulator.
 * Physics always advances in equal steps, so speed does not depend on refresh rate
 * (60, 120, or 144 Hz). Rendering runs once per display frame.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Pure accumulator math, separated out for testing.
 * Clamps long frames (tab switches) and caps steps to prevent a spiral of death.
 */
export function advance(accumulator, frameSec, fixedDt = 1 / 120, maxFrame = 0.1, maxSteps = 12) {
  let acc = accumulator + clamp(frameSec, 0, maxFrame);
  let steps = 0;
  while (acc >= fixedDt && steps < maxSteps) {
    acc -= fixedDt;
    steps += 1;
  }
  if (steps === maxSteps) acc = Math.min(acc, fixedDt); // drop backlog rather than stall
  return { steps, accumulator: acc };
}

export function createGameLoop({
  update,
  render,
  fixedDt = 1 / 120,
  maxFrame = 0.1,
  requestFrame = (cb) => globalThis.requestAnimationFrame(cb),
  cancelFrame = (id) => globalThis.cancelAnimationFrame(id),
}) {
  let accumulator = 0;
  let last = null;
  let handle = null;
  let running = false;

  function frame(timestamp) {
    if (!running) return;
    const frameSec = last === null ? 0 : (timestamp - last) / 1000;
    last = timestamp;
    const result = advance(accumulator, frameSec, fixedDt, maxFrame);
    accumulator = result.accumulator;
    for (let i = 0; i < result.steps; i += 1) update(fixedDt);
    render(timestamp);
    handle = requestFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = null;
      handle = requestFrame(frame);
    },
    stop() {
      running = false;
      if (handle !== null) cancelFrame(handle);
      handle = null;
    },
    get running() {
      return running;
    },
  };
}
