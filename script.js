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

  // Buttons
  const panel = document.createElement('div');
  panel.id = 'srPanel';
  panel.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:stretch';
  const style = 'padding:10px 14px;color:#fff;border:0;border-radius:6px;cursor:pointer;font-size:14px';

  // Import CSV button - this is important! Go to the answers.csv file in the repository
  // You need the CSV if you want to have the answers
  // The CSV doesn't have all the answers loaded at the minute (as of 01.10.2026)
  const toggle = document.createElement('button');
  const importBtn = document.createElement('button');
  importBtn.style.cssText = style + ';background:#5d78ff';
  const label = () => `Import CSV (${Object.keys(db).length} questions)`;
  importBtn.textContent = label();

  // Toggle button (on or off)
  const paint = () => {
    toggle.textContent = running ? 'Running - click to stop' : 'Stopped - click to start';
    toggle.style.cssText = style + ';background:' + (running ? '#34bfa3' : '#fd3995');
  };
  toggle.onclick = () => { running = !running; paint(); console.log(running ? 'Started.' : 'Stopped.'); };
  paint();

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

  panel.append(toggle, importBtn);
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

      // Built in cooldown, smart-revise flags you for going too fast. This "bypasses" that
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
