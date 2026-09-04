/**
 * Notification chime — two-tone alert generated on the fly with the
 * Web Audio API. No asset to load, no CDN round-trip, no permission
 * prompt. Muted / silenced automatically until the user has interacted
 * with the page at least once (browsers block autoplay before then);
 * a "quiet" flag in localStorage lets an operator silence it too.
 *
 * Volume is intentionally loud — the operator asked for a clear alert
 * they can hear across the room. Callers who want a subtler beep can
 * pass volume: 0.4.
 */

const QUIET_KEY = "yugo:notif-sound-quiet";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx && audioCtx.state !== "closed") return audioCtx;
  const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = W.AudioContext || W.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

export function isNotificationSoundQuiet(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(QUIET_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotificationSoundQuiet(quiet: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (quiet) window.localStorage.setItem(QUIET_KEY, "1");
    else window.localStorage.removeItem(QUIET_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * Play the two-tone notification chime. Fire-and-forget; safe to call
 * repeatedly (the API queues gracefully).
 *
 * options.volume: 0..1, default 0.85 (loud, operator-requested)
 */
export function playNotificationChime(options: { volume?: number } = {}): void {
  if (isNotificationSoundQuiet()) return;
  const ctx = getCtx();
  if (!ctx) return;
  // Autoplay policy — some browsers park the ctx as "suspended" until
  // the first gesture. Try to resume; if it fails, silently skip.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const volume = Math.max(0, Math.min(1, options.volume ?? 0.85));
  const now = ctx.currentTime;

  // Two-tone chime: G5 (784Hz) → C6 (1047Hz). Bright, distinctly a
  // notification, cuts through office noise without being harsh.
  const tones: Array<{ freq: number; start: number; dur: number }> = [
    { freq: 784, start: 0, dur: 0.18 },
    { freq: 1047, start: 0.16, dur: 0.32 },
  ];

  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = t.freq;
    // Envelope: fast attack, exponential decay — sounds like a real
    // chime, not a beep.
    gain.gain.setValueAtTime(0.0001, now + t.start);
    gain.gain.exponentialRampToValueAtTime(volume, now + t.start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.dur + 0.02);
  }
}
