'use strict';

const path = require('path');
const fse = require('fs-extra');
const cheerio = require('cheerio');
const { parseEpub, getChapterContent, buildSpine } = require('./epub/parser');
const { buildToc } = require('./epub/toc');
const { copyAssets } = require('./generator/assets');
const { processChapterHtml, renderChapterPage, pad } = require('./generator/chapter');
const { renderIndexPage } = require('./generator/index');
const { extractEnrichedCss } = require('./generator/extractEnrichedCss');

async function convert(epubPath, outputDir, options = {}) {
  const cssMode = options.css || 'custom';

  console.log(`Analisi EPUB: ${path.basename(epubPath)}`);
  const epub = await parseEpub(epubPath);

  const bookTitle = epub.metadata.title || path.basename(epubPath, '.epub');
  const author = epub.metadata.creator || epub.metadata.author || '';
  const description = epub.metadata.description || '';
  const coverExt = getCoverExt(epub);

  const resolvedOutput = outputDir || path.join(process.cwd(), slugify(bookTitle));
  console.log(`Output: ${resolvedOutput}`);

  await fse.ensureDir(resolvedOutput);
  await fse.ensureDir(path.join(resolvedOutput, 'assets'));
  await fse.ensureDir(path.join(resolvedOutput, 'chapters'));

  // Copy static reader assets
  await fse.copy(
    path.join(__dirname, 'reader', 'reader.js'),
    path.join(resolvedOutput, 'assets', 'reader.js')
  );
  if (cssMode === 'custom') {
    await fse.copy(
      path.join(__dirname, 'reader', 'reader.css'),
      path.join(resolvedOutput, 'assets', 'reader.css')
    );
  } else {
    // Minimal CSS shell for layout when using original CSS
    await fse.copy(
      path.join(__dirname, 'reader', 'reader.css'),
      path.join(resolvedOutput, 'assets', 'reader.css')
    );
  }

  // Copy images, fonts, original CSS
  console.log('Estrazione asset...');
  await copyAssets(epub, resolvedOutput, cssMode);

  // Extract and write enriched CSS (scoped original CSS for the toggle feature)
  const enrichedCssText = await extractEnrichedCss(epub);
  const enrichedCssHref = enrichedCssText ? '../assets/enriched.css' : '';
  if (enrichedCssText) {
    await fse.writeFile(path.join(resolvedOutput, 'assets', 'enriched.css'), enrichedCssText, 'utf8');
  }

  // Build spine and TOC
  const spine = buildSpine(epub);
  const tocData = buildToc(epub);

  // Map TOC href → spine index for link rewriting
  const hrefToSpineIndex = {};
  spine.forEach((s, i) => {
    hrefToSpineIndex[path.basename(s.href)] = i;
  });

  // Pre-fetch raw HTML for all spine items (needed for title fallback)
  const rawHtmlMap = {};
  await Promise.all(spine.map(async (s) => {
    try { rawHtmlMap[s.id] = await getChapterContent(epub, s.id); } catch (_) { rawHtmlMap[s.id] = ''; }
  }));

  // Build chapters list with resolved titles
  const chaptersMeta = spine.map((s, i) => {
    const tocEntry = tocData.find(t => path.basename(t.href || '').split('#')[0] === path.basename(s.href));
    let title = tocEntry && tocEntry.label;
    if (!title) {
      // Fallback: extract first heading or <title> from HTML content
      title = extractTitleFromHtml(rawHtmlMap[s.id] || '');
    }
    return {
      id: s.id,
      href: s.href,
      title: title || `Capitolo ${i + 1}`,
    };
  });

  // Get original CSS file names for inclusion
  const originalCssFiles = cssMode === 'original'
    ? Object.values(epub.manifest)
        .filter(m => (m['media-type'] || '').includes('css'))
        .map(m => m.href)
    : [];

  // Build full TOC tree (all items with levels, hrefs rewritten to root-relative)
  const tocTree = tocData
    .map(item => {
      const [filePart, fragment] = (item.href || '').split('#');
      const basename = path.basename(filePart || '');
      const spineIdx = hrefToSpineIndex[basename];
      if (spineIdx === undefined) return null;
      const chapterFile = `chapters/ch-${pad(spineIdx + 1)}.html`;
      return {
        title: item.label,
        href: fragment ? `${chapterFile}#${fragment}` : chapterFile,
        level: item.level || 0,
        chapterIndex: spineIdx,
      };
    })
    .filter(Boolean);

  // Write toc.js (hrefs are root-relative: "chapters/ch-NNN.html")
  const tocJs = `window.TOC = ${JSON.stringify({
    title: bookTitle,
    author,
    total: spine.length,
    chapters: chaptersMeta.map((ch, i) => ({
      index: i,
      id: `ch-${pad(i + 1)}`,
      title: ch.title,
      href: `chapters/ch-${pad(i + 1)}.html`,
    })),
    tree: tocTree,
  }, null, 2)};`;
  await fse.writeFile(path.join(resolvedOutput, 'assets', 'toc.js'), tocJs, 'utf8');

  // Generate chapter pages
  console.log(`Generazione ${spine.length} capitoli...`);
  for (let i = 0; i < spine.length; i++) {
    const spineItem = spine[i];
    const rawHtml = rawHtmlMap[spineItem.id] || '';

    const processedHtml = processChapterHtml(rawHtml, spineItem.href, epub);
    const chapterHtml = renderChapterPage({
      bookTitle,
      chapterTitle: chaptersMeta[i].title,
      chapterHtml: processedHtml,
      chapterIndex: i,
      totalChapters: spine.length,
      cssMode,
      originalCssFiles,
      enrichedCssHref,
    });

    const outFile = path.join(resolvedOutput, 'chapters', `ch-${pad(i + 1)}.html`);
    await fse.writeFile(outFile, chapterHtml, 'utf8');

    if ((i + 1) % 10 === 0 || i + 1 === spine.length) {
      process.stdout.write(`  ${i + 1}/${spine.length}\r`);
    }
  }
  console.log('');

  // Generate index.html
  const indexHtml = renderIndexPage({ bookTitle, author, description, coverExt, chapters: chaptersMeta });
  await fse.writeFile(path.join(resolvedOutput, 'index.html'), indexHtml, 'utf8');

  console.log(`\nFatto! Apri: ${path.join(resolvedOutput, 'index.html')}`);
  return resolvedOutput;
}

function getCoverExt(epub) {
  const coverId = epub.metadata.cover;
  if (!coverId || !epub.manifest[coverId]) return null;
  const item = epub.manifest[coverId];
  if (item && item.href) {
    const ext = item.href.split('.').pop().toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') return ext;
  }
  const mime = item['media-type'] || '';
  return mime.includes('jpeg') ? 'jpeg' : mime.includes('png') ? 'png' : null;
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ebook';
}

function extractTitleFromHtml(html) {
  if (!html) return '';
  try {
    const $ = cheerio.load(html);
    const fromTitle = $('title').first().text().trim();
    if (fromTitle) return fromTitle;
    for (const tag of ['h1', 'h2', 'h3']) {
      const text = $(tag).first().text().trim();
      if (text) return text;
    }
  } catch (_) {}
  return '';
}

module.exports = { convert };
