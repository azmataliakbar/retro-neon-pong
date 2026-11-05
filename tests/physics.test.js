import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANDSCAPE_SIZE,
  PORTRAIT_SIZE,
  makeWorld,
  worldForAspect,
  createPaddle,
  movePaddle,
  movePaddleBy,
  serveBall,
  stepBall,
  paddleHit,
  scorerOf,
} from '../src/game/physics.js';

const world = makeWorld(LANDSCAPE_SIZE);

test('worldForAspect picks the portrait court for tall arenas', () => {
  assert.equal(worldForAspect(4 / 3).width, PORTRAIT_SIZE.width);
  assert.equal(worldForAspect(10 / 16).width, LANDSCAPE_SIZE.width);
});

test('paddles are clamped inside the court', () => {
  const p = createPaddle(world, 'player');
  assert.equal(movePaddle(world, p, 1, 100).y, world.height - world.paddleH);
  assert.equal(movePaddleBy(world, p, -9999).y, 0);
});

test('serveBall sends the ball toward the requested side', () => {
  assert.ok(serveBall(world, -1, () => 0.5).vx < 0);
  assert.ok(serveBall(world, 1, () => 0.5).vx > 0);
});

test('stepBall reflects off the top and bottom walls', () => {
  const top = stepBall(world, { x: 400, y: world.ballR - 1, vx: 0, vy: -200 }, 0.1);
  assert.ok(top.y >= world.ballR);
  assert.ok(top.vy > 0);

  const bottom = stepBall(world, { x: 400, y: world.height - world.ballR + 1, vx: 0, vy: 200 }, 0.1);
  assert.ok(bottom.y <= world.height - world.ballR);
  assert.ok(bottom.vy < 0);
});

test('paddleHit returns the ball heading right when the player returns it', () => {
  const p = createPaddle(world, 'player');
  const ball = { x: p.x + world.paddleW + world.ballR - 1, y: p.y + world.paddleH / 2, vx: -300, vy: 0 };
  const hit = paddleHit(world, ball, p);
  assert.ok(hit);
  assert.ok(hit.vx > 0);
  assert.ok(hit.x >= p.x + world.paddleW);
});

test('paddleHit ignores a ball already moving away from the paddle', () => {
  const p = createPaddle(world, 'player');
  const ball = { x: p.x + world.paddleW, y: p.y + world.paddleH / 2, vx: 300, vy: 0 };
  assert.equal(paddleHit(world, ball, p), null);
});

test('paddleHit steers the ball by where it lands on the paddle', () => {
  const p = createPaddle(world, 'player');
  const x = p.x + world.paddleW + world.ballR - 1;
  const nearTop = paddleHit(world, { x, y: p.y + 1, vx: -300, vy: 0 }, p);
  const nearBottom = paddleHit(world, { x, y: p.y + world.paddleH - 1, vx: -300, vy: 0 }, p);
  assert.ok(nearTop.vy < 0);
  assert.ok(nearBottom.vy > 0);
});

test('scorerOf identifies the side that conceded the point', () => {
  assert.equal(scorerOf(world, { x: -world.ballR - 1, y: 0 }), 'ai');
  assert.equal(scorerOf(world, { x: world.width + world.ballR + 1, y: 0 }), 'player');
  assert.equal(scorerOf(world, { x: 400, y: 100 }), null);
});
