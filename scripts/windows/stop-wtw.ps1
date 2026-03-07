param(
    [int]$AddonPort = 7010
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "[WTW] Stopping node process listening on port $AddonPort (if any)..."
$connections = Get-NetTCPConnection -LocalPort $AddonPort -State Listen
foreach ($c in $connections) {
    Stop-Process -Id $c.OwningProcess -Force
}

Write-Host "[WTW] Stopping cloudflared service..."
Stop-Service -Name "cloudflared"

Write-Host "[WTW] Done."
