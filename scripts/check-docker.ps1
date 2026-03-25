$ErrorActionPreference = 'Stop'

$outputPath = Join-Path $env:TEMP 'netbipi-docker-info.out'
$errorPath = Join-Path $env:TEMP 'netbipi-docker-info.err'

try {
    $process = Start-Process `
        -FilePath 'docker' `
        -ArgumentList 'info' `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput $outputPath `
        -RedirectStandardError $errorPath

    try {
        Wait-Process -Id $process.Id -Timeout 10 -ErrorAction Stop
    } catch {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        exit 124
    }

    exit $process.ExitCode
} catch {
    exit 127
}
