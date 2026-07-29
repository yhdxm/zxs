$reportPath = "d:\开发工具-zy\代码类目\my-web-demo\scripts\c_usage_report.txt"
$report = @()
$report += "C: Drive Usage Report"
$report += "Generated: $(Get-Date -Format 'u')"
$report += ""
$drive = Get-PSDrive -Name C
$report += "Used: $($drive.Used)"
$report += "Free: $($drive.Free)"
$report += ""
$report += "--- TARGET FOLDER SIZES ---"
$dirs = @('C:\TEMP','C:\tmp','C:\OneDriveTemp','C:\Users','C:\ProgramData','C:\Windows','C:\Program Files','C:\Program Files (x86)','C:\Windows\Temp','C:\Windows\SoftwareDistribution\Download')
foreach ($d in $dirs) {
  if (Test-Path $d) {
    $size=(Get-ChildItem -Path $d -File -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $report += "$d : $([math]::Round($size/1GB,2)) GB"
  } else {
    $report += "$d : missing"
  }
}
$report += ""
$report += "--- ROOT TOP 20 FOLDER USAGE ---"
$rootSizes = Get-ChildItem -Path C:\ -Force -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer } | ForEach-Object {
  $size=(Get-ChildItem -Path $_.FullName -File -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  [PSCustomObject]@{Name=$_.FullName; SizeGB=[math]::Round($size/1GB,2)}
} | Sort-Object SizeGB -Descending | Select-Object -First 20
foreach ($item in $rootSizes) {
  $report += "$($item.Name) : $($item.SizeGB) GB"
}
$report += ""
$report += "--- FILES >1GB ---"
$largeFiles = Get-ChildItem -Path C:\ -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 1GB } | Select-Object @{Name='SizeGB';Expression={[math]::Round($_.Length/1GB,2)}}, FullName | Sort-Object SizeGB -Descending | Select-Object -First 50
foreach ($file in $largeFiles) {
  $report += "$($file.SizeGB) GB : $($file.FullName)"
}
$report | Out-File -FilePath $reportPath -Encoding UTF8
Write-Output "Report written to $reportPath"
