# Trainingsschema — tegen de echte Stefaan

*Opgesteld 16 september 2026, nadat bleek dat alles daarvoor tegen de verkeerde tegenstander gemeten was.*

---

## Het uitgangspunt

De vorige training is niet mislukt door een fout in het leren. Ze is mislukt doordat de bot maandenlang tegen een tegenstander speelde die het halve spel niet kende. `baarden_benchmark.StefaanBot` zocht alleen over kaartverschuivingen — geen torens, geen hold, geen blok-kaart, voor geen van beide spelers — en ging ervan uit dat de spelers netjes om de beurt zijn, wat in Baarden niet klopt.

De bot leerde dus precies wat hij moest leren: hoe je die tegenstander verslaat. Dat was 83%. Tegen jouw echte AI is het 20%.

| | tegen de nabouw | tegen de echte AI |
|---|---|---|
| kaal netwerk | 63% | 6% |
| + vooruitkijken (diepte 2) | 83% | 20% |

**De regel die hieruit volgt, en die dit hele schema draagt: er wordt alleen nog getraind en gemeten tegen een tegenstander die bewezen hetzelfde speelt als het spel.**

Die bestaat nu: `RL/baarden_stefaan.py`. Op 400 echte stellingen kiest hij in 99,8% van de gevallen exact dezelfde zet als de AI in `index.html`, en in de bewegingsfase in 100%. Dat is geen inschatting maar een meting, en `js/test_stefaan.js` herhaalt ze wanneer je maar wil.

---

## Stap 0 — de nulmeting (30 minuten, vandaag)

Zonder eerlijk beginpunt weet je straks niet of er iets gebeurd is.

```
cd "C:\Users\keanu\OneDrive\Documenten\Eigen creatie Games\Baarden\RL"
python js_stefaan_dump.py
cd ..\js
node test_stefaan.js
```

Dit moet **GESLAAGD** geven, met minstens 98% dezelfde zetten. Zo niet: niet verder gaan. Een meetlat die je niet gecontroleerd hebt is precies wat ons hier gebracht heeft.

Daarna het echte beginpunt:

```
cd ..\RL
python zoek_volmeting.py --partijen 300 --dieptes 2
```

Verwacht: rond 6% voor het kale netwerk en rond 20% met vooruitkijken. Komt daar iets heel anders uit, dan wijkt de Python-meting af van de browsermeting en moeten we dát eerst uitzoeken.

---

## Stap 1 — de ladder op (de eerste nacht)

Meteen tegen Stefaan op volle diepte laten spelen werkt niet. De bot verliest dan vrijwel elke partij, krijgt in duizenden beurten nauwelijks een ander signaal dan "verloren", en leert niets. Maar een tegenstander die hij al vlot verslaat is net zo nutteloos: van partijen die je toch wint valt niets af te kijken.

**Waar de bot vandaag staat**, gemeten met `trap_meting.py` over 200 partijen per trap, zonder foutkans:

| diepte | score van het kale netwerk | |
|---|---|---|
| 1 | 70,5% | te makkelijk — overslaan |
| 2 | 28,0% | **hier beginnen** |
| 3 | 18,5% | te zwaar om mee te beginnen |
| 4 | 8,2% | te zwaar |

Diepte 1 valt dus af. Dat was geen inschatting maar een meting, en ze kwam er nadat je opmerkte dat Bob te willekeurig speelde om iets van te leren. Die opmerking legde meteen een fout in dit schema bloot: ik had de foutkans van 35% uit het spel klakkeloos overgenomen. In het spel dient die om Bob **menselijk zwak** te laten voelen; als leraar is het gewoon ruis, en dan leert de bot vooral hoe je ruis afstraft. De sparringpartner speelt nu zonder fouten.

**De trappen die overblijven:**

| trap | zoekdiepte | begint op | poort |
|---|---|---|---|
| George | 2 | 28% | 55% |
| Robert | 3 | 18,5% | 55% |
| Ferdinand / Stefaan | 4 | 8,2% | zo ver als het komt |

De eerste nacht:

```
python baarden_train.py --episodes 12000 --arch gestructureerd --begin-met rl_bot_in_het_spel.json --stefaan-sparring 0.4 --stefaan-diepte 2 --stefaan-every 250 --stefaan-partijen 400 --spiegel-partijen 200 --epsilon-min 0.05
```

*Alles op één regel. PowerShell kent de `^` van de oude opdrachtprompt niet en
breekt af met "unrecognized arguments"; daar is de backtick de voortzetting. Op
één regel werkt het in allebei.*

`--stefaan-diepte` gaat per trap omhoog: 2, dan 3, dan 4.

**`--begin-met` is niet optioneel.** Zonder die vlag begint de training met een
leeg netwerk. Dat is op 17-09 gebeurd: elf uur rekenen leverde 10,7% tegen
Stefaan(2) op, terwijl de bot die al op de schijf stond daar 28,0% haalt. Het
script waarschuwt nu luid als je vanaf nul begint terwijl er al getraind werk
staat, en maakt er een kopie van (`*.vorige`).

**Wat je bij de eerste meting hoort te zien.** De training begint vanaf een bot
die 28% haalt, dus de eerste regel `tegen STEFAAN` hoort daar in de buurt te
liggen. Staat hij na 250 of 500 episodes op 10%, dan breekt het sparren meer af
dan het opbouwt en stop je meteen — dan is er iets mis met de opzet, niet met
je geduld.

**40% sparren, geen 100%.** De rest blijft zelfspel en liga. Een bot die alleen tegen één tegenstander speelt, leert diens gewoontes uitbuiten in plaats van het spel te spelen — dat is dezelfde val als hiervoor, alleen subtieler.

**Twee poorten, en ze staan vooraf vast.** Om door te mogen naar de volgende trap moet hij allebei halen:

1. **55% tegen zijn eigen leraar.** Wie zijn leraar niet verslaat, is er niet klaar mee.
2. **Minstens 25% tegen de volgende trap**, te meten met `python trap_meting.py --partijen 200`. Anders is die volgende trap nog steeds te zwaar en herhaal je alleen het probleem waar dit schema omheen gebouwd is.

Haalt hij ze niet binnen 12000 episodes, dan stoppen we, kijken waarom, en passen iets aan. Een doel dat je achteraf verlaagt is geen doel.

---

## Tussenstand 18 september — waarom stap 1 nog niet gelopen heeft

Er zijn vier korte reeksen gedraaid om eerst één ding uit te sluiten, en die
hebben twee dingen opgeleverd.

**Wat opgelost is: de verkenning.** Met epsilon 0,20 en returns over acht zetten
was 83% van de leerdoelen vervuild, en zakte de bot binnen 250 episodes van 23%
naar 9%. Op de vloer (0,05) is dat weg: over 500 episodes bleef hij tussen 17%
en 28%, met een record van 28,0%.

**Wat níet opgelost is, en wat ik verkeerd gelezen heb.** Die reeks draaide met
`--stefaan-sparring 0`, dus zonder één partij tegen Stefaan. Ik had erbij gezet
dat het cijfer tegen Stefaan dan licht zou moeten stijgen — maar er was geen
mechanisme waardoor dat zou gebeuren. De proef beantwoordde zijn eigen vraag
(nee, het sparren was niet de oorzaak) en verder niets. Het vlakke resultaat is
dus géén bewijs dat er niet geleerd wordt.

**Wat er nu bijkomt, voor die vraag wél te kunnen beantwoorden.** Bij het begin
van elke reeks wordt een bevroren kopie van het startnetwerk apart gezet, en om
de zoveel episodes speelt de bot van nu daartegen, half rood half zwart:

```
          tegen STEFAAN:      W  26.0%  V  71.3%  R   2.7%
          tegen de STARTBOT:   58.5%   (rood 62%, zwart 55%)   hij leert
```

Die tweede regel zegt of er geleerd wordt. De eerste of het overdraagt. Blijft
de startbot op 50% staan, dan ligt het aan het leren zelf en heeft sleutelen aan
de tegenstander geen zin. Staat hij boven de 55% terwijl Stefaan vlak blijft,
dan is het een overdrachtsprobleem en hoort er gespard te worden.

**En de metingen worden groter.** 150 partijen geeft 4,0 procentpunt ruis; het
verschil tussen 17% en 28% dat ons drie dagen bezig hield, is daarmee nauwelijks
te scheiden van toeval. Vanaf nu 400 partijen (2,5 punt), en minder vaak.

### Twee verdachten die inmiddels afgevallen zijn

**Het hergebruik van de ervaringsbuffer.** Een trainingspartij duurt 69 zetten,
dus er komen 32 × 69 = 2.208 overgangen per episode bij, tegenover 200 × 64 =
12.800 trekkingen. Elke ervaring wordt dus ongeveer 5,8 keer gebruikt. Dat is
normaal (gangbaar is rond de 8). `--train-steps` blijft op 200.

**Het kleurverschil.** De lerende bot zit in de trainingslus altijd op rood,
terwijl de maatstaf hem de helft van de partijen zwart laat spelen. Gemeten met
`kleur_meting.py` over 200 partijen per kleur: rood 22,0%, zwart 25,0%. Drie
procentpunt, waar pas vanaf ongeveer 9,8 iets te zeggen valt. Geen probleem.

### De echte reeks van stap 1

```
python baarden_train.py --episodes 1000 --arch gestructureerd --begin-met rl_bot_in_het_spel.json --stefaan-sparring 0.4 --stefaan-diepte 2 --stefaan-every 250 --stefaan-partijen 400 --spiegel-partijen 200 --epsilon-min 0.05
```

Reken op anderhalf uur. Vier metingen: bij 250, 500, 750 en 1000.

**Wat deze reeks kan beantwoorden, en wat niet.** Hij kan beantwoorden of er
geleerd wordt (de startbot) en of 40% sparren dat naar Stefaan overdraagt. Hij
kan niet beantwoorden hoe sterk de bot in het échte spel is — dat is de browser,
met `js/meet_tegen_oude_ai.js`, en pas nadat er iets te meten valt.

### De uitslag (18 september): het trainen breekt hem af

| episode | tegen de startbot | tegen Stefaan |
|---|---|---|
| 0 | 50% (per definitie) | 25,8% |
| 250 | 32,8% | 14,0% |
| 500 | 27,0% | 13,0% |
| 750 | 24,0% | 13,5% |
| 1000 | 34,8% | 15,5% |

Geen twijfel mogelijk: bij 200 partijen is de ruis 3,5 punt, dus 24% tegen het
eigen startpunt zit zeven standaardfouten onder gelijkspel. Twee meters die niet
van elkaar afhangen zeggen hetzelfde, dus het is geen meetfout.

De startgewichten zijn niet weg: de nulmeting van 25,8% stond nog altijd als
record, dus `baarden_best_gestr.json` bevat het startnetwerk en
`rl_bot_in_het_spel.json` is nooit aangeraakt. Het spel speelt onveranderd door.

### De volgende proef: ligt het aan het sparren of aan de lus zelf?

Precies één knop om, en alleen deze:

```
python baarden_train.py --episodes 500 --arch gestructureerd --begin-met rl_bot_in_het_spel.json --stefaan-sparring 0 --stefaan-diepte 2 --stefaan-every 250 --stefaan-partijen 400 --spiegel-every 100 --spiegel-partijen 200 --epsilon-min 0.05
```

Een half uur. De leermeter loopt nu elke 100 episodes, want twee netwerken tegen
elkaar spelen gebundeld en dat is goedkoop — zo zien we ook *wanneer* de afbraak
begint in plaats van alleen dát hij er is.

- **blijft de startbot rond de 50%** → het sparren is de boosdoener, en dan gaat
  het over hoe er gespard wordt, niet over het leren;
- **zakt hij opnieuw naar 25-35%** → de trainingslus breekt het netwerk af
  ongeacht de tegenstander, en dan ligt het probleem daar.

Twee metingen onder de 40% stoppen de reeks nu vanzelf. Vorige keer liep hij een
uur door nadat het antwoord er al stond.

### De verdachte die daarbij hoort

Bij het sparren wordt ook **Stefaans eigen ketting opgeslagen en meegetraind**:
`self_play_batch` zet van elke partij beide kleuren in de buffer, ongeacht wie ze
gespeeld heeft. En de leerdoelen zijn n-staps returns over acht beurten: de
waarde van een zet komt uit de stelling die er acht beurten later staat. Bij
zelfspel zijn die acht beurten van de bot zelf; bij sparren zijn ze van Stefaan.
Een n-staps return hoort bij de speler die die zetten gespeeld heeft — daartussen
zit geen correctie.

Dat is een feit uit de code, geen vermoeden. Of het ook de OORZAAK is, zegt
alleen de proef hierboven.

## Stap 2 — leren van het vooruitkijken (alleen als stap 1 haalt)

Het vooruitkijken maakt de bot ruim twee keer zo sterk (10% → 20% tegen Stefaan). Dat betekent dat de zoeker stelselmatig betere zetten kiest dan het netwerk uit zichzelf — en juist die zetten zijn lesmateriaal.

De lus: laat de zoekende bot een paar duizend partijen spelen, bewaar bij elke beurt de stelling en de zet die het zoeken koos, en train het netwerk om die zet vanzelf te kiezen. Daarna zoekt de bot opnieuw, nu vanaf een beter netwerk, en herhaalt het.

Dit is hoe schaak- en go-programma's boven hun eigen beoordeling uitkomen. Het is ook de duurste stap: reken op twee tot drie dagen rekenen voor één ronde.

**Poort:** een ronde moet minstens 5 procentpunt opleveren tegen de echte Stefaan, gemeten over 300 partijen. Levert ze minder op, dan is het niet de moeite en stoppen we ermee.

---

## Welke meetlat waarvoor — vastgesteld 17 september

De nulmeting bracht nog een verschil aan het licht, en het is structureel:

**De Python-motor deelt kaarten automatisch uit** zodra een ronde eindigt; jouw
spel doet dat pas als de speler op "Trek kaarten" drukt. Steekt een zoekboom een
rondegrens over, dan verzint de Python-kant de volgende handen en beoordeelt hij
een stelling met kaarten die niemand heeft. De JavaScript-zoeker stopt daar.

Gemeten, tegen dezelfde echte oude AI:

| | Python | browser |
|---|---|---|
| kaal netwerk | 10,0% (300 partijen) | 6,3% (80 partijen) |
| + vooruitkijken (diepte 2) | 28,5% (300) | 20,0% (200) |

Het kale netwerk kijkt niet vooruit en steekt die grens dus nooit over — daar
zijn de twee het eens, binnen de ruis. De zoekende versie steekt hem elke ronde
over, en daar staat acht procentpunt tussen.

**De regel die daaruit volgt:**

- de sterkte van het **kale netwerk** meten we in Python. Dat is wat er tijdens
  het trainen groeit, en dat cijfer is te vertrouwen;
- de sterkte van de **zoekende** bot meten we in de browser, met
  `js/meet_tegen_oude_ai.js`. Dat is het echte spel, zonder verzonnen kaarten;
- de poorten in stap 1 gaan over het kale netwerk, dus die blijven in Python.

Dit is geen schoonheidsfoutje dat we voor het gemak wegschrijven. Het is
dezelfde soort fout als die ons hier gebracht heeft, alleen twintig keer
kleiner — en de manier om er niet nog eens in te lopen is hem opschrijven en er
een regel van maken in plaats van hem te vergeten.

---

## Stap 3 — nameten, ook in de browser

Python en de browser mogen niet uit elkaar lopen. Na elke mijlpaal:

```
cd RL
python js_export.py
cd ..\js
node test_net.js
node meet_tegen_oude_ai.js 80 5 gemengd
node meet_tegen_oude_ai.js 80 5 oud
```

De tweede regel is de controle: de oude AI tegen zichzelf hoort 50% te geven. Geeft die iets anders, dan meet de opstelling iets anders dan je denkt en zegt de eerste regel niets.

Vergeet `RL_NET_VERSIE` in `public/index.html` niet mee te verzetten, anders spelen mensen die het spel al openden tot een dag lang nog tegen het oude netwerk.

---

## Wanneer we het opgeven

Dit hoort erbij, want zonder afgesproken einde blijft zoiets eeuwig doorlopen.

We stoppen als **twee opeenvolgende maatregelen elk minder dan 3 procentpunt opleveren** tegen de echte Stefaan. Dan is de conclusie dat dit netwerk op deze manier niet verder komt, en gaan we niet nog een week rekenen in de hoop dat het vanzelf beter wordt.

Wat er dan overblijft is niet niks: de RL-bot is uitstekend geschikt voor de zwakke trappen. Een bot die minder zeker is van zijn zaak speelt veel natuurlijker dan een bot die in 35% van de beurten iets volstrekt willekeurigs doet. Dan wordt het de gemengde ladder: jouw AI bovenaan, de RL-bot onderaan.

---

## Wat ik je niet beloof

Van 20% naar 50% is een groot gat. Het vooruitkijken is al opgebruikt — diepte 3 leverde niets extra op, want de boom loopt tegen de legfase aan en daar kan hij niet doorheen kijken zonder de kaarten van de tegenstander te zien.

Wat er wél is: de bot heeft nog nooit één episode tegen een volwaardige tegenstander getraind. Alles wat hij kan, heeft hij geleerd van zichzelf en van een tegenstander zonder torens. Dat is echte ruimte. Hoeveel ervan bruikbaar is, weten we pas na stap 1 — en dat is precies waarom die poorten er staan.
