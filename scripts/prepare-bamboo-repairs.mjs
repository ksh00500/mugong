import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/bamboo-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const queue = JSON.parse(await readFile(`${root}/repair-queue.json`, 'utf8'));
const scan = JSON.parse(await readFile(`${root}/source-scan.json`, 'utf8'));
for (const issue of scan.records.filter((r) => r.clipped || r.component < 0 || r.shared)) {
  let entry = queue.find((r) => r.id === issue.id);
  if (!entry)
    queue.push(
      (entry = {
        id: issue.id,
        poses: [],
        reason:
          'Source drawing touches/crosses image boundary. Restore the complete body and weapon inside transparent margin without shrinking the head/body.',
      }),
    );
  if (!entry.poses.includes(issue.pose)) entry.poses.push(issue.pose);
}
const requests = [];
for (const item of queue) {
  const job = jobs.find((j) => j.id === item.id);
  if (!job) throw Error(item.id);
  const groups = new Map();
  for (const pose of item.poses) {
    const source = job.poseSources?.[pose] ?? job.source;
    const targets = groups.get(source) ?? [];
    targets.push({ pose, cell: job.poseSourceCells[pose] });
    groups.set(source, targets);
  }
  for (const [reference, targets] of groups) {
    const suffix = reference.replace(/\.png$/, '') + '-repair-v2';
    const source = suffix + '.png',
      prompt = suffix + '.prompt.txt';
    const grid = targets[0].cell;
    const instructions = `Edit this transparent sprite sheet. Preserve the exact camera, character identity, anatomical proportions, physical head diameter, torso and limb thickness, and per-pose drawing scale of the reference. Preserve its ${grid.columns} columns by ${grid.rows} rows layout. Do not zoom, crop, normalize to weapon extent, or make contact poses smaller/larger. Every head is the same physical pixel size as the idle head in this reference. Keep all complete figures, hands, weapon ends and hair inside generous empty alpha margins; move their positions within their cells if needed, rather than resizing bodies. No text, labels, background, lighting aura, ground shadows, motion streaks, projectiles or VFX.\n\nCorrect ONLY these target cells (zero-based row-major indexes): ${targets.map((t) => t.cell.index).join(', ')}. ${item.reason}\n\n${targets.map((t) => `Cell ${t.cell.index}: logical pose ${t.pose} (${['idle', 'left-step walk', 'passing walk', 'right-step walk', 'tiny hurt', 'prone death', 'early anticipation', 'maximum anticipation', 'attack contact', 'low followthrough', 'withdraw', 'return guard'][t.pose]}).`).join('\n')}\nNatural shoulder-elbow-wrist and hip-knee-ankle chains; weapon grip attaches to the correct hand. Keep ONE continuous weapon where specified, never two disconnected staffs or detached hands. All non-target cells should stay visually identical. Transparent background.`;
    await writeFile(`${root}/${prompt}`, instructions);
    requests.push({
      id: suffix,
      jobId: job.id,
      source,
      prompt,
      reference,
      targets,
      text: instructions,
    });
  }
}
await writeFile(`${root}/repair-queue.json`, JSON.stringify(queue, null, 2) + '\n');
await writeFile(
  `${root}/repair-requests.json`,
  JSON.stringify(
    requests.map(({ text, ...r }) => r),
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(requests.map(({ text, ...r }) => r)));
