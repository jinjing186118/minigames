// Dig for Gold: every tap is one swing of the pick. Thirty seconds from the first swing.
import { openGamePage } from "../../kit/gamepage.js";
import { createStage3D } from "../../kit/stage3d.js";
import { createClock, everyFrame } from "../../kit/clock.js";
import { say } from "../../kit/l10n.js";
import { record, isLocal } from "../../kit/telemetry.js";
import { soundOut, ping, noiseSource } from "../../kit/sound.js";
import * as rules from "./rules.js";
import { createMineScene, PICK_HEADS } from "./scene.js";

const SLUG = "mine";
const BEST_KEY = "mine.best";
const DEEPEST_KEY = "mine.deepest";
const WHISTLE_SECONDS = 1.3; // between "time's up" and the result, so a last tap cannot hit a button
const RESULT_KEY_DELAY = 0.6;
const STREAK_GAP = 1.2;
const MOST_POPS = 18;
const COMBO_SHOWN_FROM = 5;
const HEAT_COLORS = ["#ffd23c", "#ffd23c", "#ff9a2a", "#ff5a2a", "#ff4fa8"];
const FLASH = { blast: "#fff3c4", diamond: "#9af5ff", fossil: "#fff2cf" };

const PICK_NAMES = [
  { zh: "生锈的镐", en: "Rusty pick" },
  { zh: "铁镐", en: "Iron pick" },
  { zh: "钢镐", en: "Steel pick" },
  { zh: "镀金镐", en: "Gilded pick" },
  { zh: "钻石镐", en: "Diamond pick" },
  { zh: "紫晶镐", en: "Amethyst pick" },
  { zh: "传说之镐", en: "Legendary pick" },
  { zh: "神之镐", en: "Pick of the gods" },
];
const LAYER_NAMES = [
  { zh: "表土", en: "Topsoil" },
  { zh: "岩石层", en: "Rock" },
  { zh: "花岗岩层", en: "Granite" },
  { zh: "玄武岩层", en: "Basalt" },
  { zh: "岩浆层", en: "Magma" },
  { zh: "水晶层", en: "Crystal" },
];

const seed = Number(new URLSearchParams(location.search).get("seed"));
let random = seed ? seeded(seed) : Math.random;
const clock = createClock();
const round = { number: 0, phase: "title", mine: rules.createMine(random), startAt: null, overAt: null, doneAt: null, record: false, deepest: 0 };
let streak = 0;
let lastGoldAt = -9;
let scene = null;
let hud = null;

const page = openGamePage(SLUG, { onPlay: beginRound, onRetry: beginRound });
if (page) start();

function beginRound() {
  Object.assign(round, {
    phase: "dig", mine: rules.createMine(random), startAt: null, overAt: null, doneAt: null, record: false, deepest: stored(DEEPEST_KEY),
  });
  round.number += 1;
  streak = 0;
  scene?.reset();
  hud?.reset();
  record(round.number === 1 ? "play" : "replay", { game: SLUG, round: round.number });
}

function timeLeft(at = clock.time) {
  return round.startAt === null ? rules.ROUND_SECONDS : Math.max(0, rules.ROUND_SECONDS - (at - round.startAt));
}

/* ---- input ---- */

function swing(event) {
  if (round.phase !== "dig") return;
  const at = clock.timeOf(event);
  if (round.startAt === null) round.startAt = at;
  if (timeLeft(at) <= 0) return;
  const depthBefore = round.mine.depth;
  const events = rules.strike(round.mine, at);
  react(events, depthBefore);
}

function listen() {
  const { view } = page;
  view.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swing(event);
  });
  const digKey = (event) => event.code === "Space" || event.code === "Enter";
  const onControl = (event) => event.target instanceof Element && event.target.closest("a, button");
  addEventListener("keydown", (event) => {
    if (!digKey(event) || onControl(event)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (round.phase === "done") {
      if (clock.time - round.doneAt > RESULT_KEY_DELAY) page.retry();
    } else swing(event);
  });
}

/* ---- what a swing sets off ---- */

function react(events, depthBefore) {
  const { mine } = round;
  let small = 0; // dust, plain blocks and nuggets are shown as one number
  let opened = 0;
  let struckGold = false;
  // Big nuggets turn up too often for the whole screen to flash each time.
  const find = (zh, en, event, kind) => {
    hud.pop(`${say({ zh, en })} +${grams(event.grams)}`, kind);
    if (FLASH[event.kind]) hud.flash(FLASH[event.kind]);
  };
  for (const event of events) {
    if (event.type === "dust") small += event.grams;
    else if (event.type === "break") {
      opened += 1;
      scene?.open(event.depth, event.kind);
      if (event.kind === "plain" || event.kind === "nugget") small += event.grams;
      if (event.kind === "nugget") struckGold = true;
      if (event.kind === "lode") {
        struckGold = true;
        find("大金块", "Big nugget", event, "big");
      }
      if (event.kind === "diamond") {
        find("钻石", "Diamond", event, "gem");
        sparkleSound();
        buzz(30);
      }
      if (event.kind === "fossil") {
        find("恐龙化石", "Dinosaur fossil", event, "gem");
        sparkleSound();
        buzz(30);
      }
    } else if (event.type === "blast") {
      scene?.blast(event.depth + 1, rules.BLAST_REACH);
      hud.flash(FLASH.blast);
      hud.pop(say({ zh: "轰！", en: "BOOM!" }), "boom");
      boomSound(rules.BLAST_REACH);
      buzz([40, 30, 40, 30, 60]);
    } else if (event.type === "pick") {
      scene?.upgrade(event.level);
      hud.banner(say(PICK_NAMES[event.level]), 1.1, cssColor(PICK_HEADS[event.level]));
      hud.flash(cssColor(PICK_HEADS[event.level]));
      upgradeSound();
      buzz(40);
    } else if (event.type === "combo") {
      const step = heatOf(mine);
      scene?.heat(step);
      hud.raise();
      comboSound(step);
    }
  }
  hud.pop(`+${grams(small)}`, struckGold ? "gold" : "");
  scene?.swing(depthBefore, opened ? 2 : 4, opened > 0);
  thudSound(rules.layerAt(depthBefore), opened > 0, heatOf(mine));
  if (struckGold) {
    streak = clock.time - lastGoldAt < STREAK_GAP ? streak + 1 : 0;
    lastGoldAt = clock.time;
    coinSound(streak);
  }
  if (rules.layerAt(mine.depth) > rules.layerAt(depthBefore)) hud.banner(say(LAYER_NAMES[rules.layerAt(mine.depth)]));
  if (round.deepest > 0 && depthBefore < round.deepest && mine.depth >= round.deepest) {
    scene?.cheer();
    hud.pop(say({ zh: "比上次更深！", en: "Deeper than ever!" }), "cheer");
    upgradeSound();
  }
  buzz(opened ? 14 : 6);
  hud.count();
}

// 0 to COMBO_TOP: how many times the combo has raised the pay.
function heatOf(mine) {
  return Math.round((rules.comboPay(mine.combo) - 1) / rules.COMBO_RAISE);
}

function cssColor(number) {
  return `#${number.toString(16).padStart(6, "0")}`;
}

function buzz(ms) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not allowed here; the game works without it.
  }
}

/* ---- time ---- */

let lastTick = 0;

function update() {
  const now = clock.time;
  if (rules.rest(round.mine, now)) scene?.heat(0);
  if (round.phase === "dig" && round.startAt !== null) {
    const left = timeLeft(now);
    const whole = Math.ceil(left);
    if (whole <= 5 && whole > 0 && whole !== lastTick) ping(1320, { length: 0.07, level: 0.08 });
    lastTick = whole;
    if (left <= 0) {
      round.phase = "over";
      round.overAt = now;
      hud.banner(say({ zh: "时间到！", en: "Time's up!" }), WHISTLE_SECONDS);
      whistleSound();
    }
  } else if (round.phase === "over" && now - round.overAt >= WHISTLE_SECONDS) finish();
}

function finish() {
  const { mine } = round;
  round.phase = "done";
  round.doneAt = clock.time;
  hud.clear();
  const before = stored(BEST_KEY);
  round.record = mine.grams > before;
  if (round.record) store(BEST_KEY, mine.grams);
  if (mine.depth > round.deepest) store(DEEPEST_KEY, mine.depth);
  scene?.heat(0);
  if (round.record) scene?.cheer(1.8);
  if (round.record && before > 0) upgradeSound();
  record("result", { game: SLUG, grams: mine.grams, depth: mine.depth, swings: mine.swings, round: round.number });
  page.showResult(resultTexts(before));
}

function stored(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Private mode: the record lasts for this visit only.
  }
}

/* ---- texts ---- */

// 950 → "950 g", 12 345 → "12.3 kg", 3 456 789 → "3.46 t".
function grams(value, units = ["g", "kg", "t"]) {
  if (value < 1000) return `${Math.round(value)} ${units[0]}`;
  const big = value >= 1e6;
  const amount = value / (big ? 1e6 : 1e3);
  const digits = amount < 10 ? 2 : amount < 100 ? 1 : 0;
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[big ? 2 : 1]}`;
}

function resultTexts(before) {
  const { mine } = round;
  const depth = mine.depth;
  const notes = [say({ zh: `地下 ${depth} 米`, en: `${depth} m down` })];
  if (mine.diamonds) notes.push(say({ zh: `钻石 ×${mine.diamonds}`, en: `${mine.diamonds} × diamond` }));
  if (mine.fossils) notes.push(say({ zh: "恐龙化石", en: "a dinosaur fossil" }));
  notes.push(
    round.record
      ? say({ zh: "新纪录", en: "new record" })
      : say({ zh: `最高 ${grams(before)}`, en: `best ${grams(before)}` }),
  );

  const next = rules.PICKS[mine.pick + 1];
  const tease = next
    ? say({
        zh: `离${say(PICK_NAMES[mine.pick + 1])}只差 ${grams(next.from - mine.grams)}`,
        en: `${grams(next.from - mine.grams)} short of the ${say(PICK_NAMES[mine.pick + 1]).toLowerCase()}`,
      })
    : "";

  const extras = [];
  if (mine.diamonds) {
    extras.push(
      say({
        zh: `${mine.diamonds} 颗钻石`,
        en: mine.diamonds === 1 ? "a diamond" : `${mine.diamonds} diamonds`,
      }),
    );
  }
  if (mine.fossils) extras.push(say({ zh: "一具恐龙化石", en: "a dinosaur fossil" }));
  const gold = grams(mine.grams, say({ zh: ["克", "公斤", "吨"], en: ["g", "kg", "tonnes"] }));
  const share =
    say({
      zh: `${rules.ROUND_SECONDS} 秒挖到 ${gold}黄金，一路挖到地下 ${depth} 米`,
      en: `Dug up ${gold} of gold in ${rules.ROUND_SECONDS} seconds, ${depth} m underground`,
    }) +
    (extras.length
      ? say({ zh: `，还挖出了${extras.join("和")}`, en: `, plus ${extras.join(" and ")}` })
      : "") +
    say({ zh: " #挖金矿", en: " #DigForGold" });
  return { headline: grams(mine.grams), caption: [notes.join(" · "), tease].filter(Boolean).join("\n"), shareText: share };
}

/* ---- sound ---- */

const THUD_PITCH = [260, 800, 1000, 620, 420, 1900];
const COIN_STEPS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2, 3, 10 / 3, 4];

function burst(pitch, level, fade, kind = "bandpass", delay = 0) {
  const out = soundOut();
  if (!out) return;
  const startAt = out.context.currentTime + delay;
  const source = noiseSource();
  const tone = out.context.createBiquadFilter();
  tone.type = kind;
  tone.frequency.value = pitch;
  const volume = out.context.createGain();
  volume.gain.setValueAtTime(level, startAt);
  volume.gain.setTargetAtTime(0, startAt, fade);
  source.connect(tone).connect(volume).connect(out.bus);
  source.start(startAt);
  source.stop(startAt + fade * 8);
}

// The hotter the combo, the brighter the pick rings.
function thudSound(layer, broke, heat) {
  burst(THUD_PITCH[layer] * (broke ? 0.7 : 1) * (1 + 0.06 * heat), broke ? 0.5 : 0.32, broke ? 0.05 : 0.025);
  ping(broke ? 90 : 130, { length: 0.1, level: 0.16, wave: "triangle" });
}

function comboSound(step) {
  const note = 660 * 2 ** (step / 4);
  [1, 1.26, 1.5, 2].forEach((ratio, i) => ping(note * ratio, { delay: i * 0.045, length: 0.22, level: 0.09, wave: "square" }));
}

// Each find soon after the last one rings a step higher.
function coinSound(step) {
  const note = 880 * COIN_STEPS[Math.min(step, COIN_STEPS.length - 1)];
  ping(note, { length: 0.12, level: 0.1 });
  ping(note * 1.5, { delay: 0.05, length: 0.3, level: 0.1 });
}

function sparkleSound() {
  [1568, 2093, 2637, 3136].forEach((note, i) => ping(note, { delay: i * 0.06, length: 0.4, level: 0.09 }));
}

// One big bang, then a smaller one for each block the blast runs through.
function boomSound(blocks) {
  burst(170, 0.9, 0.22, "lowpass");
  ping(52, { length: 0.6, level: 0.3, wave: "triangle" });
  for (let i = 0; i < blocks; i += 1) {
    burst(240 + i * 30, 0.5, 0.07, "lowpass", 0.05 + i * 0.055);
    ping(70 + i * 6, { delay: 0.05 + i * 0.055, length: 0.2, level: 0.16, wave: "triangle" });
  }
}

function upgradeSound() {
  [523, 659, 784, 1047].forEach((note, i) => ping(note, { delay: i * 0.07, length: 0.35, level: 0.1, wave: "triangle" }));
}

function whistleSound() {
  [880, 660, 440].forEach((note, i) => ping(note, { delay: i * 0.16, length: 0.3, level: 0.13, wave: "triangle" }));
}

/* ---- the numbers on top of the picture ---- */

function buildHud(host) {
  const make = (tag, className, parent = host) => {
    const node = document.createElement(tag);
    node.className = className;
    parent.append(node);
    return node;
  };
  const edge = make("div", "mine-edge");
  const time = make("div", "mine-time");
  const timeLeftBar = make("i", "", time);
  const gold = make("p", "mine-gold");
  const toNext = make("div", "mine-next"); // how close the next pick is
  const toNextBar = make("i", "", toNext);
  const where = make("p", "mine-where");
  const combo = make("p", "mine-combo");
  const comboPay = make("b", "", combo);
  const comboCount = make("span", "", combo);
  const comboBar = make("i", "", combo);
  const hint = make("p", "mine-hint");
  hint.textContent = say({ zh: "点屏幕，开挖！", en: "Tap to dig!" });
  const pops = make("div", "mine-pops");
  const sign = make("p", "mine-banner");
  const white = make("div", "mine-flash");
  sign.hidden = true;
  let signUntil = 0;
  let shownGrams = 0;
  let shownAt = 0;

  const replay = (node, className) => {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  };

  return {
    clear() {
      pops.replaceChildren();
      sign.hidden = true;
    },
    reset() {
      this.clear();
      shownGrams = 0;
      this.count();
    },
    count() {
      replay(gold, "mine-gold--bump");
    },
    pop(text, kind, color) {
      const node = document.createElement("span");
      node.className = `mine-pop${kind ? ` mine-pop--${kind}` : ""}`;
      node.textContent = text;
      // Small amounts go up the walls on either side, clear of the miner.
      const side = Math.random() < 0.5 ? 12 : 68;
      node.style.left = `${kind && kind !== "gold" ? 50 : side + Math.random() * 20}%`;
      if (color) node.style.color = color;
      node.addEventListener("animationend", () => node.remove());
      pops.append(node);
      while (pops.childElementCount > MOST_POPS) pops.firstElementChild.remove();
    },
    banner(text, seconds = 1.1, color = "") {
      sign.textContent = text;
      sign.style.color = color;
      sign.hidden = false;
      signUntil = clock.time + seconds;
      replay(sign, "mine-banner--in");
    },
    // The combo pays more from now on.
    raise() {
      replay(combo, "mine-combo--up");
    },
    flash(color = FLASH.blast) {
      white.style.background = color;
      replay(white, "mine-flash--on");
    },
    show() {
      const { mine } = round;
      const left = timeLeft();
      const playing = round.phase === "dig" || round.phase === "over";
      time.hidden = gold.hidden = where.hidden = toNext.hidden = !playing;
      timeLeftBar.style.transform = `scaleX(${left / rules.ROUND_SECONDS})`;
      time.classList.toggle("mine-time--late", left <= 5);

      // The count runs up to the real amount instead of jumping.
      const since = Math.min(0.1, clock.time - shownAt);
      shownAt = clock.time;
      shownGrams += (mine.grams - shownGrams) * Math.min(1, since * 14);
      if (mine.grams - shownGrams < 0.6) shownGrams = mine.grams;
      gold.textContent = grams(shownGrams);

      const next = rules.PICKS[mine.pick + 1];
      const from = rules.PICKS[mine.pick].from;
      toNextBar.style.transform = `scaleX(${next ? Math.min(1, (mine.grams - from) / (next.from - from)) : 1})`;
      toNext.style.setProperty("--next", cssColor(PICK_HEADS[Math.min(mine.pick + 1, PICK_HEADS.length - 1)]));
      where.textContent = `${mine.depth} m · ${say(PICK_NAMES[mine.pick])}`;

      const heat = heatOf(mine);
      combo.hidden = !(playing && mine.combo >= COMBO_SHOWN_FROM);
      combo.style.setProperty("--heat", HEAT_COLORS[heat]);
      comboPay.textContent = heat ? `×${rules.comboPay(mine.combo)}` : "";
      comboCount.textContent = say({ zh: `${mine.combo} 连击`, en: `${mine.combo} combo` });
      comboBar.style.transform = `scaleX(${heat >= rules.COMBO_TOP ? 1 : (mine.combo % rules.COMBO_STEP) / rules.COMBO_STEP})`;
      edge.style.setProperty("--heat", HEAT_COLORS[heat]);
      edge.dataset.heat = playing ? heat : 0;
      edge.classList.toggle("mine-edge--late", playing && round.startAt !== null && left <= 5 && left > 0);

      hint.hidden = !(round.phase === "dig" && round.startAt === null);
      if (!sign.hidden && clock.time >= signUntil) sign.hidden = true;
    },
  };
}

/* ---- picture ---- */

function start() {
  const stage = createStage3D(page.view, { background: 0x1b130d, shadows: false });
  scene = stage ? createMineScene(stage) : null;
  hud = buildHud(page.hud);
  hud.reset();

  function draw(elapsed) {
    const { mine } = round;
    hud.show();
    scene?.show(
      {
        depth: mine.depth,
        wear: rules.wear(mine),
        pick: mine.pick,
        kindAt: (row) => mine.block(row).kind,
        over: round.phase === "done",
        best: round.deepest,
      },
      elapsed,
    );
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

function seeded(state) {
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
    snapshot() {
      const { mine } = round;
      return {
        phase: round.phase,
        number: round.number,
        record: round.record,
        depth: mine.depth,
        grams: mine.grams,
        pick: mine.pick,
        swings: mine.swings,
        diamonds: mine.diamonds,
        fossils: mine.fossils,
        blasts: mine.blasts,
        combo: mine.combo,
        pay: rules.comboPay(mine.combo),
        deepest: round.deepest,
        scene: scene?.state ?? null,
        timeLeft: timeLeft(),
        time: clock.time,
        resultOpen: page.resultOpen,
      };
    },
    advance,
    swing(times = 1) {
      for (let i = 0; i < times; i += 1) swing(null);
    },
    // The same blocks every time from here on.
    reseed(value) {
      random = seeded(value);
    },
    // Puts a find in the block being dug.
    plant(kind) {
      round.mine.block(round.mine.depth).kind = kind;
    },
    // A clean picture without any text, for the cover image.
    cover() {
      clock.takeOver();
      page.root.classList.add("game--bare");
      random = seeded(7);
      beginRound();
      round.mine.block(0).kind = "lode";
      round.mine.block(1).kind = "diamond";
      round.mine.block(2).kind = "nugget";
      draw(0.03);
    },
  };
}
