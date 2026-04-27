#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const path = require('path');
const { convert } = require('../src/convert');

program
  .name('epub2site')
  .description('Converte un ebook EPUB in un sito statico locale')
  .version('1.0.0')
  .argument('<epub>', 'Percorso del file .epub')
  .argument('[output-dir]', 'Cartella di output (default: ./<titolo-libro>)')
  .option('--css <mode>', 'Modalità CSS: "custom" (default) o "original"', 'custom')
  .option('--open', 'Apre il sito nel browser dopo la generazione')
  .action(async (epubArg, outputArg, options) => {
    const epubPath = path.resolve(epubArg);
    const outputDir = outputArg ? path.resolve(outputArg) : null;

    if (!['custom', 'original'].includes(options.css)) {
      console.error('Errore: --css deve essere "custom" o "original"');
      process.exit(1);
    }

    try {
      const outDir = await convert(epubPath, outputDir, { css: options.css });

      if (options.open) {
        const indexPath = path.join(outDir, 'index.html');
        const { exec } = require('child_process');
        const cmd = process.platform === 'darwin' ? `open "${indexPath}"`
          : process.platform === 'win32' ? `start "" "${indexPath}"`
          : `xdg-open "${indexPath}"`;
        exec(cmd);
      }
    } catch (err) {
      console.error('Errore durante la conversione:', err.message);
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }
  });

program.parse();
