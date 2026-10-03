// account.js — inloggen met Google en de voortgang (XP) van een speler.
//
// Een account is optioneel: zonder inloggen speel je gewoon zoals altijd, je verdient alleen geen XP.
// Inloggen kan enkel met Google; er zijn geen anonieme accounts en geen wachtwoorden.
//
// Alleen het inloggen gebruikt de Firebase SDK. De voortgang zelf gaat, net als de kamers in
// firebaseConfig.js, over de REST-API van de database; het inlogbewijs (ID-token) gaat mee als
// ?auth=, en de databaseregels laten een speler enkel zijn eigen /spelers/{uid} lezen en schrijven.
//
// Dit bestand is een module en laadt dus pas na het spel zelf. Het spel praat ermee via
// window.baardenAccount en luistert naar het event 'baarden-account' op window, dat afgaat bij elke
// wijziging (in- of uitloggen, profiel geladen, XP erbij). Lukt het laden niet (geen internet,
// gstatic geblokkeerd), dan bestaat window.baardenAccount gewoon niet en speelt alles zonder account.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const DB = 'https://baarden-f45cf-default-rtdb.europe-west1.firebasedatabase.app';

// Het inlogvenster van Google keert terug naar /__/auth/handler op het authDomain. Staat dat op een
// ander domein dan het spel, dan blokkeren Safari en Chrome de opslag die het nodig heeft (derde
// partij), en mislukt vooral het inloggen via doorsturen. Firebase Hosting serveert die handler op
// elk eigen domein, dus op de live site gebruiken we gewoon het domein waarop je speelt.
const EIGEN_DOMEINEN = ['baarden-f45cf.web.app', 'baarden-f45cf.firebaseapp.com'];
const authDomain = EIGEN_DOMEINEN.includes(location.hostname) ? location.hostname : 'baarden-f45cf.firebaseapp.com';

const app = initializeApp({
  apiKey: 'AIzaSyDYNM8elo9Y6j5rfES28pzZOwy1OvCCo5M',   // publiek by design: identificeert enkel het project
  authDomain,
  projectId: 'baarden-f45cf',
  databaseURL: DB,
  appId: '1:1049561099321:web:3473a44b47debf6790f1e8',
});
const auth = getAuth(app);
auth.languageCode = 'nl';

/* ======================= XP EN NIVEAUS =======================
   Eén plek voor alle getallen, zodat de battlepass er later op kan bouwen. Alleen partijen tegen een
   echte tegenstander tellen: online, of tegen de AI. Een solopartij (beide kleuren zelf) levert niets
   op, anders klik je in twee minuten tien niveaus bij elkaar. */
const XP_PER_NIVEAU = 100;
const XP_REGELS = {
  online: { winst: 40, verlies: 15, gelijk: 20 },
  // Tegen de AI hangt winst af van de moeilijkheid (1 = Bob ... 5 = Stefaan): 15 tot 35 XP.
  ai:     { winst: (niveau) => 10 + 5 * niveau, verlies: 5, gelijk: 10 },
};

function xpVoor(modus, uitslag, aiNiveau){
  const regel = XP_REGELS[modus];
  if(!regel || !(uitslag in regel)) return 0;
  const xp = regel[uitslag];
  return typeof xp === 'function' ? xp(Math.max(1, Math.min(5, aiNiveau || 1))) : xp;
}

function niveauVan(xp){
  const totaal = Math.max(0, xp || 0);
  return {
    niveau: Math.floor(totaal / XP_PER_NIVEAU) + 1,
    inNiveau: totaal % XP_PER_NIVEAU,
    perNiveau: XP_PER_NIVEAU,
  };
}

/* ======================= DATABASE ======================= */
const leegProfiel = () => ({ xp: 0, partijen: { gespeeld: 0, gewonnen: 0, verloren: 0, gelijk: 0 } });

async function db(pad, opties = {}){
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${DB}/${pad}.json?auth=${encodeURIComponent(token)}`, {
    ...opties,
    headers: { 'Content-Type': 'application/json' },
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ======================= TOESTAND ======================= */
let gebruiker = null;   // { uid, naam, foto } of null
let profiel = null;     // { xp, partijen } of null zolang het nog laadt
let bezig = false;      // inlogvenster open
let fout = null;        // laatste foutmelding voor de speler, of null

function meld(){
  window.dispatchEvent(new CustomEvent('baarden-account'));
}

async function laadProfiel(uid){
  try{
    let p = await db(`spelers/${uid}`);
    if(!p){
      // Eerste keer: een leeg profiel aanmaken. 'aangemaakt' is de klok van Firebase zelf.
      p = leegProfiel();
      await db(`spelers/${uid}`, { method: 'PUT', body: JSON.stringify({ ...p, aangemaakt: { '.sv': 'timestamp' } }) });
    }
    if(gebruiker && gebruiker.uid === uid){
      profiel = { ...leegProfiel(), ...p, partijen: { ...leegProfiel().partijen, ...(p.partijen || {}) } };
      fout = null;
    }
  } catch(e){
    console.error('Profiel laden mislukt:', e);
    if(gebruiker && gebruiker.uid === uid) fout = 'Je voortgang kon niet geladen worden.';
  }
  meld();
}

onAuthStateChanged(auth, (u) => {
  gebruiker = u ? { uid: u.uid, naam: u.displayName || u.email || 'Speler', foto: u.photoURL || null } : null;
  profiel = null;
  meld();
  if(u) laadProfiel(u.uid);
});

// Kwam de speler terug van inloggen via doorsturen, dan pikt onAuthStateChanged dat op. Hier vangen
// we enkel een fout op, zodat die niet stil verdwijnt.
getRedirectResult(auth).catch((e) => {
  console.error('Inloggen via doorsturen mislukt:', e);
  fout = 'Inloggen is niet gelukt. Probeer het opnieuw.';
  meld();
});

/* ======================= PUBLIEKE KANT ======================= */
window.baardenAccount = {
  get gebruiker(){ return gebruiker; },
  get profiel(){ return profiel; },
  get bezig(){ return bezig; },
  get fout(){ return fout; },
  niveauVan,
  xpVoor,

  async inloggen(){
    if(bezig) return;
    bezig = true; fout = null; meld();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try{
      await signInWithPopup(auth, provider);
    } catch(e){
      const code = e && e.code;
      if(code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'){
        // Zelf weggeklikt: niets aan de hand.
      } else if(code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-environment'){
        // Geen pop-ups mogelijk (sommige browsers, of de app op het beginscherm van een iPhone):
        // dan via doorsturen. De pagina gaat weg en komt ingelogd terug.
        try{ await signInWithRedirect(auth, provider); return; }
        catch(e2){ console.error('Inloggen via doorsturen mislukt:', e2); fout = 'Inloggen is niet gelukt. Probeer het opnieuw.'; }
      } else {
        console.error('Inloggen mislukt:', e);
        fout = code === 'auth/network-request-failed'
          ? 'Geen verbinding. Controleer je internet en probeer opnieuw.'
          : 'Inloggen is niet gelukt. Probeer het opnieuw.';
      }
    } finally {
      bezig = false; meld();
    }
  },

  async uitloggen(){
    try{ await signOut(auth); } catch(e){ console.error('Uitloggen mislukt:', e); }
  },

  /**
   * Een partij is net afgelopen. Geeft meteen { xp, niveauOmhoog } terug (null als ze niet telt of je
   * niet ingelogd bent) en schrijft dat op de achtergrond weg.
   *
   * Het wegschrijven telt op met increment van de server, en niet als "lees, tel op, schrijf terug".
   * Zo gaat er niets verloren als je op twee toestellen tegelijk een partij afmaakt.
   *
   * modus: 'online' | 'ai';  uitslag: 'winst' | 'verlies' | 'gelijk';  aiNiveau: 1..5 (enkel bij ai)
   */
  partijAfgelopen({ modus, uitslag, aiNiveau }){
    if(!gebruiker) return null;
    const xp = xpVoor(modus, uitslag, aiNiveau);
    if(!xp) return null;
    const teller = { winst: 'gewonnen', verlies: 'verloren', gelijk: 'gelijk' }[uitslag];
    const uid = gebruiker.uid;
    const voorheen = profiel ? niveauVan(profiel.xp).niveau : null;

    // Meteen lokaal bijwerken, zodat het menu klopt zonder op de server te wachten.
    if(profiel){
      profiel.xp += xp;
      profiel.partijen.gespeeld++;
      profiel.partijen[teller]++;
      meld();
    }
    const plus = (n) => ({ '.sv': { increment: n } });
    db(`spelers/${uid}`, {
      method: 'PATCH',
      body: JSON.stringify({
        'xp': plus(xp),
        'partijen/gespeeld': plus(1),
        [`partijen/${teller}`]: plus(1),
        'bijgewerkt': { '.sv': 'timestamp' },
      }),
    }).catch((e) => {
      console.error('XP opslaan mislukt:', e);
      // Lokaal stond het er al bij; haal de echte stand terug, zodat het scherm niet liegt.
      if(gebruiker && gebruiker.uid === uid) laadProfiel(uid);
    });

    const nu = profiel ? niveauVan(profiel.xp).niveau : null;
    return { xp, niveauOmhoog: voorheen !== null && nu > voorheen ? nu : null };
  },
};
meld();
