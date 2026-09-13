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

  $healthUri = "http://127.0.0.1:$Port/health"
  $readinessUri = "http://127.0.0.1:$Port/context/index"

  function Test-CortexDbReady {
    try {
      $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2
      if ($health.status -ne "ok") { return $false }
      $null = Invoke-RestMethod -Uri $readinessUri -TimeoutSec 5
      return $true
    } catch {
      return $false
    }
  }

  if (Test-CortexDbReady) {
    Write-Host "CortexDB is already ready at $readinessUri"
    exit 0
  }

  try {
    $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2
    if ($health.status -eq "ok") {
      throw "CortexDB responds to /health but is not ready at $readinessUri. The running process may hold a stale database connection; restart it before retrying."
    }
  } catch {
    if ($_.Exception.Message.StartsWith("CortexDB responds")) { throw }
    # The API is not running yet; start it below.
  }

  & $PythonPath -c "import psycopg, pgvector"
  if ($LASTEXITCODE -ne 0) {
    throw "CortexDB Postgres dependencies are missing. Run: `n`  $PythonPath -m pip install -e '.[postgres]'"
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
    if (Test-CortexDbReady) {
      Write-Host "CortexDB started successfully at $readinessUri (PID $($process.Id))."
      exit 0
    }
    if ($process.HasExited) { break }
  }

  $errorTail = if (Test-Path -LiteralPath $stderrLog) { Get-Content -LiteralPath $stderrLog | Select-Object -Last 20 } else { @() }
  throw "CortexDB did not become ready at $readinessUri. Logs: $stdoutLog and $stderrLog`n$($errorTail -join [Environment]::NewLine)"
} finally {
  Pop-Location
}
