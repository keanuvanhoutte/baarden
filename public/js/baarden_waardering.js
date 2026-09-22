/*
 * Het waarderingsnetwerk, in JavaScript
 * =====================================
 *
 * Eén getal per stelling: "hoe goed staat de speler die aan zet is?", tussen
 * -1 en +1. Dit vervangt evalBoardHeuristic() aan de bladeren van
 * minimaxSearch(); al het overige van de bot blijft zoals het was.
 *
 * Het is een gewoon meerlaags netwerk -- invoer 233, één verborgen laag van
 * 32, één uitvoer -- en dus veel kleiner dan het oude DQN-netwerk: 162 KB
 * tegenover 1,8 MB. Dat scheelt ook laadtijd in de browser.
 *
 * Er zit geen spel in dit bestand, met opzet. Getallen erin, één getal eruit.
 * Zo is te bewijzen dat de rekensom klopt zonder dat er borden of kaarten in
 * de weg zitten -- en als er straks iets misgaat, weet je dat het hier NIET
 * aan ligt. (Hetzelfde principe als baarden_net.js.)
 *
 * DE SCHAAL
 * Python geeft tanh(o); het spel rekent in de eenheden van
 * evalBoardHeuristic() (rond +-900). De omrekenfactor staat in `SCHAAL` en is
 * gemeten, niet gegokt: 366 is de verhouding tussen de spreiding van
 * evalBoardHeuristic en die van het netwerk over 40 000 stellingen. Zie de kop
 * van RL/stefaan_net.py.
 *
 * WAT DIT BESTAND NIET DOET
 *   - Het bouwt de toestandsvector niet; dat doet baarden_toestand.js.
 *   - Het weet niets van de zoekboom; dat doet het spel.
 */

(function (global) {
  'use strict';

  const SCHAAL = 366;

  function laad(blob) {
    if (!blob || blob.soort !== 'waardering') {
      throw new Error('baarden_waardering: geen waarderingsnetwerk');
    }
    const g = blob.gewichten;
    const lagen = [];
    // De sleutels heten net.0, net.2, net.4 ... (de oneven zijn de ReLU's).
    for (let i = 0; ; i += 2) {
      const w = g['net.' + i + '.weight'];
      const b = g['net.' + i + '.bias'];
      if (!w || !b) break;
      lagen.push({
        uit: w.length,
        in: w[0].length,
        // Plat in één Float32Array: rij r begint op r * in.
        w: Float32Array.from([].concat.apply([], w)),
        b: Float32Array.from(b),
      });
    }
    if (!lagen.length) throw new Error('baarden_waardering: geen lagen gevonden');
    if (lagen[0].in !== blob.invoer) {
      throw new Error('baarden_waardering: invoer klopt niet met de gewichten');
    }
    return { invoer: blob.invoer, lagen: lagen };
  }

  /* De ruwe uitvoer o. De waarde is tanh(o), de winstkans sigmoid(2o). */
  function ruw(net, vector) {
    if (vector.length !== net.invoer) {
      throw new Error('baarden_waardering: vector is ' + vector.length +
                      ' lang, verwacht ' + net.invoer);
    }
    let x = vector;
    for (let l = 0; l < net.lagen.length; l++) {
      const laag = net.lagen[l];
      const y = new Float32Array(laag.uit);
      for (let r = 0; r < laag.uit; r++) {
        const rij = r * laag.in;
        let som = laag.b[r];
        for (let c = 0; c < laag.in; c++) som += laag.w[rij + c] * x[c];
        // ReLU op alles behalve de laatste laag.
        y[r] = (l < net.lagen.length - 1) ? (som > 0 ? som : 0) : som;
      }
      x = y;
    }
    return x[0];
  }

  /* De waarde in -1..+1, vanuit de speler die aan zet is. */
  function waarde(net, vector) {
    return Math.tanh(ruw(net, vector));
  }

  /* Dezelfde waarde, in de eenheden waarin het spel rekent. */
  function waardeGeschaald(net, vector, schaal) {
    return waarde(net, vector) * (schaal === undefined ? SCHAAL : schaal);
  }

  const api = { laad, ruw, waarde, waardeGeschaald, SCHAAL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BaardenWaardering = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
