(() => {
  clearInterval(window.srTimer);
  document.getElementById('srPanel')?.remove();
  document.getElementById('srBadge')?.remove();

  const REPO = 'hvurs/smart-revise-bot';
  const CSV_URL = `https://raw.githubusercontent.com/${REPO}/main/answers.csv`;
  const ISSUE_URL = `https://github.com/${REPO}/issues/new`;
  const DELAY = 3500;

  const KEY = 'sr_answers_v2', OLD = 'sr_answers', PENDING = 'sr_pending';
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const db = JSON.parse(localStorage.getItem(KEY) || '{}');
  let pending = JSON.parse(localStorage.getItem(PENDING) || '[]');
  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(db));
    localStorage.setItem(PENDING, JSON.stringify(pending));
  };
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

  const ingest = text => {
    let added = 0;
    for (const r of parseCSV(text)) {
      if (r.length < 2 || norm(r[0]) === 'question') continue;
      if (add(r[0], r[1])) added++;
    }
    save();
    return added;
  };

  const csvEsc = s => `"${(s || '').replace(/"/g, '""')}"`;

  // badge
  const COLORS = {
    green: '#2b8a3e',
    orange: '#e8590c',
    yellow: '#e6a700',
    red: '#c92a2a',
    gray: '#495057',
    blue: '#1971c2'
  };

  const getBadge = () => {
    const qEl = document.querySelector('#questiontext');
    if (!qEl || !qEl.parentNode) return null;
    let b = document.getElementById('srBadge');
    if (!b) {
      b = document.createElement('div');
      b.id = 'srBadge';
      b.style.cssText = 'display:inline-block;margin:0 0 6px;padding:2px 8px;border-radius:3px;color:#fff;font:600 12px system-ui,sans-serif';
    }
    if (b.nextSibling !== qEl) qEl.parentNode.insertBefore(b, qEl);
    return b;
  };

  const setBadge = (text, color) => {
    const b = getBadge();
    if (!b) return;
    if (b.textContent !== text) b.textContent = text;
    b.style.background = COLORS[color];
  };

  // panel
  const panel = document.createElement('div');
  panel.id = 'srPanel';
  panel.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:6px;align-items:stretch;font-family:system-ui,-apple-system,sans-serif';

  const baseStyle = 'padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.15s ease;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,0.15)';
  const mutedStyle = baseStyle + ';background:#212529;color:#ced4da;border:1px solid #343a40';

  const toggle = document.createElement('button');
  const paint = () => {
    toggle.textContent = running ? 'Running - click to stop' : 'Stopped - click to start';
    toggle.style.cssText = baseStyle + ';color:#fff;border:0;background:' + (running ? '#2b8a3e' : '#c92a2a');
  };
  toggle.onclick = () => { running = !running; paint(); console.log(running ? 'Started.' : 'Stopped.'); };
  paint();

  const muted = (text, onclick) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = mutedStyle;
    btn.onmouseenter = () => { btn.style.background = '#2c3036'; btn.style.color = '#fff'; };
    btn.onmouseleave = () => { btn.style.background = '#212529'; btn.style.color = '#ced4da'; };
    btn.onclick = onclick;
    return btn;
  };

  const syncLabel = () => `Sync from GitHub (${Object.keys(db).length} questions)`;
  const reportLabel = () => `Report ${pending.length} new answer${pending.length === 1 ? '' : 's'}`;

  const sync = async () => {
    syncBtn.textContent = 'Syncing...';
    try {
      const res = await fetch(CSV_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const added = ingest(await res.text());
      console.log(`Synced from GitHub: ${added} new answers.`);
    } catch (e) {
      console.warn('GitHub sync failed (the site may block it, use "Import file" instead):', e);
    }
    syncBtn.textContent = syncLabel();
  };
  const syncBtn = muted(syncLabel(), sync);

  const fileBtn = muted('Import file', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.csv,.txt'; inp.multiple = true;
    inp.onchange = async () => {
      let added = 0;
      for (const file of inp.files) added += ingest(await file.text());
      syncBtn.textContent = syncLabel();
      console.log(`Imported ${added} new answers.`);
    };
    inp.click();
  });

  const exportBtn = muted('Export CSV', () => {
    const rows = ['Question,Answer'];
    for (const [key, answers] of Object.entries(db)) {
      answers.forEach(ans => rows.push(`${csvEsc(key)},${csvEsc(ans)}`));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sr_answers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const reportBtn = muted(reportLabel(), () => {
    if (!pending.length) return console.log('Nothing new to report.');
    const head = 'Question,Answer\n';
    const makeUrl = lines => `${ISSUE_URL}?title=${encodeURIComponent(`New answers (${lines.length})`)}&body=${encodeURIComponent('```csv\n' + head + lines.join('\n') + '\n```')}`;

    const lines = [];
    for (const [q, a] of pending) {
      const line = `${csvEsc(q)},${csvEsc(a)}`;
      if (makeUrl([...lines, line]).length > 7000) break;
      lines.push(line);
    }
    if (!lines.length) return console.warn('First answer is too long for a URL.');

    window.open(makeUrl(lines), '_blank');
    if (confirm(`Issue opened with ${lines.length} answer(s). Did you submit it? (OK = remove them from the pending list)`)) {
      pending = pending.slice(lines.length);
      save();
      reportBtn.textContent = reportLabel();
    }
  });

  panel.append(toggle, syncBtn, fileBtn, exportBtn, reportBtn);
  document.body.appendChild(panel);
  sync();

  // watcher
  const opts = () => [...document.querySelectorAll('#answercontainer a.js_answerButton')]
    .filter(a => a.dataset.answerid !== '-1');
  const idkBtn = () => document.querySelector('#answercontainer a.js_answerButton[data-answerid="-1"]');
  const txt = el => el.querySelector('.js_answerTextContainer').innerText.trim();
  const nextBtn = () => document.querySelector('#lnkNext');
  const nextReady = () => { const n = nextBtn(); return n && !n.classList.contains('disabled'); };

  let seenQ = null, seenAt = 0, auto = false, handled = false, handledAt = 0;
  let result = null; // 'known' | 'guess' | 'learned' | 'manual'

  window.srTimer = setInterval(() => {
    document.querySelector('.swal2-confirm')?.click();
    const q = document.querySelector('#questiontext')?.innerText.trim();
    if (!q) return;

    if (!nextReady()) {
      if (handled) { handled = false; seenQ = null; }
      if (q !== seenQ) { seenQ = q; seenAt = Date.now(); auto = false; result = null; }

      const known = db[norm(q)];
      const matches = known ? opts().filter(o => known.some(a => norm(a) === norm(txt(o)))) : [];
      const state = !known ? 'unknown' : matches.length === 1 ? 'known' : matches.length > 1 ? 'ambiguous' : 'nomatch';

      if (!running) setBadge('Bot: Paused', 'gray');
      else if (state === 'known') setBadge('Bot: Known', 'green');
      else if (state === 'ambiguous') setBadge('Bot: Ambiguous', 'yellow');
      else if (state === 'unknown') setBadge(idkBtn() ? 'Bot: Learning' : 'Bot: Stuck', idkBtn() ? 'orange' : 'red');
      else setBadge('Bot: Stuck', 'red');

      if (running && !auto && Date.now() - seenAt > DELAY) {
        if (state === 'known') {
          console.log('Known:', q, '->', txt(matches[0]));
          auto = true; result = 'known';
          matches[0].click();
        } else if (state === 'ambiguous') {
          const pick = matches[Math.floor(Math.random() * matches.length)];
          console.log('Ambiguous, guessing:', q, '->', txt(pick));
          auto = true; result = 'guess';
          pick.click();
        } else if (state === 'unknown') {
          const idk = idkBtn();
          if (idk) {
            console.log("Unknown, clicking \"I don't know\":", q);
            auto = true; result = 'learned';
            idk.click();
          } else if (q !== window._srWarned) {
            window._srWarned = q;
            console.warn('No "I don\'t know" button found, leaving it to you:', q);
          }
        } else if (q !== window._srWarned) {
          window._srWarned = q;
          console.warn('Saved answer matches no option, leaving it to you:', q);
        }
      }
    } else {
      if (!handled) {
        handled = true; handledAt = Date.now();
        if (!auto) result = 'manual';
        const green = document.querySelector('#answercontainer a.btn-success');
        if (green) {
          const a = txt(green);
          if (add(q, a)) {
            pending.push([q, a]);
            save();
            syncBtn.textContent = syncLabel();
            reportBtn.textContent = reportLabel();
            console.log('Saved:', q, '->', a);
          }
        }
      }
      if (result === 'learned') setBadge('Bot: Learned', 'blue');
      else if (result === 'guess') setBadge('Bot: Guessed', 'yellow');
      else if (result === 'known') setBadge('Bot: Answered', 'green');
      else setBadge('Bot: Manual', 'gray');

      if (running && auto && Date.now() - handledAt > 1500) nextBtn().click();
    }
  }, 250);

  console.log('Running. Use the buttons at the bottom right.');
})();
