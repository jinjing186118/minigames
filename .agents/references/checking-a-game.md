# Checking a game from a script

Read this when a game's rules, input or result card change, or when a cover image is needed.

Serve the site (`python3 -m http.server 8741`) and open the game in a real browser tab. On
localhost, or with `?test` in the address, the game exposes `window.gameTest`:

- `snapshot()`: the current round.
- `advance(seconds)`: move game time by hand. Real time stops driving the game after this.
- `press()` / `letGo()` in `g/fill/`: the player's input.
- `settle(level, { duck })` in `g/fill/`: end the round at a given water level.
- `swing(times)`, `reseed(value)`, `plant(kind)` in `g/mine/`: swing the pick, restart the random sequence, place a special block.
- `cover()`: a clean picture without any text, for `cover.webp`.

`g/mine/` takes `?seed=<number>` so a round is the same every time.

Each game has its own extra tools; read `testTools()` at the end of its `main.js` before
writing a script. Analytics events of the visit are in `recorded`, exported by `kit/telemetry.js`.
