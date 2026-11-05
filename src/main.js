/**
 * Bootstrap: wires the match, loop, renderer, input, router, and UI together.
 * All game-state changes from the UI go through the command router.
 */
import { worldForAspect } from './game/physics.js';
import { DIFFICULTY } from './game/ai.js';
import { createMatch, stepMatch, DEFAULT_TARGET } from './game/state.js';
import { createGameLoop } from './engine/loop.js';
import { createRenderer } from './engine/renderer.js';
import { createInput } from './input/input.js';
import { createGameCommands } from './router/dispatcher.js';
import { createHighScores, safeLocalStorage } from './storage/highscores.js';

const $ = (selector) => document.querySelector(selector);

const dom = {
  canvas: $('#arena'),
  frame: $('#arena-frame'),
  overlay: $('#overlay'),
  panels: { menu: $('#panel-menu'), paused: $('#panel-paused'), over: $('#panel-over') },
  scorePlayer: $('#score-player'),
  scoreAi: $('#score-ai'),
  hudDifficulty: $('#hud-difficulty'),
  hudRally: $('#hud-rally'),
  hudBest: $('#hud-best'),
  difficultyButtons: [...document.querySelectorAll('[data-difficulty]')],
  targetSelect: $('#target-score'),
  leaderboard: $('#leaderboard'),
  overTitle: $('#over-title'),
  overScore: $('#over-score'),
  nameInput: $('#player-name'),
  saveButton: $('#btn-save'),
  saveStatus: $('#save-status'),
  touchButtons: [...document.querySelectorAll('.touch-btn')],
};

const rand = Math.random;
const renderer = createRenderer(dom.canvas);
const input = createInput({ touchButtons: dom.touchButtons });
const highScores = createHighScores(safeLocalStorage());

/** @type {'menu' | 'playing' | 'paused' | 'over'} */
let mode = 'menu';
let match = null;
let bestScore = 0;
let hudKey = '';

const session = {
  difficulty: 'normal',
  targetScore: DEFAULT_TARGET,

  start(options = {}) {
    if (options.difficulty) session.difficulty = options.difficulty;
    if (options.targetScore) session.targetScore = options.targetScore;
    beginMatch();
    return { difficulty: session.difficulty, targetScore: session.targetScore };
  },

  setDifficulty(difficulty) {
    session.difficulty = difficulty;
    refreshMenu();
    return { difficulty };
  },
};

const commands = createGameCommands({ session, highScores });

function dispatch(name, payload) {
  const result = commands.dispatch(name, payload);
  if (!result.ok) console.warn(`[${name}] ${result.error.code}: ${result.error.message}`);
  return result;
}

function currentWorld() {
  const { clientWidth, clientHeight } = dom.frame;
  return worldForAspect(clientHeight / Math.max(1, clientWidth));
}

function newMatch() {
  return createMatch({
    world: currentWorld(),
    difficulty: session.difficulty,
    targetScore: session.targetScore,
    rand,
  });
}

function showPanel(name) {
  dom.overlay.hidden = !name;
  for (const [key, el] of Object.entries(dom.panels)) el.hidden = key !== name;
}

function beginMatch() {
  match = newMatch();
  renderer.resetTrail();
  input.flush();
  mode = 'playing';
  showPanel(null);
}

function openMenu() {
  mode = 'menu';
  match = newMatch(); // idle attract screen; not stepped
  renderer.resetTrail();
  showPanel('menu');
}

function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  showPanel('paused');
}

function resume() {
  if (mode !== 'paused') return;
  mode = 'playing';
  input.flush();
  showPanel(null);
}

function finishMatch() {
  mode = 'over';
  dom.overTitle.textContent = match.winner === 'player' ? 'You win!' : 'A.I. wins';
  dom.overScore.textContent = `You ${match.scores.player} : ${match.scores.ai} A.I.`;
  dom.saveButton.disabled = false;
  dom.saveStatus.textContent = '';
  showPanel('over');
}

function saveScore() {
  const result = dispatch('game.saveHighScore', {
    score: match.scores.player,
    difficulty: session.difficulty,
    name: dom.nameInput.value,
  });
  if (!result.ok) {
    dom.saveStatus.textContent = 'Could not save score.';
    return;
  }
  const { rank, persisted } = result.data;
  dom.saveButton.disabled = true;
  if (rank === 0) dom.saveStatus.textContent = 'Not in the top 10, so it was not kept.';
  else if (persisted) dom.saveStatus.textContent = `Saved at rank #${rank}.`;
  else dom.saveStatus.textContent = `Rank #${rank}, but storage is unavailable so it will not persist.`;
  renderLeaderboard();
}

function refreshMenu() {
  for (const btn of dom.difficultyButtons) {
    btn.setAttribute('aria-pressed', String(btn.dataset.difficulty === session.difficulty));
  }
  dom.hudDifficulty.textContent = DIFFICULTY[session.difficulty].label;
}

function renderLeaderboard() {
  const entries = highScores.list();
  bestScore = entries[0]?.score ?? 0;
  const items = entries.map((e, i) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${i + 1}. ${e.name}`;
    const score = document.createElement('span');
    score.textContent = `${e.score} · ${DIFFICULTY[e.difficulty]?.label ?? e.difficulty}`;
    li.append(name, score);
    return li;
  });
  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No scores yet';
    items.push(empty);
  }
  dom.leaderboard.replaceChildren(...items);
}

function updateHud() {
  if (!match) return;
  const key = `${match.scores.player}|${match.scores.ai}|${match.rally}|${session.difficulty}|${bestScore}`;
  if (key === hudKey) return;
  hudKey = key;
  dom.scorePlayer.textContent = match.scores.player;
  dom.scoreAi.textContent = match.scores.ai;
  dom.hudRally.textContent = match.rally;
  dom.hudBest.textContent = bestScore;
  dom.hudDifficulty.textContent = DIFFICULTY[session.difficulty].label;
}

const loop = createGameLoop({
  update(dt) {
    if (mode !== 'playing') return;
    match = stepMatch(match, { playerDir: input.direction(), dt, rand });
    if (match.status === 'over') finishMatch();
  },
  render() {
    if (match) renderer.draw(match);
    updateHud();
  },
});

// Wiring
dom.difficultyButtons.forEach((btn) =>
  btn.addEventListener('click', () => dispatch('game.setDifficulty', { difficulty: btn.dataset.difficulty })),
);
dom.targetSelect.addEventListener('change', () => {
  session.targetScore = Number(dom.targetSelect.value);
});
$('#btn-start').addEventListener('click', () => dispatch('game.start', {}));
$('#btn-resume').addEventListener('click', resume);
$('#btn-pause').addEventListener('click', () => (mode === 'playing' ? pause() : resume()));
$('#btn-menu-paused').addEventListener('click', openMenu);
$('#btn-again').addEventListener('click', () => dispatch('game.start', {}));
$('#btn-menu-over').addEventListener('click', openMenu);
dom.saveButton.addEventListener('click', saveScore);

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (mode === 'playing') pause();
    else if (mode === 'paused') resume();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

new ResizeObserver(() => renderer.resize()).observe(dom.frame);
renderer.resize();

renderLeaderboard();
refreshMenu();
openMenu();
loop.start();
