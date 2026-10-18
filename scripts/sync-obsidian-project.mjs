import { readFile, writeFile, readdir, mkdir, access, rename, unlink } from 'node:fs/promises';
import { resolve, join, basename, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';

const date = process.argv.find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) ?? '2026-10-06';
const apply = process.argv.includes('--apply');
const revision = process.argv.find((x) => x.startsWith('--revision='))?.slice(11);
if (revision && !/^[a-z][a-z0-9-]{0,63}$/.test(revision)) throw Error('Invalid bundle revision');
const repo = resolve('.');
const vault = resolve('C:/Users/user/Documents/AI-Memory/projects/murim-roguelike/murim-roguelike');
const bundle = join(repo, 'docs', 'obsidian-sync', date + (revision ? '-' + revision : ''));
const notes = join(bundle, 'notes');
const before = join(bundle, 'before');
const manifestPath = join(bundle, 'manifest.json');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exists = async (path) =>
  access(path).then(
    () => true,
    () => false,
  );
const names = (await readdir(notes)).filter((x) => x.endsWith('.md')).sort();
// Historical daily logs remain valid wiki targets without rewriting them.
const targets = new Set([...names, ...(await readdir(vault)).filter(x => x.endsWith('.md'))].map((x) => basename(x, '.md')));
const allowed = new Set([
  'README.md',
  'project-overview.md',
  'current-status.md',
  'decisions.md',
  'art-and-assets.md',
  'gameplay-systems.md',
  'architecture.md',
  'known-issues.md',
  'backlog.md',
  `worklog-${date}.md`,
]);
const texts = new Map();
const permalinks = new Set();
let links = 0,
  fileLinks = 0;
for (const name of names) {
  if (!allowed.has(name) || basename(name) !== name) throw Error(`Unexpected note: ${name}`);
  const dest = resolve(vault, name),
    rel = relative(vault, dest);
  if (rel.startsWith('..') || isAbsolute(rel)) throw Error('Destination outside project notes');
  const bytes = await readFile(join(notes, name)),
    text = bytes.toString('utf8');
  if (text.includes('\uFFFD') || text.startsWith('\uFEFF')) throw Error(`Encoding: ${name}`);
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n'))
    throw Error(`Front matter: ${name}`);
  if (!text.includes(`as_of: '${date}'`)) throw Error(`Wrong date: ${name}`);
  const permalink = text.match(/^permalink: (.+)$/m)?.[1]?.trim();
  if (!permalink?.startsWith('murim-roguelike/') || permalinks.has(permalink))
    throw Error(`Invalid or duplicate permalink: ${name}`);
  permalinks.add(permalink);
  for (const match of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    if (!targets.has(match[1])) throw Error(`Missing wiki target: ${name} -> ${match[1]}`);
    links++;
  }
  for (const match of text.matchAll(/\]\((file:\/\/\/[^)]+)\)/g)) {
    const localPath = decodeURIComponent(new URL(match[1]).pathname.slice(1));
    if (!(await exists(localPath))) throw Error(`Missing source: ${name} -> ${localPath}`);
    fileLinks++;
  }
  if (/ssh\.app\.daytona\.io|ssh \S+@|Bearer\s+[A-Za-z0-9]/.test(text))
    throw Error(`Credentials prohibited: ${name}`);
  texts.set(name, bytes);
}
if (names.length !== allowed.size) throw Error('Expected complete ten-note project bundle');

if (!apply) {
  if (await exists(manifestPath))
    throw Error('Prepared snapshot already exists; apply it or choose a new date');
  await mkdir(before, { recursive: true });
  const entries = [];
  for (const name of names) {
    const dest = join(vault, name);
    const prior = (await exists(dest)) ? await readFile(dest) : null;
    if (prior) await writeFile(join(before, name), prior);
    entries.push({
      name,
      beforeSha256: prior ? hash(prior) : null,
      afterSha256: hash(texts.get(name)),
    });
  }
  await writeFile(
    manifestPath,
    JSON.stringify({ date, vault, entries, wikiLinks: links, fileLinks }, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      prepared: entries.length,
      backedUp: entries.filter((x) => x.beforeSha256).length,
      wikiLinks: links,
      fileLinks,
    }),
  );
} else {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (
    manifest.vault !== vault ||
    manifest.date !== date ||
    manifest.entries.length !== names.length
  )
    throw Error('Snapshot destination/date mismatch');
  // Check every file before any mutation; do not overwrite concurrent user edits.
  for (const entry of manifest.entries) {
    if (!texts.has(entry.name) || hash(texts.get(entry.name)) !== entry.afterSha256)
      throw Error(`Prepared content changed: ${entry.name}`);
    const dest = join(vault, entry.name);
    const current = (await exists(dest)) ? hash(await readFile(dest)) : null;
    if (current !== entry.beforeSha256 && current !== entry.afterSha256)
      throw Error(`Concurrent vault edit: ${entry.name}`);
  }
  const written = [];
  for (const entry of manifest.entries) {
    const dest = join(vault, entry.name);
    if ((await exists(dest)) && hash(await readFile(dest)) === entry.afterSha256) continue;
    const temp = join(vault, `.${entry.name}.mugong-${date}.tmp`);
    await writeFile(temp, texts.get(entry.name), { flag: 'wx' });
    try {
      await rename(temp, dest);
    } catch (error) {
      await unlink(temp);
      throw error;
    }
    written.push(entry.name);
  }
  const verified = [];
  for (const entry of manifest.entries) {
    const afterSha256 = hash(await readFile(join(vault, entry.name)));
    if (afterSha256 !== entry.afterSha256) throw Error(`Read-back mismatch: ${entry.name}`);
    verified.push({ name: entry.name, sha256: afterSha256 });
  }
  const report = {
    date,
    vault,
    written,
    verified,
    wikiLinks: links,
    fileLinks,
    originalNotesBackedUp: manifest.entries.filter((x) => x.beforeSha256).length,
    unrelatedVaultFilesChanged: false,
    gameCodeChanged: false,
    realUserSaveChanged: false,
    gameTestsRerun: false,
    publicDeploymentPerformed: false,
  };
  await writeFile(join(bundle, 'sync-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      written: written.length,
      verified: verified.length,
      wikiLinks: links,
      fileLinks,
      originalNotesBackedUp: report.originalNotesBackedUp,
    }),
  );
}
