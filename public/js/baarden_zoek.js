/*
 * Vooruitkijken in de browser
 * ===========================
 *
 * Dit is de JavaScript-tweelingbroer van RL/baarden_zoeker.py.
 *
 * Wat het oplevert, gemeten in een echte browser op 16-09, tegen de oude AI uit
 * dit bestand op volle diepte: het kale netwerk haalt 6%, met twee zetten
 * vooruitkijken 20%. Rechtstreeks tegen elkaar wint de zoekende versie 78%.
 *
 * Eerdere cijfers van 63% en 83% stonden hier ook. Die zijn gemeten tegen een
 * nagebouwde Stefaan in Python die het halve spel niet kende. Het vooruitkijken
 * doet dus wel wat het moet doen -- de meetlat stond krom.
 *
 * DEZE MODULE KENT HET SPEL NIET. Ze krijgt een `spel`-adapter mee met zes
 * functies en rekent daarmee. Alle spelregels blijven in het spel zelf staan --
 * hetzelfde uitgangspunt als in baarden_bot.js, en om dezelfde reden: twee
 * versies van de waarheid groeien stil uit elkaar.
 *
 * DRIE DINGEN DIE HIER ANDERS MOETEN DAN IN EEN SCHAAKZOEKER
 *
 * 1. DE BEURT WISSELT NIET ALTIJD.
 *    Na een Boer-reset mag je herleven, en midden in een toren-opbouw kies je
 *    nog een kaart -- dan ben je twee keer na elkaar aan zet. Gewone negamax,
 *    die bij elke laag het teken omdraait, rekent daar fout. Daarom houdt deze
 *    zoeker de waarde altijd vanuit de WORTELSPELER aan, en kijkt hij per
 *    knoop wie er aan zet is: maximaliseren als hij het is, minimaliseren als
 *    de ander het is. Dezelfde val heeft de training eerder een nacht gekost.
 *
 * 2. DE LEG- EN TREKFASE BLIJVEN ERBUITEN.
 *    Daar zou de zoeker moeten weten welke kaarten de tegenstander in zijn
 *    hand heeft, en die zijn verborgen. Bereikt de boom zo'n stelling, dan
 *    stopt hij en laat het netwerk de stelling beoordelen.
 *
 * 3. HET TOEVAL MOET ERBUITEN BLIJVEN.
 *    In Python deelde game.clone() zijn toevalsgenerator met het echte spel:
 *    trok de zoeker ergens kaarten, dan schoof de ECHTE deling mee op, en hing
 *    de partij af van hoeveel er gerekend was. Hier is dat opgelost doordat de
 *    boom nooit in de trekfase komt -- dat is de enige plek waar dit spel
 *    schudt. Punt 2 dekt punt 3 dus af, en de adapter bewaakt het nog eens.
 */

(function (global) {
  'use strict';

  const ONEINDIG = Infinity;

  function Zoeker(spel, opties) {
    this.spel = spel;
    this.diepte = (opties && opties.diepte) || 2;
    this.maxKnopen = (opties && opties.maxKnopen) || 600;
    this.remiseWaarde = (opties && opties.remiseWaarde) || 0;
    this.knopen = 0;
    this.wortel = null;
  }

  /* Uitslag van een uitgespeelde partij, vanuit de wortelspeler gezien. */
  Zoeker.prototype.terminaal = function (stand) {
    const w = this.spel.winnaar(stand);
    if (!w || w === 'draw') return this.remiseWaarde;
    return (w === this.wortel) ? 1 : -1;
  };

  /*
   * Waarde van een stelling die niet verder bekeken wordt.
   *
   * Het netwerk geeft de waarde voor wie AAN ZET is. Is dat de tegenstander,
   * dan telt die waarde met een minteken mee. Dit is de regel die een gewone
   * negamax stilzwijgend aanneemt en die hier per knoop nagekeken moet worden.
   */
  Zoeker.prototype.blad = function (stand, q) {
    const mogelijk = this.spel.legaal(stand);
    if (!mogelijk.length) return 0;
    if (!q) q = this.spel.q(stand);
    let beste = -ONEINDIG;
    for (const m of mogelijk) if (q[m.actie] > beste) beste = q[m.actie];
    return (this.spel.aanZet(stand) === this.wortel) ? beste : -beste;
  };

  Zoeker.prototype.zoek = async function (stand, diepte, alfa, beta) {
    if (this.spel.klaar(stand)) return this.terminaal(stand);

    this.knopen++;
    if (diepte <= 0 || this.knopen >= this.maxKnopen) return this.blad(stand);
    if (this.spel.stopHier(stand)) return this.blad(stand);

    const mogelijk = this.spel.legaal(stand);
    if (!mogelijk.length) return this.blad(stand);

    // Eén netwerkaanroep per knoop, hergebruikt om de zetten te ordenen.
    // Goede zetten eerst betekent dat alfa-beta meer kan wegsnoeien.
    const q = this.spel.q(stand);
    mogelijk.sort((a, b) => q[b.actie] - q[a.actie]);

    const maximaliseren = (this.spel.aanZet(stand) === this.wortel);
    let beste = maximaliseren ? -ONEINDIG : ONEINDIG;

    for (const m of mogelijk) {
      const kind = await this.spel.stap(stand, m.zet);
      if (!kind) continue;
      const waarde = await this.zoek(kind, diepte - 1, alfa, beta);
      if (maximaliseren) {
        if (waarde > beste) beste = waarde;
        if (beste > alfa) alfa = beste;
      } else {
        if (waarde < beste) beste = waarde;
        if (beste < beta) beta = beste;
      }
      if (beta <= alfa) break;
      if (this.knopen >= this.maxKnopen) break;
    }

    if (beste === ONEINDIG || beste === -ONEINDIG) return this.blad(stand, q);
    return beste;
  };

  /*
   * Zwakker spelen, maar met dezelfde blik.
   *
   * De vijf tegenstanders in het spel kijken allemaal even ver vooruit. Wat ze
   * onderscheidt is hoe strikt ze hun eigen uitkomst volgen: kans(zet) is
   * evenredig met exp(waarde / T). Bij T=0 altijd de beste (Stefaan), bij een
   * hogere T geregeld de op een na beste (Bob).
   *
   * Dit is bewust dezelfde knop als in baarden_bot.js, maar nu op de waarden
   * NA het vooruitkijken. Daardoor betekent een trap op elk niveau hetzelfde:
   * evenveel nadenken, meer of minder zekerheid.
   */
  function trekZacht(wortels, T) {
    let top = -ONEINDIG;
    for (const w of wortels) if (w.waarde > top) top = w.waarde;
    let som = 0;
    for (const w of wortels) { w.gewicht = Math.exp((w.waarde - top) / T); som += w.gewicht; }
    if (!(som > 0) || !isFinite(som)) return null;
    let trek = Math.random() * som, loop = 0;
    for (const w of wortels) { loop += w.gewicht; if (trek <= loop) return w; }
    return wortels[wortels.length - 1];
  }

  /*
   * De zet kiezen.
   *
   * Geeft { zet, waarde, knopen, wortels } terug, of null als er niets te
   * kiezen valt. In de leg- en trekfase wordt er niet gezocht; daar beslist het
   * netwerk alleen, precies zoals in Python.
   */
  async function kies(stand, opties) {
    const spel = opties.spel;
    const T = opties.temperatuur || 0;
    const mogelijk = spel.legaal(stand);
    if (!mogelijk.length) return null;
    if (mogelijk.length === 1) {
      return { zet: mogelijk[0].zet, waarde: null, knopen: 0, gezocht: false };
    }
    if (spel.stopHier(stand)) return null;      // laat de beller het netwerk vragen

    const z = new Zoeker(spel, opties);
    z.wortel = spel.aanZet(stand);

    const q = spel.q(stand);
    mogelijk.sort((a, b) => q[b.actie] - q[a.actie]);

    const wortels = [];
    let besteZet = null, besteWaarde = -ONEINDIG, alfa = -ONEINDIG;
    for (const m of mogelijk) {
      const kind = await spel.stap(stand, m.zet);
      if (!kind) continue;
      const waarde = await z.zoek(kind, z.diepte - 1, alfa, ONEINDIG);
      wortels.push({ zet: m.zet, waarde });
      if (waarde > besteWaarde) {
        besteWaarde = waarde;
        besteZet = m.zet;
        // Snoeien in de wortel mag alleen als we straks toch de beste nemen.
        // Trekken we uit een verdeling, dan hebben we van ELKE zet de echte
        // waarde nodig; een gesnoeide zet levert alleen een bovengrens op en
        // zou de zwakke trappen stilletjes anders laten spelen dan gemeten.
        if (T <= 0 && waarde > alfa) alfa = waarde;
      }
    }
    if (!besteZet) besteZet = mogelijk[0].zet;

    const gekozen = (T > 0 && wortels.length > 1) ? trekZacht(wortels, T) : null;
    return {
      zet: gekozen ? gekozen.zet : besteZet,
      waarde: gekozen ? gekozen.waarde : besteWaarde,
      besteWaarde, knopen: z.knopen, gezocht: true, wortels,
    };
  }

  global.BaardenZoek = { kies };
})(typeof globalThis !== 'undefined' ? globalThis : this);
