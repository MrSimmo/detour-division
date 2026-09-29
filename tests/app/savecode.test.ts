// §20 the copyable text save code: DD1- + base64url(deflate-raw(JSON)) + CRC32 (R-SAVE-1 round trip).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeSaveCode, encodeSaveCode } from '../../src/app/savecode.ts';
import { migrateProfile, readSaveFile, saveFileText } from '../../src/meta/save.ts';

const p = migrateProfile(JSON.parse(readFileSync('tests/fixtures/profile-v1.json', 'utf8')));

describe('text save code', () => {
  it('R-SAVE-1: encodes a profile to a DD1- code and back without loss', async () => {
    const code = await encodeSaveCode(saveFileText(p));
    expect(code).toMatch(/^DD1-[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    expect(readSaveFile(await decodeSaveCode(code))).toEqual(p);
  });

  it('is shorter than the JSON it carries', async () => {
    const json = saveFileText(p);
    expect((await encodeSaveCode(json)).length).toBeLessThan(json.length);
  });

  it('tolerates spaces and line breaks from copying, and rejects a damaged code', async () => {
    const code = await encodeSaveCode(saveFileText(p));
    const wrapped = `  ${code.slice(0, 20)}\n${code.slice(20)}  `;
    expect(readSaveFile(await decodeSaveCode(wrapped))).toEqual(p);
    const i = 10;
    const bad = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    await expect(decodeSaveCode(bad)).rejects.toThrow();
    await expect(decodeSaveCode('hello')).rejects.toThrow(/not a Detour Division save code/);
  });
});
