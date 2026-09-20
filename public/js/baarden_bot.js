/*
 * De getrainde bot, klaar om in het spel te zetten
 * ================================================
 *
 * Stap 4a van de brug. Dit bestand brengt de drie bewezen stukken samen:
 *
 *   baarden_toestand.js  spelstand -> 233 getallen
 *   baarden_net.js       233 getallen -> 215 Q-waarden
 *   baarden_acties.js    actienummer <-> zet
 *
 * en voegt het enige toe dat nog ontbrak: welke zetten mogen er nu eigenlijk.
 *
 * DIE VRAAG BEANTWOORDT HET SPEL ZELF.
 * Deze module bouwt geen enkele spelregel na. Ze vraagt het aan de functies
 * die er al staan -- getLegalNormalMoves, computeTowerChain, isBlockBuried,
 * RED_TERRITORY -- en die zijn en blijven de baas. Zou ik de regels hier
 * overschrijven, dan had je twee versies van de waarheid die stil uit elkaar
 * groeien, en dat is precies het soort fout dat deze hele brug in stukken
 * geknipt is om te vermijden.
 *
 * Gevolg: alles wat de bot voorstelt is per definitie een zet die jouw spel
 * zelf toestaat. Hij kan nooit iets kiezen dat geweigerd wordt.
 */

(function (global) {
  'use strict';

  const Toestand = global.BaardenToestand;
  const Acties = global.BaardenActies;

  let net = null;
  let ladenBezig = null;

  /*
   * De haakjes naar het spel.
   *
   * Deze module bouwt geen enkele spelregel na: wat mag, vraagt ze aan het spel
   * zelf. Maar ze kan die functies niet zomaar oppikken. In JavaScript zet een
   * `const` of `let` op het hoogste niveau van een script NIETS op window --
   * alleen een `function` doet dat. RED_TERRITORY is een const, dus
   * global.RED_TERRITORY is undefined, en dan valt de hele lijst met
   * toegestane zetten stil zonder dat er iets kapot lijkt.
   *
   * Vandaar dat het spel zich hier uitdrukkelijk aanmeldt met koppelSpel().
   * Dat maakt meteen zichtbaar waar deze module precies van afhangt: zes
   * dingen, geen ervan een regel die hier overgeschreven wordt.
   */
  let S = {};
  function koppelSpel(spel) { S = spel || {}; }
  function uitSpel(naam) {
    return (S && S[naam] !== undefined) ? S[naam] : global[naam];
  }

  /* Het netwerk eenmalig inladen. 1,8 MB, dus dit doe je niet per zet. */
  async function laad(pad) {
    if (net) return net;
    if (ladenBezig) return ladenBezig;
    ladenBezig = (async () => {
      const bron = pad || 'js/baarden_net.json';
      const antwoord = await fetch(bron);
      if (!antwoord.ok) {
        throw new Error(`kon ${bron} niet laden (${antwoord.status})`);
      }
      net = new global.BaardenNet(await antwoord.json());
      return net;
    })();
    return ladenBezig;
  }

  const klaar = () => net !== null;

  /*
   * Alle zetten die nu mogen, als {actie, zet}-paren.
   *
   * De volgorde volgt die van legal_actions() in de Python-engine, zodat een
   * verschil meteen opvalt als we ze ooit naast elkaar leggen.
   */
  function toegestaneZetten(stand, kleur) {
    const uit = [];
    const voegToe = (zet) => {
      const a = Acties.codeer(zet, kleur);
      if (a !== null && a !== undefined) uit.push({ actie: a, zet });
    };

    // -- midden in een herleefkeuze ---------------------------------------
    if (stand.reviveChoice && stand.reviveChoice.color === kleur) {
      const rangen = new Set((stand.reviveChoice.options || []).map(c => c.rank));
      rangen.forEach(r => voegToe({ soort: 'herleef', rang: r }));
      voegToe({ soort: 'pas' });          // herleven afslaan mag
      return uit;
    }

    // -- midden in een toren-opbouw ----------------------------------------
    const kandidaten = stand.towerBuild && stand.towerBuild.pendingCandidates;
    if (kandidaten && kandidaten.length) {
      kandidaten.forEach((item, i) => {
        if (item.source === 'hand') {
          const slot = (stand.hand[kleur] || []).findIndex(c => c === item.card ||
            (c && item.card && c.id === item.card.id));
          voegToe({ soort: 'bouwkeuze', bron: 'hand',
                    slot: slot >= 0 ? slot : i });
        } else if (item.source === 'hold') {
          voegToe({ soort: 'bouwkeuze', bron: 'hold' });
        } else {
          voegToe({ soort: 'bouwkeuze', bron: 'bord', cel: item.cell });
        }
      });
      return uit;
    }

    const eigenZone = (kleur === 'red') ? uitSpel('RED_TERRITORY')
                                        : uitSpel('BLACK_TERRITORY');
    const vrij = eigenZone.filter(c => !stand.board[c]);

    // -- legfase -----------------------------------------------------------
    if (stand.phase === 'place') {
      const hand = stand.hand[kleur] || [];
      hand.forEach((_, slot) => {
        vrij.forEach(cel => voegToe({ soort: 'leg', slot, cel }));
      });
      if (!stand.hold[kleur]) {
        hand.forEach((_, slot) => voegToe({ soort: 'naarHold', slot }));
      }
      if (!stand.towerResetThisRound[kleur] &&
          uitSpel('computeTowerChain')(kleur, 'place').length) {
        voegToe({ soort: 'torenOpwaarderen' });
      }
      voegToe({ soort: 'pas' });
      return uit;
    }

    // -- bewegingsfase -----------------------------------------------------
    uitSpel('getLegalNormalMoves')(stand.board, kleur).forEach(z => {
      voegToe({ soort: 'zet', van: z.src || z.from, naar: z.dest || z.to });
    });

    if (stand.hold[kleur]) {
      vrij.forEach(cel => voegToe({ soort: 'holdNaarVeld', cel }));
    }

    if (!stand.towerResetThisRound[kleur] &&
        uitSpel('computeTowerChain')(kleur, 'move').length) {
      voegToe({ soort: 'torenOpwaarderen' });
    }

    // De blok-kaart: welke vakjes mogen, vraagt het spel zelf. getBlockTargets
    // is exact de lijst die placeBlockCard straks ook afdwingt, dus er kan hier
    // geen zet in de lijst komen die daar geweigerd wordt. Buiten het spel
    // (in een test onder node) bestaat die functie niet, en dan valt hij terug
    // op dezelfde regel, met de hand uitgeschreven.
    if (!uitSpel('isBlockBuried')(kleur)) {
      const doelen = uitSpel('getBlockTargets')
        ? uitSpel('getBlockTargets')(kleur)
        : Acties.ALLE_VAKJES.filter(cel => {
            const stapel = stand.board[cel];
            if (!stapel || !stapel.length) return false;
            const top = stapel[stapel.length - 1];
            if (top.owner === kleur) return false;
            return !(top.kind === 'tower' || top.kind === 'towerlayer' ||
                     top.kind === 'block');
          });
      doelen.forEach(cel => voegToe({ soort: 'blok', cel }));
    }

    if (!uit.length) voegToe({ soort: 'pas' });   // niets mogelijk: gedwongen
    return uit;
  }

  /*
   * Zwakker spelen zonder kapot te spelen.
   *
   * Het spel heeft vijf tegenstanders, van Bob tot Stefaan, en achter alle vijf
   * zit hetzelfde netwerk. Het verschil is hoe streng de bot zijn eigen oordeel
   * volgt: kans(zet) is evenredig met exp(Q(zet) / T).
   *
   *   T = 0     altijd de zet met de hoogste waarde. Stefaan.
   *   T groot   hij kiest uit alle TOEGESTANE zetten, met een voorkeur voor de
   *             goede, maar hij grijpt geregeld mis. Bob.
   *
   * Dit is bewust iets anders dan de oude "foutkans", die in een deel van de
   * beurten een volstrekt willekeurige zet deed. Zo'n bot offert zijn toren
   * zonder aanleiding, en dat voelt niet zwak maar kapot. Met een temperatuur
   * blijft hij altijd naar het bord kijken; hij is alleen minder zeker.
   *
   * Welke T bij welke trap hoort, is niet gegokt maar gemeten met
   * RL/niveau_ijking.py, tegen dezelfde tegenstanders die je spelers kenden.
   *
   * De hoogste Q gaat eraf voor de exp(). Zonder dat loopt exp(q/T) bij kleine
   * T over de rand van wat een getal aankan; aan de kansen verandert het niets.
   */
  function trekZacht(mogelijk, q, T) {
    let top = -Infinity;
    for (const m of mogelijk) if (q[m.actie] > top) top = q[m.actie];
    let som = 0;
    for (const m of mogelijk) {
      m.gewicht = Math.exp((q[m.actie] - top) / T);
      som += m.gewicht;
    }
    if (!(som > 0) || !isFinite(som)) return null;   // val terug op de beste
    let trek = Math.random() * som, loop = 0;
    for (const m of mogelijk) {
      loop += m.gewicht;
      if (trek <= loop) return m;
    }
    return mogelijk[mogelijk.length - 1];
  }

  /*
   * De rauwe Q-waarden voor een stand: 215 getallen, één per actie.
   *
   * Het zoeken heeft ze nodig om zetten te ordenen en om een blad te
   * beoordelen, en dat gaat per knoop. Zonder dit zou elke knoop de hele
   * kiesActie doorlopen en de lijst met toegestane zetten twee keer opbouwen.
   */
  function qWaarden(stand, opties) {
    if (!net) throw new Error('netwerk nog niet geladen; roep eerst laad() aan');
    opties = opties || {};
    return net.vooruit(Toestand.toestandsVector(stand, {
      herhaling: opties.herhaling || 0,
      maxRondes: opties.maxRondes || 120,
    }));
  }

  /*
   * De zet die de bot wil doen.
   *
   * Geeft { zet, actie, waarde, alles } terug, of null als er niets mag.
   * `alles` staat erbij zodat je in de console kan zien wat hij overwoog --
   * handig als hij iets onverwachts speelt.
   */
  function kiesActie(stand, kleur, opties) {
    if (!net) throw new Error('netwerk nog niet geladen; roep eerst laad() aan');
    opties = opties || {};

    const mogelijk = toegestaneZetten(stand, kleur);
    if (!mogelijk.length) return null;
    if (mogelijk.length === 1) {
      return { zet: mogelijk[0].zet, actie: mogelijk[0].actie,
               waarde: null, alles: mogelijk };
    }

    const x = Toestand.toestandsVector(stand, {
      herhaling: opties.herhaling || 0,
      maxRondes: opties.maxRondes || 120,
    });
    const q = net.vooruit(x);

    let beste = null, besteWaarde = -Infinity;
    for (const m of mogelijk) {
      m.waarde = q[m.actie];
      if (q[m.actie] > besteWaarde) { besteWaarde = q[m.actie]; beste = m; }
    }

    const T = opties.temperatuur || 0;
    const gekozen = (T > 0 ? trekZacht(mogelijk, q, T) : null) || beste;

    return { zet: gekozen.zet, actie: gekozen.actie, waarde: gekozen.waarde,
             besteWaarde,
             alles: mogelijk.slice().sort((a, b) => b.waarde - a.waarde) };
  }

  global.BaardenBot = { laad, klaar, kiesActie, toegestaneZetten, koppelSpel, qWaarden };
})(typeof globalThis !== 'undefined' ? globalThis : this);
