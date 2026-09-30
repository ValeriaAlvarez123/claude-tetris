# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris. No dependencies, no build step, no package manager, no tests — just `index.html`, `style.css`, and `game.js`.

## Running the game

Open `index.html` directly in a browser, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no build, lint, or test command — none exist in this repo.

## Architecture

All game logic lives in `game.js` (single file, no modules). Key pieces:

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: `PIECES` defines each tetromino as a square matrix of color indices. Rotation is done via `rotateCW` (transpose + reverse), not by storing pre-rotated shapes.
- **Collision** (`collide`): checks a shape against board bounds and existing locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` and keeps the first that doesn't collide.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row once it exceeds `dropInterval`.
- **Line clearing** (`clearLines`): scans bottom-to-top, splices out full rows and unshifts empty ones at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/row, soft drop adds 1 pt/row.
- **Leveling**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row and draws it at low alpha.

Rendering is all Canvas 2D (`#board` for the main grid, `#next-canvas` for the next-piece preview) — there is no DOM-based board representation.

State is a set of module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, ...) reset by `init()`, which is also called by the restart button.

Input is a single `keydown` listener mapping arrow keys / `X` / `Space` / `P` to movement, rotation, drops, and pause — see the README's controls table.

## Tunable constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval` (initial). If `COLS`, `ROWS`, or `BLOCK` change, the `#board` canvas `width`/`height` in `index.html` must be updated to match (`COLS × BLOCK`, `ROWS × BLOCK`).

## Idioma

Responde siempre en español en este proyecto, sin importar el idioma del mensaje del usuario.
