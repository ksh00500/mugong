import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const queue = JSON.parse(await readFile(`${root}/repair-queue.json`, 'utf8'));
queue.find((r) => r.id === 'tombguard-front-right').reason +=
  ' Whole body is also too small compared with approved front. Regenerate physical head/body matching Input2, not the shrunken candidate.';
queue.push({
  id: 'tombguard-right',
  poses: Array.from({ length: 12 }, (_, i) => i),
  reason:
    'EAST full side profile. Original candidate body is too small to fit long spear. Draw same physical head90-100px / standing300-330px as approved front Input2, with ONE continuous spear shaft in BOTH separated grips, ONE silver point and red tassel at forward RIGHT end only; rear LEFT end plain wood. Level forward thrust contact, planted foot, coherent shoulders, no shrinking to tool bbox.',
});
const scan = JSON.parse(await readFile(`${root}/source-scan.json`, 'utf8'));
for (const issue of scan.records.filter((r) => r.clipped || r.component < 0 || r.shared)) {
  let item = queue.find((r) => r.id === issue.id);
  if (!item)
    queue.push(
      (item = {
        id: issue.id,
        poses: [],
        reason:
          'Restore complete body, hands, hair and weapon within clear alpha margin. Do not shrink the physical head or body to fit a weapon.',
      }),
    );
  if (!item.poses.includes(issue.pose)) item.poses.push(issue.pose);
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
  for (const [reference, originalTargets] of groups) {
    const split = job.character === 'tombguard' && originalTargets.length === 12;
    for (const targets of split
      ? [originalTargets.slice(0, 6), originalTargets.slice(6)]
      : [originalTargets]) {
      const rebuild = split || originalTargets.length === 12;
      const id =
          reference.replace(/\.png$/, '') +
          '-repair-v2' +
          (split ? `-${targets[0].pose === 0 ? 'locomotion' : 'combat'}` : ''),
        source = id + '.png',
        prompt = id + '.prompt.txt';
      const g = targets[0].cell;
      const names = [
        'idle guard',
        'left-step walk',
        'passing walk',
        'right-step walk',
        'TINY hurt',
        'prone death',
        'early attack load',
        'maximum anticipation',
        'CONTACT / RELEASE',
        'low followthrough',
        'withdrawal',
        'return ready',
      ];
      const locations = targets
        .map(
          (t, i) =>
            `Drawing ${i + 1}: logical pose ${t.pose}, ${names[t.pose]}${rebuild ? '' : ', original cell ' + JSON.stringify(t.cell)}.`,
        )
        .join('\n');
      const layout = split
        ? 'PORTRAIT TWO columns THREE rows, SIX complete independent figures, approximately1088x1448.'
        : rebuild
          ? 'PORTRAIT THREE columns FOUR rows, TWELVE complete independent figures, approximately1088x1448.'
          : g.rectangle
            ? 'Retain original canvas dimensions and irregular drawing positions.'
            : `Retain native canvas dimensions and EXACT ${g.columns} columns x ${g.rows} rows.`;
      const text = `${rebuild ? 'Regenerate' : 'Edit'} the supplied transparent MUGONG sprite sheet. ${layout} ${rebuild ? 'Physical head90-110px, standing300-330px, matching approved Input2 exactly.' : 'Preserve exact physical head diameter, body scale and palette of the idle pose in Input1.'} Same physical scale throughout; never fit bodies to weapon extent. At least32px clear alpha around every complete figure/tool. No text, background, shadows, gradient, aura, VFX, particles, trails or projectiles.\n${rebuild ? 'Generate these poses in ROW-MAJOR order:' : 'Correct ONLY these poses, preserving other drawings unchanged:'}\n${locations}\n${item.reason}\nInput1 original candidate CAMERA and identity; Input2 approved front identity and PHYSICAL BODY SCALE ONLY, never copy its front camera. Camera must stay identical to Input1 idle for all poses. Exactly TWO connected shoulder-elbow-wrist chains, fixed weapon hands, stable spine and natural hip/knee/ankle chains. Grip meets hand. One continuous shaft, never extra handles or disconnected limbs.\n`;
      await writeFile(`${root}/${prompt}`, text);
      const front = jobs.find((j) => j.character === job.character && j.view === 0);
      const selected = targets.map((t, i) => ({
        ...t,
        cell: rebuild ? { columns: split ? 2 : 3, rows: split ? 3 : 4, index: i } : t.cell,
      }));
      requests.push({
        id,
        jobId: job.id,
        source,
        prompt,
        reference,
        front: front.source,
        targets: selected,
      });
    }
  }
}
await writeFile(`${root}/repair-queue.json`, JSON.stringify(queue, null, 2) + '\n');
await writeFile(`${root}/repair-requests.json`, JSON.stringify(requests, null, 2) + '\n');
console.log(JSON.stringify(requests));
