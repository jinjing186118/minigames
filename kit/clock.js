// Game time in seconds. It follows real time, so a slow device plays at the same
// speed as a fast one. It stands still while the tab is hidden and can be driven by
// hand in tests.
const LONGEST_FRAME = 0.5;

export function createClock() {
  let time = 0;
  let frameStamp = null;
  let manual = false;

  document.addEventListener("visibilitychange", () => {
    frameStamp = null;
  });

  return {
    get time() {
      return time;
    },
    // Called once per animation frame; returns the seconds that just passed.
    frame(stamp) {
      const elapsed =
        manual || frameStamp === null ? 0 : Math.min(LONGEST_FRAME, Math.max(0, (stamp - frameStamp) / 1000));
      frameStamp = stamp;
      time += elapsed;
      return elapsed;
    },
    // Game time of an input event, which usually lands between two frames.
    timeOf(event) {
      const stamp = event?.timeStamp;
      if (manual || frameStamp === null || !(stamp > 0)) return time;
      return time + Math.min(LONGEST_FRAME, Math.max(0, (stamp - frameStamp) / 1000));
    },
    takeOver() {
      manual = true;
    },
    advance(seconds) {
      manual = true;
      time += seconds;
    },
  };
}

export function everyFrame(clock, draw) {
  const tick = (stamp) => {
    draw(clock.frame(stamp));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
