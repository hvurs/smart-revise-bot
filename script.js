(() => {
  clearInterval(window.srTimer);
  document.getElementById('srPanel')?.remove();
  document.getElementById('srImportBtn')?.remove();

  const KEY = 'sr_answers_v2', OLD = 'sr_answers';
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const db = JSON.parse(localStorage.getItem(KEY) || '{}');
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  let running = true;

  const add = (q, a) => {
    const k = norm(q);
    if (!k || !norm(a)) return false;
    const arr = (db[k] = db[k] || []);
    if (arr.some(x => norm(x) === norm(a))) return false;
    arr.push(a.trim());
    return true;
  };

  try {
    Object.entries(JSON.parse(localStorage.getItem(OLD) || '{}')).forEach(([q, a]) => add(q, a));
    save();
  } catch (e) {}

  const parseCSV = text => {
    const rows = []; let row = [], f = '', inQ = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
        else if (c === '"') inQ = false;
        else f += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); f = '';
        if (row.some(x => x.trim())) rows.push(row);
        row = [];
      } else f += c;
    }
    row.push(f);
    if (row.some(x => x.trim())) rows.push(row);
    return rows;
  };

  // Buttons Panel
  const panel = document.createElement('div');
  panel.id = 'srPanel';
  panel.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:6px;align-items:stretch;font-family:system-ui,-apple-system,sans-serif';

  const baseStyle = 'padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.15s ease;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,0.15)';
  const mutedStyle = baseStyle + ';background:#212529;color:#ced4da;border:1px solid #343a40';

  // Toggle button (vibrant on/off kept intact)
  const toggle = document.createElement('button');
  const paint = () => {
    toggle.textContent = running ? 'Running - click to stop' : 'Stopped - click to start';
    toggle.style.cssText = baseStyle + ';color:#fff;border:0;background:' + (running ? '#2b8a3e' : '#c92a2a');
  };
  toggle.onclick = () => { running = !running; paint(); console.log(running ? 'Started.' : 'Stopped.'); };
  paint();

  // Helper for hover states on muted buttons
  const applyMutedStyle = btn => {
    btn.style.cssText = mutedStyle;
    btn.onmouseenter = () => { btn.style.background = '#2c3036'; btn.style.color = '#fff'; };
    btn.onmouseleave = () => { btn.style.background = '#212529'; btn.style.color = '#ced4da'; };
  };

  // Import CSV button
  const importBtn = document.createElement('button');
  const label = () => `Import CSV (${Object.keys(db).length} questions)`;
  importBtn.textContent = label();
  applyMutedStyle(importBtn);

  importBtn.onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.csv,.txt'; inp.multiple = true;
    inp.onchange = async () => {
      let added = 0, rows = 0;
      for (const file of inp.files) {
        for (const r of parseCSV(await file.text())) {
          if (r.length < 2) continue;
          rows++;
          if (add(r[0], r[1])) added++;
        }
      }
      save();
      importBtn.textContent = label();
      console.log(`Imported ${added} new answers from ${rows} rows.`);
    };
    inp.click();
  };

  // Export CSV button
  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export CSV';
  applyMutedStyle(exportBtn);

  exportBtn.onclick = () => {
    const csvRows = ['Question,Answer'];
    const escapeCSV = str => `"${(str || '').replace(/"/g, '""')}"`;

    for (const [key, answers] of Object.entries(db)) {
      answers.forEach(ans => {
        csvRows.push(`${escapeCSV(key)},${escapeCSV(ans)}`);
      });
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sr_answers_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('Exported database to CSV.');
  };

  panel.append(toggle, importBtn, exportBtn);
  document.body.appendChild(panel);

  // Watcher
  const opts = () => [...document.querySelectorAll('#answercontainer a.js_answerButton')]
    .filter(a => a.dataset.answerid !== '-1');
  const txt = el => el.querySelector('.js_answerTextContainer').innerText.trim();
  const nextBtn = () => document.querySelector('#lnkNext');
  const nextReady = () => { const n = nextBtn(); return n && !n.classList.contains('disabled'); };

  let seenQ = null, seenAt = 0, auto = false, handled = false, handledAt = 0;

  window.srTimer = setInterval(() => {
    document.querySelector('.swal2-confirm')?.click();
    const q = document.querySelector('#questiontext')?.innerText.trim();
    if (!q) return;

    if (!nextReady()) {
      if (handled) { handled = false; seenQ = null; }
      if (q !== seenQ) { seenQ = q; seenAt = Date.now(); auto = false; }

      const known = db[norm(q)];
      if (running && known && !auto && Date.now() - seenAt > 3500) {
        const matches = opts().filter(o => known.some(a => norm(a) === norm(txt(o))));
        if (matches.length === 1) {
          console.log('Known:', q, '->', txt(matches[0]));
          auto = true;
          matches[0].click();
        } else if (matches.length > 1 && q !== window._srWarned) {
          window._srWarned = q;
          console.warn('Ambiguous, leaving it to you:', q);
        }
      }
    } else {
      if (!handled) {
        handled = true; handledAt = Date.now();
        const green = document.querySelector('#answercontainer a.btn-success');
        if (green && add(q, txt(green))) { save(); importBtn.textContent = label(); console.log('Saved:', q, '->', txt(green)); }
      }
      if (running && auto && Date.now() - handledAt > 1500) nextBtn().click();
    }
  }, 500);

  console.log('Running. Use the buttons at the bottom right.');
})();
