param(
  [string]$CortexDbRoot = $env:PROJECTPLANER_CORTEXDB_ROOT,
  [string]$PythonPath = $env:PROJECTPLANER_CORTEXDB_PYTHON,
  [int]$Port = 5000
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CortexDbRoot)) {
  $workspaceParent = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $CortexDbRoot = Join-Path $workspaceParent "CortexDB"
}
if (-not (Test-Path -LiteralPath $CortexDbRoot -PathType Container)) {
  throw "CortexDB checkout was not found at '$CortexDbRoot'. Set PROJECTPLANER_CORTEXDB_ROOT to its path."
}

if ([string]::IsNullOrWhiteSpace($PythonPath)) {
  $defaultPython = "C:\Program Files\Python312\python.exe"
  if (Test-Path -LiteralPath $defaultPython -PathType Leaf) {
    $PythonPath = $defaultPython
  } else {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($null -eq $pythonCommand) {
      throw "Python was not found. Set PROJECTPLANER_CORTEXDB_PYTHON to the Python executable used by CortexDB."
    }
    $PythonPath = $pythonCommand.Source
  }
}
if (-not (Test-Path -LiteralPath $PythonPath -PathType Leaf)) {
  throw "Python executable was not found at '$PythonPath'."
}

Push-Location $CortexDbRoot
try {
  if (-not (Test-Path -LiteralPath ".env" -PathType Leaf)) {
    throw "CortexDB .env is missing in '$CortexDbRoot'. Configure CORTEXDB_DATABASE_URL and embedding settings there."
  }

  & $PythonPath -c "import psycopg, pgvector"
  if ($LASTEXITCODE -ne 0) {
    throw "CortexDB Postgres dependencies are missing. Run: `n`  $PythonPath -m pip install -e '.[postgres]'"
  }

  $healthUri = "http://127.0.0.1:$Port/health"
  try {
    $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2
    if ($health.status -eq "ok") {
      Write-Host "CortexDB is already healthy at $healthUri"
      exit 0
    }
  } catch {
    # The API is not running yet; start it below.
  }

  $logStem = Join-Path ([IO.Path]::GetTempPath()) "projectplaner-cortexdb-$Port"
  $stdoutLog = "$logStem.out.log"
  $stderrLog = "$logStem.err.log"
  $process = Start-Process -FilePath $PythonPath `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$Port") `
    -WorkingDirectory $CortexDbRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Seconds 1
    try {
      $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2
      if ($health.status -eq "ok") {
        Write-Host "CortexDB started successfully at $healthUri (PID $($process.Id))."
        exit 0
      }
    } catch {
      if ($process.HasExited) { break }
    }
  }

  $errorTail = if (Test-Path -LiteralPath $stderrLog) { Get-Content -LiteralPath $stderrLog | Select-Object -Last 20 } else { @() }
  throw "CortexDB did not become healthy. Logs: $stdoutLog and $stderrLog`n$($errorTail -join [Environment]::NewLine)"
} finally {
  Pop-Location
}
