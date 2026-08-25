#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const HTML_ENTITY_RE = /&(?:[a-z]+|#\d+);/i;

function extractConstObjectLiteral(source, name) {
  const marker = `const ${name}={`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Missing const ${name} dictionary in index.html`);
  }

  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  const objectStart = start + `const ${name}=`.length;

  for (let i = objectStart; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(objectStart, i + 1);
      }
    }
  }

  throw new Error(`Unterminated const ${name} object in index.html`);
}

function extractStatementByPrefix(source, prefix) {
  const start = source.indexOf(prefix);
  if (start === -1) {
    throw new Error(`Missing statement starting with: ${prefix}`);
  }
  const end = source.indexOf(';', start);
  if (end === -1) {
    throw new Error(`Unterminated statement starting with: ${prefix}`);
  }
  return source.slice(start, end + 1);
}

function extractStartLangExpression(source) {
  const marker = 'const startLang=';
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error('Missing const startLang in index.html');
  }
  const exprStart = start + marker.length;
  const closeIdx = source.indexOf('})()', exprStart);
  if (closeIdx === -1) {
    throw new Error('Unterminated startLang IIFE in index.html');
  }
  const semiIdx = source.indexOf(';', closeIdx);
  if (semiIdx === -1) {
    throw new Error('Unterminated startLang statement in index.html');
  }
  return source.slice(exprStart, semiIdx);
}

// Extracts the sole inline <script> block that holds the deck's application
// code (i18n dictionaries, deck engine, chart rendering), as opposed to the
// third-party <script src="..."> tag that loads Chart.js.
function extractInlineAppScript(source) {
  const scriptTagRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  let found = null;
  let count = 0;
  while ((match = scriptTagRe.exec(source)) !== null) {
    found = match[1];
    count += 1;
  }
  if (count === 0) {
    throw new Error('Could not locate an inline (non-src) <script> block in index.html');
  }
  if (count > 1) {
    throw new Error(`Expected exactly one inline <script> block, found ${count}`);
  }
  return found;
}

// Loads the real SUPPORTED_LANGS declaration and startLang IIFE straight out of
// index.html and executes them against mocked location/localStorage, so the
// test exercises actual startup locale-resolution behaviour rather than
// pattern-matching source text.
function resolveStartLang(supportedLangsStatement, startLangExpression, { search, stored }) {
  const context = {
    URLSearchParams,
    location: { search },
    localStorage: {
      getItem(key) {
        return key === 'kaufland-deck-lang' ? stored ?? null : null;
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(supportedLangsStatement, context);
  return vm.runInContext(startLangExpression, context);
}

// Evaluates the real `const DE=`, `const BG=`, `const TRANSLATIONS=`,
// `const NAV_LABELS=` and `const CHART_LABELS=` declarations from index.html,
// in one shared vm context and in source order, so TRANSLATIONS/NAV_LABELS/
// CHART_LABELS are the *actual* objects produced by the real code (including
// their real object-identity relationships) rather than independently
// reconstructed literals.
function evaluateRealDeclarations(source) {
  const context = Object.create(null);
  vm.createContext(context);
  const names = ['DE', 'BG', 'TRANSLATIONS', 'NAV_LABELS', 'CHART_LABELS'];
  for (const name of names) {
    const literal = extractConstObjectLiteral(source, name);
    vm.runInContext(`const ${name}=${literal};`, context);
  }
  const result = {};
  for (const name of names) {
    result[name] = vm.runInContext(name, context);
  }
  return result;
}

// Splits data-i18n bindings by attribute so that data-i18n-html (which
// legitimately carries markup, e.g. <br> and &amp;) is never conflated with
// plain-text data-i18n bindings (which must never carry HTML entities, since
// they are assigned via el.textContent and would otherwise render literal
// "&amp;" instead of "&").
function collectKeysByAttr(markup, attrName) {
  const keys = new Set();
  const re = new RegExp(`${attrName}="([^"]+)"`, 'g');
  for (const match of markup.matchAll(re)) {
    keys.add(match[1]);
  }
  return [...keys].sort();
}

const { DE, BG, TRANSLATIONS, NAV_LABELS, CHART_LABELS } = evaluateRealDeclarations(html);

/* ---------- structural / behavioural linkage ---------- */

assert.strictEqual(TRANSLATIONS.de, DE, 'TRANSLATIONS.de must be the real DE dictionary object (reference identity, i.e. TRANSLATIONS.de === DE)');
assert.strictEqual(TRANSLATIONS.bg, BG, 'TRANSLATIONS.bg must be the real BG dictionary object (reference identity, i.e. TRANSLATIONS.bg === BG)');

assert.ok(Object.hasOwn(NAV_LABELS, 'de'), 'NAV_LABELS must define a de entry');
assert.ok(Object.hasOwn(NAV_LABELS.de, 'prev'), 'NAV_LABELS.de must define prev');
assert.ok(Object.hasOwn(NAV_LABELS.de, 'next'), 'NAV_LABELS.de must define next');
assert.ok(NAV_LABELS.de.prev.length > 0, 'NAV_LABELS.de.prev must be non-empty');
assert.ok(NAV_LABELS.de.next.length > 0, 'NAV_LABELS.de.next must be non-empty');

const chartKeysEn = Object.keys(CHART_LABELS.en).sort();
assert.deepEqual(Object.keys(CHART_LABELS.de).sort(), chartKeysEn, 'CHART_LABELS.de must define the same keys as .en');
assert.deepEqual(Object.keys(CHART_LABELS.bg).sort(), chartKeysEn, 'CHART_LABELS.bg must define the same keys as .en');

assert.deepEqual(Object.keys(DE).sort(), Object.keys(BG).sort(), 'DE and BG must define the same dictionary keys');

assert.match(html, /data-set-lang="en"[^>]*>EN<\/button>/);
assert.match(html, /data-set-lang="de"[^>]*>DE<\/button>/);
assert.match(html, /data-set-lang="bg"[^>]*>БГ<\/button>/);
assert.match(html, /const SUPPORTED_LANGS=new Set\(\['en','de','bg'\]\)/);

/* ---------- abbreviation explanations: explained once, not repeated ---------- */

assert.match(DE.s1_lead, /SKU \(Artikelnummer/, 'SKU must be explained at its first occurrence (s1_lead)');
assert.doesNotMatch(DE.s2_c3_h, /Artikelnummer/, 's2_c3_h must not repeat the SKU explanation already given in s1_lead');
assert.match(DE.s4_a3_p, /MAU \(monatlich aktive Nutzer\)/);
assert.match(DE.s2_c4_p, /KPI-Grenzwerte \(Leistungskennzahlen\)/, 'KPI must be explained at its first occurrence (s2_c4_p)');
assert.doesNotMatch(DE.s13_th1, /Leistungskennzahl/, 's13_th1 must not repeat the KPI explanation already given in s2_c4_p');
assert.match(DE.s5_sub, /POS \(Kassensystem\)/);
assert.match(DE.s8_src, /COGS \(Wareneinsatz\)/);

/* ---------- s8_th3: first visible COGS table header must be localized ---------- */

assert.match(html, /<th[^>]*data-i18n="s8_th3"[^>]*>COGS<\/th>/, 'the first visible COGS table header must carry data-i18n="s8_th3" and keep "COGS" as the English DOM fallback');
assert.equal(DE.s8_th3, 'COGS (Wareneinsatz)');
assert.match(BG.s8_th3, /COGS/, 'BG.s8_th3 must preserve the COGS acronym');
assert.ok(BG.s8_th3.length > 'COGS'.length, 'BG.s8_th3 must add a concise Bulgarian gloss, not just repeat COGS');

/* ---------- wording polish ---------- */

assert.match(DE.s1_kicker, /Kommerzieller Vorschlag/, 's1_kicker should prefer "Kommerzieller Vorschlag" over "Vertriebsvorschlag"');
assert.doesNotMatch(DE.s1_kicker, /Vertriebsvorschlag/);
assert.doesNotMatch(DE.s1_for_val, /Handelsdirektor/, 's1_for_val must not invent a different corporate role than "Commercial Director"');
assert.match(DE.s1_for_val, /Kaufmännischer Direktor/, 's1_for_val must render "Commercial Director" naturally');
assert.doesNotMatch(DE.s8_callout, /meistverkauftes Menü-Getränk Nr\. 1/, 's8_callout must not pleonastically double up "best-selling" and "number one"');
assert.match(DE.s8_callout, /Menü-Getränk Nr\. 1/);

/* ---------- German comma decimals for the UK benchmark figures ---------- */

assert.match(DE.s4_bench, /\+3,4%/, 's4_bench must use a German comma decimal for +3.4%');
assert.match(DE.s4_bench, /\+8,5%/, 's4_bench must use a German comma decimal for +8.5%');
assert.doesNotMatch(DE.s4_bench, /\+3\.4%|\+8\.5%/, 's4_bench must not keep the English-style decimal point for these figures');

/* ---------- "bundesweit" -> "landesweit" ---------- */

const bundesweitOffenders = Object.entries(DE).filter(([, v]) => typeof v === 'string' && /bundesweit/i.test(v));
assert.deepEqual(bundesweitOffenders, [], `DE must not use "bundesweit" anywhere: ${bundesweitOffenders.map(([k]) => k).join(', ')}`);
const landesweitCount = Object.values(DE).filter((v) => typeof v === 'string' && /landesweit/i.test(v)).length;
assert.ok(landesweitCount >= 4, `expected at least 4 DE values using "landesweit", found ${landesweitCount}`);

/* ---------- slide 7 heading must be compact enough to fit the slide ---------- */

assert.ok(DE.s7_h2.length <= 80, `DE.s7_h2 should be a compact, natural line (<=80 chars), got ${DE.s7_h2.length}: ${DE.s7_h2}`);

/* ---------- slide 11 overflow: compact arrow labels, explanations moved into body copy ---------- */

assert.ok(DE.s11_a1.length <= 55, `DE.s11_a1 must stay compact (<=55 chars), got ${DE.s11_a1.length}: ${DE.s11_a1}`);
assert.ok(DE.s11_a2.length <= 40, `DE.s11_a2 must stay compact (<=40 chars), got ${DE.s11_a2.length}: ${DE.s11_a2}`);
assert.doesNotMatch(DE.s11_a1, /IDoc|Austauschformat/i, 's11_a1 must not carry the full IDoc explanation; it belongs in s11_f1_p');
assert.doesNotMatch(DE.s11_a2, /Transaktionsprotokoll/i, 's11_a2 must not carry the full TLOG explanation; it belongs in s11_f2_p');
assert.match(DE.s11_f1_p, /IDoc \(SAP-Austauschformat\)/, 's11_f1_p must naturally explain IDoc');
assert.match(DE.s11_f2_p, /TLOG \(Transaktionsprotokoll\)/, 's11_f2_p must naturally explain TLOG');

/* ---------- inline application script must be syntactically valid JS ---------- */

const inlineScript = extractInlineAppScript(html);
assert.doesNotThrow(
  () => new vm.Script(inlineScript, { filename: 'index.html#inline-app-script' }),
  'the inline application script in index.html must compile as valid JavaScript'
);

/* ---------- startLang: real URL/localStorage behaviour ---------- */

const supportedLangsStatement = extractStatementByPrefix(html, 'const SUPPORTED_LANGS=');
const startLangExpression = extractStartLangExpression(html);

assert.equal(
  resolveStartLang(supportedLangsStatement, startLangExpression, { search: '?lang=de', stored: null }),
  'de',
  'startLang must honour ?lang=de from the query string'
);
assert.equal(
  resolveStartLang(supportedLangsStatement, startLangExpression, { search: '', stored: 'de' }),
  'de',
  'startLang must honour a saved de value in localStorage'
);
assert.equal(
  resolveStartLang(supportedLangsStatement, startLangExpression, { search: '?lang=fr', stored: 'xx' }),
  'en',
  'startLang must fall back to en when neither the query string nor localStorage holds a supported language'
);
assert.equal(
  resolveStartLang(supportedLangsStatement, startLangExpression, { search: '', stored: null }),
  'en',
  'startLang must default to en when no query string or localStorage value is present'
);

/* ---------- every data-i18n(-html) key must exist in both DE and BG ---------- */

const plainKeys = collectKeysByAttr(html, 'data-i18n');
const htmlKeys = collectKeysByAttr(html, 'data-i18n-html');
const allKeys = [...new Set([...plainKeys, ...htmlKeys])].sort();

for (const key of allKeys) {
  assert.ok(Object.hasOwn(BG, key), `BG missing key: ${key}`);
  assert.ok(Object.hasOwn(DE, key), `DE missing key: ${key}`);
}

/* ---------- plain (non -html) data-i18n bindings must carry no HTML entities ---------- */
/* These values are assigned via el.textContent, so an entity like "&amp;"   */
/* would render literally instead of as "&".                                 */

for (const key of plainKeys) {
  assert.ok(!HTML_ENTITY_RE.test(DE[key]), `DE.${key} must not contain an HTML entity (bound via plain data-i18n): ${DE[key]}`);
  assert.ok(!HTML_ENTITY_RE.test(BG[key]), `BG.${key} must not contain an HTML entity (bound via plain data-i18n): ${BG[key]}`);
}

console.log('German localization contract passed.');
