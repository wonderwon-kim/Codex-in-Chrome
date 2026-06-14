param(
  [Parameter(Mandatory = $true)]
  [string]$ExtensionId,

  [string]$HostName = "com.openai.codex_chrome",
  [string]$InstallDir = "$env:LOCALAPPDATA\CodexChromeNativeHost",
  [string]$NodePath = "node.exe",
  [string]$BridgeApiUrl = "",
  [string]$BridgeToken = ""
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$sourceHost = Join-Path $PSScriptRoot "node-host.mjs"
$targetHost = Join-Path $InstallDir "node-host.mjs"
Copy-Item -LiteralPath $sourceHost -Destination $targetHost -Force

$cmdPath = Join-Path $InstallDir "node-host.cmd"
$envLines = @()
if ($BridgeApiUrl) {
  $envLines += "set CODEX_BRIDGE_API_URL=$BridgeApiUrl"
}
if ($BridgeToken) {
  $envLines += "set CODEX_BRIDGE_TOKEN=$BridgeToken"
}

@(
  "@echo off",
  $envLines,
  "`"$NodePath`" `"$targetHost`""
) | Where-Object { $_ -ne "" } | Set-Content -LiteralPath $cmdPath -Encoding ASCII

$manifestPath = Join-Path $InstallDir "$HostName.json"
$manifest = @{
  name = $HostName
  description = "Codex Chrome native messaging bridge"
  path = $cmdPath
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
New-Item -Path $registryPath -Force | Out-Null
Set-ItemProperty -Path $registryPath -Name "(default)" -Value $manifestPath

Write-Output "Installed native host manifest:"
Write-Output $manifestPath
Write-Output "Registry:"
Write-Output $registryPath
