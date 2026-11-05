/**
 * In-process command router (MCP-style: named commands, JSON-like payloads, structured
 * results). Nothing here throws to the caller: every outcome is {ok, data} or {ok, error}.
 *
 * This is a local registry, not a network MCP server.
 */
import { DIFFICULTY_ORDER, isDifficulty } from '../game/ai.js';

export const ErrorCode = Object.freeze({
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  HANDLER_FAILED: 'HANDLER_FAILED',
});

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const fail = (code, message) => ({ ok: false, error: { code, message } });

export function createDispatcher() {
  const handlers = new Map();

  return {
    register(name, handler) {
      if (typeof name !== 'string' || name.length === 0) {
        throw new TypeError('Command name must be a non-empty string');
      }
      if (typeof handler !== 'function') throw new TypeError(`Handler for ${name} must be a function`);
      if (handlers.has(name)) throw new Error(`Command already registered: ${name}`);
      handlers.set(name, handler);
    },

    commands() {
      return [...handlers.keys()];
    },

    dispatch(name, payload = {}) {
      const handler = handlers.get(name);
      if (!handler) return fail(ErrorCode.UNKNOWN_COMMAND, `Unknown command: ${String(name)}`);
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        return fail(ErrorCode.INVALID_PAYLOAD, 'Payload must be an object');
      }
      try {
        const data = handler(payload);
        return { ok: true, data: data ?? null };
      } catch (err) {
        if (err instanceof ValidationError) return fail(ErrorCode.INVALID_PAYLOAD, err.message);
        return fail(ErrorCode.HANDLER_FAILED, err?.message ?? 'Handler failed');
      }
    },
  };
}

const DIFFICULTY_HELP = `difficulty must be one of ${DIFFICULTY_ORDER.join(', ')}`;

/**
 * Registers the three game commands against a session (match controller) and a
 * high-score store. Both are injected so the router can be tested with fakes.
 */
export function createGameCommands({ session, highScores }) {
  const dispatcher = createDispatcher();

  dispatcher.register('game.start', (p) => {
    const options = {};
    if (p.difficulty !== undefined) {
      if (!isDifficulty(p.difficulty)) throw new ValidationError(DIFFICULTY_HELP);
      options.difficulty = p.difficulty;
    }
    if (p.targetScore !== undefined) {
      if (!Number.isInteger(p.targetScore) || p.targetScore < 1 || p.targetScore > 21) {
        throw new ValidationError('targetScore must be an integer from 1 to 21');
      }
      options.targetScore = p.targetScore;
    }
    return session.start(options);
  });

  dispatcher.register('game.setDifficulty', (p) => {
    if (!isDifficulty(p.difficulty)) throw new ValidationError(DIFFICULTY_HELP);
    return session.setDifficulty(p.difficulty);
  });

  dispatcher.register('game.saveHighScore', (p) => {
    if (!Number.isInteger(p.score) || p.score < 0 || p.score > 1_000_000) {
      throw new ValidationError('score must be an integer from 0 to 1000000');
    }
    let name = 'PLAYER';
    if (p.name !== undefined) {
      if (typeof p.name !== 'string') throw new ValidationError('name must be a string');
      name = p.name.trim().slice(0, 12) || 'PLAYER';
    }
    const difficulty = p.difficulty ?? 'normal';
    if (!isDifficulty(difficulty)) throw new ValidationError(DIFFICULTY_HELP);
    return highScores.add({ name, score: p.score, difficulty });
  });

  return dispatcher;
}
