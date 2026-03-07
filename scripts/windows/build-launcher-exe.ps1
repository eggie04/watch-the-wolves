param(
    [string]$Source = "C:\opt\watch-the-wolves\scripts\windows\WatchTheWolvesLauncher.cs",
    [string]$Output = "C:\opt\watch-the-wolves\scripts\windows\dist\WatchTheWolvesLauncher.exe",
    [string]$IconPath = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Source)) {
    throw "Source file not found: $Source"
}

$outDir = Split-Path -Parent $Output
New-Item -Path $outDir -ItemType Directory -Force | Out-Null

$sourceCode = Get-Content -Path $Source -Raw
$compilerParams = New-Object System.CodeDom.Compiler.CompilerParameters
$compilerParams.GenerateExecutable = $true
$compilerParams.GenerateInMemory = $false
$compilerParams.OutputAssembly = $Output
$compilerParams.CompilerOptions = "/target:winexe"

if ($IconPath -and (Test-Path $IconPath)) {
    $compilerParams.CompilerOptions += " /win32icon:`"$IconPath`""
}

$null = $compilerParams.ReferencedAssemblies.Add([System.Object].Assembly.Location)
$null = $compilerParams.ReferencedAssemblies.Add([System.Diagnostics.Process].Assembly.Location)
$null = $compilerParams.ReferencedAssemblies.Add([System.IO.File].Assembly.Location)

Add-Type `
    -TypeDefinition $sourceCode `
    -CompilerParameters $compilerParams

Write-Host "Built: $Output"
