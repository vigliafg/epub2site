'use strict';

const SKIP_AT = /^@(font-face|import|charset|namespace|keyframes|-webkit-keyframes|-moz-keyframes)/i;
const SKIP_MEDIA = /^@media\s+(amzn-|print\b)/i;
const UNSAFE_SEL = /^(html|body|\*|:root)(\s|:|,|$)/;

function scopeSelectors(str, scope) {
  return str.split(',').map(s => {
    s = s.trim();
    if (!s || UNSAFE_SEL.test(s)) return '';
    return `${scope} ${s}`;
  }).filter(Boolean).join(', ');
}

function parseBlocks(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const blocks = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    if (i >= n) break;
    const start = i;
    while (i < n && css[i] !== '{' && css[i] !== ';') i++;
    if (i >= n) break;
    if (css[i] === ';') { i++; continue; }
    const header = css.slice(start, i).trim();
    i++;
    let depth = 1;
    const bodyStart = i;
    while (i < n && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    const body = css.slice(bodyStart, i - 1);
    blocks.push(header.startsWith('@')
      ? { type: 'at', header, body }
      : { type: 'rule', selector: header, body });
  }
  return blocks;
}

function processBlocks(blocks, scope) {
  const out = [];
  for (const b of blocks) {
    if (b.type === 'at') {
      if (SKIP_AT.test(b.header) || SKIP_MEDIA.test(b.header)) continue;
      if (/^@media\b/i.test(b.header)) {
        const inner = processBlocks(parseBlocks(b.body), scope);
        if (inner.trim()) out.push(`${b.header} {\n${inner}\n}`);
      }
    } else {
      const scoped = scopeSelectors(b.selector, scope);
      if (scoped && b.body.trim()) out.push(`${scoped} {\n${b.body.trim()}\n}`);
    }
  }
  return out.join('\n');
}

async function extractEnrichedCss(epub) {
  const items = Object.values(epub.manifest)
    .filter(m => (m['media-type'] || '').toLowerCase().includes('css'));
  if (!items.length) return '';

  const texts = await Promise.all(items.map(item =>
    new Promise(resolve => {
      epub.getFile(item.id, (err, data) =>
        resolve(!err && data ? data.toString('utf8') : ''));
    })
  ));

  return texts
    .map(css => processBlocks(parseBlocks(css), '.chapter-content'))
    .filter(s => s.trim())
    .join('\n\n');
}

module.exports = { extractEnrichedCss };
