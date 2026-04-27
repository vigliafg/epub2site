'use strict';

const EPub = require('epub');

function parseEpub(epubPath) {
  return new Promise((resolve, reject) => {
    const epub = new EPub(epubPath);

    epub.on('end', () => {
      resolve(epub);
    });

    epub.on('error', reject);
    epub.parse();
  });
}

function getChapterContent(epub, chapterId) {
  return new Promise((resolve, reject) => {
    epub.getChapter(chapterId, (err, text) => {
      if (err) reject(err);
      else resolve(text || '');
    });
  });
}

function getChapterFile(epub, chapterId) {
  return new Promise((resolve, reject) => {
    epub.getFile(chapterId, (err, data, mimeType) => {
      if (err) reject(err);
      else resolve({ data, mimeType });
    });
  });
}

function buildSpine(epub) {
  return epub.spine.contents
    .filter(item => item.id && epub.manifest[item.id])
    .map((item, i) => {
      const manifest = epub.manifest[item.id];
      return {
        index: i,
        id: item.id,
        href: manifest.href,
        mediaType: manifest['media-type'] || 'application/xhtml+xml',
      };
    });
}

module.exports = { parseEpub, getChapterContent, getChapterFile, buildSpine };
