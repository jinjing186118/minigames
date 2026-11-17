// Rules of the pour, in millimetres and seconds. Everything is a closed formula of
// how long the player held, so the outcome is the same at any frame rate.
export const BRIM = 120; // height of the glass
export const MENISCUS = 1.5; // how far above the brim surface tension still holds
export const FULL_FLOW = 30; // mm of water level per second at full pour
export const RAMP_UP = 60; // how fast the flow builds while holding
export const TAPER = 120; // how fast the flow dies after letting go
export const DUCK_ODDS = 1 / 30;

const SECONDS_TO_FULL = FULL_FLOW / RAMP_UP;

// Water level and flow after holding for `seconds`.
export function whileHolding(seconds) {
  if (seconds <= SECONDS_TO_FULL) {
    return { level: (RAMP_UP * seconds * seconds) / 2, flow: RAMP_UP * seconds };
  }
  const levelAtFull = (RAMP_UP * SECONDS_TO_FULL * SECONDS_TO_FULL) / 2;
  return { level: levelAtFull + FULL_FLOW * (seconds - SECONDS_TO_FULL), flow: FULL_FLOW };
}

// The pour keeps trickling for a moment after the player lets go.
export function afterLettingGo(level, flow, seconds) {
  const trickle = flow / TAPER;
  const t = Math.min(seconds, trickle);
  return {
    level: level + flow * t - (TAPER * t * t) / 2,
    flow: flow - TAPER * t,
    still: seconds >= trickle,
  };
}

export function overflows(level) {
  return level > BRIM + MENISCUS;
}

// "short": below the brim. "dome": above it but held. "flood": over the edge.
export function judge(level) {
  if (overflows(level)) return "flood";
  return level > BRIM ? "dome" : "short";
}

export function gapToBrim(level) {
  return Math.round(Math.abs(BRIM - level) * 100) / 100;
}
