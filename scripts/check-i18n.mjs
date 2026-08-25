#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function extractConstObject(source, name) {
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

function evaluateObjectLiteral(literal) {
  return vm.runInNewContext(`(${literal})`, Object.create(null));
}

function collectI18nKeys(markup) {
  const keys = new Set();
  for (const match of markup.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) {
    keys.add(match[1]);
  }
  return [...keys].sort();
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

const BG = evaluateObjectLiteral(extractConstObject(html, 'BG'));
const DE = evaluateObjectLiteral(extractConstObject(html, 'DE'));

assert.deepEqual(Object.keys(DE).sort(), Object.keys(BG).sort());
assert.match(html, /data-set-lang="en"[^>]*>EN<\/button>/);
assert.match(html, /data-set-lang="de"[^>]*>DE<\/button>/);
assert.match(html, /data-set-lang="bg"[^>]*>БГ<\/button>/);
assert.match(html, /const SUPPORTED_LANGS=new Set\(\['en','de','bg'\]\)/);
assert.match(DE.s2_c3_h, /SKU \(Artikelnummer/);
assert.match(DE.s4_a3_p, /MAU \(monatlich aktive Nutzer\)/);
assert.match(DE.s13_th1, /KPI \(Leistungskennzahl\)/);
assert.match(DE.s5_sub, /POS \(Kassensystem\)/);
assert.match(DE.s8_src, /COGS \(Wareneinsatz\)/);

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

for (const key of collectI18nKeys(html)) {
  assert.ok(Object.hasOwn(BG, key), `BG missing key: ${key}`);
  assert.ok(Object.hasOwn(DE, key), `DE missing key: ${key}`);
}

console.log('German localization contract passed.');
