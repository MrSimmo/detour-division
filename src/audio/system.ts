// The game's audio (DESIGN.md §17): engine, SFX, music and the drop-in manifest in one place.
// Manifest keys: `sfx.<key>` for sounds, `music.<cue>.L<n>` for music layer stems, and
// `stinger.<key>`. Each maps to { synth: id } or { file: "audio/….m4a" }; a file wins (R-AUD-3).
import { AudioEngine, type Volumes } from './engine.ts';
import { layersFor } from './music/threat.ts';
import { Sequencer, type Song } from './music/sequencer.ts';
import { SONGS, STINGERS } from './music/songs/index.ts';
import { SFX } from './sfx/patches.ts';
import { SfxPlayer } from './sfx/player.ts';

export type AudioEntry = { synth: string } | { file: string };
export type AudioManifest = Record<string, AudioEntry>;

/** Every manifest key the game knows, each mapped to its synth. `tools/gen-audio-manifest.ts` writes this out. */
export function defaultManifest(): AudioManifest {
  const m: AudioManifest = {};
  for (const k of Object.keys(SFX)) m[`sfx.${k}`] = { synth: k };
  for (const [k, s] of Object.entries(SONGS)) for (let l = 0; l < s.layers.length; l++) m[`music.${k}.L${l}`] = { synth: `${k}.L${l}` };
  for (const k of Object.keys(STINGERS)) m[`stinger.${k}`] = { synth: k };
  return m;
}

export class AudioSystem {
  readonly engine: AudioEngine;
  readonly sfx: SfxPlayer;
  readonly music: Sequencer;
  /** Music layer stems and stingers supplied as files, by manifest key. */
  private files = new Map<string, AudioBuffer>();
  ready: Promise<void>;

  constructor(base: string) {
    this.engine = new AudioEngine();
    const b = this.engine.buses;
    this.sfx = new SfxPlayer(this.engine.ctx, { sfx: b.sfx, ui: b.ui }, SFX);
    this.music = new Sequencer(this.engine.ctx, b);
    // Files first (so the synth isn't rendered for keys they replace), then the synth renders in the background.
    this.ready = this.loadManifest(base).then(() => this.sfx.renderAll());
  }

  private async loadManifest(base: string): Promise<void> {
    let m: AudioManifest = {};
    try {
      const r = await fetch(`${base}assets/audio.json`);
      if (r.ok) m = (await r.json()) as AudioManifest;
    } catch {
      // No manifest (for example, offline before the first cache): everything stays synth.
    }
    await Promise.all(
      Object.entries(m).map(async ([key, entry]) => {
        if (!('file' in entry)) return;
        try {
          const data = await (await fetch(`${base}${entry.file}`)).arrayBuffer();
          const buf = await this.engine.ctx.decodeAudioData(data);
          if (key.startsWith('sfx.')) this.sfx.setFile(key.slice(4), buf);
          else this.files.set(key, buf);
        } catch (e) {
          console.warn(`audio: couldn't load ${entry.file} for ${key}; using the synth`, e);
        }
      }),
    );
  }

  setVolumes(v: Volumes): void {
    this.engine.setVolumes(v);
  }

  /** Screen-space pan for a world x, given the playfield's screen mapping. */
  play(key: string, pan = 0): void {
    if (this.engine.unlocked) this.sfx.play(key, pan);
  }

  /** Switches the looping cue on the next bar line. File stems replace their layer's synth tracks. */
  cue(id: string): void {
    const song = SONGS[id];
    if (!song) return;
    const stems = song.layers.map((_, l) => this.files.get(`music.${id}.L${l}`));
    const layers = song.layers.map((tracks, l) => (stems[l] ? [] : tracks)) as Song['layers'];
    this.music.play(stems.some(Boolean) ? { ...song, layers } : song, stems);
  }

  stopMusic(seconds = 1): void {
    this.music.stop(seconds);
  }

  /** The adaptive layers follow the threat (§17.2). */
  setThreat(threat: number): void {
    this.music.setLayers(layersFor(threat));
  }

  /** Plays a stinger over the music, ducking it (and SFX a little) for its length. */
  stinger(id: string): void {
    if (!this.engine.unlocked) return;
    const file = this.files.get(`stinger.${id}`);
    let len = 0;
    if (file) {
      const src = this.engine.ctx.createBufferSource();
      src.buffer = file;
      src.connect(this.engine.buses.stinger);
      src.start();
      len = file.duration;
    } else {
      const song = STINGERS[id];
      if (!song) return;
      len = this.music.stinger(song);
    }
    this.engine.duck(len, true);
  }
}
