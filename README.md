# Study-for-the-OCA-Java-SE-8-exam

A single-page study app for the **Oracle Certified Associate, Java SE 8 Programmer I (1Z0-808)** exam.

- **Practice:** answer the review questions by chapter and see the explanation right away.
- **Mock exam:** 20, 40, 70 or all questions, timed like the real exam (70 questions / 150 min), pass mark 65%.
- **Flashcards:** 118 original concept cards covering exam traps, plus the book's questions as flip cards, with simple spaced review.
- **Progress:** accuracy per chapter and mastered flashcards.

## How it works

The questions are **not** included in this repository. The first time you open the app, you load your own PDF of
*OCA: Oracle Certified Associate Java SE 8 Programmer I Study Guide (Sybex, exam 1Z0-808)*. The PDF is read
in the browser (nothing is uploaded), and the app extracts the review questions together with the answers and
explanations from Appendix A. The question bank and your progress are stored in the browser's `localStorage`.

## Usage

Open `index.html` in Chrome, Edge or Firefox, or host it on any static host (Vercel, Netlify, GitHub Pages).
It has no dependencies at runtime and works offline.

## Project structure

| Path | What it is |
| --- | --- |
| `index.html` | The built app (everything inlined) |
| `src/app.html` | UI, styles and app logic (template with placeholders) |
| `src/parser.js` | Extracts questions, options, answers and explanations from the PDF text (via PDF.js) |
| `src/cards.js` | The concept flashcards |
| `build.js` | Inlines `src/` and PDF.js into `index.html` |

## Building

```bash
npm install
npm run build
```

## Credits

PDF reading by [PDF.js](https://github.com/mozilla/pdf.js) (Mozilla, Apache License 2.0), bundled into `index.html`.
