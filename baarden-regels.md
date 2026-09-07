# Baarden — Spelregels

> Status: **v0.9 — regels volledig afgerond.** Dit document is bewust modulair opgebouwd (losse genummerde regels per sectie) zodat je snel kan aanvullen of aanpassen. Alle regels zijn bevestigd; nieuwe wijzigingen worden hier toegevoegd zodra ze expliciet worden doorgegeven.

---

## 1. Overzicht

| | |
|---|---|
| Spelers | 2 |
| Kleur speler A | **Rood** — harten ♥ en ruiten ♦ |
| Kleur speler B | **Zwart** — schoppen ♠ en klaveren ♣ |
| Materiaal | 1 deck van 52 kaarten (26 per speler) + 1 blok-kaart per speler |
| Doel | Verover de toren van je tegenstander, verdedig je eigen toren |
| Platform | Digitaal, mobiel (gsm) — 2 aparte devices tegen elkaar (online) |

---

## 2. Het bord

Rooster van **3 kolommen × 7 rijen**. Rijen worden benoemd `a`–`g` (verticaal, lengte 7), kolommen `1`–`3` (horizontaal, breedte 3). Coördinaat = `rij + kolom`, bv. `b2`.

```
        1     2     3
   a  [a1 ][a2 ][a3 ]      ┐
   b  [b1 ][🔴2][b3 ]      │  Rood-gebied  (toren op b2)
   c  [c1 ][c2 ][c3 ]      ┘
   d  [d1 ][d2 ][d3 ]      —  Neutrale zone
   e  [e1 ][e2 ][e3 ]      ┐
   f  [f1 ][⚫2][f3 ]      │  Zwart-gebied (toren op f2)
   g  [g1 ][g2 ][g3 ]      ┘
```

- **Rood-gebied**: rijen a–c (9 vakjes, incl. toren).
- **Zwart-gebied**: rijen e–g (9 vakjes, incl. toren).
- **Neutrale zone**: rij d (3 vakjes), niemand mag hier vanaf het begin kaarten leggen.

---

## 3. Opstelling bij start

1. Elke speler haalt de **2 van zijn kleur** uit zijn stapel — dit wordt zijn **toren**.
   - Rood: 2♥ (of 2♦, maakt niet uit welke — zie aanname 3.1) op **b2**.
   - Zwart: 2♠ (of 2♣) op **f2**.
   - De toren ligt **vast** (kan nooit verplaatst worden), maar kan wel **opgewaardeerd** worden — zie sectie 7.
2. De overige 25 kaarten van elke kleur worden geschud → dit is de **trekstapel** van die speler.
3. Elke speler heeft een **blok-kaart**, die bij de start van het spel **naast het spelbord** ligt (nog niet op een vakje) — zie sectie 6.
4. Elke speler heeft een lege **"hold"-plek** (1 slot, zie sectie 5.1).

> 🟡 **AANNAME 3.1** — Welke specifieke 2 (harten of ruiten / schoppen of klaveren) de toren wordt, maakt voor de regels niets uit. Ik heb voor het prototype 2♥ (rood) en 2♠ (zwart) gekozen.

---

## 4. Spelmateriaal per speler — trekstapel & aflegstapel

| Onderdeel | Beschrijving |
|---|---|
| **Trekstapel** | Bij start: alle kaarten van je kleur, min je toren-2 (dus 25 kaarten). |
| **Aflegstapel** | Kaarten die niet gekozen/gebruikt werden, of veroverd (vernietigd) zijn. |
| **Hand** | 3 kaarten, elke ronde vers getrokken (zie 5.1). |
| **Hold** | 1 los vakje naast je hand — 1 kaart kan hier "in bewaring" gelegd worden (zie 5.1). |
| **Blok-kaart** | 1 apart stuk, geen deel van de 26 kleurkaarten. Ligt bij start naast het bord. |

**Cyclus van de trekstapel:**
- Een speler blijft, ronde na ronde, kaarten van zijn trekstapel trekken tot die volledig leeg is.
- Zodra de trekstapel leeg is, wordt de aflegstapel geschud en wordt dat de nieuwe trekstapel.
- **Randgeval:** als de trekstapel te weinig kaarten meer heeft om de volle 3 te trekken, wordt de aflegstapel **eerder** geschud en samengevoegd, zodat de hand toch tot 3 aangevuld kan worden.
- In de digitale versie worden beide trek- en aflegstapels ook **visueel in het klein** getoond op het bord.

---

## 5. Een ronde — 2 fases

Het spel verloopt in **rondes**. Elke ronde heeft twee fases die **na elkaar** door beide spelers doorlopen worden: eerst leggen beide spelers (fase 1), dan bewegen beide spelers (fase 2). Wie in een ronde **als eerste** mag leggen, mag in diezelfde ronde ook **als eerste** bewegen.

**De beginnende speler wisselt elke ronde**: ronde 1 begint speler Zwart, ronde 2 begint speler Rood, ronde 3 weer Zwart, enzovoort (om en om). **Bevestigd:** er is geen tijdslimiet op een beurt of fase — een speler mag zo lang nadenken als nodig.

### 5.1 Fase 1 — Legfase
1. **Beide spelers trekken tegelijk 3 kaarten** van hun eigen trekstapel.
2. De **beginnende speler van deze ronde** kiest **exact 1 van de volgende acties** (mutueel exclusief — dit is je volledige actie voor deze fase):
   - **In het veld leggen** — 1 kaart uit je hand op een leeg vakje rond je eigen toren.
   - **In "hold" leggen** — 1 kaart uit je hand in je hold-slot (enkel mogelijk als je hold-slot leeg is). De kaart blijft daar liggen tot je hem gebruikt om je toren op te waarderen (sectie 7).
   - **Toren opwaarderen** — zie sectie 7. Enkel beschikbaar als je (eventueel samen met orthogonale/hold-kaarten) minstens 1 handkaart kan gebruiken om je toren met +1 op te waarderen.
   - **Pas** — geen enkele kaart leggen.
3. Daarna doet de **andere speler** hetzelfde, met zijn eigen 3 getrokken kaarten.
4. De handkaarten die niet gebruikt werden, gaan naar de aflegstapel van die speler.

### 5.2 Fase 2 — Bewegingsfase
1. De **beginnende speler van deze ronde** kiest **exact 1 van de volgende acties** (mutueel exclusief — dit is je volledige actie voor deze fase):
   - **Een kaart 1 vakje verschuiven** (horizontaal/verticaal) — naar een leeg vakje, of tegen een kaart van de tegenstander (zie sectie 8 voor de gevechtsregels).
   - **Toren opwaarderen** — met kaarten die orthogonaal naast je toren liggen en/of je hold-kaart (zie sectie 7).
2. Daarna doet de **andere speler** zijn actie, volgens dezelfde regels.
3. Er zijn nog **uitzonderingen** rond de **blok-kaarten** (zie sectie 6) — *nog toe te lichten.*
4. Zodra beide spelers hun actie gedaan hebben, is de ronde voorbij → terug naar 5.1, met de andere speler als beginnende speler.

---

## 6. Blok-kaart — bevestigd, volledig uitgewerkt

De blok-kaart is eigenlijk de **joker** van elke speler. Elke speler heeft er **1**, los van zijn 26 kleurkaarten.

- Bij start van het spel ligt de blok-kaart **naast het bord** (nog niet in het spel).
- Een speler mag, wanneer hij dat verkiest, een **beweging** (fase 2) gebruiken om zijn blok-kaart in het spel te leggen: hij legt hem **bovenop een vijandelijke kaart**. Dit gebruikt zijn volledige bewegingsactie voor die ronde (mutueel exclusief met een gewone zet, toren-opwaarderen, of hold-kaart plaatsen).
- **Effect:** de kaart(en) onder de blok-kaart kunnen niet meer bewegen (geblokkeerd) — dit geldt ook als er toevallig je **eigen** kaart onder die vijandelijke kaart geblokkeerd lag (een gestapeld vakje, zie 8.1): die zit dan ook mee vast.
- Dit blijft zo liggen **tot de eigenaar van de blok-kaart** ervoor kiest hem te **verleggen** naar een ander vakje (opnieuw een volledige bewegingsactie, ook weer bovenop een vijandelijke kaart).
- **Eens geplaatst kan de blok-kaart nooit meer uit het spel gehaald worden** — hij kan enkel door zijn eigen eigenaar verlegd worden, maar nooit aangevallen, veroverd, of vernietigd door de tegenstander.
- **Bevestigd (correctie):** blok-kaarten mogen elkaar **niet** blokkeren. Een blok-kaart mag dus enkel op een gewone vijandelijke kaart gelegd worden, nooit op de blok-kaart van de tegenstander.
- De animatie voor het plaatsen/verleggen is gelijkaardig aan de toren-opwaardering-animatie (de kaart vliegt zichtbaar naar zijn doelvakje).

**Bevestigd** — De blok-kaart mag **nooit** op een torenvakje gelegd worden (ook niet op een opgewaardeerde torenlaag). Enkel gewone vijandelijke kaarten (of een vijandelijke blok-kaart) kunnen geblokkeerd worden. Een toren blijft dus altijd enkel via de gewone verover-regel (sectie 8.2) te grazen te nemen.

**Bevestigde afhankelijkheid:** als een speler in fase 1 past (of anderszins nog geen enkele kaart op het bord heeft liggen), dan heeft hij in fase 2 mogelijk geen gewone kaart om te bewegen — de blok-kaart plaatsen is dan een prima alternatieve zet, zolang er een vijandelijke kaart op het bord staat om op te leggen. Is er ook dat niet (nog helemaal geen kaarten in het spel van geen van beide spelers), dan blijft het tijdelijke vangnet "geen zet mogelijk" nodig.

---

## 6a. Hold — bevestigd, volledig uitgewerkt

Hold is een plaats naast het veld waar een speler **voor onbepaalde tijd 1 kaart** kan bijhouden (dus niet gebonden aan de huidige ronde).

### 6a.1 Hoe een kaart in hold terechtkomt
Er zijn 2 manieren:

1. **De toren bereikt Boer-waarde.** Zodra dit gebeurt, **wordt de toren teruggezet naar waarde 2** (bevestigd — zie sectie 7.3) en mag de speler naar zijn **gesneuvelde kaarten** kijken (kaarten van zijn kleur die in een gevecht vernietigd werden — zie 8.1 — dus niet zomaar niet-gekozen handkaarten). Kiest hij een kaart om te **herleven**, dan komt die kaart in zijn hold te liggen. Zijn er geen gesneuvelde kaarten, of kiest de speler ervoor niemand te herleven, dan komt er niets in hold te liggen. **Bevestigd: dit is niet eenmalig** — omdat de toren na Boer telkens terugvalt naar waarde 2, kan hij in de loop van het spel **meerdere keren opnieuw Boer bereiken**, en dus meerdere keren een herleef-kans opleveren.
2. **Tijdens fase 1 (legfase)** — in plaats van een kaart in het veld te leggen of te gebruiken om de toren op te waarderen, mag de speler die kaart in hold leggen (enkel als het hold-slot leeg is).

### 6a.2 Hoe een kaart uit hold terechtkomt
Eens er een kaart in hold ligt, moet de speler op een gegeven moment een **beweging** (fase 2) gebruiken om ze eruit te halen. Dat kan op 2 manieren:
- **Losse zet:** de hold-kaart in een vrij vakje rond zijn eigen toren leggen (dit is dan zijn volledige bewegingsactie voor die ronde).
- **Als combo bij het opwaarderen** — zoals beschreven in sectie 7: de hold-kaart telt mee als een van de 3 bronnen om de toren met +1 (of een ketting) op te waarderen.

Tot de kaart eruit gehaald is, blijft ze gewoon liggen — er is geen tijdslimiet.

**Bevestigd** — Als de toren Boer bereikt terwijl het hold-slot al bezet is met een andere kaart, gaat de herleef-bonus voor die keer gewoon **verloren** (geen kaart wordt herleefd; de bestaande hold-kaart blijft onaangeroerd liggen).

---

## 7. De toren opwaarderen

De toren is wat je verdedigt én wat je van de tegenstander probeert te veroveren om te winnen. Een toren begint op waarde **2** en kan opgebouwd worden tot en met waarde **Boer (J)**. Hoe hoger de waarde, hoe moeilijker hij te verslaan is. **Bevestigd:** zodra de toren waarde Boer bereikt, wordt hij **teruggezet naar waarde 2**, en mag de eigenaar een gesneuvelde kaart terug tot leven roepen (zie sectie 6a voor de volledige uitleg van die herleef-kans). Omdat de toren daarna weer van 2 begint, kan dit **meerdere keren per spel** gebeuren — telkens de toren opnieuw Boer bereikt.

**Wat er fysiek gebeurt:** de gebruikte kaart(en) worden bovenop de toren gelegd. Een toren van waarde 2 waarop een 3, 4 en 5 gelegd worden, wordt zo in 1 keer een toren van waarde **6**. Dit is dus geen vernietiging — de kaarten worden een blijvend onderdeel van de toren (ze gaan dus niet naar de aflegstapel).

### 7.1 De drie bronnen van opwaardeer-kaarten
Een kaart mag gebruikt worden om de toren op te waarderen als zijn waarde precies **+1** is t.o.v. de huidige torenwaarde. Er zijn 3 bronnen:

1. **Trekhand** (fase 1) — een kaart uit je 3 net-getrokken kaarten.
2. **Orthogonale bordkaarten** (fase 2) — een kaart die rechtstreeks naast je toren ligt (de 4 vakjes horizontaal/verticaal aangrenzend).
3. **Hold-kaart** (fase 1 of 2, afhankelijk van combinatie — zie 7.2) — de kaart die in je hold-slot ligt.

Als je **meerdere** kaarten hebt die een ononderbroken keten vormen (bv. toren=2, en je hebt de waarden 3, 4 én 5 beschikbaar), mag je die **allemaal tegelijk in 1 actie** gebruiken. De keten moet ononderbroken zijn: als je 3 en 5 hebt maar geen 4, kan je enkel de 3 gebruiken (de keten stopt bij het gat).

### 7.2 Welke fase? — de combinatieregel
- **Enkel trekhand-kaart(en)**, eventueel aangevuld met orthogonale en/of hold-kaarten om de keten te verlengen → gebeurt in **fase 1** (legfase), *zolang minstens 1 kaart uit de trekhand deel uitmaakt van de gebruikte keten* (ergens in de keten, niet noodzakelijk als eerste kaart).
- **Enkel orthogonale en/of hold-kaarten** (dus **geen** trekhand-kaart in de keten) → moet in **fase 2** (bewegingsfase) gebeuren.
- **Bevestigd:** het opwaarderen van de toren is, in de fase waarin het gebeurt, je **volledige actie** voor die fase — je kan die fase niet ook nog een gewone kaart leggen/hold vullen (fase 1), of een aparte losse kaart bewegen (fase 2).

**Voorbeeld (uit je uitleg):** toren=2. Trekhand: 3 en 5. Orthogonaal: 4 en 6. Hold: 7. → Keten 3-4-5-6-7 is ononderbroken en bevat trekhand-kaarten (3 en 5) → dit gebeurt allemaal **in fase 1**, toren wordt in 1 keer waarde **7**. Zou de trekhand hier niet bij betrokken zijn (dus enkel 4-6 orthogonaal + 7 hold, zonder 3 of 5 uit de hand), dan zou dit in fase 2 moeten gebeuren.

**Bevestigd — keuze bij gelijke waarde tussen bronnen:** als er op het moment dat de toren een bepaalde waarde nodig heeft, **meerdere kaarten met exact die waarde** tegelijk beschikbaar zijn uit verschillende bronnen (bv. een 3♥ in je hand én een 3♦ die orthogonaal ligt), wordt dit **nooit automatisch/willekeurig** gekozen. Het spel legt beide (of alle) kandidaten open voor de speler, die zelf aanklikt met welke kaart hij doorgaat. De niet-gekozen kaart blijft gewoon liggen waar hij lag (in de hand, op het bord, of in hold) en kan later nog gebruikt worden.

**Bevestigd** — Het hold-slot kan maar **1 kaart tegelijk** bevatten; je kan er geen 2de in leggen zolang de eerste er nog ligt.

### 7.3 De reset bij Boer
**Bevestigd:** zodra de toren waarde Boer bereikt, valt hij terug naar waarde **2** — de basis-torenkaart blijft liggen, maar alle erop gelegde opwaardeer-kaarten gaan eraf en **verdwijnen volledig uit het spel** (niet naar de aflegstapel, niet herbruikbaar). Dit triggert meteen de herleef-kans uit sectie 6a, en kan dus meerdere keren per spel gebeuren.

**Bevestigd — afkoelperiode:** in de ronde waarin een toren van Boer terugvalt naar 2, kan diezelfde toren **niet meer verder opgewaardeerd worden**, ook al is er nog een passende +1-kaart beschikbaar (bv. een 3). Pas vanaf de **volgende ronde** kan er weer normaal opgewaardeerd worden.

---

## 8. Kaarten veroveren, blokkeren & de toren pakken

Tijdens de bewegingsfase (5.2) verplaats je een kaart 1 vakje. **Bevestigd:** dit mag over het volledige bord — alle 21 vakjes, dus ook het gebied van de tegenstander en de neutrale zone — niet enkel je eigen gebied. Je kan **nooit** naar een vakje met een kaart van **je eigen kleur** (behalve de speciale uitzondering: je eigen toren opwaarderen, zie sectie 7). Tegen een kaart van de **tegenstander** vergelijk je de waarde (2 laag, Aas hoog):

### 8.1 Tegen een gewone kaart van de tegenstander
| Situatie | Resultaat |
|---|---|
| Jouw kaart heeft een **hogere** waarde | Je **vernietigt** de kaart van de tegenstander (naar zijn aflegstapel) en neemt het vakje in. |
| Jouw kaart heeft een **gelijke** waarde | Je kaart komt **boven op** de kaart van de tegenstander te liggen (stapelen). De onderste kaart is dan **geblokkeerd** (kan niet bewegen) tot de bovenste kaart wegbeweegt. De bovenste kaart zelf ondervindt geen beperking. |
| Jouw kaart heeft een **lagere** waarde | Illegale zet. |

### 8.1a Een gestapeld vakje doorbreken — **bevestigd, belangrijke correctie**
Als het vakje dat je aanvalt (met een hogere waarde) al **meer dan 1 kaart** bevat (dus de bovenste kaart lag zelf al boven op iets anders), dan geldt een andere regel dan gewoon vernietigen: **de volledige stapel én je eigen aanvallende kaart verdwijnen allemaal compleet uit het spel** (niet naar de aflegstapel — net als bij een toren-reset, zie 7.3). Het vakje wordt dus leeg.

Omdat een stapel altijd kleur-per-kleur afwisselt (je kan nooit op je eigen kleur stapelen), betekent dit **in de praktijk altijd** dat je bij het doorbreken van een stapel ook je **eigen, daaronder geblokkeerd liggende kaart** opoffert — puur om de bovenste kaart van de tegenstander te vernietigen. Een gewoon (niet-gestapeld) vakje aanvallen blijft wel gewoon de normale regel uit 8.1 volgen (kaart vernietigd naar de aflegstapel, jij neemt het vakje in).

**Voorbeeld (uit je uitleg):** een zwarte vrouw ligt bovenop een rode vrouw (2 lagen). Een rode aas verslaat de zwarte vrouw — maar omdat het vakje gestapeld was, verdwijnen alle 3 betrokken kaarten (de rode vrouw eronder, de zwarte vrouw erboven, én de rode aas zelf) volledig uit het spel. Het vakje is nadien leeg.

### 8.1b De 2-tegen-Aas-uitzondering — **bevestigd**
Een Aas is de hoogste waarde, en zou dus normaal door niets verslagen kunnen worden. Als uitzondering hierop geldt: **een 2 kan een Aas verslaan** (ondanks dat 2 normaal de laagste waarde is). Dit is de enige uitzondering op de waarde-volgorde uit sectie 8. Verder gelden voor deze overwinning gewoon de normale regels — dus inclusief 8.1a als die Aas zelf bovenop een stapel lag.

### 8.2 Tegen de toren van de tegenstander — **bevestigd, aparte regel**
| Situatie | Resultaat |
|---|---|
| Jouw kaart heeft een **hogere** waarde dan de (eventueel opgewaardeerde) toren, **of** jouw kaart is een 2 tegen een torenwaarde-Aas (kan in de praktijk niet voorkomen, torens gaan nooit hoger dan Boer) | Je **verovert de toren volledig** → **spel voorbij, jij wint.** |
| Jouw kaart heeft een **gelijke of lagere** waarde | Illegale zet — **gelijke waarde kan de toren dus niet blokkeren/stapelen**, enkel een strikt hogere waarde (of de 2-vs-aas-uitzondering) werkt. Dit is dus anders dan bij een gewone kaart (8.1)! |

- In de digitale versie blijft bij het stapelen (8.1) een klein, leesbaar chipje zichtbaar met de kaart die eronder geblokkeerd ligt. Bij een opgewaardeerde toren zie je enkel de bovenste kaart plus 1 subtiel piepend kaartje erachter (geen aantal).

---

## 9. Openstaande vragen

Geen — alle regels zijn bevestigd. Dit document beschrijft het volledige, afgeronde spel. Nieuwe of gewijzigde regels worden hier vermeld zodra ze expliciet worden doorgegeven.

---

## 10. Wijzigingslog

- **v0.9** — Nieuwe regel: na een Boer-reset (sectie 7.3) kan die toren de rest van diezelfde ronde niet meer verder opgewaardeerd worden, ook al is er nog een passende kaart beschikbaar. Vanaf de volgende ronde kan dit weer normaal. Daarnaast een belangrijke bugfix: gesneuvelde kaarten zaten per ongeluk in dezelfde aflegstapel als gewone afgelegde kaarten en werden soms per ongeluk herschud/verwijderd — ze hebben nu een eigen, permanente plek die nooit herschud wordt.
- **v0.8 — Regels volledig afgerond.** Laatste 2 open punten bevestigd: bewegen mag over het volledige bord (alle 21 vakjes, geen zonebeperking), en er is nooit een tijdslimiet per beurt/fase. Aanname 3.1 (welke specifieke 2 de toren wordt) blijft staan maar heeft bevestigd geen enkel spelmatig effect. Sectie 9 (open vragen) is gesloten.
- **v0.7.6** — Spelregelknop verplaatst van settings naar het hoofdmenu. Spelregel-PDF herschikt zodat hoofdstukken gewoon aan elkaar doorlopen i.p.v. elk op een nieuw blad te beginnen (van 9 naar 4 pagina's).
- **v0.7.5** — Grote UI-herziening op basis van testfeedback: (1) settings-knop reserveert nu echt ruimte bovenaan (geen overlap meer, blijft zichtbaar tijdens scrollen); (2) het aparte inspecteer-scherm voor gestapelde vakjes is vervangen door hetzelfde subtiele "piepend randje" dat de toren al gebruikte, nu overal (gewone kaarten én blok-kaarten); (3) enkel nog écht geldige doelvakjes worden gemarkeerd tijdens een zet (bv. een blok-kaart wordt niet meer als doelwit getoond); (4) een blok-kaart selecteer je nu net als een gewone kaart — aanklikken waar hij ligt (naast het bord, of op het bord) en dan het doelvakje; (5) een handkaart in hold leggen doe je nu door je hold-vakje zelf aan te klikken i.p.v. een aparte knop. De knoppen "In hold leggen" en "Blok-kaart plaatsen/verleggen" zijn vervallen.
- **v0.7.4** — Correctie: blok-kaarten mogen elkaar niet blokkeren. Een blok-kaart kan dus niet langer op de blok-kaart van de tegenstander gelegd worden (enkel op gewone vijandelijke kaarten).
- **v0.7.3** — Nieuw overzicht voor gestapelde vakjes: het kleine, onduidelijke chipje is vervangen door een tik-om-te-openen 🔍-icoontje op elk gestapeld vakje (gewone kaarten én blok-kaarten). Dit opent een scherm met de volledige stapel van boven naar onder, met per laag duidelijk wie de eigenaar is, wat voor stuk het is, en of het actief of geblokkeerd ligt.
- **v0.7.2** — Bugfix: als een blok-kaart begraven raakte onder de blok-kaart van de tegenstander, kon de eigenaar hem toch nog "verleggen" — dit maakte per ongeluk een 2de blok-kaart aan in plaats van de begraven kaart te bewegen (elke speler heeft er maar 1). Nu terecht: een begraven blok-kaart ligt net als elke andere begraven kaart volledig vast tot de bedekkende kaart wegbeweegt.
- **v0.7.1** — Bevestigd: een toren mag nooit geblokkeerd worden. Vervangt aanname 6.1 (geen aanname meer, gewoon bevestigde regel — de code werkte al zo).
- **v0.7** — Blok-kaart volledig uitgewerkt (sectie 6): de joker van elke speler, start naast het bord, wordt via een volledige bewegingsactie op een vijandelijke kaart gelegd (blokkeert alles eronder, ook eventuele eigen gestapelde kaarten), kan enkel door de eigenaar verlegd worden, en is nooit te vernietigen of te verwijderen door de tegenstander. Vervangt het tijdelijke vangnet uit v0.4.2/6.2 grotendeels — dat blijft enkel nog nodig in het uiterst zeldzame geval dat er nog geen enkele vijandelijke kaart op het bord staat. Prototype toont een vlieg-animatie bij plaatsen/verleggen, gelijkaardig aan de toren-opwaardering.
- **v0.6** — Twee belangrijke gevechtscorrecties (sectie 8): (1) een gestapeld vakje doorbreken vernietigt niet enkel de bovenste kaart — de HELE stapel + je eigen aanvallende kaart verdwijnen volledig uit het spel (dus ook je eigen, daaronder geblokkeerde kaart); (2) een 2 kan een Aas verslaan als enige uitzondering op de waarde-volgorde (anders was een Aas onverslaanbaar).
- **v0.5.2** — Bevestigd: kaarten die bij een Boer-reset van de toren afgehaald worden, verdwijnen volledig uit het spel (niet naar de aflegstapel). Dit vervangt aanname 7.5.
- **v0.5.1** — Belangrijke correctie: zodra de toren Boer bereikt, valt hij terug naar waarde 2 (i.p.v. daar te blijven staan). Dit betekent dat de herleef-bonus **meerdere keren per spel** kan optreden. Bevestigd dat de herleef-bonus simpelweg verloren gaat als het hold-slot al bezet is op dat moment.
- **v0.5** — Hold volledig uitgewerkt (nieuwe sectie 6a): 2 manieren om een kaart in hold te krijgen (toren bereikt Boer → herleef-keuze uit gesneuvelde kaarten; of vrijwillig in fase 1), en 2 manieren om ze eruit te halen (losse zet naar een vrij veldvakje, of als combo bij het opwaarderen). "Gesneuvelde kaarten" zijn nu apart bijgehouden (enkel gevechts-slachtoffers, niet zomaar afgelegde kaarten). Prototype toont de herleef-keuze als een aanklikbaar moment, net als bij de gelijke-waarde-torenketen-keuze.
- **v0.4.3** — Geen regelwijzigingen, enkel prototype-verbeteringen: bord verkleind en overbodige statusregels weggehaald (minder scrollen), kapotte "Ververs"/"Nieuw spel"-knoppen gefixt (gebruikten een geblokkeerde browser-popup), meerdere-kaarten-torenopwaardering nu zichtbaar geanimeerd (kaarten vliegen één voor één naar de toren), toren toont nu enkel de bovenste kaart + 1 subtiel piepend kaartje (geen aantal meer), en gestapelde kaarten tonen nu een leesbaar chipje met de kaart die eronder ligt i.p.v. een vage rand.
- **v0.4.2** — Afhankelijkheid herkend: passen in fase 1 (of anders geen kaarten op het bord hebben) kan betekenen dat fase 2 geen enkele geldige gewone zet heeft — dat is precies het moment waarop de blok-kaart het bord op moet kunnen (sectie 6). Tot die regel uitgewerkt is, heeft het prototype een tijdelijke noodknop "geen zet mogelijk" om vastlopen te voorkomen.
- **v0.4.1** — Bij een gelijke-waarde-keuze tussen meerdere bronnen (bv. een hand-kaart én een orthogonale kaart met dezelfde waarde) kiest het prototype niet langer automatisch: beide/alle kandidaten worden opengelegd en de speler klikt zelf welke gebruikt wordt. Bevestigd dat het hold-slot maar 1 kaart tegelijk kan bevatten.
- **v0.4** — Volledig torenopwaardeer-systeem toegevoegd (sectie 7): 3 bronnen (trekhand/orthogonaal/hold), ononderbroken-ketenregel, fase-1-vs-fase-2-combinatieregel, max. waarde Boer + toekomstige "herleven"-bonus. Toren-verovering herzien: gelijke waarde werkt NIET tegen een toren (enkel strikt hogere waarde, zie 8.2) — dit vervangt de oude aanname 7.1 uit v0.3. "Hold" is nu een echte, werkende spelplek. Prototype nu geoptimaliseerd voor mobiel gebruik.
- **v0.3** — Kaartwaarde-volgorde bevestigd, gelijke-waarde-botsing = stapelen i.p.v. vernietigen, trekstapel/aflegstapel-cyclus uitgewerkt, "pas"-optie toegevoegd.
- **v0.2** — Beurtensysteem herschreven naar het rondesysteem.
- **v0.1** — Eerste opzet op basis van mondelinge uitleg.
