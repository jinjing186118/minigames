# Adding a game

Read this when the task is a new game. `g/fill/` is the reference.

1. Copy the file layout of `g/fill/` to `g/<slug>/`: `index.html`, `rules.js`, `scene.js`,
   `main.js`, `<slug>.css`, `cover.webp`.
2. In `index.html`, set the title, description and the `og:` tags. `og:url` and `og:image` are
   absolute addresses built from `origin` in `site.config.js`. Keep the two script tags in this
   order: `kit/vendor/three.min.js`, then `./main.js` as a module.
3. Write the rules in `rules.js` as functions of game time. Draw in `scene.js`. Keep input, round
   state, sound and texts in `main.js`, and open the page with `openGamePage(SLUG, { onPlay, onRetry })`.
4. End a round with `page.showResult({ headline, caption, shareText })` and record `play`,
   `replay` and `result` events with `record()`.
5. Expose `window.gameTest` (see `checking-a-game.md`) and use its `cover()` to make
   `cover.webp`: 600×600, no interface on it.
6. Add the game at the end of `published` in `catalog.js` with `slug`, `released`, `name` and
   `pitch` in both languages.
7. Add the game's local address to "Run it locally" in `README.md`.
