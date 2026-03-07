param(
    [string]$ProjectDir = "C:\opt\watch-the-wolves",
    [int]$AddonPort = 7010,
    [string]$ManifestUrl = "https://streamio.watchthewolves.com/manifest.json"
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) {
    Write-Host "[WTW] $Message"
}

function Ensure-CloudflaredService {
    $svc = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-Info "Cloudflared service not found. Install it first, then retry."
        return
    }

    if ($svc.Status -ne "Running") {
        Write-Info "Starting cloudflared service..."
        Start-Service -Name "cloudflared"
    } else {
        Write-Info "Cloudflared service already running."
    }
}

function Is-AddonListening([int]$Port) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$conn
}

function Start-AddonWindow {
    if (-not (Test-Path $ProjectDir)) {
        throw "ProjectDir not found: $ProjectDir"
    }

    if (Is-AddonListening -Port $AddonPort) {
        Write-Info "Addon already listening on port $AddonPort."
        return
    }

    $cmd = @"
`$host.UI.RawUI.WindowTitle = 'Watch The Wolves - Stremio Addon'
Set-Location '$ProjectDir'
npm run stremio:addon
"@

    Write-Info "Opening addon window..."
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $cmd | Out-Null
}

Ensure-CloudflaredService
Start-AddonWindow

Write-Info "Opening manifest URL..."
Start-Process $ManifestUrl | Out-Null
Write-Info "Done."
