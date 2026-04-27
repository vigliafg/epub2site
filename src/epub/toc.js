'use strict';

const cheerio = require('cheerio');

function extractTocFromNcx(ncxXml) {
  const $ = cheerio.load(ncxXml, { xmlMode: true });
  const items = [];

  $('navPoint').each((_, el) => {
    const label = $(el).children('navLabel').find('text').first().text().trim();
    const href = $(el).children('content').attr('src') || '';
    if (label) items.push({ label, href });
  });

  return items;
}

function extractTocFromNav(navXhtml) {
  const $ = cheerio.load(navXhtml, { xmlMode: false });
  const items = [];

  $('nav[epub\\:type="toc"], nav[role="doc-toc"], nav').first().find('a').each((_, el) => {
    const label = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (label) items.push({ label, href });
  });

  return items;
}

function buildToc(epub) {
  const toc = [];

  if (epub.toc && epub.toc.length > 0) {
    for (const item of epub.toc) {
      toc.push({
        label: item.title || item.id || '',
        href: item.href || '',
        id: item.id || '',
        level: item.level || 0,
      });
    }
    return toc;
  }

  // Fallback: use NCX if available
  const ncxId = Object.keys(epub.manifest).find(
    id => (epub.manifest[id]['media-type'] || '').includes('ncx')
  );
  if (ncxId) {
    return extractTocFromNcx;  // caller must fetch the file
  }

  // Fallback: use nav.xhtml if available
  const navId = Object.keys(epub.manifest).find(
    id =>
      (epub.manifest[id].properties || '').includes('nav') ||
      (epub.manifest[id].href || '').endsWith('nav.xhtml')
  );
  if (navId) {
    return extractTocFromNav;  // caller must fetch the file
  }

  return toc;
}

module.exports = { buildToc, extractTocFromNcx, extractTocFromNav };
