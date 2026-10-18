import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const root = 'docs/source/desert-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`));
const requests = JSON.parse(await readFile(`${root}/generation-requests.json`));
const catalogue = JSON.parse(await readFile(`${root}/boss-catalogue.json`));
const requestSources = new Set(requests.map((r) => r.source));
assert.equal(jobs.length, 35);
assert.ok(requests.length >= 40);
assert.equal(requestSources.size, requests.length);
assert.equal(new Set(jobs.map((j) => j.id)).size, 35);
assert.equal(catalogue.length, 4);
assert.deepEqual(catalogue.map((b) => b.phase), [1, 2, 3, 4]);
for (let slot = 0; slot < 7; slot++) {
  const views = jobs.filter((j) => j.slot === slot);
  assert.equal(views.length, 5);
  assert.deepEqual(views.map((j) => j.view), [0, 1, 2, 3, 4]);
  assert.equal(new Set(views.map((j) => j.character)).size, 1);
}
let frames = 0;
for (const j of jobs) {
  const sourceCells = new Set();
  for (let pose = 0; pose < 12; pose++) {
    const source = j.poseSources?.[pose] ?? j.source;
    assert.ok(requestSources.has(source), `${j.id}/${pose}: missing generation request`);
    const cell = j.poseSourceCells[pose];
    assert.ok(Number.isInteger(cell.index) && cell.index >= 0 && cell.index < cell.columns * cell.rows);
    assert.ok([4, 6, 12].includes(cell.columns * cell.rows));
    const key = `${source}:${cell.index}`;
    assert.ok(!sourceCells.has(key), `${j.id}/${pose}: duplicate source cell`);
    sourceCells.add(key);
    frames++;
  }
}
for (const r of requests) {
  assert.ok(jobs.some((j) => j.id === r.jobId));
  assert.ok(['pending', 'generated'].includes(r.status));
  const prompt = await readFile(`${root}/${r.prompt}`, 'utf8');
  assert.ok(prompt.length > 150);
  for (const ref of r.references) await access(ref);
}
let availableSources = 0;
for (const source of requestSources) {
  try { await access(`${root}/${source}`); availableSources++; }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}
console.log(JSON.stringify({ preparation: 'valid', identities: 7, views: 5, logicalSheets: 35, logicalFrames: frames, sourceSheets: requests.length, availableSources, note: 'Input validation only; no visual or runtime approval.' }));
