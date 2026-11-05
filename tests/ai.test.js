import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANDSCAPE_SIZE, makeWorld, createPaddle } from '../src/game/physics.js';
import { DIFFICULTY, createAi, aiStep, predictInterceptY, isDifficulty } from '../src/game/ai.js';

const world = makeWorld(LANDSCAPE_SIZE);
const paddle = createPaddle(world, 'ai');

test('difficulty tiers get faster and more accurate in order', () => {
  const order = ['easy', 'normal', 'hard', 'insane'];
  for (let i = 1; i < order.length; i += 1) {
    const prev = DIFFICULTY[order[i - 1]];
    const cur = DIFFICULTY[order[i]];
    assert.ok(cur.topSpeed > prev.topSpeed, `${order[i]} should be faster`);
    assert.ok(cur.aimError < prev.aimError, `${order[i]} should aim better`);
  }
});

test('isDifficulty accepts only known tiers', () => {
  assert.equal(isDifficulty('hard'), true);
  assert.equal(isDifficulty('nightmare'), false);
  assert.equal(isDifficulty('__proto__'), false);
});

test('predictInterceptY returns null when the ball is moving away from the AI', () => {
  assert.equal(predictInterceptY(world, { x: 100, y: 100, vx: -200, vy: 0 }, paddle), null);
});

test('predictInterceptY stays inside the court after wall bounces', () => {
  for (let i = 0; i < 50; i += 1) {
    const ball = { x: 100 + i, y: (i * 37) % world.height, vx: 300, vy: 250 + i * 5 };
    const y = predictInterceptY(world, ball, paddle);
    assert.ok(y >= world.ballR && y <= world.height - world.ballR, `out of bounds at i=${i}: ${y}`);
  }
});

test('AI paddle never moves faster than its tier allows', () => {
  const dt = 1 / 120;
  for (const key of Object.keys(DIFFICULTY)) {
    let ai = createAi(key);
    const cap = DIFFICULTY[key].topSpeed * world.paddleSpeed * dt + 1e-9;
    for (let i = 0; i < 600; i += 1) {
      const result = aiStep(ai, { x: 700, y: 50 + (i % 300), vx: 300, vy: 100 }, paddle, world, dt, () => 0.5);
      assert.ok(Math.abs(result.delta) <= cap, `${key} exceeded cap at step ${i}`);
      ai = result.ai;
    }
  }
});

test('insane AI closes distance faster than easy AI from the same position', () => {
  const dt = 1 / 120;
  const ball = { x: 700, y: 50, vx: 300, vy: 0 };
  const easy = aiStep(createAi('easy'), ball, paddle, world, dt, () => 0.5);
  const insane = aiStep(createAi('insane'), ball, paddle, world, dt, () => 0.5);
  assert.ok(Math.abs(insane.delta) > Math.abs(easy.delta));
});

test('AI reaction is delayed: it does not retarget on every tick', () => {
  const ai = createAi('easy');
  const first = aiStep(ai, { x: 700, y: 50, vx: 300, vy: 0 }, paddle, world, 1 / 120, () => 0.5);
  const second = aiStep(first.ai, { x: 700, y: 400, vx: 300, vy: 0 }, paddle, world, 1 / 120, () => 0.5);
  assert.equal(second.ai.targetY, first.ai.targetY);
});
