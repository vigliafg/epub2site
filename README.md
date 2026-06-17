# epub2site

[![Release](https://img.shields.io/github/v/release/vigliafg/epub2site)](https://github.com/vigliafg/epub2site/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/vigliafg/epub2site/total)](https://github.com/vigliafg/epub2site/releases)
[![License](https://img.shields.io/github/license/vigliafg/epub2site)](./LICENSE)

Converts an EPUB ebook into a self-contained static website that can be read locally in any browser, with no server required.

---

## 🚀 Quick Start

Scarica il binario per il tuo sistema operativo — **zero dipendenze**, nessuna installazione. Aprilo nel terminale e converti un ebook in pochi secondi.

### Download

| Piattaforma | File |
|---|---|
| 🐧 **Linux x64** | [epub2site-linux-x64](https://github.com/vigliafg/epub2site/releases/latest/download/epub2site-linux-x64) |
| 🍎 **macOS ARM** | [epub2site-macos-arm64](https://github.com/vigliafg/epub2site/releases/latest/download/epub2site-macos-arm64) |
| 🪟 **Windows x64** | [epub2site-windows-x64.exe](https://github.com/vigliafg/epub2site/releases/latest/download/epub2site-windows-x64.exe) |

> 📦 [Tutte le release](https://github.com/vigliafg/epub2site/releases)

### Avvio rapido

**🐧 Linux:**

```bash
chmod +x epub2site-linux-x64
./epub2site-linux-x64 mio-libro.epub --open
```

**🍎 macOS:**

```bash
chmod +x epub2site-macos-arm64
./epub2site-macos-arm64 mio-libro.epub --open
```

**🪟 Windows** — dal terminale (cmd/PowerShell):

```cmd
epub2site-windows-x64.exe mio-libro.epub --open
```

> 💡 Vuoi compilare da sorgente o usare Node.js? Vedi la [guida completa](#installation) qui sotto.

---

## Part 1 — User Guide

### What it does

`epub2site` takes an `.epub` file and produces a folder of plain HTML files. The result is a fully offline reading experience with:

- Hierarchical table of contents with collapsible sections
- Sticky header with chapter progress bar
- Light / dark theme toggle (saved across sessions)
- Font size controls (saved across sessions)
- Resizable TOC sidebar
- Scroll position saved per chapter
- **Standard / Enriched CSS toggle** — switch between the built-in reader style and a version that also applies the book's original typographic classes (callouts, tables, figures, lists, etc.)

### Requirements

- [Node.js](https://nodejs.org/) 18 or later

### Installation

#### Standard (Node.js)

```bash
git clone https://github.com/vigliafg/epub2site.git
cd epub2site
npm install
```

To use the command globally:

```bash
npm link
```

#### Monolithic binary (no Node.js required)

You can compile `epub2site` into a single standalone executable (~92 MB) that runs on Linux without Node.js or npm.

**Requirements:** [Bun](https://bun.sh/) 1.x

```bash
# Install Bun (one-time)
curl -fsSL https://bun.sh/install | bash

# Clone and build
git clone https://github.com/vigliafg/epub2site.git
cd epub2site
npm run embed    # embed reader assets into the source
npm run compile  # build the monolithic binary
```

This produces a single `./epub2site` binary:

```bash
./epub2site mybook.epub
./epub2site mybook.epub --css original --open
./epub2site --help
```

**Available npm scripts:**

| Script | Description |
|---|---|
| `npm run embed` | Regenerate `src/generator/embeddedAssets.js` from `src/reader/` |
| `npm run compile` | Compile the monolithic binary with `bun build --compile` |
| `npm run build` | `embed` + `compile` combined |

> **Note:** Run `npm run embed` any time you modify files in `src/reader/`. The build embeds `reader.js` and `reader.css` as string constants so they work inside the compiled binary.

### Usage

```bash
node bin/epub2site.js <epub-file> [output-dir] [options]
```

Or, if installed globally:

```bash
epub2site <epub-file> [output-dir] [options]
```

#### Arguments

| Argument | Description |
|---|---|
| `<epub-file>` | Path to the `.epub` file to convert |
| `[output-dir]` | Output folder (default: `./<book-title>`) |

#### Options

| Option | Description |
|---|---|
| `--css custom` | Use the built-in reader stylesheet (default) |
| `--css original` | Use the book's original CSS files instead |
| `--open` | Open the generated site in the browser immediately |
| `--version` | Show version number |
| `--help` | Show help |

#### Examples

```bash
# Basic conversion — output folder named after the book title
node bin/epub2site.js mybook.epub

# Specify output folder
node bin/epub2site.js mybook.epub ./output/mybook

# Convert and open in browser
node bin/epub2site.js mybook.epub --open

# Use the book's original CSS
node bin/epub2site.js mybook.epub --css original
```

### Output structure

```
<output-dir>/
├── index.html          # Cover page with book metadata
├── cover.jpg           # Cover image (if present in the EPUB)
├── assets/
│   ├── reader.css      # Reader stylesheet
│   ├── reader.js       # Reader behaviour (theme, TOC, font size, etc.)
│   ├── toc.js          # Table of contents data (auto-generated)
│   └── enriched.css    # Scoped original book CSS (if CSS files found in EPUB)
├── chapters/
│   ├── ch-001.html
│   ├── ch-002.html
│   └── ...
├── images/             # All images extracted from the EPUB
└── fonts/              # All fonts extracted from the EPUB
```

### Reader controls

| Control | Function |
|---|---|
| `☰` | Toggle the TOC sidebar |
| `A−` / `A+` | Decrease / increase font size |
| `CSS+` | Toggle enriched CSS (only shown when the book has original stylesheets) |
| `◑` | Toggle light / dark theme |

All preferences (theme, font size, enriched CSS state, scroll position per chapter) are stored in `localStorage` and restored automatically on the next visit.

---

## Part 2 — Developer Guide

### Architecture overview

The project is divided into three areas:

1. **`src/epub/`** — reads and parses the EPUB file
2. **`src/generator/`** — produces the static HTML output
3. **`src/reader/`** — the browser-side CSS and JS embedded in every generated page

`src/convert.js` is the orchestrator that connects all three areas. `bin/epub2site.js` is the CLI entry point.

### Directory structure

```
bin/
└── epub2site.js            # CLI entry point (commander)

src/
├── convert.js              # Main orchestrator
├── epub/
│   ├── parser.js           # Wraps the `epub` package; builds the spine
│   └── toc.js              # Extracts the table of contents (NCX / nav.xhtml)
├── generator/
│   ├── assets.js           # Copies images, fonts, original CSS from the EPUB
│   ├── chapter.js          # Renders each chapter as a full HTML page
│   ├── index.js            # Renders the cover / index page
│   ├── extractEnrichedCss.js  # Extracts and scopes the book's original CSS
│   └── embeddedAssets.js      # Embedded reader.js and reader.css (auto-generated)
├── scripts/
│   └── embedAssets.js         # Regenerates embeddedAssets.js from src/reader/
└── reader/
    ├── reader.css          # Reader stylesheet (custom properties, layout, components)
    └── reader.js           # Browser-side behaviour (theme, font, TOC, enriched toggle)
```

### File-by-file description

#### `bin/epub2site.js`
Thin CLI wrapper using [commander](https://github.com/tj/commander.js). Parses `<epub>`, `[output-dir]`, `--css`, and `--open`, then delegates everything to `src/convert.js`. Handles cross-platform `--open` (`open` / `start` / `xdg-open`).

#### `src/convert.js`
The central coordinator. Runs the full pipeline in order:
1. Parse the EPUB
2. Create the output directory tree
3. Copy static reader assets (`reader.js`, `reader.css`)
4. Copy images, fonts, and (optionally) original CSS via `assets.js`
5. Extract enriched CSS via `extractEnrichedCss.js`, write `assets/enriched.css`
6. Build the spine (ordered list of content documents)
7. Build the TOC tree with rewritten hrefs, write `assets/toc.js`
8. Generate one HTML file per spine item via `chapter.js`
9. Generate `index.html` via `index.js`

#### `src/epub/parser.js`
Wraps the `epub` npm package. Exposes:
- `parseEpub(path)` → parsed epub object (promise)
- `getChapterContent(epub, id)` → raw HTML string (promise)
- `buildSpine(epub)` → ordered array of `{ id, href, mediaType }` from the spine

#### `src/epub/toc.js`
Extracts the table of contents. Tries in order:
1. `epub.toc` (already parsed by the `epub` package from NCX or nav)
2. Raw NCX XML fallback (`extractTocFromNcx`)
3. Raw nav.xhtml fallback (`extractTocFromNav`)

Returns a flat array of `{ label, href, level }` items; the level field enables the hierarchical sidebar tree.

#### `src/generator/assets.js`
Reads every item in the EPUB manifest and copies:
- Images → `images/`
- Fonts → `fonts/`
- CSS files → `styles/` (only when `--css original`)
- Cover image → root as `cover.<ext>` (extension taken from the manifest href to keep consistency with `getCoverExt()` in `convert.js`)

#### `src/generator/chapter.js`
Two responsibilities:

**`processChapterHtml(rawHtml, filename, epub)`** — cleans and rewrites the raw EPUB HTML:
- Removes EPUB-specific attributes (`epub:type`, `xml:lang`)
- Rewrites image `src` paths to `../images/<basename>`
- Rewrites internal cross-chapter links to the generated `ch-NNN.html` filenames

**`renderChapterPage(options)`** — wraps the processed HTML in the full reader shell (header, sidebar, progress bar, nav links, script tags). Injects `data-enriched-css-href` on `<body>` and the `CSS+` toggle button when enriched CSS is available.

#### `src/generator/index.js`
Renders the cover page (`index.html`) with the book's cover image (or a placeholder), title, author, description, and a "Start reading" link to `ch-001.html`.

#### `src/generator/extractEnrichedCss.js`
Extracts the book's original CSS and makes it safe to use alongside the reader stylesheet:

1. Reads all CSS files from the EPUB manifest
2. Removes comments, then tokenizes the CSS into top-level blocks using a character-level depth tracker (handles nested `{}` in `@media` correctly)
3. Filters out unsafe rules: `@font-face`, `@import`, `@charset`, `@namespace`, `@keyframes`, `@media print`, `@media amzn-*`
4. Filters out unsafe selectors: `body`, `html`, `*`, `:root` (these would interfere with the reader layout)
5. Prefixes every remaining selector with `.chapter-content` to scope all rules inside the content area only
6. Writes the result to `assets/enriched.css`

The output is a single CSS file that is safe to load on top of `reader.css` without breaking the reader UI.

#### `src/reader/reader.css`
Stylesheet for the reader shell. Uses CSS custom properties for theming (`[data-theme="dark"]` overrides the `:root` defaults). Key sections: header, progress bar, sidebar (sticky + resizable + responsive), TOC tree, chapter content typography, chapter navigation. The `scroll-margin-top` rule on `[id]` elements prevents the sticky header from covering anchor fragment targets when navigating via TOC links.

#### `src/reader/reader.js`
Self-contained IIFE that runs in the browser. Reads initial state from `localStorage` and `data-*` attributes on `<body>`, then sets up:

- **Theme** — applies saved theme on load; toggles between `light` and `dark`
- **Font size** — applies saved size on load; `A+`/`A−` step ±0.1rem within [0.8, 1.8]
- **TOC sidebar** — builds the hierarchical tree from `window.TOC` (injected by `toc.js`); handles expand/collapse toggles; auto-expands ancestors of the current chapter and scrolls it into view; restores saved width; responsive: fixed overlay on mobile
- **Sidebar resize** — drag handle on the right edge, saves width to `localStorage`
- **Progress bar** — filled proportionally to `chapterIndex / totalChapters`
- **Scroll persistence** — saves `scrollY` per chapter key on scroll; restores it on back/forward navigation (skipped on fresh `navigate` entries to always start at the top of a new chapter)
- **Enriched CSS toggle** — if `data-enriched-css-href` is set on `<body>`, shows the `CSS+` button; dynamically appends/removes a `<link>` to `enriched.css` on click; the browser caches the file across chapter navigations; state saved in `localStorage`

### Conversion workflow (step by step)

```
epub file
   │
   ▼
parseEpub()          parse manifest, spine, metadata, TOC
   │
   ▼
copyAssets()         extract images / fonts / (original CSS) to output dirs
   │
   ▼
extractEnrichedCss() parse + scope original CSS → assets/enriched.css
   │
   ▼
buildSpine()         ordered list of content documents
buildToc()           flat TOC with levels and hrefs
   │
   ▼
write toc.js         serialised TOC injected as window.TOC on every page
   │
   ▼
for each spine item:
  getChapterContent()      raw XHTML from EPUB
  processChapterHtml()     clean + rewrite paths + rewrite links
  renderChapterPage()      wrap in reader shell → chapters/ch-NNN.html
   │
   ▼
renderIndexPage()    cover page → index.html
```

### Key design decisions

- **No build step, no bundler (standard mode).** The reader JS and CSS are plain files copied as-is into `assets/`. Any change to `src/reader/` takes effect on the next conversion run.
- **Monolithic binary (optional).** For standalone deployment, Bun compiles the entire project (reader assets included) into a single 92 MB Linux binary via `npm run compile`. The `embeddedAssets.js` module embeds `reader.js` and `reader.css` as string constants so no source files are needed at runtime.
- **`toc.js` as a data bridge.** Rather than embedding TOC data in each chapter's HTML, a single `toc.js` file is loaded before `reader.js` and exposes `window.TOC`. This keeps chapter HTML lean and makes the TOC data easy to inspect.
- **Enriched CSS as a separate file, not inline.** Each chapter links to `../assets/enriched.css` dynamically rather than embedding the CSS inline. The browser caches the file after the first chapter, so subsequent chapter navigations incur no additional cost.
- **`scroll-margin-top` for anchor fragments.** TOC entries often point to `chapter.html#section-id`. The browser scrolls natively to the anchor before JS runs, which would place the target under the sticky header. The `[id] { scroll-margin-top }` rule corrects this without any JS intervention.
- **CSS scoping via selector prefixing.** The enriched CSS extractor does not use Shadow DOM or `@layer` — it simply prepends `.chapter-content` to every selector. This is universally supported, easy to debug, and avoids specificity surprises.
