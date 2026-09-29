// Writes public/assets/audio.json: every sound, music layer stem and stinger key, mapped to its
// synth (DESIGN.md §17.1). To drop in a recording, change an entry to { "file": "audio/….m4a" }
// and put the file under public/audio/. Keys already pointing at files are kept.
// Usage: node tools/gen-audio-manifest.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { defaultManifest, type AudioManifest } from '../src/audio/system.ts';

const path = 'public/assets/audio.json';
const old: AudioManifest = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as AudioManifest) : {};
const next = defaultManifest();
for (const [k, v] of Object.entries(old)) if ('file' in v && k in next) next[k] = v;
writeFileSync(path, JSON.stringify(next, null, 1) + '\n');
console.log(`${path}: ${Object.keys(next).length} keys, ${Object.values(next).filter((v) => 'file' in v).length} files`);
