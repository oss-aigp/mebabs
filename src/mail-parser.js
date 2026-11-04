  /* MeBabs - mail-parser: leest Outlook .msg (CFB/OLE) en .eml (MIME) en haalt titel, datum, tijd, locatie, vergaderlink en bijlagen eruit. */
  /* ------------------------------------------------------------------ helpers */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(d) { return pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear(); }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rd(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function bin2u8(s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; }
  function u82bin(a) { var s = '', C = 32768; for (var i = 0; i < a.length; i += C) s += String.fromCharCode.apply(null, a.subarray(i, i + C)); return s; }
  function decodeText(bytes, cs) {
    cs = (cs || 'utf-8').toLowerCase().trim();
    try { return new TextDecoder(cs).decode(bytes); } catch (e) { return new TextDecoder('windows-1252').decode(bytes); }
  }
  function fix8bit(s) {
    if (!/[\x80-\xff]/.test(s)) return s;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bin2u8(s)); } catch (e) { return decodeText(bin2u8(s), 'windows-1252'); }
  }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB'; }
  var MIME = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', csv: 'text/csv', jpg: 'image/jpeg',
    jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', zip: 'application/zip', msg: 'application/vnd.ms-outlook', eml: 'message/rfc822', odt: 'application/vnd.oasis.opendocument.text' };
  function guessMime(n) { var e = (n.split('.').pop() || '').toLowerCase(); return MIME[e] || 'application/octet-stream'; }

  function htmlToText(h) {
    try {
      var doc = new DOMParser().parseFromString(String(h).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d|table)>/gi, '$&\n'), 'text/html');
      Array.prototype.forEach.call(doc.querySelectorAll('style,script,head,title'), function (n) { n.remove(); });
      return (doc.body ? doc.body.textContent : '').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) { return String(h).replace(/<[^>]+>/g, ' '); }
  }


  /* HTML zetten zonder innerHTML (werkt ook bij strenge CSP / Trusted Types) */
  var VOID = { input: 1, br: 1, img: 1, hr: 1 };
  function ent(t) { return t.replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'); }
  function setHTML(el, html) {
    while (el.firstChild) el.removeChild(el.firstChild);
    var re = /<(\/?)([a-zA-Z0-9]+)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)|</g, m, stack = [el], doc = el.ownerDocument || D;
    while ((m = re.exec(html))) {
      var cur = stack[stack.length - 1];
      if (m[4] != null || m[0] === '<') { cur.appendChild(doc.createTextNode(ent(m[4] != null ? m[4] : '<'))); continue; }
      var tag = m[2].toLowerCase();
      if (m[1]) { for (var i = stack.length - 1; i > 0; i--) if (stack[i].tagName.toLowerCase() === tag) { stack.length = i; break; } continue; }
      var n = doc.createElement(tag), ar = /([a-zA-Z-]+)(?:="([^"]*)")?/g, a;
      while ((a = ar.exec(m[3]))) n.setAttribute(a[1], a[2] != null ? ent(a[2]) : '');
      if (tag === 'textarea') { var close = html.indexOf('</textarea>', re.lastIndex); n.value = ent(html.slice(re.lastIndex, close < 0 ? undefined : close)); n.textContent = n.value; re.lastIndex = close < 0 ? html.length : close + 11; cur.appendChild(n); continue; }
      cur.appendChild(n); if (!VOID[tag]) stack.push(n);
    }
  }

  /* ------------------------------------------------------------------ .eml (MIME) */
  function parseHeaders(raw) {
    var h = {};
    raw.replace(/\r\n/g, '\n').replace(/\n[ \t]+/g, ' ').split('\n').forEach(function (l) {
      var i = l.indexOf(':'); if (i > 0) { var k = l.slice(0, i).trim().toLowerCase(); if (!(k in h)) h[k] = fix8bit(l.slice(i + 1).trim()); }
    });
    return h;
  }
  function decodeWords(s) {
    if (!s) return '';
    s = s.replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)\s+(?==\?)/g, '$1');
    return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, function (m, cs, enc, txt) {
      var bytes;
      if (enc.toUpperCase() === 'B') { try { bytes = bin2u8(atob(txt)); } catch (e) { return m; } }
      else bytes = bin2u8(txt.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, function (x, hx) { return String.fromCharCode(parseInt(hx, 16)); }));
      return decodeText(bytes, cs.split('*')[0]);
    });
  }
  function hparam(v, name) {
    if (!v) return '';
    var vv = ';' + v, m, parts = [];
    var re = new RegExp(';\\s*' + name + '\\*(?:(\\d+)\\*?)?=\\s*(?:"([^"]*)"|([^;\\s]*))', 'gi');
    while ((m = re.exec(vv))) parts[m[1] ? +m[1] : 0] = m[2] != null ? m[2] : m[3];
    if (parts.length) {
      var s = parts.join(''), cs = 'utf-8', mm = /^([^']*)'[^']*'(.*)$/.exec(s);
      if (mm) { cs = mm[1] || cs; s = mm[2]; }
      return decodeText(bin2u8(s.replace(/%([0-9A-Fa-f]{2})/g, function (x, hx) { return String.fromCharCode(parseInt(hx, 16)); })), cs);
    }
    m = new RegExp(';\\s*' + name + '\\s*=\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|([^;]*))', 'i').exec(vv);
    return m ? decodeWords((m[1] != null ? m[1] : m[2]).trim()) : '';
  }
  function b64(s) { try { return bin2u8(atob(s.replace(/[^A-Za-z0-9+/]/g, '').replace(/^(.*?)(.{0,3})$/, function (a, x, y) { return x + y + '==='.slice((x + y).length % 4 || 4); }))); } catch (e) { return new Uint8Array(0); } }
  function qp(s) { return bin2u8(s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, function (x, hx) { return String.fromCharCode(parseInt(hx, 16)); })); }

  function parsePart(bin, out, depth) {
    var sm = /\r?\n\r?\n/.exec(bin);
    var hraw = sm ? bin.slice(0, sm.index) : bin, body = sm ? bin.slice(sm.index + sm[0].length) : '';
    var h = parseHeaders(hraw);
    var ct = h['content-type'] || 'text/plain', type = ct.split(';')[0].trim().toLowerCase();
    var cte = (h['content-transfer-encoding'] || '').toLowerCase().trim(), disp = h['content-disposition'] || '';
    if (type.indexOf('multipart/') === 0 && depth < 20) {
      var bnd = hparam(ct, 'boundary'); if (!bnd) return h;
      var chunks = body.split('--' + bnd); chunks.shift();
      for (var i = 0; i < chunks.length; i++) {
        var c = chunks[i]; if (c.slice(0, 2) === '--') break;
        parsePart(c.replace(/^[ \t]*\r?\n/, '').replace(/\r?\n$/, ''), out, depth + 1);
      }
      return h;
    }
    var bytes = cte === 'base64' ? b64(body) : cte === 'quoted-printable' ? qp(body) : bin2u8(body);
    var fname = hparam(disp, 'filename') || hparam(ct, 'name');
    var cs = hparam(ct, 'charset') || 'utf-8';
    if (type === 'text/calendar') { out.ics = out.ics || decodeText(bytes, cs); if (!/^attachment/i.test(disp)) return h; }
    if (type === 'message/rfc822') {
      out.attachments.push({ name: (fname || decodeWords(parseHeaders(u82bin(bytes).split(/\r?\n\r?\n/)[0]).subject) || 'bijgevoegde-mail').replace(/[\\/:*?"<>|]/g, '_').replace(/(\.eml)?$/i, '.eml'), type: 'message/rfc822', data: bytes, inline: false });
      return h;
    }
    if (fname || /^attachment/i.test(disp)) {
      if (type === 'text/calendar' && /\.ics$/i.test(fname || '')) return h;
      out.attachments.push({ name: fname || ('bijlage.' + (type.split('/')[1] || 'bin')), type: type || guessMime(fname), data: bytes,
        inline: /^inline/i.test(disp) || (!!h['content-id'] && /^image\//.test(type)) });
      return h;
    }
    if (type === 'text/plain' && out.text == null) out.text = decodeText(bytes, cs);
    else if (type === 'text/html' && out.html == null) out.html = decodeText(bytes, cs);
    return h;
  }
  function parseIcs(t) {
    if (!t) return null;
    t = t.replace(/\r?\n[ \t]/g, '');
    var ev = t.split(/BEGIN:VEVENT/i)[1]; if (!ev) return null;
    ev = ev.split(/END:VEVENT/i)[0];
    function g(k) { var m = new RegExp('^' + k + '((?:;[^:\\r\\n]*)?):(.*)$', 'im').exec(ev); return m ? m[2].trim() : ''; }
    function un(s) { return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'); }
    function dt(v) {
      var m = /(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(v); if (!m) return null;
      if (m[7]) return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
      return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    }
    var s = g('DTSTART'), e = g('DTEND');
    return { title: un(g('SUMMARY')), location: un(g('LOCATION')), start: dt(s), end: dt(e), allDay: !/T\d/.test(s) };
  }
  function parseEml(buf) {
    var bin = u82bin(new Uint8Array(buf)), out = { attachments: [] };
    var h = parsePart(bin, out, 0);
    var ics = parseIcs(out.ics);
    return {
      subject: decodeWords(h.subject || ''), from: decodeWords(h.from || '').replace(/\s*<[^>]*>\s*$/, '').replace(/^"|"$/g, ''),
      sent: h.date ? new Date(h.date) : null, text: out.text != null ? out.text : (out.html ? htmlToText(out.html) : ''),
      start: ics && ics.start, end: ics && ics.end, allDay: ics && ics.allDay, location: (ics && ics.location) || '', icsTitle: ics && ics.title,
      attachments: out.attachments, skipped: [], html: out.html || ''
    };
  }

  /* ------------------------------------------------------------------ .msg (CFB / OLE) */
  function parseCfb(buf) {
    var a = new Uint8Array(buf);
    if (rd(a, 0) !== 0xE011CFD0) throw new Error('Dit is geen geldig Outlook .msg-bestand.');
    var ss = 1 << (a[30] | a[31] << 8), mss = 1 << (a[32] | a[33] << 8);
    var nFat = rd(a, 44), dirStart = rd(a, 48), cutoff = rd(a, 56), mfStart = rd(a, 60), nMf = rd(a, 64), dif = rd(a, 68);
    var E = 0xFFFFFFFA, per = ss / 4, i, j;
    function off(s) { return (s + 1) * ss; }
    var fatSecs = [];
    for (i = 0; i < 109 && fatSecs.length < nFat; i++) { var v = rd(a, 76 + i * 4); if (v >= E) break; fatSecs.push(v); }
    for (var guard = 0; fatSecs.length < nFat && dif < E && guard < 1e5; guard++) {
      for (i = 0; i < per - 1 && fatSecs.length < nFat; i++) fatSecs.push(rd(a, off(dif) + i * 4));
      dif = rd(a, off(dif) + (per - 1) * 4);
    }
    var fat = new Uint32Array(fatSecs.length * per);
    fatSecs.forEach(function (s, k) { for (j = 0; j < per; j++) fat[k * per + j] = rd(a, off(s) + j * 4); });
    function chain(s, f) { var o = [], g = 0; while (s < E && s < f.length && g++ < 1e7) { o.push(s); s = f[s]; } return o; }
    function readBig(s, size) {
      var c = chain(s, fat), r = new Uint8Array(c.length * ss);
      c.forEach(function (x, k) { r.set(a.subarray(off(x), off(x) + ss), k * ss); });
      return size != null ? r.subarray(0, size) : r;
    }
    var dd = readBig(dirStart), entries = [];
    for (var p = 0; p + 128 <= dd.length; p += 128) {
      var nl = dd[p + 64] | dd[p + 65] << 8, name = '';
      for (var q = 0; q < nl - 2; q += 2) name += String.fromCharCode(dd[p + q] | dd[p + q + 1] << 8);
      entries.push({ name: name, type: dd[p + 66], l: rd(dd, p + 68), r: rd(dd, p + 72), c: rd(dd, p + 76), start: rd(dd, p + 116), size: rd(dd, p + 120) });
    }
    var root = entries[0], mini = readBig(root.start, root.size), mfat = new Uint32Array(0);
    if (nMf) { var mr = readBig(mfStart); mfat = new Uint32Array(mr.length / 4); for (i = 0; i < mfat.length; i++) mfat[i] = rd(mr, i * 4); }
    function read(e) {
      if (e.size < cutoff) {
        var c = chain(e.start, mfat), r = new Uint8Array(c.length * mss);
        c.forEach(function (x, k) { r.set(mini.subarray(x * mss, x * mss + mss), k * mss); });
        return r.subarray(0, e.size);
      }
      return readBig(e.start, e.size);
    }
    function kids(e) {
      var o = {}, seen = {};
      (function walk(i) {
        if (i >= entries.length || seen[i]) return; seen[i] = 1;
        var x = entries[i]; walk(x.l); o[x.name] = x; walk(x.r);
      })(e.c);
      return o;
    }
    return { root: root, kids: kids, read: read };
  }
  var APPT = '0220060000000000c000000000000046'; // PSETID_Appointment
  function parseMsg(buf) {
    var c = parseCfb(buf), top = c.kids(c.root), named = {};
    var ns = top['__nameid_version1.0'];
    if (ns) {
      var k = c.kids(ns), ge = k['__substg1.0_00020102'], ee = k['__substg1.0_00030102'];
      if (ee) {
        var gb = ge ? c.read(ge) : new Uint8Array(0), eb = c.read(ee);
        for (var p = 0; p + 8 <= eb.length; p += 8) {
          var ik = eb[p + 4] | eb[p + 5] << 8; if (ik & 1) continue;
          var gi = ik >> 1, gs = '';
          if (gi >= 3) for (var j = 0; j < 16; j++) gs += ('0' + (gb[(gi - 3) * 16 + j] || 0).toString(16)).slice(-2);
          named[gs + ':' + rd(eb, p)] = 0x8000 + (eb[p + 6] | eb[p + 7] << 8);
        }
      }
    }
    function hex4(id) { return ('000' + id.toString(16).toUpperCase()).slice(-4); }
    function str(st, id) {
      if (id == null) return '';
      var e = st['__substg1.0_' + hex4(id) + '001F'];
      if (e) return new TextDecoder('utf-16le').decode(c.read(e)).replace(/\0+$/, '');
      e = st['__substg1.0_' + hex4(id) + '001E'];
      return e ? decodeText(c.read(e), 'windows-1252').replace(/\0+$/, '') : '';
    }
    function bin(st, id) { var e = st['__substg1.0_' + hex4(id) + '0102']; return e ? c.read(e) : null; }
    function fixed(st, hdr) {
      var e = st['__properties_version1.0'], o = {}; if (!e) return o;
      var b = c.read(e);
      for (var p = hdr; p + 16 <= b.length; p += 16) o[rd(b, p)] = { lo: rd(b, p + 8), hi: rd(b, p + 12) };
      return o;
    }
    function ft(v) { return v && (v.lo || v.hi) ? new Date((v.hi * 4294967296 + v.lo) / 1e4 - 11644473600000) : null; }
    function tag(id, t) { return id == null ? -1 : ((id << 16) | t) >>> 0; }
    var props = fixed(top, 32);
    var html = str(top, 0x1013); if (!html) { var hb = bin(top, 0x1013); if (hb) html = decodeText(hb, 'utf-8'); }
    var body = str(top, 0x1000) || (html ? htmlToText(html) : '');
    var start = ft(props[tag(named[APPT + ':' + 0x820D], 0x40)]) || ft(props[0x00600040]);
    var end = ft(props[tag(named[APPT + ':' + 0x820E], 0x40)]) || ft(props[0x00610040]);
    var allDay = props[tag(named[APPT + ':' + 0x8215], 0x0B)]; allDay = !!(allDay && allDay.lo & 1);
    var atts = [], skipped = [];
    Object.keys(top).filter(function (n) { return /^__attach_version1\.0_#/i.test(n); }).sort().forEach(function (n) {
      var st = c.kids(top[n]), fp = fixed(st, 8);
      var name = str(st, 0x3707) || str(st, 0x3704) || str(st, 0x3001) || 'bijlage';
      var data = bin(st, 0x3701);
      if (!data) { if (st['__substg1.0_3701000D']) skipped.push(name); return; }
      var mime = str(st, 0x370E) || guessMime(name), hid = fp[0x7FFE000B], fl = fp[0x37140003];
      atts.push({ name: name, type: mime, data: data,
        inline: !!(hid && hid.lo & 1) || !!(fl && fl.lo & 4) || (!!str(st, 0x3712) && /^image\//.test(mime) && /^image\d+\./i.test(name)) });
    });
    return {
      subject: str(top, 0x37), from: str(top, 0x0C1A) || str(top, 0x42), sent: ft(props[0x00390040]),
      text: body, start: start, end: end, allDay: allDay, location: str(top, named[APPT + ':' + 0x8208]),
      attachments: atts, skipped: skipped, html: html || ''
    };
  }

  /* ------------------------------------------------------------------ datum/tijd/locatie uit tekst */
  var MON = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mrt: 3, maa: 3, maart: 3, mar: 3, march: 3, apr: 4, april: 4,
    mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, augustus: 8, august: 8, sep: 9, sept: 9, september: 9,
    okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
  var MRE = '(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|january|february|march|may|june|july|august|october|sept|jan|feb|mrt|maa|mar|apr|jun|jul|aug|sep|okt|oct|nov|dec)\\.?';
  function mkDate(y, m, d) {
    m = +m; d = +d; if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var now = new Date();
    if (!y) { y = now.getFullYear(); if (new Date(y, m - 1, d) < new Date(now.getTime() - 60 * 864e5)) y++; }
    y = +y; if (y < 100) y += 2000;
    return new Date(y, m - 1, d);
  }
  function findDate(s) {
    var best = null, m, res = [
      [new RegExp('\\b(\\d{1,2})\\s+' + MRE + '(?:\\s+(\\d{4}))?\\b', 'i'), function (m) { return mkDate(m[3], MON[m[2].toLowerCase()], m[1]); }],
      [new RegExp('\\b' + MRE + '\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b', 'i'), function (m) { return mkDate(m[3], MON[m[1].toLowerCase()], m[2]); }],
      [/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, function (m) { return mkDate(m[1], m[2], m[3]); }],
      [/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})\b/, function (m) { return mkDate(m[3], m[2], m[1]); }]
    ];
    res.forEach(function (r) { m = r[0].exec(s); if (m) { var d = r[1](m); if (d && (!best || m.index < best.i)) best = { d: d, i: m.index, len: m[0].length }; } });
    return best;
  }
  function findTime(s) {
    var m;
    if ((m = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:uur|u\.?|h)?\s*(?:-|–|—|tot|t\/m|to|until)\s*([01]?\d|2[0-3])[:.]([0-5]\d)/i.exec(s)))
      return { start: pad(+m[1]) + ':' + m[2], end: pad(+m[3]) + ':' + m[4] };
    if ((m = /\b([01]?\d|2[0-3])\s*(?:-|–|tot)\s*([01]?\d|2[0-3])\s*uur\b/i.exec(s))) return { start: pad(+m[1]) + ':00', end: pad(+m[2]) + ':00' };
    if ((m = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:uur|u\b)/i.exec(s)) || (m = /\b(?:om|vanaf|at|aanvang|start)\s+([01]?\d|2[0-3])[:.]([0-5]\d)\b/i.exec(s)) ||
        (m = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(s)))
      return { start: pad(+m[1]) + ':' + m[2], end: '' };
    return null;
  }
  function addHour(t) { var p = t.split(':'); return pad((+p[0] + 1) % 24) + ':' + p[1]; }
  function cleanSubject(s) {
    var re = /^\s*(re|fw|fwd|tr|doorst|antw|wg|aw|uitnodiging|invitation|bijgewerkte uitnodiging|updated invitation|geaccepteerd|accepted|voorlopig|tentative)\s*:\s*/i;
    s = (s || '').trim(); while (re.test(s)) s = s.replace(re, '');
    return s.replace(/\s+/g, ' ').trim();
  }
  function findLink(text, html) {
    var src = String(html || '') + ' ' + String(text || '');
    src = src.replace(/&amp;/g, '&').replace(/https:\/\/[\w.-]*safelinks\.protection\.outlook\.com\/?\?url=([^&"'\s<>]+)[^\s"'<>]*/gi, function (m0, u) { try { return decodeURIComponent(u); } catch (e) { return m0; } });
    var res = [/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+/i, /https:\/\/teams\.microsoft\.com\/meet\/[^\s"'<>]+/i, /https:\/\/teams\.live\.com\/meet\/[^\s"'<>]+/i, /https:\/\/[\w.-]*zoom\.us\/(?:j|my|w|wc)\/[^\s"'<>]+/i, /https:\/\/[\w.-]*webex\.com\/(?:meet|join|[\w.-]*\/j\.php)[^\s"'<>]*/i, /https:\/\/meet\.google\.com\/[^\s"'<>]+/i, /https:\/\/[\w.-]*whereby\.com\/[^\s"'<>]+/i, /https:\/\/[\w.-]*(?:jitsi|pexip|videovergader|vergaderen)[\w.-]*\/[^\s"'<>]+/i];
    for (var i = 0; i < res.length; i++) { var m1 = res[i].exec(src); if (m1) return m1[0].replace(/[)\].,;]+$/, ''); }
    return '';
  }
  function analyse(m) {
    var lines = (m.text || '').split(/\r?\n/).map(function (l) { return l.trim(); }), noise = {}, i, j;
    for (i = 0; i < lines.length; i++) {
      if (/^(verzonden|sent|gesendet|envoyé)\s*:/i.test(lines[i])) noise[i] = 1;
      if (/^(van|from)\s*:/i.test(lines[i])) for (j = i; j < Math.min(lines.length, i + 6); j++) if (/^(datum|date|verzonden|sent)\s*:/i.test(lines[j])) noise[j] = 1;
    }
    var clean = lines.filter(function (l, k) { return l && !noise[k]; });
    var pri = clean.filter(function (l) { return /^(wanneer|when|datum|date|tijd|tijdstip|tijdstip en datum|op)\b/i.test(l); });
    var r = { title: cleanSubject(m.icsTitle || m.subject), location: m.location || '', date: '', start: '', end: '', src: 'tekst' };
    if (m.start) {
      r.date = fmtDate(m.start); r.src = 'agenda-uitnodiging';
      if (!m.allDay) { r.start = fmtTime(m.start); if (m.end) r.end = fmtTime(m.end); }
    } else {
      var pools = pri.concat([r.title, m.subject]).concat(clean), found = null, line = '';
      for (i = 0; i < pools.length && !found; i++) { found = findDate(pools[i] || ''); if (found) line = pools[i]; }
      if (found) {
        r.date = fmtDate(found.d);
        var rest = line.slice(0, found.i) + ' ' + line.slice(found.i + found.len);
        var tpool = [rest].concat(pri, clean.filter(function (l) { return findDate(l); }), [m.subject], clean), t = null;
        for (i = 0; i < tpool.length && !t; i++) t = findTime((tpool[i] || '').replace(/\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b/g, ' '));
        if (t) { r.start = t.start; r.end = t.end; }
      } else r.src = '';
    }
    if (r.start && !r.end) r.end = addHour(r.start);
    if (!r.location) {
      for (i = 0; i < clean.length; i++) { var lm = /^(locatie|location|waar|where|plaats|ruimte|zaal)\s*:\s*(.+)$/i.exec(clean[i]); if (lm) { r.location = lm[2].trim(); break; } }
    }
    if (!r.location && /teams\.microsoft\.com|Microsoft Teams/i.test(m.text || '')) r.location = 'Microsoft Teams';
    var notes = m.text || '';
    if (notes.indexOf('*~*~*~*') >= 0) notes = notes.split(/\*~\*~\*~\*[~*]*/).slice(1).join('\n');
    notes = notes.split(/\n\s*_{10,}/)[0].split(/\r?\n/).filter(function (l) { return !/^\s*(van|from|verzonden|sent|aan|to|cc|onderwerp|subject|datum|date|bijlagen|attachments)\s*:/i.test(l); }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (notes.length > 4000) notes = notes.slice(0, 4000) + '…';
    r.notes = notes;
    r.link = findLink(m.text, m.html);
    return r;
  }

