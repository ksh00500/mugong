param(
    [Parameter(Mandatory)][string]$Destination,
    [Parameter(Mandatory)][string]$Archive,
    [Parameter(Mandatory)][string]$RemotePath,
    [Parameter(Mandatory)][string]$KnownHosts
)
$ErrorActionPreference = 'Stop'
if ($RemotePath -notmatch '^/[A-Za-z0-9_./-]+$' -or $RemotePath -match '/\.\.?(/|$)') {
    throw 'RemotePath must be an absolute path without shell characters or traversal.'
}
# Copy raw bytes into SSH stdin. PowerShell text pipelines corrupt tar archives.
$start = [System.Diagnostics.ProcessStartInfo]::new()
$start.FileName = Join-Path $env:WINDIR 'System32/OpenSSH/ssh.exe'
$start.UseShellExecute = $false
$start.RedirectStandardInput = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
foreach ($argument in @('-o', 'BatchMode=yes', '-o', "UserKnownHostsFile=$KnownHosts", '-o', 'ConnectTimeout=15', $Destination, "cat > '$RemotePath'")) {
    $start.ArgumentList.Add($argument)
}
$process = [System.Diagnostics.Process]::Start($start)
$stdout = $process.StandardOutput.ReadToEndAsync()
$stderr = $process.StandardError.ReadToEndAsync()
$stream = [System.IO.File]::OpenRead((Resolve-Path -LiteralPath $Archive))
try { $stream.CopyTo($process.StandardInput.BaseStream) }
finally { $stream.Dispose(); $process.StandardInput.Close() }
$process.WaitForExit()
$output = $stdout.GetAwaiter().GetResult()
$errorOutput = $stderr.GetAwaiter().GetResult()
if ($output) { Write-Output $output }
if ($errorOutput) { Write-Output $errorOutput }
if ($process.ExitCode -ne 0) { throw "SSH upload failed (exit $($process.ExitCode))" }
Write-Output 'Archive uploaded.'
