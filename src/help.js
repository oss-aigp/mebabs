  /* ================================================================== Help: per pagina een uitleg in een paneel rechts (knop ? of F1) */
  var BACKUP_HTML = '<h3>Back-up maken</h3><ol>' +
    '<li>Sluit MeBabs.</li>' +
    '<li>Kopieer de <b>hele map <code>mebabs-data</code></b>, mét het bestand <code>mebabs.json</code> erin, naar bijvoorbeeld OneDrive, een netwerkschijf of een USB-stick.</li></ol>' +
    '<p><code>mebabs.json</code> is het register van MeBabs: daarin staan de vergaderingen, aantekeningen, acties en je markeringen en opmerkingen in de PDF\'s. Zonder dat bestand zijn alleen de losse stukken terug te halen.</p>' +
    '<h3>Back-up terugzetten</h3><ol><li>Zet de gekopieerde map <code>mebabs-data</code> terug, bijvoorbeeld in <code>Documenten\\MeBabs</code>.</li>' +
    '<li>Open MeBabs, klik rechtsboven bij de map op <b>wijzig</b> en kies die map <code>mebabs-data</code>.</li></ol>' +
    '<p class="muted">Losse vergadermappen terugkopiëren in <code>Vergaderingen</code> werkt niet: MeBabs werkt vanuit <code>mebabs.json</code>. Zet altijd de hele map terug.</p>';

  var GITHUB = 'https://github.com/oss-aigp/mebabs', GITHUB_DL = 'https://github.com/oss-aigp/mebabs/blob/main/dist/MeBabs.html';
  /* versienummer staat als opmerking bovenaan het bestand (<!-- MeBabs-versie: x -->) */
  function mebabsVersion() { for (var n = D.firstChild; n; n = n.nextSibling) { if (n.nodeType === 8) { var m = /MeBabs-versie:\s*([^\s]+)/.exec(n.nodeValue); if (m) return m[1]; } } return ''; }
  var UPGRADE_HTML = '<ol><li>Maak eerst een back-up: kopieer de hele map <code>mebabs-data</code>.</li>' +
    '<li>Open <a href="' + GITHUB_DL + '" target="_blank" rel="noopener">MeBabs.html op GitHub</a> en klik rechtsboven op het pijltje <b>Download raw file</b>. Het bestand komt in je map <b>Downloads</b>.</li>' +
    '<li>Sluit MeBabs (alle tabbladen met MeBabs).</li>' +
    '<li>Verplaats het gedownloade <code>MeBabs.html</code> naar <code>Documenten\\MeBabs</code> en kies <b>Het bestand in de doelmap vervangen</b>. Heet het bestand in Downloads <code>MeBabs (1).html</code>, geef het dan eerst de naam <code>MeBabs.html</code>.</li>' +
    '<li>Open MeBabs weer via je snelkoppeling. Je vergaderingen staan er gewoon: die staan in <code>mebabs-data</code>, niet in het HTML-bestand.</li></ol>' +
    '<p class="muted">Je gebruikt nu versie <b>' + esc(mebabsVersion() || 'onbekend') + '</b>. Welke versie de nieuwste is, zie je op <a href="' + GITHUB + '" target="_blank" rel="noopener">GitHub</a> bij de laatste wijziging.</p>';
  var SHORTCUT_HTML = '<ol><li>Klik met de rechtermuisknop op een lege plek op het bureaublad en kies <b>Nieuw</b> › <b>Snelkoppeling</b>.</li>' +
    '<li>Typ of plak bij <i>Typ de locatie van het item</i>: <code>C:\\Windows\\explorer.exe "C:\\Users\\JOUWNAAM\\Documents\\MeBabs\\MeBabs.html"</code>, met het pad naar jouw <code>MeBabs.html</code>. Op de pagina <a href="#/installatie">MeBabs installeren</a> staat de regel met jouw pad en een knop Kopiëren.</li>' +
    '<li>Klik op <b>Volgende</b>, noem hem <b>MeBabs</b> en klik op <b>Voltooien</b>.</li>' +
    '<li>Rechtermuisknop › <b>Eigenschappen</b> › <b>Ander pictogram…</b> › <b>Bladeren</b> en kies <code>MeBabs.ico</code> naast <code>MeBabs.html</code>.</li>' +
    '<li>Sleep de snelkoppeling naar de <b>taakbalk</b>. Dat kan omdat het doel <code>explorer.exe</code> is en niet het HTML-bestand zelf.</li></ol>';
  var FAQ = [
    ['Hoe installeer ik MeBabs?', '<ol><li>Download <a href="' + GITHUB_DL + '" target="_blank" rel="noopener">MeBabs.html van GitHub</a> (rechtsboven: <b>Download raw file</b>).</li>' +
      '<li>Maak in <b>Documenten</b> een map <b>MeBabs</b> en zet <code>MeBabs.html</code> daarin.</li>' +
      '<li>Dubbelklik op het bestand. Het opent in Edge of Chrome. Werkt het in een andere browser, kies dan met de rechtermuisknop <b>Openen met › Microsoft Edge</b>.</li>' +
      '<li>Klik op <b>Datamap kiezen</b> en kies de map <b>MeBabs</b>. MeBabs maakt daarin <code>mebabs-data</code> aan en zet het icoon <code>MeBabs.ico</code> ernaast.</li>' +
      '<li>Maak een snelkoppeling op het bureaublad en in de taakbalk (zie de vraag hieronder).</li></ol>'],
    ['Hoe maak ik een snelkoppeling op het bureaublad en in de taakbalk?', SHORTCUT_HTML],
    ['Hoe maak ik een back-up, en hoe zet ik die terug?', BACKUP_HTML],
    ['Hoe upgrade ik MeBabs naar een nieuwe versie?', UPGRADE_HTML],
    ['Ik wil MeBabs zelf doorontwikkelen. Hoe doe ik dat?', '<p>De broncode staat openbaar op <a href="' + GITHUB + '" target="_blank" rel="noopener">GitHub</a>.</p><ol>' +
      '<li>Installeer <a href="https://nodejs.org/" target="_blank" rel="noopener">Node.js</a> (versie 18 of nieuwer) en Git.</li>' +
      '<li>Haal de code op: <code>git clone ' + GITHUB + '.git</code>, of download de ZIP via de groene knop <b>Code</b>.</li>' +
      '<li>Ga in de map staan en voer <code>npm install</code> uit, daarna <code>npm run build</code>. Dat maakt <code>dist/MeBabs.html</code>.</li>' +
      '<li>De code staat in <code>src/</code>: <code>app.html</code> (HTML en alle opmaak), <code>app-ui.js</code> (schermen en opslag), <code>mail-parser.js</code> (mails en agenda lezen), <code>convert.js</code> en <code>pptx-render.js</code> (omzetten naar PDF), <code>editor.js</code> (bewerken), <code>notes.js</code>, <code>reports.js</code>, <code>files.js</code> en <code>help.js</code>.</li>' +
      '<li>Test je wijziging door <code>dist/MeBabs.html</code> in Edge te openen. Verhoog bij een nieuwe versie het versienummer in <code>package.json</code>.</li>' +
      '<li>Wil je je wijziging teruggeven? Maak een eigen kopie (<b>Fork</b>) op GitHub en stuur een <b>pull request</b>.</li></ol>' +
      '<p class="muted">In <code>CLAUDE.md</code> staan de werkafspraken, ook handig als je met een AI-assistent werkt. Er staat nog geen licentie in de repository: wil je MeBabs buiten je eigen gebruik verspreiden of aanpassen, overleg dan met de eigenaar.</p>'],
    ['Hoe zit het met de veiligheid van mijn informatie?', '<ul>' +
      '<li><b>Alles blijft op je eigen computer.</b> MeBabs is één HTML-bestand dat in je browser draait. Er is geen server en geen account, en MeBabs stuurt geen mails, stukken of aantekeningen naar internet. Alle onderdelen zitten in het bestand zelf, dus MeBabs werkt ook zonder internet.</li>' +
      '<li><b>Toegang tot één map.</b> MeBabs kan alleen bij de datamap die jij kiest, en pas nadat je browser daar toestemming voor heeft gevraagd. Daarom vraagt de browser bij elke start of MeBabs de map weer mag gebruiken.</li>' +
      '<li><b>Je gegevens zijn gewone bestanden</b> in <code>mebabs-data</code>, niet versleuteld. Ze zijn net zo goed beveiligd als je andere documenten: via je Windows-account en de beveiliging van je werkplek.</li>' +
      '<li><b>OneDrive.</b> Wordt je map Documenten met OneDrive gesynchroniseerd, dan komt <code>mebabs-data</code> ook in de OneDrive van je organisatie. Voor gewone werkstukken is dat meestal prima; volg voor vertrouwelijke of gerubriceerde informatie de regels van je organisatie.</li>' +
      '<li><b>Bewaar je alles in de browser</b>, dan staan de gegevens in je browserprofiel op deze computer. Wis je de browsergegevens, dan ben je ze kwijt: maak dan regelmatig een export.</li>' +
      '<li><b>Wat wel naar buiten gaat:</b> alleen wat je zelf doet, zoals <b>Deelnemen</b> (opent de Teams-link), een conceptmail die je in Outlook verstuurt, of een link naar GitHub in deze help.</li>' +
      '<li><b>Let op bij delen:</b> een PDF die je downloadt met aantekeningen, of de export als één PDF, bevat je markeringen en opmerkingen.</li></ul>'],
    ['Waarom vraagt de browser elke keer om toestemming?', '<p>Dat is een beveiligingsregel van de browser: een webpagina mag pas bij een map op je computer als jij daar in die sessie toestemming voor geeft. Klik op <b>Map openen</b> en daarna op <b>Toestaan</b>.</p>'],
    ['Kan ik MeBabs op meerdere computers gebruiken?', '<p>Ja, maar niet tegelijk met dezelfde gegevens. Kopieer de hele map <code>mebabs-data</code> naar de andere computer en kies daar die map. Werk niet op twee computers tegelijk in dezelfde map (bijvoorbeeld via OneDrive): dan kunnen wijzigingen elkaar overschrijven.</p>'],
  ];
  var ABOUT_HTML = '<p><b>MeBabs</b> is een vergaderapp in één HTML-bestand. Je sleept mails en uitnodigingen uit Outlook erin, en MeBabs maakt er vergaderingen van met alle stukken, die je kunt lezen, markeren, bewerken en exporteren. Alles blijft op je eigen computer.</p>' +
    '<h3>Zo werkt het</h3><ol><li><b>Vergaderingen maken</b>: sleep een mail of uitnodiging erin, of lees met <b>Importeer weekagenda</b> je Outlook-agenda in. Titel, datum, tijd, locatie, vergaderlink, genodigden en bijlagen worden overgenomen.</li>' +
    '<li><b>Stukken</b>: Word, Excel, PowerPoint, afbeeldingen en mails worden automatisch omgezet naar PDF. In de viewer kun je zoeken, markeren en opmerkingen maken; bij Bewerken pas je het origineel aan.</li>' +
    '<li><b>Vergaderen</b>: met <b>Deelnemen</b> open je de online vergadering, met <b>✎ Aantekeningen</b> maak je aantekeningen. Regels die met <code>!</code> beginnen, worden acties.</li>' +
    '<li><b>Afronden</b>: <b>Exporteer als één PDF</b> maakt één document met agenda, stukken en aantekeningen. Verslagen en acties vind je terug in de tabbladen <b>Verslagen</b> en <b>Actielijst</b>.</li>' +
    '<li><b>Terugvinden</b>: in <b>Bestanden</b> staan alle stukken, met versies, en kun je ze openen, downloaden en mailen.</li></ol>' +
    '<h3>Waar staat wat?</h3><pre class="tree">Documenten\\MeBabs\\\n  MeBabs.html      de app\n  MeBabs.ico       het icoon\n  mebabs-data\\     je gegevens\n    Vergaderingen\\  per vergadering de stukken\n    Aantekeningen\\  de verslagen als .txt\n    Actielijst\\     Actielijst.txt\n    mebabs.json     het register</pre>' +
    '<h3>Tabbladen</h3><ul><li><b>Vergaderingen</b>: vandaag, morgen, volgende vergaderingen en het archief.</li><li><b>Verslagen</b>: alle aantekeningen als verslag, met een Word-achtige editor.</li><li><b>Actielijst</b>: alle acties, met afvinken, snoozen en een begindatum.</li><li><b>Bestanden</b>: een verkenner met alle stukken.</li></ul>' +
    '<p>De volledige handleiding staat in de <a href="' + GITHUB + '#readme" target="_blank" rel="noopener">README op GitHub</a>.</p>';
  var HELP = {
    home: { t: 'Vergaderingen', h:
      '<p>Het startscherm met je vergaderingen van vandaag en morgen, en de lijsten met volgende en eerdere vergaderingen.</p>' +
      '<h3>Een vergadering maken</h3><ul>' +
      '<li><b>Sleep een mail of uitnodiging</b> uit Outlook naar het venster. MeBabs haalt titel, datum, tijd, locatie, vergaderlink en genodigden eruit en zet de bijlagen als stukken klaar. Controleer alles en klik op <b>Opslaan</b>.</li>' +
      '<li>Lukt slepen niet (soms in de nieuwe Outlook)? Sleep de mail eerst naar het bureaublad en dan naar MeBabs, of gebruik <b>Mail importeren…</b>.</li>' +
      '<li>Meerdere mails tegelijk slepen maakt meerdere vergaderingen in één keer.</li>' +
      '<li>Bij een <b>terugkerende afspraak</b> krijgt de vergadering de datum en tijd van de eerstvolgende keer.</li>' +
      '<li><b>📅 Importeer weekagenda</b> leest je hele Outlook-agenda van de komende dagen in één keer in.</li>' +
      '<li><b>+ Nieuwe vergadering</b> maakt een lege vergadering die je zelf invult.</li></ul>' +
      '<h3>De balk bovenaan</h3><p>Een begroeting met het aantal vergaderingen van vandaag, en een willekeurige wijsheid of uitspraak over leiderschap. Met <b>↻</b> zie je een andere.</p>' +
      '<h3>Vandaag en Morgen</h3><ul><li>Klik op een vergadering om hem te openen.</li><li><b>Deelnemen</b> opent de Teams-, Zoom- of andere vergaderlink.</li>' +
      '<li>Vandaag en Morgen kun je in- en uitklappen met <b>weergeven</b>/<b>verbergen</b>; in de kop zie je hoeveel vergaderingen er zijn. Vandaag is na 20:30 standaard ingeklapt, Morgen staat standaard open.</li></ul>' +
      '<h3>Volgende vergaderingen en Archief</h3><ul><li>Beide lijsten zijn standaard ingeklapt. Klik op de kop of op <b>weergeven</b>.</li>' +
      '<li>Volgende vergaderingen begint bij overmorgen. Het Archief bevat de vergaderingen die geweest zijn.</li>' +
      '<li>Klik op een kolomkop om te sorteren. Met het zoekvak zoek je op titel, locatie, namen en aantekeningen; met het keuzemenu kies je een jaar.</li></ul>' +
      '<h3>Vergaderingen verwijderen</h3><ul><li>Vink vergaderingen aan (of het vinkje in de kop voor de hele lijst). Onderaan verschijnt een balk met <b>🗑 Verwijderen</b>.</li>' +
      '<li>Daarbij wordt alles gewist wat erbij hoort: de map met stukken, de originele mail, gewijzigde versies, de aantekeningen en de acties. Dit kun je niet ongedaan maken.</li></ul>' },
    meeting: { t: 'Een vergadering', h:
      '<h3>Gegevens</h3><ul><li>Titel, datum, tijd, locatie, vergaderlink en genodigden pas je bovenaan aan. Klik op <b>Opslaan</b> om ze te bewaren.</li>' +
      '<li>Genodigden scheid je met komma\'s. De <b>eerste naam is de voorzitter</b>.</li>' +
      '<li><b>Deelnemen</b> verschijnt zodra er een vergaderlink is.</li></ul>' +
      '<h3>Stukken</h3><ul><li>Sleep documenten op de vergadering of klik op <b>+ Toevoegen</b>. Word, Excel, PowerPoint, afbeeldingen, tekst en mails worden automatisch omgezet naar PDF.</li>' +
      '<li>Met <b>▲ ▼</b> bepaal je de volgorde; die geldt ook voor de export. <b>⤓</b> downloadt het origineel, <b>✕</b> verwijdert het stuk.</li>' +
      '<li>Sleep je een bestand met <b>dezelfde naam</b> erop, dan vraagt MeBabs of de oude versie vervangen moet worden.</li>' +
      '<li>Een stuk met het label "geen PDF" (bijvoorbeeld een oud .doc-bestand) zet je zelf om in Word via <b>Opslaan als › PDF</b> en sleep je daarna op de vergadering.</li></ul>' +
      '<h3>De viewer (tabblad PDF)</h3><ul>' +
      '<li><b>Tekst</b>: tekst selecteren en kopiëren (Ctrl+C).</li>' +
      '<li><b>Markeren</b>: selecteer tekst; die wordt geel of groen gemarkeerd. Kies de kleur met de bolletjes.</li>' +
      '<li><b>Opmerking</b>: klik op een woord en typ. De opmerking komt in de rechtermarge; Ctrl+Enter is klaar.</li>' +
      '<li><b>Gum</b>: klik op een markering of opmerking om hem weg te halen.</li>' +
      '<li><b>↶ ↷</b>: ongedaan maken en opnieuw, tot 20 stappen (Ctrl+Z en Ctrl+Y).</li>' +
      '<li><b>Zoeken</b>: Ctrl+F, daarna Enter voor de volgende treffer en Shift+Enter voor de vorige.</li>' +
      '<li><b>− 100% +</b>: kleiner en groter. Klik op het percentage om de pagina weer passend te maken.</li>' +
      '<li><b>Vierkantje met hoekjes</b>: de viewer vergroten tot het hele venster. Nog eens klikken of Esc maakt hem weer klein.</li>' +
      '<li><b>⋯</b>: het stuk downloaden met je aantekeningen, alle aantekeningen wissen, het origineel downloaden of de PDF in een nieuw tabblad openen.</li></ul>' +
      '<h3>Bewerken</h3><ul><li>Het tabblad <b>Bewerken</b> boven de viewer past het originele bestand aan.</li>' +
      '<li>Word: stijlen, vet, cursief, onderstrepen, opsomming en uitlijnen. Excel: typ in een cel; Enter, Tab en de pijltjes bewegen, F2 past een cel aan, Delete wist, met = begin je een formule. PowerPoint: klik in een tekstvak op de dia.</li>' +
      '<li>Opslaan met <b>💾 Opslaan</b> of Ctrl+S. De eerste keer bewaart MeBabs een kopie "(oorspronkelijk)" en daarna wordt de PDF bijgewerkt.</li>' +
      '<li>Liever in Office zelf? Download het stuk met ⤓, bewerk het en sleep het met dezelfde naam terug op de vergadering.</li></ul>' +
      '<h3>Aantekeningen en acties</h3><ul><li><b>✎ Aantekeningen</b> opent een kolom rechts. Alles wordt vanzelf bewaard en ook als tekstbestand in de map Aantekeningen gezet.</li>' +
      '<li>Een regel die begint met <code>!</code> wordt een actie, bijvoorbeeld <code>! Jan stuurt de notitie rond</code>. Die staat daarna in de Actielijst.</li></ul>' +
      '<h3>Exporteren en verwijderen</h3><ul><li><b>Exporteer als één PDF</b> maakt één bestand met een agendapagina, alle stukken met paginanummers en bladwijzers, en je aantekeningen. Het komt in Downloads en in de map van de vergadering.</li>' +
      '<li><b>Verwijder</b> wist de vergadering met al haar stukken. Je aantekeningen blijven in de map Aantekeningen staan.</li></ul>' },
    reports: { t: 'Verslagen', h:
      '<p>Alle aantekeningen van je vergaderingen op een rij, als verslagen.</p><ul>' +
      '<li>Sorteer op naam, vergaderdatum of datum gewijzigd door op de kolomkop te klikken. Zoek met het zoekvak in titels en tekst.</li>' +
      '<li>Vink <b>Ook vergaderingen zonder aantekeningen</b> aan om ook vergaderingen zonder verslag te zien, bijvoorbeeld om er een te beginnen.</li>' +
      '<li>Klik op een verslag om het te bewerken in een Word-achtige editor: koppen, vet, cursief, onderstreept en lijsten. Wijzigingen worden vanzelf bewaard.</li>' +
      '<li>Regels die met <code>!</code> beginnen, zijn acties en staan ook in de Actielijst.</li>' +
      '<li>Elk verslag staat ook als tekstbestand in de map <code>mebabs-data\\Aantekeningen</code>, als <code>jjjjmmdd Titel.txt</code>. Pas die bestanden niet buiten MeBabs aan: MeBabs schrijft ze opnieuw bij de volgende wijziging.</li></ul>' },
    actions: { t: 'Actielijst', h:
      '<p>Alle acties uit je aantekeningen, met de datum van de vergadering. Een actie maak je in de aantekeningen met een regel die begint met <code>!</code>.</p><ul>' +
      '<li>Met de knoppen bovenaan kies je wat je ziet: <b>Open</b>, <b>⏰ Gesnoozed</b>, <b>Afgerond</b>, <b>Alle</b>, en <b>Verwijderd</b> als je acties van de lijst hebt gehaald.</li>' +
      '<li>Klik op de tekst om een actie te bewerken. Vink hem af als hij klaar is.</li>' +
      '<li><b>⏰ Snoozen</b> verbergt een actie tot morgen, overmorgen, volgende week of een datum die je kiest. Daarna staat hij weer bij Open.</li>' +
      '<li>Een <b>begindatum</b> zegt vanaf wanneer je met een actie aan de slag gaat.</li>' +
      '<li><b>Van de lijst halen</b> verwijdert de actie uit dit overzicht; de regel blijft in de aantekeningen staan. Onder Verwijderd zet je hem terug.</li>' +
      '<li>Klik op de vergadering om ernaartoe te gaan. De actielijst staat ook als <code>Actielijst.txt</code> in de map Actielijst.</li></ul>' },
    files: { t: 'Bestanden', h:
      '<p>Een verkenner met alle stukken uit je datamap. Je kunt hier bestanden bekijken, downloaden en mailen, maar niet bewerken.</p><ul>' +
      '<li>Links kies je een map, of <b>Alle bestanden</b>. Zoek met het zoekvak en filter per kolom.</li>' +
      '<li>Hetzelfde stuk in een ander formaat of een vorige versie (PDF-versie, "(oorspronkelijk)") staat op één regel. Klik met de rechtermuisknop of op <b>versies</b> om alle versies te zien, elk met openen, mailen en downloaden.</li>' +
      '<li>Dubbelklik of <b>👁</b> opent een bestand, <b>⤓</b> downloadt het, <b>✉</b> maakt een conceptmail met het bestand als bijlage: open het gedownloade bestand en Outlook start een nieuwe mail.</li>' +
      '<li><b>Vergadering ›</b> opent de bijbehorende vergadering, met het stuk in de viewer.</li>' +
      '<li><b>🗑 Verwijderen</b> haalt een bestand alleen uit dit overzicht; in de vergadering blijft het staan. Met <b>Verwijderd tonen</b> en <b>↩ Terugzetten</b> haal je het terug.</li>' +
      '<li>Selecteer meerdere bestanden met de vinkjes (of Ctrl+klik) om ze in één keer te openen, downloaden, mailen of verwijderen.</li></ul>' },
    week: { t: 'Weekagenda importeren', h:
      '<p>Je Outlook-agenda van de komende dagen in één keer inlezen als vergaderingen.</p>' +
      '<h3>1. Agenda opslaan in Outlook</h3><ol><li>Ga naar <b>Agenda</b> en klik links op je eigen agenda.</li><li>Kies <b>Bestand › Agenda opslaan in bestand</b> en klik op <b>Meer opties</b>.</li>' +
      '<li>Kies bijvoorbeeld <i>Volgende 7 dagen</i> en <i>Volledige details</i>. Wil je bijlagen als stukken, vink dan onder Geavanceerd <b>Bijlagen bij agenda-items opnemen</b> aan.</li></ol>' +
      '<p>Sneller: zet de opdracht <b>Opslaan als agenda</b> in de werkbalk Snelle toegang. Hoe dat gaat, staat onderaan de pagina.</p>' +
      '<h3>2. Inlezen en kiezen</h3><ul><li>Kies het .ics-bestand of sleep het in MeBabs. Je ziet eerst een lijst: <b>Nieuw</b>, <b>Bijwerken</b> of <b>Staat er al</b>.</li>' +
      '<li>Klik op een regel om hem aan of uit te zetten en klik op <b>Importeer geselecteerde</b>. Wat je uitvinkt, staat de volgende keer ook uit.</li>' +
      '<li>Blokken, reistijd, uitloop en korte afspraken direct naast een andere vergadering worden overgeslagen. Met <b>⚙ Niet importeren…</b> beheer je de trefwoorden en minuten, en geef je eerder uitgevinkte titels weer vrij.</li>' +
      '<li>Hele-dag-afspraken, geannuleerde afspraken, afspraken die geweest zijn en afspraken zonder titel worden niet geïmporteerd.</li></ul>' +
      '<h3>Wat er gebeurt</h3><ul><li>Elke afspraak wordt een vergadering met datum, tijd, locatie, vergaderlink en genodigden (de organisator vooraan).</li>' +
      '<li>Bijlagen worden stukken; mails als bijlage worden omgezet naar PDF.</li>' +
      '<li>Opnieuw importeren werkt bestaande vergaderingen bij; stukken en aantekeningen blijven staan. Een afspraak die je in Outlook verwijdert, blijft in MeBabs staan.</li></ul>' },
    install: { t: 'Installatie en back-up', h:
      '<h3>Installeren</h3><ol><li>Zet <code>MeBabs.html</code> in <code>Documenten\\MeBabs</code>.</li>' +
      '<li>Open het bestand in Edge of Chrome en klik op <b>Datamap kiezen</b>. Kies de map <b>MeBabs</b>; MeBabs maakt daarin <code>mebabs-data</code> aan en zet <code>MeBabs.ico</code> naast <code>MeBabs.html</code>.</li>' +
      '<li>Maak een snelkoppeling op het bureaublad en sleep hem naar de taakbalk (zie hieronder).</li></ol>' +
      '<p>Bij elke start vraagt de browser één keer of MeBabs de map weer mag gebruiken: klik op <b>Map openen</b> en <b>Toestaan</b>.</p>' +
      '<h3>Snelkoppeling</h3>' + SHORTCUT_HTML + '<h3>Bijwerken naar een nieuwe versie</h3>' + UPGRADE_HTML + BACKUP_HTML },
  };
  function helpTopic() {
    var h = location.hash || '#/';
    if (!A.store) return 'install';
    if (h === '#/nieuw' || /^#\/v\//.test(h)) return 'meeting';
    if (/^#\/verslag/.test(h)) return 'reports';
    if (h === '#/acties') return 'actions';
    if (h === '#/bestanden') return 'files';
    if (h === '#/weekagenda') return 'week';
    if (h === '#/installatie') return 'install';
    return 'home';
  }
  function faqHtml() { return '<p>Klik op een vraag voor het antwoord.</p>' + FAQ.map(function (q) { return '<details class="faq"><summary>' + esc(q[0]) + '</summary><div>' + q[1] + '</div></details>'; }).join(''); }
  function openHelp(tab) {
    if ($('#helpPanel')) { closeHelp(); return; }
    var k = helpTopic(), bg = D.createElement('div'), p = D.createElement('aside');
    bg.className = 'helpbg'; bg.id = 'helpBg'; p.className = 'helppanel'; p.id = 'helpPanel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-labelledby', 'helpT');
    setHTML(p, '<div class="helphead"><span class="helpq">?</span><h2 id="helpT">Help</h2><button type="button" class="helpx" id="helpX" title="Sluiten (Esc)" aria-label="Sluiten">✕</button></div>' +
      '<div class="helptabs" role="tablist"><button type="button" role="tab" data-tab="page">' + esc(HELP[k].t) + '</button><button type="button" role="tab" data-tab="faq">Veelgestelde vragen</button><button type="button" role="tab" data-tab="about">Hoe werkt MeBabs</button></div>' +
      '<div class="helpbody" id="helpBody"></div><div class="helpfoot">MeBabs ' + esc(mebabsVersion()) + ' · <a href="' + GITHUB + '" target="_blank" rel="noopener">GitHub</a></div>');
    D.body.appendChild(bg); D.body.appendChild(p);
    requestAnimationFrame(function () { bg.classList.add('on'); p.classList.add('on'); });
    bg.onclick = closeHelp; $('#helpX').onclick = closeHelp;
    function show(t, topic) {
      var body = $('#helpBody'), key = topic || k;
      $$('[data-tab]', p).forEach(function (b) { var on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      if (t === 'faq') setHTML(body, faqHtml());
      else if (t === 'about') setHTML(body, ABOUT_HTML);
      else setHTML(body, '<h2 class="helph">' + esc(HELP[key].t) + '</h2>' + HELP[key].h + '<hr><p class="muted">Andere onderwerpen: ' + Object.keys(HELP).filter(function (x) { return x !== key; }).map(function (x) { return '<button type="button" class="link" data-help="' + x + '">' + esc(HELP[x].t) + '</button>'; }).join(' · ') + '</p>');
      body.scrollTop = 0;
      $$('[data-help]', body).forEach(function (b) { b.onclick = function () { show('page', b.dataset.help); }; });
      $$('a[href^="#"]', body).forEach(function (a) { a.addEventListener('click', closeHelp); });
    }
    $$('[data-tab]', p).forEach(function (b) { b.onclick = function () { show(b.dataset.tab); }; });
    show(tab || 'page');
    $('#helpX').focus();
  }
  function closeHelp() { var p = $('#helpPanel'), bg = $('#helpBg'); if (p) p.remove(); if (bg) bg.remove(); }
  function initHelp() {
    var b = $('#helpBtn'); if (b) b.onclick = function () { openHelp(); };
    D.addEventListener('keydown', function (e) {
      if (e.key === 'F1') { e.preventDefault(); openHelp(); }
      else if (e.key === 'Escape' && $('#helpPanel')) { e.stopPropagation(); closeHelp(); }
    }, true);
    W.addEventListener('hashchange', closeHelp);
  }
