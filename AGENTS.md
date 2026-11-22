# AGENTS.md — Mini Games

## What this is

A static site of small 3D browser games in Chinese and English; a result is shared to X.
Plain HTML, CSS and ES modules plus a vendored three.js r149. No build step, no package
manager, no backend: the files in the repository are the site.

## Architecture map

```
site.config.js      # site name, published origin, X account, season length: the only place these are written
catalog.js          # published games, oldest first; number and season are derived from the position
index.html, home.js, home.css   # the list of games and the season progress
kit/                # code shared by every game
  gamepage.js       # page frame: title card, result card, share and follow links (openGamePage)
  l10n.js           # say({ zh, en }) and the language switch
  clock.js          # game time in seconds (createClock, everyFrame); can be driven by hand in tests
  stage3d.js        # WebGL view that lowers its own resolution on slow devices
  sound.js          # synthesized sound
  share.js          # X post, follow and profile links
  telemetry.js      # record(name, detail) and isLocal
  vendor/           # three.min.js, loaded as a classic script that sets window.THREE
g/<slug>/           # one game; its address is also the address that gets shared
  index.html        # page head, og tags, the empty #game element
  rules.js          # the rules as plain functions, no drawing
  scene.js          # the 3D picture
  main.js           # input, round state, sound, texts, window.gameTest
  <slug>.css, cover.webp
```

`g/fill/` is the reference game.

## Ground rules (conventions)

- **Imports:** relative paths with the `.js` extension. Nothing is loaded from a CDN;
  third-party code goes in `kit/vendor/` with its licence.
- **Texts:** every text a player sees is `say({ zh: "…", en: "…" })` with both languages
  (`kit/l10n.js`).
- **Site-wide values:** read them from `site.config.js`. The one copy outside it is the absolute
  `og:url` and `og:image` in each `g/<slug>/index.html`; change them together with `origin`.
- **Catalog order:** add a game at the end of `published` in `catalog.js`. Reordering or inserting
  changes the number and season of every later game.
- **Rules are separate from the picture:** `rules.js` has no DOM, no three.js and no clock. Outcomes
  are computed from game time, not counted per frame, so they are the same at any frame rate
  (`g/fill/rules.js`, `g/mine/rules.js`).
- **Time:** game time comes from `createClock()`; the time of an input is `clock.timeOf(event)`.
  Games do not call `Date.now()` or `performance.now()`.
- **Sound:** synthesized through `kit/sound.js` (`ping`, `noiseSource`, `soundOut`). No audio files.
- **Analytics:** events go through `record()` in `kit/telemetry.js`, which reports nothing on localhost.
- **Storage:** wrap every `localStorage` call in `try`/`catch`; private mode throws
  (`kit/l10n.js`, `stored()` and `store()` in `g/mine/main.js`).
- **Page frame:** `openGamePage()` returns `null` when the game is framed by another site, so a
  game starts with `if (page) start();`.
- **Test hook:** on localhost or with `?test`, a game sets `window.gameTest` with at least
  `snapshot()` and `advance(seconds)`.
- **Git workflow:** GitHub Pages publishes the root of `main`, so a push to `main` is a release.
  Unfinished work stays on another branch.

## Where new code goes

- **A new game:** a new `g/<slug>/` with the same files as `g/fill/`, plus one entry at the end of
  `published` in `catalog.js`. Steps: `.agents/references/new-game.md`.
- **Code a second game needs:** move it to `kit/`. Code only one game uses stays in `g/<slug>/`.
- **A shared 3D helper** (lights, camera framing): `kit/stage3d.js`, next to `addDaylight`.
- **A site-wide setting:** a field of `site` in `site.config.js`.
- **A new analytics event:** a `record("name", { game: SLUG, … })` call; no direct `gtag`.
- **A new shared sound primitive:** `kit/sound.js`; a game's own sounds are built in its `main.js`.

## Working principles (agent steering)

- **Verify:** before handing over a game, play it from the title card to the result card in a
  real browser with real input, in a phone-sized portrait view and on desktop. Jumping ahead with
  `window.gameTest` does not count as this check.
- **Design calls:** decide gameplay, feel and look yourself, as a senior game producer would. Ask
  only when a choice changes the direction of the product.
- **Simplest thing:** add no framework, build tool or dependency unless the owner has agreed to it.
- **Plan first:** small changes are done directly. For a new game or a change to shared code in
  `kit/`, show the plan and wait for agreement before writing code.

## Commands

- run: `python3 -m http.server 8741`, then http://localhost:8741/ (ES modules do not load from `file://`)
- install, lint, type-check, test: none exist. A game is checked in a browser through
  `window.gameTest`: `.agents/references/checking-a-game.md`.

## On-demand context

- Adding a game → `.agents/references/new-game.md`
- Checking a game from a script, making a cover image → `.agents/references/checking-a-game.md`
- What is not built yet → "Not done yet" in `README.md`
