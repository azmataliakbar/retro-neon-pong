/**
 * Match state machine. stepMatch is pure: it takes a match and returns the next one.
 */
import {
  createPaddle,
  idleBall,
  movePaddle,
  movePaddleBy,
  paddleHit,
  scorerOf,
  serveBall,
  stepBall,
} from './physics.js';
import { createAi, aiStep, isDifficulty } from './ai.js';

export const SERVE_DELAY = 0.9;
export const TARGET_SCORES = Object.freeze([3, 5, 7, 11, 21]);
export const DEFAULT_TARGET = 7;

export function createMatch({ world, difficulty = 'normal', targetScore = DEFAULT_TARGET, rand = Math.random }) {
  if (!isDifficulty(difficulty)) throw new RangeError(`Unknown difficulty: ${difficulty}`);
  return {
    world,
    difficulty,
    targetScore,
    status: 'playing',
    scores: { player: 0, ai: 0 },
    rally: 0,
    winner: null,
    paddles: { player: createPaddle(world, 'player'), ai: createPaddle(world, 'ai') },
    ball: idleBall(world),
    serve: { timer: SERVE_DELAY, direction: rand() < 0.5 ? -1 : 1 },
    ai: createAi(difficulty),
    lastEvent: null,
  };
}

export function stepMatch(match, { playerDir = 0, dt, rand = Math.random }) {
  if (match.status !== 'playing') return match;
  const { world } = match;

  const player = movePaddle(world, match.paddles.player, playerDir, dt);
  const aiResult = aiStep(match.ai, match.ball, match.paddles.ai, world, dt, rand);
  const ai = movePaddleBy(world, match.paddles.ai, aiResult.delta);

  let { ball, serve, rally, scores, status, winner } = match;
  let lastEvent = null;

  if (serve.timer > 0) {
    const timer = serve.timer - dt;
    serve = timer > 0 ? { ...serve, timer } : { timer: 0, direction: serve.direction };
    if (timer <= 0) ball = serveBall(world, serve.direction, rand);
  } else {
    ball = stepBall(world, ball, dt);
    const hit = paddleHit(world, ball, player) ?? paddleHit(world, ball, ai);
    if (hit) {
      ball = hit;
      rally += 1;
      lastEvent = 'hit';
    }

    const scorer = scorerOf(world, ball);
    if (scorer) {
      scores = { ...scores, [scorer]: scores[scorer] + 1 };
      const conceded = scorer === 'player' ? 'ai' : 'player';
      rally = 0;
      lastEvent = `point-${scorer}`;
      serve = { timer: SERVE_DELAY, direction: conceded === 'player' ? -1 : 1 };
      ball = idleBall(world);
      if (scores[scorer] >= match.targetScore) {
        status = 'over';
        winner = scorer;
      }
    }
  }

  return {
    ...match,
    paddles: { player, ai },
    ai: aiResult.ai,
    ball,
    serve,
    rally,
    scores,
    status,
    winner,
    lastEvent,
  };
}
