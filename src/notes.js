  /* ================================================================== aantekeningen tijdens de vergadering + actielijst */
  var NOTES_DIR = 'Aantekeningen';
  var ACT_RE = /^(\s*)!\s*(.+?)\s*$/;
  function names(s) { return String(s || '').split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function hashStr(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function actId(m, text) { return m.id + ':' + hashStr(String(text).trim().toLowerCase()); }
  function chairOf(m) { return names(m.invitees)[0] || ''; }
  function membersOf(m) { return names(m.invitees).slice(1); }
  function addDays(iso, n) { var d = isoDate(iso) || new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nextMonday() { var d = new Date(), k = (8 - d.getDay()) % 7 || 7; return addDays(todayIso(), k); }
  function fmtDay(iso) { var d = isoDate(iso); return d ? d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) : ''; }

  function meta(id) { A.data.act = A.data.act || {}; return A.data.act[id] || {}; }
  function setMeta(id, k, v) { A.data.act = A.data.act || {}; var o = A.data.act[id] || (A.data.act[id] = {}); if (v == null || v === '') delete o[k]; else o[k] = v; if (!Object.keys(o).length) delete A.data.act[id]; }
  function migrateActions() {
    if (A.data.done) { Object.keys(A.data.done).forEach(function (id) { setMeta(id, 'done', A.data.done[id]); }); delete A.data.done; }
    A.data.meetings.forEach(function (m) { if (m.chair) { var inv = names(m.invitees); if (!inv.some(function (n) { return n.toLowerCase() === m.chair.toLowerCase(); })) inv.unshift(m.chair); m.invitees = inv.join(', '); } delete m.chair; delete m.present; });
  }
  function actionsOf(m) {
    var out = [], seen = {};
    String(m.minutes || '').split(/\r?\n/).forEach(function (l) { var c = ACT_RE.exec(l); if (!c) return; var id = actId(m, c[2]); if (seen[id]) return; seen[id] = 1; out.push({ id: id, text: c[2] }); });
    return out;
  }
  function isDone(id) { return !!meta(id).done; }
  function allActions() {
    var out = [], t = todayIso();
    A.data.meetings.forEach(function (m) {
      if (!m.minutes) return;
      actionsOf(m).forEach(function (a) {
        var mt = meta(a.id), start = mt.start || m.date || '';
        out.push({ id: a.id, text: a.text, m: m, hidden: !!mt.hidden, done: !!mt.done, start: start, snooze: mt.snooze || '', snoozed: !mt.done && !!mt.snooze && mt.snooze > t, back: !mt.done && !!mt.snooze && mt.snooze <= t });
      });
    });
    return out.sort(function (a, b) { return (b.start + (b.m.start || '')).localeCompare(a.start + (a.m.start || '')); });
  }
  function openCount() { return allActions().filter(function (a) { return !a.hidden && !a.done && !a.snoozed; }).length; }

  function minutesFileName(m) { return safe(((m.date || '').replace(/-/g, '') || 'zonder-datum') + ' ' + (m.title || 'Vergadering')) + '.txt'; }
  function minutesText(m) {
    var o = [], acts = actionsOf(m);
    o.push(m.title || 'Vergadering'); o.push('='.repeat(Math.min(70, (m.title || 'Vergadering').length)));
    o.push('Datum:      ' + (m.date ? fmtLong(m.date) : '—') + (m.start ? ', ' + m.start + (m.end ? ' – ' + m.end : '') : ''));
    if (m.location) o.push('Locatie:    ' + m.location);
    if (chairOf(m)) o.push('Voorzitter: ' + chairOf(m));
    if (membersOf(m).length) o.push('Leden:      ' + membersOf(m).join(', '));
    o.push('', 'AANTEKENINGEN', '-------------', String(m.minutes || '').replace(/\s+$/, ''), '');
    if (acts.length) { o.push('ACTIES', '------'); acts.forEach(function (a) { var mt = meta(a.id); o.push((mt.done ? '[x] ' : '[ ] ') + a.text + (mt.start ? '  (begin ' + fmtShort(mt.start) + ')' : '')); }); o.push(''); }
    o.push('(Bijgehouden in MeBabs, laatst opgeslagen ' + new Date().toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' }) + ')');
    return o.join('\r\n');
  }
  function actionListText() {
    var all = allActions().filter(function (a) { return !a.hidden; }), o = ['ACTIELIJST', '==========', ''];
    function line(a) { return (a.done ? '[x] ' : '[ ] ') + fmtShort(a.start) + '  ' + a.text + '  —  ' + a.m.title + ' (' + fmtShort(a.m.date) + ')' + (a.snoozed ? '  [gesnoozed tot ' + fmtShort(a.snooze) + ']' : ''); }
    var open = all.filter(function (a) { return !a.done && !a.snoozed; }), sn = all.filter(function (a) { return a.snoozed; }), dn = all.filter(function (a) { return a.done; });
    o.push('Open (' + open.length + ')'); open.forEach(function (a) { o.push(line(a)); });
    o.push('', 'Gesnoozed (' + sn.length + ')'); sn.forEach(function (a) { o.push(line(a)); });
    o.push('', 'Afgerond (' + dn.length + ')'); dn.forEach(function (a) { o.push(line(a)); });
    o.push('', '(Bijgehouden in MeBabs, ' + new Date().toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' }) + ')');
    return o.join('\r\n');
  }
  async function writeNotesFiles(m) {
    if (!A.store || A.store.kind !== 'map') return;
    var dir = await A.store.root.getDirectoryHandle(NOTES_DIR, { create: true });
    async function put(name, text) { var h = await dir.getFileHandle(name, { create: true }), w = await h.createWritable(); await w.write(new Blob(['﻿' + text], { type: 'text/plain' })); await w.close(); }
    if (m) {
      var name = minutesFileName(m);
      if (m.minutesFile && m.minutesFile !== name) { try { await dir.removeEntry(m.minutesFile); } catch (e) {} }
      if (m.minutes) { await put(name, minutesText(m)); m.minutesFile = name; }
      else if (m.minutesFile) { try { await dir.removeEntry(m.minutesFile); } catch (e) {} m.minutesFile = null; }
    }
    var ad = await A.store.root.getDirectoryHandle(ACTS_DIR, { create: true }), ah = await ad.getFileHandle('Actielijst.txt', { create: true }), aw = await ah.createWritable(); await aw.write(new Blob(['\ufeff' + actionListText()], { type: 'text/plain' })); await aw.close();
  }
  async function saveMinutes(m) {
    m.minutesUpdated = new Date().toISOString();
    try { await writeNotesFiles(m); } catch (e) { console.error(e); toast('Aantekeningenbestand opslaan mislukt: ' + (e.message || e), 'err'); }
    await persist(); renderSide();
  }
  function renderNotes(m) {
    var np = $('#np'); if (!np) return;
    var h = '<div class="nphead"><b>Aantekeningen</b><span class="npst" id="npst"></span><button type="button" class="link" id="npclose" title="Kolom sluiten">✕</button></div>';
    if (m.isNew) { setHTML(np, h + '<div class="pvmsg">Sla de vergadering eerst op. Daarna kun je hier aantekeningen maken.</div>'); $('#npclose').onclick = toggleNotes; return; }
    h += '<textarea id="npt" spellcheck="true" placeholder="Typ hier je aantekeningen…&#10;&#10;Begin een regel met ! voor een actie, bijvoorbeeld:&#10;! Jan stuurt de notitie rond&#10;&#10;Acties verschijnen in de Actielijst.">' + esc(m.minutes || '') + '</textarea>';
    h += '<div class="note npfile">' + (A.store.kind === 'map' ? 'Opgeslagen in Aantekeningen als ' + esc(minutesFileName(m)) : '<button type="button" class="link" id="npdl">Download als tekstbestand</button>') + '</div>';
    setHTML(np, h);
    var ta = $('#npt'), t;
    function queue() { var st = $('#npst'); if (st) { st.textContent = 'opslaan…'; st.className = 'npst'; } clearTimeout(t); t = setTimeout(async function () { t = null; await saveMinutes(m); var s2 = $('#npst'); if (s2) { s2.textContent = 'opgeslagen ✓'; s2.className = 'npst ok'; } }, 800); }
    ta.addEventListener('input', function () { m.minutes = ta.value; delete m.minutesHtml; queue(); });
    ta.addEventListener('keydown', function (e) { e.stopPropagation(); });
    $('#npclose').onclick = toggleNotes;
    var dlb = $('#npdl'); if (dlb) dlb.onclick = function () { dl(new Blob(['﻿' + minutesText(m)], { type: 'text/plain' }), minutesFileName(m)); };
    bindFolders(np);
    A.flushNotes = function () { if (t) { clearTimeout(t); t = null; return saveMinutes(m); } };
  }
  function toggleNotes() {
    A.notesOpen = !A.notesOpen; try { localStorage.setItem('mebabs-notes', A.notesOpen ? '1' : '0'); } catch (e) {}
    var ws = $('.ws'); if (ws) ws.classList.toggle('n3', A.notesOpen);
    var b = $('#npToggle'); if (b) b.classList.toggle('on', A.notesOpen);
    if (A.notesOpen) { var m = currentMeeting(); if (m) renderNotes(m); var t = $('#npt'); if (t) t.focus(); }
    if (PV.fit && $('#pvp')) setTimeout(layoutPages, 50);
  }

  /* ---------- actielijst */
  function editActionLine(a, newText) {
    var m = a.m, out = [], hit = false;
    String(m.minutes || '').split(/\r?\n/).forEach(function (l) {
      var c = ACT_RE.exec(l);
      if (!hit && c && actId(m, c[2]) === a.id) { hit = true; if (newText) out.push(c[1] + '! ' + newText); return; }
      out.push(l);
    });
    m.minutes = out.join('\n'); delete m.minutesHtml;
    A.data.act = A.data.act || {};
    if (newText) { var nid = actId(m, newText); if (nid !== a.id && A.data.act[a.id]) { A.data.act[nid] = A.data.act[a.id]; delete A.data.act[a.id]; } }
    else delete A.data.act[a.id];
  }
  async function saveActions(m) { await persist(); try { await writeNotesFiles(m); } catch (e) {} renderSide(); }
  function renderActions() {
    var all = allActions(), f = A.af || (A.af = { show: 'open', q: '' }), q = f.q.toLowerCase(), t = todayIso();
    var cnt = { open: 0, snooze: 0, afgerond: 0, alle: 0, weg: 0 };
    all.forEach(function (a) { if (a.hidden) { cnt.weg++; return; } cnt.alle++; if (a.done) cnt.afgerond++; else if (a.snoozed) cnt.snooze++; else cnt.open++; });
    if (f.show === 'weg' && !cnt.weg) f.show = 'open';
    var list = all.filter(function (a) {
      if (f.show === 'weg') return a.hidden && (!q || (a.text + ' ' + a.m.title).toLowerCase().indexOf(q) >= 0);
      if (a.hidden) return false;
      var ok = f.show === 'alle' || (f.show === 'open' && !a.done && !a.snoozed) || (f.show === 'snooze' && a.snoozed) || (f.show === 'afgerond' && a.done);
      return ok && (!q || (a.text + ' ' + a.m.title).toLowerCase().indexOf(q) >= 0);
    });
    if (f.show === 'snooze') list.sort(function (x, y) { return x.snooze.localeCompare(y.snooze); });
    var h = '<div class="head"><h1>Actielijst</h1><div class="acts"><button class="btn" id="adl">Download als tekstbestand</button></div></div>';
    h += '<section class="card"><div class="filters"><input id="aq" type="search" placeholder="Zoeken in acties of vergaderingen…" value="' + esc(f.q) + '">' +
      '<div class="seg">' + [['open', 'Open (' + cnt.open + ')'], ['snooze', '⏰ Gesnoozed (' + cnt.snooze + ')'], ['afgerond', 'Afgerond (' + cnt.afgerond + ')'], ['alle', 'Alle (' + cnt.alle + ')']].concat(cnt.weg ? [['weg', 'Verwijderd (' + cnt.weg + ')']] : []).map(function (s) { return '<button type="button" class="' + (f.show === s[0] ? 'on' : '') + '" data-show="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="tw"><table class="acttb"><thead><tr><th style="width:30px"></th><th>Actie</th><th>Begindatum</th><th>Vergadering</th><th style="width:150px"></th></tr></thead><tbody>';
    h += list.length ? list.map(function (a, k) {
      var tag = a.snoozed ? '<span class="bdg snz">⏰ tot ' + esc(fmtDay(a.snooze)) + '</span>' : a.back ? '<span class="bdg back">terug van snooze</span>' : '';
      return '<tr class="' + (a.done ? 'done' : '') + '" data-k="' + k + '"><td><input type="checkbox" class="adone"' + (a.done ? ' checked' : '') + ' title="Afgerond"></td>' +
        '<td><span class="atext" title="Klik om te bewerken">' + esc(a.text) + '</span> ' + tag + '</td>' +
        '<td><input type="date" class="astart" value="' + esc(a.start) + '"></td>' +
        '<td><a href="#/v/' + encodeURIComponent(a.m.id) + '" data-open-notes="1">' + esc(a.m.title) + '</a><br><small class="muted">' + esc(fmtShort(a.m.date)) + '</small></td>' +
        '<td class="aact">' + (a.hidden ? '<button type="button" class="btn sm arest">↩ Terugzetten</button>' : '<button type="button" class="btn sm asnz"' + (a.done ? ' disabled' : '') + '>⏰ Snooze</button><button type="button" class="link red adel" title="Van de actielijst halen (blijft in de aantekeningen staan)">✕</button>') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">' + (all.length ? (f.show === 'snooze' ? 'Geen gesnoozede acties.' : 'Geen acties met dit filter.') : 'Nog geen acties. Begin in de aantekeningen van een vergadering een regel met ! om een actie te maken.') + '</td></tr>';
    h += '</tbody></table></div>' + (A.store.kind === 'map' ? '<p class="note">Wordt ook bijgehouden in Actielijst › Actielijst.txt</p>' : '') + '</section>';
    h += '<div class="snzmenu" id="snzmenu" hidden></div>';
    setHTML($('#main'), h);
    function rowA(el) { var tr = el.closest('tr[data-k]'); return tr ? list[+tr.dataset.k] : null; }
    $$('.adone').forEach(function (cb) { cb.onchange = async function () { var a = rowA(cb); setMeta(a.id, 'done', cb.checked ? new Date().toISOString() : null); if (cb.checked) setMeta(a.id, 'snooze', null); await saveActions(a.m); renderActions(); }; });
    $$('.astart').forEach(function (inp) { inp.onchange = async function () { var a = rowA(inp); setMeta(a.id, 'start', inp.value && inp.value !== a.m.date ? inp.value : null); await saveActions(a.m); renderActions(); }; });
    $$('.atext').forEach(function (sp) {
      sp.onclick = function () {
        var a = rowA(sp), inp = el2('input', 'aedit'); inp.value = a.text; sp.replaceWith(inp); inp.focus(); inp.select();
        var fin = false;
        async function done(save) {
          if (fin) return; fin = true; var v = inp.value.trim();
          if (save && v !== a.text) { if (!v && !confirm('Lege tekst: actie verwijderen?')) { renderActions(); return; } editActionLine(a, v); await saveActions(a.m); }
          renderActions();
        }
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
        inp.addEventListener('blur', function () { done(true); });
      };
    });
    $$('.adel').forEach(function (b) { b.onclick = async function () { var a = rowA(b); setMeta(a.id, 'hidden', new Date().toISOString()); await saveActions(a.m); toast('Van de actielijst gehaald. In de aantekeningen van "' + a.m.title + '" staat de regel nog met !', 'ok'); renderActions(); }; });
    $$('.arest').forEach(function (b) { b.onclick = async function () { var a = rowA(b); setMeta(a.id, 'hidden', null); await saveActions(a.m); toast('Actie staat weer op de actielijst.', 'ok'); renderActions(); }; });
    var menu = $('#snzmenu');
    $$('.asnz').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation(); var a = rowA(b), r = b.getBoundingClientRect();
        var opts = [['Morgen', addDays(t, 1)], ['Overmorgen', addDays(t, 2)], ['Volgende week', nextMonday()]];
        var mh = opts.map(function (o) { return '<button type="button" data-d="' + o[1] + '">' + o[0] + '<small>' + esc(fmtDay(o[1])) + '</small></button>'; }).join('') +
          '<label class="snzpick">Kies een datum<input type="date" id="snzd" min="' + addDays(t, 1) + '" value="' + esc(a.snooze > t ? a.snooze : '') + '"></label>' +
          (a.snooze ? '<button type="button" data-d="" class="snzoff">Snooze opheffen</button>' : '');
        setHTML(menu, mh); menu.hidden = false;
        menu.style.top = (r.bottom + W.scrollY + 4) + 'px'; menu.style.left = Math.max(8, r.right + W.scrollX - 230) + 'px';
        async function pick(d) { menu.hidden = true; setMeta(a.id, 'snooze', d || null); await saveActions(a.m); toast(d ? 'Gesnoozed tot ' + fmtLong(d) + '. Dan staat de actie weer bij Open.' : 'Snooze opgeheven.', 'ok'); renderActions(); }
        $$('[data-d]', menu).forEach(function (x) { x.onclick = function () { pick(x.dataset.d); }; });
        $('#snzd').onchange = function () { if (this.value) pick(this.value); };
      };
    });
    if (!A.snzBound) { A.snzBound = true; D.addEventListener('click', function (e) { var mn = $('#snzmenu'); if (mn && !mn.hidden && !e.target.closest('#snzmenu')) mn.hidden = true; }); }
    $$('[data-show]').forEach(function (b) { b.onclick = function () { f.show = b.dataset.show; renderActions(); }; });
    $$('[data-open-notes]').forEach(function (a) { a.onclick = function () { A.notesOpen = true; }; });
    var qi = $('#aq'); qi.oninput = function () { f.q = qi.value; var p = qi.selectionStart; renderActions(); var n = $('#aq'); n.focus(); n.setSelectionRange(p, p); };
    bindFolders($('#main'));
    $('#adl').onclick = function () { dl(new Blob(['﻿' + actionListText()], { type: 'text/plain' }), 'Actielijst.txt'); };
  }
