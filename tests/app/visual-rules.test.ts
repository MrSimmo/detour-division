// §16.7 visual rules that a test can check: V-1 (colours only from tokens) and V-5 (no emoji, no backdrop-filter).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, ext));
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

/** Comments may mention colours ("#E69F00 is the CB orange"); only code counts. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// The token files and the art palette are where colours are defined (§16.3).
const EXEMPT = /(^|\/)(palette[\w-]*\.ts|tokens\.css|tokens\.ts)$/;

describe('visual rules', () => {
  it('V-1: no hex or rgb literals outside the token files and the art palette', () => {
    const hits: string[] = [];
    for (const f of files('src', /\.(ts|css)$/)) {
      if (EXEMPT.test(f)) continue;
      code(readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\brgba?\(\s*\d/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it('V-5: no emoji in UI strings, and no backdrop-filter in CSS', () => {
    const emoji: string[] = [];
    for (const f of files('src', /\.ts$/)) {
      code(readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          if (/\p{Extended_Pictographic}/u.test(line)) emoji.push(`${f}:${i + 1}`);
        });
    }
    expect(emoji).toEqual([]);
    const css = files('src', /\.css$/).filter((f) => /backdrop-filter/.test(code(readFileSync(f, 'utf8'))));
    expect(css).toEqual([]);
  });
});
