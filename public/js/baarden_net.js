/*
 * Het getrainde netwerk, in JavaScript
 * ====================================
 *
 * Dit is stap 1 van de brug tussen de Python-bot en je spel: dezelfde rekensom
 * als GestructureerdNetwerk in baarden_rl.py, regel voor regel nagebouwd.
 *
 * Er zit geen spel in dit bestand en dat is met opzet. Getallen erin, getallen
 * eruit. Zo is te bewijzen dat de rekensom klopt zonder dat er ook maar iets
 * over borden of kaarten in de weg zit -- en als er straks iets misgaat, weet
 * je dat het hier NIET aan ligt.
 *
 * De vorm van het netwerk, kort:
 *   - de eerste 105 getallen zijn het bord: 21 vakjes x 5 kenmerken
 *   - de rest is context: hand, hold, torens, gesneuvelden, kaarttelling, fase
 *   - elk vakje krijgt een beschrijving uit (bordkenmerken + vakje-id + context)
 *   - twee mengrondes waarin elk vakje het gemiddelde van zijn buren meeneemt
 *   - vier koppen die per vakje scoren, plus een kop voor alles wat niet aan
 *     een vakje hangt
 *
 * Dezelfde gewichten gaan over alle 21 vakjes. Dat is precies waarom dit
 * netwerk zes keer kleiner is dan het vlakke en waarom het bestand dat je
 * spel moet inladen 1,8 MB is in plaats van 12.
 */

(function (global) {
  'use strict';

  function relu(v) {
    for (let i = 0; i < v.length; i++) if (v[i] < 0) v[i] = 0;
    return v;
  }

  /* y = W x + b, met W als [uit][in] zoals PyTorch hem opschrijft. */
  function lineair(W, b, x) {
    const uit = new Float32Array(W.length);
    for (let o = 0; o < W.length; o++) {
      const rij = W[o];
      let som = b ? b[o] : 0;
      for (let i = 0; i < rij.length; i++) som += rij[i] * x[i];
      uit[o] = som;
    }
    return uit;
  }

  class BaardenNet {
    constructor(pakket) {
      this.maten = pakket.maten;
      this.A = pakket.A;
      const g = pakket.gewichten;
      this.g = g;

      // De naamgeving volgt exact die van named_parameters() in Python.
      this.celId = g['cel_id'];
      this.ctx0W = g['context.0.weight']; this.ctx0b = g['context.0.bias'];
      this.ctx2W = g['context.2.weight']; this.ctx2b = g['context.2.bias'];
      this.celInW = g['cel_in.0.weight']; this.celInb = g['cel_in.0.bias'];
      this.meng1W = g['meng1.0.weight'];  this.meng1b = g['meng1.0.bias'];
      this.meng2W = g['meng2.0.weight'];  this.meng2b = g['meng2.0.bias'];
      this.zetW = g['kop_zet.weight'];    this.zetb = g['kop_zet.bias'];
      this.legW = g['kop_leg.weight'];    this.legb = g['kop_leg.bias'];
      this.holdW = g['kop_hold.weight'];  this.holdb = g['kop_hold.bias'];
      this.blokW = g['kop_blok.weight'];  this.blokb = g['kop_blok.bias'];
      this.gl0W = g['kop_globaal.0.weight']; this.gl0b = g['kop_globaal.0.bias'];
      this.gl2W = g['kop_globaal.2.weight']; this.gl2b = g['kop_globaal.2.bias'];

      const ontbreekt = [
        'cel_id', 'context.0.weight', 'context.2.weight', 'cel_in.0.weight',
        'meng1.0.weight', 'meng2.0.weight', 'kop_zet.weight', 'kop_leg.weight',
        'kop_hold.weight', 'kop_blok.weight', 'kop_globaal.0.weight',
        'kop_globaal.2.weight',
      ].filter((n) => !g[n]);
      if (ontbreekt.length) {
        throw new Error('gewichten ontbreken: ' + ontbreekt.join(', '));
      }
    }

    /* Eén toestandsvector erin, 215 Q-waarden eruit. */
    vooruit(x) {
      const M = this.maten;
      const N = M.vakjes, F = M.bordkenmerken, BB = M.bordbreedte;

      // -- context ---------------------------------------------------------
      const rest = new Float32Array(M.contextbreedte);
      for (let i = 0; i < M.contextbreedte; i++) rest[i] = x[BB + i];
      const context = relu(lineair(this.ctx2W, this.ctx2b,
        relu(lineair(this.ctx0W, this.ctx0b, rest))));

      // -- per vakje een beschrijving ---------------------------------------
      const inb = M.inbedding;
      const celBreedte = F + inb + context.length;
      let h = [];
      const buffer = new Float32Array(celBreedte);
      for (let c = 0; c < N; c++) {
        let k = 0;
        for (let f = 0; f < F; f++) buffer[k++] = x[c * F + f];
        for (let e = 0; e < inb; e++) buffer[k++] = this.celId[c][e];
        for (let e = 0; e < context.length; e++) buffer[k++] = context[e];
        h.push(relu(lineair(this.celInW, this.celInb, buffer)));
      }

      // -- twee mengrondes over de buren ------------------------------------
      h = this._meng(h, this.meng1W, this.meng1b);
      h = this._meng(h, this.meng2W, this.meng2b);

      // -- de koppen ---------------------------------------------------------
      const celLengte = h[0].length;
      const gem = new Float32Array(celLengte);
      for (let c = 0; c < N; c++) {
        for (let i = 0; i < celLengte; i++) gem[i] += h[c][i] / N;
      }
      const globIn = new Float32Array(context.length + celLengte);
      globIn.set(context, 0);
      globIn.set(gem, context.length);
      const glob = lineair(this.gl2W, this.gl2b,
        relu(lineair(this.gl0W, this.gl0b, globIn)));

      const zet = h.map((v) => lineair(this.zetW, this.zetb, v));   // [21][4]
      const leg = h.map((v) => lineair(this.legW, this.legb, v));   // [21][3]
      const hold = h.map((v) => lineair(this.holdW, this.holdb, v)[0]);
      const blok = h.map((v) => lineair(this.blokW, this.blokb, v)[0]);

      // -- samenvoegen in EXACT de actievolgorde van baarden_game.py ---------
      // Gaat hier iets door elkaar, dan stuurt het netwerk de verkeerde knop
      // aan bij de verkeerde zet, en dat geeft nergens een foutmelding.
      const uit = new Float32Array(M.acties);
      let p = 0;
      for (let c = 0; c < N; c++)                       //   0 .. 83  zetten
        for (let d = 0; d < 4; d++) uit[p++] = zet[c][d];
      for (let s = 0; s < 3; s++)                       //  84 ..146  leggen
        for (let c = 0; c < N; c++) uit[p++] = leg[c][s];
      for (let i = 0; i < 3; i++) uit[p++] = glob[i];    // 147 ..149  hand->hold
      for (let c = 0; c < N; c++) uit[p++] = hold[c];    // 150 ..170  hold->veld
      uit[p++] = glob[3];                                // 171  toren opwaarderen
      for (let c = 0; c < N; c++) uit[p++] = blok[c];    // 172 ..192  blok-kaart
      uit[p++] = glob[4];                                // 193  passen
      for (let i = 5; i < 18; i++) uit[p++] = glob[i];   // 194 ..206  herleven
      for (let i = 18; i < 26; i++) uit[p++] = glob[i];  // 207 ..214  bouwkeuze
      if (p !== M.acties) throw new Error('actievolgorde klopt niet: ' + p);
      return uit;
    }

    _meng(h, W, b) {
      const N = h.length, L = h[0].length;
      const uit = [];
      const samen = new Float32Array(L * 2);
      for (let c = 0; c < N; c++) {
        samen.set(h[c], 0);
        for (let i = 0; i < L; i++) samen[L + i] = 0;
        const rij = this.A[c];
        for (let b2 = 0; b2 < N; b2++) {
          const w = rij[b2];
          if (!w) continue;
          const hb = h[b2];
          for (let i = 0; i < L; i++) samen[L + i] += w * hb[i];
        }
        uit.push(relu(lineair(W, b, samen)));
      }
      return uit;
    }

    /* Beste toegestane actie. Ongeldige acties krijgen -oneindig, nooit nul:
       met een nul wint een ongeldige actie zodra alles wat mag negatief is. */
    besteActie(x, toegestaan) {
      const q = this.vooruit(x);
      let beste = null, besteWaarde = -Infinity;
      for (const a of toegestaan) {
        if (q[a] > besteWaarde) { besteWaarde = q[a]; beste = a; }
      }
      return { actie: beste, waarde: besteWaarde, q: q };
    }
  }

  const api = { BaardenNet: BaardenNet };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BaardenNet = BaardenNet;
})(typeof globalThis !== 'undefined' ? globalThis : this);
