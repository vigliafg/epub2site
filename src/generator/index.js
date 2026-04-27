'use strict';

const { escHtml } = require('./chapter');

function renderIndexPage({ bookTitle, author, description, coverExt, chapters }) {
  const coverSrc = coverExt ? `cover.${coverExt}` : '';
  const coverHtml = coverSrc
    ? `<img src="${coverSrc}" alt="Copertina di ${escHtml(bookTitle)}" class="cover-img">`
    : `<div class="cover-placeholder"><span>${escHtml(bookTitle)}</span></div>`;

  const descriptionHtml = description
    ? `<div class="book-description">${description}</div>`
    : '';

  const startHref = chapters.length > 0 ? 'chapters/ch-001.html' : '#';

  return `<!DOCTYPE html>
<html lang="it" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(bookTitle)}</title>
  <link rel="stylesheet" href="assets/reader.css">
  <style>
    .cover-hero {
      min-height: calc(100vh - 48px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      padding: 3rem 2rem;
      text-align: center;
    }
    .cover-img {
      max-height: calc(100vh - 220px);
      max-width: 100%;
      width: auto;
      border-radius: 6px;
      box-shadow: 0 8px 32px rgba(0,0,0,.25);
      display: block;
    }
    .cover-placeholder {
      width: 180px;
      height: 260px;
      background: var(--color-accent);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      box-shadow: 0 8px 32px rgba(0,0,0,.25);
    }
    .cover-placeholder span {
      color: #fff;
      font-size: 1.1rem;
      font-weight: 700;
      text-align: center;
      line-height: 1.4;
    }
    .book-meta h1 {
      font-size: 1.8rem;
      margin: 0 0 .3rem;
      line-height: 1.2;
    }
    .book-meta .author {
      color: var(--color-muted);
      font-size: 1rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
    }
    .book-description {
      max-width: 500px;
      font-size: .9rem;
      color: var(--color-muted);
      line-height: 1.6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
    }
    .start-reading {
      display: inline-block;
      padding: .75rem 2rem;
      background: var(--color-accent);
      color: #fff !important;
      border-radius: 5px;
      text-decoration: none;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 1rem;
      transition: opacity .15s;
    }
    .start-reading:hover { opacity: .85; }
  </style>
</head>
<body data-chapter-index="-1" data-chapter-total="${chapters.length}">
  <header class="reader-header">
    <button id="toggle-toc" aria-label="Apri indice">&#9776;</button>
    <span class="book-title">${escHtml(bookTitle)}</span>
    <div class="controls">
      <button id="font-down" aria-label="Riduci testo">A&#8722;</button>
      <button id="font-up" aria-label="Aumenta testo">A+</button>
      <button id="toggle-theme" aria-label="Cambia tema">&#9680;</button>
    </div>
  </header>
  <div class="reader-layout">
    <nav class="sidebar" id="toc-sidebar" aria-label="Indice del libro"></nav>
    <main id="content" class="chapter-content">
      <div class="cover-hero">
        ${coverHtml}
        <div class="book-meta">
          <h1>${escHtml(bookTitle)}</h1>
          ${author ? `<p class="author">${escHtml(author)}</p>` : ''}
        </div>
        ${descriptionHtml}
        <a href="${startHref}" class="start-reading">Inizia a leggere &#8594;</a>
      </div>
    </main>
  </div>
  <script src="assets/toc.js"></script>
  <script>window.CURRENT_CHAPTER = -1; window.TOC_PATH_PREFIX = '';</script>
  <script src="assets/reader.js"></script>
</body>
</html>`;
}

module.exports = { renderIndexPage };
