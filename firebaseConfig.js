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
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
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
  onStateChange(roomCode, callback) {
    // Firebase REST doesn't support real-time subscriptions via SSE well
    // So we'll use polling instead (fallback to 1.5s polling like before)
    let isListening = true;
    let pollTimeout = null;

    const poll = async () => {
      if (!isListening) return;

      try {
        const state = await this.loadGameState(roomCode);
        if (state && isListening) {
          try {
            callback(state);
          } catch (e) {
            console.error('Callback error:', e);
          }
        }
      } catch (e) {
        console.error('Poll error:', e);
      }

      // Schedule next poll only if still listening
      if (isListening) {
        pollTimeout = setTimeout(poll, 1500);
      }
    };

    // Start polling asynchronously to avoid blocking
    setTimeout(() => poll().catch(e => console.error('Poll failed:', e)), 0);

    // Return unsubscribe function
    return () => {
      isListening = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
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
        body: JSON.stringify(initialState)
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
