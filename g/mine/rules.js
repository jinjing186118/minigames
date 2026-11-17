// Dig for Gold: the rules, without any drawing. One block is one metre.
// Every swing pays a little gold dust; breaking a block pays what was inside it.
export const ROUND_SECONDS = 30;
export const MOST_BLOCKS_PER_SWING = 4;
export const BLAST_REACH = 6; // blocks a charge of dynamite clears below itself

// Swings that follow one another without a pause build a combo; every COMBO_STEP swings
// in a row the gold from each swing goes up by COMBO_RAISE, at most COMBO_TOP times.
export const COMBO_GAP = 1;
export const COMBO_STEP = 20;
export const COMBO_RAISE = 0.25;
export const COMBO_TOP = 4;

// Ground changes with depth.
export const LAYERS = [
  { from: 0, id: "soil" },
  { from: 12, id: "rock" },
  { from: 40, id: "granite" },
  { from: 90, id: "basalt" },
  { from: 160, id: "magma" },
  { from: 250, id: "crystal" },
];

// The pick upgrades itself once this much gold (grams) has been dug up.
export const PICKS = [
  { power: 1, from: 0 },
  { power: 2, from: 20 },
  { power: 4, from: 100 },
  { power: 8, from: 450 },
  { power: 16, from: 2_000 },
  { power: 32, from: 10_000 },
  { power: 64, from: 60_000 },
  { power: 128, from: 500_000 },
];

// What a block can hold, rarest first: odds per block, payout in dust-worths, shallowest depth.
const FINDS = [
  { kind: "fossil", odds: 0.0006, pays: 400, below: 25 },
  { kind: "diamond", odds: 0.008, pays: 150, below: 10 },
  { kind: "dynamite", odds: 0.03, pays: 0, below: 6 },
  { kind: "lode", odds: 0.07, pays: 30, below: 3 },
  { kind: "nugget", odds: 0.32, pays: 6, below: 0 },
];

export function layerAt(depth) {
  let index = 0;
  while (index + 1 < LAYERS.length && depth >= LAYERS[index + 1].from) index += 1;
  return index;
}

// Swings of the first pick needed to break a block.
export function hardness(depth) {
  return 1 + Math.floor(depth / 5);
}

// Grams of gold dust in one swing at this depth: the deeper, the richer.
export function worth(depth) {
  return 1.022 ** depth;
}

export function pickFor(grams) {
  let level = 0;
  while (level + 1 < PICKS.length && grams >= PICKS[level + 1].from) level += 1;
  return level;
}

function rollBlock(depth, random) {
  let kind = "plain";
  let pays = 1;
  if (depth === 0) {
    // The very first swing always turns up gold.
    kind = "nugget";
    pays = 6;
  } else {
    let roll = random();
    for (const find of FINDS) {
      if (depth < find.below) continue;
      if (roll < find.odds) {
        kind = find.kind;
        pays = find.pays;
        break;
      }
      roll -= find.odds;
    }
  }
  const grams = Math.max(pays ? 1 : 0, Math.round(worth(depth) * pays * (0.75 + 0.5 * random())));
  return { kind, grams, hardness: hardness(depth) };
}

export function createMine(random = Math.random) {
  const blocks = [];
  return {
    depth: 0, // blocks broken so far
    damage: 0, // on the block being dug
    grams: 0,
    pick: 0,
    swings: 0,
    diamonds: 0,
    fossils: 0,
    blasts: 0,
    combo: 0, // swings in a row
    longestCombo: 0,
    swungAt: null,
    block(depth) {
      while (blocks.length <= depth) blocks.push(rollBlock(blocks.length, random));
      return blocks[depth];
    },
  };
}

// How many times over a swing pays at this combo.
export function comboPay(combo) {
  return 1 + Math.min(COMBO_TOP, Math.floor(combo / COMBO_STEP)) * COMBO_RAISE;
}

// Ends the combo when the last swing was too long before `at`. Returns true when it ended one.
export function rest(mine, at) {
  if (mine.combo === 0 || mine.swungAt === null || at - mine.swungAt <= COMBO_GAP) return false;
  mine.combo = 0;
  return true;
}

// One swing of the pick at time `at` (seconds). Changes the mine and returns what happened,
// in order: { type: "combo" | "dust" | "break" | "blast" | "pick", ... }. Grams include the combo pay.
export function strike(mine, at = null) {
  const events = [];
  if (at !== null) {
    rest(mine, at);
    mine.swungAt = at;
  }
  const payBefore = comboPay(mine.combo);
  mine.combo += 1;
  mine.longestCombo = Math.max(mine.longestCombo, mine.combo);
  const pay = comboPay(mine.combo);
  if (pay > payBefore) events.push({ type: "combo", pay });
  const earn = (grams) => {
    const paid = Math.round(grams * pay);
    mine.grams += paid;
    return paid;
  };
  const open = (viaBlast) => {
    const depth = mine.depth;
    const block = mine.block(depth);
    mine.depth += 1;
    mine.damage = 0;
    const grams = earn(block.grams);
    if (block.kind === "diamond") mine.diamonds += 1;
    if (block.kind === "fossil") mine.fossils += 1;
    events.push({ type: "break", depth, kind: block.kind, grams, viaBlast });
    if (block.kind === "dynamite") {
      mine.blasts += 1;
      events.push({ type: "blast", depth });
      for (let i = 0; i < BLAST_REACH; i += 1) open(true);
    }
  };

  mine.swings += 1;
  const dust = earn(Math.max(1, Math.round(worth(mine.depth) * 0.25)));
  events.push({ type: "dust", depth: mine.depth, grams: dust });

  let power = PICKS[mine.pick].power;
  let opened = 0;
  while (power > 0 && opened < MOST_BLOCKS_PER_SWING) {
    const left = mine.block(mine.depth).hardness - mine.damage;
    if (power < left) {
      mine.damage += power;
      break;
    }
    power -= left;
    opened += 1;
    open(false);
  }

  const pick = pickFor(mine.grams);
  if (pick > mine.pick) {
    mine.pick = pick;
    events.push({ type: "pick", level: pick });
  }
  return events;
}

// 0 = untouched, 1 = about to break.
export function wear(mine) {
  return mine.damage / mine.block(mine.depth).hardness;
}
