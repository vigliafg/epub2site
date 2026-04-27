'use strict';

const path = require('path');
const fse = require('fs-extra');

async function copyAssets(epub, outputDir, cssMode) {
  const manifest = epub.manifest;
  const imageDir = path.join(outputDir, 'images');
  const fontDir = path.join(outputDir, 'fonts');
  const stylesDir = path.join(outputDir, 'styles');

  await fse.ensureDir(imageDir);
  await fse.ensureDir(fontDir);
  if (cssMode === 'original') await fse.ensureDir(stylesDir);

  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
  const fontTypes = ['font/otf', 'font/ttf', 'font/woff', 'font/woff2',
    'application/font-sfnt', 'application/font-woff', 'application/vnd.ms-fontobject'];

  const tasks = Object.values(manifest).map(item => {
    const mime = (item['media-type'] || '').toLowerCase();
    const filename = path.basename(item.href || '');
    if (!filename) return Promise.resolve(null);

    let destDir = null;
    if (imageTypes.some(t => mime.startsWith(t.split('/')[0]) && mime.includes(t.split('/')[1]))) {
      destDir = imageDir;
    } else if (fontTypes.includes(mime)) {
      destDir = fontDir;
    } else if (mime === 'text/css' && cssMode === 'original') {
      destDir = stylesDir;
    }

    if (!destDir) return Promise.resolve(null);

    return new Promise((resolve) => {
      epub.getFile(item.id, (err, data) => {
        if (err || !data) return resolve(null);
        fse.writeFile(path.join(destDir, filename), data).then(resolve).catch(resolve);
      });
    });
  });

  await Promise.all(tasks);

  // Copy cover image to root if present
  const coverId = epub.metadata.cover;
  if (coverId && manifest[coverId]) {
    await new Promise((resolve) => {
      epub.getFile(coverId, (err, data, mime) => {
        if (err || !data) return resolve();
        const hrefExt = (manifest[coverId].href || '').split('.').pop().toLowerCase();
        const ext = (hrefExt === 'jpg' || hrefExt === 'jpeg' || hrefExt === 'png')
          ? hrefExt
          : (mime ? mime.split('/')[1] : 'jpg');
        fse.writeFile(path.join(outputDir, `cover.${ext}`), data).then(resolve).catch(resolve);
      });
    });
  }
}

module.exports = { copyAssets };
