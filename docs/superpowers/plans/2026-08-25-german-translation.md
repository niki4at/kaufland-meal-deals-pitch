# German deck translation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete, natural German version of the deck while preserving English as the default.

**Architecture:** Keep the English DOM as the source language and add a `DE` dictionary beside `BG`. Generalize locale selection through a dictionary lookup, then provide German chart labels, navigation labels, URL handling, and documentation.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Chart.js 4.4.7, Node.js standard library for static checks.

## Global constraints

- The title-slide language control shows `EN / DE / БГ`.
- English remains the default when no valid URL or saved preference exists.
- `?lang=de` and saved `de` preferences select German.
- German copy uses natural commercial and grocery-retail language.
- Figures, brands, SAP product names, prices, and cited facts stay unchanged.
- Specialist abbreviations receive concise German explanations in brackets at their first useful occurrence.
- Slide layout and navigation behavior stay unchanged.

---

### Task 1: Add a failing localization contract check

**Files:**
- Create: `scripts/check-i18n.mjs`
- Test: `scripts/check-i18n.mjs`

**Interfaces:**
- Consumes: `index.html`
- Produces: a zero-dependency command that exits nonzero when German locale coverage or English fallback behavior is missing.

- [ ] **Step 1: Write the static contract checker**

Create `scripts/check-i18n.mjs` using `node:assert/strict`, `node:fs`, and `node:vm`. Extract `BG` and `DE` object literals from `index.html`, evaluate them in an empty VM context, and assert:

```js
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
```

The checker must also collect every `data-i18n` and `data-i18n-html` key from the markup and assert each key exists in both `BG` and `DE`.

- [ ] **Step 2: Run the checker and confirm the expected failure**

Run:

```bash
node scripts/check-i18n.mjs
```

Expected: nonzero exit because `const DE`, the `DE` toggle, and German locale handling do not exist.

---

### Task 2: Add German copy and three-locale runtime support

**Files:**
- Modify: `index.html:176-179`
- Modify: `index.html:691-940`
- Modify: `index.html:975-1073`
- Test: `scripts/check-i18n.mjs`

**Interfaces:**
- Consumes: `applyLang(lang)` calls with `en`, `de`, or `bg`.
- Produces: `DE`, `TRANSLATIONS`, `NAV_LABELS`, and `SUPPORTED_LANGS`; localized DOM, charts, URL, page title, and navigation labels.

- [ ] **Step 1: Add the German language button**

Change the control label to `EN / DE / BG` and add:

```html
<button type="button" data-set-lang="de" aria-pressed="false">DE</button>
```

between English and Bulgarian.

- [ ] **Step 2: Add the complete German dictionary**

Add `const DE={...};` before `const BG`. It must contain every key in `BG`, including `doc_title`, and translate all 14 slides, sources, labels, and HTML-rich copy.

Use natural terms such as:

```js
doc_title:'Kaufland Bulgarien · Vorschlag für ein Mittagsmenü',
s1_kicker:'Vertriebsvorschlag · Vertraulich',
s1_h1:'Das Kaufland Mittagsmenü.<br><span style="color:#ff5a63">Ein Preis. Drei Bereiche. Ein neuer täglicher Einkaufsanlass.</span>',
s2_c3_h:'Benötigte neue SKU (Artikelnummern)',
s4_a3_p:'... mehr als 1 Mio. MAU (monatlich aktive Nutzer) ...',
s5_sub:'... Das POS (Kassensystem) erkennt das Trio ...',
s8_src:'COGS (Wareneinsatz): ...',
s13_th1:'Pilot-KPI (Leistungskennzahlen, gemessen in SAP CAR)'
```

Keep proper nouns and product names unchanged. Explain `IDoc` and `TLOG` in the system-integration slide.

- [ ] **Step 3: Generalize locale selection**

Introduce:

```js
const TRANSLATIONS={de:DE,bg:BG};
const NAV_LABELS={
  en:{prev:'Previous',next:'Next'},
  de:{prev:'Zurück',next:'Weiter'},
  bg:{prev:'Назад',next:'Напред'}
};
const SUPPORTED_LANGS=new Set(['en','de','bg']);
```

Update `applyLang` to select `const copy=TRANSLATIONS[lang]`, use original DOM content when `copy` is absent, set `document.documentElement.lang=lang`, update the title and arrow labels, and keep the URL free of `lang` only for English.

- [ ] **Step 4: Add German chart labels**

Replace Boolean Bulgarian chart branching with locale-specific chart dictionaries. German labels must cover every current chart string, including store counts, price waterfall, unit economics, scenarios, and halo effects.

- [ ] **Step 5: Extend startup locale validation**

Accept query-string or saved values only when `SUPPORTED_LANGS.has(value)`. Return `en` when neither value is supported.

- [ ] **Step 6: Run the localization contract check**

Run:

```bash
node scripts/check-i18n.mjs
```

Expected: `German localization contract passed.`

- [ ] **Step 7: Run syntax and diff checks**

Run:

```bash
node --check scripts/check-i18n.mjs
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit the locale feature**

```bash
git add index.html scripts/check-i18n.mjs
git commit -m "Add complete German deck translation"
git push -u origin cursor/german-translation-6adf
```

---

### Task 3: Document and ship the German locale

**Files:**
- Modify: `README.md:11`
- Modify: `docs/superpowers/plans/2026-08-25-german-translation.md`

**Interfaces:**
- Consumes: the three-language runtime from Task 2.
- Produces: accurate usage instructions and checked-off execution record.

- [ ] **Step 1: Update usage documentation**

Document `EN / DE / БГ`, `?lang=de`, and `?lang=bg`, while stating English is the default.

- [ ] **Step 2: Run final checks**

Run:

```bash
node scripts/check-i18n.mjs
node --check scripts/check-i18n.mjs
git diff --check
```

Expected: the localization contract prints its pass message and every command exits 0.

- [ ] **Step 3: Commit and push documentation**

```bash
git add README.md docs/superpowers/plans/2026-08-25-german-translation.md
git commit -m "Document German deck locale"
git push -u origin cursor/german-translation-6adf
```

- [ ] **Step 4: Update the draft pull request and fast-forward `main`**

Update the existing draft PR with translation and test notes. Fast-forward local `main` to the feature branch, push `main`, then return to `cursor/german-translation-6adf`.
