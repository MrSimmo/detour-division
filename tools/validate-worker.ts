// Worker thread for validate-levels: validates the level files it is sent.
import { parentPort } from 'node:worker_threads';
import type { Campaign } from '../src/meta/progression.ts';
import { loadBalance, readJson } from './lib/data.ts';
import { validateLevel } from './lib/validate.ts';

const b = loadBalance();
const campaign = readJson('data/campaign.json') as Campaign;
parentPort!.on('message', (file: string | null) => {
  if (file === null) process.exit(0);
  parentPort!.postMessage(validateLevel(file, b, campaign));
});
parentPort!.postMessage('ready');
