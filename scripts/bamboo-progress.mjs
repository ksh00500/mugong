import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/bamboo-family-v1';
const read = async (p) => JSON.parse(await readFile(`${root}/${p}`, 'utf8'));
const provenance = await read('provenance.json');
const requests = await read('generation-requests.json');
for (const r of requests)
  r.status = provenance.some((p) => p.source === r.source) ? 'generated' : 'pending';
await writeFile(`${root}/generation-requests.json`, JSON.stringify(requests, null, 2) + '\n');
const scan = await read('source-scan.json');
const previous = await read('generation-status.json');
if (previous.status !== 'verified-local')
  await writeFile(
    `${root}/generation-status.json`,
    JSON.stringify(
      {
        status: 'generating-and-reviewing',
        updatedAtUTC: new Date().toISOString(),
        characters: 7,
        targetFrames: 420,
        selectedSourceFrames: scan.records.length,
        pendingSourceFrames: scan.missing.length,
        generatedCandidateSources: provenance.length,
        structuralIssues: scan.records.filter((r) => r.component < 0 || r.shared || r.clipped),
        repairQueue: 'repair-queue.json',
        gameApplied: false,
        remoteDeployed: false,
      },
      null,
      2,
    ) + '\n',
  );
console.log(
  JSON.stringify({
    candidates: provenance.length,
    frames: scan.records.length,
    pending: scan.missing.length,
  }),
);
