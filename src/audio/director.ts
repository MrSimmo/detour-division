// In-level audio direction (DESIGN.md §17): sim events → SFX, the zone's music and its boss cue,
// the adaptive layers, stingers and ambience. The sim never knows audio exists; this only listens.
import type { BalanceDef } from '../data/schemas.ts';
import type { Sim } from '../sim/context.ts';
import type { SimEvent } from '../sim/types.ts';
import { musicThreat } from './music/threat.ts';
import type { AudioSystem } from './system.ts';

/** How often the threat is re-measured for the adaptive layers. */
const THREAT_EVERY = 0.25;
const AMBIENCE_GAIN = 0.5;

export class GameAudio {
  private readonly a: AudioSystem;
  private readonly b: BalanceDef;
  private readonly zone: number;
  /** Stereo pan (−1..1) for a point in cells, from its screen position. */
  private readonly panOf: (x: number, y: number) => number;
  private threatT = 0;
  private bossesAlive = new Set<number>();
  private ambience: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private ended = false;

  constructor(a: AudioSystem, b: BalanceDef, zone: number, panOf: (x: number, y: number) => number) {
    this.a = a;
    this.b = b;
    this.zone = zone;
    this.panOf = panOf;
    a.cue(`z${zone}`);
    a.engine.onUnlock(() => void a.ready.then(() => this.startAmbience()));
  }

  private startAmbience(): void {
    if (this.ended || this.ambience) return;
    const buf = this.a.sfx.buffer(`amb.z${this.zone}`);
    if (!buf) return;
    const c = this.a.engine.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.value = AMBIENCE_GAIN;
    src.connect(g).connect(this.a.engine.buses.sfx);
    src.start();
    this.ambience = { src, gain: g };
  }

  private sfx(key: string, x?: number, y?: number): void {
    this.a.play(key, x === undefined ? 0 : this.panOf(x, y ?? 0));
  }

  onEvents(events: readonly SimEvent[], sim: Sim): void {
    for (const ev of events) {
      switch (ev.e) {
        case 'fire':
          this.sfx(`tower.${ev.ttype}.t${ev.tier + 1}`, ev.x, ev.y);
          break;
        case 'zap':
          this.sfx(`tower.sparkplug.t${ev.tier + 1}`, ev.pts[0], ev.pts[1]);
          break;
        case 'beam':
          this.sfx(`tower.sunbeam.t${ev.tier + 1}`, ev.x0, ev.y0);
          break;
        case 'pulse':
          this.sfx(`tower.icebox.t${ev.tier + 1}`, ev.x, ev.y);
          break;
        case 'bellow':
          this.sfx(`tower.bellower.t${ev.tier + 1}`, ev.x, ev.y);
          break;
        case 'bubble': {
          const t = sim.state.towers.find((x) => x.id === ev.tower);
          this.sfx(`tower.bubbler.t${(t?.tier ?? 0) + 1}`, t?.x, t?.y);
          break;
        }
        case 'boom':
          this.sfx(ev.ttype === 'thumper' || ev.ttype === 'piechucker' || ev.ttype === 'skylark' ? `boom.${ev.ttype}` : 'boom.small', ev.x, ev.y);
          break;
        case 'spawn':
          if (this.b.enemies[ev.type]?.boss) {
            this.bossesAlive.add(ev.id);
            this.sfx('boss.arrive', ev.x, ev.y);
            this.a.stinger('bossArrive');
            this.a.cue(`boss.z${this.zone}`);
          }
          break;
        case 'kill': {
          const e = this.b.enemies[ev.type];
          if (e?.boss) {
            this.sfx('boss.death', ev.x, ev.y);
            this.a.engine.duck(1.5, false);
            this.bossesAlive.delete(ev.id);
            if (!this.bossesAlive.size) this.a.cue(`z${this.zone}`);
          } else this.sfx(e?.air ? 'enemy.air' : e?.heavy || (e?.armour ?? 0) >= 3 ? 'enemy.clank' : 'enemy.pop', ev.x, ev.y);
          break;
        }
        case 'leak':
          this.bossesAlive.delete(ev.id);
          this.sfx('enemy.leak', ev.x, ev.y);
          break;
        case 'shieldBreak':
          this.sfx('enemy.shieldbreak', ev.x, ev.y);
          break;
        case 'shieldUp': {
          const e = sim.byId.get(ev.id);
          this.sfx('enemy.shieldup', e?.x, e?.y);
          break;
        }
        case 'heal':
          this.sfx('enemy.heal', ev.x, ev.y);
          break;
        case 'split':
          this.sfx('enemy.split', ev.x, ev.y);
          break;
        case 'tunnel':
          this.sfx('enemy.tunnel', ev.x, ev.y);
          break;
        case 'freeze':
          this.sfx('status.freeze', ev.x, ev.y);
          break;
        case 'pop':
          this.sfx('status.pop', ev.x, ev.y);
          break;
        case 'reverse':
          this.sfx('status.reverse', ev.x, ev.y);
          break;
        case 'phase': {
          const e = sim.byId.get(ev.id);
          this.sfx('boss.phase', e?.x, e?.y);
          break;
        }
        case 'drop':
          this.sfx('boss.drop', ev.x, ev.y);
          break;
        case 'build':
          this.sfx('ui.build', ev.cx + 0.5, ev.cy + 0.5);
          if (ev.ttype === 'teaurn') this.sfx('tower.teaurn.t1', ev.cx + 0.5, ev.cy + 0.5);
          break;
        case 'upgrade':
          this.sfx('ui.upgrade', ev.cx + 0.5, ev.cy + 0.5);
          if (ev.ttype === 'teaurn') this.sfx(`tower.teaurn.t${ev.tier + 1}`, ev.cx + 0.5, ev.cy + 0.5);
          break;
        case 'sell':
          this.sfx('ui.sell', ev.cx + 0.5, ev.cy + 0.5);
          break;
        case 'clear':
          this.sfx('ui.clear', ev.cx + 0.5, ev.cy + 0.5);
          break;
        case 'wave':
          // The bugle marks the start and every wave the player calls; waves that march in on
          // their own get a snare roll, so forty bugles a level don't wear thin.
          if (ev.index === 0 || ev.early) this.a.stinger('wave');
          else this.sfx('ui.wave');
          if (ev.early && ev.bonus > 0) this.sfx('ui.coins');
          break;
        case 'result':
          if (ev.result !== 'playing') this.end(ev.result);
          break;
        default:
          break;
      }
    }
  }

  /** Per frame: re-measure the threat now and then, so the layers follow the fight. */
  frame(sim: Sim, dt: number): void {
    this.threatT -= dt;
    if (this.threatT > 0 || this.ended) return;
    this.threatT = THREAT_EVERY;
    this.a.setThreat(musicThreat(sim.state.enemies, (t) => Boolean(this.b.enemies[t]?.boss)));
  }

  private end(result: 'won' | 'lost'): void {
    if (this.ended) return;
    this.ended = true;
    this.a.stopMusic(0.6);
    this.a.stinger(result === 'won' ? 'victory' : 'defeat');
    this.stopAmbience(2);
  }

  private stopAmbience(seconds: number): void {
    const amb = this.ambience;
    if (!amb) return;
    this.ambience = null;
    const t = this.a.engine.ctx.currentTime;
    amb.gain.gain.setValueAtTime(amb.gain.gain.value, t);
    amb.gain.gain.linearRampToValueAtTime(0, t + seconds);
    amb.src.stop(t + seconds + 0.05);
  }

  /** Leaving the level (quit, restart or result): let the level's sound go. */
  destroy(): void {
    this.ended = true;
    this.stopAmbience(0.3);
  }
}
