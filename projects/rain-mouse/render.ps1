$ErrorActionPreference = 'Stop'
$rainProjectPath = $PSScriptRoot
$rainEncoderPath = Join-Path $rainProjectPath 'node_modules\ffmpeg-static'
$rainProbePath = Join-Path $rainProjectPath 'node_modules\ffprobe-static\bin\win32\x64'
$rainPriorPath = $env:PATH
Push-Location -LiteralPath $rainProjectPath
try {
  $env:PATH = "$rainEncoderPath;$rainProbePath;$rainPriorPath"
  npm.cmd run render -- --quality high --fps 30 --workers 2 --output renders/rain-mouse.mp4
  if ($LASTEXITCODE -ne 0) { throw "Video export failed with exit code $LASTEXITCODE" }
} finally {
  $env:PATH = $rainPriorPath
  Pop-Location
}
