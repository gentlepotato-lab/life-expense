"""엑셀에 얹을 그림을 그린다.

엑셀이 제 차트로 그릴 수도 있지만 모양을 손볼 여지가 좁다. 앱의 씀씀이와
같은 결로 직접 그려 그림 한 장으로 얹는다. 네 배로 그려 1/4로 줄여 넣으므로
화면에서 작아도 글자가 또렷하다.

글꼴은 기기에 있는 것을 찾아 쓴다. 못 찾으면 그림을 그리지 않고 비운다.
네모만 늘어선 그림을 내보내느니 없는 편이 낫다.
"""

from __future__ import annotations

import math
from io import BytesIO
from typing import Callable, Sequence

from PIL import Image, ImageDraw, ImageFont

# 네 배로 그린다. 엑셀에 넣을 때 1/4로 줄인다.
배 = 4

PRIMARY = "#5B5FEF"
CHART5 = ["#FF7FA8", "#4FB0F5", "#22C97E", "#B47CFF", "#FF8A5C"]
ETC = "#94A3B8"
INK = "#212529"
SUB = "#6C757D"
GRID = "#EDEEF2"
RAIL = "#F1F2F6"
AXIS = "#D7D9E0"
WHITE = "#FFFFFF"

# 기기마다 있는 자리가 다르다. 찾는 차례대로 쓴다.
글꼴자리 = [
    "C:/Windows/Fonts/malgun.ttf",
    "C:/Windows/Fonts/malgunbd.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
]
굵은자리 = [
    "C:/Windows/Fonts/malgunbd.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
]


def _글꼴(자리들: Sequence[str], 크기: int) -> ImageFont.FreeTypeFont | None:
    for p in 자리들:
        try:
            return ImageFont.truetype(p, 크기)
        except Exception:
            continue
    return None


def 글꼴있나() -> bool:
    """한글을 그릴 수 있는 글꼴이 있는지. 없으면 그림을 걸러 낸다."""
    return _글꼴(글꼴자리, 12) is not None


def _원(n: float) -> str:
    return f"{round(n):,}"


def _짧게(n: float) -> str:
    """축 눈금은 만 단위로 줄여 적는다. 눈금마다 일곱 자리가 서면 지저분하다."""
    if n >= 10000:
        v = n / 10000
        return f"{v:.0f}만" if abs(v - round(v)) < 0.05 else f"{v:.1f}만"
    return f"{round(n):,}"


def _눈금(최대: float, 칸: int = 4) -> list[float]:
    if 최대 <= 0:
        return [0.0, 1.0]
    대략 = 최대 / 칸
    자리 = 10 ** math.floor(math.log10(대략))
    간격 = 자리 * 10
    for 곱 in (1, 2, 2.5, 5, 10):
        if 자리 * 곱 >= 대략:
            간격 = 자리 * 곱
            break
    끝 = 간격 * math.ceil(최대 / 간격)
    return [간격 * i for i in range(int(round(끝 / 간격)) + 1)]


def _그리기판(폭: int, 높이: int):
    im = Image.new("RGB", (폭 * 배, 높이 * 배), WHITE)
    return im, ImageDraw.Draw(im)


def _글(d: ImageDraw.ImageDraw, xy, 글, 글꼴, 색, 맞춤="la"):
    d.text((xy[0] * 배, xy[1] * 배), 글, font=글꼴, fill=색, anchor=맞춤)


def _내보내기(im: Image.Image) -> bytes:
    bio = BytesIO()
    im.save(bio, format="PNG", optimize=True)
    return bio.getvalue()


def 세로막대(제목: str, 자료: Sequence[tuple[str, float]], 색: Callable[[int], str] | None = None,
          폭: int = 430, 높이: int = 200) -> bytes | None:
    """세로 막대. 왼쪽에 눈금과 가로 금을 세운다."""
    if not 자료 or not 글꼴있나():
        return None
    색 = 색 or (lambda i: PRIMARY)
    제목꼴 = _글꼴(굵은자리 or 글꼴자리, 12 * 배) or _글꼴(글꼴자리, 12 * 배)
    값꼴 = _글꼴(굵은자리, 10 * 배) or _글꼴(글꼴자리, 10 * 배)
    작은꼴 = _글꼴(글꼴자리, 10 * 배)
    이름꼴 = _글꼴(글꼴자리, 11 * 배)

    왼, 오, 위, 아래 = 54, 14, 40, 26
    최대 = max(v for _, v in 자료) or 1
    tick = _눈금(최대)
    천장 = tick[-1] or 1
    판높 = 높이 - 위 - 아래

    im, d = _그리기판(폭, 높이)
    _글(d, (14, 24), 제목, 제목꼴, INK, "ls")
    for t in tick:
        y = 높이 - 아래 - 판높 * (t / 천장)
        d.line([(왼 * 배, y * 배), ((폭 - 오) * 배, y * 배)], fill=GRID, width=배)
        _글(d, (왼 - 8, y), _짧게(t), 작은꼴, SUB, "rm")

    칸폭 = (폭 - 왼 - 오) / len(자료)
    막대 = min(34, 칸폭 * 0.5)
    for i, (k, v) in enumerate(자료):
        cx = 왼 + 칸폭 * (i + 0.5)
        h = 판높 * (max(v, 0) / 천장)
        x0, x1 = (cx - 막대 / 2) * 배, (cx + 막대 / 2) * 배
        y0, y1 = (높이 - 아래 - h) * 배, (높이 - 아래) * 배
        if h > 1:
            d.rounded_rectangle([x0, y0, x1, y1], radius=4 * 배, fill=색(i))
        _글(d, (cx, 높이 - 아래 - h - 7), _원(v), 값꼴, INK, "ms")
        _글(d, (cx, 높이 - 9), k, 이름꼴, SUB, "ms")
    d.line([(왼 * 배, (높이 - 아래) * 배), ((폭 - 오) * 배, (높이 - 아래) * 배)], fill=AXIS, width=배)
    return _내보내기(im)


def 가로막대(제목: str, 자료: Sequence[tuple[str, float]], 색: Callable[[int], str] | None = None,
          폭: int = 430) -> bytes | None:
    """가로 막대. 이름이 길어 눕히는 쪽이 읽힌다."""
    if not 자료 or not 글꼴있나():
        return None
    색 = 색 or (lambda i: ETC if i >= 5 else CHART5[i % 5])
    제목꼴 = _글꼴(굵은자리, 12 * 배) or _글꼴(글꼴자리, 12 * 배)
    값꼴 = _글꼴(굵은자리, 11 * 배) or _글꼴(글꼴자리, 11 * 배)
    작은꼴 = _글꼴(글꼴자리, 10 * 배)
    이름꼴 = _글꼴(글꼴자리, 11 * 배)

    줄 = 26
    높이 = 40 + 줄 * len(자료) + 10
    왼 = 14 + 96
    칸 = 폭 - 왼 - 104
    최대 = max(v for _, v in 자료) or 1
    총 = sum(v for _, v in 자료) or 1

    im, d = _그리기판(폭, 높이)
    _글(d, (14, 24), 제목, 제목꼴, INK, "ls")
    for i, (k, v) in enumerate(자료):
        y = 40 + 줄 * i
        이름 = k if len(k) <= 9 else k[:8] + "…"
        _글(d, (14, y + 13), 이름, 이름꼴, INK, "lm")
        d.rounded_rectangle([왼 * 배, (y + 3) * 배, (왼 + 칸) * 배, (y + 15) * 배],
                            radius=6 * 배, fill=RAIL)
        w = 칸 * (max(v, 0) / 최대)
        if w > 1:
            d.rounded_rectangle([왼 * 배, (y + 3) * 배, (왼 + w) * 배, (y + 15) * 배],
                                radius=6 * 배, fill=색(i))
        _글(d, (왼 + 칸 + 8, y + 13), f"{v / 총 * 100:.1f}%", 작은꼴, SUB, "lm")
        _글(d, (폭 - 14, y + 13), _원(v), 값꼴, INK, "rm")
    return _내보내기(im)


def 묶어(줄들, 키: str, 값: str = "amount", 몇: int = 5) -> list[tuple[str, float]]:
    """같은 것끼리 더해 큰 차례로 다섯까지. 나머지는 하나로 묶는다."""
    d: dict[str, float] = {}
    for x in 줄들:
        k = x.get(키) or "(미지정)"
        d[k] = d.get(k, 0.0) + float(x[값])
    목록 = sorted(d.items(), key=lambda kv: -kv[1])
    if len(목록) > 몇:
        목록 = 목록[:몇] + [("그 밖", sum(v for _, v in 목록[몇:]))]
    return 목록


__all__ = ["세로막대", "가로막대", "묶어", "글꼴있나", "PRIMARY", "CHART5", "ETC"]
