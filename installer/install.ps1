#Requires -Version 5.1
<#
  Codex for Free - Windows installer (v1.3.0)

  Adds DeepSeek as an OPTIONAL provider to the official Codex desktop app.
  What it does not do:
    - never renames, re-signs or copies the official app
    - never touches the ChatGPT login, so the official account keeps working
    - never writes the API key to a log, a commit or stdout

  Usage:
    powershell -ExecutionPolicy Bypass -File installer\install.ps1
    powershell -ExecutionPolicy Bypass -File installer\install.ps1 -Key $key -Yes
    powershell -ExecutionPolicy Bypass -File installer\install.ps1 -Model deepseek-v4-pro -Effort max
#>
[CmdletBinding()]
param(
  [string]$Key,
  [string]$Provider = 'deepseek',
  [string]$Model = 'deepseek-flash',
  [ValidateSet('low', 'high', 'max')][string]$Effort = 'high',
  [string]$BaseUrl,
  [switch]$Yes,
  [switch]$SkipCli
)

$ErrorActionPreference = 'Stop'

# Node writes UTF-8; a 936 console would render its Chinese output as mojibake.
try {
  chcp 65001 | Out-Null
  [Console]::OutputEncoding = [Text.Encoding]::UTF8
  $OutputEncoding = [Text.Encoding]::UTF8
} catch {}

$repo = Split-Path -Parent $PSScriptRoot
$cli = Join-Path $repo 'bin\cfm.mjs'
$configPath = Join-Path $env:USERPROFILE '.codex\config.toml'
$appDir = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex'

function Write-Step([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg) { Write-Host "  ok  $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  !   $msg" -ForegroundColor Yellow }
function Fail([string]$msg) { Write-Host "  !!  $msg" -ForegroundColor Red; exit 1 }

Write-Step 'preflight'
if (-not (Test-Path -LiteralPath $cli)) { Fail "unexpected layout: $cli not found" }
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Fail 'node not found in PATH (need >= 24)' }
$nodeVersion = (& node -v).TrimStart('v')
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 24) { Fail "node $nodeVersion is too old (need >= 24)" }
if (Test-Path -LiteralPath $appDir) { Write-Ok "official Codex app found: $appDir" }
else { Write-Warn "official Codex app not found at $appDir; writing provider config anyway" }
Write-Ok "node $nodeVersion / PowerShell $($PSVersionTable.PSVersion)"

Write-Step 'API key'
# CFM_KEY keeps the secret out of the process command line.
if (-not $Key -and $env:CFM_KEY) { $Key = $env:CFM_KEY }
if (-not $Key) {
  if ($Yes) { Fail 'no key supplied: pass -Key or drop -Yes to be prompted' }
  $secure = Read-Host -AsSecureString 'DeepSeek API key (input hidden)'
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $Key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$Key = $Key.Trim()
if ($Key.Length -lt 8) { Fail 'API key looks empty or too short' }
if ($Key -notmatch '^[A-Za-z0-9._-]+$') { Fail 'API key contains whitespace or control characters' }
Write-Ok "key accepted (length $($Key.Length); the value is never printed)"

Write-Step 'backup config.toml'
$beforeTables = 0
if (Test-Path -LiteralPath $configPath) {
  $stamp = Get-Date -Format 'yyyyMMddHHmmss'
  $backup = "$configPath.bak-cfm-$stamp"
  Copy-Item -LiteralPath $configPath -Destination $backup -Force
  $beforeTables = (Select-String -LiteralPath $configPath -Pattern '^\[' -AllMatches).Count
  Write-Ok "backup: $backup ($beforeTables tables preserved)"
} else {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $configPath) | Out-Null
  Write-Ok 'no config.toml yet; a minimal one will be created'
}

Write-Step "register provider: $Provider"
$addArgs = @('providers', 'add', $Provider, '--key-stdin')
if ($BaseUrl) { $addArgs += @('--base-url', $BaseUrl) }
$Key | & node $cli @addArgs
if ($LASTEXITCODE -ne 0) { Fail 'providers add failed (key was not saved)' }

Write-Step 'sync capabilities from GET /models'
& node $cli providers sync $Provider
if ($LASTEXITCODE -ne 0) { Fail 'providers sync failed (network or key rejected)' }

Write-Step 'rebuild model catalog'
& node $cli catalog build $Provider
if ($LASTEXITCODE -ne 0) { Fail 'catalog build failed' }

Write-Step "select $Model with effort=$Effort"
& node $cli providers use $Provider --model $Model --effort $Effort
if ($LASTEXITCODE -ne 0) { Fail "providers use failed (effort $Effort may be unsupported)" }

Write-Step 'validate config.toml'
& node $cli config check
if ($LASTEXITCODE -ne 0) { Fail 'config.toml is invalid; restore the .bak-cfm-* backup and report the lint output' }

if (-not $SkipCli) {
  Write-Step 'install cfm shim'
  & node $cli install-cli
}

$afterTables = (Select-String -LiteralPath $configPath -Pattern '^\[' -AllMatches).Count
Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host "  config      $configPath"
Write-Host "  provider    $Provider / $Model / effort=$Effort"
Write-Host "  tables       before=$beforeTables after=$afterTables (the delta is the managed provider block)"
Write-Host ''
Write-Host 'Next:'
Write-Host '  cfm doctor --json           # full status as JSON'
Write-Host '  cfm providers test           # /models + /responses'
Write-Host '  codex exec "say hi"          # run the CLI with the new provider'
Write-Host ''
Write-Host 'The official ChatGPT login is untouched; account features keep working.'
