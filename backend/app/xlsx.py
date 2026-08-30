"""
표 하나를 엑셀 파일(.xlsx)로 만든다.

.xlsx 는 XML 몇 장을 zip 으로 묶은 것이라, 표 한 장만 내보내는 데에는 바깥
꾸러미가 필요하지 않다. 표준 라이브러리의 zipfile 로 충분하다 — 이것 하나
때문에 openpyxl 을 들이지 않는다.

CSV 로도 열리기는 하지만 날짜가 글자로, 금액이 글자로 들어간다. 받아서
바로 걸러 보고 더해 보려면 날짜는 날짜로, 금액은 숫자로 들어가야 한다.
"""

import zipfile
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO

# 엑셀이 날짜를 세는 기준. 1900년을 윤년으로 잘못 아는 옛 버릇 때문에
# 실제 기준일은 1899-12-30 이다.
EPOCH = date(1899, 12, 30)

# 칸에 입힐 모양. 아래 STYLES 의 cellXfs 차례와 맞춘다.
S_PLAIN = 0
S_HEAD = 1
S_DATE = 2
S_MONEY = 3

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

BOOK_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
<numFmt numFmtId="164" formatCode="yyyy&quot;-&quot;mm&quot;-&quot;dd"/>
<numFmt numFmtId="165" formatCode="#,##0"/>
</numFmts>
<fonts count="2">
<font><sz val="11"/><name val="맑은 고딕"/></font>
<font><b/><sz val="11"/><name val="맑은 고딕"/><color rgb="FF007A73"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2F7F6"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>"""


def _book(sheet_name: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets><sheet name="{_esc(sheet_name)}" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )


def _esc(s: str) -> str:
    """XML 이 삼키는 글자를 막고, 제어 문자는 걷어 낸다(파일이 깨진다)"""
    out = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return "".join(c for c in out if c >= " " or c in "\t\n")


def _col(i: int) -> str:
    """0 → A, 25 → Z, 26 → AA"""
    name = ""
    while True:
        name = chr(ord("A") + i % 26) + name
        i = i // 26 - 1
        if i < 0:
            return name


def _cell(ref: str, value, style: int) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, (date, datetime)):
        day = value.date() if isinstance(value, datetime) else value
        return f'<c r="{ref}" s="{S_DATE}"><v>{(day - EPOCH).days}</v></c>'
    if isinstance(value, Decimal):
        value = float(value)
    if isinstance(value, bool):
        value = int(value)
    if isinstance(value, (int, float)):
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    return (
        f'<c r="{ref}" s="{style}" t="inlineStr">'
        f'<is><t xml:space="preserve">{_esc(str(value))}</t></is></c>'
    )


def sheet_bytes(
    head: list[str],
    rows: list[list],
    money_cols: set[int] | None = None,
    widths: list[int] | None = None,
    sheet_name: str = "Sheet1",
) -> bytes:
    """
    머리글 한 줄과 자료 줄들을 엑셀 파일로 묶어 돌려준다.

    money_cols 에 든 자리는 천 단위 쉼표를 붙인다. 날짜는 값의 생김새를 보고
    알아서 날짜 칸으로 넣으므로 따로 일러 줄 것이 없다.
    """
    money = money_cols or set()
    last = _col(len(head) - 1)
    body = [
        "<row r=\"1\">"
        + "".join(_cell(f"{_col(i)}1", h, S_HEAD) for i, h in enumerate(head))
        + "</row>"
    ]
    for n, row in enumerate(rows, start=2):
        cells = "".join(
            _cell(f"{_col(i)}{n}", v, S_MONEY if i in money else S_PLAIN)
            for i, v in enumerate(row)
        )
        body.append(f'<row r="{n}">{cells}</row>')

    cols = ""
    if widths:
        inner = "".join(
            f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>'
            for i, w in enumerate(widths)
        )
        cols = f"<cols>{inner}</cols>"

    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<dimension ref="A1:{last}{len(rows) + 1}"/>'
        '<sheetViews><sheetView workbookViewId="0">'
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        "</sheetView></sheetViews>"
        '<sheetFormatPr defaultRowHeight="16"/>'
        f"{cols}"
        f"<sheetData>{''.join(body)}</sheetData>"
        f'<autoFilter ref="A1:{last}{len(rows) + 1}"/>'
        "</worksheet>"
    )

    buf = BytesIO()
    # 압축해 두어야 줄이 많아져도 내려받는 데 오래 걸리지 않는다
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels", ROOT_RELS)
        z.writestr("xl/workbook.xml", _book(sheet_name))
        z.writestr("xl/_rels/workbook.xml.rels", BOOK_RELS)
        z.writestr("xl/styles.xml", STYLES)
        z.writestr("xl/worksheets/sheet1.xml", sheet)
    return buf.getvalue()
