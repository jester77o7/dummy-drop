$p = 'C:\Users\ajest\Desktop\Dummy Drop\shot-L4.jpg'
$b = [Convert]::ToBase64String([IO.File]::ReadAllBytes($p))
$chunk = 20000
$parts = [Math]::Ceiling($b.Length / $chunk)
for ($i = 0; $i -lt $parts; $i++) {
  $len = [Math]::Min($chunk, $b.Length - $i * $chunk)
  [IO.File]::WriteAllText("$p.b64.$i", $b.Substring($i * $chunk, $len))
}
Write-Output "shot-L4.jpg bytes=$((Get-Item $p).Length) b64parts=$parts"
