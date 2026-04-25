param(
  [string]$ProjectRef = "pbtngbwbieskvmutshbz"
)

$ErrorActionPreference = "Stop"
$SupabaseCliVersion = "2.95.2"
$NpxCommand = "npx.cmd"

function Invoke-Supabase {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  & $NpxCommand "--yes" "supabase@$SupabaseCliVersion" @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase CLI command failed: supabase $($Args -join ' ')"
  }
}

try {
  & $NpxCommand "--yes" "supabase@$SupabaseCliVersion" "--version" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "missing"
  }
} catch {
  throw "Supabase CLI could not be started with npx. Make sure Node.js 20+ is installed, then run: npx --yes supabase@$SupabaseCliVersion --version"
}

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root "supabase\.env.example"

if (-not (Test-Path $envFile)) {
  throw "Missing backend env file: $envFile"
}

Write-Host "Linking project $ProjectRef..." -ForegroundColor Cyan
Invoke-Supabase link --project-ref $ProjectRef --workdir "$root\supabase"

Write-Host "Pushing database migration..." -ForegroundColor Cyan
Invoke-Supabase db push --workdir "$root\supabase"

Write-Host "Setting function secrets..." -ForegroundColor Cyan
Get-Content $envFile |
  Where-Object { $_ -and -not $_.StartsWith("#") } |
  ForEach-Object {
    $parts = $_ -split "=", 2
    if ($parts.Length -eq 2) {
      Invoke-Supabase secrets set "$($_)" --workdir "$root\supabase"
    }
  }

$functions = @(
  "resolve-tenant",
  "payment-webhook",
  "subscription-activate",
  "plg-event",
  "plg-scorer"
)

foreach ($fn in $functions) {
  Write-Host "Deploying function: $fn" -ForegroundColor Cyan
  Invoke-Supabase functions deploy $fn --project-ref $ProjectRef --workdir "$root\supabase"
}

Write-Host "Supabase backend deployment completed." -ForegroundColor Green
