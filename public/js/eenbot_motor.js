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
    // Eerst de laatste kaarten van de trekstapel, dan pas de aflegstapel schudden (zoals
    // baarden_game.py en het spel sinds 6 oktober 2026).
    const pile = this.drawPile[color];
    while (hand.length < 3 && pile.length) hand.push(pile.pop());
    if (hand.length < 3 && this.discard[color].length) {
      for (const c of this.discard[color]) pile.push(c);
      this.discard[color] = [];
      this.rng.shuffle(pile);
      while (hand.length < 3 && pile.length) hand.push(pile.pop());
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
  // Plan-kenmerken: 18 extra getallen voor een netwerk met invoer LEN + N_PLAN (zie RL/plan.py,
  // dezelfde definitie; js/test_plan.js toetst dat beide gelijk rekenen). Een netwerk met 233
  // invoer ziet ze nooit, dus de live bot rekent precies zoals voorheen.
  const N_PLAN = 18;
  function planKant(g, wie, zelf, v, o) {
    const t = g.towerValue(wie);
    const dood = new Array(15).fill(0);
    for (const c of g.fallen[wie]) dood[c.value]++;
    for (const c of g.destroyed[wie]) dood[c.value]++;
    for (const p of g.board[TOWER_OF[wie]]) if (p.kind === TOWERLAYER) dood[p.value]++;
    const leeft = w => (w === 2 ? 1 : 2) - dood[w];
    for (let i = 0; i < 9; i++) v[o + i] = 0;
    if (t + 1 <= 11) v[o] = leeft(t + 1) / 2;
    const klaar = new Set();
    if (zelf) {
      for (const c of g.hand[wie]) klaar.add(c.value);
      if (g.hold[wie] !== null) klaar.add(g.hold[wie].value);
    }
    for (const n of NBD[TOWER_OF[wie]]) {
      if (n < 0) continue;
      const s = g.board[n], p = s.length ? s[s.length - 1] : null;
      if (p && p.owner === wie && p.kind === NORMAL) klaar.add(p.value);
    }
    let k = 0;
    while (t + k + 1 <= 11 && klaar.has(t + k + 1)) k++;
    v[o + 1] = Math.min(k, 4) / 4;
    let doodN = 0;
    for (let w = t + 1; w <= Math.min(t + 3, 11); w++) if (leeft(w) <= 0) doodN++;
    v[o + 2] = doodN / 3;
    v[o + 3] = (11 - t) / 9;
    const doel = TOWER_OF[OTHER[wie]], ve = g.towerValue(OTHER[wie]);
    const dr = Math.floor(doel / 3), dc = doel % 3;
    const dichtbij = [false, false, false];
    let naast = 0;
    for (let cel = 0; cel < 21; cel++) {
      const s = g.board[cel];
      if (!s.length) continue;
      const p = s[s.length - 1];
      if (p.owner !== wie || p.kind !== NORMAL || p.value <= ve) continue;
      const d = Math.abs(Math.floor(cel / 3) - dr) + Math.abs(cel % 3 - dc), kol = cel % 3;
      if (d === 0) continue;
      if (1 / d > v[o + 4 + kol]) v[o + 4 + kol] = 1 / d;
      if (d <= 2) dichtbij[kol] = true;
      if (d === 1) naast++;
    }
    v[o + 7] = (dichtbij[0] + dichtbij[1] + dichtbij[2]) / 3;
    v[o + 8] = Math.min(naast, 2) / 2;
  }
  function planKenmerken(g, v, o) {
    const out = v || new Float64Array(N_PLAN), off = v ? o : 0;
    planKant(g, g.currentPlayer, true, out, off);
    planKant(g, OTHER[g.currentPlayer], false, out, off + 9);
    return out;
  }

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

  // Alleen voor metingen (optie `alwetend`): de echte hand, hold en aflegstapel van de
  // tegenstander blijven staan; alleen de volgorde van beide trekstapels wordt geschud. Zo'n
  // zoeker speelt vals met wat er NU verborgen is, maar kent de toekomstige trekkingen niet.
  function determiniseerAlwetend(game, rng) {
    const g = game.clone();
    g.rng = rng;
    for (const k of ['red', 'black']) { const p = g.drawPile[k].slice(); rng.shuffle(p); g.drawPile[k] = p; }
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
  function stukken(g) { let n = 0; for (let i = 0; i < 21; i++) n += g.board[i].length; return n; }
  // Hefboom C, winst-in-één aan de bladeren (optie `qwinst`): staat wie aan zet is in de schuiffase
  // met een kaart naast de vijandelijke toren die hem neemt, dan is de stelling gewonnen -- geen
  // schatting van het netwerk nodig. Hoogstens 4 vakjes nakijken.
  function winstInEen(g) {
    if (g.phase !== MOVE || g.gameOver || isVrij(g)) return false;
    const ik = g.currentPlayer, T = TOWER_OF[OTHER[ik]];
    for (const n of NBD[T]) {
      if (n < 0) continue;
      const s = g.board[n];
      if (!s.length) continue;
      const p = s[s.length - 1];
      if (p.owner === ik && p.kind === NORMAL && evaluateOnBoard(g.board, p, T) === WINS) return true;
    }
    return false;
  }

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
    this.alwetend = !!opties.alwetend;
    this.qwinst = !!opties.qwinst;
    // Hefboom E (7 oktober): in de legfase over meer gedetermineerde werelden middelen dan in de
    // schuiffase (0 = zelfde als `werelden`).
    this.legwerelden = opties.legwerelden ? opties.legwerelden : 0;
    // Hefboom C (7 oktober): late-move reductions. Vanaf de lmr-de zet (in zoekvolgorde) wordt een
    // rustige schuifzet (geen slag, geen winst) eerst een zet minder diep met een smal venster
    // bekeken; alleen als hij beter blijkt, opnieuw volledig. 0 = uit.
    this.lmr = opties.lmr ? opties.lmr : 0;
    this.lmrReducties = 0; this.lmrHerzoek = 0;
    this.qwinstTreffers = 0;
    // Hefboom A (7 oktober): na de gewone zoektocht van I nog dieper zolang er budget is.
    // budget = knopen voor de hele beslissing (deterministisch, dus meetbaar en herhaalbaar);
    // extra = hoeveel zetten dieper hoogstens; tijdgrens = harde rem in ms (vangnet voor trage
    // toestellen; 0 = uit). Zonder budget speelt de zoeker exact als voorheen.
    // Stijl (8 oktober, RL/resultaten/STIJL-LOG.md): de leg-regels van een sterke menselijke
    // speler als kleine voorkeur op de wortelwaarden (bonus voor opwaarderen, malus voor een
    // legzet die een regel breekt). Kleiner dan de wortelmarge, zodat de regel alleen beslist
    // tussen zetten die de zoeker ongeveer even goed vindt. '' = uit (exact I).
    this.stijl = opties.stijl ? String(opties.stijl) : '';
    this.stijlBonus = opties.stijlBonus !== undefined ? opties.stijlBonus : 0.08;
    this._stijlBezig = false;
    this.budget = opties.budget ? opties.budget : 0;
    this.extra = opties.extra !== undefined ? opties.extra : 2;
    this.tijdgrens = opties.tijdgrens ? opties.tijdgrens : 0;
    this._tijdEind = Infinity;
    this.verdiept = 0; this.verdiepPogingen = 0;
    // Zoeken onder een knopenlimiet: eerst op de volle diepte met hoogstens `knoopgrens`
    // knopen; wordt die overschreden, dan opnieuw (zonder limiet) op diepte-1. Zo zoekt hij
    // diep waar het betaalbaar is, zonder uitschieters van seconden. Deterministisch:
    // dezelfde stelling geeft dezelfde knopentelling, in JS en in Python.
    this.knoopgrens = opties.knoopgrens ? opties.knoopgrens : null;
    // Diepte voor een beslissing in de schuiffase (de wortel staat in MOVE); de legfase houdt
    // `diepte`. In de schuiffase is diep zoeken het meest waard en het goedkoopst.
    this.schuifdiepte = opties.schuifdiepte ? opties.schuifdiepte : null;
    // Zetvolgorde (weg 1, alleen JS; veranderen de exacte waarden niet, alleen hoeveel er
    // gezocht wordt): killer-zetten per afstand, zoeken met een smal venster (PVS), en een
    // zettabel met de beste zet per stelling uit eerdere iteraties.
    this.killers = !!opties.killers;
    this.pvs = !!opties.pvs;
    this.zettabel = !!opties.zettabel;
    // iteratief: eerst diepte-1 volledig (vult de zettabel en is de terugval), dan diepte
    // met de knoopgrens. Zonder: eerst diepte met grens, bij overschrijding diepte-1.
    this.iteratief = !!opties.iteratief;
    this._killer = [];
    this._tabel = new Map();
    // Transpositietabel (alleen JS, optie `tt`): per wereld, per beslissing. Sleutel = het
    // bord + aan zet + fase (g.sleutel) plus alles buiten het bord wat de rest van de boom
    // kan veranderen. Niet in de sleutel: de herhalingsgeschiedenis van het pad -- de
    // gebruikelijke benadering (dezelfde stelling via een andere weg telt hetzelfde).
    this.tt = !!opties.tt;
    this.ttBlad = !!opties.ttBlad;
    this._tt = new Map();
    this.ttTreffers = 0;
    this._grens = Infinity;
    this.diepGelukt = 0; this.diepAfgebroken = 0;
    this.wortelRonde = 0;
    this.geschiedenis = new Float64Array(N_ACTIONS);
    this.knopen = 0; this.bladen = 0;
    // Een netwerk met meer invoer dan LEN verwacht er de plan-kenmerken achter.
    this._v = new Float64Array(this.V.lagen[0].cols);
    this._plan = this.V.lagen[0].cols === LEN + N_PLAN;
    if (this.V.lagen[0].cols !== LEN && !this._plan) throw new Error('netwerk met onbekende invoer: ' + this.V.lagen[0].cols);
  }
  Zoeker.prototype.invoer = function (g) {
    vector(g, this._v);
    if (this._plan) planKenmerken(g, this._v, LEN);
    return this._v;
  };
  Zoeker.prototype.kosten = function (g) {
    if (isVrij(g)) return 0;
    return g.phase === PLACE ? this.legkosten : 1;
  };
  Zoeker.prototype.blad = function (g) {
    this.bladen++;
    if (this.qwinst && winstInEen(g)) {
      this.qwinstTreffers++;
      return g.currentPlayer === this.wortel ? WINST - 0.05 : -(WINST - 0.05);
    }
    const v = this.V.waarde(this.invoer(g));
    return g.currentPlayer === this.wortel ? v : -v;
  };
  Zoeker.prototype.eind = function (g, afstand) {
    if (g.winner === null) return 0;
    const w = WINST - 0.001 * afstand;
    return g.winner === this.wortel ? w : -w;
  };
  Zoeker.prototype.orden = function (legaal, afstand) {
    const h = this.geschiedenis;
    if (!this.killers || afstand === undefined) {
      return legaal.slice().sort((a, b) =>
        (h[b] + (b === A_TOWER_BUILD ? 1e9 : 0)) - (h[a] + (a === A_TOWER_BUILD ? 1e9 : 0)));
    }
    const k = this._killer[afstand] || [-1, -1];
    const sc = a => h[a] + (a === A_TOWER_BUILD ? 1e9 : 0) + (a === k[0] ? 5e8 : 0) + (a === k[1] ? 4e8 : 0);
    return legaal.slice().sort((a, b) => sc(b) - sc(a));
  };
  Zoeker.prototype.kinderen = function (g, legaal, maxi, afstand) {
    const k = [];
    for (const a of legaal) {
      const kind = g.clone();
      kind.step(a, false);
      let s;
      if (kind.gameOver) s = this.eind(kind, afstand + 1);
      else if (this.qwinst && winstInEen(kind)) s = kind.currentPlayer === this.wortel ? WINST - 0.05 : -(WINST - 0.05);
      else { const v = this.V.waarde(this.invoer(kind)); s = kind.currentPlayer === this.wortel ? v : -v; }
      k.push([s, a, kind]);
    }
    k.sort(maxi ? (x, y) => y[0] - x[0] : (x, y) => x[0] - y[0]);
    return k;
  };
  const AFBREKEN = { afbreken: true };
  const C = c => c.rank + c.suit;
  function ttSleutel(g) {
    if (g.sleutel === null) return null;
    const h = g.hold;
    return g.sleutel + '|' + g.roundNumber + g.starter[0]
      + (g.acted.red ? 1 : 0) + (g.acted.black ? 1 : 0)
      + (g.towerReset.red ? 1 : 0) + (g.towerReset.black ? 1 : 0)
      + (g.blockReserve.red ? 1 : 0) + (g.blockReserve.black ? 1 : 0)
      + '|' + (h.red ? C(h.red) : '-') + (h.black ? C(h.black) : '-')
      + '|' + g.hand.red.map(C).join('') + '/' + g.hand.black.map(C).join('')
      + '|' + g.drawPile.red.length + ',' + g.drawPile.black.length + ','
      + g.discard.red.length + ',' + g.discard.black.length + ','
      + g.fallen.red.length + ',' + g.fallen.black.length + ','
      + g.destroyed.red.length + ',' + g.destroyed.black.length
      + '|' + (g.pendingRevive || '') + g.buildCandidates.length;
  }
  const EXACT = 0, ONDER = 1, BOVEN = 2;
  Zoeker.prototype.zoek = function (g, diepte, alfa, beta, afstand) {
    this.knopen++;
    if (this.knopen > this._grens) throw AFBREKEN;
    if ((this.knopen & 1023) === 0 && this._tijdEind !== Infinity && Date.now() > this._tijdEind) throw AFBREKEN;
    if (g.gameOver) return this.eind(g, afstand);
    if (diepte <= 0) {
      if (!this.ttBlad) return this.blad(g);
      // Bladwaarden zijn exact; dezelfde stelling hoeft maar één keer door het netwerk.
      const bk = ttSleutel(g);
      if (bk === null) return this.blad(g);
      const e = this._tt.get(bk);
      if (e !== undefined && e.d >= 0 && e.f === EXACT) { this.ttTreffers++; return e.v; }
      const v = this.blad(g);
      if (e === undefined) this._tt.set(bk, { d: 0, v: v, f: EXACT, a: -1 });
      return v;
    }
    let ttk = null, tte;
    if (this.tt) {
      ttk = ttSleutel(g);
      if (ttk !== null && (tte = this._tt.get(ttk)) !== undefined && tte.d >= diepte) {
        if (tte.f === EXACT || (tte.f === ONDER && tte.v >= beta) || (tte.f === BOVEN && tte.v <= alfa)) {
          this.ttTreffers++;
          return tte.v;
        }
      }
    }
    const alfa0 = alfa, beta0 = beta;
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
      reeks = this.orden(legaal, afstand).map(a => [0, a, null]);
    }
    if (tte !== undefined && tte.a >= 0) {
      const i = reeks.findIndex(x => x[1] === tte.a);
      if (i > 0) { const x = reeks[i]; reeks.splice(i, 1); reeks.unshift(x); }
    }
    const sl = this.zettabel ? g.sleutel : null;
    if (sl !== null) {
      const hint = this._tabel.get(sl + '#' + afstand);
      if (hint !== undefined) {
        const i = reeks.findIndex(x => x[1] === hint);
        if (i > 0) { const x = reeks[i]; reeks.splice(i, 1); reeks.unshift(x); }
      }
    }
    const EPS = 1e-9;
    let besteA = -1, eerste = true, nr = 0;
    const lmrHier = this.lmr && diepte >= 3 && kosten > 0 && g.phase === MOVE && !isVrij(g);
    const stukkenHier = lmrHier ? stukken(g) : 0;
    for (const item of reeks) {
      const a = item[1];
      let kind = item[2];
      if (kind === null) { kind = g.clone(); kind.step(a, false); }
      let v;
      nr++;
      if (lmrHier && nr > this.lmr && a < A_PLACE_HAND && !kind.gameOver && stukken(kind) === stukkenHier
          && (maxi ? alfa > -Infinity : beta < Infinity)) {
        this.lmrReducties++;
        v = maxi ? this.zoek(kind, diepte - kosten - 1, alfa, alfa + EPS, afstand + 1)
                 : this.zoek(kind, diepte - kosten - 1, beta - EPS, beta, afstand + 1);
        if (maxi ? v > alfa : v < beta) { this.lmrHerzoek++; v = this.zoek(kind, diepte - kosten, alfa, beta, afstand + 1); }
      } else if (this.pvs && !eerste && beta - alfa > EPS) {
        // smal venster: is deze zet beter dan de beste tot nu toe? Zo ja, opnieuw met het
        // volle venster, zodat de waarde exact blijft.
        if (maxi) {
          v = this.zoek(kind, diepte - kosten, alfa, alfa + EPS, afstand + 1);
          if (v > alfa && v < beta) v = this.zoek(kind, diepte - kosten, alfa, beta, afstand + 1);
        } else {
          v = this.zoek(kind, diepte - kosten, beta - EPS, beta, afstand + 1);
          if (v < beta && v > alfa) v = this.zoek(kind, diepte - kosten, alfa, beta, afstand + 1);
        }
      } else {
        v = this.zoek(kind, diepte - kosten, alfa, beta, afstand + 1);
      }
      eerste = false;
      if (maxi) { if (v > beste) { beste = v; besteA = a; } if (v > alfa) alfa = v; }
      else { if (v < beste) { beste = v; besteA = a; } if (v < beta) beta = v; }
      if (beta <= alfa) {
        this.geschiedenis[a] += diepte * diepte;
        if (this.killers) {
          const k = this._killer[afstand] || (this._killer[afstand] = [-1, -1]);
          if (k[0] !== a) { k[1] = k[0]; k[0] = a; }
        }
        break;
      }
    }
    if (sl !== null && besteA >= 0) this._tabel.set(sl + '#' + afstand, besteA);
    // Winstwaarden niet opslaan: die hangen van de afstand tot de wortel af.
    if (ttk !== null && Math.abs(beste) < 1.5) {
      const f = beste <= alfa0 ? BOVEN : (beste >= beta0 ? ONDER : EXACT);
      if (tte === undefined || tte.d <= diepte) this._tt.set(ttk, { d: diepte, v: beste, f: f, a: besteA });
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
      this._tt.clear();
      const wereld = this.alwetend ? determiniseerAlwetend(game, new PyRandom(basis + k * 15485863))
        : determiniseer(game, kleur, new PyRandom(basis + k * 15485863));
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
  // De regels, vanuit de eigen kleur (zwart gespiegeld; de actienummers zijn dat al):
  //   o opwaarderen   w a2/b1/b3 alleen opwaardeerbaar of H/A   n a1/a3 niet beleggen
  //   v c1-c3 alleen H/A/2   t de 2 niet op a1-a3/b1/b3   q geen V leggen na ronde 3
  const ST_OPW = new Set(['a2', 'b1', 'b3']), ST_NOOD = new Set(['a1', 'a3']), ST_VOOR = new Set(['c1', 'c2', 'c3']);
  function stijlMag(regels, cel, r, toren, ronde) {
    if (regels.includes('w') && ST_OPW.has(cel) &&
        !(r === 'K' || r === 'A' || (r !== '2' && toren < RANK_VALUE[r] && RANK_VALUE[r] <= 11))) return false;
    if (regels.includes('n') && ST_NOOD.has(cel)) return false;
    if (regels.includes('v') && ST_VOOR.has(cel) && !(r === 'K' || r === 'A' || r === '2')) return false;
    if (regels.includes('t') && r === '2' && (ST_OPW.has(cel) || ST_NOOD.has(cel))) return false;
    if (regels.includes('q') && r === 'Q' && ronde > 3) return false;
    return true;
  }
  function stijlBonus(game, legaal, regels, d) {
    if (game.phase !== PLACE && game.phase !== MOVE) return null;
    const kleur = game.currentPlayer, toren = game.towerValue(kleur), m = new Map();
    for (const a of legaal) {
      if (a === A_TOWER_BUILD) { if (regels.includes('o')) m.set(a, d); continue; }
      let cel = null, r = null;
      if (game.phase === PLACE && a >= A_PLACE_HAND && a < A_HAND_TO_HOLD) {
        const k = a - A_PLACE_HAND;
        cel = ALL_CELLS[k % N_CELLS]; r = game.hand[kleur][Math.floor(k / N_CELLS)].rank;
      } else if (a >= A_HOLD_TO_FIELD && a < A_TOWER_BUILD && game.hold[kleur]) {
        cel = ALL_CELLS[a - A_HOLD_TO_FIELD]; r = game.hold[kleur].rank;
      }
      if (cel !== null && !stijlMag(regels, cel, r, toren, game.roundNumber)) m.set(a, -d);
      // Eigen vondsten uit de menspartijen (8 oktober; standaard uit):
      //   h  de hold is een reserve voor H/A/2: zo'n kaart erin +d, een andere erin -d
      //   x  slaan: een schuifzet die een gewone vijandelijke kaart slaat of stapelt +d
      //   e  zuinig: met al 3+ eigen kaarten op het bord geen kaart (behalve H/A) meer leggen -d
      //   (h, x, e, a: verkend in RL/resultaten/STIJL-LOG.md, deel 2)
      let extra = 0;
      if (regels.includes('h') && game.phase === PLACE && a >= A_HAND_TO_HOLD && a < A_HOLD_TO_FIELD) {
        const rh = game.hand[kleur][a - A_HAND_TO_HOLD].rank;
        extra += (rh === 'K' || rh === 'A' || rh === '2') ? d : -d;
      }
      if (regels.includes('x') && game.phase === MOVE && a < A_PLACE_HAND) {
        const flip = kleur === 'black', van = flip ? MIRROR[Math.floor(a / 4)] : Math.floor(a / 4);
        let rr = a % 4; if (flip && rr < 2) rr = 1 - rr;
        const naar = NBD[van][rr], st = naar >= 0 ? game.board[naar] : null;
        const top = st && st.length ? st[st.length - 1] : null;
        if (top && top.owner !== kleur && top.kind === NORMAL) extra += d;
      }
      if (regels.includes('e') && cel !== null && game.phase === PLACE && r !== 'K' && r !== 'A') {
        let eigen = 0;
        for (let i = 0; i < N_CELLS; i++) {
          const st = game.board[i], top = st.length ? st[st.length - 1] : null;
          if (top && top.owner === kleur && top.kind === NORMAL) eigen++;
        }
        if (eigen >= 3) extra -= d;
      }
      //   a  vroeg aanvallen: in ronde 1-4 een H/A vooraan (c1-c3) leggen +d
      if (regels.includes('a') && cel !== null && game.phase === PLACE && (r === 'K' || r === 'A') &&
          ST_VOOR.has(cel) && game.roundNumber <= 4) extra += d;
      if (extra) m.set(a, Math.max(-d, Math.min(d, (m.get(a) || 0) + extra)));
    }
    return m.size ? m : null;
  }
  Zoeker.prototype.kies = function (game, legaal) {
    if (!this.stijl || this._stijlBezig || this.bonus) return this._kiesKern(game, legaal);
    legaal = legaal || game.legalActions();
    if (legaal.length < 2) return this._kiesKern(game, legaal);
    this._stijlBezig = true;
    this.bonus = stijlBonus(game, legaal, this.stijl, this.stijlBonus);
    try { return this._kiesKern(game, legaal); } finally { this.bonus = null; this._stijlBezig = false; }
  };
  Zoeker.prototype._kiesKern = function (game, legaal) {
    legaal = legaal || game.legalActions();
    if (!legaal.length) return null;
    if (legaal.length === 1) return legaal[0];
    this.geschiedenis.fill(0);
    this._killer = [];
    this._tabel.clear();
    const beste = w => {
      let best = null, bw = -Infinity;
      for (const a of legaal) {         // oplopend: bij gelijke waarde de laagste index
        // bonus: per beslissing van buitenaf (RL/stijlbot.py), standaard geen.
        const x = w.get(a) + (this.bonus ? (this.bonus.get(a) || 0) : 0);
        if (x > bw) { bw = x; best = a; }
      }
      return best;
    };
    const basis = this.diepte;
    const D = (this.schuifdiepte !== null && game.phase === MOVE) ? this.schuifdiepte : basis;
    if (this.legwerelden && game.phase === PLACE && !this._inLeg) {
      const w0 = this.werelden;
      this.werelden = this.legwerelden; this._inLeg = true;
      try { return this.kies(game, legaal); } finally { this.werelden = w0; this._inLeg = false; }
    }
    if (this.budget && !this._inBudget) {
      // Eerst exact de gewone zoektocht (dezelfde diepte, limiet en terugval als zonder budget).
      const eind = this.knopen + this.budget, t0 = Date.now();
      let keuze;
      this._inBudget = true;
      try { keuze = this.kies(game, legaal); } finally { this._inBudget = false; }
      // Dan dieper zolang het budget het toelaat; een afgebroken diepte telt niet.
      if (this.tijdgrens) this._tijdEind = t0 + this.tijdgrens;
      try {
        for (let d = D + 1; d <= D + this.extra && this.knopen < eind; d++) {
          this.diepte = d; this._grens = eind; this.verdiepPogingen++;
          try { keuze = beste(this.waarden(game, legaal)); this.verdiept++; }
          catch (e) { if (e !== AFBREKEN) throw e; break; }
          finally { this._grens = Infinity; }
        }
      } finally { this.diepte = basis; this._tijdEind = Infinity; }
      return keuze;
    }
    try {
      this.diepte = D;
      if (this.knoopgrens === null) return beste(this.waarden(game, legaal));
      let terugval = null;
      if (this.iteratief) {
        this.diepte = D - 1;
        terugval = beste(this.waarden(game, legaal));
        this.diepte = D;
      }
      this._grens = this.knopen + this.knoopgrens;
      try {
        const keuze = beste(this.waarden(game, legaal));
        this.diepGelukt++;
        return keuze;
      } catch (e) {
        if (e !== AFBREKEN) throw e;
        this.diepAfgebroken++;
      } finally { this._grens = Infinity; }
      if (terugval !== null) return terugval;
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
    Game, Piece, Card, PyRandom, Schudder, SnelSchudder, Netwerk, Zoeker, vector, planKenmerken, N_PLAN, determiniseer,
    verborgenVoorraad, evaluateOnBoard, vanPython, vanBrowser, buildColorDeck, nieuwSpel,
    ALL_CELLS, CELL_IDX, MIRROR, NBD, TERR, RANKS, RANK_VALUE, RANK_IDX,
    A_MOVE, A_PLACE_HAND, A_HAND_TO_HOLD, A_HOLD_TO_FIELD, A_TOWER_BUILD, A_BLOCK, A_PASS,
    A_REVIVE, A_BUILD_PICK, N_ACTIONS, PLACE, MOVE, DRAW, GAMEOVER, NORMAL, TOWER, TOWERLAYER, BLOCK,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.EenBot = api;
})(typeof window !== 'undefined' ? window : this);
