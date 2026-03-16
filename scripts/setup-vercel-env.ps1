param(
  [string[]]$Targets = @("development", "preview", "production"),
  [switch]$SkipUpload,
  [switch]$SkipLink,
  [switch]$SkipDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RunnerConfig {
  $vercel = Get-Command vercel -ErrorAction SilentlyContinue
  if ($vercel) {
    return @{
      Command = $vercel.Source
      Prefix = @()
    }
  }

  $npx = Get-Command npx -ErrorAction SilentlyContinue
  if ($npx) {
    return @{
      Command = $npx.Source
      Prefix = @("vercel@latest")
    }
  }

  throw "Neither 'vercel' nor 'npx' was found. Install Node.js first."
}

function Invoke-Vercel {
  param(
    [string[]]$Arguments,
    [string]$InputText
  )

  $runner = Get-RunnerConfig
  $allArguments = @($runner.Prefix + $Arguments)

  if ($PSBoundParameters.ContainsKey("InputText")) {
    $InputText | & $runner.Command @allArguments
  } else {
    & $runner.Command @allArguments
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Vercel command failed: $($Arguments -join ' ')"
  }
}

function Read-PlainValue {
  param(
    [string]$Label,
    [string]$Default = "",
    [switch]$Required
  )

  while ($true) {
    $prompt = if ($Default) { "$Label [$Default]" } else { $Label }
    $value = Read-Host $prompt

    if ([string]::IsNullOrWhiteSpace($value)) {
      $value = $Default
    }

    if ($Required -and [string]::IsNullOrWhiteSpace($value)) {
      Write-Host "This value is required." -ForegroundColor Yellow
      continue
    }

    return $value.Trim()
  }
}

function Read-SecretValue {
  param(
    [string]$Label,
    [string]$Default = "",
    [switch]$Required
  )

  while ($true) {
    $secureValue = Read-Host $Label -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)

    try {
      $value = [Runtime.InteropServices.Marshal]::PtrToStringAuto($pointer)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }

    if ([string]::IsNullOrWhiteSpace($value)) {
      $value = $Default
    }

    if ($Required -and [string]::IsNullOrWhiteSpace($value)) {
      Write-Host "This value is required." -ForegroundColor Yellow
      continue
    }

    return $value.Trim()
  }
}

function Confirm-Choice {
  param(
    [string]$Message,
    [bool]$Default = $true
  )

  $suffix = if ($Default) { "[Y/n]" } else { "[y/N]" }
  $answer = Read-Host "$Message $suffix"

  if ([string]::IsNullOrWhiteSpace($answer)) {
    return $Default
  }

  return $answer.Trim().ToLowerInvariant().StartsWith("y")
}

function Get-DefaultGithubRepository {
  try {
    $remote = git config --get remote.origin.url 2>$null
    if ($remote -match "github\.com[:/](.+?)(\.git)?$") {
      return $matches[1]
    }
  } catch {
  }

  return ""
}

function New-SessionSecret {
  return ("{0}{1}" -f [guid]::NewGuid().ToString("N"), [guid]::NewGuid().ToString("N"))
}

function Write-EnvFile {
  param(
    [string]$Path,
    [hashtable]$Values
  )

  $lines = foreach ($entry in $Values.GetEnumerator() | Sort-Object Name) {
    "{0}={1}" -f $entry.Key, $entry.Value
  }

  [System.IO.File]::WriteAllText($Path, (($lines -join [Environment]::NewLine) + [Environment]::NewLine))
}

function Ensure-VercelLink {
  param(
    [switch]$Skip
  )

  if ($Skip) {
    return
  }

  if (Test-Path ".vercel\project.json") {
    return
  }

  Write-Host ""
  Write-Host "This repo is not linked to Vercel yet. Running 'vercel link --yes'..." -ForegroundColor Cyan
  Invoke-Vercel -Arguments @("link", "--yes")
}

function Upload-VercelVariables {
  param(
    [hashtable]$Values,
    [string[]]$Environments
  )

  foreach ($environment in $Environments) {
    foreach ($entry in $Values.GetEnumerator() | Sort-Object Name) {
      Write-Host "Uploading $($entry.Key) -> $environment" -ForegroundColor Cyan
      Invoke-Vercel -Arguments @("env", "add", $entry.Key, $environment, "--force") -InputText $entry.Value
    }
  }
}

function Deploy-Production {
  Write-Host ""
  Write-Host "Deploying the project to production..." -ForegroundColor Cyan
  Invoke-Vercel -Arguments @("deploy", "--prod", "--yes")
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDirectory
Set-Location $repoRoot

Write-Host ""
Write-Host "TLRP Vercel Discord Setup" -ForegroundColor Cyan
Write-Host "This will save your values locally, upload them to Vercel, and deploy production for you." -ForegroundColor DarkGray
Write-Host ""

$defaultDomain = Read-PlainValue -Label "Your live domain (example: tlrpweb.vercel.app)" -Required
$cleanDomain = $defaultDomain -replace "^https?://", "" -replace "/+$", ""
$redirectUri = "https://$cleanDomain/api/auth/discord/callback"

$defaultRepository = Get-DefaultGithubRepository
$githubRepository = Read-PlainValue -Label "GitHub repository" -Default $defaultRepository -Required
$githubBranch = Read-PlainValue -Label "GitHub branch" -Default "main" -Required

$values = [ordered]@{
  DISCORD_CLIENT_ID = Read-PlainValue -Label "Discord Client ID" -Required
  DISCORD_CLIENT_SECRET = Read-SecretValue -Label "Discord Client Secret" -Required
  DISCORD_REDIRECT_URI = $redirectUri
  DISCORD_GUILD_ID = Read-PlainValue -Label "Discord Server / Guild ID"
  DISCORD_OWNER_ID = Read-PlainValue -Label "Discord Owner User ID"
  DISCORD_ALLOWED_ROLE_ID = Read-PlainValue -Label "Media role IDs (comma-separated, optional)"
  DISCORD_APPLICATION_CREATOR_ROLE_ID = Read-PlainValue -Label "Directive+ role IDs (comma-separated, optional)"
  DISCORD_APPLICATION_MANAGER_ROLE_ID = Read-PlainValue -Label "Management+ role IDs (comma-separated, optional)"
  GITHUB_REPOSITORY = $githubRepository
  GITHUB_BRANCH = $githubBranch
  GITHUB_TOKEN = Read-SecretValue -Label "GitHub token with repo contents write access" -Required
  SESSION_SECRET = New-SessionSecret
}

if (
  [string]::IsNullOrWhiteSpace($values.DISCORD_OWNER_ID) -and
  [string]::IsNullOrWhiteSpace($values.DISCORD_ALLOWED_ROLE_ID) -and
  [string]::IsNullOrWhiteSpace($values.DISCORD_APPLICATION_CREATOR_ROLE_ID) -and
  [string]::IsNullOrWhiteSpace($values.DISCORD_APPLICATION_MANAGER_ROLE_ID)
) {
  throw "You need either DISCORD_OWNER_ID or at least one Discord role ID."
}

if (
  (-not [string]::IsNullOrWhiteSpace($values.DISCORD_ALLOWED_ROLE_ID) -or
    -not [string]::IsNullOrWhiteSpace($values.DISCORD_APPLICATION_CREATOR_ROLE_ID) -or
    -not [string]::IsNullOrWhiteSpace($values.DISCORD_APPLICATION_MANAGER_ROLE_ID)) -and
  [string]::IsNullOrWhiteSpace($values.DISCORD_GUILD_ID)
) {
  throw "DISCORD_GUILD_ID is required when you use role IDs."
}

$envFilePath = Join-Path $repoRoot ".env.vercel.local"
Write-EnvFile -Path $envFilePath -Values $values

Write-Host ""
Write-Host "Saved your private values to $envFilePath" -ForegroundColor Green
Write-Host "Discord redirect URI: $redirectUri" -ForegroundColor Green
Write-Host ""
Write-Host "Add this exact redirect URI in the Discord Developer Portal:" -ForegroundColor Yellow
Write-Host $redirectUri -ForegroundColor Yellow
Write-Host ""

if ($SkipUpload) {
  Write-Host "Skipped Vercel upload because -SkipUpload was used." -ForegroundColor Yellow
  exit 0
}

Ensure-VercelLink -Skip:$SkipLink
Upload-VercelVariables -Values $values -Environments $Targets

Write-Host ""
Write-Host "All environment variables were uploaded to Vercel." -ForegroundColor Green

if ($SkipDeploy) {
  Write-Host "Skipped production deploy because -SkipDeploy was used." -ForegroundColor Yellow
  exit 0
}

Deploy-Production

Write-Host ""
Write-Host "Production deploy started with the new environment variables." -ForegroundColor Green
