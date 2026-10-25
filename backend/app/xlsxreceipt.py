"""올라온 영수증 그림을 쪽으로 자른다.

영수증은 앱이 canvas로 그린다(frontend/src/utils/receipt.ts). 서버가 한 벌 더
그리면 둘이 어긋나는 날이 반드시 오므로, 그린 그림을 그대로 받아 자르기만
한다. 여기서 하는 일은 자르는 것뿐이고 무엇을 그릴지는 정하지 않는다.

받는 것이 바깥에서 온 바이트라 재는 것부터 한다. PNG가 아니거나 너무 크면
그냥 버린다. 영수증이 없다고 파일이 안 나가는 것은 아니다.
"""

from __future__ import annotations

from io import BytesIO

from PIL import Image

# 바깥에서 오는 바이트에 거는 울타리.
최대바이트 = 8 * 1024 * 1024
최대픽셀 = 40_000_000
쪽높이 = 1800  # 2배로 그려 오므로 엑셀에서는 900px, 줄 높이 20에 45줄쯤이다.
최대쪽 = 12


def 쪽내기(바이트: bytes | None) -> list[bytes]:
    """긴 영수증을 같은 높이의 쪽으로 자른다. 자를 것이 없으면 빈 목록이다."""
    if not 바이트 or len(바이트) > 최대바이트:
        return []
    try:
        im = Image.open(BytesIO(바이트))
        if im.format != "PNG":
            return []
        im.load()
    except Exception:
        return []

    w, h = im.size
    if w <= 0 or h <= 0 or w * h > 최대픽셀:
        return []

    쪽수 = max(1, -(-h // 쪽높이))
    if 쪽수 > 최대쪽:
        # 너무 길면 쪽을 늘리는 대신 한 쪽을 키운다. 가로로 끝없이 늘어나면
        # 시트를 옆으로 한참 굴려야 한다.
        쪽수 = 최대쪽
    높이 = -(-h // 쪽수)

    쪽들: list[bytes] = []
    for i in range(쪽수):
        위 = i * 높이
        아래 = min(h, 위 + 높이)
        if 위 >= 아래:
            break
        조각 = im.crop((0, 위, w, 아래))
        bio = BytesIO()
        조각.save(bio, format="PNG", optimize=True)
        쪽들.append(bio.getvalue())
    return 쪽들


__all__ = ["쪽내기"]
