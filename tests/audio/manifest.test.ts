// §17.1 drop-in audio: the shipped manifest lists every key (run `npm run gen-audio-manifest`).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultManifest } from '../../src/audio/system.ts';

describe('audio manifest', () => {
  it('public/assets/audio.json has exactly the keys the game knows', () => {
    const shipped = JSON.parse(readFileSync('public/assets/audio.json', 'utf8')) as Record<string, unknown>;
    expect(Object.keys(shipped).sort()).toEqual(Object.keys(defaultManifest()).sort());
  });
});
