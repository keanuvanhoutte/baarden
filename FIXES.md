# Fixlijst

Deze lijst is niet door de speler aangeleverd; er was geen `FIXES.md`. Hij is
samengesteld uit de problemen die tijdens het botonderzoek gemeten en
vastgelegd zijn (`RL/resultaten/SAMENVATTING.md`), plus een visuele controle van
het spel op telefoon- en pc-breedte.

Wat de controle NIET opleverde: het spel zelf is gezond. Alle negen proeven in
`js/` slagen, er zijn 0 console-fouten op 390px en 1280px, en de Python-motor
bouwt elke opgenomen stelling exact op (886 stellingen uit 8 partijen).

Statussen: `[ ]` open, `[x]` gefixt en gecontroleerd, `[?]` vraag aan gebruiker,
`[!]` mislukt / teruggedraaid, `[~]` niet reproduceerbaar of geen defect.

- [x] `importeer_partij.py` meldde in elke partij 1 tot 3 stellingen als "heropbouw wijkt af op towerBuild", terwijl bord, hand en kandidatenlijst gelijk waren | pagina: n.v.t. (gereedschap) | verwacht: 100% exacte heropbouw; de opname hangt `owner` en `kind` aan een opbouwkandidaat, Python niet, en `normaliseer()` haalde alleen `id` en `idx` weg
- [x] `analyseer_partij.py` rekent af in "procentpunt winstkans weggegeven" met een scheidsrechter van diepte 6, terwijl in de browser gemeten is dat diepte 6 NIET sterker is dan de diepte 4 van de bot (50,0% ±4,5) | pagina: n.v.t. (gereedschap) | verwacht: de uitvoer zegt duidelijk dat de scheidsrechter geen betere speler is, zodat de cijfers niet als oordeel gelezen worden | GEFIXT: de kop, de --diepte-hulptekst en de uitvoer zeggen nu dat de scheidsrechter een tweede mening is en geen betere speler
- [~] De drie constanten `zwakke_aanval_drempel`, `blok_eerste_drempel` en `blok_verleg_drempel` leken dode code: van 0 tot 20 verdraaien veranderde de uitslag niet | verwacht: uitzoeken of het pad bereikt wordt | UITKOMST: geen defect. Het pad wordt 137 keer per 6 partijen bereikt en de drempel verschuift het gedrag flink (blok-kaart gekozen in 26,8% bij drempel 0, 15,6% bij drempel 30). De keuzes in die marge zijn alleen ongeveer gelijkwaardig, dus de UITSLAG beweegt niet. Niets te repareren.
- [?] "Tegen AI" is alleen te vinden via lobby -> "Solo spelen" -> "🤖 Tegen AI". Een speler die tegen de bot wil spelen, klikt niet vanzelf op "Solo spelen" | pagina: lobby | vraag: is dat met opzet, of mag "Tegen AI" een eigen knop in de lobby krijgen? Ik verander geen navigatie zonder dat te vragen.
