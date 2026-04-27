'use strict';

const path = require('path');
const cheerio = require('cheerio');

function getChapterNumber(chapterFilename) {
  const match = chapterFilename && chapterFilename.match(/\bch(\d+)\.xhtml/i);
  return match ? parseInt(match[1], 10) : null;
}

function buildImageMap(epub) {
  const map = new Map();
  const manifest = epub.manifest || {};

  Object.values(manifest).forEach(item => {
    if (!item.href || !item['media-type'] || !item['media-type'].startsWith('image/')) return;
    
    const basename = path.basename(item.href);
    const href = item.href;
    
    // Try multiple patterns: ch001x01.jpg, c001f001.jpg, icon01.jpg, etc.
    // Pattern 1: 001x01.jpg (chapter 1, figure 1) - e.g., 489x01.jpg
    let match = href.match(/\b(\d+)x(\d+)\.(jpg|png|gif|webp)/i);
    if (match) {
      addToImageMap(map, parseInt(match[1], 10), basename);
      return;
    }
    
    // Pattern 2: c001f001.jpg (chapter 001, figure 001) - e.g., c001f001.png
    match = href.match(/c(\d+)f(\d+)\.(jpg|png|gif|webp)/i);
    if (match) {
      addToImageMap(map, parseInt(match[1], 10), basename);
      return;
    }
    
    // Pattern 3: e.g., /ch001/ or /chapter001/ in path
    match = href.match(/\/(ch|chapter)(\d+)[\/._]/i);
    if (match) {
      addToImageMap(map, parseInt(match[2], 10), basename);
      return;
    }
    
    // If no pattern matched, add to chapter 0 (unmapped)
    addToImageMap(map, 0, basename);
  });

  return map;
}

function addToImageMap(map, chapterNum, basename) {
  if (!map.has(chapterNum)) map.set(chapterNum, []);
  map.get(chapterNum).push({ num: map.get(chapterNum).length + 1, basename });
}

function processChapterHtml(rawHtml, chapterFilename, epub, chapterIndex) {
  const $ = cheerio.load(rawHtml, { xmlMode: false });

  // Remove EPUB-specific attributes
  $('[epub\\:type]').removeAttr('epub:type');
  $('[xml\\:lang]').each((_, el) => {
    const lang = $(el).attr('xml:lang');
    $(el).removeAttr('xml:lang').attr('lang', lang);
  });

  const chapterNum = getChapterNumber(chapterFilename);
  const imageMap = buildImageMap(epub);
  const chapterImages = chapterNum && imageMap.has(chapterNum) ? imageMap.get(chapterNum) : [];

  // Track which img tag we're on (for sequential assignment)
  let imgCounter = 0;

  // Process img tags - assign src to those without it
  $('img').each((_, el) => {
    let currentSrc = $(el).attr('src') || '';

    // Handle alternative attribute names used by some EPUB generators
    // (when src is empty or not properly set)
    if (!currentSrc || !currentSrc.match(/^\.\//)) {
      const altSrc = $(el).attr('original-src') || 
                    $(el).attr('data-src') || 
                    $(el).attr('href') || '';
      
      // If found in alternative attribute and has content, use that
      if (altSrc) {
        currentSrc = altSrc;
      }
    }

    // Case 1: img has a valid src attribute (non-empty and not data:)
    if (currentSrc && !currentSrc.startsWith('data:')) {
      // Handle paths that don't start with http:// or https://
      if (!currentSrc.match(/^https?:/)) {
        $(el).attr('src', `../images/${path.basename(currentSrc)}`);
        return;
      }
      // External URL - try to extract filename
      const urlMatch = currentSrc.match(/\/([^\/]+)\.(jpg|png|gif|webp)/i);
      if (urlMatch) {
        $(el).attr('src', `../images/${urlMatch[1]}`);
      }
      return;
    }

    // Case 2: img has no src - try to find image by chapter number
    if (chapterImages.length > 0) {
      const imgData = chapterImages[imgCounter % chapterImages.length];
      if (imgData) {
        $(el).attr('src', `../images/${imgData.basename}`);
      }
      imgCounter++;
    }
  });

  // Also handle <object> elements with image data
  $('object[data]').each((_, el) => {
    const data = $(el).attr('data');
    if (data && !data.startsWith('http') && !data.startsWith('data:')) {
      $(el).attr('data', `../images/${path.basename(data)}`);
    }
  });

  // Rewrite internal cross-chapter links
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;

    const [filePart, fragment] = href.split('#');
    if (!filePart) return;

    const basename = path.basename(filePart);
    const spineEntry = findSpineEntryByHref(epub, basename);
    if (spineEntry) {
      const newHref = fragment ? `ch-${pad(spineEntry.index + 1)}.html#${fragment}` : `ch-${pad(spineEntry.index + 1)}.html`;
      $(el).attr('href', newHref);
    }
  });

  return $('body').html() || '';
}

function findSpineEntryByHref(epub, basename) {
  for (const item of epub.spine.contents) {
    const manifest = epub.manifest[item.id];
    if (manifest && path.basename(manifest.href) === basename) {
      return { index: epub.spine.contents.indexOf(item) };
    }
  }
  return null;
}

function pad(n) {
  return String(n).padStart(3, '0');
}

function renderChapterPage({ bookTitle, chapterTitle, chapterHtml, chapterIndex, totalChapters, cssMode, originalCssFiles, enrichedCssHref }) {
  const prevLink = chapterIndex > 0
    ? `<a href="ch-${pad(chapterIndex)}.html" class="nav-prev">&#8592; Precedente</a>`
    : `<span class="nav-prev nav-disabled"></span>`;

  const nextLink = chapterIndex < totalChapters - 1
    ? `<a href="ch-${pad(chapterIndex + 2)}.html" class="nav-next">Successivo &#8594;</a>`
    : `<span class="nav-next nav-disabled"></span>`;

  const originalCssLinks = cssMode === 'original' && originalCssFiles.length > 0
    ? originalCssFiles.map(f => `  <link rel="stylesheet" href="../styles/${path.basename(f)}">`).join('\n')
    : '';

  const enrichedAttr = enrichedCssHref ? ` data-enriched-css-href="${enrichedCssHref}"` : '';

  return `<!DOCTYPE html>
<html lang="it" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(chapterTitle)} — ${escHtml(bookTitle)}</title>
  <link rel="stylesheet" href="../assets/reader.css">
${originalCssLinks}
</head>
<body data-chapter-index="${chapterIndex}" data-chapter-total="${totalChapters}"${enrichedAttr}>
  <header class="reader-header">
    <button id="toggle-toc" aria-label="Apri indice">&#9776;</button>
    <span class="book-title">${escHtml(bookTitle)}</span>
    <div class="controls">
      <button id="font-down" aria-label="Riduci testo">A&#8722;</button>
      <button id="font-up" aria-label="Aumenta testo">A+</button>
      <button id="toggle-enriched" aria-label="CSS arricchito" title="Attiva/disattiva stile arricchito" style="display:none">CSS+</button>
      <button id="toggle-theme" aria-label="Cambia tema">&#9680;</button>
    </div>
  </header>
  <div class="progress-bar" role="progressbar" aria-valuenow="${chapterIndex + 1}" aria-valuemin="1" aria-valuemax="${totalChapters}">
    <div class="progress-fill"></div>
  </div>
  <div class="reader-layout">
    <nav class="sidebar" id="toc-sidebar" aria-label="Indice del libro"></nav>
    <main id="content" class="chapter-content">
      ${chapterHtml}
    </main>
  </div>
  <nav class="chapter-nav" aria-label="Navigazione capitoli">
    ${prevLink}
    ${nextLink}
  </nav>
  <script src="../assets/toc.js"></script>
  <script>window.CURRENT_CHAPTER = ${chapterIndex}; window.TOC_PATH_PREFIX = '../';</script>
  <script src="../assets/reader.js"></script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { processChapterHtml, renderChapterPage, pad, escHtml, getChapterNumber, buildImageMap };
