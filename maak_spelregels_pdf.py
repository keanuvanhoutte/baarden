#!/usr/bin/env python3
"""
Genereert de spelregels-PDF uit de regeltekst in Baarden Game.html
en zet hem meteen terug in datzelfde bestand (BAARDEN_RULES_PDF_B64).

Waarom: de PDF zat als vaste base64-blob in het spel, los van de regeltekst
op het scherm. Daardoor konden ze uit elkaar lopen -- en dat deden ze ook.
Nu is de regeltekst in de HTML de enige bron, en rolt de PDF daaruit.

Gebruik:
    python maak_spelregels_pdf.py "Baarden Game.html"
    python maak_spelregels_pdf.py "Baarden Game.html" --alleen-pdf spelregels.pdf

Nodig: playwright  (pip install playwright && playwright install chromium)
"""

import argparse
import base64
import pathlib
import re
import subprocess
import sys
import tempfile

VERSIE = "v0.11"


def _families():
    """Lettertypefamilies die op deze machine geinstalleerd zijn."""
    try:
        uit = subprocess.run(['fc-list', ':', 'family'], capture_output=True,
                             text=True, timeout=20).stdout
    except Exception:
        return set()
    return {deel.strip() for regel in uit.splitlines() for deel in regel.split(',')}


def _stapel(voorkeur, alternatieven, generiek):
    """
    Bouwt een CSS font-stack. Op Windows en macOS staat de voorkeursfont
    (Georgia / Trebuchet MS) gewoon in het systeem, dus die wint. Op Linux
    leidt fontconfig zo'n naam stilletjes om naar een Times-kloon, en dat
    ziet er niet uit -- daar kiezen we dus expliciet het beste alternatief
    dat echt geinstalleerd is.
    """
    if sys.platform.startswith('win') or sys.platform == 'darwin':
        return f"'{voorkeur}',{generiek}"
    aanwezig = _families()
    if voorkeur in aanwezig:
        return f"'{voorkeur}',{generiek}"
    for naam in alternatieven:
        if naam in aanwezig:
            return f"'{naam}',{generiek}"
    return generiek


# Let op: 'Bitstream Charter' lijkt qua vorm het meest op Georgia, maar staat op
# veel Linux-systemen als Type 1 (.pfb) geinstalleerd en die kan Chromium niet
# inbedden -- hij valt dan stilletjes terug op Times. Caladea (Cambria-kloon) is
# TrueType en qua karakter het dichtst bij Georgia van wat er wel werkt.
SERIF = _stapel('Georgia', ['Caladea', 'Gelasio', 'DejaVu Serif',
                            'Liberation Serif'], 'serif')
SANS = _stapel('Trebuchet MS', ['Carlito', 'DejaVu Sans', 'Liberation Sans'],
               'sans-serif')
SANS_TABEL = _stapel('Arial', ['Liberation Sans', 'Carlito', 'DejaVu Sans'],
                     'sans-serif')

# Het spel gebruikt Georgia en Trebuchet MS. Staan die op deze machine (Windows,
# macOS), dan pakt Chromium ze vanzelf; anders valt hij terug op het dichtstbij
# liggende alternatief dat wel aanwezig is.
PRINT_CSS = """
@page { size: A4; margin: 18mm 19mm 20mm 19mm; }

:root{
  --goud:#a6882c;
  --goud-licht:#c9b477;
  --leisteen:#33505f;
  --amber:#b08d35;
  --rood:#b3312c;
  --room:#fbf3e0;
  --inkt:#1b1b1b;
}

*{ box-sizing:border-box; }

body{
  margin:0;
  font-family:__SERIF__;
  font-size:10.5pt;
  line-height:1.58;
  color:var(--inkt);
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}

h2.rtitle{
  font-family:__SANS__;
  font-weight:bold;
  font-size:27pt;
  letter-spacing:7px;
  text-transform:uppercase;
  color:var(--goud);
  text-align:center;
  margin:4mm 0 2mm 0;
}

.rsub{
  text-align:center;
  font-style:italic;
  font-size:10pt;
  color:#6a6a6a;
  margin:0 0 9mm 0;
}

h3{
  font-family:__SANS__;
  font-weight:bold;
  font-size:13.5pt;
  color:var(--leisteen);
  margin:8mm 0 2mm 0;
  padding-bottom:1.6mm;
  border-bottom:1px solid var(--goud);
  break-after:avoid;
  page-break-after:avoid;
}

h4{
  font-family:__SANS__;
  font-weight:bold;
  font-size:11pt;
  color:var(--amber);
  margin:5mm 0 1.5mm 0;
  break-after:avoid;
  page-break-after:avoid;
}

p{ margin:2mm 0; }
ul,ol{ margin:2mm 0; padding-left:7mm; }
li{ margin:1.4mm 0; }

table{
  width:100%;
  border-collapse:collapse;
  font-size:10pt;
  margin:3mm 0;
  break-inside:avoid;
  page-break-inside:avoid;
}
th,td{
  border:1px solid var(--goud-licht);
  padding:2mm 2.5mm;
  text-align:left;
  vertical-align:top;
}
th{
  background:#f1e7c9;
  font-family:__SANS_TABEL__;
  font-weight:bold;
  font-size:9.5pt;
}

.rcallout{
  background:var(--room);
  border-left:3.5px solid var(--goud);
  padding:2.6mm 3.5mm;
  margin:3mm 0;
  break-inside:avoid;
  page-break-inside:avoid;
}
.rcallout.warn{
  background:#fbeae9;
  border-left-color:var(--rood);
}

b{ font-weight:bold; }
"""

HTML_SJABLOON = """<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8">
<title>Baarden - Officiele spelregels</title>
<style>{css}</style></head>
<body>{inhoud}</body></html>"""


def haal_regels_uit(html: str) -> str:
    """Knip de inhoud van de eerste .rules-box uit het spelbestand."""
    start = html.find('<div class="rules-box">')
    if start == -1:
        raise SystemExit("Kon <div class=\"rules-box\"> niet vinden in het HTML-bestand.")

    # Loop de div-nesting af tot de bijbehorende sluit-tag.
    i = start
    diepte = 0
    for m in re.finditer(r'<div\b[^>]*>|</div>', html[start:]):
        diepte += 1 if m.group(0).startswith('<div') else -1
        if diepte == 0:
            i = start + m.end()
            break
    else:
        raise SystemExit("De rules-box is niet netjes afgesloten.")

    blok = html[start:i]
    # De knoppenbalk hoort niet in een PDF.
    blok = re.sub(r'<div class="rules-actions">.*?</div>\s*', '', blok, flags=re.S)
    # Buitenste <div class="rules-box"> ... </div> eraf.
    blok = blok[blok.index('>') + 1: blok.rindex('</div>')]
    return blok.strip()


def maak_pdf(inhoud_html: str, doel: pathlib.Path):
    from playwright.sync_api import sync_playwright

    css = (PRINT_CSS.replace('__SERIF__', SERIF)
                    .replace('__SANS_TABEL__', SANS_TABEL)
                    .replace('__SANS__', SANS))
    document = HTML_SJABLOON.format(css=css, inhoud=inhoud_html)
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False,
                                     encoding='utf-8') as fh:
        fh.write(document)
        tijdelijk = fh.name

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(pathlib.Path(tijdelijk).as_uri())
        page.emulate_media(media='print')
        page.pdf(path=str(doel), format='A4', print_background=True,
                 margin={'top': '18mm', 'bottom': '20mm',
                         'left': '19mm', 'right': '19mm'})
        browser.close()

    pathlib.Path(tijdelijk).unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spelbestand')
    ap.add_argument('--alleen-pdf', metavar='PAD',
                    help='schrijf alleen de PDF weg, werk het spelbestand niet bij')
    args = ap.parse_args()

    pad = pathlib.Path(args.spelbestand)
    html = pad.read_text(encoding='utf-8')

    inhoud = haal_regels_uit(html)
    # Versieregel onder de titel.
    inhoud = inhoud.replace(
        '<div class="rsub">Officiële spelregels</div>',
        f'<div class="rsub">Officiële spelregels · {VERSIE}</div>')

    doel = pathlib.Path(args.alleen_pdf) if args.alleen_pdf \
        else pathlib.Path(tempfile.gettempdir()) / 'baarden-spelregels.pdf'
    maak_pdf(inhoud, doel)
    print(f"PDF gemaakt: {doel}  ({doel.stat().st_size/1024:.0f} KB)")

    if args.alleen_pdf:
        return

    b64 = base64.b64encode(doel.read_bytes()).decode('ascii')
    nieuw, aantal = re.subn(
        r'(const BAARDEN_RULES_PDF_B64 = ")[A-Za-z0-9+/=]*(")',
        lambda m: m.group(1) + b64 + m.group(2), html, count=1)
    if aantal != 1:
        raise SystemExit("Kon BAARDEN_RULES_PDF_B64 niet vervangen.")

    pad.write_text(nieuw, encoding='utf-8')
    print(f"{pad.name} bijgewerkt met de nieuwe PDF.")


if __name__ == '__main__':
    main()
