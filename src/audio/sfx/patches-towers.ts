// Tower firing sounds, one patch per tower and tier (DESIGN.md §17.3), plus the impacts.
// Each tier keeps its tower's character and gets heavier: lower, longer, more layers.
// Retrigger windows follow the fire rates in data/balance/towers.json: fast guns merge more.
import { chain, env, filter, glide, noise, osc, vibrato } from '../synth.ts';
import type { SfxDef } from './player.ts';
import { GLASS, METAL, blast, clicks, hiss, jitter, partials, shot, tone, tremolo } from './patches-kit.ts';

type Tier = 1 | 2 | 3;
const TIERS: Tier[] = [1, 2, 3];

/** Rattler: a pop-pop that gets heavier each tier; T3 adds a tinkle of spent brass. */
function rattler(tier: Tier): SfxDef {
  return {
    ...shot(4, 45),
    dur: tier === 3 ? 0.32 : 0.16,
    patch: (c, out, r) => {
      const pops = tier === 1 ? 2 : 3;
      for (let i = 0; i < pops; i++) {
        const t = i * (0.045 - tier * 0.006) + r() * 0.004;
        const f = 900 - tier * 120 + r() * 80;
        chain(noise(c, t, 0.05, r() * 1.4), filter(c, 'bandpass', f * 2.2, 1.4), env(c, t, 0.035 + tier * 0.006, 0.7, 0.001), out);
        const o = osc(c, 'triangle', f, t, 0.05);
        glide(o.frequency, f, f * 0.45, t, 0.04);
        chain(o, env(c, t, 0.04, 0.35 + tier * 0.08, 0.001), out);
      }
      if (tier === 3) for (let i = 0; i < 3; i++) chain(osc(c, 'sine', 3800 + r() * 900, 0.12 + i * 0.05, 0.1), env(c, 0.12 + i * 0.05, 0.08, 0.08, 0.001), out);
    },
  };
}

/** Treacle Pump: a glug (a rising bubble of syrup) or two, then a sticky splat. */
function treacle(tier: Tier): SfxDef {
  return {
    ...shot(3, 90),
    dur: 0.3 + tier * 0.06,
    patch: (c, out, r) => {
      const glugs = tier === 1 ? 1 : 2;
      for (let i = 0; i < glugs; i++) {
        const t = i * 0.075;
        const f = 170 - tier * 18 + r() * 20;
        tone(c, out, 'sine', f, t, 0.07, 0.55, { to: f * 2.1, glideDur: 0.06, attack: 0.004 });
      }
      const t = glugs * 0.075 + 0.01;
      hiss(c, out, r, t, 0.12 + tier * 0.04, 0.45 + tier * 0.05, 'lowpass', 1500 - tier * 200, 0.9, { to: 300 });
      tone(c, out, 'triangle', 220 - tier * 25, t, 0.08, 0.3, { to: 90 });
      if (tier === 3) hiss(c, out, r, t + 0.08, 0.14, 0.25, 'bandpass', 900, 3, { to: 350 });
    },
  };
}

/** Skylark: a rocket whoosh with a bird-like chirp on launch; T3 fires a pair. */
function skylark(tier: Tier): SfxDef {
  return {
    ...shot(3, 70),
    dur: 0.42 + tier * 0.06,
    patch: (c, out, r) => {
      const rockets = tier === 3 ? 2 : 1;
      for (let k = 0; k < rockets; k++) {
        const t = k * 0.11;
        hiss(c, out, r, t, 0.28 + tier * 0.05, 0.5, 'bandpass', 700, 1.6, { to: 2600 + tier * 400, attack: 0.03 });
        const f = 2000 + tier * 150 + r() * 200;
        tone(c, out, 'sine', f, t + 0.01, 0.07, 0.22, { to: f * 1.6, glideDur: 0.05 });
        tone(c, out, 'sine', f * 1.2, t + 0.09, 0.06, tier > 1 ? 0.18 : 0.12, { to: f * 1.9, glideDur: 0.05 });
        tone(c, out, 'triangle', 160 - tier * 15, t, 0.06, 0.25, { to: 70 });
      }
    },
  };
}

/** Thumper: the thoomp of a mortar shell leaving its tube; T3's tube rings. */
function thumper(tier: Tier): SfxDef {
  return {
    ...shot(3, 60),
    dur: tier === 3 ? 0.45 : 0.3,
    patch: (c, out, r) => {
      const f = 95 - tier * 10 + r() * 6;
      tone(c, out, 'sine', f, 0, 0.22 + tier * 0.03, 0.8, { to: f * 0.55, glideDur: 0.12, attack: 0.003 });
      hiss(c, out, r, 0, 0.1, 0.45, 'bandpass', 380 - tier * 40, 2.5, { to: 180 });
      hiss(c, out, r, 0, 0.04, 0.25, 'lowpass', 2500, 0.7, { attack: 0.0005 });
      if (tier === 3) partials(c, out, 0.01, 330 + r() * 20, METAL, 0.4, 0.12);
    },
  };
}

/** Scorcher: a whumph of igniting fuel, then crackle; T3 roars. */
function scorcher(tier: Tier): SfxDef {
  return {
    ...shot(3, 90),
    dur: 0.45 + tier * 0.1,
    patch: (c, out, r) => {
      const len = 0.35 + tier * 0.1;
      hiss(c, out, r, 0, len, 0.6, 'lowpass', 250, 0.8, { to: 900 + tier * 200, attack: 0.04 });
      tone(c, out, 'sine', 65, 0, 0.25, 0.35, { to: 110, glideDur: 0.08, attack: 0.02 });
      if (tier === 3) hiss(c, out, r, 0.03, len, 0.3, 'bandpass', 1200, 1.2, { to: 700, attack: 0.05 });
      clicks(c, out, r, 0.08, len, 6 + tier * 4, 0.3, 3200, 3);
    },
  };
}

/** Sparkplug: a jittery electric zap and crackle; later tiers arc more and snap harder. */
function sparkplug(tier: Tier): SfxDef {
  return {
    ...shot(3, 70),
    dur: 0.25 + tier * 0.08,
    patch: (c, out, r) => {
      const arcs = tier;
      for (let k = 0; k < arcs; k++) {
        const t = k * 0.07 + r() * 0.01;
        const f = 180 + r() * 60 - tier * 15;
        const o = osc(c, 'sawtooth', f, t, 0.12);
        jitter(c, o.frequency, t, 0.12, 37 + r() * 20, f * 0.6);
        chain(o, filter(c, 'lowpass', 4200, 0.8), env(c, t, 0.1 + tier * 0.02, 0.35, 0.001), out);
      }
      clicks(c, out, r, 0, 0.12 + tier * 0.08, 5 + tier * 3, 0.35, 4000, 2.5);
      if (tier === 3) tone(c, out, 'sine', 120, 0, 0.18, 0.4, { to: 50, glideDur: 0.12 });
    },
  };
}

/** Sunbeam: a rising hum as the lens charges, then a searing shimmer as the beam burns. */
function sunbeam(tier: Tier): SfxDef {
  return {
    ...shot(2, 100),
    dur: 0.75 + tier * 0.12,
    patch: (c, out, r) => {
      const rise = 0.22;
      const hum = osc(c, 'triangle', 180, 0, rise + 0.05);
      glide(hum.frequency, 180, 520 + tier * 60, 0, rise);
      chain(hum, filter(c, 'lowpass', 1800, 0.7), env(c, 0, rise + 0.04, 0.3, rise * 0.9), out);
      const burn = 0.4 + tier * 0.12;
      const shimmer = tremolo(c, rise, burn, 17 + r() * 4, 0.6, 0.4);
      shimmer.connect(out);
      for (const [ratio, amp] of [[1, 1], [1.5, 0.6], [2.01, 0.5], [2.99, tier > 1 ? 0.35 : 0]] as const) {
        if (!amp) continue;
        const f = (620 + tier * 40) * ratio;
        const o = osc(c, 'sine', f, rise, burn);
        vibrato(c, o.frequency, rise, burn, 7, f * 0.01, 0.02);
        chain(o, env(c, rise, burn, 0.14 * amp, 0.02), shimmer);
      }
      hiss(c, out, r, rise, burn, 0.18 + tier * 0.04, 'bandpass', 5200, 1.2, { attack: 0.02 });
      if (tier === 3) clicks(c, out, r, rise + 0.05, burn, 8, 0.2, 2600, 3);
    },
  };
}

/** Icebox: a crystalline crack as the pulse freezes everything round it; T3 leaves a glassy shimmer. */
function icebox(tier: Tier): SfxDef {
  return {
    ...shot(3, 60),
    dur: 0.5 + tier * 0.12,
    patch: (c, out, r) => {
      hiss(c, out, r, 0, 0.05, 0.6, 'highpass', 2600, 0.7, { attack: 0.0005 });
      partials(c, out, 0.003, 1900 + r() * 150 - tier * 100, GLASS, 0.35 + tier * 0.08, 0.3);
      tone(c, out, 'sine', 140, 0, 0.12, 0.35, { to: 70 });
      if (tier > 1) partials(c, out, 0.05, 2800 + r() * 200, GLASS, 0.3, 0.15);
      if (tier === 3) for (let i = 0; i < 5; i++) tone(c, out, 'sine', 3200 + r() * 1800, 0.1 + i * 0.07, 0.25, 0.06, { attack: 0.01 });
    },
  };
}

/** Tea Urn: a kettle coming to the boil and whistling (played when it is built or upgraded). */
function teaurn(tier: Tier): SfxDef {
  return {
    ...shot(2, 150),
    dur: 0.5 + tier * 0.18,
    patch: (c, out, r) => {
      const len = 0.4 + tier * 0.16;
      const f = 1500 + r() * 80;
      const w = osc(c, 'sine', f * 0.94, 0.04, len);
      w.frequency.linearRampToValueAtTime(f, 0.04 + len * 0.5);
      vibrato(c, w.frequency, 0.04, len, 6, f * 0.012, 0.05);
      chain(w, env(c, 0.04, len, 0.3, len * 0.35, len * 0.2), out);
      if (tier > 1) {
        const w2 = osc(c, 'sine', f * 1.26, 0.08, len * 0.8);
        chain(w2, env(c, 0.08, len * 0.8, 0.14, len * 0.3), out);
      }
      hiss(c, out, r, 0.02, len, 0.12, 'bandpass', f * 2, 4, { attack: len * 0.3 });
      if (tier === 3) for (let i = 0; i < 4; i++) tone(c, out, 'sine', 160 + r() * 40, i * 0.06, 0.05, 0.2, { to: 340, glideDur: 0.04 });
    },
  };
}

/** Bellower: a comic horn honk; T2 honks twice, T3 blasts a wobbling chord. */
function bellower(tier: Tier): SfxDef {
  return {
    ...shot(2, 100),
    dur: 0.55 + tier * 0.12,
    patch: (c, out, r) => {
      const honks = tier === 2 ? 2 : 1;
      const len = tier === 3 ? 0.55 : 0.32;
      for (let k = 0; k < honks; k++) {
        const t = k * 0.36;
        const notes = tier === 3 ? [110, 165, 220] : [123 - k * 20];
        for (const f of notes) {
          const m = c.createGain();
          m.gain.value = 0.5;
          for (const d of [-12, 12]) {
            const o = osc(c, 'sawtooth', f * (1 + (r() - 0.5) * 0.01), t, len + 0.05);
            o.detune.value = d;
            o.frequency.setValueAtTime(o.frequency.value, t + len * 0.7);
            o.frequency.linearRampToValueAtTime(f * 0.9, t + len);
            if (tier === 3) vibrato(c, o.frequency, t, len, 9, f * 0.03, 0.1);
            o.connect(m);
          }
          const lp = filter(c, 'lowpass', 400, 3);
          lp.frequency.setValueAtTime(400, t);
          lp.frequency.linearRampToValueAtTime(1900, t + 0.05);
          lp.frequency.linearRampToValueAtTime(900, t + len);
          chain(m, lp, env(c, t, len, 0.4 / Math.sqrt(notes.length), 0.02, len * 0.5), out);
        }
      }
    },
  };
}

/** Bubbler: a blub (a bubble swelling) and a pop; T3 blows a cluster. */
function bubbler(tier: Tier): SfxDef {
  return {
    ...shot(3, 80),
    dur: 0.28 + tier * 0.08,
    patch: (c, out, r) => {
      const blubs = tier === 3 ? 4 : tier;
      for (let k = 0; k < blubs; k++) {
        const t = k * 0.055 + r() * 0.01;
        const f = 240 + r() * 90 - tier * 20;
        tone(c, out, 'sine', f, t, 0.08, 0.45, { to: f * 2.3, glideDur: 0.07, attack: 0.006 });
      }
      const t = blubs * 0.055 + 0.02;
      tone(c, out, 'sine', 950 + r() * 150, t, 0.045, 0.4, { to: 320, glideDur: 0.03, attack: 0.0008 });
      hiss(c, out, r, t, 0.02, 0.2, 'highpass', 3000, 0.7, { attack: 0.0005 });
    },
  };
}

/** Pie Chucker: the spoon's boing; T3 flings three pies. */
function piechucker(tier: Tier): SfxDef {
  return {
    ...shot(3, 70),
    dur: tier === 3 ? 0.62 : 0.42,
    patch: (c, out, r) => {
      const pies = tier === 3 ? 3 : 1;
      for (let k = 0; k < pies; k++) {
        const t = k * 0.1;
        const f = 260 + r() * 30 - tier * 20 + k * 25;
        const o = osc(c, 'triangle', f, t, 0.34);
        // The spring: a fast, dying wobble around a rising pitch.
        const lfo = osc(c, 'sine', 22, t, 0.34);
        const d = c.createGain();
        d.gain.setValueAtTime(f * 0.35, t);
        d.gain.exponentialRampToValueAtTime(1, t + 0.3);
        lfo.connect(d).connect(o.frequency);
        o.frequency.linearRampToValueAtTime(f * 1.5, t + 0.3);
        chain(o, filter(c, 'lowpass', 2200, 0.8), env(c, t, 0.32, 0.5, 0.003), out);
      }
      hiss(c, out, r, 0, 0.05, 0.25, 'bandpass', 1400, 1.5, { attack: 0.001 });
    },
  };
}

const MAKERS = { rattler, treacle, skylark, thumper, scorcher, sparkplug, sunbeam, icebox, teaurn, bellower, bubbler, piechucker };

export const TOWER_SFX: Record<string, SfxDef> = Object.fromEntries(
  Object.entries(MAKERS).flatMap(([type, make]) => TIERS.map((n) => [`tower.${type}.t${n}`, make(n)])),
);

export const BOOM_SFX: Record<string, SfxDef> = {
  'boom.thumper': {
    ...blast(),
    dur: 1.1,
    patch: (c, out, r) => {
      // A short whistle down, then the boom: a pitched thump plus low noise.
      const w = osc(c, 'sine', 2200 + r() * 300, 0, 0.18);
      glide(w.frequency, 2200, 700, 0, 0.16);
      chain(w, env(c, 0, 0.17, 0.08, 0.02, 0.1), out);
      const t = 0.18;
      const b = osc(c, 'sine', 110, t, 0.6);
      glide(b.frequency, 110 + r() * 15, 38, t, 0.35);
      chain(b, env(c, t, 0.55, 0.9, 0.003), out);
      chain(noise(c, t, 0.9, r() * 1.4), filter(c, 'lowpass', 900, 0.8), env(c, t, 0.8, 0.6, 0.004), out);
    },
  },
  'boom.piechucker': {
    ...blast(),
    dur: 0.45,
    patch: (c, out, r) => {
      tone(c, out, 'sine', 170 + r() * 20, 0, 0.12, 0.7, { to: 70, glideDur: 0.08, attack: 0.001 });
      hiss(c, out, r, 0, 0.2, 0.7, 'lowpass', 1600, 1, { to: 350, attack: 0.001 });
      hiss(c, out, r, 0.03, 0.25, 0.35, 'bandpass', 1100, 3, { to: 300 });
      clicks(c, out, r, 0.05, 0.2, 5, 0.25, 1800, 2);
    },
  },
  'boom.skylark': {
    ...blast(),
    dur: 0.55,
    patch: (c, out, r) => {
      tone(c, out, 'sine', 320 + r() * 40, 0, 0.18, 0.6, { to: 80, glideDur: 0.1, attack: 0.001 });
      hiss(c, out, r, 0, 0.35, 0.55, 'bandpass', 1500, 0.9, { to: 500, attack: 0.001 });
      clicks(c, out, r, 0.04, 0.35, 8, 0.3, 3000, 3);
    },
  },
  'boom.small': {
    ...blast(),
    dur: 0.3,
    patch: (c, out, r) => {
      tone(c, out, 'sine', 130 + r() * 20, 0, 0.14, 0.7, { to: 55, glideDur: 0.1, attack: 0.001 });
      hiss(c, out, r, 0, 0.18, 0.5, 'lowpass', 1000, 0.8, { to: 250, attack: 0.001 });
    },
  },
};

