#!/usr/bin/env node
/*
 * Baarden bot-vergelijker
 * =======================
 * Laat twee versies van de AI volledige partijen Baarden tegen elkaar spelen, met de ECHTE spelcode
 * uit "Baarden Game.html": trekken, leggen, bewegen, blok-kaart, hold, toren opwaarderen, herleven.
 * Zo zie je of een aanpassing aan de bot hem echt sterker maakt, in plaats van het te gokken.
 *
 * Gebruik (vanuit de projectmap):
 *   node "Baarden AI bot/baarden-vergelijk.js" [partijen] [versie-A] [versie-B] [startgetal]
 *
 *   partijen    aantal partijen, naar boven afgerond op een even getal       (standaard 100)
 *   versie-A    de versie waartegen je vergelijkt                              (standaard 6554e6a)
 *   versie-B    de versie die je wil testen                                    (standaard huidig)
 *   startgetal  bepaalt hoe de kaarten geschud worden; zelfde getal = zelfde spellen (standaard 1)
 *
 * Een versie is één van:
 *   huidig          "Baarden Game.html" zoals hij nu in de projectmap staat, ook niet-gecommit
 *   een git-commit  bv. 6554e6a of HEAD~1: de bot zoals hij in die commit was
 *   een bestandspad bv. "oud/Baarden Game.html"
 *
 * Eerlijkheid: de partijen gaan per paar. Beide partijen van een paar krijgen exact dezelfde geschudde
 * kaarten, maar de versies wisselen van kleur. Zwart begint altijd, dus zo weegt dat voordeel voor
 * beide versies even zwaar.
 *
 * Geen dependencies nodig: puur Node.js (18 of nieuwer). De partijen lopen verdeeld over de kernen
 * van je processor. Ctrl+C stopt, en toont de uitslag van de partijen die al klaar waren.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const PROJECTMAP = path.join(__dirname, '..');
const SPELBESTAND = 'Baarden Game.html';
const MAX_RONDES = 80;            // wie na zoveel rondes nog geen toren veroverd heeft: onbeslist
const MAX_BEURTEN = 3000;         // noodrem, ruim boven wat 80 rondes nodig hebben
const BEURT_TIMEOUT_MS = 120000;  // één beurt die langer duurt, telt als vastgelopen

/* ======================= VERSIES INLEZEN ======================= */
function leesVersie(spec){
  if(spec==='huidig') return fs.readFileSync(path.join(PROJECTMAP, SPELBESTAND), 'utf8');
  const alsPad = path.resolve(process.cwd(), spec);
  if(fs.existsSync(alsPad) && fs.statSync(alsPad).isFile()) return fs.readFileSync(alsPad, 'utf8');
  try{
    return execFileSync('git', ['show', `${spec}:${SPELBESTAND}`],
      { cwd: PROJECTMAP, encoding: 'utf8', maxBuffer: 64*1024*1024, stdio: ['ignore', 'pipe', 'pipe'] });
  }catch(e){
    throw new Error(`Versie "${spec}" niet gevonden: het is geen bestand, en geen git-commit waarin "${SPELBESTAND}" zit.`);
  }
}

// Enkel de ingebouwde <script>-blokken; firebaseConfig.js (met src=) is voor het testen niet nodig.
function spelcodeUit(html){
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, code = '';
  while((m = re.exec(html))) code += m[1] + '\n;\n';
  if(!code.trim()) throw new Error('Geen spelcode gevonden in het HTML-bestand.');
  return code;
}

/* ======================= NEP-BROWSER ======================= */
// Een nep-element: elke eigenschap en elke methode bestaat en doet niets. De bot zelf leest het
// scherm niet; enkel de weergave doet dat, en die zetten we na het laden toch uit.
function kameleon(){
  const opgeslagen = new Map();
  return new Proxy(function(){}, {
    get(doel, sleutel){
      if(opgeslagen.has(sleutel)) return opgeslagen.get(sleutel);
      if(sleutel==='then') return undefined; // anders ziet `await` hem aan voor een promise
      if(sleutel===Symbol.toPrimitive) return hint => hint==='number' ? 0 : '';
      if(sleutel===Symbol.iterator) return function*(){};
      if(typeof sleutel==='symbol') return undefined;
      if(sleutel==='length') return 0;
      if(sleutel==='querySelectorAll' || sleutel==='getElementsByClassName' || sleutel==='getElementsByTagName') return () => [];
      if(sleutel==='getBoundingClientRect') return () => ({left:0, top:0, right:0, bottom:0, width:0, height:0, x:0, y:0});
      const kind = kameleon();
      opgeslagen.set(sleutel, kind);
      return kind;
    },
    set(doel, sleutel, waarde){ opgeslagen.set(sleutel, waarde); return true; },
    apply(){ return kameleon(); },
    construct(){ return kameleon(); },
  });
}

function nepOpslag(){
  const m = new Map();
  return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
  };
}

// Wachttijden in de spelcode (setTimeout, requestAnimationFrame) lopen meteen af, zodat niets
// blijft hangen op een animatie die hier nooit getekend wordt.
const meteen = (fn, ...args) => { if(typeof fn==='function') setImmediate(() => { try{ fn(...args); }catch(e){} }); return 0; };

// Wordt na het laden in elke versie uitgevoerd: alles wat enkel beeld of wachttijd is, gaat eruit,
// en het schudden gebruikt het vaste toevalsgetal-stroompje van de partij.
const STIL_MAKEN = `
(function(){
  const niets = function(){};
  const nietsAsync = async function(){};
  const vervangers = {
    renderAll: niets, sleep: nietsAsync, nextFrame: nietsAsync, forceReflow: niets,
    animateCardFly: nietsAsync, animateCardSlide: nietsAsync, animateBlockCard: nietsAsync,
    animateToTower: nietsAsync, showToast: niets, flash: niets, maybeAiActs: niets,
  };
  for(const naam in vervangers){
    if(typeof globalThis[naam]==='function') globalThis[naam] = vervangers[naam];
  }
  Math.random = function(){ return globalThis.__toeval ? globalThis.__toeval() : 0.5; };
})();
`;

function laadVersie(naam, code){
  const sandbox = {
    console: { log(){}, info(){}, warn(){}, error(){}, debug(){} },
    document: kameleon(),
    localStorage: nepOpslag(),
    sessionStorage: nepOpslag(),
    navigator: { userAgent: 'node', language: 'nl', clipboard: kameleon() },
    location: { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', search: '', hash: '', reload(){} },
    history: kameleon(),
    setTimeout: meteen, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    requestAnimationFrame: meteen, cancelAnimationFrame(){},
    queueMicrotask, structuredClone, URL, URLSearchParams, TextEncoder, TextDecoder,
    crypto: require('crypto').webcrypto,
    performance: { now: () => Date.now() },
    getComputedStyle: () => kameleon(),
    matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
    MutationObserver: class { observe(){} disconnect(){} },
    ResizeObserver: class { observe(){} disconnect(){} },
    IntersectionObserver: class { observe(){} disconnect(){} },
    scrollY: 0, pageYOffset: 0, innerWidth: 1280, innerHeight: 800,
    addEventListener(){}, removeEventListener(){}, scrollTo(){},
    alert(){}, confirm(){ return true; }, prompt(){ return null; },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: `versie-${naam}` });
  vm.runInContext(STIL_MAKEN, ctx);
  return ctx;
}

/* ======================= EEN PARTIJ SPELEN ======================= */
const NIEUW_SPEL = `JSON.stringify((function(){
  const s = createInitialState();
  s.players = { red: true, black: true };
  return s;
})())`;

// Eén beurt van de bot aan zet, precies zoals in een AI-partij in de browser (aiTakeTurn).
const BEURT = `
(async function(){
  state = hydrateState(JSON.parse(__invoer));
  aiMode = true; soloMode = false; roomCode = null;
  aiColor = state.turn;
  myColor = aiColor==='red' ? 'black' : 'red';
  aiThinking = false; bypassTurnGate = false;
  await aiTakeTurn();

  // Oudere bots konden een openstaande keuze (twee even hoge torenkaarten, of herleven) niet zelf
  // maken; in het echte spel koos de mens dan in hun plaats. Hier nemen we dan de eerste optie, en
  // tellen we hoe vaak dat nodig was.
  let hulpkeuzes = 0;
  bypassTurnGate = true;
  for(let i=0; i<20 && !state.winner && state.turn===aiColor; i++){
    if(state.reviveChoice && state.reviveChoice.color===aiColor){
      hulpkeuzes++;
      const opties = state.reviveChoice.options || [];
      await chooseRevive(opties.length ? opties[0].id : null);
    } else if(state.towerBuild && state.towerBuild.pendingCandidates){
      hulpkeuzes++;
      await chooseTowerCandidate(0);
    } else {
      break;
    }
  }
  bypassTurnGate = false;
  return JSON.stringify({ state, hulpkeuzes });
})()
`;

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function binnenTijd(belofte, ms){
  let timer;
  return Promise.race([
    Promise.resolve(belofte).finally(() => clearTimeout(timer)),
    new Promise(res => { timer = setTimeout(() => res(null), ms); }),
  ]);
}

function zonderLog(s){ return JSON.stringify(Object.assign({}, s, { log: null })); }

async function speelPartij(zwart, rood, seed){
  const toeval = mulberry32(seed);
  zwart.__toeval = toeval;
  rood.__toeval = toeval;
  let s = JSON.parse(vm.runInContext(NIEUW_SPEL, zwart));
  const hulp = { black: 0, red: 0 };
  let stilstand = 0;

  for(let beurt=0; beurt<MAX_BEURTEN; beurt++){
    if(s.winner) return { winnaar: s.winner, rondes: s.roundNumber, hulp };
    if(s.roundNumber > MAX_RONDES) return { winnaar: null, reden: 'rondelimiet', rondes: s.roundNumber, hulp };

    const kleur = s.turn;
    const ctx = kleur==='black' ? zwart : rood;
    ctx.__invoer = JSON.stringify(s);
    let uit;
    try{
      uit = await binnenTijd(vm.runInContext(BEURT, ctx), BEURT_TIMEOUT_MS);
    }catch(e){
      return { winnaar: null, reden: `fout bij ${kleur==='black' ? 'zwart' : 'rood'}: ${(e && e.message) || e}`, rondes: s.roundNumber, hulp };
    }
    if(uit===null) return { winnaar: null, reden: 'vastgelopen (beurt duurde te lang)', rondes: s.roundNumber, hulp };

    const r = JSON.parse(uit);
    hulp[kleur] += r.hulpkeuzes;
    const nieuw = r.state;
    if(Array.isArray(nieuw.log) && nieuw.log.length > 40) nieuw.log = nieuw.log.slice(-40);
    // Verandert er drie beurten na elkaar niets, dan weet geen van beide bots nog iets te doen.
    stilstand = zonderLog(nieuw)===zonderLog(s) ? stilstand+1 : 0;
    if(stilstand >= 3) return { winnaar: null, reden: 'vastgelopen (niemand doet nog iets)', rondes: s.roundNumber, hulp };
    s = nieuw;
  }
  return { winnaar: null, reden: 'beurtlimiet', rondes: s.roundNumber, hulp };
}

/* ======================= WERKER (één per processorkern) ======================= */
if(!isMainThread){
  const versies = { A: laadVersie('A', workerData.codeA), B: laadVersie('B', workerData.codeB) };
  parentPort.on('message', async taak => {
    const start = Date.now();
    const zwart = versies[taak.zwart];
    const rood = versies[taak.zwart==='A' ? 'B' : 'A'];
    const uitkomst = await speelPartij(zwart, rood, taak.seed);
    parentPort.postMessage(Object.assign({}, taak, uitkomst, { ms: Date.now() - start }));
  });
}

/* ======================= UITSLAG ======================= */
const anderVan = v => v==='A' ? 'B' : 'A';
const procent = x => (100*x).toFixed(1).replace('.', ',') + '%';

function winnaarVersie(u){
  if(u.winnaar==='black') return u.zwart;
  if(u.winnaar==='red') return anderVan(u.zwart);
  return null;
}

function drukRegel(u, klaar, totaal){
  const w = winnaarVersie(u);
  const tekst = w ? `${w} wint (met ${u.winnaar==='black' ? 'zwart' : 'rood'})` : `onbeslist: ${u.reden}`;
  console.log(`[${String(klaar).padStart(String(totaal).length)}/${totaal}] paar ${u.paar}, A speelt ${u.zwart==='A' ? 'zwart' : 'rood '} → ${tekst}, ${u.rondes} rondes, ${(u.ms/1000).toFixed(1)}s`);
}

// Wilson-interval: de marge waarbinnen de echte winstkans met 95% zekerheid ligt.
function wilson(k, n, z=1.96){
  const p = k/n, d = 1 + z*z/n;
  const midden = (p + z*z/(2*n)) / d;
  const breedte = z * Math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / d;
  return [Math.max(0, midden - breedte), Math.min(1, midden + breedte)];
}

function drukUitslag(uitslagen, specA, specB){
  const n = uitslagen.length;
  console.log('');
  if(!n){ console.log('Nog geen partijen gespeeld.'); return; }

  const winst = { A: 0, B: 0 };
  const alsZwart = { A: { gespeeld: 0, gewonnen: 0 }, B: { gespeeld: 0, gewonnen: 0 } };
  const hulp = { A: 0, B: 0 };
  const redenen = {};
  let rondes = 0;
  for(const u of uitslagen){
    const w = winnaarVersie(u);
    if(w) winst[w]++;
    else redenen[u.reden] = (redenen[u.reden] || 0) + 1;
    alsZwart[u.zwart].gespeeld++;
    if(w===u.zwart) alsZwart[u.zwart].gewonnen++;
    hulp[u.zwart] += u.hulp.black;
    hulp[anderVan(u.zwart)] += u.hulp.red;
    rondes += u.rondes;
  }
  const onbeslist = n - winst.A - winst.B;

  console.log(`=== UITSLAG: A (${specA}) tegen B (${specB}), ${n} partijen ===`);
  console.log(`B wint      ${String(winst.B).padStart(4)}  (${procent(winst.B/n)})`);
  console.log(`A wint      ${String(winst.A).padStart(4)}  (${procent(winst.A/n)})`);
  console.log(`onbeslist   ${String(onbeslist).padStart(4)}  (${procent(onbeslist/n)})`);
  for(const reden in redenen) console.log(`   waarvan ${redenen[reden]}× ${reden}`);
  console.log(`Met zwart (begint): A won ${alsZwart.A.gewonnen} van ${alsZwart.A.gespeeld}, B won ${alsZwart.B.gewonnen} van ${alsZwart.B.gespeeld}`);
  console.log(`Gemiddeld ${(rondes/n).toFixed(1).replace('.', ',')} rondes per partij`);
  if(hulp.A || hulp.B){
    console.log(`Keuzes die de bot niet zelf kon maken (eerste optie genomen): A ${hulp.A}×, B ${hulp.B}×`);
  }

  const beslist = winst.A + winst.B;
  if(beslist){
    const [laag, hoog] = wilson(winst.B, beslist);
    console.log('');
    console.log(`Winstkans van B in de besliste partijen: ${procent(winst.B/beslist)}  (95%-marge: ${procent(laag)} tot ${procent(hoog)})`);
    if(laag > 0.5) console.log('Conclusie: B is sterker dan A. Het verschil is te groot om toeval te zijn.');
    else if(hoog < 0.5) console.log('Conclusie: A is sterker dan B. Het verschil is te groot om toeval te zijn.');
    else console.log('Conclusie: nog geen duidelijk verschil. Speel meer partijen voor een zekerder antwoord.');
  }
  if(Object.keys(redenen).some(r => r.startsWith('fout'))){
    console.log('\nLET OP: sommige partijen stopten door een fout in de spelcode. Die uitslag is minder betrouwbaar.');
  }
}

/* ======================= HOOFDPROGRAMMA ======================= */
async function hoofd(){
  const [partijenArg, specA = '6554e6a', specB = 'huidig', startArg] = process.argv.slice(2);
  let partijen = parseInt(partijenArg, 10) || 100;
  if(partijen % 2) partijen++;
  const startgetal = parseInt(startArg, 10) || 1;

  let codeA, codeB;
  try{
    codeA = spelcodeUit(leesVersie(specA));
    codeB = spelcodeUit(leesVersie(specB));
    laadVersie('A', codeA); // eenmaal proefladen, zodat een kapotte versie meteen een duidelijke fout geeft
    laadVersie('B', codeB);
  }catch(e){
    console.error('Kan niet starten: ' + e.message);
    process.exit(1);
  }

  const taken = [];
  for(let p=0; p<partijen/2; p++){
    taken.push({ paar: p+1, seed: startgetal + p, zwart: 'A' });
    taken.push({ paar: p+1, seed: startgetal + p, zwart: 'B' });
  }
  const aantalWerkers = Math.max(1, Math.min(os.cpus().length - 1, taken.length));

  console.log('Baarden bot-vergelijker');
  console.log(`A = ${specA}   B = ${specB}`);
  console.log(`${partijen} partijen (${partijen/2} ${partijen===2 ? 'paar' : 'paren'}), startgetal ${startgetal}, ${aantalWerkers} ${aantalWerkers===1 ? 'partij' : 'partijen'} tegelijk\n`);

  const uitslagen = [];
  process.on('SIGINT', () => {
    console.log('\nGestopt. Uitslag van de partijen die al klaar waren:');
    drukUitslag(uitslagen, specA, specB);
    process.exit(130);
  });

  const start = Date.now();
  await new Promise((klaar, mislukt) => {
    let volgende = 0, actief = 0;
    for(let w=0; w<aantalWerkers; w++){
      const werker = new Worker(__filename, { workerData: { codeA, codeB } });
      actief++;
      const geefTaak = () => {
        if(volgende < taken.length) werker.postMessage(taken[volgende++]);
        else werker.terminate();
      };
      werker.on('message', u => {
        uitslagen.push(u);
        drukRegel(u, uitslagen.length, taken.length);
        geefTaak();
      });
      werker.on('error', mislukt);
      werker.on('exit', () => { if(--actief===0) klaar(); });
      geefTaak();
    }
  });

  drukUitslag(uitslagen, specA, specB);
  console.log(`\nKlaar na ${((Date.now()-start)/1000).toFixed(0)}s.`);
}

if(isMainThread){
  hoofd().catch(e => { console.error(e); process.exit(1); });
}
