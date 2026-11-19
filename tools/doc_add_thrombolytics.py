# -*- coding: utf-8 -*-
"""원본 통합가이드에 '05. 혈전용해제' 단원을 삽입하고 번호·그림·참고문헌을 갱신한다."""
import zipfile, shutil, os, io, re, sys

SRC = r"G:\내 드라이브\약학\혈액응고_항혈소판제_항응고제_약리학_통합가이드_2026-11-14.docx"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out.docx")

GRID = 9802
def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def P(text="", style=None, after=None, bold=False, size=None, color=None, italic=False, center=False):
    pr = ""
    inner = ""
    if style:
        inner += '<w:pStyle w:val="%s"/>' % style
    if center:
        inner += '<w:jc w:val="center"/>'
    if after is not None:
        inner += '<w:spacing w:after="%d"/>' % after
    if inner:
        pr = "<w:pPr>%s</w:pPr>" % inner
    rpr = ""
    r = ""
    if bold: rpr += "<w:b/>"
    if italic: rpr += "<w:i/>"
    if color: rpr += '<w:color w:val="%s"/>' % color
    if size: rpr += '<w:sz w:val="%d"/>' % size
    if rpr: rpr = "<w:rPr>%s</w:rPr>" % rpr
    if text:
        parts = text.split("\n")
        body = "<w:t xml:space=\"preserve\">%s</w:t>" % esc(parts[0])
        for p in parts[1:]:
            body += "<w:br/><w:t xml:space=\"preserve\">%s</w:t>" % esc(p)
        r = "<w:r>%s%s</w:r>" % (rpr, body)
    return "<w:p>%s%s</w:p>" % (pr, r)

def H1(t): return P(t, style="Heading1")
def H2(t): return P(t, style="Heading2")

def cell(text, w, fill, bold=False, color=None):
    rpr = ""
    if bold: rpr += "<w:b/>"
    if color: rpr += '<w:color w:val="%s"/>' % color
    rpr += '<w:sz w:val="17"/>'
    return ('<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="%d"/><w:vAlign w:val="center"/><w:shd w:fill="%s"/></w:tcPr>'
            '<w:p><w:pPr><w:spacing w:after="20" w:before="20"/></w:pPr>'
            '<w:r><w:rPr>%s</w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p></w:tc>') % (w, fill, rpr, esc(text))

def TBL(header, rows):
    n = len(header)
    w = GRID // n
    out = ('<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:type="auto" w:w="0"/><w:jc w:val="center"/>'
           '<w:tblLook w:firstColumn="1" w:firstRow="1" w:lastColumn="0" w:lastRow="0" w:noHBand="0" w:noVBand="1" w:val="04A0"/>'
           '</w:tblPr><w:tblGrid>%s</w:tblGrid>') % ('<w:gridCol w:w="%d"/>' % w * n)
    out += "<w:tr><w:trPr><w:tblHeader/></w:trPr>" + "".join(
        cell(h, w, "173A59", bold=True, color="FFFFFF") for h in header) + "</w:tr>"
    for i, row in enumerate(rows):
        fill = "FFFFFF" if i % 2 == 0 else "F0F6FA"
        out += "<w:tr>" + "".join(cell(c, w, fill) for c in row) + "</w:tr>"
    out += "</w:tbl>" + P(after=20)
    return out

def BOX(title, body, fill="EAF4F5", color="142B47"):
    return ('<w:tbl><w:tblPr><w:tblW w:type="auto" w:w="0"/>'
            '<w:tblLook w:firstColumn="1" w:firstRow="1" w:lastColumn="0" w:lastRow="0" w:noHBand="0" w:noVBand="1" w:val="04A0"/>'
            '</w:tblPr><w:tblGrid><w:gridCol w:w="%d"/></w:tblGrid>'
            '<w:tr><w:tc><w:tcPr><w:tcW w:type="dxa" w:w="%d"/><w:shd w:fill="%s"/></w:tcPr>'
            '<w:p><w:r><w:rPr><w:b/><w:color w:val="%s"/><w:sz w:val="18"/></w:rPr>'
            '<w:t xml:space="preserve">%s</w:t><w:br/><w:t xml:space="preserve">%s</w:t></w:r></w:p>'
            '</w:tc></w:tr></w:tbl>') % (GRID, GRID, fill, color, esc(title), esc(body)) + P(after=20)

def FIG(rid, name, cx, px_w, px_h, caption, docpr):
    cy = int(round(cx * px_h / px_w))
    return ('<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
            '<wp:inline xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            '<wp:extent cx="%d" cy="%d"/><wp:docPr id="%d" name="Picture %d"/>'
            '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
            '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
            '<pic:nvPicPr><pic:cNvPr id="0" name="%s"/><pic:cNvPicPr/></pic:nvPicPr>'
            '<pic:blipFill><a:blip r:embed="%s"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/></a:xfrm>'
            '<a:prstGeom prst="rect"/></pic:spPr></pic:pic></a:graphicData></a:graphic>'
            '</wp:inline></w:drawing></w:r></w:p>') % (cx, cy, docpr, docpr, name, rid, cx, cy) + \
           P(caption, after=200, italic=True, color="667487", size=16, center=True)

CX = 5652000

# ─────────────────────────────── 새 단원 ───────────────────────────────
S = []
S.append(H1("05. 혈전용해제: 이미 막힌 혈관을 다시 여는 약"))
S.append(P("항혈소판제와 항응고제는 혈전이 새로 생기고 자라는 것을 막지만 이미 만들어진 혈전을 녹이지는 못한다. "
           "혈전용해제는 플라스미노겐을 플라스민으로 바꾸어 피브린을 직접 분해하는 유일한 계열이며, 목표는 예방이 아니라 재관류다. "
           "지혈에 쓰인 정상 혈전까지 함께 녹기 때문에 출혈, 특히 두개내출혈이 가장 큰 위험이고, 시간창·금기·혈압 관리가 약효만큼 중요하다."))
S.append(FIG("rId20", "f8_fibrinolysis.png", CX, 1700, 980,
             "그림 8. 피브린 결합 플라스미노겐의 활성화와 혈전용해제의 작용 지점", 10))

S.append(H2("5-1. 작용 기전과 제제별 차이"))
S.append(P("표적: 혈전 안에서 피브린에 결합한 플라스미노겐이다. tPA 계열은 피브린이 있을 때 플라스미노겐 활성화 효율이 크게 올라가므로"
           "(피브린 특이성) 혈중 피브리노겐 소모가 상대적으로 적다. 유로키나제와 스트렙토키나제는 피브린 유무와 무관하게 플라스미노겐을 "
           "활성화해 전신 섬유소 용해를 일으킨다."))
S.append(P("• 용해를 가로막는 요소: PAI-1은 tPA를 억제하며 혈소판이 풍부한 동맥 혈전에 많다. 테넥테플라제는 PAI-1 저항성이 높다. "
           "XIIIa로 교차결합이 진행된 오래된 혈전일수록 용해에 저항한다. α₂-항플라스민은 혈중으로 빠져나온 유리 플라스민을 빠르게 중화한다."))
S.append(P("• 분해산물: 플라스민이 피브린을 자르면 FDP와 D-dimer가 생긴다. D-dimer 상승은 교차결합된 피브린이 분해되고 있다는 뜻이다."))
S.append(TBL(["제제", "구조·피브린 특이성", "반감기·투여 방식"], [
    ["알테플라제(Alteplase)", "재조합 단일사슬 tPA. 피브린 특이성 높음, PAI-1 저항성 낮음", "초기 반감기 5분 미만. 볼루스 후 지속 주입"],
    ["테넥테플라제(Tenecteplase)", "tPA의 세 부위 치환(T103N, N117Q, KHRR296–299AAAA). 피브린 특이성·PAI-1 저항성 더 높음", "말기 반감기 90~130분. 5초 단회 볼루스"],
    ["레테플라제(Reteplase)", "tPA 결실 변이체(kringle 2 + 단백분해 도메인). 피브린 결합력 낮음", "약 13~16분. 10 U + 10 U, 30분 간격"],
    ["유로키나제(Urokinase)", "피브린 유무와 무관하게 플라스미노겐을 직접 활성화", "20분 이하. 주로 카테터 직접 혈전용해"],
    ["스트렙토키나제(Streptokinase)", "세균 단백. 플라스미노겐과 복합체를 만들어 활성화, 비특이", "1.5 MU를 30~60분 주입. 항원성으로 재투여 불가"],
]))
S.append(TBL(["제제", "급성 허혈성 뇌졸중", "STEMI", "국내 현황"], [
    ["알테플라제", "0.9 mg/kg(최대 90 mg)", "가속 요법, 총 100 mg 이하", "액티라제"],
    ["테넥테플라제", "0.25 mg/kg(최대 25 mg)", "체중 구간 30~50 mg", "메탈라제주 25 mg. 2025년 10월 허가, 2026년 5월 출시, 급여 절차 진행 중(보도 기준)"],
    ["레테플라제", "표준 아님(연구 단계)", "10 U × 2회", "국내 유통 확인 필요"],
    ["유로키나제", "표준 아님", "표준 아님", "국내 제제 있음. 주로 카테터 직접 용해"],
    ["스트렙토키나제", "사용하지 않음(출혈·사망 증가)", "일부 국가에서 사용", "국내 유통 확인 필요"],
]))
S.append(P("반감기와 허가 용량은 미국 제품설명서(Activase 2022, TNKase 2025) 기준이며, 국내 제품의 허가사항은 별도로 확인한다.",
           size=17, color="667487"))

S.append(H2("5-2. 급성 허혈성 뇌졸중"))
S.append(FIG("rId21", "f9_stroke_window.png", CX, 1700, 900,
             "그림 9. 뇌졸중 혈전용해의 시간창과 투여 전후 관리", 11))
S.append(P("2026 AHA/ASA 가이드라인은 발병(최종 정상 확인) 4.5시간 이내의 적격 환자에게 알테플라제 또는 테넥테플라제를 동등하게 권고한다. "
           "알테플라제는 0.9 mg/kg(최대 90 mg)을 10%는 1분 볼루스로, 나머지는 60분에 주입한다. 테넥테플라제는 0.25 mg/kg(최대 25 mg)을 "
           "5초 단회 볼루스로 투여한다. 테넥테플라제 0.4 mg/kg은 이득이 없고 해로울 수 있어 권장하지 않는다."))
S.append(P("• 장애를 남길 증상이면 NIHSS 점수와 무관하게 고급 영상 선별 없이 4.5시간 이내 신속히 투여한다. 반대로 장애를 남기지 않는 경증 "
           "증상에는 혈전용해의 이득이 없어 이중 항혈소판요법을 쓴다."))
S.append(P("• 발병 시각을 모르거나 4.5~9시간인 환자도 DWI-FLAIR 불일치, 관류 불일치 같은 고급 영상 기준을 만족하면 투여를 고려한다."))
S.append(P("• 혈전제거술 대상이면 혈전용해를 시행하되 시술을 지연시키지 않는다. 두 치료는 순차적으로 신속히 진행한다."))
S.append(P("• 미국 허가사항의 시간창은 두 약 모두 발병 3시간 이내이며, 4.5시간과 연장 시간창은 가이드라인 근거다. 국내 적용은 허가사항과 "
           "진료지침을 함께 확인한다."))
S.append(P("• 정맥 혈전용해의 효과를 높일 목적으로 아르가트로반이나 엡티피바타이드를 함께 쓰는 것은 권장하지 않는다."))
S.append(TBL(["허가사항 금기 (Activase · TNKase)", "표준 프로토콜에서 쓰는 추가 제외 기준"], [
    ["현재 두개내출혈 또는 지주막하출혈", "교정되지 않는 혈압 >185/110 mmHg"],
    ["활동성 내부 출혈", "혈소판 <100,000/mm³, INR >1.7, aPTT >40초, PT >15초"],
    ["최근 두개내·척추 수술 또는 중증 두부외상 (알테플라제 3개월, 테넥테플라제 2개월)", "48시간 내 DOAC 복용 (약물 특이 검사가 정상이면 예외 검토)"],
    ["두개내 종양, 동정맥기형, 동맥류", "24시간 내 치료용량 저분자량 헤파린"],
    ["알려진 출혈 소인", "3개월 내 허혈성 뇌졸중, 21일 내 위장관 출혈"],
    ["조절되지 않는 중증 고혈압", "최근 대수술·압박이 어려운 동맥천자 등 기관 프로토콜 항목"],
]))
S.append(P("추가 제외 기준은 개정판에서 일부 달라질 수 있으므로 원문과 기관 프로토콜을 확인한다. 혈소판·응고검사는 이상이 의심될 때 확인하며, "
           "결과를 기다리느라 투여를 늦추지 않는다.", size=17, color="667487"))
S.append(P("투여 전후 관리", bold=True, color="142B47"))
S.append(P("• 투여 전: 영상으로 출혈을 배제하고(도착 25분 내 촬영 목표), 혈당으로 저혈당을 감별하며, 혈압을 185/110 mmHg 미만으로 "
           "낮춘다(니카르디핀·라베탈롤 등 정주)."))
S.append(P("• 투여 후 24시간: 혈압을 180/105 mmHg 미만으로 유지한다. 다만 수축기 혈압을 140 mmHg 미만으로 집중 강하하는 것은 "
           "기능 예후를 개선하지 않아 권장하지 않는다."))
S.append(P("• 신경학적 평가와 혈압 측정: 15분마다 2시간 → 30분마다 6시간 → 1시간마다 24시간까지 시행한다."))
S.append(P("• 항혈전제는 24시간 보류하고, 24시간 추적 영상에서 출혈이 없으면 시작한다."))
S.append(P("• 근육주사와 불필요한 동맥천자를 피하고, 비위관·도뇨관 삽입은 가능하면 미룬다."))
S.append(P("• 테넥테플라제는 덱스트로스 함유 수액과 만나면 침전하므로 투여 전후에 생리식염수로 라인을 세척한다."))
S.append(P("• 채혈 검체 안에서도 피브리노겐이 계속 분해되므로 응고검사 해석에 주의한다."))
S.append(P("증상성 두개내출혈이 의심될 때", bold=True, color="142B47"))
S.append(P("신경학적 악화, 새로 생긴 두통, 구토, 급격한 혈압 상승이 나타나면 즉시 주입을 중단하고 응급 CT와 함께 "
           "CBC·PT/INR·aPTT·피브리노겐·혈액형 검사를 시행한다. 동결침전제제 10 U를 10~30분에 투여하고 피브리노겐 150 mg/dL 이상을 "
           "목표로 추가하며, 대안으로 트라넥삼산 10~15 mg/kg을 20분에 정주한다. 혈압과 두개내압을 관리하면서 신경외과·혈액학과와 협진한다."))
S.append(P("혈관부종", bold=True, color="142B47"))
S.append(P("주입 중부터 2시간 이내에 혀와 입술이 붓는지 관찰한다. ACE 억제제 복용자에서 위험이 높다. 발생하면 기도를 평가하고 주입과 "
           "ACE 억제제를 중단한 뒤 항히스타민과 스테로이드를 투여하며, 진행하면 에피네프린과 기관삽관을 준비한다. 테넥테플라제 허가 임상에서 "
           "구강·혀 혈관부종은 1.0%였다."))

S.append(H2("5-3. STEMI"))
S.append(P("• 일차 PCI를 120분 안에 시행할 수 없고 증상 발생 12시간 이내이며 금기가 없으면 섬유소 용해를 시행한다(2025 ACC/AHA)."))
S.append(P("• 투여 후에는 PCI 가능 병원으로 이송하고, 재관류에 성공하면 2~24시간 내 관상동맥조영과 필요한 PCI를 시행한다(ESC 2023). "
           "재관류 실패가 의심되면 구조적 PCI를 시행한다."))
S.append(P("• 병용 약물: 아스피린과 클로피도그렐, 항응고제를 함께 쓴다. 섬유소 용해와 함께 쓰는 P2Y₁₂ 억제제는 클로피도그렐이며 "
           "프라수그렐·티카그렐러로 대체하지 않는다."))
S.append(P("• 테넥테플라제 체중 구간(5초 단회 볼루스): 60 kg 미만 30 mg, 60~69 kg 35 mg, 70~79 kg 40 mg, 80~89 kg 45 mg, "
           "90 kg 이상 50 mg."))
S.append(P("• 알테플라제 가속 요법(총 100 mg 이하): 15 mg 볼루스 → 0.75 mg/kg을 30분(최대 50 mg) → 0.5 mg/kg을 60분(최대 35 mg)."))
S.append(P("• 60세 이상에서 절반 용량 테넥테플라제를 쓰는 약물-침습 전략은 STREAM-2 연구의 근거이며, 고령에서 출혈 위험을 낮추려는 "
           "접근이다."))

S.append(H2("5-4. 고위험 폐색전증"))
S.append(P("• 2026 AHA/ACC 급성 폐색전증 가이드라인은 기존의 massive·submassive 분류 대신 A~E의 임상 범주를 사용한다."))
S.append(P("• 지속되는 저혈압과 심폐부전을 동반한 범주 E에서 금기가 없으면 전신 혈전용해를 시행한다."))
S.append(P("• 저위험~중간위험(A1~C2)에서는 항응고 단독에 비해 이득이 분명하지 않고 대출혈과 두개내출혈만 늘어 권장하지 않는다."))
S.append(P("• 알테플라제 100 mg을 2시간에 주입하는 것이 허가 용법이다. 주입이 끝날 무렵 aPTT가 정상의 2배 이하로 돌아오면 헤파린을 "
           "재개한다(Activase 허가사항)."))
S.append(P("• 출혈 위험이 큰 환자에서는 카테터 기반 치료를 검토하고, 범주 C~E에서는 다학제 폐색전증 대응팀(PERT) 평가를 권고한다."))
S.append(P("• 폐색전증에서는 기저 심부정맥혈전이 풀리면서 재색전이 생길 수 있다는 점을 함께 고려한다."))

S.append(H2("5-5. 세 계열의 역할 구분"))
S.append(TBL(["구분", "항혈소판제", "항응고제", "혈전용해제"], [
    ["표적", "COX-1, P2Y₁₂, PDE3, 5-HT₂A, GPIIb/IIIa", "VKORC1, AT 매개 Xa·IIa, 직접 Xa, 직접 IIa", "피브린에 결합한 플라스미노겐"],
    ["치료 목표", "혈소판 활성화·응집을 막아 새 혈전 예방", "트롬빈·피브린 생성을 줄여 생성·성장·재발 억제", "이미 막힌 혈관의 피브린을 분해해 재관류"],
    ["이미 생긴 혈전", "녹이지 못함", "녹이지 못함. 성장이 멈추면 체내 섬유소 용해가 서서히 제거", "직접 분해"],
    ["대표 상황", "ACS·PCI 후, 비심인성 뇌졸중·TIA, 증상 있는 PAD", "심방세동, DVT·PE, 기계판막, ACS 급성기", "4.5시간 이내 허혈성 뇌졸중, PCI가 지연되는 STEMI, 고위험 PE"],
    ["핵심 주의", "위장관 출혈, 임의 중단 금지, 수술 전 중단 기간", "신기능별 용량, 상호작용, INR·HIT", "시간창·금기, 혈압, 24시간 항혈전제 보류, 두개내출혈"],
    ["출혈 시", "특이 길항제 없음", "비타민 K·PCC, 프로타민, 이다루시주맙", "중단, 동결침전제제, 트라넥삼산"],
]))
S.append(BOX("용량 혼동 주의",
             "테넥테플라제의 급성 허혈성 뇌졸중 용량(0.25 mg/kg, 최대 25 mg)과 STEMI 용량(체중 구간 30~50 mg)은 두 배까지 차이가 난다. "
             "실제 투여는 실측 체중, 기관 프로토콜, 두 사람 확인을 따른다.",
             fill="FBEEEC", color="B44646"))
NEW = "".join(S)

# ─────────────────────────── 원본 문서 수정 ────────────────────────────
z = zipfile.ZipFile(SRC)
doc = z.read("word/document.xml").decode("utf8")
orig_len = len(doc)

def sub1(old, new, where="document"):
    global doc
    n = doc.count(old)
    if n != 1:
        print("  !! %d hits: %s" % (n, old[:60]))
        sys.exit(1)
    doc = doc.replace(old, new)

# 1) 그림 번호 (뒤에서부터)
sub1("그림 9. 항응고제별", "그림 11. 항응고제별")
sub1("그림 8. 동맥·정맥", "그림 10. 동맥·정맥")
# 2) 장 번호 (뒤에서부터)
for a, b in [("12. 주요 근거", "13. 주요 근거"), ("11. 약국 실무", "12. 약국 실무"),
             ("10. 출혈과 역전제", "11. 출혈과 역전제"), ("09. 시술·수술", "10. 시술·수술"),
             ("08. 혈액검사와", "09. 혈액검사와"), ("07. 중요한 상호작용", "08. 중요한 상호작용"),
             ("06. 항혈소판제+항응고제", "07. 항혈소판제+항응고제"), ("05. 임상 상황별", "06. 임상 상황별")]:
    sub1(a, b)
# 3) 목차
sub1("01 정상 지혈과 응고인자 / 02 혈소판 활성화 수용체 / 03 항혈소판제 성분별 심화 / 04 항응고제 성분별 심화 / "
     "05 주요 질환별 치료 선택과 기간 / 06 병용전략 / 07 상호작용 / 08 검사·모니터링 / 09 수술·치과·특수 환자 / "
     "10 출혈·길항제 / 11 복약지도·실무 점검 / 12 참고문헌",
     "01 정상 지혈과 응고인자 / 02 혈소판 활성화 수용체 / 03 항혈소판제 성분별 심화 / 04 항응고제 성분별 심화 / "
     "05 혈전용해제 / 06 주요 질환별 치료 선택과 기간 / 07 병용전략 / 08 상호작용 / 09 검사·모니터링 / "
     "10 수술·치과·특수 환자 / 11 출혈·길항제 / 12 복약지도·실무 점검 / 13 참고문헌")
# 4) 표지
sub1("항혈소판제·항응고제 완전정리", "항혈소판제·항응고제·혈전용해제 완전정리")
sub1("작용 표적 · 표준 용법 · 부작용 발생기전 · 주요 금기 · 상호작용 · 검사 · 수술 전후 관리 · 역전제",
     "작용 표적 · 표준 용법 · 부작용 발생기전 · 주요 금기 · 상호작용 · 검사 · 수술 전후 관리 · 혈전용해 · 역전제")
sub1("업데이트: 2026년 11월 14일  |  성인 약물치료 중심",
     "업데이트: 2026년 11월 14일 (혈전용해제 단원 추가)  |  성인 약물치료 중심")
sub1("항혈소판제는 1차 지혈의 부착·활성화·응집 신호를, 항응고제는 2차 지혈의 트롬빈 생성·피브린 생성을 주로 억제한다. "
     "이 구분은 절대적이지 않으며 실제 혈전에서는 두 기전이 함께 작용한다.",
     "항혈소판제는 1차 지혈의 부착·활성화·응집 신호를, 항응고제는 2차 지혈의 트롬빈 생성·피브린 생성을 주로 억제한다. "
     "두 계열 모두 이미 만들어진 혈전을 녹이지는 못하며, 피브린을 직접 분해하는 것은 혈전용해제뿐이다. "
     "이 구분은 절대적이지 않으며 실제 혈전에서는 두 기전이 함께 작용한다.")
# 5) 새 단원 삽입
anchor = '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>06. 임상 상황별 약물 선택과 치료기간</w:t></w:r></w:p>'
sub1(anchor, NEW + anchor)
# 6) 임상 핵심 정리표에 혈전용해제 행 추가
tail = ('<w:t>직접 IIa</w:t>', '다비가트란·아르가트로반')
i = doc.find("다비가트란·아르가트로반")
j = doc.find("</w:tr>", i) + 7
w3 = 3267
row = "<w:tr>" + "".join(cell(c, w3, "F0F6FA") for c in
                        ["플라스미노겐 → 플라스민", "알테플라제·테넥테플라제", "시간창·금기·혈압·두개내출혈"]) + "</w:tr>"
assert doc[j:j+8] == "</w:tbl>", doc[j:j+40]
doc = doc[:j] + row + doc[j:]
# 7) 참고문헌 추가
refs = [
    ("[10] 2026 AHA/ACC Acute Pulmonary Embolism Guideline (요약)",
     "https://www.acc.org/Latest-in-Cardiology/Journal-Scans/2026/02/17/14/32/ACC-AHA-Release-First-Ever-Guideline-For-Treatment-and-Management-of-Acute-PE"),
    ("[11] DailyMed Activase (alteplase) prescribing information",
     "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c669f77c-fa48-478b-a14b-80b20a0139c2"),
    ("[12] DailyMed TNKase (tenecteplase) prescribing information, 2025 (AIS 적응증 포함)",
     "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e647640d-c395-4b4b-a0be-1162f9c21d84"),
    ("[13] 메탈라제(테넥테플라제) 국내 허가·출시 보도, 메디게이트뉴스 2026-05-29",
     "https://www.medigatenews.com/news/3358001192"),
    ("[14] 2025 ESO Guideline on Blood Pressure Management in Acute Ischaemic Stroke",
     "https://www.medthority.com/guidelines/acute-cerebrovascular-disease/2025-eso-guideline-on-blood-pressure-management-in-acute-ischaemic-stroke-and-intracerebral-haemorrhage/"),
    ("[15] Neurocritical Care Society / SCCM, Reversal of Antithrombotics in Intracranial Hemorrhage",
     "https://guidelinecentral.com/guideline/41531"),
    ("[16] STREAM-2: 고령 STEMI의 절반 용량 테넥테플라제 (Circulation 2023 요약)",
     "https://solaci.org/?p=85075"),
]
ref_xml = "".join(P("%s\n%s" % (t, u)) for t, u in refs)
sub1("<w:p><w:r><w:t>주의: 표의 용량은", ref_xml + "<w:p><w:r><w:t>주의: 표의 용량은")

print("document.xml %d -> %d" % (orig_len, len(doc)))

rels = z.read("word/_rels/document.xml.rels").decode("utf8")
add = ('<Relationship Id="rId20" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image10.png"/>'
       '<Relationship Id="rId21" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image11.png"/>')
rels = rels.replace("</Relationships>", add + "</Relationships>")

repl = {
    "word/document.xml": doc.encode("utf8"),
    "word/_rels/document.xml.rels": rels.encode("utf8"),
    "word/media/image8.png": open(os.path.join(HERE, "image8_renum.png"), "rb").read(),
    "word/media/image9.png": open(os.path.join(HERE, "image9_renum.png"), "rb").read(),
}
extra = {
    "word/media/image10.png": open(os.path.join(HERE, "f8_fibrinolysis.png"), "rb").read(),
    "word/media/image11.png": open(os.path.join(HERE, "f9_stroke_window.png"), "rb").read(),
}
zo = zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED)
for it in z.infolist():
    data = repl.get(it.filename, None)
    zo.writestr(it, z.read(it.filename) if data is None else data)
for name, data in extra.items():
    zo.writestr(name, data)
zo.close()
z.close()
print("wrote", OUT, os.path.getsize(OUT))
