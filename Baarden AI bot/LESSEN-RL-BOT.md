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

---

*Bijgehouden zolang er aan deze bot gewerkt wordt. Komt er een fout bij, dan
hoort hij hier, ook (juist) als hij klein is.*
