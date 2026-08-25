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

const BG = evaluateObjectLiteral(extractConstObject(html, 'BG'));
const DE = evaluateObjectLiteral(extractConstObject(html, 'DE'));

assert.deepEqual(Object.keys(DE).sort(), Object.keys(BG).sort());
assert.match(html, /data-set-lang="en"[^>]*>EN<\/button>/);
assert.match(html, /data-set-lang="de"[^>]*>DE<\/button>/);
assert.match(html, /data-set-lang="bg"[^>]*>БГ<\/button>/);
assert.match(html, /const SUPPORTED_LANGS=new Set\(\['en','de','bg'\]\)/);
assert.match(html, /return 'en';/);
assert.match(DE.s2_c3_h, /SKU \(Artikelnummer/);
assert.match(DE.s4_a3_p, /MAU \(monatlich aktive Nutzer\)/);
assert.match(DE.s13_th1, /KPI \(Leistungskennzahl\)/);
assert.match(DE.s5_sub, /POS \(Kassensystem\)/);
assert.match(DE.s8_src, /COGS \(Wareneinsatz\)/);

for (const key of collectI18nKeys(html)) {
  assert.ok(Object.hasOwn(BG, key), `BG missing key: ${key}`);
  assert.ok(Object.hasOwn(DE, key), `DE missing key: ${key}`);
}

console.log('German localization contract passed.');
