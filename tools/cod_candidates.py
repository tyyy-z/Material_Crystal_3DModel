import json, urllib.request, urllib.parse
T = {
 "Si":("Si","F d -3 m"),"NaCl":("Cl Na","F m -3 m"),"CsCl":("Cl Cs","P m -3 m"),"CaF2":("Ca F2","F m -3 m"),
 "ZnS-zb":("S Zn","F -4 3 m"),"ZnS-wz":("S Zn","P 63 m c"),"GaN":("Ga N","P 63 m c"),"SrTiO3":("O3 Sr Ti","P m -3 m"),
 "TiO2-rutile":("O2 Ti","P 42/m n m"),"LiFePO4":("Fe Li O4 P","P n m a"),"LiCoO2":("Co Li O2","R -3 m"),
 "graphite":("C","P 63/m m c"),"quartz":("O2 Si","P 32 2 1"),"quartz2":("O2 Si","P 31 2 1")}
out={}
for k,(f,sg) in T.items():
    u="https://www.crystallography.net/cod/result?"+urllib.parse.urlencode({"formula":f,"format":"json"})
    d=json.load(urllib.request.urlopen(u,timeout=60))
    c=[x for x in d if (x.get('sg') or '').split(':')[0].strip().replace(' ','')==sg.replace(' ','')]
    out[k]=c
    print(f"== {k} {len(d)} total, {len(c)} in {sg}")
    for x in c[:14]:
        print("  ",x['file'],x.get('sg'),x.get('a'),x.get('b'),x.get('c'),x.get('mineral'),x.get('year'),'T=',x.get('celltemp'),'P=',x.get('cellpressure'),(x.get('title') or '')[:70])
json.dump(out,open('cod_candidates.json','w'))
