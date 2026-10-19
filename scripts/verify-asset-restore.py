"""Restore retained archives into a new isolated directory and hash every file."""
import hashlib, json, pathlib, tarfile
root = pathlib.Path.cwd().resolve()
audit = json.loads((root/'docs/asset-management/archive-audit.json').read_text('utf-8'))
catalogue = json.loads((root/'asset-manifest.json').read_text('utf-8'))
target = root/'.validation/asset-restored-v1'
target.mkdir(exist_ok=False)
restored = {}
for scope, name in audit['retained'].items():
    with tarfile.open(root/'.asset-bundles'/name, 'r|gz') as archive:
        for member in archive:
            if member.isdir(): continue
            name = member.name.removeprefix('./')
            dest = (target/name).resolve()
            if not member.isfile() or not dest.is_relative_to(target) or name in restored:
                raise RuntimeError('Unsafe/duplicate restore member: '+name)
            dest.parent.mkdir(parents=True, exist_ok=True)
            h = hashlib.sha256()
            with dest.open('xb') as out:
                stream = archive.extractfile(member)
                for block in iter(lambda: stream.read(1024*1024), b''):
                    out.write(block); h.update(block)
            restored[name] = {'bytes':dest.stat().st_size,'sha256':h.hexdigest()}
expected = {f['path']:{'bytes':f['bytes'],'sha256':f['sha256']} for f in catalogue['files']}
if restored != expected: raise RuntimeError('Restored contents mismatch')
report = {'asOf':'2026-10-20','files':len(restored),'bytes':sum(f['bytes'] for f in restored.values()),'catalogueId':catalogue['id'],'target':'.validation/asset-restored-v1','allFilesMatch':True}
(root/'docs/asset-management/restore-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
