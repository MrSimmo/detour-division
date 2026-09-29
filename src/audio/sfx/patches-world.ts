// Everything that isn't a tower firing: enemies, statuses, bosses, UI and zone ambience (DESIGN.md §17.3).
import { chain, env, filter, glide, noise, osc, vibrato, type Ctx } from '../synth.ts';
import type { SfxDef } from './player.ts';
import { BELL, METAL, bossSpec, clicks, coin, cue, hiss, jitter, loopFade, partials, shot, tone, tremolo, uiSpec, wander, type R } from './patches-kit.ts';

/** A brass-ish honk for the leak horn: two detuned saws through a soft low-pass. */
function horn(c: Ctx, out: AudioNode, f: number, t: number, len: number, peak: number): void {
  const m = c.createGain();
  m.gain.value = 0.5;
  for (const d of [-8, 8]) {
    const o = osc(c, 'sawtooth', f, t, len + 0.05);
    o.detune.value = d;
    o.frequency.setValueAtTime(f, t + len * 0.6);
    o.frequency.linearRampToValueAtTime(f * 0.94, t + len);
    o.connect(m);
  }
  chain(m, filter(c, 'lowpass', 1100, 1.5), env(c, t, len, peak, 0.03, len * 0.45), out);
}

export const ENEMY_SFX: Record<string, SfxDef> = {
  'enemy.pop': {
    ...shot(4, 40),
    dur: 0.22,
    patch: (c, out, r) => {
      tone(c, out, 'sine', 900 + r() * 150, 0, 0.05, 0.6, { to: 280, glideDur: 0.04, attack: 0.0008 });
      hiss(c, out, r, 0, 0.03, 0.25, 'bandpass', 2400, 1.5, { attack: 0.0005 });
      const f = 1600 + r() * 400;
      const q = osc(c, 'sine', f, 0.05, 0.12);
      q.frequency.linearRampToValueAtTime(f * 1.35, 0.1);
      q.frequency.linearRampToValueAtTime(f * 1.15, 0.16);
      vibrato(c, q.frequency, 0.05, 0.12, 24, f * 0.04, 0);
      chain(q, env(c, 0.05, 0.13, 0.18, 0.01), out);
    },
  },
  'enemy.clank': {
    ...shot(3, 50),
    dur: 0.5,
    patch: (c, out, r) => {
      partials(c, out, 0, 480 + r() * 60, METAL, 0.4, 0.35);
      hiss(c, out, r, 0, 0.04, 0.4, 'bandpass', 1800, 1.2, { attack: 0.0005 });
      clicks(c, out, r, 0.06, 0.3, 5, 0.25, 2600, 4);
      tone(c, out, 'sine', 110, 0, 0.1, 0.3, { to: 60 });
    },
  },
  'enemy.air': {
    ...shot(3, 60),
    dur: 0.85,
    patch: (c, out, r) => {
      // The engine sputtering out, then a whistle falling away.
      const sput = tremolo(c, 0, 0.3, 26 + r() * 6, 0.5, 0.5);
      sput.connect(out);
      hiss(c, sput, r, 0, 0.3, 0.55, 'lowpass', 700, 1.2, { to: 250 });
      tone(c, sput, 'sawtooth', 90, 0, 0.3, 0.12, { to: 50 });
      const f = 1500 + r() * 200;
      tone(c, out, 'sine', f, 0.2, 0.6, 0.22, { to: f * 0.35, attack: 0.03 });
    },
  },
  'enemy.leak': {
    ...cue(2, 200),
    dur: 1.25,
    patch: (c, out, r) => {
      horn(c, out, 196, 0, 0.3, 0.3);
      horn(c, out, 156 + r() * 2, 0.32, 0.5, 0.3);
      partials(c, out, 0.05, 880, BELL, 1.1, 0.16);
    },
  },
  'enemy.shieldbreak': {
    ...cue(3, 50),
    dur: 0.32,
    patch: (c, out, r) => {
      const o = osc(c, 'sawtooth', 240 + r() * 40, 0, 0.12);
      jitter(c, o.frequency, 0, 0.12, 45, 160);
      chain(o, filter(c, 'lowpass', 3500, 0.8), env(c, 0, 0.1, 0.35, 0.001), out);
      hiss(c, out, r, 0.08, 0.04, 0.5, 'highpass', 2200, 0.7, { attack: 0.0005 });
      tone(c, out, 'sine', 700, 0.08, 0.18, 0.3, { to: 150 });
    },
  },
  'enemy.shieldup': {
    ...cue(2, 100),
    dur: 0.5,
    patch: (c, out, r) => {
      const t = tremolo(c, 0, 0.45, 11, 0.7, 0.3);
      t.connect(out);
      tone(c, t, 'triangle', 300 + r() * 20, 0, 0.45, 0.3, { to: 620, glideDur: 0.35, attack: 0.15 });
      tone(c, t, 'sine', 600, 0, 0.45, 0.12, { to: 1240, glideDur: 0.35, attack: 0.15 });
    },
  },
  'enemy.heal': {
    ...cue(2, 150),
    dur: 0.8,
    patch: (c, out, r) => {
      partials(c, out, 0, 1320 + r() * 30, BELL, 0.7, 0.2);
      partials(c, out, 0.07, 1760 + r() * 30, BELL, 0.6, 0.16);
      hiss(c, out, r, 0, 0.3, 0.05, 'highpass', 6000, 0.7, { attack: 0.08 });
    },
  },
  'enemy.split': {
    ...cue(3, 60),
    dur: 0.4,
    patch: (c, out, r) => {
      // The rip: a quick train of bright noise tears.
      for (let i = 0; i < 7; i++) hiss(c, out, r, i * 0.018 + r() * 0.005, 0.02, 0.4, 'bandpass', 2600 + r() * 800, 1.5, { attack: 0.0008 });
      const f = 700 + r() * 100;
      const y = osc(c, 'triangle', f, 0.14, 0.2);
      y.frequency.linearRampToValueAtTime(f * 1.9, 0.22);
      y.frequency.linearRampToValueAtTime(f * 1.4, 0.32);
      chain(y, filter(c, 'lowpass', 3000, 0.7), env(c, 0.14, 0.2, 0.3, 0.01), out);
    },
  },
  'enemy.tunnel': {
    ...cue(2, 60),
    dur: 0.4,
    patch: (c, out, r) => {
      tone(c, out, 'sine', 190 + r() * 20, 0, 0.3, 0.55, { to: 85, glideDur: 0.22, attack: 0.01 });
      hiss(c, out, r, 0, 0.3, 0.35, 'bandpass', 500, 3, { to: 180, attack: 0.02 });
    },
  },
  'status.freeze': {
    ...cue(2, 80),
    dur: 0.6,
    patch: (c, out, r) => {
      for (let i = 0; i < 6; i++) tone(c, out, 'sine', 2600 + r() * 1800, 0.02 + i * 0.05 + r() * 0.02, 0.25, 0.1, { attack: 0.004 });
      hiss(c, out, r, 0, 0.5, 0.12, 'highpass', 5000, 0.7, { attack: 0.03 });
    },
  },
  'status.pop': {
    ...cue(4, 40),
    dur: 0.12,
    patch: (c, out, r) => {
      tone(c, out, 'sine', 1250 + r() * 200, 0, 0.05, 0.55, { to: 420, glideDur: 0.035, attack: 0.0006 });
      hiss(c, out, r, 0, 0.02, 0.2, 'highpass', 3500, 0.7, { attack: 0.0004 });
    },
  },
  'status.reverse': {
    ...cue(2, 80),
    dur: 0.4,
    patch: (c, out, r) => {
      const f = 1500 + r() * 100;
      const o = osc(c, 'sine', f, 0, 0.34);
      glide(o.frequency, f, f * 0.4, 0.02, 0.28);
      vibrato(c, o.frequency, 0, 0.34, 9, f * 0.02, 0.02);
      chain(o, env(c, 0, 0.34, 0.3, 0.015, 0.12), out);
    },
  },
};

export const BOSS_SFX: Record<string, SfxDef> = {
  'boss.arrive': {
    ...bossSpec(1, 0),
    dur: 2.1,
    patch: (c, out, r) => {
      // A huge engine revving up, with a clang as it rolls in.
      const rumble = tremolo(c, 0, 2, 8 + r() * 2, 0.7, 0.3);
      const lp = filter(c, 'lowpass', 180, 1.5);
      lp.frequency.setValueAtTime(180, 0);
      lp.frequency.linearRampToValueAtTime(900, 0.8);
      lp.frequency.linearRampToValueAtTime(400, 1.9);
      chain(rumble, lp, env(c, 0, 1.95, 0.32, 0.25, 0.8), out);
      for (const [f, d] of [[46, 0], [69, 7]] as const) {
        const o = osc(c, 'sawtooth', f, 0, 2);
        o.detune.value = d;
        o.frequency.linearRampToValueAtTime(f * 1.25, 0.8);
        o.frequency.linearRampToValueAtTime(f * 1.1, 1.9);
        o.connect(rumble);
      }
      hiss(c, rumble, r, 0, 1.9, 0.35, 'lowpass', 300, 0.7, { attack: 0.3 });
      partials(c, out, 0.45, 260 + r() * 20, METAL, 1.4, 0.28);
    },
  },
  'boss.phase': {
    ...bossSpec(2, 200),
    dur: 1.6,
    patch: (c, out, r) => {
      const o = osc(c, 'sawtooth', 95 + r() * 8, 0, 1.1);
      o.frequency.linearRampToValueAtTime(68, 1.0);
      vibrato(c, o.frequency, 0, 1.1, 3, 4, 0.05);
      const bp = filter(c, 'bandpass', 500, 2);
      glide(bp.frequency, 500, 260, 0, 1.0);
      chain(o, bp, env(c, 0, 1.05, 0.7, 0.12, 0.5), out);
      hiss(c, out, r, 0.55, 1.0, 0.3, 'highpass', 3200, 0.7, { attack: 0.08 });
    },
  },
  'boss.drop': {
    ...bossSpec(2, 100),
    dur: 0.9,
    patch: (c, out, r) => {
      const f = 1400 + r() * 150;
      tone(c, out, 'sine', f, 0, 0.5, 0.2, { to: f * 0.5, attack: 0.03 });
      const t = 0.48;
      tone(c, out, 'sine', 150, t, 0.3, 0.8, { to: 60, glideDur: 0.15, attack: 0.001 });
      hiss(c, out, r, t, 0.25, 0.5, 'lowpass', 900, 0.8, { to: 250, attack: 0.001 });
      partials(c, out, t + 0.01, 380, METAL, 0.35, 0.15);
    },
  },
  'boss.death': {
    ...bossSpec(1, 0),
    dur: 3.2,
    patch: (c, out, r) => {
      tone(c, out, 'sine', 70, 0, 1.6, 0.45, { to: 28, glideDur: 1.2, attack: 0.004 });
      hiss(c, out, r, 0, 3.0, 0.45, 'lowpass', 1400, 0.8, { to: 140, attack: 0.005 });
      hiss(c, out, r, 0.1, 2.4, 0.3, 'bandpass', 250, 1.5, { attack: 0.2 });
      // Debris raining down.
      for (let i = 0; i < 9; i++) {
        const t = 0.35 + r() * 1.8;
        partials(c, out, t, 600 + r() * 900, METAL, 0.2, 0.08);
      }
      clicks(c, out, r, 0.3, 2.0, 18, 0.2, 1600, 2);
    },
  },
};

export const UI_SFX: Record<string, SfxDef> = {
  'ui.click': {
    ...uiSpec(3, 30),
    dur: 0.08,
    patch: (c, out, r) => {
      const f = 1250 + r() * 60;
      chain(osc(c, 'sine', f, 0, 0.06), env(c, 0, 0.05, 0.6, 0.001), out);
      chain(noise(c, 0, 0.02, r() * 1.4), filter(c, 'bandpass', 2600, 2), env(c, 0, 0.015, 0.25, 0.001), out);
    },
  },
  'ui.select': {
    ...uiSpec(3, 40),
    dur: 0.12,
    patch: (c, out, r) => {
      tone(c, out, 'sine', 1100 + r() * 50, 0, 0.04, 0.4, { attack: 0.0008 });
      tone(c, out, 'sine', 1500, 0.035, 0.07, 0.3, { to: 2300, glideDur: 0.04, attack: 0.003 });
    },
  },
  'ui.build': {
    ...uiSpec(3, 60),
    dur: 0.32,
    patch: (c, out, r) => {
      tone(c, out, 'sine', 190 + r() * 15, 0, 0.14, 0.7, { to: 85, glideDur: 0.08, attack: 0.001 });
      hiss(c, out, r, 0, 0.06, 0.35, 'lowpass', 1400, 0.8, { attack: 0.0006 });
      hiss(c, out, r, 0.06, 0.16, 0.45, 'lowpass', 380, 0.9, { attack: 0.004 });
    },
  },
  'ui.upgrade': {
    ...uiSpec(2, 100),
    dur: 0.85,
    patch: (c, out, r) => {
      // A rising ratchet: clicks getting quicker and higher, then a ding.
      let t = 0;
      for (let i = 0; i < 9; i++) {
        hiss(c, out, r, t, 0.015, 0.35, 'bandpass', 1400 + i * 180, 3, { attack: 0.0005 });
        t += 0.042 - i * 0.003;
      }
      partials(c, out, t + 0.02, 1760, BELL, 0.6, 0.35);
    },
  },
  'ui.sell': {
    ...uiSpec(2, 80),
    dur: 0.6,
    patch: (c, out, r) => {
      for (let i = 0; i < 5; i++) coin(c, out, r, i * 0.055 + r() * 0.02, 0.28);
    },
  },
  'ui.error': {
    ...uiSpec(2, 120),
    dur: 0.28,
    patch: (c, out, r) => {
      const o = osc(c, 'square', 170 + r() * 6, 0, 0.22);
      glide(o.frequency, 170, 135, 0.05, 0.15);
      chain(o, filter(c, 'lowpass', 520, 0.8), env(c, 0, 0.22, 0.4, 0.006, 0.06), out);
      tone(c, out, 'sine', 170, 0, 0.2, 0.3, { to: 135, attack: 0.006 });
    },
  },
  'ui.clear': {
    ...uiSpec(2, 100),
    dur: 0.7,
    patch: (c, out, r) => {
      for (let i = 0; i < 10; i++) hiss(c, out, r, r() * 0.35, 0.05 + r() * 0.05, 0.4, 'lowpass', 700 + r() * 500, 1, { attack: 0.001 });
      hiss(c, out, r, 0.2, 0.45, 0.3, 'bandpass', 500, 1.2, { to: 2400, attack: 0.1 });
      tone(c, out, 'sine', 120, 0, 0.15, 0.35, { to: 60 });
    },
  },
  'ui.coins': {
    ...uiSpec(2, 80),
    dur: 0.45,
    patch: (c, out, r) => {
      for (let i = 0; i < 3; i++) coin(c, out, r, i * 0.07 + r() * 0.015, 0.3);
    },
  },
  'ui.wave': {
    ...uiSpec(1, 300),
    dur: 0.72,
    patch: (c, out, r) => {
      // A snare roll swelling into an accent.
      const n = 16;
      for (let i = 0; i < n; i++) {
        const t = i * 0.032;
        hiss(c, out, r, t, 0.03, 0.12 + (0.25 * i) / n, 'highpass', 1500, 0.7, { attack: 0.0008 });
      }
      const t = n * 0.032;
      hiss(c, out, r, t, 0.16, 0.5, 'highpass', 1300, 0.7, { attack: 0.0008 });
      tone(c, out, 'triangle', 190, t, 0.09, 0.3, { attack: 0.0008 });
    },
  },
};

/** Ambience beds: 8 s, faded at both ends so they loop without a click (§17.3). */
function ambience(build: (c: Ctx, out: AudioNode, r: R) => void): SfxDef {
  return {
    ...uiSpec(1, 0),
    bus: 'sfx',
    dur: 8,
    patch: (c, out, r) => build(c, loopFade(c, out, 8), r),
  };
}

/** Wind: noise through a band-pass whose level wanders slowly in gusts. */
function wind(c: Ctx, out: AudioNode, r: R, freq: number, q: number, lo: number, hi: number): void {
  const w = wander(c, r, 8, 1.3, lo, hi);
  w.connect(out);
  chain(noise(c, 0, 8, r() * 1.5), filter(c, 'bandpass', freq, q), w);
}

export const AMBIENCE_SFX: Record<string, SfxDef> = {
  'amb.z1': ambience((c, out, r) => {
    wind(c, out, r, 500, 0.6, 0.08, 0.25);
    // Birdsong: short trills now and then.
    for (let k = 0; k < 4; k++) {
      const t0 = 0.4 + k * 1.8 + r() * 0.8;
      const f = 3000 + r() * 900;
      for (let i = 0; i < 3 + Math.floor(r() * 3); i++) tone(c, out, 'sine', f, t0 + i * 0.07, 0.06, 0.07, { to: f * 1.25, glideDur: 0.04, attack: 0.006 });
    }
    // A distant sheep.
    const t = 3.2 + r() * 1.5;
    const o = osc(c, 'sawtooth', 230 + r() * 20, t, 0.7);
    vibrato(c, o.frequency, t, 0.7, 7, 9, 0.05);
    chain(o, filter(c, 'bandpass', 900, 3), filter(c, 'lowpass', 1600, 0.7), env(c, t, 0.7, 0.06, 0.08, 0.3), out);
  }),
  'amb.z2': ambience((c, out, r) => {
    wind(c, out, r, 900, 0.5, 0.08, 0.3);
    // The wind pump: slow creaks as it turns.
    for (let k = 0; k < 3; k++) {
      const t = 0.8 + k * 2.6 + r() * 0.5;
      const o = osc(c, 'sawtooth', 85 + r() * 20, t, 0.5);
      o.frequency.linearRampToValueAtTime(130 + r() * 20, t + 0.45);
      chain(o, filter(c, 'bandpass', 700, 5), env(c, t, 0.5, 0.08, 0.12, 0.2), out);
    }
  }),
  'amb.z3': ambience((c, out, r) => {
    wind(c, out, r, 1500, 1.2, 0.06, 0.22);
    // A whistling resonance in the cold wind.
    const bp = filter(c, 'bandpass', 900, 8);
    const w = wander(c, r, 8, 2, 0.0, 0.18);
    w.connect(out);
    chain(noise(c, 0, 8, r() * 1.5), bp, w);
    // Ice creaking.
    for (let k = 0; k < 3; k++) {
      const t = 1 + k * 2.4 + r() * 0.8;
      const o = osc(c, 'sawtooth', 60 + r() * 30, t, 0.3);
      o.frequency.linearRampToValueAtTime(200 + r() * 60, t + 0.25);
      chain(o, filter(c, 'bandpass', 1200, 6), env(c, t, 0.28, 0.07, 0.04), out);
    }
  }),
  'amb.z4': ambience((c, out, r) => {
    // A low machine hum, gently wobbling.
    const hum = wander(c, r, 8, 2, 0.5, 0.9);
    hum.connect(out);
    for (const [f, a] of [[50, 0.1], [100, 0.06], [150, 0.03]] as const) {
      const o = osc(c, 'sine', f, 0, 8);
      const g = c.createGain();
      g.gain.value = a;
      o.connect(g).connect(hum);
    }
    chain(osc(c, 'sawtooth', 100, 0, 8), filter(c, 'lowpass', 300, 0.7), (() => {
      const g = c.createGain();
      g.gain.value = 0.025;
      return g;
    })(), hum);
    // Distant clanks and hisses.
    for (let k = 0; k < 5; k++) partials(c, out, 0.5 + k * 1.5 + r() * 0.7, 500 + r() * 400, METAL, 0.4, 0.04);
    for (let k = 0; k < 2; k++) hiss(c, out, r, 1.5 + k * 3.5 + r() * 0.8, 0.7, 0.07, 'highpass', 3500, 0.7, { attack: 0.1 });
  }),
  'amb.z5': ambience((c, out, r) => {
    // A deep rumble.
    const rumble = wander(c, r, 8, 1.6, 0.5, 1);
    rumble.connect(out);
    chain(noise(c, 0, 8, r() * 1.5), filter(c, 'lowpass', 130, 0.8), (() => {
      const g = c.createGain();
      g.gain.value = 0.6;
      return g;
    })(), rumble);
    chain(osc(c, 'sine', 38, 0, 8), (() => {
      const g = c.createGain();
      g.gain.value = 0.06;
      return g;
    })(), rumble);
    // Lava bubbling, and crackles.
    for (let k = 0; k < 7; k++) {
      const t = 0.3 + k * 1.05 + r() * 0.4;
      const f = 90 + r() * 60;
      tone(c, out, 'sine', f, t, 0.1, 0.08, { to: f * 2.2, glideDur: 0.08, attack: 0.01 });
    }
    clicks(c, out, r, 0.2, 7.5, 24, 0.05, 2200, 2);
  }),
};
