$names = 'shot-L1.jpg','shot-L2.jpg','shot-L3.jpg'
foreach ($n in $names) {
  $p = "C:\Users\ajest\Desktop\Dummy Drop\$n"
  $b = [Convert]::ToBase64String([IO.File]::ReadAllBytes($p))
  $chunk = 20000
  $parts = [Math]::Ceiling($b.Length / $chunk)
  for ($i = 0; $i -lt $parts; $i++) {
    $len = [Math]::Min($chunk, $b.Length - $i * $chunk)
    [IO.File]::WriteAllText("$p.b64.$i", $b.Substring($i * $chunk, $len))
  }
  Write-Output "$n bytes=$((Get-Item $p).Length) b64parts=$parts"
}
