# Claude Code 起動時(SessionStart)に1日1回だけ、給付金の指定講座の検索を Claude に依頼するスクリプト
# 記録はこのリポジトリの .claude/kyufu-check/ に保存する(last-run.txt と log.md は .gitignore 済み)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$dir   = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\kyufu-check'))
$stamp = Join-Path $dir 'last-run.txt'
$today = Get-Date -Format 'yyyy-MM-dd'

if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

# 今日すでに依頼済みなら何もしない
if ((Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $today)) { exit 0 }
Set-Content -Path $stamp -Value $today -Encoding ASCII

$schools = (Join-Path $dir 'schools.txt') -replace '\\', '/'
$log     = (Join-Path $dir 'log.md') -replace '\\', '/'

# 文字化けを避けるため、Claude への指示は英語(ASCII)で渡す。学校名は schools.txt (UTF-8) から読ませる
$msg = "DAILY TASK (once per day, requested by the user): Before anything else, read $schools. " +
       "For each school listed there, search the MHLW course search system (https://www.kyufu.mhlw.go.jp/kensaku/) " +
       "for courses designated as Senmon Jissen Kyoiku Kunren (the specialized practical training benefit). " +
       "Report in Japanese: school name, course name, course number, designation period, or 'not found'. " +
       "Compare with the last entry in $log (create it if missing) and say clearly whether anything changed. " +
       "Append today's result ($today) to $log. " +
       "If the site cannot be read with your tools, say so and give the user the URL to check by hand. Do not guess."

$out = @{ hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $msg } } | ConvertTo-Json -Compress
Write-Output $out
exit 0
