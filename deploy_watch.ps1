# deploy_watch.ps1 - 轮询 GitHub Actions 最新一次 push 运行，判定部署成功/失败
# 由 deploy.bat 调用，token 通过环境变量 ZWS_TOKEN 传入，代理通过 ZWS_PROXY 传入。
$ErrorActionPreference = 'Stop'

$token  = $env:ZWS_TOKEN
$proxy  = $env:ZWS_PROXY
$repo   = 'YHDXM/ZXS'

if (-not $token) {
  Write-Host 'NO_TOKEN'
  exit 2
}

$headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json' }
$iwr = @{}
if ($proxy) { $iwr['Proxy'] = "http://127.0.0.1:$proxy" }

$deadline = (Get-Date).AddSeconds(180)
$runId = $null

while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-RestMethod "https://api.github.com/repos/$repo/actions/runs?per_page=10" -Headers $headers @iwr
  } catch {
    Start-Sleep -Seconds 6
    continue
  }
  $run = $r.workflow_runs |
    Where-Object { $_.head_branch -eq 'main' -and $_.event -eq 'push' } |
    Select-Object -First 1
  if ($run) {
    $runId = $run.id
    if ($run.status -eq 'completed') { break }
  }
  Start-Sleep -Seconds 8
}

if (-not $runId) {
  Write-Host 'API_UNAVAILABLE'
  exit 2
}

$final = Invoke-RestMethod "https://api.github.com/repos/$repo/actions/runs/$runId" -Headers $headers @iwr
Write-Host "RUN_URL=$($final.html_url)"
if ($final.conclusion -eq 'success') {
  Write-Host 'DEPLOY_SUCCESS'
  exit 0
} else {
  Write-Host "DEPLOY_FAILED:$($final.conclusion)"
  exit 1
}
