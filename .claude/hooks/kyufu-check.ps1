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
$courses = (Join-Path $dir 'courses.json') -replace '\\', '/'
$maker   = (Join-Path $dir 'make_pdf.py') -replace '\\', '/'
$pdfDir  = ([System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\給付情報'))) -replace '\\', '/'

# 文字化けを避けるため、Claude への指示は英語(ASCII)で渡す。学校名は schools.txt (UTF-8) から読ませる
$msg = "DAILY TASK (once per day, requested by the user): Before anything else, read $schools. " +
       "For each school listed there, search the MHLW course search system (https://www.kyufu.mhlw.go.jp/kensaku/) " +
       "for courses designated as Senmon Jissen Kyoiku Kunren (the specialized practical training benefit). " +
       "The search is a form with a session, so a plain web fetch does not work: use the built-in browser, " +
       "open https://www.kyufu.mhlw.go.jp/kensaku/ and click the link to the course search page (opening SSR101Scr01S directly shows an error page), type the school name into the free-word box, press the search button, " +
       "and open each course's detail page for the designation number and period. Also search the word for beauty with prefecture Kagoshima to catch renamed schools. " +
       "Then make the PDFs: for every course that appeared in these searches, read its whole detail page and its classroom page, and rewrite $courses with today's data. " +
       "Read that file first and keep exactly its structure (checked = $today; fees as integers per period; start_month from the opening month; duration_months from the training period; copy the text as shown on the site). " +
       "Run: python -I $maker . It writes one PDF per course, including the benefit payment timing and amounts, to $pdfDir and moves older dated PDFs there to the Recycle Bin. " +
       "Tell the user the PDF file names. " +
       "Report in Japanese: school name, course name, course number, designation period, or 'not found'. " +
       "Compare with the last entry in $log (create it if missing) and say clearly whether anything changed. " +
       "Append today's result ($today) to $log. " +
       "If the site cannot be read with your tools, say so and give the user the URL to check by hand. Do not guess."

$out = @{ hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $msg } } | ConvertTo-Json -Compress
Write-Output $out
exit 0
