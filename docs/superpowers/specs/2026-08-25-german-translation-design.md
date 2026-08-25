# German deck translation design

## Goal

Add a complete German version of the 14-slide Kaufland Bulgaria Meal Deal deck while keeping English as the default language.

## Language behavior

- The title-slide language control shows `EN / DE / БГ`.
- English remains the default when neither the URL nor saved preference specifies another supported language.
- `?lang=de` opens the German version and `?lang=bg` opens the Bulgarian version.
- A selected language is stored under the existing `kaufland-deck-lang` key.
- Unsupported language values fall back to English.
- The document language, page title, arrow labels, slide copy, chart labels, and sources follow the selected language.

## Translation quality

- German copy uses natural commercial and grocery-retail language rather than literal English syntax.
- Figures, company names, SAP product names, Kaufland Card XTRA, quoted offer prices, and source facts stay unchanged.
- Abbreviations receive concise German explanations in brackets at their first useful occurrence. Examples include:
  - `SKU (Artikelnummer)`
  - `MAU (monatlich aktive Nutzer)`
  - `KPI (Leistungskennzahl)`
  - `POS (Kassensystem)`
  - `COGS (Wareneinsatz)`
  - `TLOG (Transaktionsprotokoll)`
  - `IDoc (SAP-Austauschformat)`
- Explanations are not repeated where repetition would make the slide harder to scan.

## Technical design

- Add a `DE` translation dictionary with the same content-key coverage as the existing Bulgarian dictionary.
- Replace the Bulgarian-only branching in `applyLang` with a locale lookup that supports `en`, `de`, and `bg`.
- Keep the original English DOM snapshot as the English source.
- Extend chart localization so German axis labels, legends, and tooltips render when `lang === "de"`.
- Extend URL and local-storage validation to accept `de`.
- Keep all slide layout, navigation behavior, figures, and visual styling unchanged.

## Documentation

Update the README language-control instructions to include German and `?lang=de`.

## Validation

Automated checks will confirm:

- all German dictionary keys match the translatable DOM keys;
- the toggle exposes `EN`, `DE`, and `БГ`;
- English remains the fallback;
- `de` is accepted in URL and saved-language handling;
- German chart strings and navigation labels are present;
- no script syntax or lint errors are introduced.
