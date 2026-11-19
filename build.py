# -*- coding: utf-8 -*-
"""src/ 의 조각을 모아 index.html 을 만든다.  사용법: python build.py"""
import io, os

R = os.path.dirname(os.path.abspath(__file__))
def rd(*p):
    return io.open(os.path.join(R, *p), encoding="utf8").read()

out = (rd("src", "head.html") + rd("src", "tail.html") + "<script>\n" +
       rd("src", "data.js") + rd("src", "sim.js") + rd("src", "ui.js") + "</script>\n")
io.open(os.path.join(R, "index.html"), "w", encoding="utf8", newline="").write(out)
print("index.html %d bytes" % len(out))
