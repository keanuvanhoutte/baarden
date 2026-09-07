// firebaseConfig.js
// Firebase configuration for Baarden game
// Project: baarden-f45cf

const firebaseConfig = {
  apiKey: "AIzaSyDa5DyMHweLgYG5Qrffs2kpz2Owy1QxCCGdM",
  authDomain: "baarden-f45cf.firebaseapp.com",
  databaseURL: "https://baarden-f45cf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "baarden-f45cf",
  storageBucket: "baarden-f45cf.appspot.com",
  messagingSenderId: "1049561099321",
  appId: "1:1049561099321:web:3473a4d847deb6799f1a8",
  measurementId: "G-6G0MM92OR07"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get database reference
const database = firebase.database();

// Export for use in game
window.firebaseDB = {
  database: database,
  config: firebaseConfig,

  /**
   * Save game state to Firebase
   * @param {string} roomCode - The room code (e.g., 'ABC1')
   * @param {object} state - The complete game state
   * @returns {Promise<boolean>} true if save succeeded
   */
  async saveGameState(roomCode, state) {
    try {
      await database.ref(`rooms/${roomCode}/gameState`).set(state);
      console.log(`✓ Saved state for room ${roomCode}`);
      return true;
    } catch (error) {
      console.error('✗ Save failed:', error);
      return false;
    }
  },

  /**
   * Load game state from Firebase
   * @param {string} roomCode - The room code (e.g., 'ABC1')
   * @returns {Promise<object|null>} The game state or null if not found
   */
  async loadGameState(roomCode) {
    try {
      const snapshot = await database.ref(`rooms/${roomCode}/gameState`).once('value');
      return snapshot.val();
    } catch (error) {
      console.error('✗ Load failed:', error);
      return null;
    }
  },

  /**
   * Set up real-time listener for game state changes
   * @param {string} roomCode - The room code (e.g., 'ABC1')
   * @param {function} callback - Callback function called when state changes
   * @returns {function} Unsubscribe function to stop listening
   */
  onStateChange(roomCode, callback) {
    const ref = database.ref(`rooms/${roomCode}/gameState`);
    ref.on('value', (snapshot) => {
      callback(snapshot.val());
    });

    // Return unsubscribe function
    return () => {
      ref.off('value');
    };
  },

  /**
   * Remove listener for room
   * @param {string} roomCode - The room code (e.g., 'ABC1')
   */
  offStateChange(roomCode) {
    database.ref(`rooms/${roomCode}/gameState`).off('value');
  },

  /**
   * Create a new room with initial state
   * @param {string} roomCode - The room code (e.g., 'ABC1')
   * @param {object} initialState - The initial game state
   * @returns {Promise<boolean>} true if create succeeded
   */
  async createRoom(roomCode, initialState) {
    try {
      await database.ref(`rooms/${roomCode}`).set({
        gameState: initialState,
        metadata: {
          createdAt: Date.now(),
          status: 'active'
        }
      });
      console.log(`✓ Created room ${roomCode}`);
      return true;
    } catch (error) {
      console.error('✗ Create room failed:', error);
      return false;
    }
  },

  /**
   * Delete a room (cleanup)
   * @param {string} roomCode - The room code (e.g., 'ABC1')
   * @returns {Promise<boolean>} true if delete succeeded
   */
  async deleteRoom(roomCode) {
    try {
      await database.ref(`rooms/${roomCode}`).remove();
      console.log(`✓ Deleted room ${roomCode}`);
      return true;
    } catch (error) {
      console.error('✗ Delete room failed:', error);
      return false;
    }
  }
};

console.log('✓ Firebase initialized for Baarden game');
console.log(`Database URL: ${firebaseConfig.databaseURL}`);
