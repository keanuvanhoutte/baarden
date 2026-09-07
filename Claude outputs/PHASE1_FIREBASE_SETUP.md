# Phase 1: Firebase Infrastructure Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Project name: `baarden` (or your preference)
4. Enable Google Analytics: **NO** (not needed for MVP)
5. Click **"Create project"** and wait for initialization (~1 minute)

## Step 2: Set Up Realtime Database

1. In Firebase Console, go to **Build** → **Realtime Database**
2. Click **"Create Database"**
3. Choose region: **Europe (europe-west1)** (Brussels, closest to your timezone)
4. Security rules: Start with **Test Mode** (we'll update to production rules later)
5. Click **"Enable"**

Your database URL will look like: `https://baarden-xxx.firebaseio.com`

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon, top right)
2. Go to **Your apps** section
3. Click **"Add app"** → **Web** (</> icon)
4. App nickname: `baarden-game`
5. Check **"Also set up Firebase Hosting"**: **NO** (not needed yet)
6. Click **"Register app"**

You'll see a code block with your Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "baarden-xxx.firebaseapp.com",
  databaseURL: "https://baarden-xxx.firebaseio.com",
  projectId: "baarden-xxx",
  storageBucket: "baarden-xxx.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

**Copy and save these credentials** - you'll need them in Step 5.

## Step 4: Design & Initialize Database Structure

We'll use this structure in Realtime Database:

```
{
  "rooms": {
    "ABC1": {
      "gameState": {
        "players": {
          "red": true,
          "black": true
        },
        "board": {...},
        "hand": {...},
        ...
      },
      "metadata": {
        "createdAt": 1234567890,
        "createdBy": "red",
        "lastModified": 1234567890,
        "status": "active"
      }
    }
  }
}
```

**Initialize the database manually:**

1. In Realtime Database console, click **"Realtime Database"**
2. Click the **"three dots menu"** → **Import JSON**
3. Copy and paste this JSON:

```json
{
  "rooms": {
    ".read": "true",
    ".write": "true"
  }
}
```

4. Click **"Import"**

(We'll update security rules in Phase 1 conclusion)

## Step 5: Create Firebase Module (firebaseConfig.js)

Create a new file in your game directory: `firebaseConfig.js`

**Important**: Add your Firebase credentials from Step 3:

```javascript
// firebaseConfig.js
// Firebase configuration - REPLACE WITH YOUR CREDENTIALS FROM STEP 3
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "baarden-xxx.firebaseapp.com",
  databaseURL: "https://baarden-xxx.firebaseio.com",
  projectId: "baarden-xxx",
  storageBucket: "baarden-xxx.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get database reference
const database = firebase.database();

// Export for use in game
window.firebaseDB = {
  database: database,
  config: firebaseConfig,
  
  // Helper functions we'll expand in Phase 2
  async saveGameState(roomCode, state) {
    try {
      await database.ref(`rooms/${roomCode}/gameState`).set(state);
      console.log(`Saved state for room ${roomCode}`);
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
  },
  
  async loadGameState(roomCode) {
    try {
      const snapshot = await database.ref(`rooms/${roomCode}/gameState`).once('value');
      return snapshot.val();
    } catch (error) {
      console.error('Load failed:', error);
      return null;
    }
  },
  
  onStateChange(roomCode, callback) {
    return database.ref(`rooms/${roomCode}/gameState`).on('value', (snapshot) => {
      callback(snapshot.val());
    });
  },
  
  offStateChange(roomCode) {
    database.ref(`rooms/${roomCode}/gameState`).off('value');
  },
  
  async createRoom(roomCode, initialState) {
    try {
      await database.ref(`rooms/${roomCode}`).set({
        gameState: initialState,
        metadata: {
          createdAt: Date.now(),
          status: 'active'
        }
      });
      return true;
    } catch (error) {
      console.error('Create room failed:', error);
      return false;
    }
  }
};
```

## Step 6: Add Firebase SDK to HTML

In your `Baarden Game.html`, add these lines in the `<head>` section:

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js"></script>

<!-- Load Firebase config BEFORE your game script -->
<script src="firebaseConfig.js"></script>
```

**Important**: These must come BEFORE any code that uses Firebase.

## Step 7: Update Firebase Security Rules (Test Mode → Production)

1. In Realtime Database console, go to **Rules** tab
2. Replace everything with these rules:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true,
        "gameState": {
          ".validate": "newData.hasChildren(['players', 'board', 'hand', 'draw', 'discard', 'fallen', 'hold', 'blockReserve', 'round', 'starter', 'turn', 'phase'])"
        },
        "metadata": {
          ".validate": "newData.hasChildren(['createdAt', 'status'])",
          "createdAt": {
            ".validate": "newData.isNumber()"
          },
          "status": {
            ".validate": "newData.val() === 'active' || newData.val() === 'completed' || newData.val() === 'abandoned'"
          }
        }
      }
    }
  }
}
```

3. Click **"Publish"**

These rules:
- Allow anyone to read/write to any room (room code = access token)
- Validate gameState has required fields
- Validate metadata structure

## Step 8: Verification Checklist

- [ ] Firebase project created
- [ ] Realtime Database enabled in Europe region
- [ ] Firebase config credentials copied
- [ ] `firebaseConfig.js` created with your credentials
- [ ] Firebase SDK scripts added to HTML `<head>`
- [ ] Database initialized with `/rooms` path
- [ ] Security rules published
- [ ] No console errors when loading game (check Browser DevTools)

## Next Steps (Phase 2)

Once Phase 1 is verified, we'll:
1. Modify `saveState()` to use Firebase instead of localStorage
2. Modify `joinRoom()` to load state from Firebase
3. Remove the `state.rev` revision counter
4. Test basic save/load functionality

## Troubleshooting

**"Cannot find Firebase" error?**
- Make sure Firebase SDK scripts are in `<head>` BEFORE firebaseConfig.js
- Reload page (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)

**Database not appearing?**
- Reload Firebase Console
- Make sure you're in the correct project

**Permission denied error?**
- Check that security rules are published (should see green checkmark)
- Make sure database URL matches your config

**Need to reset?**
- Delete the entire database and create new one
- Or manually delete `/rooms` path from console
