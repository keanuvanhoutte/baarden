/*
 * EenBot in JavaScript: motor, toestandsvector, determinisatie en zoeker
 * =====================================================================
 *
 * Een getrouwe overzetting van vier Python-bestanden, in deze volgorde:
 *   RL/baarden_game.py   de regels (legal_actions, step, clone)
 *   RL/snelvector.py     de toestandsvector (233 getallen)
 *   RL/verborgen.py      een mogelijke verborgen stand verzinnen
 *   RL/eenbot.py         de zoeker: alfa-beta over alle acties, netwerk aan de bladeren
 * plus Pythons eigen toevalsgenerator (Mersenne Twister + random.shuffle), zodat
 * dezelfde stelling hier en in Python DEZELFDE werelden oplevert en de zetten
 * een-op-een te vergelijken zijn (js/test_eenbot_motor.js).
 *
 * Werkt in node (module.exports) en in de browser (window.EenBot).
 * Geen enkele functie uit index.html wordt gebruikt: dit is een eigen motor, en
 * de brug naar het spel is een aparte vertaling van de spelstand (adapter).
 */
(function (global) {
  'use strict';

  // ------------------------------------------------------------------ bord
  const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const ALL_CELLS = [];
  for (const r of ROWS) for (const c of [1, 2, 3]) ALL_CELLS.push(r + c);
  const N_CELLS = 21;
  const CELL_IDX = {};
  ALL_CELLS.forEach((c, i) => { CELL_IDX[c] = i; });
  const MIRROR = new Array(21);      // index -> index
  for (let i = 0; i < 21; i++) {
    const c = ALL_CELLS[i];
    MIRROR[i] = CELL_IDX[ROWS[6 - ROWS.indexOf(c[0])] + c[1]];
  }
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const NBD = [];                    // index -> [buur per richting of -1]
  for (let i = 0; i < 21; i++) {
    const r = Math.floor(i / 3), c = i % 3;
    NBD.push(DIRS.map(([dr, dc]) => {
      const rr = r + dr, cc = c + dc;
      return (rr >= 0 && rr < 7 && cc >= 0 && cc < 3) ? rr * 3 + cc : -1;
    }));
  }
  const RED_TOWER = CELL_IDX.b2, BLACK_TOWER = CELL_IDX.f2;
  const TERR = {
    red: ['a1', 'a2', 'a3', 'b1', 'b3', 'c1', 'c2', 'c3'].map(c => CELL_IDX[c]),
    black: ['e1', 'e2', 'e3', 'f1', 'f3', 'g1', 'g2', 'g3'].map(c => CELL_IDX[c]),
  };
  const TOWER_OF = { red: RED_TOWER, black: BLACK_TOWER };
  const OTHER = { red: 'black', black: 'red' };

  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_VALUE = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  const RANK_IDX = {};
  RANKS.forEach((r, i) => { RANK_IDX[r] = i; });
  const N_RANKS = 13, TOWER_CAP = 11, MAX_VALUE = 14, HAND_SIZE = 3;
  const SUITS = { red: ['H', 'D'], black: ['S', 'C'] };

  const NORMAL = 'n', TOWER = 't', TOWERLAYER = 'l', BLOCK = 'k';
  const DRAW = 'draw', PLACE = 'place', MOVE = 'move', GAMEOVER = 'gameover';
  const ILLEGAL = 0, MOVED = 1, CAPTURED = 2, STACKED = 3, WINS = 4;

  const A_MOVE = 0, A_PLACE_HAND = 84, A_HAND_TO_HOLD = 147, A_HOLD_TO_FIELD = 150,
    A_TOWER_BUILD = 171, A_BLOCK = 172, A_PASS = 193, A_REVIVE = 194, A_BUILD_PICK = 207,
    N_ACTIONS = 215;

  function Piece(owner, kind, rank, suit) {
    this.owner = owner; this.kind = kind; this.rank = rank || ''; this.suit = suit || '';
    this.value = RANK_VALUE[this.rank] || 0;
    this.key = owner[0] + kind + this.rank + this.suit;
  }
  function Card(rank, suit) { this.rank = rank; this.suit = suit; this.value = RANK_VALUE[rank]; }

  function buildColorDeck(color) {
    const s = SUITS[color], out = [];
    for (const suit of s) for (const r of RANKS) if (!(suit === s[0] && r === '2')) out.push(new Card(r, suit));
    return out;
  }

  function evaluateOnBoard(board, piece, dest) {
    const stack = board[dest];
    if (!stack.length) return MOVED;
    const top = stack[stack.length - 1];
    if (top.owner === piece.owner) return ILLEGAL;
    if (top.kind === BLOCK) return ILLEGAL;
    const av = piece.value, dv = top.value;
    const twoBeatsAce = piece.rank === '2' && top.rank === 'A';
    const attackerWins = twoBeatsAce || av > dv;
    const isTie = !twoBeatsAce && av === dv;
    if (piece.rank === 'A' && top.rank === '2') return ILLEGAL;
    if (top.kind === TOWER || top.kind === TOWERLAYER) return attackerWins ? WINS : ILLEGAL;
    if (!attackerWins && !isTie) return ILLEGAL;
    return attackerWins ? CAPTURED : STACKED;
  }

  // ------------------------------------------- Pythons random.Random, exact
  function PyRandom(seed) {
    this.mt = new Uint32Array(624); this.mti = 625;
    // random.seed(int): sleutel = 32-bitswoorden van |seed|, laagste eerst
    let n = Math.abs(seed); const key = [];
    if (n === 0) key.push(0);
    while (n > 0) { key.push(n % 4294967296); n = Math.floor(n / 4294967296); }
    this._initByArray(key);
  }
  PyRandom.prototype._initGenrand = function (s) {
    const mt = this.mt; mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.mti = 624;
  };
  PyRandom.prototype._initByArray = function (key) {
    this._initGenrand(19650218);
    const mt = this.mt; let i = 1, j = 0; const kl = key.length;
    for (let k = Math.max(624, kl); k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++; j++;
      if (i >= 624) { mt[0] = mt[623]; i = 1; }
      if (j >= kl) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) { mt[0] = mt[623]; i = 1; }
    }
    mt[0] = 0x80000000;
  };
  PyRandom.prototype._u32 = function () {
    const mt = this.mt;
    if (this.mti >= 624) {
      for (let kk = 0; kk < 624; kk++) {
        const y = (mt[kk] & 0x80000000) | (mt[(kk + 1) % 624] & 0x7fffffff);
        mt[kk] = (mt[(kk + 397) % 624] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
      }
      this.mti = 0;
    }
    let y = mt[this.mti++];
    y ^= y >>> 11; y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= y >>> 18;
    return y >>> 0;
  };
  PyRandom.prototype._randbelow = function (n) {
    const k = 32 - Math.clz32(n);
    let r = this._u32() >>> (32 - k);
    while (r >= n) r = this._u32() >>> (32 - k);
    return r;
  };
  PyRandom.prototype.shuffle = function (x) {
    for (let i = x.length - 1; i > 0; i--) {
      const j = this._randbelow(i + 1);
      const t = x[i]; x[i] = x[j]; x[j] = t;
    }
  };

  // eenbot._Schudder: zelfde stapel -> zelfde volgorde, binnen een wereld
  function Schudder(zaad) { this.zaad = zaad; }
  Schudder.prototype.shuffle = function (stapel) {
    stapel.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : (a.suit < b.suit ? -1 : a.suit > b.suit ? 1 : 0)));
    new PyRandom(this.zaad * 1000003 + stapel.length).shuffle(stapel);
  };

  // Snellere variant (optie `snelschud`): dezelfde eigenschap -- zelfde stapel, zelfde volgorde
  // binnen een wereld -- maar zonder telkens een Mersenne Twister op te bouwen (21% van de
  // rekentijd op diepte 5). mulberry32, bit voor bit gelijk aan _SnelSchudder in RL/eenbot.py.
  const SUIT_IDX = { H: 0, D: 1, S: 2, C: 3 };
  function SnelSchudder(zaad) { this.zaad = zaad; }
  SnelSchudder.prototype.shuffle = function (stapel) {
    stapel.sort((a, b) => (RANK_IDX[a.rank] * 4 + SUIT_IDX[a.suit]) - (RANK_IDX[b.rank] * 4 + SUIT_IDX[b.suit]));
    let a = (this.zaad * 1000003 + stapel.length) % 4294967296;
    for (let i = stapel.length - 1; i > 0; i--) {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = (t ^ (t >>> 14)) >>> 0;
      const j = r % (i + 1);
      const x = stapel[i]; stapel[i] = stapel[j]; stapel[j] = x;
    }
  };

  // ------------------------------------------------------------------ spel
  function Game() {}

  Game.prototype.clone = function () {
    const g = new Game();
    g.maxRounds = this.maxRounds; g.rng = this.rng;
    g.board = this.board.map(s => s.slice());
    g.drawPile = { red: this.drawPile.red.slice(), black: this.drawPile.black.slice() };
    g.discard = { red: this.discard.red.slice(), black: this.discard.black.slice() };
    g.fallen = { red: this.fallen.red.slice(), black: this.fallen.black.slice() };
    g.destroyed = { red: this.destroyed.red.slice(), black: this.destroyed.black.slice() };
    g.hand = { red: this.hand.red.slice(), black: this.hand.black.slice() };
    g.hold = { red: this.hold.red, black: this.hold.black };
    g.blockReserve = { red: this.blockReserve.red, black: this.blockReserve.black };
    g.roundNumber = this.roundNumber; g.starter = this.starter;
    g.currentPlayer = this.currentPlayer; g.phase = this.phase;
    g.acted = { red: this.acted.red, black: this.acted.black };
    g.towerReset = { red: this.towerReset.red, black: this.towerReset.black };
    g.pendingRevive = this.pendingRevive;
    g.pendingBuild = this.pendingBuild ? { color: this.pendingBuild.color, scope: this.pendingBuild.scope } : null;
    g.buildCandidates = this.buildCandidates.slice();
    // De herhalingstelling: een gedeelde, nooit meer gewijzigde Map plus een
    // korte lijst sleutels die er sindsdien bijkwamen. Een kloon deelt de Map
    // en kopieert alleen die lijst -- in een zoekboom een paar sleutels, in
    // plaats van de hele partijgeschiedenis bij elke knoop.
    g.posMap = this.posMap;
    g.posExtra = this.posExtra.slice();
    g.gameOver = this.gameOver; g.winner = this.winner; g.ply = this.ply;
    g.sleutel = this.sleutel;
    g.browserSleutel = this.browserSleutel;
    return g;
  };

  Game.prototype.drawThree = function (color) {
    const hand = this.hand[color];
    if (hand.length) { for (const c of hand) this.discard[color].push(c); hand.length = 0; }
    if (this.drawPile[color].length < 3 && this.discard[color].length) {
      for (const c of this.discard[color]) this.drawPile[color].push(c);
      this.discard[color] = [];
      this.rng.shuffle(this.drawPile[color]);
    }
    for (let i = 0; i < 3; i++) {
      if (!this.drawPile[color].length) break;
      hand.push(this.drawPile[color].pop());
    }
  };
  Game.prototype.noCardsLeft = function (color) {
    return !this.drawPile[color].length && !this.discard[color].length;
  };
  Game.prototype.resolveDrawPhase = function () {
    if (this.phase !== DRAW) return;
    this.drawThree('red'); this.drawThree('black');
    this.acted = { red: false, black: false };
    this.towerReset = { red: false, black: false };
    this.currentPlayer = this.starter;
    this.phase = PLACE;
  };

  Game.prototype.towerValue = function (color) {
    const t = this.board[TOWER_OF[color]]; return t[t.length - 1].value;
  };
  // Kandidaten: [bron, verwijzing]; bron 0 = bord (vakje), 1 = hold, 2 = hand (kaart)
  Game.prototype.buildPool = function (color, scope) {
    const pool = [];
    for (const cell of NBD[TOWER_OF[color]]) {
      if (cell < 0) continue;
      const s = this.board[cell];
      if (s.length && s[s.length - 1].owner === color && s[s.length - 1].kind === NORMAL) pool.push([0, cell]);
    }
    if (this.hold[color] !== null) pool.push([1, this.hold[color]]);
    if (scope === PLACE) for (const c of this.hand[color]) pool.push([2, c]);
    return pool;
  };
  Game.prototype.poolValue = function (item) {
    if (item[0] === 0) { const s = this.board[item[1]]; return s[s.length - 1].value; }
    return item[1].value;
  };
  Game.prototype.buildCands = function (color, scope) {
    if (this.towerReset[color] || this.towerValue(color) >= TOWER_CAP) return [];
    const need = this.towerValue(color) + 1;
    return this.buildPool(color, scope).filter(i => this.poolValue(i) === need);
  };
  Game.prototype.canBuildTower = function (color, scope) { return this.buildCands(color, scope).length > 0; };
  Game.prototype.candidateAction = function (color, item) {
    if (item[0] === 2) return A_BUILD_PICK + this.hand[color].indexOf(item[1]);
    if (item[0] === 1) return A_BUILD_PICK + 3;
    let d = NBD[TOWER_OF[color]].indexOf(item[1]);
    if (color === 'black' && d < 2) d = 1 - d;
    return A_BUILD_PICK + 4 + d;
  };
  Game.prototype.consumeCandidate = function (color, item) {
    const tower = this.board[TOWER_OF[color]];
    let card;
    if (item[0] === 2) {
      const h = this.hand[color]; h.splice(h.indexOf(item[1]), 1); card = item[1];
    } else if (item[0] === 1) {
      card = this.hold[color]; this.hold[color] = null;
    } else {
      card = this.board[item[1]].pop();
    }
    tower.push(new Piece(color, TOWERLAYER, card.rank, card.suit));
    if (RANK_VALUE[card.rank] === TOWER_CAP) {
      for (let i = 1; i < tower.length; i++) this.destroyed[tower[i].owner].push(new Card(tower[i].rank, tower[i].suit));
      tower.length = 1;
      this.towerReset[color] = true;
      if (this.hold[color] === null && this.fallen[color].length) this.pendingRevive = color;
    }
  };
  Game.prototype.startTowerBuild = function (color, scope) {
    this.pendingBuild = { color, scope }; this.advanceBuild();
  };
  Game.prototype.advanceBuild = function () {
    const color = this.pendingBuild.color, scope = this.pendingBuild.scope;
    for (;;) {
      const k = this.buildCands(color, scope);
      if (!k.length) { this.finishBuild(); return; }
      if (k.length > 1) { this.buildCandidates = k; return; }
      this.consumeCandidate(color, k[0]);
      if (this.pendingRevive !== null) return;
    }
  };
  Game.prototype.finishBuild = function () {
    const color = this.pendingBuild.color, scope = this.pendingBuild.scope;
    this.pendingBuild = null; this.buildCandidates = [];
    if (scope === PLACE) {
      for (const c of this.hand[color]) this.discard[color].push(c);
      this.hand[color] = [];
    }
    this.endOfAction(color);
  };

  Game.prototype.blockCell = function (color) {
    for (let i = 0; i < 21; i++) for (const p of this.board[i]) if (p.kind === BLOCK && p.owner === color) return i;
    return -1;
  };
  Game.prototype.blockBuried = function (color) {
    const c = this.blockCell(color);
    if (c < 0) return false;
    const s = this.board[c], top = s[s.length - 1];
    return !(top.kind === BLOCK && top.owner === color);
  };
  Game.prototype.blockTargets = function (color) {
    if (this.blockBuried(color)) return [];
    const out = [];
    for (let i = 0; i < 21; i++) {
      const s = this.board[i];
      if (!s.length) continue;
      const top = s[s.length - 1];
      if (top.owner === color || top.kind === TOWER || top.kind === TOWERLAYER || top.kind === BLOCK) continue;
      out.push(i);
    }
    return out;
  };

  Game.prototype.legalActions = function () {
    if (this.gameOver) return [];
    const color = this.currentPlayer, flip = color === 'black';
    const ci = i => (flip ? MIRROR[i] : i);
    let acts = [];
    if (this.pendingRevive !== null) {
      if (this.pendingRevive !== color) return [];
      const seen = new Set();
      for (const c of this.fallen[color]) seen.add(c.rank);
      for (const r of seen) acts.push(A_REVIVE + RANK_IDX[r]);
      acts.push(A_PASS);
      return acts.sort((a, b) => a - b);
    }
    if (this.buildCandidates.length) {
      return this.buildCandidates.map(i => this.candidateAction(color, i)).sort((a, b) => a - b);
    }
    if (this.phase === PLACE) {
      const free = TERR[color].filter(c => !this.board[c].length);
      const h = this.hand[color];
      for (let slot = 0; slot < h.length; slot++) for (const c of free) acts.push(A_PLACE_HAND + slot * N_CELLS + ci(c));
      if (this.hold[color] === null) for (let s = 0; s < h.length; s++) acts.push(A_HAND_TO_HOLD + s);
      if (this.canBuildTower(color, PLACE)) acts.push(A_TOWER_BUILD);
      acts.push(A_PASS);
      return acts.sort((a, b) => a - b);
    }
    for (let cell = 0; cell < 21; cell++) {
      const s = this.board[cell];
      if (!s.length) continue;
      const top = s[s.length - 1];
      if (top.owner !== color || top.kind !== NORMAL) continue;
      const nb = NBD[cell];
      for (let d = 0; d < 4; d++) {
        const dest = nb[d];
        if (dest < 0) continue;
        if (evaluateOnBoard(this.board, top, dest) === ILLEGAL) continue;
        const dd = (flip && d < 2) ? 1 - d : d;
        acts.push(A_MOVE + ci(cell) * 4 + dd);
      }
    }
    if (this.hold[color] !== null) {
      for (const c of TERR[color]) if (!this.board[c].length) acts.push(A_HOLD_TO_FIELD + ci(c));
    }
    if (this.canBuildTower(color, MOVE)) acts.push(A_TOWER_BUILD);
    for (const c of this.blockTargets(color)) acts.push(A_BLOCK + ci(c));
    if (!acts.length) acts.push(A_PASS);
    return acts.sort((a, b) => a - b);
  };

  Game.prototype.step = function (action, check) {
    if (this.gameOver) return false;
    if (check !== false && this.legalActions().indexOf(action) < 0) return false;
    this.sleutel = null;
    const color = this.currentPlayer, flip = color === 'black';
    const real = i => (flip ? MIRROR[i] : i);

    if (this.pendingRevive !== null) {
      if (action !== A_PASS) {
        const rank = RANKS[action - A_REVIVE], f = this.fallen[color];
        for (let i = 0; i < f.length; i++) if (f[i].rank === rank) { this.hold[color] = f.splice(i, 1)[0]; break; }
      }
      this.pendingRevive = null;
      if (this.pendingBuild !== null) this.advanceBuild(); else this.endOfAction(color);
      return true;
    }
    if (this.buildCandidates.length) {
      const gekozen = this.buildCandidates.find(i => this.candidateAction(color, i) === action);
      this.buildCandidates = [];
      this.consumeCandidate(color, gekozen);
      if (this.pendingRevive === null) this.advanceBuild();
      return true;
    }
    if (this.phase === PLACE) {
      if (action === A_TOWER_BUILD) { this.startTowerBuild(color, PLACE); return true; }
      if (action >= A_PLACE_HAND && action < A_HAND_TO_HOLD) {
        const k = action - A_PLACE_HAND, slot = Math.floor(k / N_CELLS), cell = real(k % N_CELLS);
        const card = this.hand[color][slot];
        this.board[cell] = [new Piece(color, NORMAL, card.rank, card.suit)];
        this.hand[color].splice(slot, 1);
      } else if (action >= A_HAND_TO_HOLD && action < A_HOLD_TO_FIELD) {
        this.hold[color] = this.hand[color].splice(action - A_HAND_TO_HOLD, 1)[0];
      }
      for (const c of this.hand[color]) this.discard[color].push(c);
      this.hand[color] = [];
      this.endOfAction(color);
      return true;
    }
    if (action < A_PLACE_HAND) {
      const cell = real(Math.floor(action / 4));
      let d = action % 4;
      if (flip && d < 2) d = 1 - d;
      this.applyMove(color, cell, NBD[cell][d]);
      if (this.gameOver) return true;
    } else if (action >= A_HOLD_TO_FIELD && action < A_TOWER_BUILD) {
      const cell = real(action - A_HOLD_TO_FIELD), card = this.hold[color];
      this.board[cell] = [new Piece(color, NORMAL, card.rank, card.suit)];
      this.hold[color] = null;
    } else if (action === A_TOWER_BUILD) {
      this.startTowerBuild(color, MOVE); return true;
    } else if (action >= A_BLOCK && action < A_PASS) {
      this.applyBlock(color, real(action - A_BLOCK));
    }
    this.endOfAction(color);
    return true;
  };

  Game.prototype.applyMove = function (color, src, dest) {
    const stack = this.board[src], piece = stack[stack.length - 1];
    const result = evaluateOnBoard(this.board, piece, dest);
    stack.pop();
    const ds = this.board[dest];
    if (result === WINS) {
      ds.push(piece); this.gameOver = true; this.winner = color; this.phase = GAMEOVER; this.ply++;
      return;
    }
    if (result === MOVED) this.board[dest] = [piece];
    else if (result === CAPTURED) {
      for (const p of ds) this.fallen[p.owner].push(new Card(p.rank, p.suit));
      this.board[dest] = [piece];
    } else ds.push(piece);
  };
  Game.prototype.applyBlock = function (color, cell) {
    const from = this.blockCell(color);
    if (from >= 0) this.board[from].pop(); else this.blockReserve[color] = false;
    this.board[cell].push(new Piece(color, BLOCK, '', ''));
  };

  Game.prototype.endOfAction = function (color) {
    this.ply++;
    this.acted[color] = true;
    if (this.acted.red && this.acted.black) {
      if (this.phase === PLACE) {
        this.phase = MOVE; this.currentPlayer = this.starter;
        this.acted = { red: false, black: false };
      } else {
        this.roundNumber++;
        this.starter = OTHER[this.starter];
        this.currentPlayer = this.starter;
        this.acted = { red: false, black: false };
        this.towerReset = { red: false, black: false };
        if (this.noCardsLeft('red') && this.noCardsLeft('black')) this.phase = MOVE;
        else { this.phase = DRAW; this.resolveDrawPhase(); }
      }
    } else this.currentPlayer = OTHER[color];
    this.registerPosition();
    if (!this.gameOver && this.roundNumber > this.maxRounds) {
      this.gameOver = true; this.winner = null; this.phase = GAMEOVER;
    }
  };
  const KIND_VOL = { n: 'normal', t: 'tower', l: 'towerlayer', k: 'block' };
  // Dezelfde sleutel als positionKey() in index.html (tekst + cyrb53), zodat de
  // herhalingstelling van een echte partij in het spel hier verder geteld wordt.
  function browserKey(g) {
    const parts = new Array(21);
    for (let i = 0; i < 21; i++) {
      const s = g.board[i];
      parts[i] = s.length ? s.map(p => p.owner + ':' + KIND_VOL[p.kind] + ':' + p.rank + p.suit).join(',') : '';
    }
    const tekst = parts.join('|') + '#' + g.currentPlayer + '#' + g.phase;
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < tekst.length; i++) {
      const ch = tekst.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 'p' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  Game.prototype.positionKey = function () {
    if (this.browserSleutel) return browserKey(this);
    const parts = new Array(21);
    for (let i = 0; i < 21; i++) {
      const s = this.board[i];
      if (!s.length) { parts[i] = ''; continue; }
      let t = s[0].key;
      for (let j = 1; j < s.length; j++) t += ',' + s[j].key;
      parts[i] = t;
    }
    return parts.join('|') + '#' + this.currentPlayer + '#' + this.phase;
  };
  Game.prototype.posCount = function (key) {
    let n = this.posMap.get(key) || 0;
    const ex = this.posExtra;
    for (let i = 0; i < ex.length; i++) if (ex[i] === key) n++;
    return n;
  };
  Game.prototype.registerPosition = function () {
    if (this.gameOver) return;
    const key = this.positionKey();
    this.sleutel = key;
    const n = this.posCount(key) + 1;
    this.posExtra.push(key);
    if (this.posExtra.length >= 32) {
      // Samenvoegen in een NIEUWE Map: de oude kan door klonen gedeeld zijn.
      const m = new Map(this.posMap);
      for (const k of this.posExtra) m.set(k, (m.get(k) || 0) + 1);
      this.posMap = m; this.posExtra = [];
    }
    if (n >= 3) { this.gameOver = true; this.winner = null; this.phase = GAMEOVER; }
  };

  // ----------------------------------------------------- toestandsvector
  const O_HAND = 105, O_HOLD = 144, O_OPPHOLD = 157, O_TORENS = 158, O_BLOK = 160,
    O_GEV = 166, O_TEL = 192, O_STAP = 218, O_FASE = 222, O_REST = 225, LEN = 233;

  function vector(g, out) {
    const kleur = g.currentPlayer, opp = OTHER[kleur], flip = kleur === 'black';
    const v = out || new Float64Array(LEN);
    if (out) v.fill(0);
    const eigen = new Array(13).fill(2), oppT = new Array(13).fill(2);
    eigen[0] = 1; oppT[0] = 1;
    let blokEigen = -1, blokOpp = -1;
    const board = g.board;
    for (let cel = 0; cel < 21; cel++) {
      const s = board[cel];
      if (!s.length) continue;
      for (const p of s) {
        const k = p.kind;
        if (k === NORMAL || k === TOWERLAYER) {
          if (p.owner === kleur) eigen[RANK_IDX[p.rank]] -= 1; else oppT[RANK_IDX[p.rank]] -= 1;
        } else if (k === BLOCK) {
          if (p.owner === kleur) { if (blokEigen < 0) blokEigen = cel; } else if (blokOpp < 0) blokOpp = cel;
        }
      }
      const i = (flip ? MIRROR[cel] : cel) * 5;
      const top = s[s.length - 1];
      const teken = top.owner === kleur ? 1 : -1;
      v[i] = teken * top.value / MAX_VALUE;
      v[i + 1] = (top.kind === TOWER || top.kind === TOWERLAYER) ? 1 : 0;
      v[i + 2] = top.kind === BLOCK ? teken : 0;
      v[i + 3] = Math.min(s.length, 5) / 5;
      if (s.length >= 2) {
        const o = s[s.length - 2];
        v[i + 4] = (o.owner === kleur ? 1 : -1) * o.value / MAX_VALUE;
      }
    }
    const hand = g.hand[kleur];
    for (let s = 0; s < Math.min(hand.length, HAND_SIZE); s++) v[O_HAND + s * 13 + RANK_IDX[hand[s].rank]] = 1;
    const hold = g.hold[kleur];
    if (hold !== null) v[O_HOLD + RANK_IDX[hold.rank]] = 1;
    v[O_OPPHOLD] = g.hold[opp] !== null ? 1 : 0;
    v[O_TORENS] = g.towerValue(kleur) / MAX_VALUE;
    v[O_TORENS + 1] = g.towerValue(opp) / MAX_VALUE;
    let o = O_BLOK;
    for (const [wie, cel] of [[kleur, blokEigen], [opp, blokOpp]]) {
      v[o] = g.blockReserve[wie] ? 1 : 0;
      v[o + 1] = cel >= 0 ? 1 : 0;
      if (cel >= 0) { const s = board[cel], top = s[s.length - 1]; v[o + 2] = (top.kind === BLOCK && top.owner === wie) ? 0 : 1; }
      o += 3;
    }
    [kleur, opp].forEach((wie, j) => {
      const basis = O_GEV + j * 13, tel = wie === kleur ? eigen : oppT;
      for (const c of g.fallen[wie]) { v[basis + RANK_IDX[c.rank]] += 0.5; tel[RANK_IDX[c.rank]] -= 1; }
      for (const c of g.destroyed[wie]) tel[RANK_IDX[c.rank]] -= 1;
    });
    for (const c of hand) eigen[RANK_IDX[c.rank]] -= 1;
    for (const c of g.discard[kleur]) eigen[RANK_IDX[c.rank]] -= 1;
    if (hold !== null) eigen[RANK_IDX[hold.rank]] -= 1;
    for (let r = 0; r < 13; r++) { v[O_TEL + r] = eigen[r] / 2; v[O_TEL + 13 + r] = oppT[r] / 2; }
    v[O_STAP] = g.drawPile[kleur].length / 25;
    v[O_STAP + 1] = g.discard[kleur].length / 25;
    v[O_STAP + 2] = g.drawPile[opp].length / 25;
    v[O_STAP + 3] = g.discard[opp].length / 25;
    v[O_FASE] = g.phase === DRAW ? 1 : 0;
    v[O_FASE + 1] = g.phase === PLACE ? 1 : 0;
    v[O_FASE + 2] = g.phase === MOVE ? 1 : 0;
    const r = O_REST;
    v[r] = g.buildCandidates.length ? 1 : 0;
    v[r + 1] = g.pendingRevive === kleur ? 1 : 0;
    v[r + 2] = g.towerReset[kleur] ? 1 : 0;
    v[r + 3] = g.towerReset[opp] ? 1 : 0;
    v[r + 4] = g.acted[opp] ? 1 : 0;
    v[r + 5] = g.starter === kleur ? 1 : 0;
    const sl = g.sleutel || g.positionKey();
    v[r + 6] = g.posCount(sl) / 3;
    v[r + 7] = g.roundNumber / g.maxRounds;
    return v;
  }

  // -------------------------------------------------------- determinisatie
  function verborgenVoorraad(g, kleur) {
    const over = new Map(), volgorde = [];
    for (const k of buildColorDeck(kleur)) {
      const s = k.rank + '|' + k.suit;
      if (!over.has(s)) { over.set(s, 0); volgorde.push(k); }
      over.set(s, over.get(s) + 1);
    }
    const af = s => { if ((over.get(s) || 0) > 0) over.set(s, over.get(s) - 1); };
    for (let c = 0; c < 21; c++) for (const p of g.board[c]) {
      if (p.owner === kleur && (p.kind === NORMAL || p.kind === TOWERLAYER)) af(p.rank + '|' + p.suit);
    }
    for (const c of g.fallen[kleur]) af(c.rank + '|' + c.suit);
    for (const c of g.destroyed[kleur]) af(c.rank + '|' + c.suit);
    const uit = [];
    for (const k of volgorde) {
      const n = over.get(k.rank + '|' + k.suit);
      for (let i = 0; i < n; i++) uit.push(new Card(k.rank, k.suit));
    }
    return uit;
  }

  function determiniseer(game, kleur, rng) {
    const g = game.clone();
    g.rng = rng;
    const eigen = g.drawPile[kleur].slice();
    rng.shuffle(eigen);
    g.drawPile[kleur] = eigen;
    const opp = OTHER[kleur];
    const voorraad = verborgenVoorraad(game, opp);
    rng.shuffle(voorraad);
    const nHold = game.hold[opp] !== null ? 1 : 0, nHand = game.hand[opp].length,
      nTrek = game.drawPile[opp].length;
    const nodig = nHold + nHand + nTrek + game.discard[opp].length;
    if (voorraad.length !== nodig) throw new Error('verborgen voorraad klopt niet: ' + voorraad.length + ' tegen ' + nodig);
    let i = 0;
    g.hold[opp] = nHold ? voorraad[0] : null; i += nHold;
    g.hand[opp] = voorraad.slice(i, i + nHand); i += nHand;
    g.drawPile[opp] = voorraad.slice(i, i + nTrek); i += nTrek;
    g.discard[opp] = voorraad.slice(i);
    return g;
  }

  // -------------------------------------------------------------- netwerk
  function Netwerk(blob) {
    const w = blob.gewichten, n = blob.verborgen.length;
    this.lagen = [];
    for (let i = 0; i <= n; i++) {
      const W = w['net.' + (2 * i) + '.weight'], b = w['net.' + (2 * i) + '.bias'];
      const rows = W.length, cols = W[0].length, flat = new Float64Array(rows * cols);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) flat[r * cols + c] = W[r][c];
      this.lagen.push({ W: flat, b: Float64Array.from(b), rows, cols });
    }
    this._h = this.lagen.map(l => new Float64Array(l.rows));
    // De eerste laag ook kolomgewijs: de invoer is grotendeels nul, dus per
    // niet-nul invoer een kolom optellen is veel minder werk dan elke rij
    // helemaal doorlopen.
    const L0 = this.lagen[0];
    this.W0T = new Float64Array(L0.rows * L0.cols);
    for (let r = 0; r < L0.rows; r++) for (let c = 0; c < L0.cols; c++) this.W0T[c * L0.rows + r] = L0.W[r * L0.cols + c];
  }
  Netwerk.prototype.waarde = function (x) {
    const L0 = this.lagen[0], h0 = this._h[0], R = L0.rows, WT = this.W0T;
    for (let r = 0; r < R; r++) h0[r] = L0.b[r];
    for (let c = 0; c < L0.cols; c++) {
      const xv = x[c];
      if (xv === 0) continue;
      const base = c * R;
      for (let r = 0; r < R; r++) h0[r] += WT[base + r] * xv;
    }
    if (this.lagen.length === 1) return Math.tanh(h0[0]);
    for (let r = 0; r < R; r++) if (h0[r] < 0) h0[r] = 0;
    let h = h0;
    for (let li = 1; li < this.lagen.length; li++) {
      const L = this.lagen[li], out = this._h[li], W = L.W, cols = L.cols, last = li === this.lagen.length - 1;
      for (let r = 0; r < L.rows; r++) {
        let s = L.b[r];
        const base = r * cols;
        for (let c = 0; c < cols; c++) { const xv = h[c]; if (xv !== 0) s += W[base + c] * xv; }
        out[r] = last ? s : (s > 0 ? s : 0);
      }
      h = out;
    }
    return Math.tanh(h[0]);
  };

  // --------------------------------------------------------------- zoeker
  const WINST = 2.0;

  function isVrij(g) { return g.buildCandidates.length > 0 || g.pendingRevive !== null; }

  function Zoeker(net, opties) {
    opties = opties || {};
    this.V = net;
    this.diepte = opties.diepte !== undefined ? opties.diepte : 3;
    this.werelden = opties.werelden !== undefined ? opties.werelden : 4;
    this.legkosten = opties.legkosten !== undefined ? opties.legkosten : 1;
    this.zaad = opties.zaad !== undefined ? opties.zaad : 1;
    this.ordendiepte = opties.ordendiepte !== undefined ? opties.ordendiepte : 2;
    this.wortelmarge = opties.wortelmarge !== undefined ? opties.wortelmarge : null;
    this.legbreedte = opties.legbreedte !== undefined ? opties.legbreedte : null;
    this.legpas = !!opties.legpas;
    this.snelschud = !!opties.snelschud;
    // Zoeken onder een knopenlimiet: eerst op de volle diepte met hoogstens `knoopgrens`
    // knopen; wordt die overschreden, dan opnieuw (zonder limiet) op diepte-1. Zo zoekt hij
    // diep waar het betaalbaar is, zonder uitschieters van seconden. Deterministisch:
    // dezelfde stelling geeft dezelfde knopentelling, in JS en in Python.
    this.knoopgrens = opties.knoopgrens ? opties.knoopgrens : null;
    // Diepte voor een beslissing in de schuiffase (de wortel staat in MOVE); de legfase houdt
    // `diepte`. In de schuiffase is diep zoeken het meest waard en het goedkoopst.
    this.schuifdiepte = opties.schuifdiepte ? opties.schuifdiepte : null;
    this._grens = Infinity;
    this.diepGelukt = 0; this.diepAfgebroken = 0;
    this.wortelRonde = 0;
    this.geschiedenis = new Float64Array(N_ACTIONS);
    this.knopen = 0; this.bladen = 0;
    this._v = new Float64Array(LEN);
  }
  Zoeker.prototype.kosten = function (g) {
    if (isVrij(g)) return 0;
    return g.phase === PLACE ? this.legkosten : 1;
  };
  Zoeker.prototype.blad = function (g) {
    this.bladen++;
    const v = this.V.waarde(vector(g, this._v));
    return g.currentPlayer === this.wortel ? v : -v;
  };
  Zoeker.prototype.eind = function (g, afstand) {
    if (g.winner === null) return 0;
    const w = WINST - 0.001 * afstand;
    return g.winner === this.wortel ? w : -w;
  };
  Zoeker.prototype.orden = function (legaal) {
    const h = this.geschiedenis;
    return legaal.slice().sort((a, b) =>
      (h[b] + (b === A_TOWER_BUILD ? 1e9 : 0)) - (h[a] + (a === A_TOWER_BUILD ? 1e9 : 0)));
  };
  Zoeker.prototype.kinderen = function (g, legaal, maxi, afstand) {
    const k = [];
    for (const a of legaal) {
      const kind = g.clone();
      kind.step(a, false);
      let s;
      if (kind.gameOver) s = this.eind(kind, afstand + 1);
      else { const v = this.V.waarde(vector(kind, this._v)); s = kind.currentPlayer === this.wortel ? v : -v; }
      k.push([s, a, kind]);
    }
    k.sort(maxi ? (x, y) => y[0] - x[0] : (x, y) => x[0] - y[0]);
    return k;
  };
  const AFBREKEN = { afbreken: true };
  Zoeker.prototype.zoek = function (g, diepte, alfa, beta, afstand) {
    this.knopen++;
    if (this.knopen > this._grens) throw AFBREKEN;
    if (g.gameOver) return this.eind(g, afstand);
    if (diepte <= 0) return this.blad(g);
    const legaal = g.legalActions();
    if (!legaal.length) return this.blad(g);
    const kosten = this.kosten(g);
    const maxi = g.currentPlayer === this.wortel;
    let beste = maxi ? -Infinity : Infinity;
    if (this.legpas && g.phase === PLACE && !isVrij(g) && g.roundNumber > this.wortelRonde) {
      const kind = g.clone();
      kind.step(A_PASS, false);
      return this.zoek(kind, diepte, alfa, beta, afstand + 1);
    }
    let reeks;
    if (this.legbreedte !== null && g.phase === PLACE && kosten === this.legkosten
        && !isVrij(g) && legaal.length > this.legbreedte) {
      reeks = this.kinderen(g, legaal, maxi, afstand).slice(0, this.legbreedte);
    } else if (diepte >= this.ordendiepte && legaal.length > 2) {
      reeks = this.kinderen(g, legaal, maxi, afstand);
    } else {
      reeks = this.orden(legaal).map(a => [0, a, null]);
    }
    for (const item of reeks) {
      const a = item[1];
      let kind = item[2];
      if (kind === null) { kind = g.clone(); kind.step(a, false); }
      const v = this.zoek(kind, diepte - kosten, alfa, beta, afstand + 1);
      if (maxi) { if (v > beste) beste = v; if (v > alfa) alfa = v; }
      else { if (v < beste) beste = v; if (v < beta) beta = v; }
      if (beta <= alfa) { this.geschiedenis[a] += diepte * diepte; break; }
    }
    return beste;
  };
  Zoeker.prototype.waarden = function (game, legaal) {
    const kleur = game.currentPlayer;
    this.wortel = kleur;
    this.wortelRonde = game.roundNumber;
    // Python: (...) & 0x7fffffff, met onbegrensde gehele getallen
    const ruw = this.zaad * 7919 + game.ply * 104729 + game.roundNumber * 31 + (kleur === 'red' ? 1 : 2);
    const basis = ruw % 2147483648;
    const kosten = this.kosten(game);
    const som = new Map();
    for (const a of legaal) som.set(a, 0);
    let volgorde = legaal.slice();
    for (let k = 0; k < this.werelden; k++) {
      const wereld = determiniseer(game, kleur, new PyRandom(basis + k * 15485863));
      wereld.rng = this.snelschud ? new SnelSchudder(basis + k) : new Schudder(basis + k);
      let reeks;
      if (k === 0) reeks = this.kinderen(wereld, legaal, true, 0).map(t => [t[1], t[2]]);
      else {
        volgorde.sort((a, b) => som.get(b) - som.get(a));
        reeks = volgorde.map(a => [a, null]);
      }
      let beste = -Infinity;
      for (const [a, k0] of reeks) {
        let kind = k0;
        if (kind === null) { kind = wereld.clone(); kind.step(a, false); }
        let alfa = -Infinity;
        if (this.wortelmarge !== null && beste > -Infinity) alfa = beste - this.wortelmarge;
        const v = this.zoek(kind, this.diepte - kosten, alfa, Infinity, 1);
        som.set(a, som.get(a) + v);
        if (v > beste) beste = v;
      }
    }
    const uit = new Map();
    for (const [a, s] of som) uit.set(a, s / this.werelden);
    return uit;
  };
  Zoeker.prototype.kies = function (game, legaal) {
    legaal = legaal || game.legalActions();
    if (!legaal.length) return null;
    if (legaal.length === 1) return legaal[0];
    this.geschiedenis.fill(0);
    const beste = w => {
      let best = null, bw = -Infinity;
      for (const a of legaal) {         // oplopend: bij gelijke waarde de laagste index
        const x = w.get(a);
        if (x > bw) { bw = x; best = a; }
      }
      return best;
    };
    const basis = this.diepte;
    const D = (this.schuifdiepte !== null && game.phase === MOVE) ? this.schuifdiepte : basis;
    try {
      this.diepte = D;
      if (this.knoopgrens === null) return beste(this.waarden(game, legaal));
      this._grens = this.knopen + this.knoopgrens;
      try {
        const keuze = beste(this.waarden(game, legaal));
        this.diepGelukt++;
        return keuze;
      } catch (e) {
        if (e !== AFBREKEN) throw e;
        this.diepAfgebroken++;
      } finally { this._grens = Infinity; }
      this.diepte = D - 1;
      return beste(this.waarden(game, legaal));
    } finally { this.diepte = basis; }
  };

  // Een nieuwe partij, exact zoals BaardenGame(maxRounds, rng=random.Random(zaad)).
  function nieuwSpel(maxRounds, rng) {
    const g = new Game();
    g.maxRounds = maxRounds || 120; g.rng = rng;
    g.board = ALL_CELLS.map(() => []);
    g.board[RED_TOWER] = [new Piece('red', TOWER, '2', 'H')];
    g.board[BLACK_TOWER] = [new Piece('black', TOWER, '2', 'S')];
    g.drawPile = { red: buildColorDeck('red'), black: buildColorDeck('black') };
    rng.shuffle(g.drawPile.red); rng.shuffle(g.drawPile.black);
    g.discard = { red: [], black: [] }; g.fallen = { red: [], black: [] };
    g.destroyed = { red: [], black: [] }; g.hand = { red: [], black: [] };
    g.hold = { red: null, black: null }; g.blockReserve = { red: true, black: true };
    g.roundNumber = 1; g.starter = 'black'; g.currentPlayer = 'black'; g.phase = DRAW;
    g.acted = { red: false, black: false }; g.towerReset = { red: false, black: false };
    g.pendingRevive = null; g.pendingBuild = null; g.buildCandidates = [];
    g.posMap = new Map(); g.posExtra = []; g.gameOver = false; g.winner = null; g.ply = 0; g.sleutel = null;
    g.resolveDrawPhase();
    return g;
  }

  // --------------------------------------- stand uit Python (voor de proeven)
  function vanPython(d) {
    const P = p => new Piece(p[0], p[1], p[2], p[3]);
    const C = c => new Card(c[0], c[1]);
    const g = new Game();
    g.maxRounds = d.max_rounds;
    g.rng = null;
    g.board = ALL_CELLS.map(c => d.board[c].map(P));
    const two = f => ({ red: d[f].red.map(C), black: d[f].black.map(C) });
    g.drawPile = two('draw_pile'); g.discard = two('discard'); g.fallen = two('fallen');
    g.destroyed = two('destroyed'); g.hand = two('hand');
    g.hold = { red: d.hold.red ? C(d.hold.red) : null, black: d.hold.black ? C(d.hold.black) : null };
    g.blockReserve = { red: d.block_reserve.red, black: d.block_reserve.black };
    g.roundNumber = d.round_number; g.starter = d.starter; g.currentPlayer = d.current_player;
    g.phase = d.phase;
    g.acted = { red: d.acted.red, black: d.acted.black };
    g.towerReset = { red: d.tower_reset.red, black: d.tower_reset.black };
    g.pendingRevive = d.pending_revive;
    g.pendingBuild = d.pending_build;
    g.buildCandidates = d.build_candidates.map(([src, ref]) => {
      if (src === 'board') return [0, CELL_IDX[ref]];
      if (src === 'hold') return [1, g.hold[g.currentPlayer]];
      return [2, g.hand[g.currentPlayer][ref]];   // ref = handplek
    });
    g.posMap = new Map(Object.entries(d.position_counts)); g.posExtra = [];
    g.gameOver = d.game_over; g.winner = d.winner; g.ply = d.ply;
    g.sleutel = null;
    return g;
  }

  // --------------------------------------- stand uit het spel (index.html)
  const KIND_KORT = { normal: NORMAL, tower: TOWER, towerlayer: TOWERLAYER, block: BLOCK };
  function vanBrowser(st, maxRounds) {
    const C = c => new Card(c.rank, c.suit);
    const lijst = x => (Array.isArray(x) ? x : []);
    const two = f => ({ red: lijst(st[f] && st[f].red).map(C), black: lijst(st[f] && st[f].black).map(C) });
    const g = new Game();
    g.maxRounds = maxRounds || 120;
    g.rng = null;
    g.board = ALL_CELLS.map(c => lijst(st.board[c]).map(p => new Piece(p.owner, KIND_KORT[p.kind], p.rank || '', p.suit || '')));
    g.drawPile = two('draw'); g.discard = two('discard'); g.fallen = two('fallen');
    g.destroyed = two('destroyed'); g.hand = two('hand');
    g.hold = { red: st.hold && st.hold.red ? C(st.hold.red) : null,
      black: st.hold && st.hold.black ? C(st.hold.black) : null };
    g.blockReserve = { red: !!st.blockReserve.red, black: !!st.blockReserve.black };
    g.roundNumber = st.roundNumber; g.starter = st.starter; g.currentPlayer = st.turn;
    g.phase = st.phase;
    g.acted = { red: !!st.actedThisPhase.red, black: !!st.actedThisPhase.black };
    const tr = st.towerResetThisRound || {};
    g.towerReset = { red: !!tr.red, black: !!tr.black };
    g.pendingRevive = st.reviveChoice ? st.reviveChoice.color : null;
    g.pendingBuild = st.towerBuild ? { color: st.turn, scope: st.towerBuild.scope } : null;
    g.buildCandidates = [];
    const kand = st.towerBuild && st.towerBuild.pendingCandidates;
    if (kand && kand.length) {
      const kleur = st.turn, hand = lijst(st.hand[kleur]);
      for (const item of kand) {
        if (item.source === 'hand') {
          const i = hand.findIndex(c => c && item.card && c.id === item.card.id);
          g.buildCandidates.push([2, g.hand[kleur][i]]);
        } else if (item.source === 'hold') g.buildCandidates.push([1, g.hold[kleur]]);
        else g.buildCandidates.push([0, CELL_IDX[item.cell]]);
      }
    }
    g.posMap = new Map(Object.entries(st.positionCounts || {})); g.posExtra = [];
    g.browserSleutel = true;
    g.gameOver = !!st.winner; g.winner = st.winner && st.winner !== 'draw' ? st.winner : null;
    // Alleen gebruikt om de werelden te zaaien: elke beslissing een eigen getal.
    g.ply = st.roundNumber * 8 + (st.phase === 'move' ? 4 : 0) + (g.acted.red ? 1 : 0) + (g.acted.black ? 2 : 0);
    g.sleutel = null;
    return g;
  }

  const api = {
    Game, Piece, Card, PyRandom, Schudder, SnelSchudder, Netwerk, Zoeker, vector, determiniseer,
    verborgenVoorraad, evaluateOnBoard, vanPython, vanBrowser, buildColorDeck, nieuwSpel,
    ALL_CELLS, CELL_IDX, MIRROR, NBD, TERR, RANKS, RANK_VALUE, RANK_IDX,
    A_MOVE, A_PLACE_HAND, A_HAND_TO_HOLD, A_HOLD_TO_FIELD, A_TOWER_BUILD, A_BLOCK, A_PASS,
    A_REVIVE, A_BUILD_PICK, N_ACTIONS, PLACE, MOVE, DRAW, GAMEOVER, NORMAL, TOWER, TOWERLAYER, BLOCK,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.EenBot = api;
})(typeof window !== 'undefined' ? window : this);
