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
$envFile = Join-Path $root "supabase\.env"
if (-not (Test-Path $envFile)) {
  $envFile = Join-Path $root "supabase\.env.example"
}

if (-not (Test-Path $envFile)) {
  throw "Missing backend env file"
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
      $key = $parts[0].Trim()
      $val = $parts[1].Trim()
      # Skip reserved SUPABASE_ variables as they are automatically provided by the platform
      if (-not $key.StartsWith("SUPABASE_")) {
        Invoke-Supabase secrets set "$key=$val" --workdir "$root\supabase"
      } else {
        Write-Host "Skipping reserved secret: $key" -ForegroundColor Yellow
      }
    }
  }

$functions = @(
  "health",
  "line-webhook",
  "resolve-tenant",
  "payment-webhook",
  "subscription-activate",
  "plg-event",
  "plg-scorer"
)

foreach ($fn in $functions) {
  Write-Host "Deploying function: $fn" -ForegroundColor Cyan
  if ($fn -eq "line-webhook" -or $fn -eq "health") {
    Invoke-Supabase functions deploy $fn --project-ref $ProjectRef --no-verify-jwt --workdir "$root"
  } else {
    Invoke-Supabase functions deploy $fn --project-ref $ProjectRef --workdir "$root"
  }
}

Write-Host "Supabase backend deployment completed." -ForegroundColor Green
