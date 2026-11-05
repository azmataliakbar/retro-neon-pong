/**
 * Pure geometry and motion for one match. Every function returns new objects and
 * never mutates its arguments, so the whole module is unit-testable without a DOM.
 *
 * All distances are in "world units". The renderer maps world units to screen pixels,
 * which is what removes the resolution-dependent scaling defect of the legacy code.
 */

export const LANDSCAPE_SIZE = Object.freeze({ width: 800, height: 500 });
export const PORTRAIT_SIZE = Object.freeze({ width: 600, height: 800 });

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Derives every size and speed from the court dimensions so all shapes play alike. */
export function makeWorld({ width, height }) {
  const short = Math.min(width, height);
  return Object.freeze({
    width,
    height,
    paddleW: width * 0.016,
    paddleH: height * 0.18,
    inset: width * 0.04,
    ballR: short * 0.014,
    serveSpeed: width * 0.3,
    maxSpeed: width * 0.66,
    paddleSpeed: height * 0.7,
    speedGain: 1.02,
    maxBounceAngle: Math.PI / 3.2,
  });
}

/** Tall arenas (height >= width) get the portrait court; wide ones get landscape. */
export function worldForAspect(heightOverWidth) {
  return makeWorld(heightOverWidth >= 1 ? PORTRAIT_SIZE : LANDSCAPE_SIZE);
}

export function createPaddle(world, side) {
  const x = side === 'player' ? world.inset : world.width - world.inset - world.paddleW;
  return Object.freeze({ side, x, y: (world.height - world.paddleH) / 2 });
}

export function paddleCenter(world, paddle) {
  return paddle.y + world.paddleH / 2;
}

export function movePaddleBy(world, paddle, delta) {
  return { ...paddle, y: clamp(paddle.y + delta, 0, world.height - world.paddleH) };
}

/** Moves a paddle by a direction (-1, 0, 1) over a timestep. */
export function movePaddle(world, paddle, dir, dt) {
  return movePaddleBy(world, paddle, clamp(dir, -1, 1) * world.paddleSpeed * dt);
}

export function idleBall(world) {
  return { x: world.width / 2, y: world.height / 2, vx: 0, vy: 0 };
}

/** direction -1 serves toward the player (left), +1 toward the AI (right). */
export function serveBall(world, direction, rand = Math.random) {
  const angle = (rand() * 2 - 1) * (Math.PI / 6);
  const sign = direction < 0 ? -1 : 1;
  return {
    x: world.width / 2,
    y: world.height / 2,
    vx: sign * Math.cos(angle) * world.serveSpeed,
    vy: Math.sin(angle) * world.serveSpeed,
  };
}

export function stepBall(world, ball, dt) {
  const r = world.ballR;
  let { x, y, vx, vy } = ball;
  x += vx * dt;
  y += vy * dt;
  if (y - r < 0) {
    y = 2 * r - y;
    vy = Math.abs(vy);
  } else if (y + r > world.height) {
    y = 2 * (world.height - r) - y;
    vy = -Math.abs(vy);
  }
  return { x, y, vx, vy };
}

/**
 * Returns the reflected ball if it strikes the paddle, otherwise null.
 * The exit angle depends on where the ball lands, so edge hits steer the ball.
 */
export function paddleHit(world, ball, paddle) {
  const r = world.ballR;
  const isPlayer = paddle.side === 'player';
  if (isPlayer ? ball.vx >= 0 : ball.vx <= 0) return null;

  const overlapsX = ball.x + r >= paddle.x && ball.x - r <= paddle.x + world.paddleW;
  const overlapsY = ball.y >= paddle.y - r && ball.y <= paddle.y + world.paddleH + r;
  if (!overlapsX || !overlapsY) return null;

  const offset = clamp((ball.y - paddleCenter(world, paddle)) / (world.paddleH / 2), -1, 1);
  const speed = Math.min(world.maxSpeed, Math.hypot(ball.vx, ball.vy) * world.speedGain);
  const angle = offset * world.maxBounceAngle;
  const dir = isPlayer ? 1 : -1;
  const x = isPlayer ? paddle.x + world.paddleW + r : paddle.x - r;

  return { x, y: ball.y, vx: dir * speed * Math.cos(angle), vy: speed * Math.sin(angle) };
}

/** 'ai' if the ball left the player's edge, 'player' if it left the AI's edge, else null. */
export function scorerOf(world, ball) {
  if (ball.x + world.ballR < 0) return 'ai';
  if (ball.x - world.ballR > world.width) return 'player';
  return null;
}
