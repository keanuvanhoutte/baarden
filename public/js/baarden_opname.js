/*
 * Een gespeelde partij vastleggen, om achteraf te kunnen nakijken
 * ===============================================================
 *
 * Aan het eind van een partij tegen de AI verschijnt er een knop waarmee je de
 * hele partij naar het klembord kopieert. Die tekst plak je in
 * RL/importeer_partij.py, en daarna zegt RL/analyseer_partij.py per beurt wat
 * er gespeeld is en wat een diep zoekende bot gespeeld zou hebben.
 *
 * WAT ER VASTGELEGD WORDT, EN WAAROM ZO
 * Elke keer dat er een nieuwe stelling op het bord staat, gaat er een
 * momentopname in de lijst: het bord, beide handen, hold, gesneuvelden,
 * trek- en aflegstapels, fase, ronde, wie aan zet is. Precies de velden die
 * `naar_spelvorm()` in RL/js_spelvorm.py produceert, dus Python kan ze zonder
 * omweg inlezen.
 *
 * Er wordt NIET vastgelegd welke zet er gekozen is. Dat hoeft ook niet: Python
 * probeert vanuit stelling i alle geldige zetten en kijkt welke stelling i+1
 * oplevert. Zo hoeft er niets aan de spellogica veranderd te worden -- geen
 * haken in afterMove, geen actiecodering in de interface -- en kan de opname
 * het spel dus ook niet breken. De prijs is dat het afleiden in Python moet
 * gebeuren, en daar staat een proef op.
 *
 * DE VERBORGEN KAARTEN GAAN MEE
 * Beide handen en beide trekstapels worden opgeslagen. Dat mag hier: dit is
 * een verslag achteraf, geen invoer voor de bot tijdens het spelen. Zonder die
 * kaarten is een partij in Baarden niet na te spelen, want er wordt getrokken
 * en geschud.
 *
 * WAT DIT NIET DOET
 *   - Het legt niets vast van een online partij; alleen het spel tegen de AI.
 *   - Het legt geen tijden vast; hoe lang jij over een zet deed staat er niet in.
 *   - Het is geen opslag: ververs je de pagina, dan is de opname weg.
 */

(function (global) {
  'use strict';

  // De velden die Python verwacht. Alles wat hier niet in staat (de interface-
  // toestand, het logboek, de herhalingsteller) blijft er bewust buiten.
  const VELDEN = [
    'board', 'hold', 'blockReserve', 'draw', 'discard', 'fallen', 'destroyed',
    'hand', 'roundNumber', 'starter', 'turn', 'phase', 'actedThisPhase',
    'towerResetThisRound', 'towerBuild', 'reviveChoice',
  ];

  let opname = null;

  function kopie(waarde) {
    return waarde === undefined ? null : JSON.parse(JSON.stringify(waarde));
  }

  function momentopname(stand) {
    const uit = {};
    for (const veld of VELDEN) uit[veld] = kopie(stand[veld]);
    return uit;
  }

  /* Een goedkope vingerafdruk om te zien of de stelling veranderd is. Niet de
   * sleutel van het spel zelf (positionKey) -- die kijkt alleen naar het bord,
   * en wij willen ook een verandering in de hand of de hold zien. */
  function stempel(snap) {
    return JSON.stringify(snap);
  }

  function start(meta) {
    opname = { meta: meta || {}, stellingen: [], laatste: null, uitslag: null };
  }

  function bezig() { return opname !== null; }

  /* Aanroepen wanneer het spel opnieuw getekend is. Legt alleen vast als er
   * werkelijk iets veranderd is, dus hij mag zo vaak aangeroepen worden als
   * nodig. Gooit nooit: een kapotte opname mag nooit een partij verstoren. */
  function leg(stand) {
    if (!opname || !stand) return;
    try {
      const snap = momentopname(stand);
      const s = stempel(snap);
      if (s === opname.laatste) return;
      opname.laatste = s;
      opname.stellingen.push(snap);
      if (stand.winner) opname.uitslag = stand.winner;
    } catch (e) {
      /* stil: liever een onvolledige opname dan een verstoorde partij */
    }
  }

  function klaar() {
    return !!(opname && opname.uitslag);
  }

  function aantal() { return opname ? opname.stellingen.length : 0; }

  function inhoud() {
    if (!opname) return null;
    return {
      soort: 'baarden-partij',
      versie: 1,
      meta: opname.meta,
      uitslag: opname.uitslag,
      stellingen: opname.stellingen,
    };
  }

  function base64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  /* De partij als één regel tekst. Gecomprimeerd, want ruw is het al gauw een
   * paar honderd kilobyte en dat plakt niemand meer. Met gzip blijft er een
   * procent of drie van over. Kent de browser CompressionStream niet, dan gaat
   * hij ongecomprimeerd mee -- lelijk maar bruikbaar, en de kop zegt welke van
   * de twee het is zodat Python het uit elkaar houdt. */
  async function tekst() {
    const json = JSON.stringify(inhoud());
    if (typeof CompressionStream === 'undefined') {
      return 'BAARDEN1:plat:' + base64(new TextEncoder().encode(json));
    }
    const stroom = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stroom).arrayBuffer());
    return 'BAARDEN1:gzip:' + base64(bytes);
  }

  const api = { start, bezig, leg, klaar, aantal, inhoud, tekst };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BaardenOpname = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
