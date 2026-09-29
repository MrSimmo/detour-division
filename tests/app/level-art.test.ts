// Every terrain feature a level uses must have art baked for that level's zone (§14.3, ADR-0006).
// The scene skips a missing terrain sprite rather than failing, so this is where a gap shows up.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) as { sprites: Record<string, string> };
const NEEDS: Record<string, string[]> = {
  '#': ['rock.0'],
  b: ['blocker.0'],
  o: ['tunnel'],
  '=': ['bridge.h', 'bridge.v'],
  x: ['restricted'],
  '~': ['water.00'],
  i: ['ice.00'],
  t: ['trench.00'],
  '>': ['conveyor.e.0'],
  '<': ['conveyor.w.0'],
  '^': ['conveyor.n.0'],
  v: ['conveyor.s.0'],
};

describe('level art', () => {
  // Zone folders only: Finder leaves .DS_Store files beside them.
  for (const zone of readdirSync('data/levels').filter((n) => /^z\d$/.test(n))) {
    for (const f of readdirSync(`data/levels/${zone}`).filter((n) => n.endsWith('.json'))) {
      it(`${f}: every terrain it uses is baked for ${zone}`, () => {
        const lv = JSON.parse(readFileSync(`data/levels/${zone}/${f}`, 'utf8')) as { zone: number; tiles: string[] };
        const missing = new Set<string>();
        for (const ch of new Set(lv.tiles.join(''))) for (const k of NEEDS[ch] ?? []) if (!manifest.sprites[`terrain.z${lv.zone}.${k}`]) missing.add(`'${ch}' → terrain.z${lv.zone}.${k}`);
        expect([...missing]).toEqual([]);
      });
    }
  }
});
