#!/usr/bin/env node
/**
 * Verwijdert kamers waarin al 48 uur niet meer gespeeld is.
 *
 * Waarom dit nodig is: niet om plaats te besparen — een kamer is ongeveer 3 KB, dus zelfs
 * honderden kamers vallen in het niet bij de 1 GB die Firebase gratis geeft. Het echte probleem is
 * hergebruik van codes. Blijft een oude kamer bestaan en typt iemand toevallig dezelfde code, dan
 * belandt hij in die oude, halfgespeelde partij; zijn de twee plaatsen daar al bezet, dan komt hij
 * binnen als toeschouwer en kan hij niet spelen.
 *
 * De ouderdom komt uit gameState/updatedAt, een server-tijdstempel dat bij elke zet wordt
 * bijgewerkt. Er wordt dus geteld vanaf de laatste zet, niet vanaf het aanmaken: een partij die
 * drie dagen loopt maar waarin vandaag nog gespeeld is, blijft staan. Ontbreekt updatedAt (kamers
 * van voor deze wijziging), dan valt hij terug op metadata/createdAt. Is er helemaal geen tijd te
 * vinden, dan blijft de kamer staan — liever iets te veel bewaren dan een lopend spel wissen.
 *
 * Gebruik:
 *   node scripts/kamers-opruimen.js --dry-run     toont enkel wat er zou verdwijnen
 *   node scripts/kamers-opruimen.js               ruimt echt op
 *   node scripts/kamers-opruimen.js --uren 72     andere drempel
 *
 * Werkt via de gewone REST-API zonder sleutel, wat kan omdat de database-regels nu open staan.
 * Worden die ooit dichtgezet, dan moet dit script een service-account-token gaan meesturen.
 */

const DB = process.env.BAARDEN_DB
  || 'https://baarden-f45cf-default-rtdb.europe-west1.firebasedatabase.app';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const urenIndex = args.indexOf('--uren');
const maxUren = urenIndex !== -1 ? Number(args[urenIndex + 1]) : 48;

if (!Number.isFinite(maxUren) || maxUren <= 0) {
  console.error('--uren verwacht een positief getal.');
  process.exit(2);
}

async function haal(pad) {
  const res = await fetch(`${DB}/${pad}.json`);
  if (!res.ok) throw new Error(`GET ${pad} gaf HTTP ${res.status}`);
  return res.json();
}

/** Wanneer is er voor het laatst iets gebeurd in deze kamer? null = onbekend. */
function laatsteActiviteit(kamer) {
  const uitState = kamer && kamer.gameState && kamer.gameState.updatedAt;
  if (typeof uitState === 'number') return uitState;
  const uitMeta = kamer && kamer.metadata && kamer.metadata.createdAt;
  if (typeof uitMeta === 'number') return uitMeta;
  return null;
}

async function main() {
  const alles = await haal('rooms');
  const codes = Object.keys(alles || {});

  if (codes.length === 0) {
    console.log('Geen kamers in de database.');
    return { verwijderd: [], behouden: [], onbekend: [] };
  }

  const grens = Date.now() - maxUren * 3600 * 1000;
  const teVerwijderen = [];
  const behouden = [];
  const onbekend = [];

  for (const code of codes) {
    const tijd = laatsteActiviteit(alles[code]);
    if (tijd === null) {
      onbekend.push(code);
      continue;
    }
    const urenGeleden = ((Date.now() - tijd) / 3600000).toFixed(1);
    if (tijd < grens) teVerwijderen.push({ code, urenGeleden });
    else behouden.push({ code, urenGeleden });
  }

  console.log(`${codes.length} kamer(s) gevonden, drempel ${maxUren} uur.`);
  for (const k of behouden) console.log(`  blijft    ${k.code}  (${k.urenGeleden} u geleden gespeeld)`);
  for (const c of onbekend) console.log(`  blijft    ${c}  (geen tijdstempel — voor de zekerheid bewaard)`);
  for (const k of teVerwijderen) console.log(`  ${dryRun ? 'zou weg ' : 'weg     '}  ${k.code}  (${k.urenGeleden} u geleden gespeeld)`);

  if (!dryRun) {
    for (const k of teVerwijderen) {
      const res = await fetch(`${DB}/rooms/${k.code}.json`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Verwijderen van ${k.code} gaf HTTP ${res.status}`);
    }
  }

  console.log('');
  console.log(dryRun
    ? `Proefdraai: ${teVerwijderen.length} kamer(s) zouden verdwijnen, ${behouden.length + onbekend.length} blijven staan.`
    : `${teVerwijderen.length} kamer(s) verwijderd, ${behouden.length + onbekend.length} blijven staan.`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = require('fs');
    const regels = [
      '### Kamers opruimen',
      '',
      `Drempel: ${maxUren} uur zonder zet.`,
      '',
      `- Verwijderd: **${dryRun ? 0 : teVerwijderen.length}**${dryRun ? ` (proefdraai, ${teVerwijderen.length} kwamen in aanmerking)` : ''}`,
      `- Blijven staan: **${behouden.length + onbekend.length}**`,
    ];
    if (teVerwijderen.length) {
      regels.push('', 'Betrokken kamers: ' + teVerwijderen.map(k => `\`${k.code}\``).join(', '));
    }
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, regels.join('\n') + '\n');
  }

  return { verwijderd: teVerwijderen, behouden, onbekend };
}

main().catch(err => {
  console.error('Opruimen mislukt:', err.message);
  process.exit(1);
});
