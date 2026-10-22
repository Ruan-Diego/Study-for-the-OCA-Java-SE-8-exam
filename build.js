// Builds index.html from src/: inlines the parser, the flashcards and PDF.js (so the page works offline).
// Usage: npm install && npm run build
const fs = require('fs');
const path = require('path');
const read = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
const pdfjs = 'node_modules/pdfjs-dist/build/';
const html = read('src/app.html')
  .replace('/*PARSER*/', () => read('src/parser.js'))
  .replace('/*CARDS*/', () => read('src/cards.js'))
  .replace('/*PDFWORKER*/', () => read(pdfjs + 'pdf.worker.min.js'))
  .replace('/*PDFLIB*/', () => read(pdfjs + 'pdf.min.js'));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html written (' + Math.round(html.length / 1024) + ' KB)');
