# Mini Games

A static site of small 3D browser games in Chinese and English. Results are shared to X.
There is no build step: the files are served as they are.

## Run it locally

```bash
python3 -m http.server 8741
```

- List of games: http://localhost:8741/
- First game: http://localhost:8741/g/fill/
- Second game: http://localhost:8741/g/mine/

Open it through a server; the pages use ES modules and do not work from `file://`.

## Layout

| Path | What it is |
| --- | --- |
| `site.config.js` | Site name, domain, X account, games per season. The only place these are written. |
| `catalog.js` | Published games, oldest first. Season and number are derived from the position. |
| `index.html`, `home.js`, `home.css` | The list of games and the season progress. |
| `kit/` | Code shared by every game: page frame, languages, share links, clock, sound, 3D stage. |
| `kit/vendor/` | three.js r149 (MIT, licence in `three.LICENSE`), served from the site itself. |
| `g/<slug>/` | One game. The address of the game is also the address that gets shared. |

## A game

`g/fill/` is the reference for the next ones:

- `index.html` — page head and the empty `#game` element.
- `rules.js` — the rules as plain functions, no drawing.
- `scene.js` — the 3D picture.
- `main.js` — input, round state, sound, texts.
- `cover.webp` — 600×600 picture for the list, without any interface on it.

Texts are written as `say({ zh: "…", en: "…" })`. The language comes from `?lang=`, then the
last choice, then the browser (Chinese browsers get Chinese, everyone else English).

## Checking a game from a script

On localhost, or with `?test` in the address, a game exposes `window.gameTest`:

- `snapshot()` — the current round.
- `advance(seconds)` — move game time by hand (real time stops driving the game after this).
- `press()` / `letGo()` — the player's input.
- `settle(level, { duck })` — end the round at a given water level.
- `cover()` — a clean mid-pour picture for the cover image.

## Not done yet

- The site is published with GitHub Pages at https://jinjing186118.github.io/minigames/ until a
  domain is chosen. Moving it means changing `origin` in `site.config.js` and the `og:url` /
  `og:image` tags in each game page. Site name and slogan are still placeholders.
- Play counts, analytics (events are collected by `kit/telemetry.js` but sent nowhere
  without `gtag`), search, season filter and season recap page.
- A script that creates a new game from a template.
