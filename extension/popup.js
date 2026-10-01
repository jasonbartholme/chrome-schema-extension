/* Popup: reads the stored report for the active tab, re-validates items with
 * the selected mode (strict/loose), renders results + suggestions. */
(() => {
  'use strict';
  const V = self.SchemaValidator;
  const $ = (id) => document.getElementById(id);

  let currentReport = null;
  let strict = false;

  // ---- mode toggle (persisted globally) ----
  chrome.storage.local.get(['mode'], (d) => {
    strict = d.mode === 'strict';
    $('strict-toggle').checked = strict;
    $('mode-label').textContent = strict ? 'Strict' : 'Loose';
  });
  $('strict-toggle').addEventListener('change', (e) => {
    strict = e.target.checked;
    $('mode-label').textContent = strict ? 'Strict' : 'Loose';
    chrome.storage.local.set({ mode: strict ? 'strict' : 'loose' });
    if (currentReport) render(currentReport);
  });

  // ---- load report for active tab ----
  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return showEmpty('Cannot access this page.');
    if (/^(chrome|edge|about|devtools):/.test(tab.url)) return showEmpty('Schema markup is not available on browser pages.');

    const key = 'report:' + tab.url.replace(/#.*$/, '');
    const data = await chrome.storage.local.get([key]);
    const report = data[key];
    if (!report) {
      // Fallback: try to run extraction via scripting API (e.g. content script
      // hadn't finished yet). Inject validator+content code fresh.
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['validator.js', 'content.js'] });
        const again = await chrome.storage.local.get([key]);
        currentReport = again[key];
      } catch (err) {
        return showEmpty('No structured data found (or no permission on this page).');
      }
    } else {
      currentReport = report;
    }
    if (!currentReport) return showEmpty('No structured data found on this page.');
    render(currentReport);
  }

  function showEmpty(msg) {
    $('results').innerHTML = '';
    const div = document.createElement('div');
    div.className = 'empty';
    div.textContent = msg;
    $('results').appendChild(div);
    $('summary').textContent = '';
    $('suggestions-section').hidden = true;
  }

  // ---- rendering ----
  function revalidate(item) {
    // item.raw holds original JSON-LD text or normalized node JSON from microdata/rdfa
    if (item.kind === 'JSON-LD') {
      let parsed;
      try { parsed = JSON.parse(item.raw); } catch (e) {
        return { issues: [{ level: 'error', message: `Invalid JSON: ${e.message}`, path: '' }], types: [] };
      }
      return V.validateJsonLdItem(parsed, strict, item.kind);
    }
    let node;
    try { node = JSON.parse(item.raw); } catch (e) { return { issues: [], types: item.types }; }
    return V.validateJsonLdItem(node, strict, item.kind);
  }

  function render(report) {
    const groups = { 'JSON-LD': [], Microdata: [], RDFa: [] };
    let errors = 0, warnings = 0;

    report.results.forEach((item) => {
      const r = revalidate(item);
      item._issues = r.issues;
      groups[item.kind].push(item);
      errors += r.issues.filter((i) => i.level === 'error').length;
      warnings += r.issues.filter((i) => i.level === 'warning').length;
    });

    const sum = $('summary');
    sum.innerHTML = '';
    addPill(sum, `${report.results.length} item${report.results.length === 1 ? '' : 's'}`, '');
    if (errors) addPill(sum, `${errors} error${errors === 1 ? '' : 's'}`, 'err');
    if (warnings) addPill(sum, `${warnings} warning${warnings === 1 ? '' : 's'}`, 'warn');
    if (!errors && !warnings && report.results.length) addPill(sum, 'looks good ✓', 'ok');

    const out = $('results');
    out.innerHTML = '';
    if (!report.results.length) {
      showEmpty('No schema.org markup detected on this page.');
    }

    for (const kind of Object.keys(groups)) {
      if (!groups[kind].length) continue;
      const g = document.createElement('div');
      g.className = 'group';
      const h = document.createElement('h2');
      h.textContent = `${kind} (${groups[kind].length})`;
      g.appendChild(h);
      groups[kind].forEach((item) => g.appendChild(renderItem(item)));
      out.appendChild(g);
    }

    renderSuggestions(report);
  }

  function addPill(parent, text, cls) {
    const s = document.createElement('span');
    s.className = 'pill' + (cls ? ' ' + cls : '');
    s.textContent = text;
    parent.appendChild(s);
  }

  function renderItem(item) {
    const wrap = document.createElement('div');
    wrap.className = 'item';
    const head = document.createElement('div');
    head.className = 'item-head';

    const errs = item._issues.filter((i) => i.level === 'error').length;
    const warns = item._issues.filter((i) => i.level === 'warning').length;
    const badge = document.createElement('span');
    badge.className = 'badge ' + (errs ? 'e' : warns ? 'w' : 'ok');
    badge.textContent = errs ? String(errs) : warns ? String(warns) : '✓';

    const label = document.createElement('span');
    label.className = 'item-label';
    label.title = item.label;
    label.textContent = item.label;

    const jsonBtn = document.createElement('button');
    jsonBtn.className = 'json-btn';
    jsonBtn.textContent = '{ }';
    jsonBtn.title = 'View raw JSON';
    jsonBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDialog(item.label, prettyJson(item.raw));
    });

    head.append(badge, label, jsonBtn);
    head.addEventListener('click', () => wrap.classList.toggle('open'));
    wrap.appendChild(head);

    const list = document.createElement('div');
    list.className = 'issue-list';
    if (!item._issues.length) {
      const p = document.createElement('div');
      p.className = 'issue info';
      p.textContent = 'No issues found.';
      list.appendChild(p);
    }
    item._issues.forEach((iss) => {
      const p = document.createElement('div');
      p.className = 'issue ' + iss.level;
      p.textContent = iss.message;
      if (iss.path) {
        const s = document.createElement('span');
        s.className = 'path';
        s.textContent = ' — ' + iss.path;
        p.appendChild(s);
      }
      list.appendChild(p);
    });
    wrap.appendChild(list);
    if (errs) wrap.classList.add('open');
    return wrap;
  }

  function prettyJson(raw) {
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch (e) { return raw; }
  }

  // ---- suggestions ----
  function renderSuggestions(report) {
    const sec = $('suggestions-section');
    const box = $('suggestions');
    box.innerHTML = '';
    if (!report.suggestions || !report.suggestions.length) { sec.hidden = true; return; }
    sec.hidden = false;
    report.suggestions.forEach((s) => {
      const d = document.createElement('div');
      d.className = 'sugg';
      const b = document.createElement('b'); b.textContent = s.type;
      const p = document.createElement('p'); p.textContent = s.reason;
      const pre = document.createElement('pre'); pre.textContent = s.snippet;
      const actions = document.createElement('div'); actions.className = 'sugg-actions';
      const toggle = document.createElement('button'); toggle.textContent = 'Show snippet';
      toggle.addEventListener('click', () => {
        d.classList.toggle('open');
        toggle.textContent = d.classList.contains('open') ? 'Hide snippet' : 'Show snippet';
      });
      const copy = document.createElement('button'); copy.textContent = 'Copy';
      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(s.snippet);
        copy.textContent = 'Copied!';
        setTimeout(() => (copy.textContent = 'Copy'), 1200);
      });
      actions.append(toggle, copy);
      d.append(b, p, actions, pre);
      box.appendChild(d);
    });
  }

  // ---- dialog ----
  const dlg = $('json-dialog');
  function openDialog(title, body) {
    $('dialog-title').textContent = title;
    $('dialog-body').textContent = body;
    dlg.showModal();
  }
  $('dialog-close').addEventListener('click', () => dlg.close());
  $('dialog-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('dialog-body').textContent);
    $('dialog-copy').textContent = 'Copied!';
    setTimeout(() => ($('dialog-copy').textContent = 'Copy JSON'), 1200);
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  init();
})();
