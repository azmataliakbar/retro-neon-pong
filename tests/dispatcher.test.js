import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDispatcher, createGameCommands, ErrorCode } from '../src/router/dispatcher.js';

function fakeSession() {
  const calls = [];
  return {
    calls,
    start(options) {
      calls.push(['start', options]);
      return { started: true };
    },
    setDifficulty(difficulty) {
      calls.push(['setDifficulty', difficulty]);
      return { difficulty };
    },
  };
}

function fakeScores() {
  const saved = [];
  return {
    saved,
    add(entry) {
      saved.push(entry);
      return { rank: 1, persisted: true };
    },
  };
}

test('unknown commands return a structured error instead of throwing', () => {
  const router = createGameCommands({ session: fakeSession(), highScores: fakeScores() });
  const res = router.dispatch('game.explode', {});
  assert.equal(res.ok, false);
  assert.equal(res.error.code, ErrorCode.UNKNOWN_COMMAND);
});

test('non-object payloads are rejected', () => {
  const router = createGameCommands({ session: fakeSession(), highScores: fakeScores() });
  for (const bad of [null, 'start', 42, ['easy']]) {
    const res = router.dispatch('game.start', bad);
    assert.equal(res.error.code, ErrorCode.INVALID_PAYLOAD);
  }
});

test('game.start forwards validated options to the session', () => {
  const session = fakeSession();
  const router = createGameCommands({ session, highScores: fakeScores() });
  const res = router.dispatch('game.start', { difficulty: 'hard', targetScore: 11 });
  assert.equal(res.ok, true);
  assert.deepEqual(session.calls[0], ['start', { difficulty: 'hard', targetScore: 11 }]);
});

test('game.start rejects an unknown difficulty and an out-of-range target', () => {
  const router = createGameCommands({ session: fakeSession(), highScores: fakeScores() });
  assert.equal(router.dispatch('game.start', { difficulty: 'nightmare' }).error.code, ErrorCode.INVALID_PAYLOAD);
  assert.equal(router.dispatch('game.start', { targetScore: 0 }).error.code, ErrorCode.INVALID_PAYLOAD);
  assert.equal(router.dispatch('game.start', { targetScore: 2.5 }).error.code, ErrorCode.INVALID_PAYLOAD);
});

test('game.setDifficulty requires a valid level', () => {
  const session = fakeSession();
  const router = createGameCommands({ session, highScores: fakeScores() });
  assert.equal(router.dispatch('game.setDifficulty', {}).ok, false);
  const ok = router.dispatch('game.setDifficulty', { difficulty: 'insane' });
  assert.equal(ok.ok, true);
  assert.deepEqual(session.calls[0], ['setDifficulty', 'insane']);
});

test('game.saveHighScore validates the score and trims the name', () => {
  const scores = fakeScores();
  const router = createGameCommands({ session: fakeSession(), highScores: scores });

  assert.equal(router.dispatch('game.saveHighScore', { score: -1 }).error.code, ErrorCode.INVALID_PAYLOAD);
  assert.equal(router.dispatch('game.saveHighScore', { score: '7' }).error.code, ErrorCode.INVALID_PAYLOAD);

  const res = router.dispatch('game.saveHighScore', { score: 5, name: '   Azmat-Ali-Champion  ' });
  assert.equal(res.ok, true);
  assert.deepEqual(res.data, { rank: 1, persisted: true });
  assert.equal(scores.saved[0].name, 'Azmat-Ali-Ch');
  assert.equal(scores.saved[0].difficulty, 'normal');
});

test('handler exceptions are reported as HANDLER_FAILED', () => {
  const d = createDispatcher();
  d.register('boom', () => {
    throw new Error('kaput');
  });
  const res = d.dispatch('boom', {});
  assert.equal(res.error.code, ErrorCode.HANDLER_FAILED);
  assert.equal(res.error.message, 'kaput');
});

test('duplicate command registration is refused', () => {
  const d = createDispatcher();
  d.register('x', () => null);
  assert.throws(() => d.register('x', () => null), /already registered/);
});
