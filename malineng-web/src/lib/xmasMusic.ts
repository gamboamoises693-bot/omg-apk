/**
 * Christmas music made on the phone with the Web Audio API: no sound files, no download, no licence to pay.
 * The tunes are old public-domain carols (Jingle Bells 1857, Silent Night 1818, We Wish You a Merry Christmas,
 * Joy to the World 1719, Deck the Halls), played softly like a music box.
 * Browsers only allow sound after the person has touched the screen, so `startMusic()` must be called from a tap.
 */

/** One note: pitch ("C4", "F#4", or "R" for a rest) and length in beats. */
type Note = [string, number];

const SEMITONE: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

/** Frequency of a note name (A4 = 440 Hz). 0 for a rest. */
export function freq(name: string): number {
  if (name === "R") return 0;
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return 0;
  const midi = 12 * (Number(m[2]) + 1) + SEMITONE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const JINGLE_BELLS: Note[] = [
  ["E4", 1], ["E4", 1], ["E4", 2], ["E4", 1], ["E4", 1], ["E4", 2], ["E4", 1], ["G4", 1], ["C4", 1.5], ["D4", 0.5], ["E4", 4],
  ["F4", 1], ["F4", 1], ["F4", 1.5], ["F4", 0.5], ["F4", 1], ["E4", 1], ["E4", 1], ["E4", 0.5], ["E4", 0.5], ["E4", 1], ["D4", 1], ["D4", 1], ["E4", 1], ["D4", 2], ["G4", 2],
  ["E4", 1], ["E4", 1], ["E4", 2], ["E4", 1], ["E4", 1], ["E4", 2], ["E4", 1], ["G4", 1], ["C4", 1.5], ["D4", 0.5], ["E4", 4],
  ["F4", 1], ["F4", 1], ["F4", 1], ["F4", 1], ["F4", 1], ["E4", 1], ["E4", 1], ["E4", 0.5], ["E4", 0.5], ["G4", 1], ["G4", 1], ["F4", 1], ["D4", 1], ["C4", 4],
];

const SILENT_NIGHT: Note[] = [
  ["G4", 1.5], ["A4", 0.5], ["G4", 1], ["E4", 3], ["G4", 1.5], ["A4", 0.5], ["G4", 1], ["E4", 3], ["D5", 2], ["D5", 1], ["B4", 3], ["C5", 2], ["C5", 1], ["G4", 3],
  ["A4", 2], ["A4", 1], ["C5", 1.5], ["B4", 0.5], ["A4", 1], ["G4", 1.5], ["A4", 0.5], ["G4", 1], ["E4", 3], ["A4", 2], ["A4", 1], ["C5", 1.5], ["B4", 0.5], ["A4", 1],
  ["G4", 1.5], ["A4", 0.5], ["G4", 1], ["E4", 3], ["D5", 2], ["D5", 1], ["F5", 1.5], ["D5", 0.5], ["B4", 1], ["C5", 3], ["E5", 3], ["C5", 1], ["G4", 1], ["E4", 1],
  ["G4", 1.5], ["F4", 0.5], ["D4", 1], ["C4", 3],
];

const WISH_YOU: Note[] = [
  ["D4", 1], ["G4", 1], ["G4", 0.5], ["A4", 0.5], ["G4", 0.5], ["F#4", 0.5], ["E4", 1], ["E4", 1], ["E4", 1], ["A4", 1], ["A4", 0.5], ["B4", 0.5], ["A4", 0.5], ["G4", 0.5],
  ["F#4", 1], ["D4", 1], ["D4", 1], ["B4", 1], ["B4", 0.5], ["C5", 0.5], ["B4", 0.5], ["A4", 0.5], ["G4", 1], ["E4", 1], ["D4", 0.5], ["D4", 0.5], ["E4", 1], ["A4", 1], ["F#4", 1], ["G4", 2],
];

const JOY_TO_THE_WORLD: Note[] = [
  ["C5", 1.5], ["B4", 0.5], ["A4", 1.5], ["G4", 0.5], ["F4", 1], ["E4", 1], ["D4", 1], ["C4", 2], ["G4", 1], ["A4", 1.5], ["A4", 0.5], ["B4", 1.5], ["B4", 0.5], ["C5", 3],
  ["C5", 0.5], ["C5", 0.5], ["B4", 0.5], ["A4", 0.5], ["G4", 1.5], ["G4", 0.5], ["F4", 0.5], ["E4", 0.5], ["E4", 1], ["C5", 0.5], ["C5", 0.5], ["B4", 0.5], ["A4", 0.5], ["G4", 1.5], ["G4", 0.5], ["F4", 0.5], ["E4", 0.5],
  ["E4", 1], ["E4", 1], ["E4", 1], ["E4", 1], ["E4", 0.5], ["F4", 0.5], ["G4", 2], ["F4", 0.5], ["E4", 0.5], ["D4", 1], ["D4", 1], ["D4", 1], ["D4", 0.5], ["E4", 0.5], ["F4", 2],
  ["E4", 0.5], ["D4", 0.5], ["C4", 1], ["C5", 1], ["A4", 1.5], ["G4", 0.5], ["F4", 1], ["E4", 1], ["F4", 1], ["E4", 1], ["D4", 1], ["C4", 3],
];

/** Deck the Halls (old Welsh tune, 1700s): the first half, written from memory. */
const A: Note[] = [["G4", 1.5], ["F4", 0.5], ["E4", 1], ["D4", 1], ["C4", 1], ["D4", 1], ["E4", 1], ["C4", 1]];
const B: Note[] = [["D4", 0.5], ["E4", 0.5], ["F4", 0.5], ["D4", 0.5], ["E4", 1.5], ["D4", 0.5], ["C4", 1], ["B3", 1], ["C4", 2]];
const DECK_THE_HALLS: Note[] = [...A, ...B, ["R", 1], ...A, ...B];

/** Tempo (seconds per beat) of each tune. */
const PLAYLIST: { notes: Note[]; beat: number }[] = [
  { notes: JINGLE_BELLS, beat: 0.42 },
  { notes: SILENT_NIGHT, beat: 0.62 },
  { notes: WISH_YOU, beat: 0.5 },
  { notes: JOY_TO_THE_WORLD, beat: 0.45 },
  { notes: DECK_THE_HALLS, beat: 0.4 },
];

const VOLUME = 0.12;
const GAP_SECONDS = 2.5;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let timer: number | undefined;
let playing = false;
let next = 0;

type AudioCtor = typeof AudioContext;

/** A soft bell: two sines (the second an octave up, quieter) with a quick attack and a long, fading ring. */
function bell(ac: AudioContext, dest: AudioNode, f: number, at: number, len: number): void {
  const ring = Math.max(len * 1.6, 0.5);
  for (const [mult, peak] of [[1, 0.5], [2, 0.14]] as const) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = f * mult;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + ring);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + ring + 0.05);
  }
}

/** Schedules a whole tune on the audio clock and calls `onEnd` shortly after the last note. */
function playTune(index: number, onEnd: () => void): void {
  if (!ctx || !out) return;
  const { notes, beat } = PLAYLIST[index % PLAYLIST.length];
  let t = ctx.currentTime + 0.15;
  for (const [name, beats] of notes) {
    const f = freq(name);
    const len = beats * beat;
    if (f > 0) bell(ctx, out, f, t, len);
    t += len;
  }
  timer = window.setTimeout(onEnd, (t - ctx.currentTime + GAP_SECONDS) * 1000);
}

function loop(): void {
  if (!playing) return;
  const i = next;
  next = (next + 1) % PLAYLIST.length;
  playTune(i, loop);
}

/** Starts the music (call it from a tap or key press). Safe to call again while playing. */
export function startMusic(): boolean {
  if (playing) return true;
  try {
    const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return false;
    ctx = ctx ?? new Ctor();
    void ctx.resume();
    // A little echo, so the bells sparkle.
    const master = ctx.createGain();
    master.gain.value = VOLUME;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.27;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(ctx.destination);
    out = master;
    playing = true;
    loop();
    return true;
  } catch {
    playing = false;
    return false;
  }
}

/** Fades out and stops. The next start continues with the next tune. */
export function stopMusic(): void {
  playing = false;
  window.clearTimeout(timer);
  const ac = ctx;
  const g = out;
  out = null;
  if (ac && g) {
    g.gain.cancelScheduledValues(ac.currentTime);
    g.gain.setTargetAtTime(0, ac.currentTime, 0.08);
    window.setTimeout(() => g.disconnect(), 600);
  }
}

export const isPlaying = (): boolean => playing;
