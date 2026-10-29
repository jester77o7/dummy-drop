$prof = 'C:\Users\ajest\Desktop\Dummy Drop\chrome-test'
if (Test-Path $prof) { Remove-Item -Recurse -Force $prof }
$cmd = '"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9222 --user-data-dir="C:\Users\ajest\Desktop\Dummy Drop\chrome-test" "file:///C:/Users/ajest/Desktop/Dummy%20Drop/index.html"'
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
Write-Output ("pid=" + $r.ProcessId + " ret=" + $r.ReturnValue)
