# -*- coding: utf-8 -*-
"""각 약물 단락에 '대표 제품(국내)' 줄을 추가한다."""
import zipfile, os, sys

SRC = r"G:\내 드라이브\약학\혈액응고_항혈소판제_항응고제_약리학_통합가이드_2026-11-14.docx"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out2.docx")

def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def brandline(text, note=None):
    x = ('<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>'
         '<w:r><w:rPr><w:b/><w:color w:val="1F6FB2"/><w:sz w:val="19"/></w:rPr>'
         '<w:t xml:space="preserve">대표 제품(국내): </w:t></w:r>'
         '<w:r><w:rPr><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r>') % esc(text)
    if note:
        x += ('<w:r><w:rPr><w:color w:val="667487"/><w:sz w:val="17"/></w:rPr>'
              '<w:t xml:space="preserve">  %s</w:t></w:r>') % esc(note)
    return x + "</w:p>"

def H2(t):
    return '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>%s</w:t></w:r></w:p>' % esc(t)

def H2p(t):  # 이번 작업에서 추가한 단원의 제목(xml:space 속성 포함)
    return ('<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r>'
            '<w:t xml:space="preserve">%s</w:t></w:r></w:p>') % esc(t)

# (앵커 XML, 뒤에 넣을 제품명 줄)
ITEMS = [
    (H2("3-1. 아스피린(Aspirin)"),
     brandline("아스피린프로텍트정 100 mg · 아스트릭스캡슐 100 mg")),
    (H2("3-2. 클로피도그렐(Clopidogrel)"),
     brandline("플라빅스정 · 플래리스정")),
    (H2("3-3. 프라수그렐(Prasugrel)"),
     brandline("에피언트정")),
    (H2("3-4. 티카그렐러(Ticagrelor)"),
     brandline("브릴린타정")),
    (H2("3-5. 실로스타졸(Cilostazol)"),
     brandline("프레탈정 · 프레탈서방캡슐 · 실로스탄씨알정")),
    (H2("3-6. 사르포그렐레이트(Sarpogrelate)"),
     brandline("안플라그정 · 안플원서방정")),
    (H2("3-7. 트리플루살·디피리다몰·GPIIb/IIIa 억제제·캉그렐러"),
     brandline("디스그렌캡슐(트리플루살) · 아그레녹스캡슐(아스피린+서방 디피리다몰)",
               "티로피반(아그라스타트), 엡티피바타이드(인테그릴린), 캉그렐러(켄그렉살)는 해외 상품명이며 국내 허가·공급은 확인이 필요하다.")),
    (H2("4-1. 와파린(Warfarin)"),
     brandline("쿠마딘정 · 와파린나트륨정")),
    (H2("4-2. 비분획 헤파린(UFH)"),
     brandline("헤파린나트륨주")),
    (H2("4-4. 저분자량 헤파린(LMWH)"),
     brandline("크렉산주(에녹사파린) · 프라그민주(달테파린)")),
    (H2("4-5. 폰다파리눅스(Fondaparinux)"),
     brandline("아릭스트라주")),
    (H2("4-6. DOAC: 직접 Xa 억제제와 IIa 억제제"),
     brandline("엘리퀴스정(아픽사반) · 자렐토정(리바록사반) · 릭시아나정(에독사반) · 프라닥사캡슐(다비가트란)")),
    (H2("4-7. 아르가트로반·비발리루딘"),
     brandline("아가론주(아르가트로반)",
               "비발리루딘(안지오맥스)은 해외 상품명이며 국내 공급은 확인이 필요하다.")),
    (H2p("5-1. 작용 기전과 제제별 차이"),
     brandline("액티라제주(알테플라제) · 메탈라제주 25 mg(테넥테플라제)",
               "유로키나제는 유키나제주 등이 있으나 국내 허가 현황을 확인한다. 레테플라제·스트렙토키나제는 국내 유통을 확인한다.")),
]

z = zipfile.ZipFile(SRC)
doc = z.read("word/document.xml").decode("utf8")
n0 = len(doc)
for anchor, line in ITEMS:
    c = doc.count(anchor)
    if c != 1:
        print("!! %d hits: %s" % (c, anchor[:90])); sys.exit(1)
    doc = doc.replace(anchor, anchor + line)

# 역전제: 그림 11 캡션 뒤에 제품명 줄
cap = "그림 11. 항응고제별 주요 역전·지혈 전략</w:t></w:r></w:p>"
if doc.count(cap) != 1:
    print("!! caption anchor"); sys.exit(1)
doc = doc.replace(cap, cap + brandline(
    "비타민케이원주 등(비타민 K₁) · 프로타민황산염주 · 프락스바인드주(이다루시주맙) · 트란사민정·주(트라넥삼산)",
    "4인자 PCC는 베리플렉스·옥타플렉스 계열이며 국내 허가 제품을 확인한다. 안덱사네트 알파는 미국 판매가 종료되었다."))

print("document.xml %d -> %d" % (n0, len(doc)))
zo = zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED)
for it in z.infolist():
    zo.writestr(it, doc.encode("utf8") if it.filename == "word/document.xml" else z.read(it.filename))
zo.close(); z.close()
print("wrote", OUT, os.path.getsize(OUT))
