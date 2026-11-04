  /* ================================================================== Vergaderapp */
  var DEFAULT_TYPES = ['Overleg', 'MT DGSenB', 'PMT DGSenB', 'Stafoverleg DGSenB/MRB', 'Stafoverleg DGSenB/SJenV', 'Stafoverleg DGSenB/SRb'];
  var A = { store: null, data: { version: 1, types: DEFAULT_TYPES.slice(), meetings: [] }, sort: { key: 'date', dir: 1 }, f: { q: '', type: '', year: '' }, draft: null };
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nl2iso(s) { var m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s || ''); return m ? m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]) : ''; }
  function isoDate(iso) { var p = (iso || '').split('-'); return p.length === 3 ? new Date(+p[0], p[1] - 1, +p[2]) : null; }
  function fmtLong(iso) { var d = isoDate(iso); return d ? d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Geen datum'; }
  function fmtShort(iso) { var d = isoDate(iso); return d ? pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear() : '—'; }
  function safe(n) { return String(n || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 90) || 'bestand'; }
  function isMail(f) { return /\.(msg|eml)$/i.test(f.name) || f.type === 'message/rfc822' || f.type === 'application/vnd.ms-outlook'; }
  function toast(t, kind) { var e = $('#toast'); e.textContent = t; e.className = 'show ' + (kind || ''); clearTimeout(toast.t); toast.t = setTimeout(function () { e.className = ''; }, 4200); }

  /* ------------------------------------------------------------- opslag: map (File System Access) of browser (IndexedDB) */
  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open('vergaderapp', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); r.result.createObjectStore('files'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function tx(store, mode, fn) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = function () { res(q && q.result); }; t.onerror = function () { rej(t.error); }; }); }); }
  var kvGet = function (k) { return tx('kv', 'readonly', function (s) { return s.get(k); }); };
  var kvSet = function (k, v) { return tx('kv', 'readwrite', function (s) { return s.put(v, k); }); };

  function FolderStore(root) {
    this.kind = 'map'; this.root = root; this.name = root.name;
    async function writeFile(dir, name, blob) { var h = await dir.getFileHandle(name, { create: true }), w = await h.createWritable(); await w.write(blob); await w.close(); }
    this.load = async function () {
      for (var nm of ['mebabs.json', 'vergaderingen.json']) {
        try { var h = await root.getFileHandle(nm); return JSON.parse(await (await h.getFile()).text()); } catch (e) { if (e.name !== 'NotFoundError') throw e; }
      }
      return null;
    };
    this.save = async function (data) {
      await writeFile(root, 'mebabs.json.tmp', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      await writeFile(root, 'mebabs.json', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      try { await root.removeEntry('mebabs.json.tmp'); } catch (e) {}
    };
    this.meetingsDir = function () { return root.getDirectoryHandle(MEET_DIR, { create: true }); };
    this.dir = async function (m) { return (await this.meetingsDir()).getDirectoryHandle(m.folder, { create: true }); };
    this.put = async function (m, name, blob) { await writeFile(await this.dir(m), name, blob); };
    this.get = async function (m, name) { return (await (await this.dir(m)).getFileHandle(name)).getFile(); };
    this.del = async function (m, name) { try { await (await this.dir(m)).removeEntry(name); } catch (e) {} };
    this.delMeeting = async function (m) { if (!m.folder) return; try { await (await this.meetingsDir()).removeEntry(m.folder, { recursive: true }); } catch (e) { if (e.name !== 'NotFoundError') throw e; } };
  }
  function BrowserStore() {
    this.kind = 'browser'; this.name = 'deze browser';
    this.load = function () { return kvGet('data'); };
    this.save = function (data) { return kvSet('data', data); };
    this.put = function (m, name, blob) { return tx('files', 'readwrite', function (s) { return s.put(blob, m.id + '/' + name); }); };
    this.get = function (m, name) { return tx('files', 'readonly', function (s) { return s.get(m.id + '/' + name); }).then(function (b) { if (!b) throw new Error('Bestand niet gevonden'); return b; }); };
    this.del = function (m, name) { return tx('files', 'readwrite', function (s) { return s.delete(m.id + '/' + name); }); };
    this.delMeeting = function (m) { var self = this; return Promise.all(m.files.reduce(function (a, f) { a.push(self.del(m, f.name)); if (f.pdf && f.pdf !== f.name) a.push(self.del(m, f.pdf)); if (f.backup) a.push(self.del(m, f.backup)); return a; }, []).concat(m.source && m.source.file ? [self.del(m, m.source.file)] : [])); };
  }
  /* oude indeling (alles los in de hoofdmap) omzetten naar Vergaderingen / Aantekeningen / Actielijst */
  async function copyDir(src, dst) {
    for await (var e of src.values()) {
      if (e.kind === 'directory') await copyDir(e, await dst.getDirectoryHandle(e.name, { create: true }));
      else { var f = await e.getFile(), h = await dst.getFileHandle(e.name, { create: true }), w = await h.createWritable(); await w.write(f); await w.close(); }
    }
  }
  async function migrateLayout(st) {
    var root = st.root, moved = 0;
    async function has(name, kind) { try { return kind === 'dir' ? await root.getDirectoryHandle(name) : await root.getFileHandle(name); } catch (e) { return null; } }
    if (A.data.layout !== 2) {
      var md = await st.meetingsDir();
      for (var i = 0; i < A.data.meetings.length; i++) {
        var m = A.data.meetings[i], old = m.folder && await has(m.folder, 'dir');
        if (!old) continue;
        await copyDir(old, await md.getDirectoryHandle(m.folder, { create: true }));
        await root.removeEntry(m.folder, { recursive: true }); moved++;
      }
      var nd = await has(NOTES_DIR, 'dir'); if (nd) { try { await nd.removeEntry('Actielijst.txt'); } catch (e) {} }
      A.data.layout = 2; await st.save(A.data);
      if (await has('vergaderingen.json')) { try { await root.removeEntry('vergaderingen.json'); } catch (e) {} }
      if (moved) setTimeout(function () { toast('De map "' + st.name + '" is opnieuw ingedeeld: Vergaderingen, Aantekeningen en Actielijst.', 'ok'); }, 600);
    }
    for (var d of [MEET_DIR, NOTES_DIR, ACTS_DIR]) { try { await root.getDirectoryHandle(d, { create: true }); } catch (e) {} }
    try { await writeNotesFiles(null); } catch (e) {}
  }
  async function useStore(st) {
    var d = await st.load();
    A.store = st;
    if (d && d.meetings) { A.data = d; if (!A.data.types || !A.data.types.length) A.data.types = DEFAULT_TYPES.slice(); }
    else { A.data = { version: 1, types: DEFAULT_TYPES.slice(), meetings: [] }; await st.save(A.data); }
    migrateActions();
    if (st.kind === 'map') await migrateLayout(st);
    await kvSet('mode', st.kind);
    route();
  }
  async function chooseFolder() {
    if (!W.showDirectoryPicker) { toast('Deze browser kan geen map kiezen. De gegevens worden in de browser bewaard.', 'warn'); return useStore(new BrowserStore()); }
    try {
      var h = await W.showDirectoryPicker({ id: 'vergaderapp', mode: 'readwrite', startIn: 'documents' });
      var hasIndex = false, n = 0;
      for await (var e of h.values()) { n++; if (e.name === 'vergaderingen.json' || e.name === 'mebabs.json') hasIndex = true; }
      if (!hasIndex && n > 0 && !/vergader|miebabs|mebabs/i.test(h.name)) h = await h.getDirectoryHandle('MeBabs', { create: true });
      if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Geen schrijfrechten op de map');
      await kvSet('dir', h);
      await useStore(new FolderStore(h));
      toast('Gegevens worden bewaard in de map "' + h.name + '".', 'ok');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      toast('Map kiezen lukt niet (' + (e.message || e.name) + '). Kies "In de browser bewaren".', 'err');
    }
  }
  async function reconnect() {
    var h = await kvGet('dir').catch(function () { return null; });
    try { if (h && (await h.requestPermission({ mode: 'readwrite' })) === 'granted') return useStore(new FolderStore(h)); } catch (e) {}
    return chooseFolder();
  }
  async function persist() { A.data.updated = new Date().toISOString(); await A.store.save(A.data); }

  /* ------------------------------------------------------------- mail -> vergadering */
  async function parseMailFile(file) {
    var buf = await file.arrayBuffer(), u = new Uint8Array(buf), m;
    if (rd(u, 0) === 0xE011CFD0) m = parseMsg(buf);
    else if (/\.msg$/i.test(file.name)) throw new Error('"' + file.name + '" is geen geldig Outlook-bestand');
    else m = parseEml(buf);
    if (!m.subject && !m.from && !m.start && !m.attachments.length) throw new Error('In "' + file.name + '" is geen mail herkend');
    var r = analyse(m);
    return { r: r, m: m };
  }
  function guessType(title) {
    var t = (title || '').toLowerCase(), best = '';
    A.data.types.forEach(function (ty) { if (ty !== 'Overleg' && t.indexOf(ty.toLowerCase()) >= 0 && ty.length > best.length) best = ty; });
    if (!best && /\bpmt\b/.test(t)) best = A.data.types.filter(function (x) { return /^pmt/i.test(x); })[0] || '';
    if (!best && /\bmt\b/.test(t)) best = A.data.types.filter(function (x) { return /^mt/i.test(x); })[0] || '';
    return best || 'Overleg';
  }
  async function draftFromMail(file) {
    var p = await parseMailFile(file), r = p.r, m = p.m;
    return {
      id: uid(), isNew: true, type: guessType(r.title), title: r.title || '(zonder titel)', location: r.location, link: r.link || '', date: nl2iso(r.date), start: r.start, end: r.end,
      chair: '', invitees: '', notes: r.notes,
      source: { from: m.from || '', sent: m.sent && !isNaN(m.sent) ? m.sent.toISOString() : '', mail: file.name, skipped: m.skipped || [], how: r.src },
      files: [], pending: m.attachments.map(function (a) { return { name: a.name, type: a.type || guessMime(a.name), blob: new Blob([a.data], { type: a.type }), on: !a.inline, inline: a.inline }; }),
      mailBlob: file
    };
  }
  function uniqueName(m, name) {
    name = safe(name); var base = name.replace(/(\.[^.]*)?$/, ''), ext = (/\.[^.]*$/.exec(name) || [''])[0], n = 1;
    var taken = m.files.reduce(function (a, f) { a.push(f.name.toLowerCase()); if (f.pdf) a.push(f.pdf.toLowerCase()); if (f.backup) a.push(f.backup.toLowerCase()); return a; }, []).concat(m.source && m.source.file ? [m.source.file.toLowerCase()] : []);
    while (taken.indexOf(name.toLowerCase()) >= 0) name = base + ' (' + (++n) + ')' + ext;
    return name;
  }
  async function addFileTo(m, name, type, blob) {
    var n = uniqueName(m, name);
    try { await A.store.put(m, n, blob); }
    catch (e) { n = uniqueName(m, n.normalize('NFKD').replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7e]/g, '')); await A.store.put(m, n, blob); }
    var rec = { name: n, type: type || guessMime(n), size: blob.size, added: new Date().toISOString() };
    m.files.push(rec);
    await makePdf(m, rec, blob);
    return n;
  }
  async function makePdf(m, f, blob) {
    try {
      var r = await convertToPdf(f.name, f.type, blob);
      if (!r) { f.conv = 'niet'; f.convV = CONV_VERSION; return null; }
      if (r.how === 'origineel') { f.pdf = f.name; f.conv = 'origineel'; return blob; }
      var pb = new Blob([r.bytes], { type: 'application/pdf' }), pn = f.pdf && f.pdf !== f.name ? f.pdf : uniqueName(m, f.name.replace(/\.[^.]*$/, '') + '.pdf');
      try { await A.store.put(m, pn, pb); } catch (e) { pn = uniqueName(m, pn.normalize('NFKD').replace(/[^\x20-\x7e]/g, '')); await A.store.put(m, pn, pb); }
      f.pdf = pn; f.conv = 'omgezet'; f.convV = CONV_VERSION; return pb;
    } catch (e) { console.error(e); f.conv = 'niet'; f.convErr = String(e.message || e); f.convV = CONV_VERSION; return null; }
  }
  async function getPdf(m, f) {
    if (f.pdf) { try { return await A.store.get(m, f.pdf); } catch (e) { f.pdf = null; } }
    if (f.conv === 'niet' && f.convV === CONV_VERSION) return null;
    var r = await makePdf(m, f, await A.store.get(m, f.name)); await persist(); return r;
  }
  function agendaFirst(list) { return list.slice().sort(function (a, b) { return (/agenda/i.test(b.name) ? 1 : 0) - (/agenda/i.test(a.name) ? 1 : 0); }); }
  async function saveDraft(d) {
    var m = { id: d.id, type: d.type, title: d.title, location: d.location, link: d.link || '', date: d.date, start: d.start, end: d.end, chair: d.chair, invitees: d.invitees, notes: d.notes,
      source: d.source, files: [], created: new Date().toISOString() };
    m.folder = safe((m.date || 'zonder datum') + ' ' + m.title).slice(0, 70) + ' [' + m.id.slice(-4) + ']';
    var todo = agendaFirst((d.pending || []).filter(function (f) { return f.on; }));
    for (var i = 0; i < todo.length; i++) { toast('Stukken omzetten naar PDF… (' + (i + 1) + '/' + todo.length + ')'); await addFileTo(m, todo[i].name, todo[i].type, todo[i].blob); }
    if (d.mailBlob) { var mn = uniqueName(m, 'Originele mail' + (/\.msg$/i.test(d.mailBlob.name) ? '.msg' : '.eml')); await A.store.put(m, mn, d.mailBlob); m.source.file = mn; }
    A.data.meetings.push(m); await persist();
    return m;
  }
  function findDup(d) { return A.data.meetings.filter(function (m) { return m.date === d.date && m.title.toLowerCase() === (d.title || '').toLowerCase(); })[0]; }

  async function handleDrop(files) {
    if (!A.store) { toast('Kies eerst waar de gegevens bewaard worden.', 'warn'); return; }
    files = Array.prototype.slice.call(files);
    var mails = files.filter(isMail), docs = files.filter(function (f) { return !isMail(f); });
    var cur = currentMeeting();
    try {
      if (cur && !cur.isNew) {
        var n = 0;
        for (var i = 0; i < docs.length; i++) {
          var same = cur.files.filter(function (f) { return f.name.toLowerCase() === safe(docs[i].name).toLowerCase(); })[0];
          if (same && confirm('"' + same.name + '" bestaat al in deze vergadering.\n\nOK = de oude versie vervangen door deze nieuwe\nAnnuleren = als extra stuk toevoegen')) {
            toast('Nieuwe versie opslaan…'); await saveEdited(cur, same, docs[i]); n++; continue;
          }
          var base = docs[i].name.replace(/\.[^.]*$/, '').toLowerCase(), twin = /\.pdf$/i.test(docs[i].name) && cur.files.filter(function (f) { return (f.conv === 'omgezet' || f.conv === 'niet') && f.name.replace(/\.[^.]*$/, '').toLowerCase() === base; })[0];
          if (twin && confirm('Wil je "' + docs[i].name + '" gebruiken als PDF-versie van "' + twin.name + '"?\n(OK = gebruiken als PDF-versie, Annuleren = toevoegen als apart stuk)')) {
            var tpn = twin.pdf && twin.pdf !== twin.name ? twin.pdf : uniqueName(cur, docs[i].name); await A.store.put(cur, tpn, docs[i]); twin.pdf = tpn; twin.conv = 'vervangen'; delete twin.convErr; n++; continue;
          }
          toast('Omzetten naar PDF: ' + docs[i].name + '…'); await addFileTo(cur, docs[i].name, docs[i].type, docs[i]); n++;
        }
        for (i = 0; i < mails.length; i++) {
          var p = await parseMailFile(mails[i]), atts = p.m.attachments.filter(function (a) { return !a.inline; });
          if (confirm('Wat wil je met de mail "' + (p.m.subject || mails[i].name) + '"?\n\nOK = de ' + atts.length + ' bijlage(n) toevoegen aan deze vergadering\nAnnuleren = de mail zelf als document toevoegen')) {
            for (var j = 0; j < atts.length; j++) { await addFileTo(cur, atts[j].name, atts[j].type, new Blob([atts[j].data], { type: atts[j].type })); n++; }
          } else { await addFileTo(cur, mails[i].name, mails[i].type, mails[i]); n++; }
        }
        cur.updated = new Date().toISOString(); await persist(); renderDetail(cur); toast(n + ' document(en) toegevoegd.', 'ok'); return;
      }
      if (cur && cur.isNew) {
        docs.forEach(function (f) { cur.pending.push({ name: f.name, type: f.type || guessMime(f.name), blob: f, on: true }); });
        if (mails.length) for (i = 0; i < mails.length; i++) {
          var q = await parseMailFile(mails[i]);
          q.m.attachments.forEach(function (a) { cur.pending.push({ name: a.name, type: a.type, blob: new Blob([a.data], { type: a.type }), on: !a.inline, inline: a.inline }); });
        }
        renderDetail(cur); toast('Toegevoegd aan de nieuwe vergadering. Klik op Opslaan.', 'ok'); return;
      }
      if (!mails.length) { toast('Sleep een mail (.msg of .eml) om een vergadering te maken. Losse documenten sleep je op een geopende vergadering.', 'warn'); return; }
      if (mails.length === 1) { A.draft = await draftFromMail(mails[0]); location.hash = '#/nieuw'; route(); return; }
      var made = 0;
      for (i = 0; i < mails.length; i++) { var d = await draftFromMail(mails[i]); if (!findDup(d)) { await saveDraft(d); made++; } }
      route(); toast(made + ' vergadering(en) aangemaakt' + (made < mails.length ? ' (' + (mails.length - made) + ' bestonden al)' : '') + '.', 'ok');
    } catch (e) { console.error(e); toast('Kon de mail niet lezen: ' + (e.message || e), 'err'); }
  }


  var MEET_DIR = 'Vergaderingen', ACTS_DIR = 'Actielijst';

  /* ------------------------------------------------------------- weergave */
  function route() {
    var h = location.hash || '#/'; $('#main').classList.remove('detail');
    renderSide();
    if (!A.store) return renderWelcome();
    if (h === '#/nieuw') { if (!A.draft) A.draft = blankDraft(); return renderDetail(A.draft); }
    var mm = /^#\/v\/(.+)$/.exec(h);
    if (mm) { var m = byId(decodeURIComponent(mm[1])); if (m) return renderDetail(m); }
    A.draft = null;
    var rm = /^#\/verslag\/(.+)$/.exec(h);
    if (rm) { var rmm = byId(decodeURIComponent(rm[1])); if (rmm) return renderReport(rmm); }
    if (h === '#/verslagen') return renderReports();
    if (h === '#/acties') return renderActions();
    if (h === '#/bestanden') return renderFiles(true);
    renderHome();
  }
  function byId(id) { return A.data.meetings.filter(function (m) { return m.id === id; })[0]; }
  function currentMeeting() { var h = location.hash; if (h === '#/nieuw') return A.draft; var mm = /^#\/v\/(.+)$/.exec(h); return mm ? byId(decodeURIComponent(mm[1])) : null; }
  function blankDraft() { return { id: uid(), isNew: true, type: 'Overleg', title: '', location: '', link: '', date: todayIso(), start: '', end: '', chair: '', invitees: '', notes: '', source: null, files: [], pending: [] }; }

  function renderSide() {
    var s = $('#side'), h = '', hs = location.hash || '#/';
    var nOpen = A.store ? openCount() : 0;
    h += '<nav class="topnav"><a href="#/" class="' + (/^#\/(v\/|nieuw)?$/.test(hs) || hs === '#/' ? 'on' : '') + '">Vergaderingen</a><a href="#/verslagen" class="' + (/^#\/verslag/.test(hs) ? 'on' : '') + '">Verslagen</a><a href="#/acties" class="' + (hs === '#/acties' ? 'on' : '') + '">Actielijst' + (nOpen ? ' <span class="cnt">' + nOpen + '</span>' : '') + '</a><a href="#/bestanden" class="' + (hs === '#/bestanden' ? 'on' : '') + '">Bestanden</a></nav><span class="sp"></span>';
    if (A.store) {
      h += '<span class="tinfo" title="Hier worden alle vergaderingen, stukken en aantekeningen bewaard">📁 ' + (A.store.kind === 'map' ? 'Map: <b>' + esc(A.store.name) + '</b>' : 'In de browser') + ' <button class="link" id="chgStore">' + (A.store.kind === 'map' ? 'wijzig' : 'map kiezen') + '</button></span>';
    }
    setHTML(s, h);
    var cs = $('#chgStore', s); if (cs) cs.onclick = chooseFolder;
    bindFolders(s);
  }
  function renderWelcome() {
    var fsOk = !!W.showDirectoryPicker, inDocs = /\/MeBabs\/[^\/]*\.html$/i.test(decodeURIComponent(location.pathname));
    setHTML($('#main'), '<div class="card welcome"><h1>Welkom bij MeBabs</h1>' +
      '<p>Sleep mails en uitnodigingen uit Outlook naar MeBabs. Er wordt dan automatisch een vergadering aangemaakt, met de titel, datum, tijd, locatie en alle stukken.</p>' +
      (fsOk ? '<p><b>Eenmalig: kies je datamap.</b> Klik op de knop en kies een map, bijvoorbeeld <b>Documenten</b>; MeBabs maakt daarin de map <b>MeBabs</b> aan' + (inDocs ? ' (of kies de map MeBabs waar dit bestand in staat)' : '') + '. Daarin komen de submappen <b>Vergaderingen</b>, <b>Aantekeningen</b> en <b>Actielijst</b>. Edge vraagt daarna of MeBabs mag opslaan: kies <b>Wijzigingen opslaan</b>.</p>' +
        '<button class="btn pri" id="pickDir">📁 Datamap kiezen…</button><br><br>' : '<p class="note">Deze browser kan geen map op je computer gebruiken.</p>') +
      '<p class="note">Liever ergens anders? Kies in het venster gewoon een andere map. Of <button class="link" id="useIdb">bewaar alles in de browser</button> (alleen op deze computer, zonder bestanden).</p>' +
      (A.hadDir ? '<button class="btn" id="recon">Verder met de vorige map</button>' : '') + '</div>');
    var p = $('#pickDir'); if (p) p.onclick = chooseFolder;
    $('#useIdb').onclick = function () { useStore(new BrowserStore()); };
    var r = $('#recon'); if (r) r.onclick = reconnect;
  }
  function row(m, cols) {
    return '<tr data-id="' + esc(m.id) + '">' + cols.map(function (c) { return '<td class="c-' + c + '">' + cell(m, c) + '</td>'; }).join('') + '</tr>';
  }
  function cell(m, c) {
    if (c === 'date') return esc(fmtShort(m.date));
    if (c === 'files') return m.files.length ? '<span class="pill">' + m.files.length + '</span>' : '';
    if (c === 'title') return '<b>' + esc(m.title) + '</b>';
    return esc(m[c] || '');
  }
  /* rev: archief. Bij sorteren op datum staat in "Komend" de eerstvolgende vergadering bovenaan (datum + starttijd), en in het archief de laatste. */
  function sorted(list, rev) {
    var k = A.sort.key, dir = A.sort.dir * (rev && k === 'date' ? -1 : 1);
    return list.slice().sort(function (a, b) {
      var x, y;
      if (k === 'date') { x = (a.date || '9999-99-99') + ' ' + (a.start || '00:00'); y = (b.date || '9999-99-99') + ' ' + (b.start || '00:00'); }
      else if (k === 'files') { x = a.files.length; y = b.files.length; }
      else { x = (a[k] || '').toLowerCase(); y = (b[k] || '').toLowerCase(); }
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }
  function renderHome() {
    var t = todayIso(), ms = A.data.meetings;
    var today = ms.filter(function (m) { return m.date === t; }).sort(function (a, b) { return (a.start || '') < (b.start || '') ? -1 : 1; });
    var next = ms.filter(function (m) { return m.date > t; }).sort(function (a, b) { return (a.date + a.start) < (b.date + b.start) ? -1 : 1; })[0];
    var years = {}; ms.forEach(function (m) { if (m.date) years[m.date.slice(0, 4)] = 1; });
    var f = A.f, q = f.q.toLowerCase();
    var list = ms.filter(function (m) {
      return (!f.year || (m.date || '').slice(0, 4) === f.year) &&
        (!q || [m.title, m.location, m.chair, m.invitees, m.minutes].join(' ').toLowerCase().indexOf(q) >= 0);
    });
    var h = '<div class="head"><h1>Vergaderingen</h1><div class="acts"><button class="btn" id="imp">Mail importeren…</button><a class="btn pri" href="#/nieuw" id="new">+ Nieuwe vergadering</a></div></div>';
    h += '<div class="dropbar">Sleep een mail of agenda-uitnodiging uit Outlook naar dit venster. Er wordt dan een vergadering aangemaakt, met de stukken als bijlage.</div>';
    h += '<section class="card today"><h2>Vandaag <span class="muted">' + esc(fmtLong(t)) + '</span></h2>';
    if (today.length) {
      h += '<ul class="tl">' + today.map(function (m) {
        return '<li data-id="' + esc(m.id) + '"><span class="tm">' + esc(m.start || '—') + (m.end ? '<small>' + esc(m.end) + '</small>' : '') + '</span><span class="tt"><b>' + esc(m.title) + '</b><small>' + esc(m.location || '') + '</small></span>' + (m.link ? '<a class="btn sm join" href="' + esc(m.link) + '" target="_blank" rel="noopener" title="Deelnemen aan de online vergadering">Deelnemen</a>' : '') + (m.files.length ? '<span class="pill">' + m.files.length + ' stuk' + (m.files.length > 1 ? 'ken' : '') + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    } else h += '<p class="muted">Geen vergaderingen vandaag.' + (next ? ' De volgende is op <a href="#/v/' + esc(next.id) + '">' + esc(fmtLong(next.date)) + ': ' + esc(next.title) + '</a>.' : '') + '</p>';
    h += '</section>';
    h += '<section class="card"><div class="filters"><input id="q" type="search" placeholder="Zoeken op titel, locatie, namen of aantekeningen…" value="' + esc(f.q) + '">' +
      '<select id="fYear"><option value="">Alle jaren</option>' + Object.keys(years).sort().reverse().map(function (y) { return '<option' + (f.year === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>';
    var cols = [['title', 'Titel'], ['date', 'Datum'], ['start', 'Start'], ['end', 'Eind'], ['location', 'Locatie'], ['files', 'Stukken']];
    function tbl(rows, empty, arch) {
      rows = sorted(rows, arch);
      var o = '<div class="tw"><table><thead><tr>' + cols.map(function (c) { var on = A.sort.key === c[0], dn = A.sort.dir * (arch && c[0] === 'date' ? -1 : 1) < 0; return '<th class="c-' + c[0] + (on ? ' on' : '') + '" data-sort="' + c[0] + '">' + c[1] + '<i>' + (on ? (dn ? '▼' : '▲') : '↕') + '</i></th>'; }).join('') + '</tr></thead><tbody>';
      o += rows.length ? rows.map(function (m) { return row(m, cols.map(function (c) { return c[0]; })); }).join('') : '<tr><td colspan="6" class="empty">' + empty + '</td></tr>';
      return o + '</tbody></table></div>';
    }
    var upcoming = list.filter(function (m) { return !m.date || m.date >= t; }), past = list.filter(function (m) { return m.date && m.date < t; });
    h += tbl(upcoming, ms.length ? (past.length ? 'Geen komende vergaderingen' + (q || f.year ? ' met deze filters' : '') + '. Eerdere vergaderingen staan in het archief.' : 'Geen vergaderingen gevonden met deze filters.') : 'Nog geen vergaderingen. Sleep een mail naar dit venster om te beginnen.');
    h += '<p class="note">' + upcoming.length + ' komende vergadering' + (upcoming.length === 1 ? '' : 'en') + ' · Klik op een kolomkop om te sorteren.</p></section>';
    h += '<section class="card arch"><button type="button" class="archbtn" id="arch"><span>' + (A.showArch ? '▾' : '▸') + '</span> 🗄 Archief <span class="muted">' + past.length + ' eerdere vergadering' + (past.length === 1 ? '' : 'en') + (q || f.year ? ' met deze filters' : '') + '</span><span class="sp"></span><span class="link">' + (A.showArch ? 'verbergen' : 'tonen') + '</span></button>';
    if (A.showArch) h += tbl(past, 'Geen eerdere vergaderingen' + (q || f.year ? ' met deze filters' : '') + '.', true);
    h += '</section>';
    setHTML($('#main'), h);
    $('#arch').onclick = function () { A.showArch = !A.showArch; renderHome(); };
    $('#imp').onclick = function () { $('#pickMail').click(); };
    bindFolders($('#main'));
    $('#new').onclick = function () { A.draft = blankDraft(); };
    $$('[data-id]').forEach(function (r) { r.onclick = function (e) { if (e.target.tagName !== 'A') location.hash = '#/v/' + encodeURIComponent(r.dataset.id); }; });
    $$('[data-sort]').forEach(function (th) { th.onclick = function () { var k = th.dataset.sort; A.sort = { key: k, dir: A.sort.key === k ? -A.sort.dir : 1 }; renderHome(); }; });
    var qi = $('#q'); qi.oninput = function () { A.f.q = qi.value; var pos = qi.selectionStart; renderHome(); var n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#fYear').onchange = function () { A.f.year = this.value; renderHome(); };
  }

  function renderDetail(m) {
    var isNew = !!m.isNew, h = '', list = isNew ? (m.pending || []) : m.files;
    var sel = A.sel && A.sel.id === m.id ? Math.min(A.sel.i, Math.max(0, list.length - 1)) : 0;
    h += '<div class="crumb"><a href="#/">Vergaderingen</a> › ' + esc(isNew ? 'Nieuwe vergadering' : fmtLong(m.date)) + '</div>';
    if (isNew && m.source) {
      var miss = []; if (!m.date) miss.push('datum'); if (!m.start) miss.push('tijd');
      h += '<div class="info ' + (miss.length ? 'warn' : 'ok') + '">' + (m.source.how === 'agenda-uitnodiging' ? 'Gegevens overgenomen uit de agenda-uitnodiging.' : 'Gegevens uit de tekst van de mail gehaald.') + (miss.length ? ' Er is geen ' + miss.join(' en ') + ' gevonden. Vul dat zelf in.' : ' Controleer alles en klik op Opslaan.') + '</div>';
    }
    h += '<form class="card meta" id="frm" autocomplete="off"><div class="mtop"><input class="ttl" name="title" required placeholder="Titel van de vergadering" value="' + esc(m.title) + '">' +
      '<button type="submit" class="btn pri" id="save">Opslaan</button>' + (isNew ? '' : '<button type="button" class="btn' + (A.notesOpen ? ' on' : '') + '" id="npToggle" title="Kolom voor aantekeningen tijdens de vergadering">✎ Aantekeningen</button><button type="button" class="btn" id="exp">Exporteer als één PDF</button><button type="button" class="btn red" id="del" title="Vergadering verwijderen">Verwijder</button>') + '<a class="btn" href="#/">Terug</a></div>';
    h += '<div class="mrow"><label>Datum<input type="date" name="date" value="' + esc(m.date) + '"></label><label>Van<input type="time" name="start" value="' + esc(m.start) + '"></label><label>Tot<input type="time" name="end" value="' + esc(m.end) + '"></label>' +
      '<label class="grow">Locatie<input name="location" value="' + esc(m.location) + '"></label>' +
      '<label class="grow2">Vergaderlink<span class="lk"><input name="link" type="url" placeholder="Geen link gevonden. Plak hier eventueel een Teams- of andere link" value="' + esc(m.link || '') + '"><a class="btn sm join" id="joinBtn" target="_blank" rel="noopener" href="' + esc(m.link || '#') + '"' + (m.link ? '' : ' hidden') + '>Deelnemen</a></span></label>' +
      '<label class="grow">Genodigden<input name="invitees" placeholder="Namen, gescheiden door komma\'s. De eerste is de voorzitter" value="' + esc(m.invitees) + '"></label></div></form>';
    h += '<div class="ws' + (A.notesOpen && !isNew ? ' n3' : '') + '"><section class="card list"><div class="shead"><h2>Stukken <span class="muted">' + list.length + '</span></h2><button type="button" class="link" id="addDocs">+ Toevoegen</button></div><ul class="docs" id="docs">';
    list.forEach(function (f, i) {
      if (isNew) {
        h += '<li data-sel="' + i + '"><div class="dl1"><input type="checkbox" data-p="' + i + '"' + (f.on ? ' checked' : '') + ' title="Meenemen bij opslaan"><span class="fn">' + esc(f.name) + '</span></div>' +
          (f.inline ? '<div class="dl2"><small>afbeelding uit de mailtekst</small></div>' : '') + '</li>';
      } else {
        var badge = f.conv === 'vervangen' ? '<span class="bdg ok">eigen PDF</span>' : f.conv === 'niet' ? '<span class="bdg no" title="' + esc(f.convErr || 'Dit bestandstype kan niet worden omgezet') + '">geen PDF</span>' : '';
        var na = annCount(f.ann);
        h += '<li data-sel="' + i + '"><div class="dl1"><span class="num">' + (i + 1) + '</span><span class="fn" title="' + esc(f.name) + '">' + esc(f.name) + '</span></div>' +
          '<div class="dl2">' + badge + (na ? '<span class="bdg ann" title="Aantekeningen">✎ ' + na + '</span>' : '') + '<span class="sp"></span>' +
          '<button type="button" class="link" data-up="' + i + '" title="Omhoog"' + (i ? '' : ' disabled') + '>▲</button><button type="button" class="link" data-down="' + i + '" title="Omlaag"' + (i < list.length - 1 ? '' : ' disabled') + '>▼</button>' +
          '<button type="button" class="link" data-dl="' + i + '" title="Origineel downloaden">⤓</button><button type="button" class="link red" data-rm="' + i + '" title="Verwijderen">✕</button></div></li>';
      }
    });
    if (!list.length) h += '<li class="muted empty">Nog geen stukken.</li>';
    h += '</ul><div class="dz small">Sleep documenten of een mail hierheen</div>';
    if (m.source && m.source.skipped && m.source.skipped.length) h += '<p class="note">Niet overgenomen (Outlook-items in de mail): ' + esc(m.source.skipped.join(', ')) + '</p>';
    if (m.source) h += '<p class="note">Uit de mail' + (m.source.from ? ' van ' + esc(m.source.from) : '') + (m.source.sent ? ', ' + esc(new Date(m.source.sent).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })) : '') + '.' + (m.source.file && !isNew ? ' <a href="#" id="origMail">Originele mail</a>' : '') + '</p>';
    h += '</section><section class="card pv" id="pv"></section><section class="card np" id="np"></section></div>';
    setHTML($('#main'), h); $('#main').classList.add('detail');

    var frm = $('#frm');
    function readForm() { $$('[name]', frm).forEach(function (x) { m[x.name] = x.value.trim(); }); }
    frm.onsubmit = async function (e) {
      e.preventDefault(); readForm();
      if (!m.title) { toast('Vul een titel in.', 'warn'); $('[name=title]', frm).focus(); return; }
      try {
        if (isNew) {
          var dup = findDup(m);
          if (dup && !confirm('Er bestaat al een vergadering "' + dup.title + '" op ' + fmtShort(dup.date) + '. Toch een nieuwe aanmaken?')) { location.hash = '#/v/' + encodeURIComponent(dup.id); return; }
          $('#save').disabled = true;
          var saved = await saveDraft(m); A.draft = null; A.sel = { id: saved.id, i: 0 };
          toast('Vergadering "' + saved.title + '" opgeslagen met ' + saved.files.length + ' stuk(ken).', 'ok'); location.hash = '#/v/' + encodeURIComponent(saved.id);
        } else { m.updated = new Date().toISOString(); await persist(); toast('Opgeslagen.', 'ok'); renderSide(); }
      } catch (er) { $('#save').disabled = false; toast('Opslaan mislukt: ' + (er.message || er), 'err'); }
    };
    var del = $('#del'); if (del) del.onclick = async function () {
      if (!confirm('Vergadering "' + m.title + '" verwijderen?\n\nAlle bestanden van deze vergadering worden gewist: de stukken, de originele mail en alle gewijzigde versies.' + (m.minutes ? '\nJe aantekeningen blijven staan in de map Aantekeningen.' : ''))) return;
      try { await A.store.delMeeting(m); } catch (er) { toast('Verwijderen van de bestanden mislukt: ' + (er.message || er), 'err'); return; }
      A.data.meetings = A.data.meetings.filter(function (x) { return x !== m; }); await persist();
      try { await writeNotesFiles(null); } catch (e) {}
      toast('Verwijderd.'); location.hash = '#/';
    };
    var ex = $('#exp'); if (ex) ex.onclick = function () { readForm(); exportMeeting(m); };
    $('#addDocs').onclick = function () { readForm(); $('#pickDocs').click(); };
    $$('[data-p]').forEach(function (c) { c.onclick = function (e) { e.stopPropagation(); }; c.onchange = function () { m.pending[+c.dataset.p].on = c.checked; }; });
    $$('#docs li[data-sel]').forEach(function (li) { li.onclick = function (e) { if (e.target.closest('button,input')) return; pvShow(m, +li.dataset.sel); }; });
    $$('[data-up],[data-down]').forEach(function (b) { b.onclick = async function () { var i = +(b.dataset.up || b.dataset.down), j = b.dataset.up != null ? i - 1 : i + 1; if (j < 0 || j >= m.files.length) return; readForm(); var t = m.files[i]; m.files[i] = m.files[j]; m.files[j] = t; if (A.sel && A.sel.i === i) A.sel.i = j; await persist(); renderDetail(m); }; });
    $$('[data-dl]').forEach(function (a) { a.onclick = async function () { var f = m.files[+a.dataset.dl]; dl(await A.store.get(m, f.name), f.name); }; });
    $$('[data-rm]').forEach(function (a) { a.onclick = async function () { var f = m.files[+a.dataset.rm]; if (!confirm('"' + f.name + '" verwijderen' + (annCount(f.ann) ? ', inclusief je aantekeningen' : '') + '?')) return; readForm(); await A.store.del(m, f.name); if (f.pdf && f.pdf !== f.name) await A.store.del(m, f.pdf); if (f.backup) await A.store.del(m, f.backup); m.files.splice(+a.dataset.rm, 1); await persist(); renderDetail(m); }; });
    var om = $('#origMail'); if (om) om.onclick = async function (e) { e.preventDefault(); dl(await A.store.get(m, m.source.file), m.source.file); };
    $$('[name]', frm).forEach(function (x) { x.addEventListener('input', function () { m[x.name] = x.value; }); });
    var nt = $('#npToggle'); if (nt) nt.onclick = toggleNotes;
    bindFolders($('#main'));
    var li = $('[name=link]', frm), jb = $('#joinBtn');
    function upd() { var v = li.value.trim(); var ok = /^https?:\/\//i.test(v); jb.hidden = !ok; if (ok) jb.href = v; }
    li.addEventListener('input', upd); li.addEventListener('change', async function () { readForm(); if (!isNew) { m.updated = new Date().toISOString(); await persist(); } });
    if (!isNew && m.link === undefined && m.source && m.source.file) {
      A.store.get(m, m.source.file).then(function (b) { return parseMailFile(b); }).then(async function (pm) { m.link = pm.r.link || ''; await persist(); if (m.link && currentMeeting() === m && !li.value) { li.value = m.link; upd(); toast('Vergaderlink gevonden in de originele mail.', 'ok'); } }).catch(function () { m.link = ''; });
    }
    if (A.notesOpen && !isNew) renderNotes(m);
    pvShow(m, sel);
  }
  function annCount(a) { if (!a) return 0; return Object.keys(a).reduce(function (n, k) { return n + (a[k] ? a[k].length : 0); }, 0); }

  /* ------------------------------------------------------------- map openen in Verkenner */
  function urlToWinPath(u) {
    var url = new URL(u), p = decodeURIComponent(url.pathname).replace(/\/+$/, '');
    if (url.host) return '\\\\' + url.host + p.replace(/\//g, '\\');
    return p.replace(/^\/(?=[A-Za-z]:)/, '').replace(/\//g, '\\');
  }
  function baseCandidates(name) {
    if (location.protocol !== 'file:') return [];
    var href = location.href.split(/[?#]/)[0], dir = href.slice(0, href.lastIndexOf('/') + 1), enc = encodeURIComponent(name), out = [];
    function add(u) { if (out.indexOf(u) < 0) out.push(u); }
    var segs = dir.replace(/\/$/, '').split('/'), last = decodeURIComponent(segs[segs.length - 1] || '');
    if (last.toLowerCase() === name.toLowerCase()) add(dir);
    add(dir + enc + '/');
    var parent = segs.slice(0, -1).join('/') + '/'; if (parent.length > 8) add(parent + enc + '/');
    var hm = /^(file:\/\/[^\/]*\/(?:[A-Za-z]:\/)?(?:users|home)\/[^\/]+\/)/i.exec(dir);
    if (hm) { ['Desktop/', 'Bureaublad/', 'Documents/', 'Documenten/', 'Downloads/', ''].forEach(function (s) { add(hm[1] + s + enc + '/'); }); }
    var od = /^(.*?\/OneDrive[^\/]*\/)/i.exec(dir);
    if (od) { ['Desktop/', 'Bureaublad/', 'Documents/', 'Documenten/', ''].forEach(function (s) { add(od[1] + s + enc + '/'); }); }
    return out;
  }
  function probe(url, token) {
    return new Promise(function (res) {
      var sc = D.createElement('script'), ok = false, fin = false;
      function end(v) { if (fin) return; fin = true; sc.remove(); res(v); }
      W.__mebabsMark = function (t) { if (t === token) { ok = true; end(true); } };
      sc.onload = function () { setTimeout(function () { end(ok); }, 30); }; sc.onerror = function () { end(false); };
      setTimeout(function () { end(ok); }, 2500);
      sc.src = url + 'mebabs-locatie.js?' + token; D.head.appendChild(sc);
    });
  }
  async function findBase(token) {
    var c = baseCandidates(A.store.name);
    for (var i = 0; i < c.length; i++) { if (await probe(c[i], token)) return urlToWinPath(c[i]); }
    return null;
  }
  async function detectBase() {
    if (!A.store || A.store.kind !== 'map' || location.protocol !== 'file:') return null;
    var key = 'basePath:' + A.store.name, known = await kvGet(key).catch(function () { return null; });
    if (known) return known;
    if (A.detecting) return A.detecting;
    A.detecting = (async function () {
      var token = uid(), h;
      try { h = await A.store.root.getFileHandle('mebabs-locatie.js', { create: true }); var w = await h.createWritable(); await w.write('window.__mebabsMark&&window.__mebabsMark(' + JSON.stringify(token) + ');'); await w.close(); } catch (e) { return null; }
      var found = await findBase(token);
      try { await A.store.root.removeEntry('mebabs-locatie.js'); } catch (e) {}
      if (found) await kvSet(key, found);
      return found;
    })();
    var r = await A.detecting; A.detecting = null; return r;
  }
  async function basePath(ask) {
    var key = 'basePath:' + A.store.name, b = await kvGet(key).catch(function () { return null; });
    if (b && !ask) return b;
    if (!ask) { b = await detectBase(); if (b) return b; }
    var v = prompt('MeBabs kon de map "' + A.store.name + '" niet vanzelf vinden op je computer. Dat lukt wel als MeBabs.html in dezelfde map staat als de map "' + A.store.name + '", of erin.\n\nJe kunt het pad ook één keer plakken: open de map in Verkenner, klik op de adresbalk en kopieer het pad (Ctrl+C).', b || '');
    if (!v) return null;
    v = v.trim().replace(/^"|"$/g, '').replace(/[\\/]+$/, '');
    if (!/^([a-zA-Z]:\\|\\\\)/.test(v)) { toast('Dat is geen geldig Windows-pad. Het moet beginnen met bijvoorbeeld C:\\', 'warn'); return null; }
    await kvSet(key, v); return v;
  }
  async function openInExplorer(rel, ask) {
    if (!A.store || A.store.kind !== 'map') return;
    var b = await basePath(ask); if (!b) return;
    var full = b + (rel ? '\\' + rel.replace(/\//g, '\\') : '');
    try { await navigator.clipboard.writeText(full); } catch (e) {}
    var a = D.createElement('a'); a.href = 'search-ms:displayname=' + encodeURIComponent((rel || A.store.name).split('/').pop()) + '&crumb=location:' + encodeURIComponent(full); D.body.appendChild(a); a.click(); a.remove();
    toast('Verkenner wordt geopend. Vraagt Edge om toestemming? Kies dan Openen. Lukt het niet, dan staat het pad op je klembord: Windows-toets + E, Ctrl+L, Ctrl+V. (Shift+klik om het pad te wijzigen.)');
  }
  function bindFolders(root) { $$('a.fold', root).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); openInExplorer(a.dataset.fold, e.shiftKey); }; }); }

  /* ------------------------------------------------------------- viewer met aantekeningen (pdf.js) */
  var PV = { tok: 0, tool: 'select', colors: { mark: '#ffd400' }, noteColor: '#e8590c', scale: 1, fit: true, q: '' };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var TOOLS = [['select', 'Tekst', 'Tekst selecteren en kopiëren'], ['mark', 'Markeren', 'Selecteer tekst; die wordt dan gemarkeerd'], ['note', 'Opmerking', 'Klik op een woord om er een opmerking bij te zetten'], ['erase', 'Gum', 'Klik op een markering of opmerking om die te verwijderen']];
  var COLORS = ['#ffd400', '#7ee081'];
  var MARGIN = 170;
  function isNote(s) { return s.t === 'note' || s.t === 'text'; }
  function hasNotes(ann) { return Object.keys(ann || {}).some(function (k) { return (ann[k] || []).some(isNote); }); }
  async function draftPdf(f) { if (f._pdf === undefined) { var r = await convertToPdf(f.name, f.type, f.blob); f._pdf = r ? new Blob([r.bytes], { type: 'application/pdf' }) : null; } return f._pdf; }
  async function pvShow(m, i) {
    var el = $('#pv'); if (!el) return;
    var isNew = !!m.isNew, list = isNew ? (m.pending || []) : m.files, f = list[i];
    if (A.edCtl && A.edCtl.isDirty() && !confirm('Je hebt wijzigingen in het bestand die nog niet zijn opgeslagen. Weggooien?')) return;
    A.edCtl = null;
    if (!A.sel || A.sel.id !== m.id || A.sel.i !== i) { PV.mode = 'pdf'; PV.q = ''; }
    var tok = ++PV.tok;
    A.sel = { id: m.id, i: i };
    $$('#docs li[data-sel]').forEach(function (li) { li.classList.toggle('on', +li.dataset.sel === i); });
    if (PV.pdf) { try { PV.pdf.destroy(); } catch (e) {} PV.pdf = null; }
    if (PV.io) { PV.io.disconnect(); PV.io = null; }
    PV.pages = null; PV.hits = []; PV.hi = -1;
    if (!f) { setHTML(el, '<div class="pvmsg">Nog geen stukken.<br><small>Sleep documenten of een mail naar dit venster.</small></div>'); return; }
    var editable = !isNew;
    if (!editable && PV.tool !== 'select') PV.tool = 'select';
    var editMode = PV.mode === 'edit' && !isNew && canEdit(f);
    var tabs = !isNew && canEdit(f) ? '<div class="vtabs"><button type="button" data-mode="pdf" class="' + (editMode ? '' : 'on') + '">PDF</button><button type="button" data-mode="edit" class="' + (editMode ? 'on' : '') + '" title="Het originele bestand bewerken">Bewerken</button></div>' : '';
    if (editMode) {
      setHTML(el, '<div class="pvbar"><div class="pvt">' + tabs + '<b class="pvname" title="' + esc(f.name) + '">' + (i + 1) + '. ' + esc(f.name) + '</b></div><div class="pvtools"><button type="button" class="tl" data-act="prev" title="Vorig stuk"' + (i ? '' : ' disabled') + '>‹</button><button type="button" class="tl" data-act="next" title="Volgend stuk"' + (i < list.length - 1 ? '' : ' disabled') + '>›</button><button type="button" class="tl" data-act="orig" title="Origineel downloaden">⤓</button></div></div><div class="edwrap" id="edw"></div>');
      $$('[data-mode]', el).forEach(function (b) { b.onclick = function () { switchMode(m, i, b.dataset.mode); }; });
      $$('[data-act]', el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); pvAct(b.dataset.act, m, i); }; });
      A.edCtl = await mountEditor(m, f, $('#edw'), function () { renderDocList(m); });
      return;
    }
    var hb = '<div class="pvbar"><div class="pvt">' + tabs + '<b class="pvname" title="' + esc(f.name) + '">' + (isNew ? '' : (i + 1) + '. ') + esc(f.name) + '</b><span class="pvst" id="pvst"></span>' +
      '<span class="srch"><input id="pvq" type="search" placeholder="Zoeken in PDF (Ctrl+F)" value="' + esc(PV.q) + '"><span id="pvqc" class="qc"></span><button type="button" class="tl" data-act="qprev" title="Vorige (Shift+Enter)">‹</button><button type="button" class="tl" data-act="qnext" title="Volgende (Enter)">›</button></span></div><div class="pvtools">';
    TOOLS.forEach(function (t) { hb += '<button type="button" class="tl' + (PV.tool === t[0] ? ' on' : '') + '" data-tool="' + t[0] + '" title="' + t[2] + '"' + (!editable && t[0] !== 'select' ? ' disabled' : '') + '>' + t[1] + '</button>'; });
    hb += '<span class="cols" id="pvcols">' + COLORS.map(function (c) { return '<button type="button" class="col" data-color="' + c + '" title="Kleur" style="--c:' + c + '"></button>'; }).join('') + '</span>';
    hb += '<button type="button" class="tl" data-act="undo" title="Ongedaan maken (Ctrl+Z)"' + (editable ? '' : ' disabled') + '>↶</button><button type="button" class="tl" data-act="redo" title="Opnieuw (Ctrl+Y)"' + (editable ? '' : ' disabled') + '>↷</button><span class="sep"></span>';
    hb += '<button type="button" class="tl" data-act="zout" title="Kleiner">−</button><button type="button" class="tl zl" data-act="fit" id="pvz" title="Passend maken">100%</button><button type="button" class="tl" data-act="zin" title="Groter">+</button><span class="sep"></span>';
    hb += '<button type="button" class="tl" data-act="prev" title="Vorig stuk"' + (i ? '' : ' disabled') + '>‹</button><button type="button" class="tl" data-act="next" title="Volgend stuk"' + (i < list.length - 1 ? '' : ' disabled') + '>›</button>';
    hb += '<button type="button" class="tl" data-act="more" title="Meer">⋯</button><div class="pvmenu" id="pvmenu" hidden>' +
      (editable ? '<button type="button" data-act="dlann">PDF met aantekeningen downloaden</button><button type="button" data-act="clear">Alle aantekeningen in dit stuk wissen</button>' : '') +
      '<button type="button" data-act="orig">Origineel downloaden</button><button type="button" data-act="tab">PDF openen in nieuw tabblad</button></div></div></div>';
    if (!editable) hb += '<div class="pvhint">Sla de vergadering eerst op. Daarna kun je markeren en opmerkingen maken.</div>';
    else if (f.conv === 'omgezet') hb += '<div class="pvhint">Automatisch omgezet naar PDF. De opmaak kan afwijken van het origineel.</div>';
    hb += '<div class="pvpages" id="pvp"><div class="pvmsg">PDF wordt klaargemaakt…</div></div>';
    setHTML(el, hb);
    $$('[data-color]', el).forEach(function (b) { b.onclick = function () { if (PV.tool !== 'mark' && PV.tool !== 'note') setTool('mark'); PV.colors[PV.tool] = b.dataset.color; markColor(); }; });
    $$('button[data-tool]', el).forEach(function (b) { b.onclick = function () { setTool(b.dataset.tool); }; });
    $$('[data-mode]', el).forEach(function (b) { b.onclick = function () { switchMode(m, i, b.dataset.mode); }; });
    $$('[data-act]', el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); pvAct(b.dataset.act, m, i); }; });
    var qi = $('#pvq'), qt;
    qi.addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { doSearch(qi.value); }, 250); });
    qi.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); if (PV.q !== qi.value) doSearch(qi.value); else gotoHit(PV.hi + (e.shiftKey ? -1 : 1)); } else if (e.key === 'Escape') { qi.value = ''; doSearch(''); } });
    markColor();
    var blob = null; try { blob = isNew ? await draftPdf(f) : await getPdf(m, f); } catch (e) { console.error(e); }
    if (tok !== PV.tok) return;
    var pvp = $('#pvp');
    if (!blob) { setHTML(pvp, '<div class="pvmsg">Dit bestand kan niet als PDF worden getoond.<br><small>Open het origineel in Word of Excel, sla het op als PDF en sleep die PDF op deze vergadering.</small><br><button type="button" class="btn" id="pvorig">Origineel downloaden</button></div>'); $('#pvorig').onclick = function () { pvAct('orig', m, i); }; return; }
    var data = new Uint8Array(await blob.arrayBuffer()), pdf;
    try { pdf = await W.pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false }).promise; }
    catch (e) { console.error(e); if (tok === PV.tok) setHTML(pvp, '<div class="pvmsg">Deze PDF kan niet worden getoond (' + esc(e.message || e) + ').<br><button type="button" class="btn" id="pvtab">Openen in nieuw tabblad</button></div>'); var pt = $('#pvtab'); if (pt) pt.onclick = function () { pvAct('tab', m, i); }; return; }
    if (tok !== PV.tok) { pdf.destroy(); return; }
    if (editable && !f.ann) f.ann = {};
    PV.pdf = pdf; PV.data = data; PV.m = m; PV.f = f; PV.ann = editable ? f.ann : {}; PV.editable = editable; PV.undo = []; PV.redo = []; PV.pages = [];
    for (var n = 1; n <= pdf.numPages; n++) { var pg = await pdf.getPage(n); if (tok !== PV.tok) return; PV.pages.push({ n: n, page: pg }); }
    bindPvp(pvp);
    layoutPages(); undoBtns();
    if (PV.q) doSearch(PV.q);
  }
  function switchMode(m, i, mode) {
    if (PV.mode === mode) return;
    if (mode === 'pdf' && A.edCtl && A.edCtl.isDirty() && !confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Weggooien?')) return;
    A.edCtl = null; PV.mode = mode; pvShow(m, i);
  }
  function renderDocList(m) { $$('#docs li[data-sel]').forEach(function (li) { var f = m.files[+li.dataset.sel]; var sz = $('.sz', li); if (f && sz) sz.textContent = kb(f.size || 0); }); }
  function markColor() { var c = PV.colors[PV.tool] || ''; $$('#pvcols .col').forEach(function (b) { b.classList.toggle('on', b.dataset.color === c); }); var cs = $('#pvcols'); if (cs) cs.classList.toggle('dim', !(PV.tool in PV.colors)); }
  function setTool(t) {
    var needLayout = PV.pages && t === 'note' && !PV.margin;
    PV.tool = t; $$('#pv button[data-tool]').forEach(function (b) { b.classList.toggle('on', b.dataset.tool === t); }); markColor();
    var box = $('#pvp'); if (box) box.dataset.t = t;
    if (needLayout) layoutPages();
  }

  /* ---------- pagina's opbouwen: canvas + tekstlaag + aantekeningen + marge */
  function layoutPages() {
    var box = $('#pvp'); if (!box || !PV.pages) return;
    var keep = box.scrollHeight ? box.scrollTop / box.scrollHeight : 0, tok = PV.tok;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (PV.io) PV.io.disconnect();
    box.dataset.t = PV.tool;
    PV.margin = PV.editable && (hasNotes(PV.ann) || PV.tool === 'note');
    var M = PV.margin ? MARGIN : 0, maxW = Math.max.apply(null, PV.pages.map(function (p) { return p.page.getViewport({ scale: 1 }).width; }));
    if (PV.fit) PV.scale = Math.max(0.3, Math.min(3, (box.clientWidth - 36) / (maxW + M)));
    var z = $('#pvz'); if (z) z.textContent = Math.round(PV.scale * 100) + '%';
    PV.io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) renderPage(e.target._p); }); }, { root: box, rootMargin: '800px 0px' });
    PV.pages.forEach(function (p) {
      if (p.task) { try { p.task.cancel(); } catch (e) {} p.task = null; }
      p.vp = p.page.getViewport({ scale: PV.scale }); p.rendered = false; p.tl = null; p.tlp = null;
      var mw = M * PV.scale, W0 = p.vp.width, H0 = p.vp.height;
      var wrap = D.createElement('div'); wrap.className = 'pgw'; wrap.style.width = (W0 + mw) + 'px'; wrap.style.height = H0 + 'px'; wrap._p = p;
      var pg = D.createElement('div'); pg.className = 'pg'; pg.style.width = W0 + 'px'; pg.style.height = H0 + 'px';
      pg.style.setProperty('--scale-factor', PV.scale); pg.style.setProperty('--total-scale-factor', PV.scale); pg.style.setProperty('--scale-round-x', '1px'); pg.style.setProperty('--scale-round-y', '1px');
      var cv = D.createElement('canvas'); cv.style.width = W0 + 'px'; cv.style.height = H0 + 'px'; pg.appendChild(cv);
      var tl = D.createElement('div'); tl.className = 'textLayer'; pg.appendChild(tl);
      wrap.appendChild(pg);
      if (mw) { var mg = D.createElement('div'); mg.className = 'mrg'; mg.style.left = W0 + 'px'; mg.style.width = mw + 'px'; wrap.appendChild(mg); p.mrg = mg; } else p.mrg = null;
      var svg = D.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + (W0 + mw) + ' ' + H0); svg.setAttribute('class', 'anl'); svg.style.width = (W0 + mw) + 'px'; svg.style.height = H0 + 'px';
      wrap.appendChild(svg);
      var lbl = D.createElement('div'); lbl.className = 'pgn'; lbl.style.left = (W0 - 40) + 'px'; lbl.textContent = p.n + ' / ' + PV.pages.length; wrap.appendChild(lbl);
      p.wrap = wrap; p.el = pg; p.cv = cv; p.svg = svg; p.tlDiv = tl; box.appendChild(wrap); PV.io.observe(wrap);
      if (PV.editable) bindPage(p);
    });
    box.scrollTop = keep * box.scrollHeight;
    PV.pages.forEach(function (p) { drawAnn(p); });
    (async function () { for (var k = 0; k < PV.pages.length; k++) { if (tok !== PV.tok || !PV.pages) return; await ensureText(PV.pages[k]); } })();
  }
  function renderPage(p) {
    if (p.rendered) return; p.rendered = true;
    var dpr = Math.min(2, W.devicePixelRatio || 1);
    p.cv.width = Math.floor(p.vp.width * dpr); p.cv.height = Math.floor(p.vp.height * dpr);
    p.task = p.page.render({ canvasContext: p.cv.getContext('2d'), canvas: p.cv, viewport: p.vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
    p.task.promise.catch(function () {});
  }
  function ensureText(p) {
    if (p.tlp) return p.tlp;
    var vp = p.vp, div = p.tlDiv;
    p.tlp = (async function () {
      var tc = p.tc || (p.tc = await p.page.getTextContent());
      if (p.vp !== vp) return;
      var tl = new W.pdfjsLib.TextLayer({ textContentSource: tc, container: div, viewport: vp });
      await tl.render();
      if (p.vp !== vp) return;
      p.tl = tl; p.strs = tl.textContentItemsStr.slice(); p.divs = tl.textDivs;
      applyHits(p);
    })().catch(function (e) { console.error(e); });
    return p.tlp;
  }

  /* ---------- zoeken */
  function normS(s) { var o = ''; for (var i = 0; i < s.length; i++) { var c = s[i], n = c.normalize('NFD')[0].toLowerCase(); o += n.length === 1 ? n : c; } return o; }
  async function doSearch(q) {
    PV.q = q; PV.hits = []; PV.hi = -1;
    var cnt = $('#pvqc'); if (!PV.pages) return;
    var nq = normS(q.trim());
    if (!nq) { PV.pages.forEach(applyHits); if (cnt) cnt.textContent = ''; return; }
    if (cnt) cnt.textContent = '…';
    var tok = PV.tok;
    for (var k = 0; k < PV.pages.length; k++) await ensureText(PV.pages[k]);
    if (tok !== PV.tok || PV.q !== q) return;
    PV.pages.forEach(function (p) {
      if (!p.strs) return;
      var full = '', st = [];
      p.strs.forEach(function (s) { st.push(full.length); full += s; });
      p.starts = st;
      var hay = normS(full), at = 0, ix;
      while ((ix = hay.indexOf(nq, at)) >= 0) { PV.hits.push({ p: p, s: ix, e: ix + nq.length }); at = ix + nq.length; }
    });
    PV.pages.forEach(applyHits);
    if (cnt) cnt.textContent = PV.hits.length ? '' : 'geen';
    if (PV.hits.length) gotoHit(0);
  }
  function applyHits(p) {
    if (!p.divs) return;
    p.divs.forEach(function (d, k) { if (d._hl) { d.textContent = p.strs[k]; d._hl = false; } });
    var hits = (PV.hits || []).map(function (h, idx) { return { h: h, idx: idx }; }).filter(function (x) { return x.h.p === p; });
    if (!hits.length || !p.starts) return;
    var per = {};
    hits.forEach(function (x) {
      for (var k = 0; k < p.strs.length; k++) {
        var a = p.starts[k], b = a + p.strs[k].length;
        if (b <= x.h.s || a >= x.h.e) continue;
        (per[k] = per[k] || []).push([Math.max(0, x.h.s - a), Math.min(b, x.h.e) - a, x.idx]);
      }
    });
    Object.keys(per).forEach(function (k) {
      var d = p.divs[+k], s = p.strs[+k], pos = 0; if (!d) return;
      d.textContent = ''; d._hl = true;
      per[k].sort(function (u, v) { return u[0] - v[0]; }).forEach(function (seg) {
        if (seg[0] > pos) d.appendChild(D.createTextNode(s.slice(pos, seg[0])));
        var sp = D.createElement('span'); sp.className = 'hit' + (seg[2] === PV.hi ? ' cur' : ''); sp.dataset.h = seg[2]; sp.textContent = s.slice(seg[0], seg[1]); d.appendChild(sp); pos = seg[1];
      });
      if (pos < s.length) d.appendChild(D.createTextNode(s.slice(pos)));
    });
  }
  function gotoHit(i) {
    var n = PV.hits.length, cnt = $('#pvqc'); if (!n) return;
    PV.hi = ((i % n) + n) % n;
    $$('#pvp .hit.cur').forEach(function (e) { e.classList.remove('cur'); });
    var els = $$('#pvp .hit[data-h="' + PV.hi + '"]');
    els.forEach(function (e) { e.classList.add('cur'); });
    if (cnt) cnt.textContent = (PV.hi + 1) + '/' + n;
    var h = PV.hits[PV.hi]; renderPage(h.p);
    if (els[0]) els[0].scrollIntoView({ block: 'center', inline: 'nearest' }); else h.p.wrap.scrollIntoView({ block: 'start' });
  }

  /* ---------- aantekeningen tekenen */
  function toVp(p, x, y) { return p.vp.convertToViewportPoint(x, y); }
  function shapeEl(p, s, i) {
    var g = D.createElementNS(SVGNS, 'g'); g.setAttribute('data-i', i);
    if (s.t === 'mark') {
      s.rects.forEach(function (r) {
        var a = toVp(p, r[0], r[1]), b = toVp(p, r[2], r[3]), rc = D.createElementNS(SVGNS, 'rect');
        rc.setAttribute('x', Math.min(a[0], b[0])); rc.setAttribute('y', Math.min(a[1], b[1])); rc.setAttribute('width', Math.abs(b[0] - a[0])); rc.setAttribute('height', Math.abs(b[1] - a[1]));
        rc.setAttribute('fill', s.c); rc.setAttribute('class', 'mk'); g.appendChild(rc);
      });
    } else if (s.t === 'pen' || s.t === 'hl') {
      var d = s.pts.map(function (q, k) { var v = toVp(p, q[0], q[1]); return (k ? 'L' : 'M') + v[0].toFixed(1) + ' ' + v[1].toFixed(1); }).join(' ');
      if (s.pts.length === 1) d += ' l0.1 0';
      var hit = D.createElementNS(SVGNS, 'path'); hit.setAttribute('d', d); hit.setAttribute('class', 'hitp'); hit.setAttribute('stroke-width', Math.max(12, s.w * PV.scale)); g.appendChild(hit);
      var path = D.createElementNS(SVGNS, 'path'); path.setAttribute('d', d); path.setAttribute('stroke', s.c); path.setAttribute('stroke-width', s.w * PV.scale); path.setAttribute('class', s.t === 'hl' ? 'hl' : 'pen'); g.appendChild(path);
    }
    return g;
  }
  function drawAnn(p) {
    var svg = p.svg; while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (p.mrg) p.mrg.textContent = '';
    var notes = [];
    (PV.ann[p.n] || []).forEach(function (s, i) { if (isNote(s)) notes.push({ s: s, i: i }); else svg.appendChild(shapeEl(p, s, i)); });
    if (!notes.length || !p.mrg) return;
    var fs = 9 * PV.scale, W0 = p.vp.width;
    notes.forEach(function (n) {
      var v = toVp(p, n.s.x, n.s.y); n.ax = v[0]; n.ay = v[1];
      if (n.s.w) { var w1 = toVp(p, n.s.w[0], n.s.w[1]), w2 = toVp(p, n.s.w[2], n.s.w[3]); n.wx1 = Math.min(w1[0], w2[0]); n.wx2 = Math.max(w1[0], w2[0]); n.wy = Math.max(w1[1], w2[1]) + 1; n.ay = n.wy; n.ax = n.wx2; }
      var bx = D.createElement('div'); bx.className = 'nbox'; bx.style.fontSize = fs + 'px'; bx.style.borderLeftColor = n.s.c || PV.noteColor; bx.dataset.i = n.i;
      var tx = D.createElement('div'); tx.className = 'ntx'; tx.textContent = n.s.txt; bx.appendChild(tx);
      if (PV.editable) { var x = D.createElement('button'); x.type = 'button'; x.className = 'nx'; x.title = 'Opmerking verwijderen'; x.textContent = '×'; bx.appendChild(x); x.onclick = function (e) { e.stopPropagation(); commit(p, function (arr) { arr.splice(n.i, 1); }); }; }
      bx.addEventListener('click', function () { if (!PV.editable) return; if (PV.tool === 'erase') { commit(p, function (arr) { arr.splice(n.i, 1); }); return; } noteEditor(p, n.i, null); });
      bx.addEventListener('mouseenter', function () { var l = svg.querySelector('[data-n="' + n.i + '"]'); if (l) l.classList.add('on'); });
      bx.addEventListener('mouseleave', function () { var l = svg.querySelector('[data-n="' + n.i + '"]'); if (l) l.classList.remove('on'); });
      p.mrg.appendChild(bx); n.el = bx;
    });
    notes.sort(function (a, b) { return a.ay - b.ay; });
    var prev = 4;
    notes.forEach(function (n) {
      var top = Math.max(n.ay - 9 * PV.scale, prev); n.el.style.top = top + 'px'; prev = top + n.el.offsetHeight + 6;
      var y = top + 8 * PV.scale, x0 = W0 + 10, gx = W0 + 5, col = n.s.c || PV.noteColor, path = D.createElementNS(SVGNS, 'path');
      path.setAttribute('d', 'M' + x0 + ' ' + y + ' L' + gx + ' ' + y + ' L' + gx + ' ' + n.ay + ' L' + (n.ax + 2) + ' ' + n.ay);
      if (n.wx1 != null) { var ul = D.createElementNS(SVGNS, 'path'); ul.setAttribute('d', 'M' + n.wx1 + ' ' + n.wy + ' L' + n.wx2 + ' ' + n.wy); ul.setAttribute('class', 'uline'); ul.setAttribute('stroke', col); svg.appendChild(ul); }
      path.setAttribute('class', 'conn'); path.setAttribute('stroke', n.s.c || PV.noteColor); path.setAttribute('data-n', n.i);
      svg.appendChild(path);
      var ang = Math.PI, L = 6, wA = 0.5, ah = D.createElementNS(SVGNS, 'path');
      ah.setAttribute('d', 'M' + n.ax + ' ' + n.ay + ' L' + (n.ax - L * Math.cos(ang - wA)) + ' ' + (n.ay - L * Math.sin(ang - wA)) + ' L' + (n.ax - L * Math.cos(ang + wA)) + ' ' + (n.ay - L * Math.sin(ang + wA)) + ' Z');
      ah.setAttribute('fill', n.s.c || PV.noteColor); ah.setAttribute('class', 'arrow'); svg.appendChild(ah);
    });
  }
  function snapshot() { PV.undo.push(JSON.stringify(PV.ann)); if (PV.undo.length > 20) PV.undo.shift(); PV.redo = []; undoBtns(); }
  function undoBtns() { var u = $('#pv [data-act=undo]'), r = $('#pv [data-act=redo]'); if (u) u.disabled = !PV.editable || !(PV.undo && PV.undo.length); if (r) r.disabled = !PV.editable || !(PV.redo && PV.redo.length); }
  function restoreAnn(st) { var prev = JSON.parse(st); Object.keys(PV.ann).forEach(function (k) { delete PV.ann[k]; }); Object.keys(prev).forEach(function (k) { PV.ann[k] = prev[k]; }); layoutPages(); changed(); undoBtns(); }
  function changed() {
    var st = $('#pvst'); if (st) st.textContent = 'opslaan…';
    clearTimeout(PV.saveT);
    var m = PV.m;
    PV.saveT = setTimeout(async function () {
      try { m.updated = new Date().toISOString(); await persist(); var s2 = $('#pvst'); if (s2) s2.textContent = 'opgeslagen ✓'; refreshAnnBadge(); }
      catch (e) { toast('Aantekeningen opslaan mislukt: ' + (e.message || e), 'err'); }
    }, 600);
  }
  function refreshAnnBadge() {
    if (!A.sel) return; var li = $('#docs li[data-sel="' + A.sel.i + '"] .dl2'); if (!li) return;
    var b = $('.bdg.ann', li), n = annCount(PV.ann);
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = D.createElement('span'); b.className = 'bdg ann'; b.title = 'Aantekeningen'; li.insertBefore(b, $('.sp', li)); }
    b.textContent = '✎ ' + n;
  }
  function commit(p, fn) {
    snapshot(); var arr = PV.ann[p.n] || (PV.ann[p.n] = []); fn(arr); if (!arr.length) delete PV.ann[p.n];
    var needM = PV.editable && (hasNotes(PV.ann) || PV.tool === 'note');
    if (needM !== !!PV.margin) layoutPages(); else drawAnn(p);
    changed();
  }

  /* ---------- interactie: markeren (uit selectie), opmerkingen, gum */
  function bindPvp(box) {
    box.addEventListener('mouseup', function () {
      if (PV.tool !== 'mark' || !PV.editable) return;
      setTimeout(function () {
        var sel = W.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        var rg = sel.getRangeAt(0), rects = Array.prototype.slice.call(rg.getClientRects()), made = false;
        PV.pages.forEach(function (p) {
          if (!p.tl) return;
          var pr = p.el.getBoundingClientRect(), list = [];
          rects.forEach(function (r) {
            if (r.width < 1 || r.height < 1 || r.height > pr.height * 0.12) return;
            if (r.right < pr.left || r.left > pr.right || r.bottom < pr.top || r.top > pr.bottom) return;
            var a = p.vp.convertToPdfPoint(r.left - pr.left, r.top - pr.top), b = p.vp.convertToPdfPoint(r.right - pr.left, r.bottom - pr.top);
            list.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
          });
          if (!list.length) return;
          list.sort(function (u, v) { return v[1] - u[1] || u[0] - v[0]; });
          var merged = [];
          list.forEach(function (r) { var l = merged[merged.length - 1]; if (l && Math.abs(l[1] - r[1]) < 2 && Math.abs(l[3] - r[3]) < 2 && r[0] <= l[2] + 2) { l[2] = Math.max(l[2], r[2]); l[0] = Math.min(l[0], r[0]); } else merged.push(r.slice()); });
          merged = merged.map(function (r) { return r.map(function (v) { return Math.round(v * 10) / 10; }); });
          commit(p, function (arr) { arr.push({ t: 'mark', c: PV.colors.mark, rects: merged }); }); made = true;
        });
        if (made) sel.removeAllRanges();
      }, 0);
    });
  }
  function bindPage(p) {
    p.el.addEventListener('click', function (e) {
      if (PV.tool !== 'note' || e.button > 0) return;
      var sel = W.getSelection(); if (sel && !sel.isCollapsed) return;
      var r = p.el.getBoundingClientRect(), q = p.vp.convertToPdfPoint(e.clientX - r.left, e.clientY - r.top), wr = null;
      try {
        var cr = D.caretRangeFromPoint ? D.caretRangeFromPoint(e.clientX, e.clientY) : null, nd = cr && cr.startContainer;
        if (nd && nd.nodeType === 3 && p.tlDiv.contains(nd)) {
          var t = nd.nodeValue, a = cr.startOffset, b = a;
          while (a > 0 && /\S/.test(t[a - 1])) a--; while (b < t.length && /\S/.test(t[b])) b++;
          if (b > a) { var wrg = D.createRange(); wrg.setStart(nd, a); wrg.setEnd(nd, b); var bb = wrg.getBoundingClientRect();
            if (bb.width > 0 && bb.height < r.height * 0.1) { var c1 = p.vp.convertToPdfPoint(bb.left - r.left, bb.top - r.top), c2 = p.vp.convertToPdfPoint(bb.right - r.left, bb.bottom - r.top); wr = [Math.min(c1[0], c2[0]), Math.min(c1[1], c2[1]), Math.max(c1[0], c2[0]), Math.max(c1[1], c2[1])].map(function (v) { return Math.round(v * 10) / 10; }); } }
        }
      } catch (er) {}
      var at = wr ? [wr[2], wr[1]] : [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10];
      noteEditor(p, -1, at, wr);
    });
    p.svg.addEventListener('click', function (e) {
      if (PV.tool !== 'erase') return;
      var g = e.target.closest && e.target.closest('g[data-i]'); if (g) commit(p, function (arr) { arr.splice(+g.getAttribute('data-i'), 1); });
    });
  }
  function noteEditor(p, idx, at, wr) {
    if (!p.mrg) { layoutPages(); p = PV.pages[p.n - 1]; if (!p.mrg) return; }
    var old = idx >= 0 ? PV.ann[p.n][idx] : null, anchor = old ? toVp(p, old.x, old.y) : toVp(p, at[0], at[1]);
    var ta = D.createElement('textarea'); ta.className = 'nedit'; ta.value = old ? old.txt : ''; ta.placeholder = 'Typ je opmerking… (Ctrl+Enter = klaar)';
    ta.style.fontSize = 9 * PV.scale + 'px'; ta.style.top = Math.max(4, anchor[1] - 9 * PV.scale) + 'px'; ta.style.borderLeftColor = old ? old.c : PV.noteColor;
    if (old) { var bx = p.mrg.querySelector('.nbox[data-i="' + idx + '"]'); if (bx) { ta.style.top = bx.style.top; bx.style.visibility = 'hidden'; } }
    p.mrg.appendChild(ta);
    var tmp = null;
    if (!old) { tmp = D.createElementNS(SVGNS, 'circle'); tmp.setAttribute('cx', anchor[0]); tmp.setAttribute('cy', anchor[1]); tmp.setAttribute('r', 3); tmp.setAttribute('fill', PV.noteColor); p.svg.appendChild(tmp); }
    ta.focus();
    var done = false;
    function finish(save) {
      if (done) return; done = true; var txt = ta.value.replace(/\s+$/, ''); ta.remove(); if (tmp) tmp.remove();
      if (!save) { drawAnn(p); return; }
      if (old) commit(p, function (arr) { if (txt) { var o = { t: 'note', c: old.c || PV.noteColor, x: old.x, y: old.y, txt: txt }; if (old.w) o.w = old.w; arr[idx] = o; } else arr.splice(idx, 1); });
      else if (txt) commit(p, function (arr) { var o = { t: 'note', c: PV.noteColor, x: at[0], y: at[1], txt: txt }; if (wr) o.w = wr; arr.push(o); });
    }
    ta.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') finish(false); else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true); });
    ta.addEventListener('blur', function () { finish(true); });
    ta.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  async function pvAct(a, m, i) {
    var list = m.isNew ? m.pending : m.files, f = list[i], menu = $('#pvmenu');
    if (a === 'more') { if (menu) menu.hidden = !menu.hidden; return; }
    if (menu) menu.hidden = true;
    if (a === 'prev' && i > 0) return pvShow(m, i - 1);
    if (a === 'next' && i < list.length - 1) return pvShow(m, i + 1);
    if (a === 'qnext' || a === 'qprev') { var qi = $('#pvq'); if (qi && qi.value !== PV.q) return doSearch(qi.value); return gotoHit(PV.hi + (a === 'qnext' ? 1 : -1)); }
    if (a === 'zin' || a === 'zout') { PV.fit = false; PV.scale = Math.max(0.3, Math.min(4, PV.scale * (a === 'zin' ? 1.2 : 1 / 1.2))); layoutPages(); if (PV.q) doSearch(PV.q); return; }
    if (a === 'fit') { PV.fit = true; layoutPages(); if (PV.q) doSearch(PV.q); return; }
    if (a === 'undo') { if (!PV.undo || !PV.undo.length) return; (PV.redo = PV.redo || []).push(JSON.stringify(PV.ann)); if (PV.redo.length > 20) PV.redo.shift(); restoreAnn(PV.undo.pop()); return; }
    if (a === 'redo') { if (!PV.redo || !PV.redo.length) return; PV.undo.push(JSON.stringify(PV.ann)); if (PV.undo.length > 20) PV.undo.shift(); restoreAnn(PV.redo.pop()); return; }
    if (a === 'clear') { if (!annCount(PV.ann) || !confirm('Alle markeringen en opmerkingen in "' + f.name + '" wissen?')) return; snapshot(); Object.keys(PV.ann).forEach(function (k) { delete PV.ann[k]; }); layoutPages(); changed(); return; }
    if (a === 'orig') { dl(m.isNew ? f.blob : await A.store.get(m, f.name), f.name); return; }
    if (a === 'tab') { if (!PV.data) return; var u = URL.createObjectURL(new Blob([PV.data], { type: 'application/pdf' })); W.open(u, '_blank'); setTimeout(function () { URL.revokeObjectURL(u); }, 120000); return; }
    if (a === 'dlann') { if (!PV.data) return; try { var out = await burnAnnotations(PV.data, PV.ann); dl(new Blob([out], { type: 'application/pdf' }), safe(f.name.replace(/\.[^.]*$/, '')) + (annCount(PV.ann) ? ' (met aantekeningen)' : '') + '.pdf'); } catch (e) { toast('Downloaden mislukt: ' + (e.message || e), 'err'); } }
  }
  function initPv() {
    D.addEventListener('keydown', function (e) {
      if (!$('#pv') || !PV.pages) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { var qi = $('#pvq'); if (qi) { e.preventDefault(); qi.focus(); qi.select(); } return; }
      if (!PV.editable || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable) return;
      var k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ((k === 'z' && e.shiftKey) || k === 'y')) { e.preventDefault(); pvAct('redo', PV.m, A.sel ? A.sel.i : 0); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); pvAct('undo', PV.m, A.sel ? A.sel.i : 0); }
    });
    D.addEventListener('click', function (e) { var mn = $('#pvmenu'); if (mn && !mn.hidden && !e.target.closest('#pvmenu')) mn.hidden = true; });
    var rt; W.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (PV.fit && $('#pvp') && PV.pages) { layoutPages(); if (PV.q) doSearch(PV.q); } }, 200); });
  }
  /* ------------------------------------------------------------- export */
  function exportName(m) { return safe((m.title || 'Vergadering') + ' - ' + (m.date ? fmtShort(m.date) : 'zonder datum') + (m.start ? ' ' + m.start.replace(':', '.') + (m.end ? '-' + m.end.replace(':', '.') : '') : '')).slice(0, 150) + '.pdf'; }
  async function exportMeeting(m) {
    var btn = $('#exp'); if (btn) btn.disabled = true;
    try {
      var items = [];
      for (var i = 0; i < m.files.length; i++) {
        toast('Stuk ' + (i + 1) + ' van ' + m.files.length + ' klaarmaken…');
        var f = m.files[i], b = await getPdf(m, f).catch(function () { return null; });
        items.push({ f: f, how: f.conv, ann: f.ann, bytes: b ? new Uint8Array(await b.arrayBuffer()) : null });
      }
      toast('PDF samenvoegen…');
      var bytes = await mergeMeeting(m, items), name = exportName(m), blob = new Blob([bytes], { type: 'application/pdf' });
      dl(blob, name);
      var where = 'in je map Downloads';
      if (A.store.kind === 'map') { try { await A.store.put(m, name, blob); where += ' en in de map van de vergadering'; } catch (e) {} }
      var missing = items.filter(function (x) { return !x.bytes || !x.pages; }).length;
      toast('"' + name + '" staat ' + where + '.' + (missing ? ' ' + missing + ' stuk(ken) konden niet worden opgenomen.' : ''), missing ? 'warn' : 'ok');
    } catch (e) { console.error(e); toast('Exporteren mislukt: ' + (e.message || e), 'err'); }
    finally { if (btn) btn.disabled = false; }
  }
  function openBlob(b, name, type) {
    var blob = type && b.type !== type ? new Blob([b], { type: type }) : b;
    if (/\.(pdf|png|jpe?g|gif|txt)$/i.test(name)) { var u = URL.createObjectURL(blob); W.open(u, '_blank'); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }
    else dl(blob, name);
  }
  function dl(b, name) { var u = URL.createObjectURL(b), a = D.createElement('a'); a.href = u; a.download = name; D.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 10000); }

  /* ------------------------------------------------------------- start */
  function initDrop() {
    var ov = $('#overlay'), depth = 0;
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    D.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; var c = currentMeeting(); $('#ovText').textContent = c ? 'Laat los om toe te voegen aan "' + (c.title || 'deze vergadering') + '"' : 'Laat los om een vergadering aan te maken'; ov.className = 'on'; });
    D.addEventListener('dragover', function (e) { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    D.addEventListener('dragleave', function () { if (--depth <= 0) { depth = 0; ov.className = ''; } });
    D.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return; e.preventDefault(); depth = 0; ov.className = '';
      if (!e.dataTransfer.files.length) { toast('Er kwam geen bestand mee. Sleep de mail eerst naar je bureaublad en daarna hierheen.', 'warn'); return; }
      var c = currentMeeting(); if (c) { var frm = $('#frm'); if (frm) $$('[name]', frm).forEach(function (x) { c[x.name] = x.value; }); }
      handleDrop(e.dataTransfer.files);
    });
    $('#pickMail').onchange = function () { var f = this.files; if (f.length) handleDrop(f); this.value = ''; };
    $('#pickDocs').onchange = function () { var f = this.files; if (f.length) handleDrop(f); this.value = ''; };
  }
  try { A.notesOpen = localStorage.getItem('mebabs-notes') === '1'; } catch (e) {}
  W.addEventListener('hashchange', function () { if (A.flushNotes) { try { A.flushNotes(); } catch (e) {} A.flushNotes = null; } });
  W.addEventListener('beforeunload', function (e) { if (A.flushNotes) A.flushNotes(); if (A.edCtl && A.edCtl.isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  async function start() {
    initDrop(); initPv();
    W.addEventListener('hashchange', route);
    var mode = await kvGet('mode').catch(function () { return null; });
    if (mode === 'browser') return useStore(new BrowserStore());
    if (mode === 'map') {
      var h = await kvGet('dir').catch(function () { return null; });
      if (h) {
        A.hadDir = true;
        try { if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return useStore(new FolderStore(h)); } catch (e) {}
        route();
        setHTML($('#main'), '<div class="card welcome"><h1>Welkom terug</h1><p>Edge vraagt om opnieuw toegang te geven tot de map <b>' + esc(h.name) + '</b>.</p><button class="btn pri" id="recon">Map openen</button> <button class="btn" id="other">Andere map kiezen</button></div>');
        $('#recon').onclick = reconnect; $('#other').onclick = chooseFolder;
        return;
      }
    }
    route();
  }
  start().catch(function (e) { setHTML($('#main'), '<div class="card welcome"><h1>Er ging iets mis bij het starten</h1><p>' + esc(e.message || e) + '</p><button class="btn" id="useIdb">In de browser bewaren</button></div>'); $('#useIdb').onclick = function () { useStore(new BrowserStore()); }; });
  if (W.__VA_TEST) W.__va = { findBase: findBase, baseCandidates: baseCandidates, detectBase: detectBase, kvSet: kvSet, findLink: findLink, convertToPdf: convertToPdf, mergeMeeting: mergeMeeting, A: A, useStore: useStore, FolderStore: FolderStore, BrowserStore: BrowserStore, handleDrop: handleDrop };
