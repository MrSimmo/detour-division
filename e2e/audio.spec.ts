// §17 audio acceptance: R-AUD-1 (voice caps and mix peak), R-AUD-2 (first-gesture unlock), R-AUD-3 (drop-in files).
import { expect, test } from '@playwright/test';
import { startLevel, watch } from './helpers.ts';

type AudioHook = {
  engine: { ctx: AudioContext; unlocked: boolean; buses: { gate: GainNode } };
  sfx: { played: number; source(k: string): string | undefined };
  ready: Promise<void>;
  play(k: string): void;
  music: { songId: string | null; activeLayers: number };
  setThreat(t: number): void;
};

test('R-AUD-2: nothing plays before the first gesture, and the first gesture unlocks audio', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'R-AUD-2 names Chromium and WebKit');
  const w = watch(page);
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Tap to start' }).waitFor();
  await page.mouse.move(200, 200);
  // WebKit may run the context for a moment by itself; the engine suspends it again, and the output
  // gate stays shut until the gesture either way, so nothing can be heard.
  await page.waitForFunction(() => (window as unknown as { __audio: AudioHook }).__audio.engine.ctx.state === 'suspended');
  const before = await page.evaluate(() => {
    const a = (window as unknown as { __audio: AudioHook }).__audio;
    return { unlocked: a.engine.unlocked, played: a.sfx.played, gate: a.engine.buses.gate.gain.value };
  });
  expect(before).toEqual({ unlocked: false, played: 0, gate: 0 });
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.waitForFunction(() => (window as unknown as { __audio: AudioHook }).__audio.engine.ctx.state === 'running');
  expect(await page.evaluate(() => {
    const a = (window as unknown as { __audio: AudioHook }).__audio;
    return { unlocked: a.engine.unlocked, gate: a.engine.buses.gate.gain.value };
  })).toEqual({ unlocked: true, gate: 1 });
  expect(w.errors).toEqual([]);
});

/** A short 16-bit mono sine WAV, so the test needs no audio fixtures. */
function wav(seconds: number, freq: number): Buffer {
  const sr = 22050;
  const n = Math.floor(sr * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / sr) * 8000), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

test('R-AUD-3: a manifest key that names a file plays the file instead of the synth', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough for the manifest logic');
  await page.route('**/assets/audio.json', (r) => r.fulfill({ json: { 'sfx.ui.click': { file: 'audio/e2e-click.wav' }, 'sfx.ui.build': { synth: 'ui.build' } } }));
  await page.route('**/audio/e2e-click.wav', (r) => r.fulfill({ body: wav(0.1, 660), contentType: 'audio/wav' }));
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.evaluate(() => (window as unknown as { __audio: AudioHook }).__audio.ready);
  const r = await page.evaluate(() => {
    const a = (window as unknown as { __audio: AudioHook }).__audio;
    const n = a.sfx.played;
    a.play('ui.click');
    return { click: a.sfx.source('ui.click'), build: a.sfx.source('ui.build'), played: a.sfx.played - n };
  });
  expect(r).toEqual({ click: 'file', build: 'synth', played: 1 });
});

test('R-AUD-1: 50 Rattlers firing stay within the voice caps, and the mix peaks below 0 dBFS', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'an offline render in one engine is enough');
  test.setTimeout(60_000);
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Tap to start' }).waitFor();
  const r = await page.evaluate(async () => {
    type Lab = {
      buildBuses(c: BaseAudioContext): { sfx: AudioNode; ui: AudioNode };
      SfxPlayer: new (c: BaseAudioContext, o: { sfx: AudioNode; ui: AudioNode }, d: unknown) => {
        renderAll(): Promise<void>;
        play(k: string, pan: number, when: number): boolean;
        limiter: { active(now: number): number; activeFor(k: string, now: number): number };
      };
      SFX: Record<string, unknown>;
    };
    const lab = (window as unknown as { __audioLab: Lab }).__audioLab;
    const seconds = 4;
    const c = new OfflineAudioContext(2, 44100 * seconds, 44100);
    const buses = lab.buildBuses(c);
    const player = new lab.SfxPlayer(c, buses, lab.SFX);
    await player.renderAll();
    let s = 11;
    const rnd = (): number => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const triggers: { t: number; key: string; pan: number }[] = [];
    // 50 Rattlers (a mix of tiers) at 5 shots a second, plus Thumper shells landing.
    for (let k = 0; k < 50 * 5 * 3.5; k++) triggers.push({ t: rnd() * 3.5, key: `tower.rattler.t${1 + (k % 3)}`, pan: rnd() * 2 - 1 });
    for (let k = 0; k < 20; k++) triggers.push({ t: rnd() * 3.5, key: 'boom.thumper', pan: rnd() * 2 - 1 });
    triggers.sort((a, z) => a.t - z.t);
    let peakVoices = 0;
    let peakRattler = 0;
    for (const tr of triggers) {
      player.play(tr.key, tr.pan, tr.t);
      peakVoices = Math.max(peakVoices, player.limiter.active(tr.t * 1000));
      for (const tier of [1, 2, 3]) peakRattler = Math.max(peakRattler, player.limiter.activeFor(`tower.rattler.t${tier}`, tr.t * 1000));
    }
    const b = await c.startRendering();
    let peak = 0;
    for (let ch = 0; ch < b.numberOfChannels; ch++) for (const v of b.getChannelData(ch)) peak = Math.max(peak, Math.abs(v));
    return { peakVoices, peakRattler, peak };
  });
  expect(r.peakRattler).toBeLessThanOrEqual(4);
  expect(r.peakVoices).toBeLessThanOrEqual(24);
  expect(r.peak).toBeLessThan(1);
});

test('in a level: the zone theme plays, towers firing make sounds, and a boss brings its cue', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough for the wiring');
  const w = watch(page);
  await startLevel(page);
  await page.evaluate(() => (window as unknown as { __audio: AudioHook }).__audio.ready);
  expect(await page.evaluate(() => (window as unknown as { __audio: AudioHook }).__audio.music.songId)).toBe('z1');
  const before = await page.evaluate(() => (window as unknown as { __audio: AudioHook }).__audio.sfx.played);
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { sim: { state: { cash: number } }; command(c: unknown): unknown } }).__game;
    g.sim.state.cash += 500;
    for (let y = 3; y < 9; y += 2) g.command({ t: 'build', tower: 'rattler', cx: 6, cy: y });
    g.command({ t: 'callWave' });
  });
  await page.waitForFunction((n) => (window as unknown as { __audio: AudioHook }).__audio.sfx.played > n + 5, before, { timeout: 20_000 });
  // Adaptive layers: high threat brings in L2 and L3 on the next bar line; low threat drops back.
  // Paused, so the director's own threat readings don't interleave with the test's.
  expect(await page.evaluate(() => (window as unknown as { __audio: AudioHook }).__audio.music.activeLayers)).toBe(2);
  await page.evaluate(() => (window as unknown as { __game: { setPaused(p: boolean): void } }).__game.setPaused(true));
  await page.evaluate(() => (window as unknown as { __audio: AudioHook }).__audio.setThreat(0.9));
  await page.waitForFunction(() => (window as unknown as { __audio: AudioHook }).__audio.music.activeLayers === 4);
  await page.evaluate(() => (window as unknown as { __audio: AudioHook }).__audio.setThreat(0));
  await page.waitForFunction(() => (window as unknown as { __audio: AudioHook }).__audio.music.activeLayers === 2);
  await page.evaluate(() => (window as unknown as { __game: { setPaused(p: boolean): void } }).__game.setPaused(false));
  await page.evaluate(() => (window as unknown as { __spawn(t: string): number }).__spawn('flattener'));
  await page.waitForFunction(() => (window as unknown as { __audio: AudioHook }).__audio.music.songId === 'boss.z1');
  expect(w.errors).toEqual([]);
});
