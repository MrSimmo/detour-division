The sim hash is FNV-1a over `JSON.stringify`, so key order matters. Never pass sim state through a Zod parse and use the output: Zod rebuilds objects with the declared keys first.

`acceptSnapshot` in `src/meta/save.ts` validates with Zod, then returns a JSON copy of the original record. That was the cause of an R-SAVE-2 mismatch: same tick and wave, but a different hash.
