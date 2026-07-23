param(
    [string]$MinecraftJar = "$env:APPDATA\.epsilon\versions\1.21.11\1.21.11.jar"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$packRoot = Join-Path $projectRoot 'server-files\resourcepacks\TomizeCorpUI'
if (-not (Test-Path -LiteralPath $MinecraftJar)) {
    throw "Minecraft 1.21.11 introuvable : $MinecraftJar"
}

function Convert-ToTomizeTexture {
    param([System.IO.Stream]$InputStream, [string]$OutputPath)
    $source = [System.Drawing.Bitmap]::FromStream($InputStream)
    $bitmap = New-Object System.Drawing.Bitmap($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt $source.Height; $y++) {
        for ($x = 0; $x -lt $source.Width; $x++) {
            $pixel = $source.GetPixel($x, $y)
            if ($pixel.A -eq 0) { continue }
            $luma = [int](0.2126 * $pixel.R + 0.7152 * $pixel.G + 0.0722 * $pixel.B)
            # Palette noire unie : quatre niveaux nets, sans bruit ni couleur.
            if ($luma -ge 210) { $shade = 48 }
            elseif ($luma -ge 145) { $shade = 34 }
            elseif ($luma -ge 75) { $shade = 22 }
            else { $shade = 7 }
            $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, $shade, $shade, $shade))
        }
    }
    $directory = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    $source.Dispose()
}

$archive = [System.IO.Compression.ZipFile]::OpenRead($MinecraftJar)
try {
    $prefixes = @(
        'assets/minecraft/textures/gui/container/',
        'assets/minecraft/textures/gui/sprites/container/',
        'assets/minecraft/textures/gui/sprites/widget/',
        'assets/minecraft/textures/gui/sprites/hud/'
    )
    foreach ($entry in $archive.Entries) {
        $selected = $false
        foreach ($prefix in $prefixes) {
            if ($entry.FullName.StartsWith($prefix, [System.StringComparison]::Ordinal) -and
                ($entry.FullName.EndsWith('.png') -or $entry.FullName.EndsWith('.png.mcmeta'))) {
                $selected = $true
                break
            }
        }
        if (-not $selected) { continue }
        $outputPath = Join-Path $packRoot ($entry.FullName.Replace('/', '\'))
        if ($entry.FullName.EndsWith('.png.mcmeta')) {
            $directory = Split-Path -Parent $outputPath
            New-Item -ItemType Directory -Path $directory -Force | Out-Null
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $outputPath, $true)
        } else {
            $stream = $entry.Open()
            try { Convert-ToTomizeTexture -InputStream $stream -OutputPath $outputPath }
            finally { $stream.Dispose() }
        }
    }
} finally {
    $archive.Dispose()
}

Copy-Item -LiteralPath (Join-Path $projectRoot 'src\renderer\assets\epsilon-logo.png') -Destination (Join-Path $packRoot 'pack.png') -Force
Write-Host "Pack TomizeCorp généré dans $packRoot"
