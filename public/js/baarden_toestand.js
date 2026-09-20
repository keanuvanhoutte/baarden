/*
 * De toestandsvector, in JavaScript
 * =================================
 *
 * Stap 2 van de brug: de spelstand van Baarden Game.html omzetten naar de 233
 * getallen die het netwerk verwacht. Regel voor regel dezelfde volgorde als
 * state_vector() in baarden_game.py.
 *
 * DRIE DINGEN OM IN DE GATEN TE HOUDEN
 *
 * 1. ALLES IS VANUIT WIE AAN ZET IS.
 *    De bot leert altijd door de ogen van de speler aan zet: zijn toren staat
 *    op b2, zijn kaarten zijn positief. Is zwart aan zet, dan wordt het bord
 *    gespiegeld (a<->g, b<->f, c<->e, d blijft) en draaien de tekens om. Zit
 *    daar één fout in, dan speelt de bot met rood prima en met zwart als een
 *    kleuter -- en zoiets zie je pas na een paar partijen.
 *
 * 2. DE HAND VAN DE TEGENSTANDER ZIT ER NIET IN.
 *    Met opzet. Een bot die erin kan kijken leert vals spelen en stort in
 *    tegen een echte tegenstander.
 *
 * 3. TWEE WAARDEN KOMEN VAN BUITEN.
 *    De herhalingsteller (hoe vaak deze stelling al voorkwam) en de
 *    rondelimiet. Die haalt het spel uit positionCounts en zijn eigen
 *    instellingen; deze module rekent ze niet zelf uit, zodat hij zuiver
 *    testbaar blijft.
 */

(function (global) {
  'use strict';

  const RIJEN = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const ALLE_VAKJES = [];
  for (const r of RIJEN) for (const k of [1, 2, 3]) ALLE_VAKJES.push(r + k);

  const VAKJE_IDX = {};
  ALLE_VAKJES.forEach((c, i) => { VAKJE_IDX[c] = i; });

  const SPIEGEL = {};
  for (const c of ALLE_VAKJES) SPIEGEL[c] = RIJEN[6 - RIJEN.indexOf(c[0])] + c[1];

  const RANGEN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANG_IDX = {};
  RANGEN.forEach((r, i) => { RANG_IDX[r] = i; });
  const RANG_WAARDE = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, J: 11, Q: 12, K: 13, A: 14,
  };

  const MAX_WAARDE = 14;      // Aas
  const HAND_MAAT = 3;
  const N_RANGEN = 13;
  const N_VAKJES = 21;
  const BORD_KENMERKEN = 5;

  const ander = (k) => (k === 'red' ? 'black' : 'red');
  const torenVakje = (k) => (k === 'red' ? 'b2' : 'f2');

  function stapelVan(stand, cel) {
    const s = stand.board && stand.board[cel];
    return Array.isArray(s) ? s : [];
  }

  function torenWaarde(stand, kleur) {
    const st = stapelVan(stand, torenVakje(kleur));
    if (!st.length) return 0;
    return RANG_WAARDE[st[st.length - 1].rank] || 0;
  }

  function blokVakje(stand, kleur) {
    for (const cel of ALLE_VAKJES) {
      for (const p of stapelVan(stand, cel)) {
        if (p.kind === 'block' && p.owner === kleur) return cel;
      }
    }
    return null;
  }

  function blokBegraven(stand, kleur) {
    const cel = blokVakje(stand, kleur);
    if (cel === null) return false;
    const st = stapelVan(stand, cel);
    const top = st[st.length - 1];
    return !(top.kind === 'block' && top.owner === kleur);
  }

  /*
   * Kaarttellen: hoeveel kaarten van elke rang van `kleur` nog kunnen opduiken.
   * Alles wat zichtbaar is gaat eraf. Voor je EIGEN kleur tel je ook hand,
   * hold en aflegstapel mee -- dan blijft precies je trekstapel over. Voor de
   * tegenstander blijft zijn trekstapel, aflegstapel, hand en hold samen over,
   * en dat is wat een oplettende speler ook zou weten.
   */
  function nogInOmloop(stand, kleur, eigen) {
    const telling = new Float32Array(N_RANGEN);
    for (const r of RANGEN) telling[RANG_IDX[r]] = (r === '2') ? 1 : 2;

    for (const cel of ALLE_VAKJES) {
      for (const p of stapelVan(stand, cel)) {
        if (p.owner === kleur && (p.kind === 'normal' || p.kind === 'towerlayer')) {
          telling[RANG_IDX[p.rank]] -= 1;
        }
      }
    }
    for (const c of (stand.fallen && stand.fallen[kleur]) || []) {
      telling[RANG_IDX[c.rank]] -= 1;
    }
    for (const c of (stand.destroyed && stand.destroyed[kleur]) || []) {
      telling[RANG_IDX[c.rank]] -= 1;
    }
    if (eigen) {
      for (const c of (stand.hand && stand.hand[kleur]) || []) {
        telling[RANG_IDX[c.rank]] -= 1;
      }
      for (const c of (stand.discard && stand.discard[kleur]) || []) {
        telling[RANG_IDX[c.rank]] -= 1;
      }
      const h = stand.hold && stand.hold[kleur];
      if (h) telling[RANG_IDX[h.rank]] -= 1;
    }
    return telling;
  }

  /*
   * De hoofdfunctie.
   *
   *   stand      de state uit Baarden Game.html
   *   opties     { herhaling: hoe vaak deze stelling al voorkwam,
   *                maxRondes: de rondelimiet (standaard 120) }
   */
  function toestandsVector(stand, opties) {
    opties = opties || {};
    const herhaling = opties.herhaling || 0;
    const maxRondes = opties.maxRondes || 120;

    const kleur = stand.turn;
    const tegen = ander(kleur);
    const spiegelen = (kleur === 'black');

    const v = [];

    // -- het bord: 21 vakjes x 5 kenmerken --------------------------------
    const bord = new Float32Array(N_VAKJES * BORD_KENMERKEN);
    for (const cel of ALLE_VAKJES) {
      const stapel = stapelVan(stand, cel);
      if (!stapel.length) continue;
      const i = VAKJE_IDX[spiegelen ? SPIEGEL[cel] : cel];
      const top = stapel[stapel.length - 1];
      const teken = (top.owner === kleur) ? 1 : -1;
      const b = i * BORD_KENMERKEN;
      bord[b + 0] = teken * (RANG_WAARDE[top.rank] || 0) / MAX_WAARDE;
      bord[b + 1] = (top.kind === 'tower' || top.kind === 'towerlayer') ? 1 : 0;
      bord[b + 2] = (top.kind === 'block') ? teken : 0;
      // Een opgewaardeerde toren wordt tot tien hoog; die hoogte zegt niets
      // extra's want de torenwaarde gaat verderop apart mee. Verzadigen op 1.
      bord[b + 3] = Math.min(stapel.length, 5) / 5;
      if (stapel.length >= 2) {
        const onder = stapel[stapel.length - 2];
        bord[b + 4] = ((onder.owner === kleur) ? 1 : -1) *
                      (RANG_WAARDE[onder.rank] || 0) / MAX_WAARDE;
      }
    }
    for (let i = 0; i < bord.length; i++) v.push(bord[i]);

    // -- eigen hand: drie plekken, elk een one-hot over de rangen -----------
    const hand = (stand.hand && stand.hand[kleur]) || [];
    for (let s = 0; s < HAND_MAAT; s++) {
      for (let r = 0; r < N_RANGEN; r++) {
        v.push(s < hand.length && RANG_IDX[hand[s].rank] === r ? 1 : 0);
      }
    }

    // -- eigen hold volledig, van de tegenstander enkel of hij bezet is -----
    const eigenHold = stand.hold && stand.hold[kleur];
    for (let r = 0; r < N_RANGEN; r++) {
      v.push(eigenHold && RANG_IDX[eigenHold.rank] === r ? 1 : 0);
    }
    v.push(stand.hold && stand.hold[tegen] ? 1 : 0);

    // -- torenwaarden -------------------------------------------------------
    v.push(torenWaarde(stand, kleur) / MAX_WAARDE);
    v.push(torenWaarde(stand, tegen) / MAX_WAARDE);

    // -- blok-kaart van beide kanten ---------------------------------------
    for (const wie of [kleur, tegen]) {
      const cel = blokVakje(stand, wie);
      v.push(stand.blockReserve && stand.blockReserve[wie] ? 1 : 0);
      v.push(cel !== null ? 1 : 0);
      v.push(blokBegraven(stand, wie) ? 1 : 0);
    }

    // -- gesneuvelden: voor iedereen zichtbaar ------------------------------
    for (const wie of [kleur, tegen]) {
      const telling = new Float32Array(N_RANGEN);
      for (const c of (stand.fallen && stand.fallen[wie]) || []) {
        telling[RANG_IDX[c.rank]] += 1;
      }
      for (let r = 0; r < N_RANGEN; r++) v.push(telling[r] / 2);
    }

    // -- kaarttellen --------------------------------------------------------
    const eigenTelling = nogInOmloop(stand, kleur, true);
    for (let r = 0; r < N_RANGEN; r++) v.push(eigenTelling[r] / 2);
    const tegenTelling = nogInOmloop(stand, tegen, false);
    for (let r = 0; r < N_RANGEN; r++) v.push(tegenTelling[r] / 2);

    // -- stapelgroottes -----------------------------------------------------
    const lengte = (pot, wie) => (((stand[pot] || {})[wie]) || []).length;
    v.push(lengte('draw', kleur) / 25);
    v.push(lengte('discard', kleur) / 25);
    v.push(lengte('draw', tegen) / 25);
    v.push(lengte('discard', tegen) / 25);

    // -- fase en losse vlaggen ---------------------------------------------
    for (const f of ['draw', 'place', 'move']) v.push(stand.phase === f ? 1 : 0);

    const bezigMetBouwen = !!(stand.towerBuild &&
      stand.towerBuild.pendingCandidates &&
      stand.towerBuild.pendingCandidates.length);
    v.push(bezigMetBouwen ? 1 : 0);
    v.push(stand.reviveChoice && stand.reviveChoice.color === kleur ? 1 : 0);
    v.push(stand.towerResetThisRound && stand.towerResetThisRound[kleur] ? 1 : 0);
    v.push(stand.towerResetThisRound && stand.towerResetThisRound[tegen] ? 1 : 0);
    v.push(stand.actedThisPhase && stand.actedThisPhase[tegen] ? 1 : 0);
    v.push(stand.starter === kleur ? 1 : 0);
    v.push(herhaling / 3);
    v.push((stand.roundNumber || 1) / maxRondes);

    return Float32Array.from(v);
  }

  const api = {
    toestandsVector,
    ALLE_VAKJES,
    SPIEGEL,
    RANG_WAARDE,
    torenWaarde,
    nogInOmloop,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BaardenToestand = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
