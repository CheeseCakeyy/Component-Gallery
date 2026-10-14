param(
    [int]$Port = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$previewRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = $null
$selectedPort = $Port

for ($candidatePort = $Port; $candidatePort -le ($Port + 10); $candidatePort++) {
    try {
        $candidate = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidatePort)
        $candidate.Start()
        $listener = $candidate
        $selectedPort = $candidatePort
        break
    }
    catch {
        if ($candidate) { $candidate.Stop() }
    }
}

if (-not $listener) {
    throw "No available preview port was found between $Port and $($Port + 10)."
}

$previewUrl = "http://127.0.0.1:$selectedPort/"
Write-Host ''
Write-Host '  DRAGONFLIGHT' -ForegroundColor Yellow
Write-Host "  Running at $previewUrl" -ForegroundColor Cyan
Write-Host '  Keep this window open. Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host ''

if (-not $NoBrowser) {
    Start-Process $previewUrl
}

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.webp' = 'image/webp'
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            if (-not $requestLine) { continue }

            while ($reader.ReadLine()) { }
            $parts = $requestLine.Split(' ')
            $method = $parts[0]
            $requestTarget = if ($parts.Count -gt 1) { $parts[1] } else { '/' }
            $urlPath = [Uri]::UnescapeDataString($requestTarget.Split('?')[0])
            $relativePath = $urlPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
            if (-not $relativePath) { $relativePath = 'index.html' }

            $filePath = [IO.Path]::GetFullPath([IO.Path]::Combine($previewRoot, $relativePath))
            $insideRoot = $filePath.StartsWith($previewRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
            $allowedMethod = $method -eq 'GET' -or $method -eq 'HEAD'

            if (-not $insideRoot -or -not $allowedMethod -or -not [IO.File]::Exists($filePath)) {
                $status = if (-not $allowedMethod) { '405 Method Not Allowed' } else { '404 Not Found' }
                $body = [Text.Encoding]::UTF8.GetBytes($status)
                $header = "HTTP/1.1 $status`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
            }
            else {
                $body = [IO.File]::ReadAllBytes($filePath)
                $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
                $mime = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
                $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
            }

            $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($method -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
            $stream.Flush()
        }
        catch {
            Write-Host "Request error: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
        finally {
            $client.Close()
        }
    }
}
finally {
    $listener.Stop()
}
