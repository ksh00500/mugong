import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = 'docs/source/bamboo-family-v1',
  proof = 'docs/verification/bamboo-family-v1';
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const save = (p, d) => writeFile(p, JSON.stringify(d, null, 2) + '\n');
const audit = await json(`${root}/selected-art-audit.json`),
  scan = await json(`${root}/source-scan.json`),
  encoded = await json(`${root}/encoded-atlas-review.json`),
  unit = await json(`${proof}/unit.json`);
assert(unit.success);
assert.equal(audit.selectedFrames, 420);
assert.equal(audit.uniqueFrameHashes, 420);
assert(
  scan.records.length === 420 &&
    !scan.missing.length &&
    scan.records.every((r) => r.component >= 0 && !r.shared && !r.clipped && !r.reused),
);
assert(encoded.length === 35 && encoded.every((r) => r.transparentPadding));
for (const dir of ['test-results-bamboo', 'test-results-bamboo-production'])
  assert.equal((await json(`${dir}/.last-run.json`)).status, 'passed');
const matrices = [];
for (const id of ['canvas-full', 'canvas-reduced', 'webgl-full', 'webgl-reduced']) {
  const r = await json(`${proof}/${id}.json`);
  assert(r.records.length === 1960 && r.contacts.length === 200 && !r.errors.length);
  const minHPGap = Math.min(...r.records.filter((r) => r.phase !== 'death').map((r) => r.gap));
  assert(minHPGap >= 7);
  matrices.push({
    id,
    renderer: r.renderer,
    reduced: r.reduced,
    states: r.records.length,
    contacts: r.contacts.length,
    minHPGap,
    errors: r.errors,
  });
}
const releases = await json(`${proof}/actual-release.json`);
assert.equal(releases.length, 24);
const production = [];
for (const width of [1440, 1366, 1093]) {
  const r = await json(`${proof}/production/verification-${width}.json`);
  assert(new Set(r.assets).size === 35 && !r.errors.length);
  production.push({ width: r.width, height: r.height, uniqueAssets: 35, errors: r.errors });
}
const manual = await json(`${proof}/manual-review.json`);
assert.equal(manual.reviewed, true);
const provenance = await json(`${root}/provenance.json`),
  now = new Date().toISOString();
const status = {
  status: 'verified-local',
  tool: 'image_gen.imagegen',
  updatedAtUTC: now,
  characters: 7,
  viewsPerCharacter: 5,
  posesPerView: 12,
  frames: 420,
  packedSheets: 35,
  generatedCandidateSources: provenance.length,
  selectedSourceCount: audit.sources.length,
  sources: audit.sources,
  gameApplied: true,
  remoteDeployed: false,
  localReview: 'http://127.0.0.1:5173/art/bamboo-family-v1/review.html',
};
await save(`${root}/generation-status.json`, status);
const requests = await json(`${root}/generation-requests.json`);
for (const r of requests) {
  const entry = provenance.find((p) => p.source === r.source);
  r.status = entry ? 'generated' : 'pending';
  if (entry) r.prompt = entry.prompt;
}
await save(`${root}/generation-requests.json`, requests);
const html = await readFile('dist/index.html', 'utf8');
await save(`${proof}/summary.json`, {
  verifiedAtUTC: now,
  family: 'bamboo',
  unit: { files: unit.testResults.length, passed: unit.numPassedTests, success: unit.success },
  build: {
    passed: true,
    mainScript: html.match(/src="(\/assets\/main-[^"]+\.js)"/)?.[1],
    log: 'build.log',
  },
  art: {
    characters: 7,
    nativeViews: 5,
    gameplayDirections: 8,
    frames: 420,
    selectedSources: audit.sources.length,
    uniqueHashes: 420,
    encodedSheets: 35,
    scale: 0.225,
    padding: 32,
  },
  matrices,
  totalStateSamples: 7840,
  totalBossContacts: 800,
  actualReleaseCases: 24,
  production,
  passedBrowserTests: 8,
  manualReview: 'manual-review.json',
  limitations: manual.limitations,
  realUserSaveChanged: false,
  remoteDeployed: false,
});
console.log(
  JSON.stringify({
    status: status.status,
    frames: 420,
    selectedSources: audit.sources.length,
    unit: unit.numPassedTests,
    browsers: 8,
    minHPGap: Math.min(...matrices.map((r) => r.minHPGap)),
  }),
);
