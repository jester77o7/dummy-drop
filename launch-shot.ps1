$dir = 'C:\Users\ajest\Desktop\Dummy Drop\chrome-shot'
if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
$cmd = '"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --autoplay-policy=no-user-gesture-required --remote-debugging-port=9223 --remote-debugging-address=127.0.0.1 --window-size=1320,940 --user-data-dir="C:\Users\ajest\Desktop\Dummy Drop\chrome-shot" "file:///C:/Users/ajest/Desktop/Dummy%20Drop/index.html"'
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd } | Out-Null
Write-Output 'chrome launched'
