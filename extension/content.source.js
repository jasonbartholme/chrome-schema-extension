/* Content script: extracts JSON-LD, Microdata and RDFa from the page, builds a
 * page-content context for suggestions, validates everything, and stores the
 * report in chrome.storage.local for the popup to render. */
(() => {
  'use strict';

  // ---- schema.org knowledge base + validator (inlined at build time) --------
  /* __VALIDATOR_SOURCE__ */

  const V = self.SchemaValidator;

  // ---------- JSON-LD extraction ----------
  function extractJsonLd() {
    const items = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el, i) => {
      const raw = el.textContent || '';
      let parsed = null; let parseError = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e1) {
        // Tolerate common junk: HTML comments wrapping, trailing commas
        try {
          const cleaned = raw.replace(/^\s*<!--[\s\S]*?-->\s*$/g, (m) => m.replace(/<!--|-->/g, ''))
            .replace(/,\s*([}\]])/g, '$1');
          parsed = JSON.parse(cleaned);
          parseError = 'Parsed after removing comments/trailing commas — clean this up.';
        } catch (e2) {
          parseError = e2.message;
        }
      }
      items.push({ kind: 'JSON-LD', index: i, raw, parsed, parseError });
    });
    return items;
  }

  // ---------- Microdata extraction ----------
  const SCHEMA_URL_RE = /^https?:\/\/schema\.org\/(.+)$/i;
  function microdataItems() {
    const scopes = [...document.querySelectorAll('[itemscope]')];
    return scopes.map((scope, i) => {
      const typeUrl = scope.getAttribute('itemtype') || '';
      const m = typeUrl.match(SCHEMA_URL_RE);
      const type = m ? m[1] : (typeUrl ? typeUrl : null);
      const props = {};
      // direct itemprop children of THIS scope (not nested scopes)
      const refIds = (scope.getAttribute('itemref') || '').split(/\s+/).filter(Boolean);
      const refEls = refIds.map((id) => document.getElementById(id)).filter(Boolean);
      const propEls = [...scope.querySelectorAll('[itemprop]'), ...refEls];
      propEls.forEach((el) => {
        // skip elements owned by an inner itemscope
        const parentScope = el.parentElement && el.parentElement.closest('[itemscope]');
        if (parentScope && parentScope !== scope) return;
        const name = el.getAttribute('itemprop');
        let value;
        if (el.hasAttribute('itemscope')) {
          value = microdataNodeToLd(el);
        } else if (el.tagName === 'META') {
          value = el.getAttribute('content') || '';
        } else if (el.tagName === 'TIME') {
          value = el.getAttribute('datetime') || el.textContent.trim();
        } else if (el.tagName === 'IMG') {
          value = el.getAttribute('src') || '';
        } else if (el.tagName === 'A' || el.tagName === 'LINK') {
          value = el.getAttribute('href') || '';
        } else if (el.tagName === 'DATA') {
          value = el.getAttribute('value') || el.textContent.trim();
        } else {
          value = el.textContent.trim();
        }
        if (props[name] === undefined) props[name] = value;
        else if (Array.isArray(props[name])) props[name].push(value);
        else props[name] = [props[name], value];
      });
      const node = { '@type': type || 'Thing', ...props };
      if (scope.hasAttribute('itemid')) node['@id'] = scope.getAttribute('itemid');
      return { kind: 'Microdata', index: i, typeUrl, node, element: scope };
    });
  }
  function microdataNodeToLd(scope) {
    const typeUrl = scope.getAttribute('itemtype') || '';
    const m = typeUrl.match(SCHEMA_URL_RE);
    const type = m ? m[1] : 'Thing';
    const props = {};
    scope.querySelectorAll('[itemprop]').forEach((el) => {
      const ps = el.parentElement && el.parentElement.closest('[itemscope]');
      if (ps && ps !== scope) return;
      const name = el.getAttribute('itemprop');
      let value;
      if (el.hasAttribute('itemscope')) value = microdataNodeToLd(el);
      else if (el.tagName === 'META') value = el.getAttribute('content') || '';
      else if (el.tagName === 'TIME') value = el.getAttribute('datetime') || el.textContent.trim();
      else if (el.tagName === 'IMG') value = el.getAttribute('src') || '';
      else if (el.tagName === 'A' || el.tagName === 'LINK') value = el.getAttribute('href') || '';
      else value = el.textContent.trim();
      if (props[name] === undefined) props[name] = value;
      else if (Array.isArray(props[name])) props[name].push(value);
      else props[name] = [props[name], value];
    });
    return { '@type': type, ...props };
  }

  // ---------- RDFa extraction ----------
  function rdfaNodeToLd(el) {
    const typeofAttr = el.getAttribute('typeof') || '';
    let type = null;
    if (typeofAttr) {
      const first = typeofAttr.split(/\s+/)[0];
      const m = first.match(SCHEMA_URL_RE);
      if (m) type = m[1];
      else if (/^[A-Z]/.test(first) && !first.includes('/')) type = first;
      else if (first.includes('schema.org')) type = first.split('/').pop();
    }
    const props = {};
    const addProp = (node) => {
      const rawName = node.getAttribute('property');
      if (!rawName) return;
      const name = rawName.replace(/^schema:/i, '').replace(SCHEMA_URL_RE_SRC, '');
      if (!name || name.includes(':')) return;
      let value;
      if (node.hasAttribute('typeof')) value = rdfaNodeToLd(node);
      else value = node.getAttribute('content') || node.textContent.trim();
      if (props[name] === undefined) props[name] = value;
      else if (Array.isArray(props[name])) props[name].push(value);
      else props[name] = [props[name], value];
    };
    if (el.hasAttribute('property')) addProp(el);
    el.querySelectorAll('[property]').forEach((p) => {
      const owner = p.parentElement && p.parentElement.closest('[typeof]');
      if (owner && owner !== el) return; // belongs to a deeper entity
      addProp(p);
    });
    return { '@type': type || 'Thing', ...props };
  }

  function rdfaItems() {
    const nodes = [...document.querySelectorAll('[typeof],[about][property],[resource][property]')];
    // keep only top-level entities (skip elements inside another [typeof])
    const tops = nodes.filter((el) => {
      const parent = el.parentElement && el.parentElement.closest('[typeof]');
      return !parent;
    });
    return tops.map((el, i) => {
      const node = rdfaNodeToLd(el);
      return { kind: 'RDFa', index: i, typeUrl: el.getAttribute('typeof') || '', node, element: el };
    });
  }
  const SCHEMA_URL_RE_SRC = /^https?:\/\/schema\.org\//i;

  function documentBodyText() {
    // jsdom & older engines lack innerText — approximate visible text
    const clone = document.body ? document.body.cloneNode(true) : null;
    if (!clone) return '';
    clone.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ');
  }

  // ---------- Page context for suggestions ----------
  function buildPageContext(existingTypes) {
    const text = ((document.body && (document.body.innerText || documentBodyText())) || '').slice(0, 20000);
    const headings = [...document.querySelectorAll('h1,h2,h3')].map((h) => h.textContent.trim()).filter(Boolean).slice(0, 20);
    let pathDepth = 0, origin = location.origin;
    try { pathDepth = location.pathname.split('/').filter(Boolean).length; } catch (e) {}
    const lower = text.toLowerCase();
    return {
      title: document.title || '',
      headings,
      textSample: text.slice(0, 5000),
      url: location.href, origin, pathDepth,
      existingTypes,
      hasDates: /\b20\d{2}-\d{2}-\d{2}\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/i.test(text),
      hasProducts: /[$€£]\s?\d+([.,]\d{1,2})?\b/.test(text) && /(price|buy|add to cart|in stock|product)/i.test(lower),
      hasEvents: /(event|ticket|register|agenda|venue)/i.test(lower) && /\b(20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text),
      hasRecipe: /(ingredients|directions|preparation|recipe|instructions)/i.test(lower) && /(steps|bake|cook|mix|prep)/i.test(lower),
      hasHowTo: /(step\s*\d|how to)/i.test(lower),
      hasFaq: /(faq|frequently asked|questions)/i.test(lower),
      hasJobs: /(job|career|hiring|apply now|position open|full-time|part-time)/i.test(lower),
      hasVideos: !!document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]'),
      hasRatings: /(\d(?:\.\d)?)\s*(\/\s*5|out of 5|stars?|★)/i.test(text),
      hasAddresses: /\d{1,5}\s+\w+(\s\w+)*\s+(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Way)\b/i.test(text) && /\b\d{5}(-\d{4})?\b/.test(text)
    };
  }

  // ---------- Run & store ----------
  function run(strict) {
    if (strict === undefined) strict = false; // popup re-validates from raw data anyway
    const results = [];
    const allTypes = new Set();

    extractJsonLd().forEach((it) => {
      if (it.parseError && !it.parsed) {
        results.push({ kind: 'JSON-LD', index: it.index, label: `JSON-LD block #${it.index + 1}`, types: [], issues: [{ level: 'error', message: `Invalid JSON: ${it.parseError}`, path: '' }], raw: it.raw });
        return;
      }
      const r = V.validateJsonLdItem(it.parsed, strict, 'JSON-LD');
      if (it.parseError) r.issues.unshift({ level: 'warning', message: it.parseError, path: '' });
      r.types.forEach((t) => allTypes.add(t));
      results.push({ kind: 'JSON-LD', index: it.index, label: `JSON-LD block #${it.index + 1}${r.types.length ? ': ' + r.types.join(', ') : ''}`, types: r.types, issues: r.issues, raw: it.raw });
    });

    microdataItems().forEach((it) => {
      const r = V.validateJsonLdItem(it.node, strict, 'Microdata');
      r.types.forEach((t) => allTypes.add(t));
      const loc = describeElement(it.element);
      results.push({ kind: 'Microdata', index: it.index, label: `Microdata item ${loc}${it.type ? ': ' + it.type : ''}`, types: r.types, issues: r.issues, raw: JSON.stringify(it.node, null, 2) });
    });

    rdfaItems().forEach((it) => {
      const r = V.validateJsonLdItem(it.node, strict, 'RDFa');
      r.types.forEach((t) => allTypes.add(t));
      const loc = describeElement(it.element);
      results.push({ kind: 'RDFa', index: it.index, label: `RDFa item ${loc}${it.node['@type'] ? ': ' + it.node['@type'] : ''}`, types: r.types, issues: r.issues, raw: JSON.stringify(it.node, null, 2) });
    });

    const ctx = buildPageContext([...allTypes]);
    const suggestions = V.buildSuggestions(ctx);

    const errors = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'error').length, 0);
    const warnings = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'warning').length, 0);

    const report = {
      url: location.href, title: document.title, generatedAt: Date.now(),
      counts: { jsonld: results.filter((r) => r.kind === 'JSON-LD').length, microdata: results.filter((r) => r.kind === 'Microdata').length, rdfa: results.filter((r) => r.kind === 'RDFa').length },
      results, suggestions, summary: { errors, warnings }
    };

    try {
      chrome.storage.local.set({ [`report:${tabKey()}`]: report }, () => {
        if (chrome.runtime.lastError) return;
        try { chrome.runtime.sendMessage({ type: 'validation-summary', errors, warnings }); } catch (e) {}
      });
    } catch (e) { /* extension context invalidated */ }
  }

  function tabKey() {
    // storage key based on URL; popup reads by current tab URL
    return location.href.replace(/#.*$/, '');
  }

  function describeElement(el) {
    if (!el || !el.tagName) return '';
    let s = `<${el.tagName.toLowerCase()}`;
    if (el.id) s += `#${el.id}`;
    else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/)[0];
    return s + '>';
  }

  // Re-run when DOM mutates significantly (debounced); respect saved mode.
  let t = null;
  let currentStrict = false;
  const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => run(currentStrict), 800); });
  function start() {
    try {
      chrome.storage.local.get(['mode'], (d) => {
        currentStrict = d && d.mode === 'strict';
        run(currentStrict);
      });
    } catch (e) { run(false); }
    try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
