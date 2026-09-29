// The page's Content Security Policy forbids eval (DESIGN.md §20). Two libraries would otherwise
// generate code at runtime, and even their feature probes log a CSP violation: Pixi's shader and
// uniform-upload generators, and Zod's JIT. This module switches both to their eval-free paths, and
// must be the first import in main.ts: level data is parsed as soon as its module loads.
import 'pixi.js/unsafe-eval';
import { z } from 'zod';

z.config({ jitless: true });
