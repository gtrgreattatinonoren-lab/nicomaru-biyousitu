# 給付金チェックで見つかった講座ごとに、講座詳細+給付金の見込み(入金タイミングと金額)のPDFを作る
# 使い方: python make_pdf.py [courses.json] [出力フォルダ]
#   courses.json の既定値: このファイルと同じフォルダの courses.json
#   出力フォルダの既定値: 自作/給付情報
# 出力したあと、出力フォルダ内の古い日付のPDF(YYYY-MM-DD_*.pdf)はごみ箱へ移す(最新のものだけ残す)
import json
import math
import re
import sys
from datetime import date, timedelta
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from send2trash import send2trash

HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE.parents[2] / "給付情報"

pdfmetrics.registerFont(TTFont("JP", "C:/Windows/Fonts/BIZ-UDGothicR.ttc", subfontIndex=0))
pdfmetrics.registerFont(TTFont("JPB", "C:/Windows/Fonts/BIZ-UDGothicB.ttc", subfontIndex=0))

ACCENT = colors.HexColor("#2F5D8A")
LIGHT = colors.HexColor("#EAF0F6")
HILITE = colors.HexColor("#FFF4D6")
GRID = colors.HexColor("#B8C4D0")

title = ParagraphStyle("t", fontName="JPB", fontSize=17, leading=24, textColor=ACCENT)
sub = ParagraphStyle("s", fontName="JP", fontSize=9, leading=13, textColor=colors.HexColor("#555555"))
h2 = ParagraphStyle("h2", fontName="JPB", fontSize=12, leading=17, textColor=ACCENT, spaceBefore=10, spaceAfter=4)
cell = ParagraphStyle("c", fontName="JP", fontSize=8.5, leading=12)
cellb = ParagraphStyle("cb", fontName="JPB", fontSize=8.5, leading=12)
note = ParagraphStyle("n", fontName="JP", fontSize=8, leading=11, textColor=colors.HexColor("#555555"))

SOURCE = "厚生労働省 教育訓練給付金 検索システム(https://www.kyufu.mhlw.go.jp/kensaku/)"
RULE_SOURCE = "鹿児島労働局「専門実践教育訓練給付金のご案内」(令和8年8月版)、厚生労働省「訓練修了後の賃金が5%以上上昇した場合」パンフレット"
YEARS = ["令和5年度", "令和6年度", "令和7年度"]

# 給付のルール(令和6年10月1日以降に受講開始した人)
RATE_BASE, CAP_BASE_YEAR = 0.5, 400_000      # 受講中: 経費の50%、1年あたり上限40万円
RATE_JOB, CAP_JOB_YEAR = 0.2, 160_000        # 資格取得+就職: 経費の20%を追加、1年あたり上限16万円
RATE_WAGE, CAP_WAGE_YEAR = 0.1, 80_000       # 賃金5%以上上昇: 経費の10%を追加、1年あたり上限8万円
MIN_BASE = 4_000                             # 50%相当額が4千円以下なら支給なし


def yen(n):
    return f"{n:,}円"


def jd(d):
    return f"{d.year}年{d.month}月{d.day}日"


def add_months(d, n):
    y, m = divmod(d.month - 1 + n, 12)
    y += d.year
    m += 1
    last = (date(y + (m // 12), m % 12 + 1, 1) - timedelta(days=1)).day
    return date(y, m, min(d.day, last))


def one_month_window(d):
    """d の翌日から起算して1か月以内 → (開始日, 終了日)"""
    s = d + timedelta(days=1)
    return s, add_months(s, 1) - timedelta(days=1)


def next_start(today, month):
    s = date(today.year, month, 1)
    return s if s >= today else date(today.year + 1, month, 1)


def load_user():
    """本人から聞いた入学日・受給条件(user.json)。なければ空"""
    f = HERE / "user.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


USER = load_user()


def calc(c, today):
    """6か月ごとの支給額と申請期間、追加給付を計算する"""
    if USER.get("start_date"):
        start = date.fromisoformat(USER["start_date"])
    else:
        start = next_start(today, c["start_month"])
    months = c["duration_months"]
    finish = add_months(start, months) - timedelta(days=1)
    years = math.ceil(months / 12)
    fees = [f[1] + f[2] for f in c["fees"]]
    total = sum(fees)

    rows, paid, year_paid = [], 0, {}
    for i in range(math.ceil(months / 6)):
        p_start = add_months(start, 6 * i)
        p_end = min(add_months(start, 6 * (i + 1)) - timedelta(days=1), finish)
        cost = fees[i] if i < len(fees) else 0
        raw = int(cost * RATE_BASE)
        yr = i // 2
        room = CAP_BASE_YEAR - year_paid.get(yr, 0)
        amt = 0 if raw <= MIN_BASE else min(raw, room)
        year_paid[yr] = year_paid.get(yr, 0) + amt
        paid += amt
        how = f"{yen(cost)}×50%={yen(raw)}"
        if amt < raw:
            how += f" → 1年の上限40万円まで(この年の残り{yen(room)})"
        a_s, a_e = one_month_window(p_end)
        label = f"第{i + 1}期(受講中)" if p_end < finish else f"第{i + 1}期(修了時)"
        rows.append([label, f"{jd(p_start)}～{jd(p_end)}", f"{jd(a_s)}～{jd(a_e)}", how, amt])

    job_raw = int(total * RATE_JOB)
    job_cap = CAP_JOB_YEAR * years
    job = min(job_raw, job_cap)
    wage_raw = int(total * RATE_WAGE)
    wage_cap = CAP_WAGE_YEAR * years
    wage = min(wage_raw, wage_cap)

    # 追加給付の申請期間の例: 資格取得と就職がそろった日を修了日の翌日と仮定
    x = finish + timedelta(days=1)
    j_s, j_e = one_month_window(x)
    w_s = add_months(x + timedelta(days=1), 6)
    w_e = add_months(w_s, 6) - timedelta(days=1)
    return {
        "start": start, "finish": finish, "years": years, "total": total, "rows": rows, "base": paid,
        "job": job, "job_how": f"{yen(total)}×20%={yen(job_raw)}" + (f" → 上限{yen(job_cap)}(16万円×{years}年)" if job < job_raw else ""),
        "wage": wage, "wage_how": f"{yen(total)}×10%={yen(wage_raw)}" + (f" → 上限{yen(wage_cap)}(8万円×{years}年)" if wage < wage_raw else ""),
        "x": x, "job_win": (j_s, j_e), "wage_win": (w_s, w_e),
    }


def P(t, s=cell):
    return Paragraph(str(t).replace("\n", "<br/>"), s)


def kv_table(rows):
    t = Table([[P(k, cellb), P(v)] for k, v in rows], colWidths=[45 * mm, 125 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("GRID", (0, 0), (-1, -1), 0.4, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def grid_table(header, rows, widths, extra=()):
    data = [[P(h, cellb) for h in header]] + [[c if isinstance(c, Paragraph) else P(c) for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("GRID", (0, 0), (-1, -1), 0.4, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        *extra,
    ]))
    return t


def benefit_section(c, today):
    r = calc(c, today)
    cc_by = r["start"] - timedelta(days=14)
    if USER.get("start_date"):
        lead = (f"入学日<b>{jd(r['start'])}</b>(本人確認済み)から、修了日を{jd(r['finish'])}({c['duration_months']}ヶ月後)として計算しています。"
                "卒業日がずれると、最後の期と追加給付の申請期間もずれます。")
    else:
        lead = (f"受講開始日を<b>{jd(r['start'])}</b>(開講月{c['start_month']}月の1日)、修了日を{jd(r['finish'])}と仮定して計算しています。"
                "実際の入学日・卒業日がずれると、各期間と申請期間も同じだけずれます。")
    s = [Paragraph("給付金の見込み(入金のタイミングと金額)", h2), Paragraph(lead, note), Spacer(1, 3)]

    if USER.get("eligible"):
        cond = (f"<b>雇用保険の加入期間などの条件は満たしている(本人確認済み・{jd(date.fromisoformat(USER['confirmed_on']))}時点)。</b>"
                "正式な判定はハローワークの受給資格確認で行われます。")
    else:
        cond = ("雇用保険の加入期間などの条件あり(初めて利用する場合は通算2年以上。退職している場合は退職後1年以内)。"
                "自分が対象になるかはハローワークで確認(支給要件照会)できます。")
    s.append(kv_table([
        ("受講前にやること", f"①ジョブ・カードを作り、ハローワーク等で「訓練前キャリアコンサルティング」(予約制)を受ける\n"
                       f"②ハローワークで受給資格確認の手続き … <b>{jd(cc_by)}まで</b>(受講開始日の2週間前)"),
        ("受け取るための条件", cond),
    ]))
    s = [KeepTogether(s)]

    rows = [[a, b, d, e, P(yen(f), cellb)] for a, b, d, e, f in r["rows"]]
    rows.append([P("受講中・修了時の小計(50%)", cellb), "", "", "", P(yen(r["base"]), cellb)])
    rows.append(["追加①資格取得+就職(20%)", "修了後1年以内に資格取得し、雇用保険に入って就職",
                 f"資格取得と就職がそろった日の翌日から1か月以内\n(例:{jd(r['x'])}にそろった場合 {jd(r['job_win'][0])}～{jd(r['job_win'][1])})",
                 r["job_how"], P(yen(r["job"]), cellb)])
    rows.append(["追加②賃金5%以上アップ(10%)", "追加①の条件に加え、修了後の賃金が受講前より5%以上上がった",
                 f"資格取得・就職日の翌日から6か月たった日から6か月以内\n(例:{jd(r['wage_win'][0])}～{jd(r['wage_win'][1])}ごろ)",
                 r["wage_how"], P(yen(r["wage"]), cellb)])
    full = r["base"] + r["job"] + r["wage"]
    rows.append([P("最大の合計(80%)", cellb), "", "", f"教育訓練経費 {yen(r['total'])} に対して", P(yen(full), cellb)])
    n = len(r["rows"])
    hl = [("BACKGROUND", (0, n + 1), (-1, n + 1), LIGHT), ("BACKGROUND", (0, n + 4), (-1, n + 4), HILITE),
          ("SPAN", (0, n + 1), (3, n + 1)), ("SPAN", (0, n + 4), (2, n + 4))]
    s += [Spacer(1, 4), grid_table(["区分", "対象期間・条件", "申請する期間", "計算", "見込み額"], rows,
                                   [28 * mm, 34 * mm, 42 * mm, 44 * mm, 22 * mm], hl)]

    s += [Spacer(1, 3), Paragraph(
        "※入金のタイミング: 上の「申請する期間」にハローワークへ申請(来所・郵送・電子申請)→ ハローワークが支給を決定 → 本人の口座へ振込。"
        "申請から振込までの日数は公表されていないため、目安は申請時にハローワークで確認してください。<br/>"
        "※50%分は「受講開始日から1年ごとに40万円まで」。同じ年の2つの期の合計が40万円を超える分は、後の期で減らして計算しています。<br/>"
        "※各期の経費は厚生労働省サイトの「訓練経費」の第1期～の金額を、6か月ごとの期間にそのまま当てはめています。実際に支払った時期・金額で変わります(未払いの分は対象外)。<br/>"
        "※追加①②の「例」は、資格取得と就職がそろった日を修了日の翌日と仮定した場合です。美容師・看護師などは免許の登録日が資格取得日になるため、実際はもっと後になります。<br/>"
        "※失業中の45歳未満の人などは、別に「教育訓練支援給付金」(受講中の生活費の支援)を受けられる場合があります。<br/>"
        f"※計算ルールの出典: {RULE_SOURCE}。制度は変わることがあるため、申請前に必ずハローワークで確認してください。", note)]
    return s


def build(path, c, today):
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"{c['school']} {c['course']} 講座詳細", author="")
    s = [Paragraph(f"{c['school']}　{c['course']}", title),
         Paragraph(f"専門実践教育訓練 講座詳細 / 確認日 {jd(today)} / 出典: {SOURCE}", sub),
         Spacer(1, 6)]
    if c.get("remark"):
        s += [Paragraph(c["remark"], note), Spacer(1, 4)]
    s += [Paragraph("基本情報", h2), kv_table(c["basic"])]
    s += [Paragraph("受講できる教室", h2), kv_table(c["classroom"])]
    fee_rows = [[f[0], yen(f[1]), yen(f[2])] for f in c["fees"]]
    fee_rows.append(["小計", yen(sum(f[1] for f in c["fees"])), yen(sum(f[2] for f in c["fees"]))])
    fee_rows.append(["合計(入学料+受講料)", "", yen(sum(f[1] + f[2] for f in c["fees"]))])
    s += [Paragraph("訓練経費", h2),
          grid_table(["期", "入学料", "受講料"], fee_rows, [40 * mm, 65 * mm, 65 * mm]),
          Paragraph("※受講料は教育訓練給付金の算定対象となる金額。別途費用がかかる場合があるため、受講前に学校へ直接確認すること。", note)]
    s += benefit_section(c, today)
    s += [Paragraph("受講要件など", h2), kv_table(c["req"])]
    for k, rows in c["years"]:
        s += [Paragraph(k, h2), grid_table(["項目"] + YEARS, rows, [80 * mm, 30 * mm, 30 * mm, 30 * mm])]
    s += [Spacer(1, 8), Paragraph("※講座の情報は、教育訓練施設から厚生労働省へ報告された内容をそのまま書き起こしたもの。講座の詳細は受講開始前に学校へ直接確認すること。", note)]
    doc.build(s)


def safe(name):
    return re.sub(r'[\\/:*?"<>|]', "_", name)


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "courses.json"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    data = json.loads(src.read_text(encoding="utf-8"))
    today = date.fromisoformat(data["checked"])
    out.mkdir(parents=True, exist_ok=True)

    made = []
    for c in data["courses"]:
        path = out / f"{today.isoformat()}_{safe(c['school'])}_{safe(c['course'])}.pdf"
        build(path, c, today)
        made.append(path)
        print("作成:", path)

    # 最新(今回)以外の日付つきPDFはごみ箱へ
    for f in out.glob("*.pdf"):
        m = re.match(r"(\d{4}-\d{2}-\d{2})_", f.name)
        if m and m.group(1) != today.isoformat():
            send2trash(str(f))
            print("ごみ箱へ:", f)


if __name__ == "__main__":
    main()
