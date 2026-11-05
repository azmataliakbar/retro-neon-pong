/**
 * Opponent controller. Human-like behaviour comes from four layers:
 *  1. Reaction delay: the AI only re-reads the ball every N ms, so it sees stale data.
 *  2. Aim error: each re-read targets a slightly wrong spot.
 *  3. Hesitation: occasional short pauses, more frequent on easier tiers.
 *  4. Non-linear speed: an ease-in-out curve, so the paddle accelerates on long
 *     moves and settles near the target instead of snapping to it.
 */
import { clamp, paddleCenter } from './physics.js';

export const DIFFICULTY = Object.freeze({
  easy: Object.freeze({
    label: 'Easy',
    reactionMs: [280, 420],
    hesitationChance: 0.18,
    hesitationMs: [220, 420],
    topSpeed: 0.42,
    aimError: 0.06,
    predicts: false,
  }),
  normal: Object.freeze({
    label: 'Normal',
    reactionMs: [170, 270],
    hesitationChance: 0.08,
    hesitationMs: [120, 260],
    topSpeed: 0.62,
    aimError: 0.035,
    predicts: true,
  }),
  hard: Object.freeze({
    label: 'Hard',
    reactionMs: [100, 170],
    hesitationChance: 0.03,
    hesitationMs: [60, 140],
    topSpeed: 0.84,
    aimError: 0.018,
    predicts: true,
  }),
  insane: Object.freeze({
    label: 'Insane',
    reactionMs: [55, 95],
    hesitationChance: 0,
    hesitationMs: [0, 0],
    topSpeed: 1.05,
    aimError: 0.006,
    predicts: true,
  }),
});

export const DIFFICULTY_ORDER = Object.freeze(['easy', 'normal', 'hard', 'insane']);

export function isDifficulty(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(DIFFICULTY, key);
}

export function createAi(difficulty) {
  if (!isDifficulty(difficulty)) throw new RangeError(`Unknown difficulty: ${difficulty}`);
  return { difficulty, targetY: null, reactionLeft: 0, hesitateLeft: 0, aim: 0 };
}

const sampleRange = ([lo, hi], rand) => lo + (hi - lo) * rand();
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Where the ball will cross the AI's paddle line, allowing for top and bottom bounces.
 * Returns null when the ball is not heading toward the AI.
 */
export function predictInterceptY(world, ball, paddle) {
  if (ball.vx <= 0) return null;
  const targetX = paddle.x - world.ballR;
  const t = (targetX - ball.x) / ball.vx;
  if (t < 0) return null;

  // Fold the unbounded y into [lo, hi] as if it were bouncing between the walls.
  const lo = world.ballR;
  const hi = world.height - world.ballR;
  const span = hi - lo;
  const period = 2 * span;
  const m = (((ball.y + ball.vy * t - lo) % period) + period) % period;
  return lo + (m <= span ? m : period - m);
}

/**
 * One AI tick. Returns the next AI state and a paddle displacement (world units).
 * `rand` is injectable so tests can be deterministic.
 */
export function aiStep(ai, ball, paddle, world, dt, rand = Math.random) {
  const cfg = DIFFICULTY[ai.difficulty];
  let { targetY, reactionLeft, hesitateLeft, aim } = ai;
  reactionLeft -= dt;
  hesitateLeft -= dt;

  if (reactionLeft <= 0) {
    reactionLeft = sampleRange(cfg.reactionMs, rand) / 1000;
    aim = (rand() * 2 - 1) * cfg.aimError * world.height;
    let base = world.height / 2;
    if (ball.vx > 0) {
      const predicted = cfg.predicts ? predictInterceptY(world, ball, paddle) : null;
      base = predicted ?? ball.y;
    }
    targetY = base + aim;
    if (rand() < cfg.hesitationChance) {
      hesitateLeft = sampleRange(cfg.hesitationMs, rand) / 1000;
    }
  }

  const err = targetY - paddleCenter(world, paddle);
  let delta = 0;
  if (hesitateLeft <= 0 && Math.abs(err) > 0.5) {
    const closeness = clamp(Math.abs(err) / (world.height * 0.25), 0, 1);
    // 15% floor keeps the paddle from crawling to a stop; the curve still controls the feel.
    const speed = cfg.topSpeed * world.paddleSpeed * (0.15 + 0.85 * easeInOut(closeness));
    delta = Math.sign(err) * Math.min(Math.abs(err), speed * dt);
  }

  return { ai: { ...ai, targetY, reactionLeft, hesitateLeft, aim }, delta };
}
