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

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–8` identifying which piece locked there.
- **Pieces**: `PIECES` defines each tetromino as a square matrix of color indices. Rotation is done via `rotateCW` (transpose + reverse), not by storing pre-rotated shapes.
- **Collision** (`collide`): checks a shape against board bounds and existing locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` and keeps the first that doesn't collide.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row once it exceeds `dropInterval`.
- **Line clearing** (`clearLines`): scans bottom-to-top, splices out full rows and unshifts empty ones at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/row, soft drop adds 1 pt/row.
- **Leveling**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Comodín** (`WILD = 9`): cada `WILD_EVERY` líneas, `clearLines` activa `wildPending` y `spawn` pone un `wildPiece()` (1×1, `wild: true`, `mode: 'row'|'col'`) como `next`. `tryRotate` alterna el modo; `lockPiece` llama a `applyWild()` (borra fila o columna, `WILD_SCORE × level`) en vez de `merge`, así que el valor 9 nunca queda en `board`.
- **Compactadora** (`COMPACT = 10`): `loop` acumula `dt` en `compactAccum`; cada `COMPACT_EVERY` ms activa `compactPending` y `spawn` pone un `compactPiece()` (1×1, `compact: true`) como `next` (el comodín tiene prioridad). `lockPiece` llama a `applyCompact()` (gravedad por columna en el área de radio `COMPACT_RADIUS`) y luego a `clearLines()`.
- **Bomba** (`BOMB = 12`): cada `BOMB_EVERY` líneas, `clearLines` activa `bombPending` y `spawn` pone un `bombPiece()` (1×1, `bomb: true`) como `next` (tiene prioridad sobre comodín y compactadora). `lockPiece` llama a `applyBomb()` (vacía el área de radio `BOMB_RADIUS`, `BOMB_SCORE × level`) en vez de `merge`.
- **Desafíos** (`CHALLENGES`): reglas opcionales y combinables, elegidas en el multiselect `#challenges` (un dropdown propio: botón + opciones `role="option"` con `aria-selected`; cada clic actualiza `activeChallenges` y llama a `init()`). Una regla puede tener `start` (lo ejecuta `init()` tras crear el tablero) y/o `every` (ms) + `apply`; `loop` acumula `dt` en `challengeAccum[id]` y la dispara. `garbage` llama cada 30 s a `addGarbage(1)`: sube 1 fila gris (`GARBAGE = 11`) con un hueco al azar, empuja la pieza actual hacia arriba y termina la partida si se desborda. `scattered` llama a `scatterGarbage(SCATTER_COUNT, SCATTER_ROWS)`: reparte bloques de basura sueltos abajo sin completar filas. Una regla también puede tener `levelUp`, que `clearLines` ejecuta por cada nivel subido; `scattered` lo usa para añadir `SCATTER_PER_LEVEL` bloques más. `lockPiece` termina la partida si la pieza queda con celdas sobre la fila 0.
- **Combo** (`combo`, `maxCombo`): `clearLines` suma 1 a `combo` si limpia ≥1 línea y lo pone a 0 si no limpia ninguna. Como solo lo llama `lockPiece` para piezas normales y la compactadora, comodín y bomba no alteran el combo. `maxCombo` es el máximo de la partida; ambos se reinician en `init()`.
- **Récords** (`records`): `{ scores: [{ name, score, lines, level }], bestCombo, maxLines }` en `localStorage` (`tetris-records`), leído al cargar con `loadRecords()` (try/catch, valida y sanea datos corruptos) y escrito con `saveRecords()`. `endGame()` actualiza siempre `bestCombo`/`maxLines`; si `recordRank(score)` ≥ 0 (top `RECORDS_MAX = 5`, puntuación > 0, empates detrás) inserta ya la entrada con `DEFAULT_NAME` (así no se pierde si se reinicia sin guardar), la apunta en `pendingRecord` y `highlightEntry` (fila resaltada), muestra `#name-form` dentro de `#overlay-records` y enfoca `#name-input`. `saveName()` solo cambia el nombre de esa entrada (longitud máx. = `maxlength` del input). `renderRecords()` pinta la tabla en `#records-panel` (panel, siempre visible) y `#records-overlay` (con líneas y nivel) usando `textContent`. El listener global `keydown` ignora las teclas cuyo `target` es `#name-input`. `#overlay-records` solo se muestra en game over (`togglePause` e `init` lo ocultan). `#records-reset` borra todo tras `confirm()`.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row and draws it at low alpha.

**Temas**: los colores viven como variables CSS en `style.css` (`:root` = oscuro por defecto, `[data-theme="light"]` = claro). `setTheme()` en `game.js` aplica `data-theme`, persiste la elección en `localStorage` (`tetris-theme`), cachea `--grid` y `--block-highlight` para el canvas y redibuja. `init()` no toca el tema.

Rendering is all Canvas 2D (`#board` for the main grid, `#next-canvas` for the next-piece preview) — there is no DOM-based board representation.

State is a set of module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, ...) reset by `init()`, which is also called by the restart button.

Input is a single `keydown` listener mapping arrow keys / `X` / `Space` / `P` to movement, rotation, drops, and pause — see the README's controls table.

## Tunable constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval` (initial). If `COLS`, `ROWS`, or `BLOCK` change, the `#board` canvas `width`/`height` in `index.html` must be updated to match (`COLS × BLOCK`, `ROWS × BLOCK`).

## Idioma

Responde siempre en español en este proyecto, sin importar el idioma del mensaje del usuario.
