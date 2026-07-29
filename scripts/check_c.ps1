Get-PSDrive -Name C | Format-List *
Write-Output '---TARGET FOLDER SIZES---'
$dirs = @('C:\TEMP','C:\tmp','C:\OneDriveTemp','C:\Users','C:\ProgramData','C:\Windows')
foreach ($d in $dirs) {
  if (Test-Path $d) {
    $size=(Get-ChildItem -Path $d -File -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Output "$d : $([math]::Round($size/1GB,2)) GB"
  } else {
    Write-Output "$d : missing"
  }
}
Write-Output '---ROOT DIRECTORY SIZES---'
Get-ChildItem -Path C:\ -Force -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer } | ForEach-Object {
  $size=(Get-ChildItem -Path $_.FullName -File -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  [PSCustomObject]@{Name=$_.FullName; SizeGB=[math]::Round($size/1GB,2)}
} | Sort-Object SizeGB -Descending | Select-Object -First 20 | Format-Table -AutoSize
Write-Output '---LARGE FILES >1GB---'
$large = Get-ChildItem -Path C:\ -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 1GB } | Select-Object @{Name='SizeGB';Expression={[math]::Round($_.Length/1GB,2)}}, FullName | Sort-Object SizeGB -Descending
if ($large) { $large | Format-Table -AutoSize } else { Write-Output 'No files larger than 1GB found or not accessible from this query.' }
