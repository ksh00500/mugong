"""Read-only tar audit: content, not filename/date, determines redundancy.

An archive is a deletion candidate only when every regular member has the same
bytes in a verified retained archive and the current asset catalogue. Unique
historical revisions, unknown paths, links and malformed archives stay intact.
"""
import hashlib, json, pathlib, tarfile

root = pathlib.Path.cwd().resolve()
folder = root / '.asset-bundles'
catalogue = json.loads((root / 'asset-manifest.json').read_text('utf-8'))
current = {f['path']: f for f in catalogue['files']}
retained = {}
for scope in ('runtime', 'authoring'):
    files = [f for f in catalogue['files'] if (scope == 'runtime') == f['path'].startswith('public/')]
    identity = hashlib.sha256(json.dumps([{k: f[k] for k in ('path','bytes','sha256')} for f in files], separators=(',', ':')).encode()).hexdigest()[:16]
    retained[scope] = f'mugong-{scope}-{identity}.tar.gz'

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()

def inspect(path):
    members, problems = {}, []
    with tarfile.open(path, 'r|gz') as archive:
        for member in archive:
            name = member.name.removeprefix('./')
            if member.isdir(): continue
            if not member.isfile() or name.startswith('/') or '..' in pathlib.PurePosixPath(name).parts or name in members:
                problems.append(name + ': unsupported/unsafe/duplicate member'); continue
            h = hashlib.sha256()
            stream = archive.extractfile(member)
            for block in iter(lambda: stream.read(1024 * 1024), b''): h.update(block)
            members[name] = {'bytes': member.size, 'sha256': h.hexdigest()}
    return members, problems

retained_members, reports = {}, []
for scope, name in retained.items():
    path = folder / name
    members, problems = inspect(path)
    expected = {k: {'bytes':v['bytes'],'sha256':v['sha256']} for k,v in current.items() if (scope == 'runtime') == k.startswith('public/')}
    sidecar = json.loads(path.with_name(name + '.json').read_text('utf-8'))
    digest = sha(path)
    if problems or members != expected or digest != sidecar['sha256'] or path.stat().st_size != sidecar['bytes']:
        raise RuntimeError('Retained archive verification failed: ' + name)
    retained_members[scope] = members
    print(json.dumps({'retained':name,'files':len(members),'sha256':digest}), flush=True)

for path in sorted(folder.glob('*.tar.gz')):
    if path.name in retained.values(): continue
    scope = 'runtime' if path.name.startswith('mugong-runtime-') else 'authoring'
    members, problems = inspect(path)
    unique = [k for k,v in members.items() if retained_members[scope].get(k) != v]
    report = {'file':path.name,'bytes':path.stat().st_size,'sha256':sha(path),'members':len(members),'replacement':retained[scope],'uncoveredMembers':unique,'problems':problems,'contentRedundant':bool(members) and not unique and not problems,'deleteApproved':False}
    reports.append(report)
    print(json.dumps({k:v for k,v in report.items() if k not in ('uncoveredMembers',)}), flush=True)

out = root / 'docs/asset-management/archive-audit.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({'asOf':'2026-10-20','retained':retained,'archives':reports,'note':'Content redundancy alone is not deletion approval; verify references, running processes, Git backup and restore test first.'},indent=2)+'\n', encoding='utf-8')
