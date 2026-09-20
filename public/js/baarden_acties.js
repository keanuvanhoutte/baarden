/*
 * Van actienummer naar zet, en terug
 * ==================================
 *
 * Stap 3 van de brug. Het netwerk praat in nummers van 0 tot 214; jouw spel
 * praat in vakjes, handplekken en kaarten. Dit bestand vertaalt tussen die twee.
 *
 * WAT HIER BEWUST NIET IN ZIT: DE SPELREGELS.
 * Deze module weet niet wat mag. Ze zet alleen nummers om in zetten en zetten
 * om in nummers. Welke zetten toegestaan zijn blijft de taak van je spel zelf,
 * want dat is en blijft de baas over zijn eigen regels. Zou ik die regels hier
 * nabouwen, dan heb je twee versies van de waarheid die stilletjes uit elkaar
 * kunnen lopen -- en dat is precies het soort fout dat we hier al een week aan
 * het opruimen zijn.
 *
 * HET SPIEGELEN
 * Het netwerk leert altijd door de ogen van wie aan zet is: eigen toren op b2,
 * eigen kaarten onderaan. Speelt zwart, dan klapt het bord om (a<->g, b<->f,
 * c<->e) en draaien "boven" en "onder" ook nog eens om. Links en rechts niet.
 * Die ene regel -- alleen de verticale richtingen draaien mee -- is waar een
 * fout het gemakkelijkst in sluipt, en hij wordt in test_acties.js voor alle
 * 215 acties en beide kleuren nagerekend.
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

  const N_VAKJES = 21;
  const A_ZET = 0, A_LEG = 84, A_NAAR_HOLD = 147, A_HOLD_VELD = 150;
  const A_TOREN = 171, A_BLOK = 172, A_PAS = 193, A_HERLEEF = 194;
  const A_BOUWKEUZE = 207, N_ACTIES = 215;
  const BOUW_HAND = 0, BOUW_HOLD = 3, BOUW_BORD = 4;

  // Richtingen 0..3 = boven, onder, links, rechts. Zelfde volgorde als _DIRS
  // in baarden_game.py.
  const RICHTINGEN = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function buur(cel, d) {
    const r = RIJEN.indexOf(cel[0]) + RICHTINGEN[d][0];
    const k = parseInt(cel[1], 10) + RICHTINGEN[d][1];
    if (r < 0 || r > 6 || k < 1 || k > 3) return null;
    return RIJEN[r] + k;
  }

  const torenVakje = (kleur) => (kleur === 'red' ? 'b2' : 'f2');

  /* Nummer -> zet, in ECHTE spelcoordinaten (dus al teruggespiegeld). */
  function decodeer(a, kleur) {
    const spiegelen = (kleur === 'black');
    const echt = (cel) => (spiegelen ? SPIEGEL[cel] : cel);

    if (a < A_LEG) {
      const ci = Math.floor(a / 4), d = a % 4;
      const cel = echt(ALLE_VAKJES[ci]);
      const dd = (spiegelen && d < 2) ? (1 - d) : d;
      return { soort: 'zet', van: cel, naar: buur(cel, dd) };
    }
    if (a < A_NAAR_HOLD) {
      const k = a - A_LEG;
      return { soort: 'leg', slot: Math.floor(k / N_VAKJES),
               cel: echt(ALLE_VAKJES[k % N_VAKJES]) };
    }
    if (a < A_HOLD_VELD) return { soort: 'naarHold', slot: a - A_NAAR_HOLD };
    if (a < A_TOREN) {
      return { soort: 'holdNaarVeld', cel: echt(ALLE_VAKJES[a - A_HOLD_VELD]) };
    }
    if (a === A_TOREN) return { soort: 'torenOpwaarderen' };
    if (a < A_PAS) return { soort: 'blok', cel: echt(ALLE_VAKJES[a - A_BLOK]) };
    if (a === A_PAS) return { soort: 'pas' };
    if (a < A_BOUWKEUZE) {
      return { soort: 'herleef', rang: RANGEN[a - A_HERLEEF] };
    }
    const k = a - A_BOUWKEUZE;
    if (k === BOUW_HOLD) return { soort: 'bouwkeuze', bron: 'hold' };
    if (k < BOUW_HOLD) {
      return { soort: 'bouwkeuze', bron: 'hand', slot: k - BOUW_HAND };
    }
    let d = k - BOUW_BORD;
    if (spiegelen && d < 2) d = 1 - d;
    return { soort: 'bouwkeuze', bron: 'bord',
             cel: buur(torenVakje(kleur), d) };
  }

  /* Zet -> nummer. De weg terug, en dus de controle op de weg heen. */
  function codeer(zet, kleur) {
    const spiegelen = (kleur === 'black');
    const gespiegeld = (cel) => VAKJE_IDX[spiegelen ? SPIEGEL[cel] : cel];

    switch (zet.soort) {
      case 'zet': {
        const ci = gespiegeld(zet.van);
        // Welke richting was dit, in echte coordinaten?
        let d = -1;
        for (let i = 0; i < 4; i++) if (buur(zet.van, i) === zet.naar) d = i;
        if (d < 0) return null;
        const dd = (spiegelen && d < 2) ? (1 - d) : d;
        return A_ZET + ci * 4 + dd;
      }
      case 'leg':
        return A_LEG + zet.slot * N_VAKJES + gespiegeld(zet.cel);
      case 'naarHold':
        return A_NAAR_HOLD + zet.slot;
      case 'holdNaarVeld':
        return A_HOLD_VELD + gespiegeld(zet.cel);
      case 'torenOpwaarderen':
        return A_TOREN;
      case 'blok':
        return A_BLOK + gespiegeld(zet.cel);
      case 'pas':
        return A_PAS;
      case 'herleef':
        return A_HERLEEF + RANGEN.indexOf(zet.rang);
      case 'bouwkeuze': {
        if (zet.bron === 'hold') return A_BOUWKEUZE + BOUW_HOLD;
        if (zet.bron === 'hand') return A_BOUWKEUZE + BOUW_HAND + zet.slot;
        let d = -1;
        const toren = torenVakje(kleur);
        for (let i = 0; i < 4; i++) if (buur(toren, i) === zet.cel) d = i;
        if (d < 0) return null;
        const dd = (spiegelen && d < 2) ? (1 - d) : d;
        return A_BOUWKEUZE + BOUW_BORD + dd;
      }
      default:
        return null;
    }
  }

  /* Dezelfde tekst als describe_action() in Python, voor de controle. */
  function beschrijf(a) {
    if (a < A_LEG) {
      return `zet ${ALLE_VAKJES[Math.floor(a / 4)]} richting ${'ondlr'[a % 4]}`;
    }
    if (a < A_NAAR_HOLD) {
      const k = a - A_LEG;
      return `leg handkaart ${Math.floor(k / N_VAKJES)} op ` +
             `${ALLE_VAKJES[k % N_VAKJES]}`;
    }
    if (a < A_HOLD_VELD) return `handkaart ${a - A_NAAR_HOLD} naar hold`;
    if (a < A_TOREN) return `hold-kaart op ${ALLE_VAKJES[a - A_HOLD_VELD]}`;
    if (a === A_TOREN) return 'toren opwaarderen';
    if (a < A_PAS) return `blok-kaart op ${ALLE_VAKJES[a - A_BLOK]}`;
    if (a === A_PAS) return 'passen';
    if (a < A_BOUWKEUZE) return `herleef een ${RANGEN[a - A_HERLEEF]}`;
    const k = a - A_BOUWKEUZE;
    if (k === BOUW_HOLD) return 'opwaarderen met je hold-kaart';
    if (k < BOUW_HOLD) return `opwaarderen met handkaart ${k}`;
    const richting = ['boven', 'onder', 'links', 'rechts'][k - BOUW_BORD];
    return `opwaarderen met de kaart ${richting} van je toren`;
  }

  const api = {
    decodeer, codeer, beschrijf, buur, torenVakje,
    ALLE_VAKJES, SPIEGEL, RANGEN, N_ACTIES,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BaardenActies = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
