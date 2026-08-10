$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'assets-source'
$runtimeRoot = Join-Path $projectRoot 'public\assets\runtime'

function Ensure-Directory([string]$path) {
  New-Item -ItemType Directory -Force -Path $path | Out-Null
}

function Copy-Model([string]$sourceDirectory, [string]$modelName, [string]$destinationDirectory) {
  Ensure-Directory $destinationDirectory
  Copy-Item -LiteralPath (Join-Path $sourceDirectory "$modelName.gltf") -Destination $destinationDirectory -Force
  Copy-Item -LiteralPath (Join-Path $sourceDirectory "$modelName.bin") -Destination $destinationDirectory -Force
}

function Write-TextureVariant([string]$sourcePath, [string]$destinationPath, [int]$maximumSize) {
  Add-Type -AssemblyName System.Drawing
  $sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $ratio = [Math]::Min(1.0, $maximumSize / [Math]::Max($sourceImage.Width, $sourceImage.Height))
    $width = [Math]::Max(1, [int][Math]::Round($sourceImage.Width * $ratio))
    $height = [Math]::Max(1, [int][Math]::Round($sourceImage.Height * $ratio))
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($sourceImage, 0, 0, $width, $height)
      } finally {
        $graphics.Dispose()
      }
      $bitmap.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $sourceImage.Dispose()
  }
}

$kaykitDestination = Join-Path $runtimeRoot 'kaykit'
$kaykitSource = Join-Path $sourceRoot 'kaykit-space\Models'
@(
  'basemodule_A', 'basemodule_B', 'basemodule_C', 'basemodule_D', 'basemodule_E',
  'cargo_A_stacked', 'drill_structure', 'landingpad_large', 'lights',
  'rock_A', 'rock_B', 'solarpanel', 'structure_tall', 'tunnel_straight_A'
) | ForEach-Object { Copy-Model $kaykitSource $_ $kaykitDestination }
Copy-Item -LiteralPath (Join-Path $kaykitSource 'spacebits_texture.png') -Destination $kaykitDestination -Force

$ultimateDestination = Join-Path $runtimeRoot 'ultimate'
Ensure-Directory $ultimateDestination
@('Astronaut_FinnTheFrog', 'Astronaut_RaeTheRedPanda', 'Astronaut_BarbaraTheBee') | ForEach-Object {
  Copy-Item -LiteralPath (Join-Path $sourceRoot "quaternius-ultimate\Characters\Models\$_.gltf") -Destination $ultimateDestination -Force
}
Copy-Item -LiteralPath (Join-Path $sourceRoot 'quaternius-ultimate\Environment\Models\Rock_Large_1.gltf') -Destination $ultimateDestination -Force

$modularDestination = Join-Path $runtimeRoot 'modular'
Copy-Model (Join-Path $sourceRoot 'quaternius-modular\Models\Platforms') 'Platform_DarkPlates' $modularDestination
Copy-Model (Join-Path $sourceRoot 'quaternius-modular\Models\Props') 'Prop_Vent_Big' $modularDestination
Copy-Model (Join-Path $sourceRoot 'quaternius-modular\Models\Props') 'Prop_Light_Floor' $modularDestination
$modularTextureSource = Join-Path $sourceRoot 'quaternius-modular\Textures'
@(
  'T_Trim_01_Normal.png', 'T_Trim_01_BaseColor_Red.png', 'T_Trim_01_ORM.png',
  'T_Trim_02_Normal.png', 'T_Trim_02_BaseColor_Red.png', 'T_Trim_02_ORM.png'
) | ForEach-Object {
  Write-TextureVariant (Join-Path $modularTextureSource $_) (Join-Path $modularDestination $_) 1024
}

$essentialsDestination = Join-Path $runtimeRoot 'essentials'
$essentialsSource = Join-Path $sourceRoot 'quaternius-essentials\Models'
Copy-Model $essentialsSource 'Prop_Crate' $essentialsDestination
@('T_Props_Crates_Normal.png', 'T_Props_Crates_BaseColor.png', 'T_Props_Crates_ORM.png') | ForEach-Object {
  Write-TextureVariant (Join-Path $essentialsSource $_) (Join-Path $essentialsDestination $_) 1024
}

$licenseDestination = Join-Path $runtimeRoot 'licenses'
Ensure-Directory $licenseDestination
Copy-Item -LiteralPath (Join-Path $sourceRoot 'kaykit-space\License.txt') -Destination (Join-Path $licenseDestination 'kaykit-space.txt') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'quaternius-ultimate\License.txt') -Destination (Join-Path $licenseDestination 'quaternius-ultimate.txt') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'quaternius-modular\License_Standard.txt') -Destination (Join-Path $licenseDestination 'quaternius-modular.txt') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'quaternius-essentials\License_Standard.txt') -Destination (Join-Path $licenseDestination 'quaternius-essentials.txt') -Force

Write-Output 'Runtime asset subset generated without modifying assets-source.'
