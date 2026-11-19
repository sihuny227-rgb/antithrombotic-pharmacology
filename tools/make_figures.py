# -*- coding: utf-8 -*-
"""문서 그림 8·9 생성 (기존 도해와 동일한 팔레트·레이아웃)"""
from PIL import Image, ImageDraw, ImageFont
import os

S = 2                      # supersampling
W = 1700
NAVY = (20, 43, 71)
INK = (36, 47, 65)
BLUE = (37, 99, 163)
TEAL = (14, 135, 125)
ORNG = (214, 119, 43)
RED = (180, 70, 70)
GREY = (102, 116, 135)
PANEL = (245, 249, 252)
WHITE = (255, 255, 255)
LINE = (136, 153, 170)
SUBT = (174, 191, 208)

FP = r"C:\Windows\Fonts\NotoSansKR-VF.ttf"
_cache = {}
def F(size, weight="Regular"):
    key = (size, weight)
    if key in _cache:
        return _cache[key]
    f = ImageFont.truetype(FP, size * S)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    _cache[key] = f
    return f

def rr(d, box, radius, fill=None, outline=None, width=1):
    d.rounded_rectangle([box[0]*S, box[1]*S, box[2]*S, box[3]*S], radius=radius*S,
                        fill=fill, outline=outline, width=width*S)

def rect(d, box, fill):
    d.rectangle([box[0]*S, box[1]*S, box[2]*S, box[3]*S], fill=fill)

def tx(d, xy, s, font, fill, anchor="la"):
    d.text((xy[0]*S, xy[1]*S), s, font=font, fill=fill, anchor=anchor)

def wd(d, s, font):
    return d.textlength(s, font=font) / S

def arrow_down(d, x, y0, y1, color=LINE, w=3):
    d.line([x*S, y0*S, x*S, (y1-9)*S], fill=color, width=w*S)
    d.polygon([(x*S, y1*S), ((x-9)*S, (y1-14)*S), ((x+9)*S, (y1-14)*S)], fill=color)

def canvas(h, title, right):
    im = Image.new("RGB", (W*S, h*S), WHITE)
    d = ImageDraw.Draw(im)
    rr(d, (0, 0, W, h), 22, fill=PANEL)
    rect(d, (0, 0, W, 60), NAVY)            # 헤더 바(윗모서리만 둥글게)
    rr(d, (0, 0, W, 112), 22, fill=NAVY)
    tx(d, (53, 61), title, F(46, "Bold"), WHITE, anchor="lm")
    tx(d, (W-53, 61), right, F(27), SUBT, anchor="rm")
    return im, d

def box(d, x0, y0, x1, y1, title, sub, color, dashed=False, tsize=33, ssize=25):
    rr(d, (x0, y0, x1, y1), 18, fill=WHITE, outline=color, width=3)
    if sub:
        tx(d, (x0+36, y0+34), title, F(tsize, "Bold"), INK, anchor="lm")
        tx(d, (x0+36, y0+(y1-y0)-34), sub, F(ssize), color, anchor="lm")
    else:
        tx(d, (x0+36, (y0+y1)//2), title, F(tsize, "Bold"), INK, anchor="lm")


# ── 그림 10. 섬유소 용해와 혈전용해제의 작용 지점 ──────────────────────
def fig_fibrinolysis(path):
    H = 980
    im, d = canvas(H, "그림 8 · 섬유소 용해와 혈전용해제", "플라스미노겐 → 플라스민 → 피브린 분해")
    x0, x1 = 88, W-88
    rows = [
        (152, 128, "혈전 속 피브린 + 플라스미노겐",
         "플라스미노겐이 피브린의 리신 결합 부위에 붙어 혈전 안에 들어가 있다", BLUE),
        (320, 134, "플라스미노겐 활성제: tPA · uPA",
         "혈전용해제의 작용 지점 — 알테플라제 · 테넥테플라제 · 레테플라제(피브린 특이) / 유로키나제 · 스트렙토키나제(비특이)", TEAL),
        (496, 128, "플라스민",
         "피브린에 결합한 플라스민은 보호되고, 혈중으로 빠져나온 플라스민은 α2-항플라스민이 중화한다", ORNG),
        (672, 128, "피브린 분해 → FDP · D-dimer",
         "혈전이 풀려 재관류. 비특이 제제는 혈중 피브리노겐까지 분해해 전신 출혈 경향이 커진다", RED),
    ]
    for (y, h, t, s, c) in rows:
        box(d, x0, y, x1, y+h, t, s, c, ssize=24)
    for a, b in ((280, 320), (454, 496), (624, 672)):
        arrow_down(d, W//2, a, b)

    # 억제 요소 띠
    y = 832
    rr(d, (x0, y, x1, y+108), 18, fill=(237, 242, 247), outline=(205, 215, 227), width=2)
    tx(d, (x0+36, y+30), "용해를 가로막는 요소", F(26, "Bold"), GREY, anchor="lm")
    tx(d, (x0+36, y+64), "PAI-1: tPA를 억제 — 혈소판이 많은 동맥 혈전에 풍부하다(테넥테플라제는 저항성이 높다)   ·   XIIIa 교차결합: 오래된 혈전일수록 저항",
       F(23), GREY, anchor="lm")
    tx(d, (x0+36, y+94), "트라넥삼산: 플라스미노겐이 피브린에 붙는 자리를 막아 용해를 차단 — 혈전용해 관련 출혈의 지혈에 쓰인다",
       F(23), GREY, anchor="lm")
    im.resize((W, H), Image.LANCZOS).save(path)


# ── 그림 11. 급성 허혈성 뇌졸중 혈전용해의 시간창과 전후 관리 ────────────
def fig_window(path):
    H = 900
    im, d = canvas(H, "그림 9 · 뇌졸중 혈전용해 시간창과 전후 관리", "2026 AHA/ASA · 발병(최종 정상 확인) 기준")
    x0, x1 = 88, W-88
    # 타임라인 막대
    ty, th = 210, 86
    segs = [(0.0, 0.34, TEAL, "0 – 4.5시간", "알테플라제 0.9 mg/kg(최대 90 mg)\n또는 테넥테플라제 0.25 mg/kg(최대 25 mg)"),
            (0.34, 0.60, ORNG, "4.5 – 9시간 · 발병 시각 불명", "고급 영상으로 선별한 환자\n(DWI-FLAIR 불일치, 관류 불일치)"),
            (0.60, 1.0, BLUE, "~ 24시간", "선택 환자의 혈전제거술 영역\n(영상 기준, 혈전용해 시간창과 다름)")]
    full = x1 - x0
    for (a, b, c, lab, note) in segs:
        ax, bx = x0 + full*a, x0 + full*b
        rr(d, (ax, ty, bx-6, ty+th), 12, fill=c)
        tx(d, (ax+26, ty+th//2), lab, F(28, "Bold"), WHITE, anchor="lm")
        yy = ty + th + 34
        for ln in note.split("\n"):
            tx(d, (ax+4, yy), ln, F(24), c, anchor="lm")
            yy += 34
    # 눈금
    for frac, lab in ((0.0, "발병 0"), (0.34, "4.5h"), (0.60, "9h"), (1.0, "24h")):
        xx = x0 + full*frac
        d.line([xx*S, (ty-26)*S, xx*S, (ty-6)*S], fill=LINE, width=2*S)
        tx(d, (min(max(xx, x0+30), x1-30), ty-44), lab, F(24, "Medium"), GREY, anchor="mm")

    tx(d, (x0, 408), "장애를 남기지 않는 경증 증상에는 혈전용해 대신 이중 항혈소판요법을 쓴다. 테넥테플라제 0.4 mg/kg은 권장하지 않는다.",
       F(25), INK, anchor="lm")

    # 전후 관리 3열
    cy, ch = 462, 320
    gap = 26
    cw = (full - gap*2) / 3
    cards = [
        (TEAL, "투여 전", ["CT로 출혈 배제 (도착 25분 내 목표)", "혈당 확인 — 저혈당 감별", "혈압 <185/110 mmHg", "  니카르디핀 · 라베탈롤 등 정주", "금기·시간창 확인"]),
        (ORNG, "투여 중 ~ 2시간", ["혀·입술 부종(혈관부종) 관찰", "  ACE 억제제 복용자에서 위험 증가", "발생 시 중단 + 기도 평가", "  항히스타민 · 스테로이드", "테넥테플라제: 덱스트로스 라인 세척"]),
        (BLUE, "투여 후 24시간", ["혈압 <180/105 mmHg 유지", "  수축기 <140 집중 강하는 비권장", "신경학적 평가·혈압 측정", "  15분×2h → 30분×6h → 1시간", "항혈전제 24시간 보류"]),
    ]
    for i, (c, head, items) in enumerate(cards):
        ax = x0 + i*(cw+gap)
        rr(d, (ax, cy, ax+cw, cy+ch), 18, fill=WHITE, outline=c, width=3)
        rr(d, (ax, cy, ax+cw, cy+56), 18, fill=c)
        rect(d, (ax+2, cy+38, ax+cw-2, cy+56), c)
        tx(d, (ax+28, cy+29), head, F(28, "Bold"), WHITE, anchor="lm")
        yy = cy + 92
        for it in items:
            ind = it.startswith("  ")
            s = it.strip()
            if not ind:
                d.ellipse([(ax+30)*S, (yy-4)*S, (ax+38)*S, (yy+4)*S], fill=c)
            tx(d, (ax+(60 if ind else 50), yy), s, F(23 if ind else 24), GREY if ind else INK, anchor="lm")
            yy += 42 if not ind else 38

    y = 812
    rr(d, (x0, y, x1, y+58), 14, fill=(250, 235, 233), outline=(228, 196, 191), width=2)
    tx(d, (x0+28, y+29), "용량 혼동 주의 — 테넥테플라제의 뇌졸중 용량(최대 25 mg)과 STEMI 용량(최대 50 mg)은 두 배 차이가 난다.",
       F(25, "Bold"), (150, 55, 50), anchor="lm")
    im.resize((W, H), Image.LANCZOS).save(path)


if __name__ == "__main__":
    out = os.path.dirname(os.path.abspath(__file__))
    fig_fibrinolysis(os.path.join(out, "f8_fibrinolysis.png"))
    fig_window(os.path.join(out, "f9_stroke_window.png"))
    print("done")
