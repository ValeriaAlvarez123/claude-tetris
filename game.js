'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#f06292', // R - pink (anillo)
  '#ffffff', // W - comodín (se dibuja con degradado arcoíris)
  '#a1887f', // C - compactadora
  '#616161', // G - basura (desafío)
  '#ff7043', // B - bomba
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // R (anillo con hueco)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Comodín: bloque 1×1 que aparece cada WILD_EVERY líneas y al aterrizar
// borra su fila o su columna completa (↑/X alterna el modo).
const WILD = 9;
const WILD_EVERY = 5;
const WILD_SCORE = 200;

// Compactadora: bloque 1×1 que aparece cada COMPACT_EVERY ms de juego y al
// aterrizar aplica gravedad por columna en el área 5×5 que la rodea.
const COMPACT = 10;
const COMPACT_EVERY = 45000;
const COMPACT_RADIUS = 2;

// Bomba: bloque 1×1 que aparece cada BOMB_EVERY líneas y al aterrizar
// destruye el área 3×3 que la rodea.
const BOMB = 12;
const BOMB_EVERY = 10;
const BOMB_RADIUS = 1;
const BOMB_SCORE = 200;

// Desafíos: reglas opcionales y combinables que suben la dificultad.
// `start` se ejecuta al iniciar la partida; `apply` cada `every` ms de juego;
// `levelUp` cada vez que sube el nivel.
const GARBAGE = 11;
const SCATTER_COUNT = 8;
const SCATTER_PER_LEVEL = 3;
const SCATTER_ROWS = 8;
const CHALLENGES = {
  garbage: { every: 30000, apply: () => addGarbage(1), info: 'Basura en' },
  scattered: {
    start: () => scatterGarbage(SCATTER_COUNT, SCATTER_ROWS),
    levelUp: () => scatterGarbage(SCATTER_PER_LEVEL, SCATTER_ROWS),
  },
};

// Skins: cada una define su paleta (mismos índices que COLORS) y cómo se
// dibuja una celda. `drawCell(context, px, py, size, color)` recibe la esquina
// en píxeles; `color` puede ser un degradado (comodín).
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, w, h, r);
  } else {
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }
}

const SKINS = {
  retro: {
    colors: COLORS,
    drawCell(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = highlightColor;
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    colors: [
      null,
      '#00f0ff', '#fff200', '#d500f9', '#39ff14', '#ff1744', '#2979ff',
      '#ff9100', '#ff4081', '#ffffff', '#d7a86e', '#9e9e9e', '#ff3d00',
    ],
    drawCell(context, px, py, size, color) {
      context.save();
      context.shadowColor = typeof color === 'string' ? color : '#ffffff';
      context.shadowBlur = size * 0.6;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.globalAlpha *= 0.3;
      context.fillStyle = color;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.restore();
      context.shadowBlur = 0; // no contaminar rejilla ni texto
    },
  },
  pastel: {
    colors: [
      null,
      '#a8e6ef', '#fff1a8', '#d7b8e8', '#b9e4c0', '#f5b5b5', '#c3dcf7',
      '#ffd6a5', '#f8bbd9', '#ffffff', '#d7ccc8', '#b8b8c0', '#ffab91',
    ],
    drawCell(context, px, py, size, color) {
      const r = size * 0.25;
      context.fillStyle = color;
      roundRectPath(context, px + 2, py + 2, size - 4, size - 4, r);
      context.fill();
      context.fillStyle = highlightColor;
      roundRectPath(context, px + 5, py + 4, size - 10, size * 0.2, size * 0.1);
      context.fill();
    },
  },
  pixel: {
    colors: COLORS,
    drawCell(context, px, py, size, color) {
      const n = 5, p = size / n;
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      for (let i = 0; i < n; i++) {
        // borde superior/izquierdo claro, inferior/derecho oscuro
        context.fillStyle = 'rgba(255, 255, 255, 0.35)';
        context.fillRect(px + i * p, py, p, p);
        context.fillRect(px, py + i * p, p, p);
        context.fillStyle = 'rgba(0, 0, 0, 0.3)';
        context.fillRect(px + i * p, py + size - p, p, p);
        context.fillRect(px + size - p, py + i * p, p, p);
      }
      // textura interior: un brillo y dos píxeles de sombra
      context.fillStyle = 'rgba(255, 255, 255, 0.5)';
      context.fillRect(px + p, py + p, p, p);
      context.fillStyle = 'rgba(0, 0, 0, 0.15)';
      context.fillRect(px + 3 * p, py + 2 * p, p, p);
      context.fillRect(px + 2 * p, py + 3 * p, p, p);
    },
  },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const challengesEl = document.getElementById('challenges');
const challengesToggle = challengesEl.querySelector('.multiselect-toggle');
const challengesLabel = challengesEl.querySelector('.multiselect-label');
const challengesMenu = challengesEl.querySelector('.multiselect-menu');
const challengeOptions = challengesMenu.querySelectorAll('[role="option"]');
const challengeInfo = document.getElementById('challenge-info');

const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
let gridColor, highlightColor;
let skin = SKINS.retro;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let wildCharge, wildPending, compactAccum, compactPending, bombCharge, bombPending;
let activeChallenges = new Set(), challengeAccum;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function wildPiece() {
  return { type: WILD, shape: [[WILD]], x: Math.floor(COLS / 2), y: 0, wild: true, mode: 'row' };
}

function compactPiece() {
  return { type: COMPACT, shape: [[COMPACT]], x: Math.floor(COLS / 2), y: 0, compact: true };
}

function bombPiece() {
  return { type: BOMB, shape: [[BOMB]], x: Math.floor(COLS / 2), y: 0, bomb: true };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  if (current.wild) {
    current.mode = current.mode === 'row' ? 'col' : 'row';
    return;
  }
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    wildCharge += cleared;
    if (wildCharge >= WILD_EVERY) {
      wildCharge -= WILD_EVERY;
      wildPending = true;
    }
    bombCharge += cleared;
    if (bombCharge >= BOMB_EVERY) {
      bombCharge -= BOMB_EVERY;
      bombPending = true;
    }
    score += (LINE_SCORES[cleared] || 0) * level;
    const prevLevel = level;
    level = Math.floor(lines / 10) + 1;
    for (let l = prevLevel; l < level; l++)
      for (const id of activeChallenges) CHALLENGES[id].levelUp?.();
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function applyWild() {
  if (current.mode === 'row') {
    board.splice(current.y, 1);
    board.unshift(new Array(COLS).fill(0));
  } else {
    for (let r = 0; r < ROWS; r++) board[r][current.x] = 0;
  }
  score += WILD_SCORE * level;
  updateHUD();
}

function applyCompact() {
  const top = Math.max(0, current.y - COMPACT_RADIUS);
  const bottom = Math.min(ROWS - 1, current.y + COMPACT_RADIUS);
  const left = Math.max(0, current.x - COMPACT_RADIUS);
  const right = Math.min(COLS - 1, current.x + COMPACT_RADIUS);
  for (let c = left; c <= right; c++) {
    const blocks = [];
    for (let r = top; r <= bottom; r++)
      if (board[r][c]) blocks.push(board[r][c]);
    for (let r = bottom; r >= top; r--)
      board[r][c] = blocks.pop() || 0;
  }
}

function applyBomb() {
  for (let r = current.y - BOMB_RADIUS; r <= current.y + BOMB_RADIUS; r++)
    for (let c = current.x - BOMB_RADIUS; c <= current.x + BOMB_RADIUS; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
  score += BOMB_SCORE * level;
  updateHUD();
}

// Sube `count` filas de basura (cada una con un hueco al azar) desde abajo.
function addGarbage(count) {
  for (let i = 0; i < count; i++) {
    const overflow = board.shift().some(v => v);
    const row = new Array(COLS).fill(GARBAGE);
    row[Math.floor(Math.random() * COLS)] = 0;
    board.push(row);
    if (overflow) { endGame(); return; }
  }
  // Empujar la pieza en juego hacia arriba si la basura la alcanzó
  for (let i = 0; i < count && collide(current.shape, current.x, current.y); i++) current.y--;
  if (collide(current.shape, current.x, current.y)) endGame();
}

// Reparte `count` bloques de basura sueltos en las `rows` filas de abajo,
// sin llegar a completar ninguna fila.
function scatterGarbage(count, rows) {
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 10; tries++) {
    const r = ROWS - 1 - Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * COLS);
    if (board[r][c] || board[r].filter(v => v).length >= COLS - 1) continue;
    board[r][c] = GARBAGE;
    placed++;
  }
}

function lockPiece() {
  // Bloquear con celdas por encima del tablero (empujada por la basura) = game over
  if (current.shape.some((row, r) => current.y + r < 0 && row.some(v => v))) {
    endGame();
    return;
  }
  if (current.wild) {
    applyWild();
  } else if (current.bomb) {
    applyBomb();
  } else if (current.compact) {
    applyCompact();
    clearLines();
  } else {
    merge();
    clearLines();
  }
  spawn();
}

function spawn() {
  current = next;
  if (bombPending) {
    next = bombPiece();
    bombPending = false;
  } else if (wildPending) {
    next = wildPiece();
    wildPending = false;
  } else if (compactPending) {
    next = compactPiece();
    compactPending = false;
  } else {
    next = randomPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const colors = skin.colors;
  let color = colors[colorIndex];
  if (colorIndex === WILD) {
    color = context.createLinearGradient(x * size, y * size, (x + 1) * size, (y + 1) * size);
    [5, 2, 4, 1, 3].forEach((ci, i, a) => color.addColorStop(i / (a.length - 1), colors[ci]));
  }
  context.globalAlpha = alpha ?? 1;
  skin.drawCell(context, x * size, y * size, size, color);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // comodín: resalta la fila o columna que borrará al aterrizar
  if (current.wild) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = skin.colors[3];
    if (current.mode === 'row') ctx.fillRect(0, gy * BLOCK, COLS * BLOCK, BLOCK);
    else ctx.fillRect(current.x * BLOCK, 0, BLOCK, ROWS * BLOCK);
    ctx.globalAlpha = 1;
  }

  // compactadora: resalta el área 5×5 que compactará al aterrizar
  if (current.compact) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = skin.colors[COMPACT];
    const size = (COMPACT_RADIUS * 2 + 1) * BLOCK;
    ctx.fillRect((current.x - COMPACT_RADIUS) * BLOCK, (gy - COMPACT_RADIUS) * BLOCK, size, size);
    ctx.globalAlpha = 1;
  }

  // bomba: resalta el área 3×3 que destruirá al aterrizar
  if (current.bomb) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = skin.colors[BOMB];
    const size = (BOMB_RADIUS * 2 + 1) * BLOCK;
    ctx.fillRect((current.x - BOMB_RADIUS) * BLOCK, (gy - BOMB_RADIUS) * BLOCK, size, size);
    ctx.globalAlpha = 1;
  }

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  drawMark(ctx, current, current.x, current.y, BLOCK);
}

// Símbolo sobre las piezas especiales: ↔/↕ comodín, ⇊ compactadora, ✸ bomba
function drawMark(context, piece, x, y, size) {
  let symbol;
  if (piece.wild) symbol = piece.mode === 'row' ? '↔' : '↕';
  else if (piece.compact) symbol = '⇊';
  else if (piece.bomb) symbol = '✸';
  else return;
  context.fillStyle = '#212121';
  context.font = `bold ${Math.floor(size * 0.6)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(symbol, x * size + size / 2, y * size + size / 2 + 1);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  drawMark(nextCtx, next, offX, offY, NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  compactAccum += dt;
  if (compactAccum >= COMPACT_EVERY) {
    compactAccum = 0;
    compactPending = true;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  for (const id of activeChallenges) {
    const rule = CHALLENGES[id];
    if (!rule.every || gameOver) continue;
    challengeAccum[id] += dt;
    if (challengeAccum[id] >= rule.every) {
      challengeAccum[id] = 0;
      rule.apply();
    }
  }
  updateChallengeInfo();
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function updateChallengeInfo() {
  const text = [...activeChallenges]
    .filter(id => CHALLENGES[id].every)
    .map(id => `${CHALLENGES[id].info} ${Math.ceil((CHALLENGES[id].every - challengeAccum[id]) / 1000)} s`)
    .join('\n');
  if (challengeInfo.textContent !== text) challengeInfo.textContent = text;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.checked = theme === 'light';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* almacenamiento no disponible */ }
  refreshCanvas();
}

// La skin es independiente del tema: Neon fuerza el fondo negro del canvas
// vía `data-skin` en <html> (ver style.css).
function setSkin(id) {
  if (!Object.prototype.hasOwnProperty.call(SKINS, id)) id = 'retro';
  skin = SKINS[id];
  document.documentElement.dataset.skin = id;
  skinSelect.value = id;
  try { localStorage.setItem(SKIN_KEY, id); } catch (e) { /* almacenamiento no disponible */ }
  refreshCanvas();
}

// Cachea los colores del canvas desde las variables CSS y redibuja para que
// el cambio de tema o skin se vea también en pausa o game over.
function refreshCanvas() {
  const styles = getComputedStyle(document.documentElement);
  gridColor = styles.getPropertyValue('--grid').trim();
  highlightColor = styles.getPropertyValue('--block-highlight').trim();
  if (current) {
    draw();
    drawNext();
  }
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  wildCharge = 0;
  wildPending = false;
  compactAccum = 0;
  compactPending = false;
  bombCharge = 0;
  bombPending = false;
  challengeAccum = {};
  for (const id of activeChallenges) {
    challengeAccum[id] = 0;
    CHALLENGES[id].start?.();
  }
  updateChallengeInfo();
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (gameOver && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
    e.preventDefault();
    init();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  setTheme(themeToggle.checked ? 'light' : 'dark');
  themeToggle.blur(); // evita que Space active el switch en vez de la caída
});

skinSelect.addEventListener('change', () => {
  setSkin(skinSelect.value);
  skinSelect.blur(); // devuelve las flechas y Space al juego
});

function setChallengesOpen(open) {
  challengesMenu.hidden = !open;
  challengesToggle.setAttribute('aria-expanded', open);
}

challengesToggle.addEventListener('click', () => {
  setChallengesOpen(challengesMenu.hidden);
  challengesToggle.blur(); // evita que Space abra/cierre el menú en vez de la caída
});

challengeOptions.forEach(option => option.addEventListener('click', () => {
  option.setAttribute('aria-selected', option.getAttribute('aria-selected') !== 'true');
  option.blur();
  const selected = [...challengeOptions].filter(o => o.getAttribute('aria-selected') === 'true');
  activeChallenges = new Set(selected.map(o => o.dataset.value));
  challengesLabel.textContent = selected.map(o => o.querySelector('.name').textContent).join(', ') || 'Ninguno';
  init();
}));

document.addEventListener('click', e => {
  if (!challengesEl.contains(e.target)) setChallengesOpen(false);
});

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* ignorar */ }
setTheme(savedTheme === 'light' ? 'light' : 'dark');

let savedSkin = null;
try { savedSkin = localStorage.getItem(SKIN_KEY); } catch (e) { /* ignorar */ }
setSkin(savedSkin);

init();
