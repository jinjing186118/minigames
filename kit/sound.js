// Synthesized sound only: no audio files. The context is created by the first
// user gesture and woken again whenever the browser suspends it.
let context = null;
let bus = null;
let noise = null;

function wake() {
  if (context && context.state !== "running") context.resume().catch(() => {});
}

// Call from a click or key handler. Returns false when the browser has no Web Audio.
export function enableSound() {
  if (!context) {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return false;
    try {
      context = new Context();
    } catch {
      return false;
    }
    bus = context.createGain();
    bus.gain.value = 0.9;
    bus.connect(context.destination);
    for (const type of ["pointerdown", "keydown"]) addEventListener(type, wake, { capture: true, passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) wake();
    });
  }
  wake();
  return true;
}

// { context, bus } once sound is enabled, otherwise null.
export function soundOut() {
  return context ? { context, bus } : null;
}

// A single decaying note.
export function ping(frequency, { delay = 0, length = 0.3, level = 0.15, wave = "sine" } = {}) {
  if (!context) return;
  const startAt = context.currentTime + delay;
  const voice = context.createOscillator();
  const envelope = context.createGain();
  voice.type = wave;
  voice.frequency.value = frequency;
  envelope.gain.setValueAtTime(level, startAt);
  envelope.gain.setTargetAtTime(0, startAt, length / 4);
  voice.connect(envelope).connect(bus);
  voice.start(startAt);
  voice.stop(startAt + length);
}

// A source playing white noise; the caller connects, starts and stops it.
export function noiseSource({ loop = false } = {}) {
  if (!context) return null;
  if (!noise) {
    noise = context.createBuffer(1, Math.round(context.sampleRate * 1.5), context.sampleRate);
    noise.getChannelData(0).forEach((_, i, samples) => {
      samples[i] = 2 * Math.random() - 1;
    });
  }
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = loop;
  return source;
}
