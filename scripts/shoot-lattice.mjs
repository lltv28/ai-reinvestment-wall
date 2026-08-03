import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.LATTICE_URL ?? 'http://localhost:3010/lattice';
const OUT = 'C:/tmp/ai-reinvestment-wall';

// The first loop starts after a 4s wide beat, then runs for 15s.
const SHOTS = [
  { name: 'wide', ms: 2_000 },
  { name: 'payments', ms: 8_000 },
  { name: 'pooled', ms: 12_000 },
  { name: 'ai-brain', ms: 14_000 },
  { name: 'ads', ms: 16_000 },
  { name: 'new-leads', ms: 18_000 },
];

mkdirSync(OUT, { recursive: true });

for (const shot of SHOTS) {
  await run(CHROME, [
    '--headless=new',
    '--window-size=1920,1080',
    `--virtual-time-budget=${shot.ms}`,
    `--screenshot=${OUT}/${shot.name}.png`,
    URL,
  ]);
  console.log(`shot ${shot.name}`);
}
