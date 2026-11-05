# Retro Neon Pong — A.I. Battle

A dark-mode neon pong game. You play the left paddle against a human-like A.I. opponent.

## Run

```bash
npm start          # serves http://localhost:8080
npm test           # runs the unit tests (Node 18+)
```

Open http://localhost:8080. ES modules need HTTP, so opening `index.html` directly from disk will not work.

## Controls

- Keyboard: `W` / `S` or `↑` / `↓`. `P` or `Esc` pauses.
- Touch: the large ▲ / ▼ buttons under the arena. They appear on narrow screens and on touch devices. Keyboard and touch work at the same time.

## Layout

- 270px and up: vertical arena with touch pad underneath.
- 1024px and up: wide stadium console with a HUD panel on the left and a leaderboard on the right.
- The "Idea By: Azmat Ali" signature is pinned to the bottom of the page.

## Architecture

| Area | Files | Notes |
|------|-------|-------|
| Game logic | `src/game/physics.js`, `ai.js`, `state.js` | Pure functions, no DOM. Covered by tests. |
| Loop | `src/engine/loop.js` | `requestAnimationFrame` with a fixed-timestep accumulator. |
| Rendering | `src/engine/renderer.js` | Canvas with devicePixelRatio scaling and a neon trail. |
| Input | `src/input/input.js` | Keyboard and pointer input share one held-state. Quick taps are latched. |
| Commands | `src/router/dispatcher.js` | In-process router: `game.start`, `game.setDifficulty`, `game.saveHighScore`. |
| Storage | `src/storage/highscores.js` | localStorage top 10, versioned and guarded. |

## Difficulty

The A.I. difficulty matrix is in `src/game/ai.js`. Each tier sets reaction delay, hesitation, aim error, top speed, and whether it predicts bounces. Movement uses an ease-in-out curve.
