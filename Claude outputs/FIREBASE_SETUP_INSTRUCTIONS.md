# Phase 1 - Firebase Setup Complete! ✅

## Files Created

1. **firebaseConfig.js** - Your Firebase configuration with credentials and helper functions
2. **Baarden Game.html** - Your existing game HTML

## What You Need To Do Now

### Step 1: Copy firebaseConfig.js to Your Project

1. Go to your Baarden folder: `C:\Users\keanu\OneDrive\Documenten\Eigen creatie Games\Baarden`
2. Save the `firebaseConfig.js` file there (in the same folder as `Baarden Game.html`)

### Step 2: Add Firebase SDK Scripts to Your HTML

Open `Baarden Game.html` in a text editor and find the `<head>` section.

**Look for:**
```html
<title>Baarden</title>
<style>
```

**Add these scripts RIGHT AFTER the `<title>Baarden</title>` line:**

```html
<!-- Firebase SDK (add these three lines) -->
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js"></script>
<script src="firebaseConfig.js"></script>
```

**The result should look like:**
```html
<title>Baarden</title>
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js"></script>
<script src="firebaseConfig.js"></script>
<style>
  :root{
    --felt:#0b3d2e;
    ...
```

### Step 3: Verify Firebase is Connected

1. Open `Baarden Game.html` in your browser
2. Open **Developer Tools** (Press F12)
3. Go to the **Console** tab
4. You should see a green message: `✓ Firebase initialized for Baarden game`
5. You should also see the database URL displayed

**If you see errors:**
- Make sure `firebaseConfig.js` is in the same folder as `Baarden Game.html`
- Check that the script URLs match exactly
- Reload the page (Ctrl+R or Cmd+R)

## Your Firebase Credentials

Your project is all set up:
- **Project ID**: baarden-f45cf
- **Database URL**: https://baarden-f45cf-default-rtdb.europe-west1.firebasedatabase.app
- **Database Location**: Belgium (europe-west1) ✅
- **Web App**: baarden-game

## What's Next (Phase 2)

Once you've added the Firebase SDK to your HTML:
1. Test that Firebase loads (check console for ✓ message)
2. I'll modify the game code to use Firebase instead of localStorage
3. Game state will save to Firebase in real-time

## Need Help?

1. **Firebase scripts not loading?**
   - Make sure firebaseConfig.js is in the same folder as the HTML
   - Check browser console (F12 → Console tab) for errors
   - Try a hard reload (Ctrl+Shift+R or Cmd+Shift+R)

2. **Can't find where to add the scripts?**
   - Search for `<title>Baarden</title>` in your HTML file
   - Add the Firebase scripts right after that line
   - Save the file

3. **Testing the setup?**
   - You can now use `window.firebaseDB` in the browser console
   - Try: `window.firebaseDB.config` to see your Firebase config
   - Try: `await window.firebaseDB.loadGameState('TEST')` to test loading

## Quick Reference: Added Files

```
C:\Users\keanu\OneDrive\Documenten\Eigen creatie Games\Baarden\
├── Baarden Game.html (modified - add Firebase scripts to head)
├── firebaseConfig.js (new - place in same folder)
├── baarden-regels.md
├── baarden-spelregels.pdf
└── Baarden AI bot/
```

Let me know when you've added the scripts to the HTML and I'll proceed with Phase 2! 🚀
