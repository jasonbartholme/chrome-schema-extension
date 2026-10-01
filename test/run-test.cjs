/* End-to-end smoke test: loads each test page in jsdom, runs the built
 * content.js (validator inlined) against it, and asserts key behaviors. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// jsdom's runScripts:'outside-only' installs a wrapper that *silently swallows*
// exceptions thrown by window.eval — so we wrap it to surface real errors.


async function main() {
  let failures = 0;
  const check = (cond, msg) => { if (!cond) { console.log('ASSERT FAIL:', msg); failures++; } else console.log('assert ok:', msg); };

  async function load(file, urlPath) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'test-pages', file), 'utf8');
    const url = 'https://example.com/' + (urlPath || 'a/b/c/');
    const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
    const stored = {};
    dom.window.chrome = {
      storage: { local: { get: (k, cb) => cb({}), set: (o, cb) => { Object.assign(stored, o); cb && cb(); } } },
      runtime: { sendMessage: () => {}, lastError: null }
    };
    const src = fs.readFileSync(path.join(__dirname, '..', 'extension', 'content.js'), 'utf8');
    // jsdom keeps readyState 'loading' until the event loop turns; eval now and
    // again after DOMContentLoaded so start() runs exactly once either way.
    try { dom.window.eval(src); } catch (e) { console.log('EVAL ERROR in content.js:', e && e.message); failures++; }
    dom.window.addEventListener('DOMContentLoaded', () => { try { dom.window.eval(src); } catch (e) {} });
    return new Promise((resolve) => setTimeout(() => resolve(stored['report:' + url]), 20));
  }

  for (const f of ['valid-jsonld.html', 'microdata-errors.html', 'mixed-rdfa.html']) {
    const r = await load(f);
    if (!r) { console.log(f + ': NO REPORT'); failures++; continue; }
    console.log(`\n===== ${f} =====`);
    console.log(`items=${r.results.length} jsonld=${r.counts.jsonld} microdata=${r.counts.microdata} rdfa=${r.counts.rdfa} errors=${r.summary.errors} warnings=${r.summary.warnings} suggestions=${r.suggestions.length}`);
    r.results.forEach(x => x.issues.filter(i=>i.level!=='info').slice(0,4).forEach(i => console.log(` [${x.kind}] ${i.level}: ${i.message}`)));
    r.suggestions.forEach(s => console.log(' SUGGEST:', s.type, '-', s.reason));
  }

  (async () => {
  console.log('\n--- assertions ---');
  const r1 = await load('valid-jsonld.html');
  check(r1.results.length === 2 && r1.results.every(x => x.kind === 'JSON-LD'), 'valid page: 2 JSON-LD items');
  check(r1.results[0].issues.filter(i => i.level === 'error').length === 0, 'valid NewsArticle has no errors');
  const r2 = await load('microdata-errors.html');
  check(r2.results.some(x => x.kind === 'Microdata'), 'microdata detected');
  check(r2.results.flatMap(x => x.issues).some(i => /pricecurrency/i.test(i.message)), 'typo pricecurrency flagged');
  check(r2.results.flatMap(x => x.issues).some(i => /Widget/.test(i.message)), 'unknown type Widget flagged');
  check(r2.results.flatMap(x => x.issues).some(i => /itemReviewed/.test(i.message)), 'Review missing itemReviewed flagged');
  const r3 = await load('mixed-rdfa.html');
  check(r3.results.some(x => x.kind === 'RDFa'), 'RDFa detected');
  check(r3.results.some(x => x.kind === 'JSON-LD' && x.issues.some(i => /trailing comma|Parsed after|Invalid JSON/i.test(i.message))), 'broken JSON-LD flagged');
  check(r3.suggestions.some(s => s.type === 'FAQPage'), 'FAQ suggested on restaurant page');
  check(r3.suggestions.some(s => /BreadcrumbList/.test(s.type)), 'breadcrumb suggested for deep URL');
  check(r3.suggestions.some(s => s.type === 'AggregateRating'), 'rating suggested ("4.8 stars")');
  // strict vs loose: same raw data should produce more/equal errors in strict mode
  const V = require('../extension/validator.js');
  const node = { '@context': 'https://schema.org', '@type': 'Widget', 'madeup': 'x' };
  const loose = V.validateJsonLdItem(node, false).issues.filter(i => i.level === 'error').length;
  const strict = V.validateJsonLdItem(node, true).issues.filter(i => i.level === 'error').length;
  check(strict > loose, 'strict mode escalates issues to errors');

  console.log(failures ? `\nFAILURES: ${failures}` : '\nALL TESTS PASSED');
  process.exit(failures ? 1 : 0);
  })();
}
main();
