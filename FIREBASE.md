# Baarden — deployen naar Firebase

Het spel wordt geserveerd door **Firebase Hosting**; de online multiplayer
draait op de **Realtime Database** van hetzelfde project.

**Live:** https://baarden-f45cf.web.app
**Console:** https://console.firebase.google.com/project/baarden-f45cf/overview

---

## Automatisch deployen (GitHub Actions)

`.github/workflows/firebase-deploy.yml` zet bij **elke push naar `main`** de
inhoud van `public/` live. Je kan de workflow ook handmatig starten via
*Run workflow* op het Actions-tabblad.

Handmatig `firebase deploy` draaien blijft gewoon werken; de workflow is een
aanvulling, geen vervanging.

De database rules worden **niet** door de workflow uitgerold — er staat geen
`database.rules.json` in deze repo, die worden in de console beheerd. Wil je ze
mee in versiebeheer, zet ze dan in `firebase.json` onder `"database"` en breid
de deploy-stap uit naar `--only hosting,database`.

### Het service-account secret

GitHub Actions kan niet met je persoonlijke Firebase-login werken en heeft een
eigen service-account nodig. Ontbreekt dat secret, dan slaat de workflow zichzelf
netjes over in plaats van te falen.

1. Open de [Google Cloud Console → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=baarden-f45cf)
   voor het project `baarden-f45cf` en klik **Create service account**. Naam
   bijvoorbeeld `github-actions-deploy`.

2. Geef het deze rollen:

   | Rol | Waarvoor |
   |---|---|
   | Firebase Hosting Admin | het spel publiceren |
   | Service Usage Consumer | de CLI controleert welke API's aanstaan |

   Loopt een deploy toch vast op een rechtenfout, dan dekt de bredere rol
   **Firebase Admin** alles af. Rol je later ook database rules uit, voeg dan
   **Firebase Realtime Database Admin** toe.

3. Open het service-account → tabblad **Keys** → *Add key → Create new key →
   JSON*. Er wordt een `.json`-bestand gedownload.

4. Zet de volledige inhoud van dat bestand in een repository secret met de naam
   **`FIREBASE_SERVICE_ACCOUNT`**:

   ```bash
   gh secret set FIREBASE_SERVICE_ACCOUNT --repo keanuvanhoutte/baarden < pad/naar/key.json
   ```

   Of via GitHub: *Settings → Secrets and variables → Actions → New repository
   secret*, en de JSON erin plakken.

5. Verwijder het gedownloade `.json`-bestand van je computer. Het is een
   langlevende sleutel tot je Firebase-project; hij hoort enkel in het secret
   thuis. Raakt hij toch kwijt of op straat, verwijder dan de sleutel in de
   Cloud Console en maak een nieuwe aan.

Bij de eerstvolgende push naar `main` draait de deploy vanzelf.

---

## Handmatig deployen

Vereisten: [Node.js](https://nodejs.org) en de Firebase CLI
(`npm install -g firebase-tools`).

```bash
firebase login
firebase deploy --only hosting
```

## Let op: twee kopieën van het spel

`Baarden Game.html` en `public/index.html` zijn op dit moment byte-voor-byte
identiek, net als `firebaseConfig.js` en `public/firebaseConfig.js`. Er is geen
hook die de kopie maakt — bewerk je enkel de versie in de hoofdmap, dan deployt
de workflow een verouderde `public/`. Bewerk dus `public/`, of laat een
predeploy-hook de kopie maken.

## Bestanden

| Bestand | Rol |
|---|---|
| `public/index.html` | Wat Hosting serveert |
| `public/firebaseConfig.js` | Firebase-config en database-helpers |
| `firebase.json` | Hosting-configuratie |
| `.firebaserc` | Welk Firebase-project actief is (`baarden-f45cf`) |
| `.github/workflows/firebase-deploy.yml` | Automatische deploy bij elke push naar `main` |

## Lokaal testen

```bash
python -m http.server 8123 --directory public
```
