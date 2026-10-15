$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = Join-Path $projectRoot 'assets/source/atlases'
$portrait = [System.Drawing.Bitmap]::new((Join-Path $sourceRoot 'hero-atlas-v2.png'))
$animation = [System.Drawing.Bitmap]::new((Join-Path $sourceRoot 'heroes-animation.png'))
try {
    $specs = @(
        @{ Name = 'asterix'; PortraitX = 0; AnimationY = 20; AnimationHeight = 563 },
        @{ Name = 'obelix'; PortraitX = 887; AnimationY = 612; AnimationHeight = 610 }
    )
    foreach ($spec in $specs) {
        $outputDir = Join-Path $projectRoot "assets/runtime/characters/heroes/$($spec.Name)"
        [System.IO.Directory]::CreateDirectory($outputDir) | Out-Null
        $images = @(
            @{ Image = $portrait; Rect = [System.Drawing.Rectangle]::new($spec.PortraitX, 0, 887, 887); File = 'portrait.png' },
            @{ Image = $animation; Rect = [System.Drawing.Rectangle]::new(0, $spec.AnimationY, 1254, $spec.AnimationHeight); File = 'animations.png' }
        )
        foreach ($item in $images) {
            # Extract existing pixels without scaling or redrawing the artwork.
            $cropped = $item.Image.Clone($item.Rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try { $cropped.Save((Join-Path $outputDir $item.File), [System.Drawing.Imaging.ImageFormat]::Png) }
            finally { $cropped.Dispose() }
        }
    }
} finally { $portrait.Dispose(); $animation.Dispose() }
