# Mandarin Study Companion (GitHub Pages)

This repo is designed to be hosted at:
- https://z1fire.github.io/week/

## Structure
- `index.md` : homepage — study progress dashboard (streak, mastered count, per-week bars) + week grid
- `week/week1.md` ... `week/week12.md` : week pages (quizzes, flashcards, writing practice, worksheets, reading)
- `assets/data/week01.json` ... `week12.json` : vocab
- `assets/readings/week01.txt` + `week01_en.txt` : reading lines + English translations
- `all.md` + `assets/readings/all.txt` : all-weeks vocabulary quiz page
- `all/all-weeks.md` : combined story using vocab from every week (`_layouts/story.html`)
- `all/week1.md` ... `week12.md` : per-week story pages (`_layouts/story.html`)
- `assets/js/progress.js` : localStorage-based mastery/streak/quiz-history tracker, shared across all pages via `window.Progress`

## Updating
- Replace vocab: edit `assets/data/weekXX.json`
- Replace reading: edit `assets/readings/weekXX.txt` and optionally `weekXX_en.txt`
- Add all-weeks stories: edit `assets/readings/all.txt` and optionally `all_en.txt`

## YouTube links
Each week JSON has `"youtube": "#"`. Replace with your actual link when ready.
