// The copyable text save code (DESIGN.md §20): `DD1-` + base64url(deflate-raw(save JSON)) + `.` +
// the CRC-32 of the JSON in hex. Uses the platform's CompressionStream (Safari 16.4+, Node 18+).
import { crc32 } from '../meta/save.ts';

const PREFIX = 'DD1-';

async function pipe(bytes: Uint8Array, t: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(t));
  return new Uint8Array(await out.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

const hex = (n: number): string => n.toString(16).padStart(8, '0');

export async function encodeSaveCode(json: string): Promise<string> {
  const raw = new TextEncoder().encode(json);
  return `${PREFIX}${toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')))}.${hex(crc32(raw))}`;
}

/** Returns the save JSON inside a code. Throws on anything that isn't an intact code. */
export async function decodeSaveCode(code: string): Promise<string> {
  const s = code.replace(/\s+/g, '');
  const dot = s.lastIndexOf('.');
  if (!s.startsWith(PREFIX) || dot < 0) throw new Error('this is not a Detour Division save code');
  let raw: Uint8Array;
  try {
    raw = await pipe(fromBase64Url(s.slice(PREFIX.length, dot)), new DecompressionStream('deflate-raw'));
  } catch {
    throw new Error('this save code is damaged');
  }
  if (hex(crc32(raw)) !== s.slice(dot + 1)) throw new Error('this save code is damaged');
  return new TextDecoder().decode(raw);
}
