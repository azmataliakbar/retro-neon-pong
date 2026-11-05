import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANDSCAPE_SIZE, makeWorld } from '../src/game/physics.js';
import { createMatch, stepMatch, SERVE_DELAY } from '../src/game/state.js';

const world = makeWorld(LANDSCAPE_SIZE);
const rand = () => 0.5;

test('new matches start at zero with a serve delay', () => {
  const m = createMatch({ world, rand });
  assert.deepEqual(m.scores, { player: 0, ai: 0 });
  assert.equal(m.status, 'playing');
  assert.equal(m.serve.timer, SERVE_DELAY);
});

test('the ball stays idle during the serve delay and then moves', () => {
  let m = createMatch({ world, rand });
  const idle = m.ball;
  m = stepMatch(m, { dt: 0.1, rand });
  assert.deepEqual(m.ball, idle);
  for (let i = 0; i < 20; i += 1) m = stepMatch(m, { dt: 0.1, rand });
  assert.notDeepEqual(m.ball, idle);
});

test('a ball leaving the player edge scores for the AI and serves back toward the player', () => {
  let m = createMatch({ world, rand });
  m = { ...m, serve: { timer: 0, direction: 1 }, ball: { x: 2, y: 250, vx: -500, vy: 0 } };
  m = stepMatch(m, { dt: 0.05, rand });
  assert.equal(m.scores.ai, 1);
  assert.equal(m.scores.player, 0);
  assert.equal(m.rally, 0);
  assert.equal(m.serve.direction, -1);
  assert.ok(m.serve.timer > 0);
});

test('the match ends when a side reaches the target score, and further steps are no-ops', () => {
  let m = createMatch({ world, targetScore: 1, rand });
  m = { ...m, serve: { timer: 0, direction: 1 }, ball: { x: world.width + 20, y: 250, vx: 500, vy: 0 } };
  m = stepMatch(m, { dt: 0.05, rand });
  assert.equal(m.status, 'over');
  assert.equal(m.winner, 'player');
  assert.equal(stepMatch(m, { dt: 0.05, rand }), m);
});

test('player input moves the player paddle', () => {
  let m = createMatch({ world, rand });
  const startY = m.paddles.player.y;
  m = stepMatch(m, { playerDir: -1, dt: 0.1, rand });
  assert.ok(m.paddles.player.y < startY);
});
