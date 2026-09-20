# Wat er misging bij het trainen van de Baarden-bot

*Opgeschreven 17 september 2026, om tijd te winnen bij het volgende spel.*

Dit is geen zelfkastijding en geen logboek. Het is een lijst van fouten die elk
een paar uur tot een paar maanden gekost hebben, met per fout: wat er gebeurde,
hoe we het uiteindelijk vonden, en de regel die eruit volgt. Wie hetzelfde nog
eens bouwt, kan hiermee een groot deel overslaan.

De fouten staan op volgorde van wat ze gekost hebben, niet chronologisch.

---

## 0. Als je maar één ding meeneemt

**Meet tegen het echte ding, niet tegen je nabouw ervan — en bewijs dat je
nabouw klopt voor je hem gelooft.**

Bijna alle grote fouten hieronder zijn varianten van deze ene. De bot leert
precies wat je hem voorzet. Zet je hem een tegenstander voor die het halve spel
niet kent, dan wordt hij uitstekend in het verslaan van die tegenstander, en dat
ziet er op elke grafiek uit als vooruitgang.

---

# Deel 0b — De meting die er nooit was

## 0b.1 Meet eerst het spel, dan pas de bot

*18 september. Dit is achteraf de zwaarste fout van het hele project, zwaarder
dan de nagebouwde tegenstander.*

Het doel stond een jaar lang vast: "een bot die duidelijk sterker is dan
Stefaan". Niemand heeft ooit gemeten **hoeveel sterker je in dit spel
überhaupt kunt zijn**. Die meting kostte, toen ze er eindelijk kwam, vijftien
minuten rekenen met scripts die er al stonden.

`stefaan_rooster.py` laat elke zoekdiepte tegen elke andere spelen, 300
delingen per paar, en speelt **elke deling twee keer met gewisselde kleuren**
(uit het bridge geleend). Daardoor valt het toeval van de deling grotendeels
uit de vergelijking weg, én kun je zien wie de partij besliste: won dezelfde
bot allebei de keren, dan was het zijn sterkte; won dezelfde KANT allebei de
keren, dan was het de deling.

Score van de rij tegen de kolom:

| | willekeurig | Stefaan(1) | Stefaan(2) | Stefaan(3) | Stefaan(4) |
|---|---|---|---|---|---|
| **willekeurig** | — | 0,3% | 0,0% | 0,0% | 0,0% |
| **Stefaan(1)** | 99,7% | — | 24,8% | 20,2% | 20,3% |
| **Stefaan(2)** | 100% | 75,2% | — | 36,9% | 33,3% |
| **Stefaan(3)** | 100% | 79,8% | 63,1% | — | 46,2% |
| **Stefaan(4)** | 100% | 79,7% | 66,7% | 53,8% | — |

Elke extra halve zet vooruitkijken levert veel minder op dan de vorige: 75,2%
→ 63,1% → 53,8% tegen de trap eronder. Van diepte 3 naar 4 is nog maar 3,8
procentpunt, bij een onzekerheid van 1,7.

En wie besliste de partij, tussen twee ongeveer gelijke spelers?

| | sterkte besliste | de deling besliste | remise |
|---|---|---|---|
| Stefaan(2) vs (3) | 34,3% | 48,0% | 17,7% |
| Stefaan(3) vs (4) | 24,0% | 50,3% | 25,7% |

Tussen sterke spelers wordt de helft van de delingen beslist door de kaarten en
eindigt een kwart in remise. Ongeveer één op de vier partijen wordt beslist
door wie er beter speelde.

**En het dak, gemeten in plaats van doorgetrokken.** Diepte 4 is de sterkte die
in het spel zit. Daarboven:

| tegen Stefaan(4) | score | delingen |
|---|---|---|
| Stefaan(5) | 56,5% | 150 |
| Stefaan(6) | 58,5% ±2,0 | 200 |

Twee halve zetten extra vooruitkijken kosten ongeveer vijf keer zoveel rekenwerk
en leveren 8,5 procentpunt op. De stap van 5 naar 6 levert nog 2 punten, en dat
valt binnen de ruis — het zoeken is uitgewerkt. Het dak voor deze soort speler
ligt rond de 60% tegen de bot die er al is.

**Wat dat betekent.** Er is wél een echte vaardigheidsschaal — willekeurig
haalt 0% tegen alles, dus slecht spelen straft keihard af. Maar aan de bovenkant
is de schaal samengedrukt: boven de bot die al in het spel zit ligt in totaal
een procent of tien, en de helft van de partijen wordt sowieso door de kaarten
beslist.

**Het oorspronkelijke doel bestaat dus niet.** "Veel beter dan Stefaan" kan
niemand worden, geen netwerk en geen mens. Een jaar werk stond gericht op een
doel dat het spel niet toelaat. En de verhouding maakt het hard: er ligt
ongeveer 10 procentpunt boven de bestaande bot, terwijl de RL-bot er 30 onder
zit.

> **Regel.** Meet vóór je begint hoe groot het verschil tussen goed en perfect
> spelen in dit spel überhaupt is: laat je bestaande tegenstander op
> verschillende sterktes tegen zichzelf spelen, met elke deling twee keer en
> de kleuren gewisseld. Is de schaal samengedrukt, dan herschrijf je het doel
> — je verandert niet van methode.

## 0b.2 Een zoeker op oneven diepte speelt scheef

Bijvangst van dezelfde middag. Dezelfde bot op allebei de kanten, 300 delingen:

- Stefaan(2) tegen zichzelf: rood 47,7%, zwart 48,0%, remise 4,3% — in balans.
- Stefaan(3) tegen zichzelf: rood 31,3%, zwart 54,3%, remise 14,3% — scheef.

Het spel zelf is dus eerlijk; de **oneven zoekdiepte** is dat niet. Een boom die
op je eigen zet eindigt telt je laatste winst mee zonder het antwoord erop te
zien, en dat pakt voor de twee kanten verschillend uit. Wie een oneven diepte
als speelsterkte in zijn spel zet, geeft één kleur een voordeel dat niets met
het spel te maken heeft.

> **Regel.** Laat elke zoekende tegenstander één keer tegen zichzelf spelen en
> tel de kleuren. Komt daar geen 50/50 uit, dan zit de scheefheid in je zoeker,
> niet in je spel.

---

# Deel 1 — De meetlat

## 1.1 De tegenstander waar alles tegen gemeten werd, bestond niet

**Wat er gebeurde.** Het spel is JavaScript; de training is Python. Om te kunnen
meten is de spel-AI ("Stefaan") in Python nagebouwd. Die nabouw was een
benadering, en dat stond er eerlijk bij in de kop van het bestand. Vervolgens is
er vier maanden tegen gemeten alsof het het origineel was.

**Wat het kostte.** Alles. De bot haalde 63% tegen de nabouw en met
vooruitkijken 83%. Tegen de echte AI: 6% en 20%. Elke meting, elke poort, elke
"kampioen verslaat de vorige" — allemaal correct uitgevoerd tegen de verkeerde
tegenstander.

**Waar de nabouw tekortschoot.** Vier dingen, en het patroon is leerzaam:

1. zijn zoekboom kende maar één soort zet (kaarten verschuiven), geen torens,
   geen hold, geen blok-kaart — hij keek dus vier zetten vooruit in een spel
   waarin torens nooit groeien;
2. hij ging uit van om-de-beurt, terwijl in dit spel dezelfde speler bij elke
   rondewissel twee keer na elkaar beweegt;
3. een dreiging telde alleen als ze NU dodelijk was, niet na de volgende
   opwaardering;
4. de legfase en de blok-kaart misten hun eigen heuristiek.

Punt 1 is extra pijnlijk: exact dezelfde fout was een week eerder in ONZE eigen
zoeker gevonden en gerepareerd. Hij is daar hersteld en in de meetlat blijven
staan.

**Hoe we het vonden.** Door de vraag "is dit klaar om live te gaan?" niet met
een mening te beantwoorden maar met een proef: de oude AI stond nog in het
spelbestand als noodrem, dus de nieuwe bot kon er rechtstreeks tegen spelen.

> **Regel.** Speel je bot tegen het échte artefact dat hij moet verslaan, op dag
> één. Kan dat niet rechtstreeks, dan is een bewezen kopie het eerste wat je
> bouwt — niet het laatste.

> **Regel.** Een waarschuwing die je zelf in een bestandskop schrijft, beschermt
> je niet. Je leest hem één keer en daarna nooit meer. Zet er een proef op die
> faalt, of aanvaard dat je hem vergeet.

## 1.2 Consistent is niet hetzelfde als juist

Elke meting was intern consistent: 63% kaal, 83% met zoeken, een nette ladder,
examens tussen kampioenen. Precies die consistentie maakte het onzichtbaar. Een
systematisch verkeerde meetlat geeft geen ruis, hij geeft een keurige grafiek.

> **Regel.** Als alles klopt, controleer dan waar je tégen meet. Consistentie is
> een eigenschap van je meetopstelling, niet van de werkelijkheid.

## 1.3 Ongedekte hoeken die niemand opschrijft

Bij het herbouwen van de meetlat waren er drie dingen die de vergelijkingsproef
niet dekte (remise door herhaling, de afkoelperiode van de blok-kaart, de
keuzemenu's). Die zijn opgeschreven in de kop van het proefbestand. Twee ervan
bleken later echt fout te zitten — en ze waren binnen een half uur te vinden,
juist omdat ze opgeschreven stonden.

> **Regel.** Schrijf bij elke proef expliciet op wat hij NIET dekt. Dat is de
> lijst waar je als eerste kijkt als de cijfers niet kloppen.

## 1.4 Twee meetlatten die niet hetzelfde meten

De Python-motor deelt kaarten automatisch uit zodra een ronde eindigt; het spel
doet dat pas als de speler op een knop drukt. Een zoekboom die een rondegrens
oversteekt, beoordeelt in Python dus een stelling met verzonnen kaarten. Gevolg:
Python zei 28,5% waar de browser 20,0% zei.

Het kale netwerk kijkt niet vooruit en steekt die grens nooit over — daar waren
de twee het wél eens. Dat verschil tussen de twee gevallen was de aanwijzing.

> **Regel.** Als twee meetopstellingen structureel verschillen, leg dan vast
> welke waarvoor geldt, en waarom, op de plek waar iemand het gaat lezen.

## 1.5 Een controle in elke meting

In elke vergelijkende meting zit nu een controle: dezelfde bot tegen zichzelf
hoort 50% te geven. Die controle heeft twee keer een vals alarm afgevangen (een
"scheefheid" die bij 600 partijen gewoon 49,3% bleek) en zou een echte fout in
de opstelling meteen verraden hebben.

> **Regel.** Elke A-tegen-B-meting krijgt een A-tegen-A-controle. Geeft die geen
> 50%, dan zegt je hoofdmeting niets.

## 1.6 Steekproefgrootte

Er is drie keer een conclusie getrokken die bij een grotere steekproef omviel:
"diepte 1 doet bijna al het werk" (n=150, omgevallen bij n=500), een vermeende
scheefheid van 4 punten (weg bij n=600), en een verschil van 22 punten dat bij
n=30 puur ruis was.

De standaardfout van een winstpercentage met remises is ruwweg **49 / √n**
procentpunt. Bij 100 partijen is dat 5 punten; een verschil moet dan boven de 14
punten liggen voor je er iets over mag zeggen.

> **Regel.** Zet de onzekerheid ín de uitvoer van je meetscript, niet in je
> hoofd. Elk meetscript hier drukt hem nu af.

## 1.7 Twee verschillende vragen, één cijfer

*18 september.*

De training had maar twee meters, en geen van beide kon de vraag beantwoorden
die er op dat moment toe deed.

- **"tegen willekeurig"** stond al lang op 100%. Een meter die niet meer kan
  stijgen meet niets; hij staat er alleen nog om gerust te stellen.
- **"tegen Stefaan"** beantwoordt twee vragen tegelijk: *is het netwerk beter
  geworden?* én *draagt dat over naar een tegenstander waar het niet tegen
  speelt?* Blijft dat cijfer staan, dan weet je niet welke van de twee nee zei.

Daar zijn vier trainingsreeksen aan opgegaan, waarin het Stefaan-cijfer tussen
9% en 28% heen en weer sloeg met elke keer dezelfde onbeantwoorde vraag. Dat
verschil bepaalt of je aan de leerinstellingen sleutelt of aan de tegenstander.
Zonder aparte meter is dat raden, en raden kost een nacht per poging.

De oplossing is goedkoop en had er vanaf dag één moeten staan: bij het begin van
elke reeks wordt een **bevroren kopie** van het netwerk apart gezet, en om de
zoveel episodes speelt de bot van nu tegen die startbot. 50% betekent letterlijk
"even sterk als toen we begonnen". Twee netwerken tegen elkaar spelen gebundeld,
dus het kost een paar minuten per meting.

Twee dingen die erbij horen:

- **beide kleuren, half om half.** In Baarden wisselt de starter per ronde, dus
  rood en zwart zijn niet uitwisselbaar. Meet je maar één kant, dan meet je
  vooral het kleurverschil.
- **het vervangt de andere meter niet, het is een tweede.** De startbot zegt of
  er geleerd wordt, Stefaan of het overdraagt. Juist het VERSCHIL tussen die
  twee wijst aan waar het probleem zit.

> **Regel.** Zorg dat je één meter hebt die alleen "leert dit netwerk iets?"
> meet, los van elke tegenstander: de bot van nu tegen een bevroren kopie van
> waar hij begon. Zonder die meter kun je een vlak resultaat niet uit elkaar
> halen en ga je hyperparameters gokken.

---

# Deel 2 — De brug tussen twee talen

Het spel draait in JavaScript, de training in Python. Alles moest dus twee keer
bestaan. Dat is een fabriek voor stille fouten, en de aanpak die uiteindelijk
werkte was: **in stukken knippen en elk stuk apart bewijzen.**

## 2.1 De gelaagde proef

Voor het overzetten van de AI werkte deze opzet uitstekend:

| laag | wat je vergelijkt | resultaat |
|---|---|---|
| 1 | de bordwaardering, één getal per stelling | 300/300 gelijk |
| 1,5 | de zoekboom, één getal per zet | 212/212 gelijk |
| 2 | de uiteindelijk gekozen zet | 300/300 gelijk |

Faalt laag 2 maar klopt laag 1, dan weet je meteen dat het aan de keuzelogica
ligt en niet aan de waardering. Zonder die tussenlaag sta je te gissen.

Diezelfde opzet werd eerder gebruikt voor het netwerk zelf (rekensom →
toestandsvector → actiecodering), en ook daar wees hij de fout elke keer aan.

> **Regel.** Knip een overzetting in lagen en toets elke laag apart, van onder
> naar boven. De laagste falende laag is je fout.

## 2.2 Het gespiegelde actiestelsel

Het netwerk ziet het bord altijd vanuit de speler die aan zet is, dus voor zwart
worden alle vakjes gespiegeld (a↔g, b↔f, c↔e) en wisselen noord en zuid. De
overzetting rekende met de echte vakjes.

Gevolg: als zwart speelde de bot een **andere zet dan hij bedoelde**. Bijna
altijd een toegestane zet, dus geen foutmelding, geen uitzondering, geen spoor —
alleen zwakker spel. Dit alleen al kostte 30 procentpunt overeenstemming.

> **Regel.** Een coderingsafspraak die per speler verschilt, is de gevaarlijkste
> soort: fouten erin zijn legaal en dus onzichtbaar. Toets zwart en wit apart.

## 2.3 Een `const` staat niet op `window`

In JavaScript zet `function f(){}` op het hoogste niveau van een script wél iets
op `window`, maar `const` en `let` niet. De bot probeerde `global.RED_TERRITORY`
op te halen, kreeg `undefined`, en viel stilletjes terug op de oude AI.

De oplossing was niet een trucje maar een betere koppeling: het spel meldt zich
nu uitdrukkelijk aan bij de bot met de zes dingen waar die van afhangt. Dat is
meteen documentatie van de afhankelijkheden.

> **Regel.** Laat een module niet zelf rondgraaien in een globale ruimte. Geef
> hem expliciet wat hij nodig heeft; dan is de lijst ook meteen zichtbaar.

## 2.4 Kleine dingen die een halve dag kosten

- **`-Infinity` is geen geldige JSON.** Python schrijft het zonder klagen weg,
  `JSON.parse` struikelt erover. Gebruik `allow_nan=False` en vervang oneindig
  door een eindig getal.
- **Volgorde van kandidatenlijsten.** Twee implementaties die dezelfde keuze
  maken op basis van "de eerste die past", geven verschillende antwoorden als ze
  hun lijst anders opbouwen. Gelijkspel-regels zijn niet vrijblijvend.
- **Toestand die per partij hoort te bestaan, in een object dat langer leeft.**
  De bot onthield in welke ronde hij zijn blok-kaart verlegd had; dat veld
  overleefde de partij en verstoorde de volgende. Beter: waarnemen wat er op het
  bord veranderd is, in plaats van onthouden wat je besloten hebt.

---

# Deel 3 — Het trainen zelf

## 3.1 De training begon vanaf nul (elf uur)

Het trainingsscript begint standaard met een leeg netwerk. Het commando dat
gegeven werd had geen vlag om verder te gaan met de bestaande bot. Resultaat:
elf uur rekenen om op 10,7% te eindigen, terwijl de bot die al op de schijf
stond 28,0% haalde.

Erger: de reeks overschreef de checkpoint van een eerdere trainingsreeks van
32000 episodes. Die is weg. Wat het redde, was dat de beste gewichten een week
eerder onder een eigen naam waren weggezet (`rl_bot_in_het_spel.json`) en dus
buiten schot bleven.

**Wat er nu in het script staat:** een `--begin-met <gewichten>` vlag, en een
noodrem die bij elke niet-hervatte reeks eerst een kopie maakt (`*.vorige`) en
luid waarschuwt als je vanaf nul begint terwijl er al werk staat.

> **Regel.** Lees de standaardwaarden van het script voor je er een nacht in
> stopt. "Het draaide vannacht" is geen bewijs dat het deed wat je dacht.

> **Regel.** Kijk naar de eerste meetregel, niet naar de laatste. Begin je
> vanaf een bot die 28% haalt, dan hoort regel één daar in de buurt te liggen.
> Staat er 1,3%, stop dan meteen.

> **Regel.** Bewaar je beste resultaat onder een naam die geen enkel script
> automatisch overschrijft.

## 3.2 Een getraind netwerk met volle verkenning is zo weer leeg

Begin je vanaf bestaande gewichten maar laat je de verkenning op 1,0 staan, dan
speelt de bot duizenden episodes lang willekeurig en praat hij alles weg wat hij
wist. `--begin-met` zet de verkenning daarom meteen op 0,20.

## 3.2b n-staps returns en verkenning bijten elkaar

**Wat er gebeurde.** De training leert met returns over 8 zetten: de waarde van
een zet komt uit de stelling die er acht beurten later staat. Die acht zetten
speelt de bot zelf, met verkenningskans epsilon. Bij epsilon 0,20 is de kans dat
er minstens één willekeurige zet in dat venster zit **1 − 0,8⁸ = 83%**.

Vier op de vijf leerdoelen gingen dus over een reeks die de bot nooit zou spelen
als hij zijn best deed. Hij leerde niet "wat is deze zet waard", maar "wat is
deze zet waard als ik straks ergens blunder".

**Wat het kostte.** Twee trainingsreeksen. Vanaf een bot van 23% tegen de
maatstaf slingerde hij binnen 500 episodes tussen 9% en 25%, zonder vooruitgang.

**Hoe we het vonden.** Door één variabele te veranderen: dezelfde run zonder
sparringpartner. Die zakte net zo hard, dus de tegenstander was onschuldig en
bleef alleen de trainingsopzet over. Daarna in de code kijken in plaats van
gokken: `n_step = 8` en `epsilon = 0.20` staan honderd regels uit elkaar, maar
ze vermenigvuldigen.

**Het herkenningspunt:** hij bleef wél 100% van een willekeurige tegenstander
winnen. Daar heb je geen fijne afweging voor nodig. Grof spel blijft intact
terwijl de fijne afweging wegvalt — dat is het beeld van luidruchtige leerdoelen,
niet van een netwerk dat zijn kennis kwijtraakt. Een netwerk dat écht vergeet,
zakt ook tegen zwakke tegenstanders.

> **Regel.** Reken uit hoeveel van je leerdoelen vervuild zijn: met returns over
> n zetten en verkenningskans e is dat 1 − (1−e)ⁿ. Boven de 50% is je
> leersignaal grotendeels ruis. Verlaag e, verklein n, of corrigeer ervoor.

> **Regel.** Ga je verder met een getraind netwerk, zet de verkenning dan op de
> waarde waarbij dat netwerk gemaakt is — niet ergens daarboven "om wat te
> verkennen". Wat je verkent, praat je weg.

## 3.3 Eén knop voor twee dingen

`sparring_epsilon` regelde twee zaken tegelijk: verkenningsruis voor de
netwerk-sparringpartners (waar 10% zinnig is) en de foutkans van de
heuristische leraar (waar het schadelijk is). Een leraar die een tiende van zijn
zetten willekeurig speelt, leert de bot vooral hoe je ruis afstraft.

Dit kwam boven doordat de gebruiker opmerkte dat de zwakste tegenstander "te
willekeurig speelde om uit te leren". Dat was geen gevoel maar een diagnose.

> **Regel.** Eén instelling, één betekenis. Deelt je code een getal tussen twee
> doelen, dan is dat vroeg of laat een fout.

## 3.4 Een leerplan bouwen op aannames in plaats van metingen

Het eerste leerplan liep van de zwakste tot de sterkste tegenstander uit het
spel, met de foutkansen die daar horen. Dat was klakkeloos overgenomen: die
foutkansen bestaan om een tegenstander **menselijk zwak** te laten voelen, niet
om er iets van te leren.

Een meting van tien minuten liet zien dat de bot de zwakste trap al met 70,5%
verslaat — die trap leert hem dus niets — en dat alleen diepte 2 in het bruikbare
gebied lag (28%).

**De vuistregel die daaruit kwam:** een tegenstander is bruikbaar om tegen te
trainen als je bot er tussen de 25% en 60% tegen scoort. Wint hij vlot, dan valt
er niets af te kijken. Verliest hij bijna alles, dan krijgt hij in duizenden
beurten nauwelijks een ander signaal dan "verloren".

> **Regel.** Meet waar je bot staat tegen elke mogelijke leraar vóór je het
> leerplan schrijft. Dat kost tien minuten en bespaart nachten.

## 3.5 Poorten die vooraf vastliggen

Elke fase heeft nu een doel dat vóór de training vastligt, plus een tweede
voorwaarde: hij moet ook minstens 25% halen tegen de vólgende trap, anders is
die nog te zwaar en herhaal je het probleem.

> **Regel.** Een doel dat je achteraf verlaagt is geen doel. Schrijf het op voor
> je begint, inclusief wat je doet als hij het niet haalt.

## 3.6 Een proef die de vraag niet kón beantwoorden

*18 september.*

Om uit te zoeken of het sparren de training afbrak, is een reeks van 500
episodes gedraaid met `--stefaan-sparring 0`: alleen zelfspel en liga. Vooraf
had ik erbij gezet waar we naar zouden kijken — *"blijft hij rond de 23% of gaat
hij er licht boven?"*.

Dat was een verwachting die de proef niet waar kón maken. Met sparring op nul
speelt de bot geen enkele partij tegen Stefaan; er is dus geen enkele reden
waarom het cijfer tégen Stefaan zou moeten stijgen. De proef beantwoordde netjes
de vraag die hij stelde (breekt het sparren het af? nee — de instorting kwam van
de verkenning), maar ik had er een tweede vraag aan opgehangen die er niet in
zat, en las het vlakke resultaat als "hij leert niet".

Dit is dezelfde fout als 1.1, alleen aan de andere kant: daar mat ik tegen een
tegenstander die niet was wat ik dacht, hier las ik uit een proefopstelling een
antwoord dat er niet in kon zitten.

> **Regel.** Schrijf vóór de run op wélke vraag deze opstelling kan beantwoorden
> — en net zo hard welke niet. Verandert de knop die je omzet niets aan het
> mechanisme achter een cijfer, dan is dat cijfer geen uitslag van deze proef.

## 3.6b Twee getallen met dezelfde naam in de log

*18 september.*

In de trainingslog stond een kolom `plies`. Ik heb daar een rekensom op gebouwd
— hoeveel overgangen komen er per episode in de buffer, en dus hoe vaak wordt
elke ervaring hergebruikt — en daarmee een verdachte vrijgesproken.

Die kolom kwam uit de verkeerde partijen. Hij toonde de lengte van de
controlepartijen tegen een wíllekeurige tegenstander (27 zetten, want daar walst
de bot doorheen), niet van de trainingspartijen. Die laatste werd wel berekend
en in het statistiekenbestand weggeschreven, maar nergens getoond.

Het scheelt niet weinig. Bij 100 zetten per trainingspartij wordt elke ervaring
ongeveer 4 keer gebruikt — normaal. Bij 27 is dat 15 keer, en dan traint het
netwerk vooral op oude data en is `--train-steps` wel degelijk de knop.

> **Regel.** Een kolomkop is geen bewijs van wat eronder staat. Zoek de regel op
> waar het getal vandaan komt vóór je er een conclusie op bouwt — zeker als die
> conclusie een verdachte vrijspreekt.

## 3.7 De lerende bot zit altijd op dezelfde kleur

*18 september — gemeten, en het viel mee.*

In de speellus staat:

```python
agent = self if speler == 'red' else opponent
```

De lerende bot is dus altijd rood. Bij zelfspel geeft dat niets: zwart wordt
door hetzelfde netwerk gespeeld, dus beide kleuren komen in dezelfde buffer.
Maar zodra er gespard wordt, zit de leraar op zwart en komen alle zwarte beurten
uit zíjn hoofd.

De maatstaf doet het omgekeerde: `speel_duel(..., omkeren=True)` speelt de helft
van de partijen met gewisselde kleuren, juist om het kleurvoordeel eruit te
middelen. De helft van het eindcijfer gaat dus over een kleur waar minder mee
geoefend is.

Gemeten met `kleur_meting.py`, 200 partijen per kleur tegen Stefaan(2): rood
22,0%, zwart 25,0%. Drie procentpunt verschil, terwijl er bij deze
steekproefgrootte pas vanaf ongeveer 9,8 punt iets te zeggen valt. **Deze
verdachte valt af** — en dat is precies waar zo'n proef voor dient: hij kostte
een halve minuut rekenen en één verdachte minder om over te piekeren.

Het staat hier ook als hij niets opleverde, want de vorige keer dat zo'n
asymmetrie ongemeten bleef (1.1) heeft dat maanden gekost. Een negatieve uitslag
is geen weggegooide proef; een ongestelde vraag wel.

> **Regel.** Kijk expliciet na op welke kant van het bord je bot traint en op
> welke kant je hem meet. Zijn dat niet dezelfde, dan is dat een hypothese die
> je meet, niet een detail dat je aanneemt.

## 3.8 De meter die meteen loonde

*18 september.*

De eerste reeks mét de leermeter, 1000 episodes, 40% sparren tegen Stefaan(2):

| episode | tegen de startbot | tegen Stefaan |
|---|---|---|
| 0 | 50% (per definitie) | 25,8% |
| 250 | 32,8% | 14,0% |
| 500 | 27,0% | 13,0% |
| 750 | 24,0% | 13,5% |
| 1000 | 34,8% | 15,5% |

Bij 200 partijen is de ruis 3,5 procentpunt, dus 24% tegen het eigen startpunt
ligt zeven standaardfouten onder gelijkspel. Het trainen maakte de bot niet
beter en ook niet gelijk: het **brak hem af**, en de twee meters zeggen het
onafhankelijk van elkaar hetzelfde. Dat die twee overeenkomen is het bewijs dat
het geen meetfout is.

Twee dingen zijn hier de moeite waard, los van de uitkomst.

**De vorige vier reeksen zeiden dit ook al, maar onleesbaar.** Het cijfer tegen
Stefaan slingerde tussen 9% en 28% en we vroegen ons elke keer af of dat leren
of ruis was. Eén goedkope meter maakte er in één reeks een eenduidig antwoord
van. Dat is precies wat 1.7 beloofde en het is de rekening van een week.

**Het had een uur eerder mogen stoppen.** Bij de eerste meting, op episode 250,
stond het er al. De reeks liep nog 56 minuten door. Er staat nu een noodrem op:
twee metingen onder de 40% tegen het eigen startpunt en de reeks stopt.

> **Regel.** Een meter die een ramp meldt hoort ook de stekker eruit te trekken.
> Anders lees je de ramp pas een uur later terug.

---

# Deel 4 — Werkwijze

## 4.1 Drempels die je blijft verlagen

Bij het toetsen van de rekensom in JavaScript zijn drie keer achter elkaar
drempels te scherp gezet, waarna ze verruimd werden. Dat is op zichzelf een
waarschuwingssignaal: een proef die afgaat terwijl alles klopt, leer je negeren.

Uiteindelijk is de drempel uitgerekend in plaats van gegokt — uit het aantal
bewerkingen en de nauwkeurigheid van 32-bits rekenen volgt een verwachte
afwijking in de orde van 1e-5, gemeten 1,6e-5 — en daarna nooit meer aangeraakt.

> **Regel.** Reken je drempel uit of meet hem op bekend-goede data. Verlaag je
> hem twee keer, dan is er iets anders aan de hand dan een te strenge drempel.

## 4.2 De proefopstelling is ook code, en dus ook fout

Twee keer is een "fout in het spel" achteraf een fout in de testopstelling
gebleken: één keer liepen er twee beurten door elkaar heen (in het echte spel
onmogelijk), één keer gaf een omhulsel een argument niet door. Beide kostten
tijd omdat ze eerst als echte bugs behandeld werden.

> **Regel.** Vraag bij een vreemde uitslag eerst: kan mijn meetopstelling dit
> zelf veroorzaakt hebben? Controles (4.5, 1.5) beantwoorden die vraag voor je.

## 4.3 Conclusies van je eigen scripts

Een meetscript drukte een kant-en-klare conclusie af ("vooruitkijken werkt
niet"), die klakkeloos is overgenomen. De code eronder bleek de helft van de
zetten niet te kennen.

> **Regel.** Een script dat een conclusie afdrukt, is nog steeds maar een script.
> De conclusie is zo goed als de code eronder, en die heb jij geschreven.

## 4.4 Eerst meten, dan verhuizen

Er is bijna een hele training naar een andere pc verhuisd omdat die een GPU had.
Een meting van vijf minuten liet zien dat de GPU 2,7 keer **trager** was — het
netwerk is klein en er gaat één stelling tegelijk doorheen, dus het kopiëren
kost meer dan het rekenen oplevert.

> **Regel.** Meet voor je verhuist. Een GPU is geen wet.

## 4.5 Bestanden die uit elkaar groeien

Er stonden twee bijna identieke kopieën van het spel in de map. De ene had een
gecorrigeerde spelregel, de andere — de versie die live stond — nog de oude.

> **Regel.** Eén bestand is de waarheid. Een kopie "voor de zekerheid" krijgt een
> naam waar "niet gebruiken" in staat, of gaat weg.

---

# Deel 5 — Checklist voor het volgende spel

Af te vinken vóór de eerste lange training:

- [ ] De tegenstander waartegen je meet is het échte artefact, of een kopie die
      op honderden stellingen dezelfde zet kiest. Die proef bestaat en draait.
- [ ] Bij die proef staat opgeschreven wat hij niet dekt.
- [ ] Elk meetscript drukt zijn eigen onzekerheid af (49/√n).
- [ ] Elke vergelijkende meting heeft een A-tegen-A-controle die 50% geeft.
- [ ] Je hebt gemeten waar je bot staat tegen elke mogelijke leraar, en je
      leerplan begint bij de eerste die tussen 25% en 60% ligt.
- [ ] De sparringpartner speelt zonder kunstmatige fouten.
- [ ] Je startcommando is nagelezen op zijn standaardwaarden; je weet zeker
      waar het netwerk vandaan komt.
- [ ] Je beste gewichten staan onder een naam die geen script overschrijft.
- [ ] De poort voor deze fase staat opgeschreven, inclusief wat je doet als hij
      niet gehaald wordt.
- [ ] Je weet welke regel in de eerste meetuitvoer bewijst dat het commando deed
      wat je dacht — en je kijkt ernaar voor je gaat slapen.
- [ ] Je meet vóór de eerste gradiëntstap waar je bot staat, zodat een laag
      cijfer later te onderscheiden is van een laag beginpunt.
- [ ] Je hebt uitgerekend welk deel van je leerdoelen vervuild is door
      verkenning: 1 − (1−epsilon)^n bij returns over n zetten.
- [ ] Er is een meter die alleen zegt of er geleerd wordt: de bot van nu tegen
      een bevroren kopie van het startnetwerk, beide kleuren, 50% = niets.
- [ ] Van elke geplande proef staat opgeschreven welke vraag hij kan
      beantwoorden en welke niet.
- [ ] Je weet op welke kleur/kant je bot traint en op welke je hem meet.

---

# Deel 6 — Hoe ik een volgende bot zou aanpakken

De volgorde die uit dit hele project volgt. Elke fase kost uren, niet nachten,
en elke fase kan het project afbreken — dat is het punt.

## Fase 0 — Meet het spel (een avond, vóór er iets getraind wordt)

1. Zet je bestaande tegenstander op verschillende sterktes en laat ze tegen
   elkaar spelen. Speel **elke deling twee keer met gewisselde kleuren**:
   dat haalt het toeval eruit én laat zien wie de partij besliste.
2. Neem een willekeurige speler mee als ondergrens. Haalt die 0%, dan straft je
   spel slecht spelen af en is er een vaardigheidsschaal.
3. Meet ook je sterkste speler tegen een nóg sterkere versie (meer zoekdiepte,
   meer bedenktijd). Dat is je **dak**: alles wat er boven je huidige bot te
   halen valt.
4. Laat één speler tegen zichzelf spelen en tel de kleuren. Geen 50/50 →
   scheefheid in je bot of in je spel, en die wil je kennen vóór je meet.

Dan pas schrijf je het doel op, in de getallen die hier uit komen. Bij Baarden
zou dat geweest zijn: "10 procentpunt te halen boven de bestaande bot, en de
helft van de partijen wordt door de deling beslist." Met dat zinnetje op papier
was dit project nooit begonnen zoals het begonnen is.

## Fase 1 — Leer een waardering, geen zetten

Niet meteen Q-waarden voor honderden acties uit één beloning aan het eind van
een lange partij. Eerst het makkelijke probleem: speel een paar duizend partijen
tussen bestaande bots, bewaar elke stelling met de uiteindelijke uitslag, en
train een netwerk dat die uitslag voorspelt. Gewone regressie — geen
verkenning, geen buffer, geen doelnetwerk, geen van de knoppen waar wij weken
aan gedraaid hebben.

De meting is direct: voorspelt dat netwerk beter dan de handgeschreven
waarderingsfunctie die je al hebt? Zo nee, dan leert een netwerk dit spel niet,
en dat weet je na één avond in plaats van na een jaar.

## Fase 2 — Zet die waardering in de zoeker die je al hebt

Vervang de handgeschreven waardering in je minimax door het netwerk en meet
tegen je bestaande bot. Dit is het eerste moment waarop het cijfer dat telt kan
bewegen. Je hergebruikt je zoeker in plaats van hem te willen vervangen door
een reflex — en juist dat was hier de kernfout: wij trainden een netwerk dat één
zet vooruitkijkt tegen een tegenstander die er vier vooruitkijkt.

## Fase 3 — Pas dan zelfspel met zoeken in de lus

Laat de zoekende bot spelen, bewaar per beurt de zet die het zoeken koos, en
train het netwerk om die zet vanzelf te kiezen. Dit is hoe schaak- en
go-programma's boven hun eigen beoordeling uitkomen. Duur, en alleen zinnig als
fase 2 iets opleverde.

## Wat er dwars door alle fases heen geldt

- Eén meter die alleen zegt "leert dit netwerk iets?" — tegen een bevroren kopie
  van zijn startpunt, beide kanten, 50% = niets. Zonder die meter kun je een vlak
  resultaat niet uit elkaar halen.
- Elk meetscript drukt zijn eigen onzekerheid af (49/√n), en heeft een
  A-tegen-A-controle die 50% hoort te geven.
- Vóór elke run opschrijven welke vraag hij kán beantwoorden en welke niet.
- Een meter die een ramp meldt trekt ook de stekker eruit.

---

*Bijgehouden zolang er aan deze bot gewerkt wordt. Komt er een fout bij, dan
hoort hij hier, ook (juist) als hij klein is.*
