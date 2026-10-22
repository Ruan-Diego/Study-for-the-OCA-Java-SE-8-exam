// OCA book parser — runs in the browser (and in Node for testing).
// Input: array of pages, each = pdf.js textContent.items
// Output: { chapters: [{num, title, questions:[{n, text, code, options:[{l,t}], answer:[..], explanation}]}] }
(function (root) {

  function itemsToLines(items, monoFonts) {
    const rows = [];
    for (const it of items) {
      if (!it.str) continue;
      const x = it.transform[4], y = it.transform[5], size = Math.abs(it.transform[0]) || it.height || 9;
      let row = rows.find(r => Math.abs(r.y - y) < 2.2);
      if (!row) { row = { y, parts: [] }; rows.push(row); }
      row.parts.push({ s: it.str, x, w: it.width || 0, size, mono: monoFonts.has(it.fontName) });
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map(r => {
      r.parts.sort((a, b) => a.x - b.x);
      let text = '', end = null, monoChars = 0, total = 0, size = 0;
      for (const p of r.parts) {
        if (end !== null && p.x - end > 1.2 && !/\s$/.test(text) && !/^\s/.test(p.s)) text += ' ';
        text += p.s; end = p.x + p.w;
        const n = p.s.trim().length; total += n; if (p.mono) monoChars += n;
        size = Math.max(size, p.size);
      }
      const first = r.parts.find(p => p.s.trim());
      return { text: text.replace(/\s+$/, ''), x: first ? first.x : 0, y: r.y, mono: total > 0 && monoChars / total > 0.6, size };
    }).filter(l => l.text.trim());
  }

  // Monospace fonts: pdf.js reports fontFamily "monospace" in textContent.styles
  function monoSet(styles) {
    return new Set(Object.keys(styles || {}).filter(k => styles[k].fontFamily === 'monospace'));
  }

  const isNoise = l => /\.indd\b/.test(l.text) || /^\d+\s+(Chapter \d+|Appendix)\s/.test(l.text.trim()) ||
    /^(Review Questions|Chapter \d+: .*?)\s+\d+$/.test(l.text.trim()) || /^\s*\d+\s*$/.test(l.text);

  function toLines(pages) {
    return pages.map(p => itemsToLines(p.items.filter(it => Math.abs(it.transform[0]) > 5), monoSet(p.styles)).filter(l => !isNoise(l)));
  }

  function cleanText(lines) {
    // join prose lines; un-hyphenate "cor-\nrect"
    let out = '';
    for (const l of lines) {
      const t = l.trim();
      if (!out) out = t;
      else if (/[a-z]-$/.test(out) && /^[a-z]/.test(t)) out = out.slice(0, -1) + t;
      else out += ' ' + t;
    }
    return out.replace(/\b(f[fil]) (?=[a-z])/g, '$1');
  }

  // Build block list mixing prose and code for question bodies / options
  function blocks(lines, baseX) {
    const res = []; let cur = null;
    for (const l of lines) {
      const kind = l.mono ? 'code' : 'text';
      if (!cur || cur.kind !== kind) { cur = { kind, lines: [] }; res.push(cur); }
      cur.lines.push(l);
    }
    return res.map(b => {
      if (b.kind === 'text') return { kind: 'text', text: cleanText(b.lines.map(l => l.text)) };
      const minX = Math.min(...b.lines.map(l => l.x));
      const cw = 4.75; // approx char width of 7.9pt mono
      return { kind: 'code', text: b.lines.map(l => ' '.repeat(Math.max(0, Math.round((l.x - minX) / cw))) + l.text.trim()).join('\n') };
    });
  }

  function parseQuestions(lines) {
    const qs = []; let q = null, opt = null;
    const qre = /^(\d{1,2})\.\s+(.*)$/, ore = /^([A-H])\.\s*(.*)$/;
    lines.forEach((l, i) => {
      const t = l.text.trim();
      let m = qre.exec(t);
      if (m && !l.mono && +m[1] === (q ? q.n + 1 : 1) && (!q || Math.abs(l.x - q.x) < 9)) {
        q = { n: +m[1], x: l.x, body: [{ ...l, text: m[2] }], options: [] }; qs.push(q); opt = null; return;
      }
      if (!q) return;
      m = ore.exec(t);
      const expected = String.fromCharCode(65 + q.options.length);
      // tolerate a missing dot after "A" when the next line starts with "B."
      if (!m && expected === 'A' && /^A\s+\S/.test(t) && lines[i + 1] && /^B\.\s/.test(lines[i + 1].text.trim())) m = [t, 'A', t.slice(1).trim()];
      if (m && m[1] === expected) {
        opt = { l: m[1], lines: [{ ...l, text: m[2] }] }; q.options.push(opt); return;
      }
      if (opt) opt.lines.push(l); else q.body.push(l);
    });
    return qs.map(q => ({
      n: q.n,
      body: blocks(q.body),
      options: q.options.map(o => ({ l: o.l, body: blocks(o.lines) }))
    }));
  }

  function parseAnswers(lines) {
    // returns {chapterNum: {n: {answer:[], explanation}}}
    const res = {}; let ch = null, cur = null;
    for (const l of lines) {
      const t = l.text.trim();
      const hm = /^Chapter (\d+):\s+(.+)$/.exec(t);
      if (hm && l.size >= 10) { ch = { num: +hm[1], title: hm[2], items: {} }; res[ch.num] = ch; cur = null; continue; }
      if (!ch) continue;
      const m = /^(\d{1,2})\.\s+(.*)$/.exec(t);
      const next = cur ? cur.n + 1 : 1;
      if (m && +m[1] === next && (!cur || Math.abs(l.x - cur.x) < 9)) { cur = { n: next, x: l.x, lines: [m[2]] }; ch.items[next] = cur; continue; }
      if (cur) cur.lines.push(l.mono ? '`' + t + '`' : t);
    }
    for (const c of Object.values(res)) for (const it of Object.values(c.items)) {
      const txt = cleanText(it.lines);
      const m = /^((?:[A-H](?:\s*,\s*|\s+and\s+|\s*))+?)\.\s*([\s\S]*)$/.exec(txt);
      if (m) { it.answer = m[1].match(/[A-H]/g); it.explanation = m[2]; }
      else { it.answer = []; it.explanation = txt; }
      delete it.lines;
    }
    return res;
  }

  function parseBook(rawPages) {
    const pages = toLines(rawPages);
    const chapters = []; let collecting = null, ansLines = null, ansDone = null;
    pages.forEach((lines, pi) => {
      const joined = lines.map(l => l.text).join('\n');
      if (/OCA EXAM OBJECTIVES COVERED/.test(joined)) collecting = null;
      if (Array.isArray(ansLines) && lines.some(l => /Study Tips|^Appendix\b/.test(l.text) && l.size >= 14)) { ansDone = ansLines; ansLines = 'done'; }
      if (ansLines === 'done') return;
      if (Array.isArray(ansLines)) { ansLines.push(...lines); return; }
      // Appendix A start: a page whose big heading says Answers to Review Questions, followed by Chapter 1:
      if (pi > 50 && lines.some(l => /Answers to Review/i.test(l.text) && l.size >= 14)) {
        collecting = null; ansLines = 'pending';
      }
      if (ansLines === 'pending') {
        const i = lines.findIndex(l => /^Chapter 1: /.test(l.text.trim()) && l.size >= 10);
        if (i >= 0) ansLines = lines.slice(i);
        return;
      }
      const rq = lines.findIndex(l => l.text.trim() === 'Review Questions' && l.size >= 12);
      if (rq >= 0 && pi > 30) {
        collecting = { lines: [], page: pi + 1 }; chapters.push(collecting);
        collecting.lines.push(...lines.slice(rq + 1)); return;
      }
      if (collecting) collecting.lines.push(...lines);
    });
    const al = ansDone || (Array.isArray(ansLines) ? ansLines : null);
    const answers = al ? parseAnswers(al) : {};
    return {
      chapters: chapters.map((c, i) => {
        const a = answers[i + 1] || { title: 'Chapter ' + (i + 1), items: {} };
        return {
          num: i + 1, title: a.title, page: c.page,
          questions: parseQuestions(c.lines).map(q => ({ ...q, ...(a.items[q.n] || { answer: [], explanation: '' }) }))
        };
      })
    };
  }

  const api = { parseBook, itemsToLines };
  if (typeof module !== 'undefined') module.exports = api; else root.OCAParser = api;
})(this);
