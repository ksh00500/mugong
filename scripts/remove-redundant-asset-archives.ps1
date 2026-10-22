$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path '.').Path
$bundleRoot = (Resolve-Path '.asset-bundles').Path
if ($bundleRoot -ne (Join-Path $taskRoot '.asset-bundles')) { throw 'Unexpected archive directory' }
if ((Get-Item -LiteralPath $bundleRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Archive directory is a link' }
$catalogue = Get-Content asset-manifest.json -Raw | ConvertFrom-Json
$audit = Get-Content docs/asset-management/archive-audit.json -Raw | ConvertFrom-Json
$restore = Get-Content docs/asset-management/restore-verification.json -Raw | ConvertFrom-Json
$remote = Get-Content docs/asset-management/git-verification.json -Raw | ConvertFrom-Json
$http = Get-Content docs/verification/asset-inventory-v1/http-media.json -Raw | ConvertFrom-Json
if (!$restore.allFilesMatch -or $restore.catalogueId -ne $catalogue.id -or $restore.files -ne $catalogue.files.Count) { throw 'Restore gate failed' }
if (!$remote.freshRemoteClone -or !$remote.allFileSha256Matched -or $remote.runtimeFiles -ne 1018 -or $remote.runtimeId -ne 'd05a97c29b4c392f') { throw 'Git backup gate failed' }
if (!$http.sha256Matched -or $http.files -ne 1018) { throw 'HTTP media gate failed' }
foreach ($region in 0..9) {
    $proof = Get-Content "docs/verification/asset-inventory-v1/region-$region.json" -Raw | ConvertFrom-Json
    if (!$proof.ready -or !$proof.bag -or $proof.errors.Count -or $proof.failed.Count) { throw 'Browser gate failed' }
}
# The first commit must remain available in the fresh remote clone.
$cloneCommit = git -C .validation/asset-remote-clone rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $cloneCommit -ne $remote.commit) { throw 'Backup checkout changed' }
# Verify retained container bytes again before removing any old containers.
foreach ($name in @($audit.retained.runtime, $audit.retained.authoring)) {
    $path = Join-Path $bundleRoot $name
    $sidecar = Get-Content -LiteralPath ($path + '.json') -Raw | ConvertFrom-Json
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sidecar.sha256) { throw 'Retained archive changed' }
}
$targets = @()
foreach ($entry in $audit.archives) {
    if (!$entry.contentRedundant -or $entry.uncoveredMembers.Count -or $entry.problems.Count) { continue }
    if ($entry.file -notmatch '^mugong-(runtime|authoring)-[0-9a-f]{16}\.tar\.gz$') { throw 'Invalid archive filename' }
    if ($entry.replacement -notin @($audit.retained.runtime, $audit.retained.authoring)) { throw 'Replacement is not retained' }
    $absolute = (Resolve-Path -LiteralPath (Join-Path $bundleRoot $entry.file)).Path
    if ((Split-Path $absolute -Parent) -ne $bundleRoot -or !$absolute.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Target escaped workspace' }
    $item = Get-Item -LiteralPath $absolute
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Not a regular archive' }
    if ($item.Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw 'Candidate changed since audit' }
    $targets += @{ path = $absolute; entry = $entry }
}
$records = @()
foreach ($target in $targets) {
    Remove-Item -LiteralPath $target.path
    if (Test-Path -LiteralPath $target.path) { throw 'Archive removal failed' }
    $records += @{ file = $target.entry.file; bytes = $target.entry.bytes; sha256 = $target.entry.sha256; replacement = $target.entry.replacement; deleted = $true; reason = 'Every member byte-for-byte covered by verified restored retained archive' }
    @{ asOf = '2026-10-20'; deleted = $records; totalBytes = ($records | Measure-Object bytes -Sum).Sum; retained = $audit.retained; publicImagesDeleted = 0; authoringImagesDeleted = 0; metadataSidecarsPreserved = $true } | ConvertTo-Json -Depth 8 | Set-Content docs/asset-management/cleanup-result.json -Encoding utf8
}
$records | Measure-Object bytes -Sum | Select-Object Count,Sum
