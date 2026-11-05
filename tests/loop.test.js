import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, createGameLoop } from '../src/engine/loop.js';

const DT = 1 / 120;

test('advance converts elapsed time into whole fixed steps and keeps the remainder', () => {
  const r = advance(0, 0.05, DT, 0.1);
  assert.equal(r.steps, 6);
  assert.ok(Math.abs(r.accumulator - (0.05 - 6 * DT)) < 1e-9);
});

test('advance produces no steps for sub-step frames but keeps accumulating', () => {
  const first = advance(0, DT / 2);
  assert.equal(first.steps, 0);
  const second = advance(first.accumulator, DT / 2);
  assert.equal(second.steps, 1);
});

test('advance clamps long frames such as after a tab switch', () => {
  const r = advance(0, 5, DT, 0.1, 12);
  assert.ok(r.steps <= 12);
  assert.ok(r.accumulator < DT);
});

test('game loop calls update with the fixed step and render once per frame', () => {
  const frames = [];
  const updates = [];
  let renders = 0;
  let scheduled = null;
  const loop = createGameLoop({
    update: (dt) => updates.push(dt),
    render: () => {
      renders += 1;
    },
    requestFrame: (cb) => {
      scheduled = cb;
      frames.push(cb);
      return frames.length;
    },
    cancelFrame: () => {},
  });

  loop.start();
  scheduled(1000); // first frame sets the baseline timestamp
  scheduled(1000 + 1000 / 60); // one 60 Hz frame

  assert.equal(renders, 2);
  assert.ok(updates.length >= 1);
  assert.ok(updates.every((dt) => dt === DT));

  loop.stop();
  assert.equal(loop.running, false);
});
