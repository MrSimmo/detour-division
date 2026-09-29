// Dev helper: render SFX and music offline in headless Chromium (through the Vite dev server) and
// report peak and RMS per sound or cue, flagging silence and clipping. Optionally writes WAVs.
// Usage: node tools/dev/audio-check.ts sfx|music|layers|tuning|all [filter] [--wav <dir>]   (dev server on :5173)
//   layers: RMS of each music layer on its own, to check the melody sits on top.
//   tuning: renders A3, A4 and A5 on each pitched instrument and measures the pitch (cents off).
//   For music and layers, a filter starting with /src/ is a module path: every Song it exports is checked.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const wavAt = args.indexOf('--wav');
const wavDir = wavAt >= 0 ? args[wavAt + 1] : undefined;
const [what = 'all', filter = ''] = wavAt >= 0 ? args.filter((_, i) => i !== wavAt && i !== wavAt + 1) : args;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${process.env.BASE ?? 'http://localhost:5173/'}?e2e`);

interface Row {
  key: string;
  seconds: number;
  peak: number;
  rms: number;
  wav?: number[];
}

const rows = await page.evaluate(
  async ([what, filter, wantWav]) => {
    const out: Row[] = [];
    const stats = (b: AudioBuffer): { peak: number; rms: number } => {
      let peak = 0;
      let sum = 0;
      let n = 0;
      for (let ch = 0; ch < b.numberOfChannels; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < d.length; i++) {
          const v = Math.abs(d[i]!);
          if (v > peak) peak = v;
          sum += v * v;
          n++;
        }
      }
      return { peak, rms: Math.sqrt(sum / Math.max(1, n)) };
    };
    // Loaded by path so TypeScript doesn't try to resolve dev-server URLs.
    const load = (path: string): Promise<any> => import(path);
    const pcm = (b: AudioBuffer): number[] => Array.from(b.getChannelData(0), (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767));
    if (what === 'sfx' || what === 'all') {
      const { SFX } = await load('/src/audio/sfx/patches.ts');
      const { renderVariants } = await load('/src/audio/sfx/player.ts');
      for (const [key, def] of Object.entries(SFX)) {
        if (filter && !key.includes(filter)) continue;
        const bufs = await renderVariants(def as never, 1);
        const s = stats(bufs[0]!);
        out.push({ key, seconds: bufs[0]!.duration, ...s, ...(wantWav ? { wav: pcm(bufs[0]!) } : {}) });
      }
    }
    if (what === 'music' || what === 'all') {
      const seq = await load('/src/audio/music/sequencer.ts');
      const { buildBuses } = await load('/src/audio/engine.ts');
      let cues: Record<string, unknown>;
      if (filter.startsWith('/src/')) cues = Object.fromEntries(Object.entries(await load(filter)).filter(([, v]) => (v as { layers?: unknown }).layers));
      else {
        const { SONGS, STINGERS } = await load('/src/audio/music/songs/index.ts');
        cues = { ...SONGS, ...Object.fromEntries(Object.entries(STINGERS).map(([k, v]) => [`stinger.${k}`, { ...(v as object), once: true }])) };
      }
      for (const [key, song] of Object.entries(cues)) {
        if (filter && !filter.startsWith('/src/') && !key.includes(filter)) continue;
        const cs = seq.compileSong(song as never);
        const steps = (song as { once?: boolean }).once ? cs.loopSteps : Math.min(cs.loopSteps, cs.barSteps * 8);
        const seconds = seq.stepTime(song as never, steps) + 1.5;
        const c = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
        const buses = buildBuses(c);
        const layerGains = [0, 1, 2, 3].map(() => {
          const g = c.createGain();
          g.connect(buses.music);
          return g;
        });
        const outs = seq.trackOutputs(c, cs, layerGains, buses.reverb);
        for (let k = 0; k < steps; k++) seq.scheduleStep(c, cs, outs, k, 0.05 + seq.stepTime(song as never, k));
        const b = await c.startRendering();
        out.push({ key, seconds, ...stats(b), ...(wantWav ? { wav: pcm(b) } : {}) });
      }
    }
    if (what === 'layers') {
      const seq = await load('/src/audio/music/sequencer.ts');
      const SONGS: Record<string, { once?: boolean }> = filter.startsWith('/src/')
        ? Object.fromEntries(Object.entries(await load(filter)).filter(([, v]) => (v as { layers?: unknown }).layers))
        : (await load('/src/audio/music/songs/index.ts')).SONGS;
      for (const [key, song] of Object.entries(SONGS)) {
        if (song.once) continue;
        if (filter && !filter.startsWith('/src/') && !key.includes(filter)) continue;
        const cs = seq.compileSong(song);
        const steps = Math.min(cs.loopSteps, cs.barSteps * 8);
        for (let only = 0; only < 4; only++) {
          const seconds = seq.stepTime(song, steps) + 1;
          const c = new OfflineAudioContext(1, Math.ceil(seconds * 44100), 44100);
          const layerGains = [0, 1, 2, 3].map((i) => {
            const g = c.createGain();
            g.gain.value = i === only ? 1 : 0;
            g.connect(c.destination);
            return g;
          });
          const outs = seq.trackOutputs(c, cs, layerGains, null);
          for (let k = 0; k < steps; k++) seq.scheduleStep(c, cs, outs, k, 0.05 + seq.stepTime(song, k));
          const b = await c.startRendering();
          out.push({ key: `${key}.L${only}`, seconds, ...stats(b) });
        }
      }
    }
    if (what === 'tuning') {
      const { INSTRUMENTS } = await load('/src/audio/music/instruments.ts');
      const drums = new Set(['kick', 'snare', 'click', 'shaker', 'ratchet', 'cymbal', 'anvil']);
      for (const [name, inst] of Object.entries(INSTRUMENTS)) {
        if (drums.has(name) || (filter && !name.includes(filter))) continue;
        for (const midi of [57, 69, 81]) {
          const c = new OfflineAudioContext(1, 44100, 44100);
          (inst as (...a: unknown[]) => void)(c, c.destination, 0, midi, 0.8, 1);
          const b = await c.startRendering();
          // Autocorrelation pitch over 0.25–0.55 s, after the attack.
          const d = b.getChannelData(0).slice(11025, 24255);
          const want = 440 * Math.pow(2, (midi - 69) / 12);
          let best = 0;
          let bestLag = 0;
          const minLag = Math.floor(44100 / (want * 1.5));
          const maxLag = Math.ceil(44100 / (want / 1.5));
          for (let lag = minLag; lag <= maxLag; lag++) {
            let acc = 0;
            for (let i = 0; i + lag < d.length; i++) acc += d[i]! * d[i + lag]!;
            if (acc > best) {
              best = acc;
              bestLag = lag;
            }
          }
          const got = bestLag ? 44100 / bestLag : 0;
          const cents = got ? Math.round(1200 * Math.log2(got / want)) : NaN;
          out.push({ key: `${name}@${midi}`, seconds: cents, ...stats(b) });
        }
      }
    }
    return out;
  },
  [what, filter, Boolean(wavDir)] as const,
);

const wavFile = (samples: number[]): Buffer => {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(v, i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(44100, 24);
  h.writeUInt32LE(88200, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
};

let bad = 0;
for (const r of rows) {
  const flag = r.rms < 0.002 ? 'SILENT' : r.peak >= 1 ? 'CLIPS' : '';
  if (flag) bad++;
  if (what === 'tuning') {
    const off = Math.abs(r.seconds) > 30 || Number.isNaN(r.seconds);
    if (off) bad++;
    console.log(`${r.key.padEnd(18)} ${String(r.seconds).padStart(5)} cents  rms ${r.rms.toFixed(4)}  ${off ? 'OUT OF TUNE' : ''}`);
    continue;
  }
  console.log(`${r.key.padEnd(24)} ${r.seconds.toFixed(2).padStart(6)} s  peak ${r.peak.toFixed(3)}  rms ${r.rms.toFixed(4)}  ${flag}`);
  if (wavDir && r.wav) {
    mkdirSync(wavDir, { recursive: true });
    writeFileSync(`${wavDir}/${r.key}.wav`, wavFile(r.wav));
  }
}
console.log(`${rows.length} rendered, ${bad} flagged${errors.length ? `; page errors: ${errors.join('; ')}` : ''}`);
await browser.close();
process.exit(bad || errors.length ? 1 : 0);
