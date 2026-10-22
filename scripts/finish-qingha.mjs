import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = 'docs/source/qingha-family-v1',
  proof = 'docs/verification/qingha-family-v1';
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const save = async (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n');
const audit = await json(`${root}/selected-art-audit.json`);
const unit = await json(`${proof}/unit.json`),
  focused = await json(`${proof}/final-focused-unit.json`);
assert(unit.success && focused.success);
assert.equal(audit.selectedFrames, 420);
assert.equal(audit.uniqueFrameHashes, 420);
const scan = await json(`${root}/source-scan.json`),
  encoded = await json(`${root}/encoded-atlas-review.json`);
assert(
  scan.records.length === 420 &&
    scan.records.every((r) => !r.clipped && !r.shared && !r.reused && r.component >= 0),
);
assert(encoded.length === 35 && encoded.every((r) => r.transparentPadding));
for (const dir of ['test-results-qingha', 'test-results-qingha-production'])
  assert.equal((await json(`${dir}/.last-run.json`)).status, 'passed');
const matrices = [];
for (const id of ['canvas-full', 'canvas-reduced', 'webgl-full', 'webgl-reduced']) {
  const result = await json(`${proof}/${id}.json`);
  assert(result.records.length === 1960 && result.contacts.length === 192 && !result.errors.length);
  const minHPGap = Math.min(...result.records.filter((r) => r.phase !== 'death').map((r) => r.gap));
  assert(minHPGap >= 7);
  matrices.push({
    id,
    renderer: result.renderer,
    reduced: result.reduced,
    states: result.records.length,
    contacts: result.contacts.length,
    minHPGap,
    errors: result.errors,
  });
}
const releases = await json(`${proof}/actual-release.json`);
assert.equal(releases.length, 24);
const production = [];
for (const width of [1440, 1366, 1093]) {
  const r = await json(`${proof}/production/verification-${width}.json`);
  assert(new Set(r.assets).size === 35 && !r.errors.length);
  production.push({
    width: r.width,
    height: r.height,
    uniqueAssets: new Set(r.assets).size,
    errors: r.errors,
  });
}
const now = new Date().toISOString();
const provenance = await json(`${root}/provenance.json`);
const extras = await json(`${root}/extra-repair-requests.json`);
extras[0].cell = { rectangle: [250, 1088, 1000, 1445] };
for (const [key, id, poses, source] of [
  [
    'cheolmu-rear-right-load-right-arm',
    'cheolmu-rear-right',
    [6, 7],
    'cheolmu-rear-right-repair-18.png',
  ],
  ['cheolmu-back-max-load-right-arm', 'cheolmu-back', [7], 'cheolmu-back-repair-19.png'],
  ['qingharaider-back-contact-down', 'qingharaider-back', [8], 'qingharaider-back.png'],
]) {
  const entry = provenance.find((p) => p.source === `${key}.png`);
  assert(entry);
  const e = {
    id,
    key,
    poses,
    source,
    prompt: await readFile(`${root}/${entry.prompt}`, 'utf8'),
    output: entry.source,
    promptFile: entry.prompt,
  };
  const previous = extras.findIndex((x) => x.key === key);
  if (previous < 0) extras.push(e);
  else extras[previous] = e;
}
await save(`${root}/extra-repair-requests.json`, extras);
const ground = (await json(`${root}/ground-proposals.json`)).filter((r) => r.fromFigureBottom > 12);
const manual = {
  reviewedAtUTC: now,
  method:
    'Direct visual review of generated sources, all seven contact sheets and actual browser screenshots; no anatomy certification.',
  contactSheets: [
    'qingharaider',
    'qinghaguard',
    'qinghabowman',
    'madabong',
    'nojin',
    'cheolmu',
    'hanmugeuk',
  ].map((id) => `contact/${id}.png`),
  groundPoints: ground.map((r) => ({
    ...r,
    decision:
      'Retain reviewed boot-ground coordinate; weapon tip may extend below it. No frame scaling applied.',
  })),
  corrections: [
    'Dao north contact lowered after actual renderer comparison',
    'Right-hand chain ownership on rear views',
    'Two-handed straight spear grip and front/back foreshortening',
    'Wide prone/follow-through source selection without cropping or rescaling',
  ],
  limitations: [
    'Fine body/head dimensions were visually compared, not numerically certified',
    'Boss special patterns still share representative attack cycles',
    'Death uses one fading pose',
    'Opposite directions use horizontal mirroring',
  ],
};
await save(`${proof}/manual-review.json`, manual);
await save(`${root}/generation-status.json`, {
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
  localReview: 'http://127.0.0.1:5173/art/qingha-family-v1/review.html',
});
const html = await readFile('dist/index.html', 'utf8');
await save(`${proof}/summary.json`, {
  verifiedAtUTC: now,
  family: 'qingha',
  unit: { files: unit.testResults.length, passed: unit.numPassedTests, success: unit.success },
  finalFocusedUnit: { passed: focused.numPassedTests, success: focused.success },
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
    uniqueHashes: audit.uniqueFrameHashes,
    encodedSheets: encoded.length,
    scale: 0.225,
    padding: 32,
  },
  matrices,
  totalStateSamples: matrices.reduce((n, r) => n + r.states, 0),
  totalBossContacts: matrices.reduce((n, r) => n + r.contacts, 0),
  actualReleaseCases: releases.length,
  production,
  passedBrowserTests: 8,
  manualReview: 'manual-review.json',
  limitations: manual.limitations,
  realUserSaveChanged: false,
  remoteDeployed: false,
});
console.log(
  JSON.stringify({
    status: 'verified-local',
    frames: 420,
    selectedSources: audit.sources.length,
    unit: unit.numPassedTests,
    browsers: 8,
    minHPGap: Math.min(...matrices.map((r) => r.minHPGap)),
  }),
);
