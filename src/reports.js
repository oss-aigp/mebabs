  /* ================================================================== Verslagen: aantekeningen in een Word-achtige editor */
  var REP_BLOCK = { P: 'p', DIV: 'p', H1: 'h1', H2: 'h2', LI: 'li' };
  /* DOM van de editor -> beperkte, veilige HTML (alleen b, i, u, p, h1, h2, ul, ol, li, br) en platte tekst */
  function repSerialize(root) {
    var html = '', lines = [];
    function inl(n) {
      var o = '', t = '';
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { o += esc(c.nodeValue); t += c.nodeValue; }
        else if (c.nodeType === 1) {
          var tag = c.nodeName;
          if (tag === 'BR') { o += '<br>'; t += '\n'; continue; }
          if (REP_BLOCK[tag] || tag === 'UL' || tag === 'OL') continue;
          var r = inl(c), fw = c.style && c.style.fontWeight, fs = c.style && c.style.fontStyle, td = c.style && c.style.textDecorationLine || c.style && c.style.textDecoration || '';
          var b = tag === 'B' || tag === 'STRONG' || fw === 'bold' || +fw >= 600, i = tag === 'I' || tag === 'EM' || fs === 'italic', u = tag === 'U' || /underline/.test(td);
          var h = r.h; if (u) h = '<u>' + h + '</u>'; if (i) h = '<i>' + h + '</i>'; if (b) h = '<b>' + h + '</b>';
          o += h; t += r.t;
        }
      }
      return { h: o, t: t };
    }
    function hasBlock(n) { return !!n.querySelector('p,div,h1,h2,ul,ol,li'); }
    function flushInline(nodes) {
      if (!nodes.length) return;
      var tmp = D.createElement('div'); nodes.forEach(function (x) { tmp.appendChild(x.cloneNode(true)); });
      var r = inl(tmp); if (r.t.trim() || r.h) { html += '<p>' + (r.h || '<br>') + '</p>'; lines.push(r.t); }
    }
    function blocks(n) {
      var run = [];
      for (var c = n.firstChild; c; c = c.nextSibling) {
        var tag = c.nodeType === 1 ? c.nodeName : '';
        if (tag === 'UL' || tag === 'OL') { flushInline(run); run = []; var lt = tag.toLowerCase(); html += '<' + lt + '>'; blocks(c); html += '</' + lt + '>'; continue; }
        if (REP_BLOCK[tag]) {
          flushInline(run); run = [];
          if ((tag === 'DIV' || tag === 'P') && hasBlock(c)) { blocks(c); continue; }
          var k = REP_BLOCK[tag], r = inl(c); r.t = r.t.replace(/\n$/, ''); html += '<' + k + '>' + (r.h || '<br>') + '</' + k + '>'; lines.push(r.t);
          if (tag === 'LI') { for (var q = c.firstChild; q; q = q.nextSibling) if (q.nodeName === 'UL' || q.nodeName === 'OL') { var l2 = q.nodeName.toLowerCase(); html += '<' + l2 + '>'; blocks(q); html += '</' + l2 + '>'; } }
          continue;
        }
        if (tag === 'BR') { flushInline(run); run = []; html += '<p><br></p>'; lines.push(''); continue; }
        run.push(c);
      }
      flushInline(run);
    }
    blocks(root);
    return { html: html, text: lines.join('\n').replace(/\u00a0/g, ' ').replace(/\s+$/, '') };
  }
  function repHtmlOf(m) {
    if (m.minutesHtml) return m.minutesHtml;
    var ls = String(m.minutes || '').split(/\r?\n/);
    return ls.map(function (l) { return '<p>' + (l ? esc(l) : '<br>') + '</p>'; }).join('') || '<p><br></p>';
  }
  function repPreview(m) { var t = String(m.minutes || '').replace(/\s+/g, ' ').trim(); return t.length > 110 ? t.slice(0, 110) + '…' : t; }

  function renderReports() {
    var f = A.rf || (A.rf = { q: '', all: false, key: 'changed', dir: -1 }), q = f.q.toLowerCase();
    var list = A.data.meetings.filter(function (m) {
      if (!f.all && !(m.minutes || '').trim()) return false;
      return !q || [m.title, m.minutes].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var key = f.key, dir = f.dir;
    list.sort(function (a, b) {
      var x, y;
      if (key === 'name') { x = (a.title || '').toLowerCase(); y = (b.title || '').toLowerCase(); }
      else if (key === 'date') { x = (a.date || '') + ' ' + (a.start || ''); y = (b.date || '') + ' ' + (b.start || ''); }
      else { x = a.minutesUpdated || ''; y = b.minutesUpdated || ''; }
      var r = x < y ? -1 : x > y ? 1 : 0;
      return (r || (a.title || '').localeCompare(b.title || '', 'nl')) * (r ? dir : 1);
    });
    var cols = [['name', 'Naam'], ['date', 'Datum'], ['changed', 'Gewijzigd']];
    var h = '<div class="head"><h1>Verslagen</h1></div><section class="card"><div class="filters"><input id="rq" type="search" placeholder="Zoeken in verslagen…" value="' + esc(f.q) + '">' +
      '<label class="chk"><input type="checkbox" id="rall"' + (f.all ? ' checked' : '') + '> Ook vergaderingen zonder aantekeningen</label></div>';
    h += '<div class="tw"><table><thead><tr>' + cols.map(function (c) { var on = f.key === c[0]; return '<th class="' + (on ? 'on' : '') + '" data-rsort="' + c[0] + '">' + c[1] + '<i>' + (on ? (f.dir < 0 ? '▼' : '▲') : '↕') + '</i></th>'; }).join('') + '<th class="nosort">Begin van het verslag</th></tr></thead><tbody>';
    h += list.length ? list.map(function (m) {
      var chg = m.minutesUpdated ? new Date(m.minutesUpdated) : null;
      return '<tr class="rrow" data-rid="' + esc(m.id) + '"><td><b>' + esc(m.title || 'Vergadering') + '</b></td><td>' + esc(fmtShort(m.date)) + '</td><td>' + (chg ? esc(pad(chg.getDate()) + '-' + pad(chg.getMonth() + 1) + '-' + chg.getFullYear() + ' ' + pad(chg.getHours()) + ':' + pad(chg.getMinutes())) : '—') + '</td><td class="muted">' + esc(repPreview(m)) + '</td></tr>';
    }).join('') : '<tr><td colspan="4" class="empty">' + (A.data.meetings.length ? 'Geen verslagen gevonden. Maak aantekeningen bij een vergadering, of vink hierboven de vergaderingen zonder aantekeningen aan.' : 'Nog geen vergaderingen.') + '</td></tr>';
    h += '</tbody></table></div><p class="note">' + list.length + ' verslag' + (list.length === 1 ? '' : 'en') + ' · Klik op een kolomkop om te sorteren, en op een verslag om het te bewerken.</p></section>';
    setHTML($('#main'), h);
    $$('[data-rsort]').forEach(function (th) { th.onclick = function () { var k = th.dataset.rsort; f.dir = f.key === k ? -f.dir : (k === 'name' ? 1 : -1); f.key = k; renderReports(); }; });
    $$('.rrow').forEach(function (r) { r.onclick = function () { location.hash = '#/verslag/' + encodeURIComponent(r.dataset.rid); }; });
    var qi = $('#rq'); qi.oninput = function () { f.q = qi.value; var pos = qi.selectionStart; renderReports(); var n = $('#rq'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#rall').onchange = function () { f.all = this.checked; renderReports(); };
  }

  function renderReport(m) {
    var h = '<div class="head"><h1>' + esc(m.title || 'Vergadering') + ' <span class="muted rdate">' + esc(fmtShort(m.date)) + '</span></h1><div class="acts"><a class="btn" href="#/v/' + esc(encodeURIComponent(m.id)) + '">Naar vergadering</a><a class="btn" href="#/verslagen">Terug naar verslagen</a></div></div>';
    h += '<section class="card repcard"><div class="edwrap" id="repbox"></div></section>';
    setHTML($('#main'), h);
    var box = $('#repbox'), ribbon = el2('div', 'ribbon rb-rep'), st = el2('span', 'edst');
    var sel = el2('select', 'rsel'); sel.title = 'Stijl';
    [['p', 'Normale tekst'], ['h1', 'Kop 1'], ['h2', 'Kop 2']].forEach(function (o) { var op = el2('option', null, o[1]); op.value = o[0]; sel.appendChild(op); });
    var bB = btn('B', 'Vet (Ctrl+B)', 'b'), bI = btn('I', 'Cursief (Ctrl+I)', 'i'), bU = btn('U', 'Onderstreept (Ctrl+U)', 'u'), bUl = btn('• Lijst', 'Opsomming'), bOl = btn('1. Lijst', 'Genummerde lijst'), un = btn('↶', 'Ongedaan maken (Ctrl+Z)'), re = btn('↷', 'Opnieuw (Ctrl+Y)'), bAct = btn('! Actie', 'Begin deze regel met ! zodat de regel in de Actielijst komt');
    var dlB = btn('⤓ Tekstbestand', 'Download als tekstbestand');
    [un, re, null, sel, null, bB, bI, bU, null, bUl, bOl, null, bAct, null, dlB].forEach(function (x) { ribbon.appendChild(x || sepEl()); });
    ribbon.appendChild(el2('span', 'rsp')); ribbon.appendChild(st);
    var body = el2('div', 'edbody eb-rep'), ed = el2('div', 'docx-ed rep-ed'), foot = el2('div', 'edfoot');
    ed.contentEditable = 'true'; ed.spellcheck = true; ed.lang = 'nl';
    setHTML(ed, repHtmlOf(m)); try { D.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    body.appendChild(ed); foot.appendChild(el2('span', null, 'Begin een regel met ! voor een actie; die komt dan in de Actielijst.')); foot.appendChild(el2('span', 'edtip', 'Wijzigingen worden automatisch bewaard.'));
    box.appendChild(ribbon); box.appendChild(body); box.appendChild(foot);
    var t = null;
    function status(txt, cls) { st.textContent = txt; st.className = 'edst' + (cls ? ' ' + cls : ''); }
    async function save() {
      t = null; var r = repSerialize(ed); m.minutesHtml = r.html; m.minutes = r.text;
      await saveMinutes(m); status('Opgeslagen ✓', 'ok');
    }
    function queue() { status('Opslaan…'); clearTimeout(t); t = setTimeout(save, 800); }
    A.flushNotes = function () { if (t) { clearTimeout(t); return save(); } };
    function cmd(c, v) { ed.focus(); D.execCommand(c, false, v || null); queue(); refresh(); }
    function refresh() {
      var b = D.queryCommandValue('formatBlock').toLowerCase().replace(/[<>]/g, '');
      sel.value = b === 'h1' || b === 'h2' ? b : 'p';
      bB.classList.toggle('on', D.queryCommandState('bold')); bI.classList.toggle('on', D.queryCommandState('italic')); bU.classList.toggle('on', D.queryCommandState('underline'));
      bUl.classList.toggle('on', D.queryCommandState('insertUnorderedList')); bOl.classList.toggle('on', D.queryCommandState('insertOrderedList'));
    }
    bB.onclick = function () { cmd('bold'); }; bI.onclick = function () { cmd('italic'); }; bU.onclick = function () { cmd('underline'); };
    bUl.onclick = function () { cmd('insertUnorderedList'); }; bOl.onclick = function () { cmd('insertOrderedList'); };
    un.onclick = function () { cmd('undo'); }; re.onclick = function () { cmd('redo'); };
    sel.onchange = function () { cmd('formatBlock', sel.value === 'p' ? 'P' : sel.value.toUpperCase()); };
    bAct.onclick = function () { ed.focus(); var s = W.getSelection(); if (!s.rangeCount) return; var bl = s.anchorNode; while (bl && bl !== ed && !(bl.nodeType === 1 && /^(P|DIV|H1|H2|LI)$/.test(bl.nodeName))) bl = bl.parentNode; if (!bl || bl === ed) { D.execCommand('insertText', false, '! '); } else if (!/^\s*!/.test(bl.textContent)) { var r = D.createRange(); r.setStart(bl, 0); r.collapse(true); s.removeAllRanges(); s.addRange(r); D.execCommand('insertText', false, '! '); } queue(); };
    dlB.onclick = function () { var r = repSerialize(ed); m.minutes = r.text; dl(new Blob(['﻿' + minutesText(m)], { type: 'text/plain' }), minutesFileName(m)); };
    ed.addEventListener('input', queue);
    ed.addEventListener('keyup', refresh); ed.addEventListener('mouseup', refresh);
    ed.addEventListener('keydown', function (e) { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); clearTimeout(t); save(); } });
    ed.addEventListener('paste', function (e) { e.preventDefault(); var tx = (e.clipboardData || W.clipboardData).getData('text/plain'); D.execCommand('insertText', false, tx); });
    ed.addEventListener('drop', function (e) { e.preventDefault(); });
    status(m.minutesUpdated ? 'Laatst gewijzigd ' + new Date(m.minutesUpdated).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : '');
    ed.focus();
  }
