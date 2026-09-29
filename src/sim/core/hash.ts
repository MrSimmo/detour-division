/** FNV-1a (32-bit) over the JSON serialisation. JSON number formatting is specified by ECMAScript, so equal state gives equal hashes in every engine. */
export function hashState(state: unknown): string {
  const s = JSON.stringify(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
