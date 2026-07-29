# C drive temporary cleanup helper
# Run this script in PowerShell as Administrator if you want to clear common temp/cache files.
# Review the paths first; adjust or remove lines before running if needed.

$targets = @(
    'C:\Windows\Temp',
    'C:\Users\Public\Desktop',
    'C:\Users\$env:USERNAME\AppData\Local\Temp',
    'C:\ProgramData\Package Cache',
    'C:\Windows\SoftwareDistribution\Download',
    'C:\OneDriveTemp',
    'C:\TEMP',
    'C:\tmp'
)

Write-Output "Cleaning temporary target paths..."
foreach ($path in $targets) {
    if (Test-Path $path) {
        Write-Output "-- Clearing $path"
        Get-ChildItem -Path $path -Force -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    } else {
        Write-Output "-- Missing: $path"
    }
}

$extraFiles = @(
    'C:\temp.dat',
    'C:\Output.txt',
    'C:\SangforServiceClient.dmp',
    'C:\SangforServiceClient_2023223.log'
)

Write-Output "Cleaning extra files..."
foreach ($file in $extraFiles) {
    if (Test-Path $file) {
        Write-Output "-- Deleting $file"
        Remove-Item -Force -ErrorAction SilentlyContinue $file
    } else {
        Write-Output "-- Not found: $file"
    }
}

Write-Output "Cleanup complete."
Write-Output "建议在删除后检查回收站，并可再次运行 Windows 磁盘清理。"
