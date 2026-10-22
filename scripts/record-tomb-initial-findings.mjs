import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1',
  jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const back = jobs.find((j) => j.id === 'tombtrapper-back');
for (let i = 0; i < 12; i++) back.poseSourceCells[i] = { columns: 4, rows: 3, index: i };
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
for (const view of ['front-right', 'right', 'rear-right']) {
  const p = `${root}/tombtrapper-${view}.prompt.txt`;
  const text = await readFile(p, 'utf8');
  await writeFile(p, text.replace(/\nVIEW HAND OWNERSHIP:[\s\S]*$/, ''));
}
await writeFile(
  `${root}/visual-issues.json`,
  JSON.stringify(
    [
      {
        id: 'tombtrapper-right',
        poses: [0, 1, 2, 3, 4, 11],
        issue:
          'Near RIGHT arm incorrectly holds LEFT pickaxe while far arm holds trap; attacking right arm is correct. Repair locomotion/hurt/ready tool ownership.',
      },
      {
        id: 'tombtrapper-rear-right',
        poses: [6, 7],
        issue:
          'Preparation shows trap over LEFT shoulder and pick on RIGHT. Correct only these poses: trap anatomical RIGHT screen-right, left pick screen-left.',
      },
      {
        id: 'tombtrapper-back',
        poses: [9],
        issue:
          'Followthrough left hand appears loose/open on pick grip; tighten left grip without changing right empty release or back camera.',
      },
    ],
    null,
    2,
  ) + '\n',
);
console.log(
  'Back source actual4x3 grid saved; first three direction prompts restored to exact generated input.',
);
