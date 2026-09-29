// `npm run gen-schema`: writes data/schema/level.schema.json from the Zod level schema
// (DESIGN.md §14.2), so level files get editor autocompletion via their $schema.
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { LevelZ } from '../src/data/schemas.ts';

const schema = z.toJSONSchema(LevelZ, { io: 'input' });
writeFileSync('data/schema/level.schema.json', JSON.stringify({ title: 'Detour Division level', ...schema }, null, 1) + '\n');
console.log('wrote data/schema/level.schema.json');
