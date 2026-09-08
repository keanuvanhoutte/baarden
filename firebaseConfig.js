// firebaseConfig.js - Firebase Realtime Database via REST API
// This approach doesn't require loading the Firebase SDK, avoiding module/CDN issues

const firebaseConfig = {
  projectId: "baarden-f45cf",
  databaseURL: "https://baarden-f45cf-default-rtdb.europe-west1.firebasedatabase.app"
};

// Create window.firebaseDB with REST API
window.firebaseDB = {
  config: firebaseConfig,
  listeners: {}, // Track active listeners

  /**
   * Save game state to Firebase via REST API
   */
  async saveGameState(roomCode, state) {
    try {
      // Save directly to /rooms/{roomCode}/gameState.json
      const url = `${firebaseConfig.databaseURL}/rooms/${roomCode}/gameState.json`;
      // updatedAt laat de opruimer zien wanneer er voor het laatst gespeeld is. Het is een
      // server-tijdstempel: Firebase vult zelf zijn eigen klok in, zodat een toestel met een
      // verkeerd ingestelde tijd niet zorgt dat een kamer te vroeg of nooit verdwijnt.
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, updatedAt: { '.sv': 'timestamp' } })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✓ Saved state for room ${roomCode}`);
      return true;
    } catch (error) {
      console.error('✗ Save failed:', error);
      throw error; // Re-throw so caller knows it failed
    }
  },

  /**
   * Load game state from Firebase via REST API
   */
  async loadGameState(roomCode) {
    try {
      const url = `${firebaseConfig.databaseURL}/rooms/${roomCode}/gameState.json`;
      const response = await fetch(url);

      if (response.status === 404) {
        console.log(`Room ${roomCode} doesn't exist yet`);
        return null; // Room doesn't exist
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data === null) {
        console.log(`Room ${roomCode} exists but is empty`);
        return null;
      }

      console.log(`✓ Loaded state for room ${roomCode}`);
      return data;
    } catch (error) {
      console.error('✗ Load failed:', error);
      throw error; // Re-throw so caller knows it failed
    }
  },

  /**
   * Set up real-time listener for game state changes
   * Uses Server-Sent Events (SSE) for real-time updates
   */
  /**
   * Luistert naar wijzigingen in een kamer en roept callback aan met de volledige spelstand.
   *
   * Firebase duwt wijzigingen over een blijvende verbinding (server-sent events). Vroeger vroeg
   * deze functie elke 1,5 seconde de hele stand opnieuw op; een zet van de tegenstander werd dan
   * pas ergens tussen 0 en 1,6 seconde later zichtbaar, gemiddeld 0,8. Met duwen is dat ongeveer
   * 0,23 seconde, en even snel elke keer — dat gelijkmatige is wat een spel soepel laat aanvoelen.
   * Bovendien wordt er alleen nog data verstuurd als er echt iets verandert.
   *
   * Pollen blijft als vangnet bestaan: lukt de verbinding niet, dan schakelt hij daar vanzelf op
   * terug, zodat het spel het in elk geval doet.
   */
  onStateChange(roomCode, callback) {
    let luistert = true;
    let bron = null;
    let stopPollen = null;
    let ietsOntvangen = false;
    let fouten = 0;

    const meld = (state) => {
      if (!luistert || !state) return;
      ietsOntvangen = true;
      try { callback(state); }
      catch (e) { console.error('Callback error:', e); }
    };

    const valTerugOpPollen = (reden) => {
      if (!luistert || stopPollen) return;
      console.warn('Live verbinding werkt niet, terug naar pollen:', reden);
      if (bron) { try { bron.close(); } catch (e) {} bron = null; }
      stopPollen = this._pollGameState(roomCode, meld);
    };

    // Sommige gebeurtenissen melden enkel dát er iets veranderde, of veranderen maar een stukje.
    // Dan halen we gewoon de hele stand op: de rest van het spel verwacht een volledige stand.
    const haalVolledigeStand = async () => {
      try { meld(await this.loadGameState(roomCode)); }
      catch (e) { console.error('Ophalen na wijziging mislukt:', e); }
    };

    const verwerk = (event) => {
      if (!luistert) return;
      fouten = 0;
      let bericht = null;
      try { bericht = JSON.parse(event.data); } catch (e) { return; }
      if (!bericht) return;
      // Een PUT op de wortel bevat de volledige stand; dat is wat saveGameState schrijft, dus dit
      // is het normale geval en er hoeft niets extra opgehaald te worden.
      if (bericht.path === '/' && bericht.data && typeof bericht.data === 'object') meld(bericht.data);
      else haalVolledigeStand();
    };

    try {
      const url = `${firebaseConfig.databaseURL}/rooms/${roomCode}/gameState.json`;
      bron = new EventSource(url);
      bron.addEventListener('put', verwerk);
      bron.addEventListener('patch', verwerk);
      // De kamer werd verwijderd of de toegang ingetrokken: pollen merkt dat vanzelf weer op.
      bron.addEventListener('cancel', () => valTerugOpPollen('cancel'));
      bron.addEventListener('auth_revoked', () => valTerugOpPollen('auth_revoked'));
      bron.onerror = () => {
        // EventSource probeert zelf opnieuw te verbinden. Alleen als er nog nooit iets binnenkwam
        // en het blijft mislukken, gaan we ervan uit dat duwen hier niet werkt.
        fouten++;
        if (!ietsOntvangen && fouten >= 2) valTerugOpPollen('geen verbinding');
      };
    } catch (e) {
      valTerugOpPollen(e.message);
    }

    // Komt het toestel terug uit de achtergrond, dan kan de verbinding onderweg gesneuveld zijn
    // zonder dat we het merkten. Eén keer de stand ophalen haalt alles weer gelijk.
    const bijTerugkeer = () => { if (luistert && !document.hidden) haalVolledigeStand(); };
    document.addEventListener('visibilitychange', bijTerugkeer);

    return () => {
      luistert = false;
      document.removeEventListener('visibilitychange', bijTerugkeer);
      if (bron) { try { bron.close(); } catch (e) {} bron = null; }
      if (stopPollen) stopPollen();
    };
  },

  /** Het oude gedrag: elke 1,5 seconde de hele stand opvragen. Enkel nog als vangnet. */
  _pollGameState(roomCode, meld) {
    let luistert = true;
    let timer = null;
    let vorige = null;
    const poll = async () => {
      if (!luistert) return;
      try {
        const state = await this.loadGameState(roomCode);
        // Alleen melden als er echt iets veranderd is. Zonder deze vergelijking kreeg het spel elke
        // 1,5 seconde dezelfde stand opnieuw binnen, en kon een zet die net geanimeerd werd een
        // tweede keer als "nieuw" gezien worden — dan speelde dezelfde animatie dubbel af.
        const nu = state ? JSON.stringify(state) : null;
        if (nu && nu !== vorige) { vorige = nu; meld(state); }
      }
      catch (e) { console.error('Poll error:', e); }
      if (luistert) timer = setTimeout(poll, 1500);
    };
    setTimeout(() => poll().catch(e => console.error('Poll failed:', e)), 0);
    return () => { luistert = false; if (timer) clearTimeout(timer); };
  },

  /**
   * Remove listener for room
   */
  offStateChange(roomCode) {
    if (this.listeners[roomCode]) {
      this.listeners[roomCode].close();
      delete this.listeners[roomCode];
    }
  },

  /**
   * Create a new room with initial state
   */
  async createRoom(roomCode, initialState) {
    try {
      // Save gameState
      const urlState = `${firebaseConfig.databaseURL}/rooms/${roomCode}/gameState.json`;
      const responseState = await fetch(urlState, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...initialState, updatedAt: { '.sv': 'timestamp' } })
      });

      if (!responseState.ok) {
        throw new Error(`Failed to create gameState: HTTP ${responseState.status}`);
      }

      // Save metadata
      const urlMeta = `${firebaseConfig.databaseURL}/rooms/${roomCode}/metadata.json`;
      const responseMeta = await fetch(urlMeta, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createdAt: Date.now(),
          status: 'active'
        })
      });

      if (!responseMeta.ok) {
        throw new Error(`Failed to create metadata: HTTP ${responseMeta.status}`);
      }

      console.log(`✓ Created room ${roomCode}`);
      return true;
    } catch (error) {
      console.error('✗ Create room failed:', error);
      throw error; // Re-throw so caller knows it failed
    }
  },

  /**
   * Claim een kleur in een kamer, atomair.
   *
   * De zitplaatsen staan op een eigen pad (/rooms/CODE/seats) en worden bijgehouden per clientId,
   * niet als anonieme booleans. Dat lost twee dingen op:
   *
   *  - Herlaad je de pagina (of gooit je telefoon het tabblad weg), dan herken je jezelf aan je
   *    clientId en krijg je je eigen kleur terug in plaats van toeschouwer te worden.
   *  - Openen twee toestellen tegelijk dezelfde nieuwe kamer, dan kunnen ze niet allebei Rood
   *    worden. De schrijfactie gebruikt een if-match op de ETag, dus precies één wint; de ander
   *    krijgt 412 en probeert opnieuw tegen de verse waarde, en wordt dan Zwart.
   *
   * Geeft {color, seats} terug. color is null als beide plaatsen al door iemand anders bezet zijn.
   */
  async claimSeat(roomCode, clientId, maxAttempts = 6) {
    const url = `${firebaseConfig.databaseURL}/rooms/${roomCode}/seats.json`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const getRes = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' } });
      if (!getRes.ok) throw new Error(`Zitplaatsen lezen mislukt: HTTP ${getRes.status}`);
      // Bestaat het pad nog niet, dan geeft Firebase de body null met ETag "null_etag"; die ETag
      // is bruikbaar als if-match, zodat ook het allereerste claimen atomair verloopt.
      const etag = getRes.headers.get('ETag') || 'null_etag';
      const seats = (await getRes.json()) || {};

      let color = null;
      if (seats.red === clientId) color = 'red';
      else if (seats.black === clientId) color = 'black';
      else if (!seats.red) color = 'red';
      else if (!seats.black) color = 'black';

      if (!color) return { color: null, seats, full: true };
      if (seats[color] === clientId) return { color, seats, reclaimed: true };

      const next = { red: seats.red || null, black: seats.black || null };
      next[color] = clientId;

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'if-match': etag },
        body: JSON.stringify(next)
      });

      if (putRes.ok) return { color, seats: next };
      if (putRes.status !== 412) throw new Error(`Zitplaats claimen mislukt: HTTP ${putRes.status}`);
      // 412: iemand anders schreef net voor ons. Volgende ronde leest de verse waarde.
    }

    throw new Error('Zitplaats claimen mislukt na meerdere pogingen.');
  },

  /**
   * Werk een paar velden van de spelstand bij zonder de rest te overschrijven. Een volledige PUT
   * zou de zet die de tegenstander net deed kunnen wissen.
   */
  async patchGameState(roomCode, partial) {
    const url = `${firebaseConfig.databaseURL}/rooms/${roomCode}/gameState.json`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  },

  /**
   * Delete a room (cleanup)
   */
  async deleteRoom(roomCode) {
    try {
      const url = `${firebaseConfig.databaseURL}/rooms/${roomCode}.json`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log(`✓ Deleted room ${roomCode}`);
      return true;
    } catch (error) {
      console.error('✗ Delete room failed:', error);
      throw error;
    }
  }
};

console.log('✓ Firebase initialized for Baarden game (REST API)');
console.log(`Database URL: ${firebaseConfig.databaseURL}`);
