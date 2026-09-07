#!/usr/bin/env node
/*
 * Baarden AI-trainer
 * ==================
 * Lokaal te draaien met: node baarden-train.js [diepte] [generaties] [partijen-per-match]
 * Voorbeeld:            node baarden-train.js 3 40 8
 *
 * Wat dit doet:
 * -------------
 * De AI in het spel gebruikt een minimax-zoekfunctie (met vooruitkijken) gecombineerd met een
 * HEURISTISCHE bordwaardering (AI_WEIGHTS in baarden-prototype.html) om te bepalen hoe goed een
 * bordstand is. Dit script speelt duizenden partijen tussen twee sets gewichten tegen elkaar
 * ("kampioen" vs "uitdager"), en houdt de beste gewichten over via een eenvoudige "random-restart
 * hill climbing"-aanpak: de uitdager is een kleine willekeurige mutatie van de huidige kampioen;
 * wint hij vaker, dan wordt hij de nieuwe kampioen.
 *
 * BELANGRIJKE BEPERKING (bewust, om dit script snel en zelfstandig te houden):
 * Dit script simuleert enkel het TACTISCHE bewegingsgedeelte van Baarden (een kaart 1 vakje
 * verschuiven, veroveren, stapelen) — exact het deel dat de minimax-zoekfunctie in het echte spel
 * ook doorzoekt. Leggen, hold, blok-kaarten en toren-opwaarderen worden voor de training NIET
 * gesimuleerd; elke speler begint gewoon met een handvol willekeurige kaarten rond zijn toren en
 * beide spelers bewegen daarna om beurten. Dit is voldoende om de gewichten van de kern-heuristiek
 * (torenwaarde, kaartwaarde, positie/dreiging) zinvol te trainen, zonder de volledige, complexere
 * regelset te moeten naspelen in een apart script.
 *
 * Resultaat: een bestand baarden-ai-weights.json met de beste gevonden gewichten. Kopieer die
 * waarden in de AI_WEIGHTS-constante bovenaan de AI-sectie in baarden-prototype.html.
 *
 * Geen dependencies nodig — puur Node.js (getest met Node 18+).
 */

const fs = require('fs');

/* ======================= SPEELVELD (zelfde geometrie als het echte spel) ======================= */
const ROWS = ['a','b','c','d','e','f','g'];
const COLS = [1,2,3];
const ALL_CELLS = [];
ROWS.forEach(r => COLS.forEach(c => ALL_CELLS.push(r+c)));
const RED_TOWER = 'b2', BLACK_TOWER = 'f2';
const RED_TERRITORY = ['a1','a2','a3','b1','b3','c1','c2','c3'];
const BLACK_TERRITORY = ['e1','e2','e3','f1','f3','g1','g2','g3'];

function rowIndex(cell){ return ROWS.indexOf(cell[0]); }
function colOf(cell){ return parseInt(cell[1]); }
function cellAt(r,c){ return (r>=0 && r<ROWS.length && c>=1 && c<=3) ? ROWS[r]+c : null; }
function neighbors(cell){
  const r = rowIndex(cell), c = colOf(cell);
  return [cellAt(r-1,c), cellAt(r+1,c), cellAt(r,c-1), cellAt(r,c+1)].filter(Boolean);
}
function manhattan(a,b){ return Math.abs(rowIndex(a)-rowIndex(b)) + Math.abs(colOf(a)-colOf(b)); }
function towerCellOf(color){ return color==='red' ? RED_TOWER : BLACK_TOWER; }
function other(color){ return color==='red' ? 'black' : 'red'; }

/* ======================= KAARTEN ======================= */
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RANK_VALUE = {2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13,A:14};
function valueOf(rank){ return RANK_VALUE[rank]; }

function buildDeck(color){
  const suits = color==='red' ? ['H','D'] : ['S','C'];
  const towerSuit = suits[0];
  let deck = [];
  suits.forEach(s => RANKS.forEach(r => { if(!(s===towerSuit && r==='2')) deck.push({rank:r, suit:s}); }));
  return deck;
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

/* ======================= GEVECHTSREGELS (zelfde logica als evaluateMoveOnBoard in het spel) ======================= */
function evaluateMoveOnBoard(board, color, movingPiece, destCell){
  const destStack = board[destCell];
  if(!destStack || destStack.length===0) return {legal:true, type:'moved'};
  const top = destStack[destStack.length-1];
  if(top.owner===color) return {legal:false};
  const av = valueOf(movingPiece.rank), dv = valueOf(top.rank);
  const isTower = top.kind==='tower';
  const twoBeatsAce = (movingPiece.rank==='2' && top.rank==='A');
  const attackerWins = twoBeatsAce || (av > dv);
  const isTie = !twoBeatsAce && (av === dv);
  if(isTower) return attackerWins ? {legal:true, type:'wins'} : {legal:false};
  if(!attackerWins && !isTie) return {legal:false};
  if(attackerWins) return {legal:true, type:'captured'};
  return {legal:true, type:'stacked'};
}

function simulateMove(board, color, src, dest){
  const nb = JSON.parse(JSON.stringify(board));
  const srcStack = nb[src];
  const movingPiece = srcStack[srcStack.length-1];
  const evalR = evaluateMoveOnBoard(nb, color, movingPiece, dest);
  if(!evalR.legal) return null;
  srcStack.pop();
  nb[src] = srcStack.length ? srcStack : null;
  let destStack = nb[dest] ? nb[dest] : [];
  if(evalR.type==='wins'){ nb[dest] = [movingPiece]; return {board:nb, winner:color}; }
  if(evalR.type==='moved' || evalR.type==='captured'){ nb[dest] = [movingPiece]; }
  else { destStack.push(movingPiece); nb[dest] = destStack; }
  return {board:nb, winner:null};
}

function getLegalMoves(board, color){
  const moves = [];
  ALL_CELLS.forEach(src=>{
    const stack = board[src];
    if(!stack || !stack.length) return;
    const top = stack[stack.length-1];
    if(top.owner!==color || top.kind!=='normal') return;
    neighbors(src).forEach(dest=>{
      if(evaluateMoveOnBoard(board, color, top, dest).legal) moves.push({src,dest});
    });
  });
  return moves;
}

/* ======================= HEURISTIEK & MINIMAX (zelfde vorm als in het spel) ======================= */
function evalBoard(board, forColor, weights){
  const opp = other(forColor);
  let score = 0;
  const myT = board[towerCellOf(forColor)], oppT = board[towerCellOf(opp)];
  score += (valueOf(myT[myT.length-1].rank) - valueOf(oppT[oppT.length-1].rank)) * weights.towerDiff;
  ALL_CELLS.forEach(cell=>{
    const stack = board[cell];
    if(!stack || !stack.length) return;
    const top = stack[stack.length-1];
    if(top.kind!=='normal') return;
    const val = valueOf(top.rank);
    if(top.owner===forColor){
      score += val*weights.ownCardVal;
      score += Math.max(0,6-manhattan(cell,towerCellOf(opp)))*weights.ownAdvance;
    } else {
      score -= val*weights.oppCardVal;
      score -= Math.max(0,6-manhattan(cell,towerCellOf(forColor)))*weights.oppThreat;
    }
  });
  return score;
}

function minimax(board, depth, maxColor, curColor, alpha, beta, weights){
  const moves = getLegalMoves(board, curColor);
  if(depth===0 || moves.length===0) return {score: evalBoard(board, maxColor, weights)};
  let bestMove = null;
  const maximizing = (curColor===maxColor);
  let best = maximizing ? -Infinity : Infinity;
  for(const mv of moves){
    const sim = simulateMove(board, curColor, mv.src, mv.dest);
    if(!sim) continue;
    let score;
    if(sim.winner===maxColor) score = 1e6;
    else if(sim.winner) score = -1e6;
    else score = minimax(sim.board, depth-1, maxColor, other(curColor), alpha, beta, weights).score;
    if(maximizing){ if(score>best){best=score;bestMove=mv;} alpha=Math.max(alpha,score); }
    else { if(score<best){best=score;bestMove=mv;} beta=Math.min(beta,score); }
    if(beta<=alpha) break;
  }
  return {score:best, move:bestMove};
}

/* ======================= VEREENVOUDIGDE STARTOPSTELLING VOOR TRAINING ======================= */
// Zie de beperking hierboven: geen trekken/leggen/hold/blok-kaart, enkel een kant-en-klaar bord
// met wat willekeurige kaarten rond elke toren, waarna beide spelers om beurten bewegen.
function freshTrainingBoard(){
  const board = {};
  ALL_CELLS.forEach(c => board[c]=null);
  board[RED_TOWER] = [{owner:'red', kind:'tower', rank:'2'}];
  board[BLACK_TOWER] = [{owner:'black', kind:'tower', rank:'2'}];
  ['red','black'].forEach(color=>{
    const zone = color==='red' ? RED_TERRITORY : BLACK_TERRITORY;
    const deck = shuffle(buildDeck(color));
    shuffle(zone).slice(0,4).forEach((cell,i)=>{
      board[cell] = [{owner:color, kind:'normal', rank:deck[i].rank, suit:deck[i].suit}];
    });
  });
  return board;
}

function playGame(weightsRed, weightsBlack, depth, maxPlies=100){
  let board = freshTrainingBoard();
  let turn = 'red';
  for(let ply=0; ply<maxPlies; ply++){
    const w = turn==='red' ? weightsRed : weightsBlack;
    const result = minimax(board, depth, turn, turn, -Infinity, Infinity, w);
    if(!result.move) return {winner: other(turn), plies:ply};
    const sim = simulateMove(board, turn, result.move.src, result.move.dest);
    board = sim.board;
    if(sim.winner) return {winner: sim.winner, plies:ply};
    turn = other(turn);
  }
  const rv = board[RED_TOWER], bv = board[BLACK_TOWER];
  const rVal = valueOf(rv[rv.length-1].rank), bVal = valueOf(bv[bv.length-1].rank);
  return {winner: rVal===bVal ? null : (rVal>bVal ? 'red' : 'black'), plies:maxPlies};
}

/* ======================= GEWICHTEN: willekeurig genereren / muteren ======================= */
function randomWeights(){
  return {
    towerDiff:   5 + Math.random()*25,
    ownCardVal:  0.5 + Math.random()*2,
    oppCardVal:  0.5 + Math.random()*2,
    ownAdvance:  0.5 + Math.random()*4,
    oppThreat:   0.5 + Math.random()*5,
    blockBonus:  Math.random()*8,
  };
}
function mutate(w, amount=0.2){
  const nw = {};
  for(const k in w) nw[k] = Math.max(0.05, w[k] * (1 + (Math.random()*2-1)*amount));
  return nw;
}

/* ======================= TRAININGSLUS ======================= */
function main(){
  const DEPTH = parseInt(process.argv[2]) || 3;
  const GENERATIONS = parseInt(process.argv[3]) || 30;
  const GAMES_PER_MATCH = parseInt(process.argv[4]) || 8;

  console.log(`Baarden AI-trainer — diepte=${DEPTH}, generaties=${GENERATIONS}, partijen/match=${GAMES_PER_MATCH}`);
  console.log('(Hoe hoger de diepte, hoe sterker maar ook trager. Begin met 3 om snel te itereren.)\n');

  let champion = { towerDiff:15, ownCardVal:1, oppCardVal:1, ownAdvance:2, oppThreat:3, blockBonus:5 };
  const startTime = Date.now();

  for(let gen=1; gen<=GENERATIONS; gen++){
    const challenger = mutate(champion);
    let challengerWins=0, championWins=0, draws=0;

    for(let g=0; g<GAMES_PER_MATCH; g++){
      const challengerIsRed = g%2===0; // wissel kleuren om kleur-bias te vermijden
      const res = playGame(
        challengerIsRed ? challenger : champion,
        challengerIsRed ? champion : challenger,
        DEPTH
      );
      if(res.winner===null) draws++;
      else if((res.winner==='red')===challengerIsRed) challengerWins++;
      else championWins++;
    }

    const verbeterd = challengerWins > championWins;
    console.log(`Generatie ${gen.toString().padStart(3)}: uitdager ${challengerWins} — kampioen ${championWins} (${draws} gelijk)` + (verbeterd ? '  ← nieuwe kampioen!' : ''));
    if(verbeterd) champion = challenger;
  }

  const seconds = ((Date.now()-startTime)/1000).toFixed(1);
  console.log(`\nKlaar in ${seconds}s.\n`);
  console.log('=== BESTE GEWICHTEN ===');
  console.log(JSON.stringify(champion, null, 2));

  const path = require('path');
  const outPath = path.join(__dirname, 'baarden-ai-weights.json');
  fs.writeFileSync(outPath, JSON.stringify(champion, null, 2));
  console.log('\nWeggeschreven naar:');
  console.log('  ' + outPath);
  console.log('\nKopieer deze waarden in de regel "let AI_WEIGHTS = ..." in baarden-prototype.html om de bot te verbeteren.');
}

main();
