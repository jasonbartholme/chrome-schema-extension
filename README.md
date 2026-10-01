# Chrome Schema Validator Extension

A Chrome extension that reviews a web page's structured data against the [schema.org](https://schema.org) standards. It parses and validates **JSON-LD**, **Microdata**, and **RDFa**, reports errors/warnings in a popup, and gives context-based suggestions (no AI — pure heuristics from page content).

## Features

- Detects all three schema formats: JSON-LD (`<script type="application/ld+json">`), Microdata (`itemscope/itemtype/itemprop`), RDFa (`vocab/prefix/typeof/property`).
- Strict or loose validation mode (toggle in the popup).
  - **Strict**: unknown types/properties, missing required properties, bad value types → errors.
  - **Loose**: only structural/parse problems are errors; type/property issues become warnings.
- Context suggestions based on visible page content (title, headings, price patterns, dates, addresses, emails, images, ratings…) with ready-to-paste starter snippets.
- Works on any page including `http://localhost` and local files — just enable "Allow access to file URLs" if needed.

## Installation (home & work, no Chrome Web Store)

1. Download the latest `schema-validator-extension.zip` from the [GitHub Releases](../../releases) page.
2. Unzip it to a permanent folder (e.g. `Documents/schema-validator`).
3. Open `chrome://extensions`, enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped folder.
5. (Optional) To validate local `.html` files: click **Details** on the extension and enable **Allow access to file URLs**.

Repeat on each machine — that's it. Updates: download the new zip, unzip over the same folder, click the reload icon on `chrome://extensions`.

## Usage

1. Visit any page and click the toolbar icon.
2. The popup shows detected schemas grouped by format, with per-item validation results.
3. Toggle **Strict / Loose** at the top; results recompute instantly.
4. Expand **Suggestions** for context-based recommendations with copyable snippets.

## Development

The extension is plain JavaScript (Manifest V3, no build step). Source lives in `extension/`:

```
extension/
├── manifest.json      # MV3 manifest
├── popup.html/js/css  # popup UI + rendering
├── background.js      # service worker (icon badge state)
├── content.js         # runs in page: extracts JSON-LD/Microdata/RDFa + page text
├── validator.js       # schema.org type/property knowledge base + validation engine
└── icons/             # toolbar icons
```

To test changes locally, load `extension/` via "Load unpacked" and hit reload.

### Sample pages

`test-pages/` contains HTML files to exercise the validator:

| File | Purpose |
|---|---|
| `valid-jsonld.html` | Clean JSON-LD (Article, Organization, BreadcrumbList) |
| `microdata-errors.html` | Microdata with missing required props + typos |
| `mixed-rdfa.html` | RDFa Product + broken JSON-LD + messy content worth suggesting schema for |

Open them directly in Chrome (`File > Open file`) with the extension loaded.

## Packaging a release

```
cd extension && zip -r ../schema-validator-extension.zip . && cd ..
```

Attach the zip to a GitHub Release.
