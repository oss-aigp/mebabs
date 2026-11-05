  /* ================================================================== Help: per pagina een uitleg in een paneel rechts (knop ? of F1) */
  var BACKUP_HTML = '<h3>Back-up maken</h3><ol>' +
    '<li>Sluit MeBabs.</li>' +
    '<li>Kopieer de <b>hele map <code>mebabs-data</code></b>, mét het bestand <code>mebabs.json</code> erin, naar bijvoorbeeld OneDrive, een netwerkschijf of een USB-stick.</li></ol>' +
    '<p><code>mebabs.json</code> is het register van MeBabs: daarin staan de vergaderingen, aantekeningen, acties en je markeringen en opmerkingen in de PDF\'s. Zonder dat bestand zijn alleen de losse stukken terug te halen.</p>' +
    '<h3>Back-up terugzetten</h3><ol><li>Zet de gekopieerde map <code>mebabs-data</code> terug, bijvoorbeeld in <code>Documenten\\MeBabs</code>.</li>' +
    '<li>Open MeBabs, klik rechtsboven bij de map op <b>wijzig</b> en kies die map <code>mebabs-data</code>.</li></ol>' +
    '<p class="muted">Losse vergadermappen terugkopiëren in <code>Vergaderingen</code> werkt niet: MeBabs werkt vanuit <code>mebabs.json</code>. Zet altijd de hele map terug.</p>';

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
      '<li>Vandaag kun je in- en uitklappen met <b>weergeven</b>/<b>verbergen</b>. Na 20:30 is het standaard ingeklapt.</li></ul>' +
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
      '<li>Download op de pagina <a href="#/installatie">MeBabs installeren</a> de snelkoppeling, sleep hem naar het bureaublad en van daar naar de taakbalk.</li></ol>' +
      '<p>Bij elke start vraagt de browser één keer of MeBabs de map weer mag gebruiken: klik op <b>Map openen</b> en <b>Toestaan</b>.</p>' +
      '<h3>Bijwerken naar een nieuwe versie</h3><p>Vervang <code>MeBabs.html</code> door de nieuwe versie. Je gegevens in <code>mebabs-data</code> blijven staan.</p>' + BACKUP_HTML },
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
  function openHelp() {
    var old = $('#helpPanel'); if (old) { closeHelp(); return; }
    var k = helpTopic(), t = HELP[k], bg = D.createElement('div'), p = D.createElement('aside');
    bg.className = 'helpbg'; bg.id = 'helpBg'; p.className = 'helppanel'; p.id = 'helpPanel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-labelledby', 'helpT');
    setHTML(p, '<div class="helphead"><span class="helpq">?</span><h2 id="helpT">Help: ' + esc(t.t) + '</h2><button type="button" class="helpx" id="helpX" title="Sluiten (Esc)" aria-label="Sluiten">✕</button></div>' +
      '<div class="helpbody">' + t.h + '<hr><p class="muted">Andere onderwerpen: ' + Object.keys(HELP).filter(function (x) { return x !== k; }).map(function (x) { return '<button type="button" class="link" data-help="' + x + '">' + esc(HELP[x].t) + '</button>'; }).join(' · ') + '</p></div>');
    D.body.appendChild(bg); D.body.appendChild(p);
    requestAnimationFrame(function () { bg.classList.add('on'); p.classList.add('on'); });
    bg.onclick = closeHelp; $('#helpX').onclick = closeHelp;
    $$('[data-help]', p).forEach(function (b) { b.onclick = function () { var x = b.dataset.help; setHTML($('#helpT'), 'Help: ' + esc(HELP[x].t)); var body = $('.helpbody', p); setHTML(body, HELP[x].h + '<hr><p class="muted"><button type="button" class="link" id="helpBack">‹ Terug naar ' + esc(t.t) + '</button></p>'); body.scrollTop = 0; $('#helpBack').onclick = function () { closeHelp(); openHelp(); }; bindLinks(); }; });
    function bindLinks() { $$('.helpbody a[href^="#"]', p).forEach(function (a) { a.addEventListener('click', closeHelp); }); }
    bindLinks();
    $('#helpX').focus();
  }
  function closeHelp() { var p = $('#helpPanel'), bg = $('#helpBg'); if (p) p.remove(); if (bg) bg.remove(); }
  function initHelp() {
    var b = $('#helpBtn'); if (b) b.onclick = openHelp;
    D.addEventListener('keydown', function (e) {
      if (e.key === 'F1') { e.preventDefault(); openHelp(); }
      else if (e.key === 'Escape' && $('#helpPanel')) { e.stopPropagation(); closeHelp(); }
    }, true);
    W.addEventListener('hashchange', closeHelp);
  }
