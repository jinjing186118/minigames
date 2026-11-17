// Fill It to the Brim: hold to pour, let go to stop. One pour per round.
import { openGamePage } from "../../kit/gamepage.js";
import { createStage3D } from "../../kit/stage3d.js";
import { createClock, everyFrame } from "../../kit/clock.js";
import { say } from "../../kit/l10n.js";
import { record, isLocal } from "../../kit/telemetry.js";
import { soundOut, ping, noiseSource } from "../../kit/sound.js";
import * as rules from "./rules.js";
import { createPourScene } from "./scene.js";

const SLUG = "fill";
const FLOOD_SECONDS = 2.2;
const RESULT_KEY_DELAY = 0.4; // a key still held from the pour must not restart the round

const clock = createClock();
const round = { number: 0 };
let wideShot = false; // cover images keep the whole scene in frame
resetRound("title");

function resetRound(phase) {
  Object.assign(round, {
    phase, // "title" → "pour" → ("flood" →) "done"
    pressedAt: null,
    releasedAt: null,
    levelAtRelease: 0,
    flowAtRelease: 0,
    floodAt: null,
    flowAtFlood: 0,
    level: 0,
    flow: 0,
    outcome: null,
    gap: 0,
    doneAt: null,
    duck: false,
  });
}

const page = openGamePage(SLUG, { onPlay: beginRound, onRetry: beginRound });
if (page) start();

function beginRound() {
  resetRound("pour");
  round.duck = Math.random() < rules.DUCK_ODDS;
  round.number += 1;
  record(round.number === 1 ? "play" : "replay", { game: SLUG, round: round.number });
}

/* ---- input ---- */

function press(event) {
  if (round.phase !== "pour" || round.pressedAt !== null) return;
  round.pressedAt = clock.timeOf(event);
}

function letGo(event) {
  if (round.phase !== "pour" || round.pressedAt === null || round.releasedAt !== null) return;
  round.releasedAt = Math.max(round.pressedAt, clock.timeOf(event));
  const held = rules.whileHolding(round.releasedAt - round.pressedAt);
  round.levelAtRelease = held.level;
  round.flowAtRelease = held.flow;
}

function listen() {
  const { view } = page;
  view.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    view.setPointerCapture(event.pointerId);
    press(event);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) view.addEventListener(type, letGo);
  addEventListener("blur", letGo);

  const pourKey = (event) => event.code === "Space" || event.code === "Enter";
  const onControl = (event) => event.target instanceof Element && event.target.closest("a, button");
  addEventListener("keydown", (event) => {
    if (!pourKey(event) || onControl(event)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (round.phase === "done") {
      if (clock.time - round.doneAt > RESULT_KEY_DELAY) page.retry();
    } else press(event);
  });
  addEventListener("keyup", (event) => {
    if (pourKey(event)) letGo(event);
  });
}

/* ---- rules over time ---- */

function update() {
  const now = clock.time;
  if (round.phase === "pour" && round.pressedAt !== null) {
    if (round.releasedAt === null) {
      Object.assign(round, rules.whileHolding(Math.max(0, now - round.pressedAt)));
    } else {
      const after = rules.afterLettingGo(round.levelAtRelease, round.flowAtRelease, Math.max(0, now - round.releasedAt));
      round.level = after.level;
      round.flow = after.flow;
      if (after.still && !rules.overflows(round.level)) finish(rules.judge(round.level));
    }
    if (round.phase === "pour" && rules.overflows(round.level)) {
      round.phase = "flood";
      round.floodAt = now;
      round.flowAtFlood = round.flow;
      splashSound();
    }
  } else if (round.phase === "flood") {
    const since = now - round.floodAt;
    round.flow = Math.max(0, round.flowAtFlood - rules.TAPER * since);
    if (since >= FLOOD_SECONDS) finish("flood");
  }
}

function finish(outcome) {
  round.phase = "done";
  round.outcome = outcome;
  round.flow = 0;
  round.gap = rules.gapToBrim(round.level);
  round.doneAt = clock.time;
  if (outcome !== "flood") doneSound();
  record("result", { game: SLUG, outcome, duck: round.duck, round: round.number });
  page.showResult(resultTexts());
}

function resultTexts() {
  const mm = round.gap.toFixed(2);
  const duckLine = round.duck
    ? say({ zh: "，杯子里还漂着一只鸭子", en: ", with a duck floating in the glass" })
    : "";
  const tag = say({ zh: " #倒满", en: " #FillItToTheBrim" });
  const texts = {
    short: {
      headline: `${mm} mm`,
      caption: say({ zh: "离杯口还差这么多", en: "below the brim" }),
      share: say({ zh: `倒到离杯口只差 ${mm}mm`, en: `Poured to ${mm}mm below the brim` }),
    },
    dome: {
      headline: `+${mm} mm`,
      caption: say({ zh: "高出杯口，表面张力撑住了", en: "above the brim, held by surface tension" }),
      share: say({
        zh: `水面高出杯口 ${mm}mm，表面张力撑住了`,
        en: `${mm}mm above the brim, held by surface tension`,
      }),
    },
    flood: {
      headline: say({ zh: "溢出了", en: "Spilled" }),
      caption: say({ zh: "水漫了一桌", en: "The table is flooded" }),
      share: say({ zh: "倒过头了，水漫了一桌", en: "Overfilled it and flooded the table" }),
    },
  }[round.outcome];
  return { headline: texts.headline, caption: texts.caption, shareText: texts.share + duckLine + tag };
}

/* ---- sound ---- */

let pourSound = null;

function pourSoundStep() {
  const out = soundOut();
  if (!out) return;
  if (!pourSound) {
    const source = noiseSource({ loop: true });
    const tone = out.context.createBiquadFilter();
    tone.type = "bandpass";
    tone.Q.value = 1.4;
    const volume = out.context.createGain();
    volume.gain.value = 0;
    source.connect(tone).connect(volume).connect(out.bus);
    source.start();
    pourSound = { tone, volume };
  }
  const now = out.context.currentTime;
  // The pitch climbs as the glass fills, the way a real glass sounds.
  pourSound.volume.gain.setTargetAtTime(0.22 * (round.flow / rules.FULL_FLOW), now, 0.02);
  pourSound.tone.frequency.setTargetAtTime(500 + 1900 * Math.min(1, round.level / rules.BRIM), now, 0.05);
}

function doneSound() {
  ping(988, { length: 0.25, level: 0.14 });
  ping(1319, { delay: 0.1, length: 0.7, level: 0.14 });
}

function splashSound() {
  const out = soundOut();
  if (!out) return;
  const source = noiseSource();
  const muffle = out.context.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 900;
  const volume = out.context.createGain();
  volume.gain.setValueAtTime(0.5, out.context.currentTime);
  volume.gain.setTargetAtTime(0, out.context.currentTime, 0.35);
  source.connect(muffle).connect(volume).connect(out.bus);
  source.start();
  ping(220, { length: 0.6, level: 0.12, wave: "triangle" });
}

/* ---- picture ---- */

function start() {
  const stage = createStage3D(page.view, { background: 0xe9dcc8 });
  const show = stage ? createPourScene(stage) : () => {};

  const hint = document.createElement("p");
  hint.className = "hint";
  const once = document.createElement("small");
  once.textContent = say({ zh: "只能倒一次", en: "You only get one pour" });
  hint.append(say({ zh: "按住倒水，松手就停", en: "Hold to pour, release to stop" }), once);
  page.hud.append(hint);

  function draw(elapsed) {
    const flooding = round.phase === "flood" || round.outcome === "flood";
    const wet = round.phase === "flood" ? Math.min(1, (clock.time - round.floodAt) / 1.6) : flooding ? 1 : 0;
    hint.hidden = !(round.phase === "pour" && round.pressedAt === null);
    show(
      {
        level: Math.min(round.level, rules.BRIM + rules.MENISCUS),
        flow: round.flow,
        tilted: round.flow > 0 || (round.phase === "pour" && round.pressedAt !== null && round.releasedAt === null),
        away: round.phase === "done",
        wet,
        duck: round.duck && round.phase !== "title",
        closeUp: !flooding && !wideShot,
        time: clock.time,
      },
      elapsed,
    );
    pourSoundStep();
  }

  listen();
  everyFrame(clock, (elapsed) => {
    update();
    draw(elapsed);
  });

  if (isLocal || new URLSearchParams(location.search).has("test")) {
    window.gameTest = testTools(draw);
  }
}

/* ---- for scripted checks and cover images ---- */

function testTools(draw) {
  const advance = (seconds) => {
    const steps = Math.max(1, Math.round(seconds * 60));
    for (let i = 0; i < steps; i += 1) {
      clock.advance(seconds / steps);
      update();
    }
    draw(seconds);
  };
  return {
    snapshot: () => ({ ...round, time: clock.time, resultOpen: page.resultOpen }),
    advance,
    press: () => press(null),
    letGo: () => letGo(null),
    // Ends the current round at a given water level.
    settle(level, { duck = false } = {}) {
      if (round.phase !== "pour") beginRound();
      round.duck = duck;
      round.pressedAt = round.releasedAt = clock.time;
      round.levelAtRelease = level;
      round.flowAtRelease = 0;
      advance(rules.overflows(level) ? FLOOD_SECONDS + 0.1 : 1 / 60);
    },
    // A clean mid-pour picture without any text, for the cover image.
    cover() {
      clock.takeOver();
      wideShot = true;
      page.root.classList.add("game--bare");
      resetRound("pour");
      round.pressedAt = clock.time - (rules.BRIM - 6) / rules.FULL_FLOW - rules.FULL_FLOW / rules.RAMP_UP / 2;
      update();
      draw(5);
    },
  };
}
