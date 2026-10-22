import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
const qs = JSON.parse(await readFile(`${root}/second-repair-requests.json`, 'utf8'));
const mappings = [
  {
    jobId: 'jeokho-back',
    pose: 8,
    index: 1,
    reason:
      'Source0 shows an overhead load. Source1 lowers both arms away beyond head and is the forward contact.',
  },
  {
    jobId: 'jeokho-back',
    pose: 9,
    index: 2,
    reason: 'Source2 holds the far-side strike with a lower torso and planted boots.',
  },
  {
    jobId: 'seokmun-back',
    pose: 8,
    index: 1,
    reason:
      'Source0 is a raised hammer. Source1 drops right hammer ahead beside torso, above boot line.',
  },
  {
    jobId: 'seokmun-back',
    pose: 9,
    index: 3,
    reason: 'Source3 holds a lower forward lean, maintaining left shield and right lowered hammer.',
  },
  {
    jobId: 'wolryeong-back',
    pose: 9,
    index: 2,
    reason:
      'Source1 turns the blade sideways/down-right. Source2 holds the far-side north cut with blade above crown and a slight torso followthrough.',
  },
];
for (const m of mappings) {
  const q = qs.find((q) => q.jobId === m.jobId && q.targets.some((t) => t.pose === m.pose));
  q.targets.find((t) => t.pose === m.pose).cell.index = m.index;
}
await writeFile(`${root}/second-repair-requests.json`, JSON.stringify(qs, null, 2) + '\n');
await writeFile(`${root}/v3-contact-cell-review.json`, JSON.stringify(mappings, null, 2) + '\n');
