import math,sys
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
# Adds the launcher logo (src/assets/logo.svg: two triangles stroked 8 wide, round joins) as U+E900.
path=sys.argv[1]
tris=[[(20,16),(46,38),(20,84)],[(80,84),(54,62),(80,16)]]
R=4; s=1000/84
def outline(t):
    cx=sum(p[0] for p in t)/3; cy=sum(p[1] for p in t)/3
    def nrm(p,q):
        dx,dy=q[0]-p[0],q[1]-p[1]; l=math.hypot(dx,dy); n=(dy/l,-dx/l)
        mx,my=(p[0]+q[0])/2-cx,(p[1]+q[1])/2-cy
        return n if n[0]*mx+n[1]*my>0 else (-n[0],-n[1])
    pts=[]
    for i in range(3):
        a,b,c=t[i-1],t[i],t[(i+1)%3]
        n1=nrm(a,b); n2=nrm(b,c)
        a1=math.atan2(n1[1],n1[0]); a2=math.atan2(n2[1],n2[0])
        d=(a2-a1+math.pi)%(2*math.pi)-math.pi
        for k in range(13):
            ang=a1+d*k/12; pts.append((b[0]+R*math.cos(ang), b[1]+R*math.sin(ang)))
    return pts
raw=[[((x-12)*s,(92-y)*s) for x,y in outline(t)] for t in tris]
xs=[p[0] for c in raw for p in c]; ys=[p[1] for c in raw for p in c]
dx=(1000-(max(xs)-min(xs)))/2-min(xs); dy=-min(ys)
f=TTFont(path); f.ensureDecompiled()
pen=TTGlyphPen(None)
for c in raw:
    pts=[(round(x+dx),round(y+dy)) for x,y in c]
    a=sum(pts[i][0]*pts[(i+1)%len(pts)][1]-pts[(i+1)%len(pts)][0]*pts[i][1] for i in range(len(pts)))
    if a>0: pts=pts[::-1]
    pen.moveTo(pts[0])
    for p in pts[1:]: pen.lineTo(p)
    pen.closePath()
g=pen.glyph(); name='novexLogo'
order=f.getGlyphOrder()+[name]
glyf=f['glyf']; glyf.glyphs[name]=g; glyf.glyphOrder=order; f.setGlyphOrder(order)
f['hmtx'].metrics[name]=(1000,0)
for t in f['cmap'].tables:
    if t.isUnicode(): t.cmap[0xE900]=name
f.save(path)
f2=TTFont(path); f2.ensureDecompiled(); print('glyphs', len(f2.getGlyphOrder()))
