param([string]$Dir = "$PSScriptRoot/../.acceptance", [int]$Count = 30, [int]$IntervalMs = 900)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
for ($i = 0; $i -lt $Count; $i++) {
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $g.Dispose()
  $bmp.Save("$Dir/f-$('{0:d2}' -f $i).png")
  $bmp.Dispose()
  Start-Sleep -Milliseconds $IntervalMs
}
Write-Output "burst done: $Count frames"
