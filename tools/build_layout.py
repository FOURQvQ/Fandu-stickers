import json
# x: 0(left)→16.5(right); z: 0(back wall)→6(front wall); outside strip z 6.3–7.6. 1 grid = 1.5 m (5 ft)
ROOMS=[{"id":"S","name":"仓储间","x0":0,"x1":4.5,"story":"补给堆满了，门口还丢着一桶水"},
       {"id":"H","name":"大厅","x0":4.5,"x1":12,"story":"灶台、长桌和篝火，冒险者在这里歇脚"},
       {"id":"B","name":"卧室","x0":12,"x1":16.5,"story":"屋主打理得最用心的一间"}]
# tier: big / mid / small ; L×W×H in m (L = long side). rot 90 = long side runs front-back
F=[]  # floor: (asset,name,tier,L,W,H,x,z,rot,room)
W=[]  # wall: (asset,name,tier,L,W,H,wall,along,y,room)
K=[]  # stack: (asset,name,tier,L,W,H,on_asset,note)
O=[]  # outside floor
def f(*a): F.append(a)
def w(*a): W.append(a)
def k(*a): K.append(a)
# ---------- 仓储间 ----------
f("b2-F04","木架","big",1.4,0.5,1.8,1.2,0.3,0,"S")
f("b2-S01","木箱","mid",0.7,0.7,0.7,2.75,0.45,0,"S")
f("b2-S04","木桶","mid",0.6,0.6,0.9,3.85,0.4,0,"S")
f("b1-P01","木桶·铁箍","mid",0.55,0.55,0.85,3.9,1.15,0,"S")
f("b2-D02","碎木板","mid",1.0,0.5,0.25,0.5,1.25,90,"S")
f("b2-F05","工作台","big",1.6,0.75,0.85,0.42,2.65,90,"S")
f("b2-S08","蔬菜筐","mid",0.5,0.5,0.45,1.95,1.2,0,"S")
f("b1-P14","菜篮","mid",0.45,0.45,0.45,2.45,1.35,0,"S")
f("b1-P04","敞口木箱","mid",0.6,0.45,0.35,3.0,1.5,0,"S")
f("b2-S02","敞口板条箱","mid",0.7,0.5,0.4,1.65,2.15,0,"S")
f("b2-S06","扎口麻袋","mid",0.5,0.45,0.6,3.95,1.95,0,"S")
f("b1-P06","麻袋","mid",0.5,0.45,0.6,3.95,2.6,0,"S")
f("b2-S07","敞口粮袋","mid",0.55,0.5,0.55,3.35,2.35,0,"S")
f("b2-S05","柳条筐","mid",0.5,0.5,0.4,3.3,3.15,0,"S")
f("b2-D04","干草堆","mid",1.2,1.0,0.3,2.0,3.4,0,"S")
f("b1-P20","柴捆","mid",0.8,0.4,0.35,0.35,4.55,90,"S")
f("b2-T11","木水桶","mid",0.35,0.35,0.4,2.0,5.6,0,"S")
f("b2-S03","铁箍宝箱","mid",0.9,0.55,0.55,2.85,5.55,0,"S")
f("b1-P02","小铁箍箱","mid",0.6,0.4,0.4,3.85,5.6,0,"S")
k("b2-P05","陶罐","small",0.3,0.3,0.35,"b2-F04","架子中层")
k("b1-P05","小柳条篮","small",0.4,0.4,0.25,"b2-F04","架子底层")
k("b1-P03","木箱（叠放）","mid",0.6,0.6,0.6,"b2-S01","摞在木箱上")
k("b2-T06","斧头","small",0.7,0.2,0.05,"b2-F05","台面")
k("b2-T07","铁锤","small",0.5,0.2,0.1,"b2-F05","台面")
k("b2-T09","兽皮卷","small",0.6,0.4,0.15,"b2-S03","箱盖上")
w("b2-F10","挂钩板","mid",1.0,0.15,0.2,"back",3.3,1.7,"S")
k("b2-T08","麻绳卷","small",0.45,0.45,0.15,"b2-F10","挂在挂钩上")
# ---------- 大厅 ----------
f("b1-F05","石砌灶台","big",1.2,0.9,1.6,5.15,0.5,0,"H")
f("b1-F04","L形橱柜","big",1.8,1.0,0.85,6.75,0.52,0,"H")
f("b1-F06","矮柜","big",1.4,0.5,0.8,8.6,0.3,0,"H")
f("b2-F09","方木小桌","mid",0.7,0.7,0.7,11.45,0.45,0,"H")
f("b1-F03","靠背长凳","mid",1.5,0.5,0.9,6.6,1.48,0,"H")
f("b2-F01","长桌","big",1.8,0.75,0.75,6.6,2.3,0,"H")
f("b2-F02","长凳","mid",1.6,0.4,0.45,6.6,3.05,0,"H")
f("b2-F03","三脚凳","mid",0.45,0.45,0.5,5.3,2.3,0,"H")
f("b2-D01","柴堆","mid",1.0,0.6,0.6,7.2,3.95,0,"H")
f("b2-P01","篝火","mid",1.3,1.3,0.4,8.6,3.6,0,"H")
f("b1-F07","绿垫扶手椅","big",0.8,0.8,1.0,10.2,2.6,270,"H")
f("b1-F08","圆木小桌","mid",0.7,0.7,0.7,10.5,1.55,0,"H")
f("b2-T02","捆好的铺盖卷","mid",0.9,0.35,0.35,7.5,4.95,0,"H")
f("b2-T01","皮背包","mid",0.45,0.35,0.55,8.6,4.95,0,"H")
f("b1-F14","椭圆矮桌","big",1.4,0.8,0.6,10.6,4.6,0,"H")
k("b2-P02","吊锅架","mid",1.4,0.6,1.3,"b2-P01","跨在篝火上")
k("b2-P03","铁锅","mid",0.5,0.5,0.4,"b2-P02","挂在吊锅架钩子上")
k("b1-P11","铁水壶","small",0.4,0.3,0.35,"b1-F05","灶台上")
k("b1-P12","砧板","small",0.5,0.25,0.04,"b1-F04","台面")
k("b1-P13","厨刀","small",0.35,0.06,0.03,"b1-P12","放在砧板上")
k("b1-P10","陶水罐","small",0.3,0.25,0.35,"b1-F04","台面")
k("b1-P08","绿釉碗","small",0.3,0.3,0.12,"b1-F04","台面")
k("b1-P09","陶盘","small",0.3,0.3,0.04,"b1-F06","柜面")
k("b1-P07","带盖陶罐","small",0.35,0.35,0.4,"b2-F09","桌面")
k("b2-P06","木碗","small",0.2,0.2,0.08,"b2-F01","桌面")
k("b2-P07","木盘","small",0.28,0.28,0.04,"b2-F01","桌面")
k("b2-P08","木酒杯","small",0.15,0.12,0.15,"b2-F01","桌面")
k("b2-P04","陶壶","small",0.25,0.2,0.35,"b2-F01","桌面")
k("b2-P11","面包","small",0.3,0.15,0.12,"b2-F01","桌面")
k("b2-P12","烛台蜡烛","small",0.15,0.15,0.3,"b2-F01","桌面")
k("b1-S05","锡酒杯","small",0.15,0.12,0.15,"b1-F08","桌面")
w("b1-D04","倒挂草药束","small",0.3,0.15,0.6,"back",6.1,1.9,"H")
w("b2-T10","干草药捆","small",0.5,0.15,0.2,"back",6.6,1.95,"H")
w("b2-P09","平底锅","small",0.55,0.3,0.05,"back",7.3,1.6,"H")
w("b2-P10","汤勺","small",0.4,0.1,0.05,"back",7.8,1.6,"H")
w("b1-S04","鹿角挂饰","small",0.7,0.3,0.5,"back",9.3,2.0,"H")
w("b2-T03","长剑","small",1.0,0.2,0.05,"p2",1.2,1.5,"H")
w("b2-T04","长弓","small",1.4,0.3,0.05,"p2",2.1,1.6,"H")
w("b2-T05","箭袋","small",0.25,0.2,0.8,"p2",2.9,1.3,"H")
# ---------- 卧室 ----------
f("b2-F06","木床架","big",2.1,1.2,0.5,12.9,1.1,90,"B")
f("b1-F09","木床架·精细","big",2.0,1.1,0.55,15.85,1.05,90,"B")
f("b1-F01","床边矮桌","mid",1.2,0.5,0.45,14.4,0.35,0,"B")
f("b1-D01","花纹地毯","mid",2.0,1.3,0.02,14.4,1.75,0,"B")
f("b1-P19","小铁炉","mid",0.6,0.5,0.8,12.45,3.0,0,"B")
f("b1-S01","双门衣柜","big",1.0,0.55,1.9,16.2,3.0,90,"B")
f("b1-S02","书柜","big",0.9,0.4,1.7,16.25,4.2,90,"B")
f("b1-F13","抽屉书桌","big",1.2,0.6,0.78,14.0,5.5,0,"B")
f("b1-F02","靠背木椅","mid",0.5,0.5,1.0,14.0,4.75,180,"B")
k("b2-F07","铺盖褥子","mid",1.9,0.95,0.3,"b2-F06","铺在床架上")
k("b2-F08","粗毛毯","mid",0.9,0.6,0.15,"b2-F07","叠在褥子上")
k("b1-F10","床垫","mid",1.9,0.9,0.2,"b1-F09","铺在床架上")
k("b1-F11","绿毛毯","mid",0.8,0.6,0.15,"b1-F10","叠在床垫上")
k("b1-F12","枕头","small",0.6,0.4,0.15,"b1-F10","床头")
k("b1-P16","皮面书","small",0.25,0.18,0.06,"b1-F01","桌面")
k("b1-P17","卷轴","small",0.4,0.1,0.1,"b1-S02","书柜上层")
k("b1-D03","迷迭香盆栽","small",0.3,0.3,0.45,"b1-S02","书柜顶")
k("b1-P15","摊开的书","small",0.35,0.25,0.05,"b1-F13","桌面")
k("b1-P18","黄铜烛台","small",0.15,0.15,0.2,"b1-F13","桌面")
w("b1-S03","壁挂提灯","small",0.3,0.35,0.6,"back",12.9,1.9,"B")
# ---------- 屋外 ----------
f("b1-D02","木箱盆栽","mid",0.5,0.5,0.7,15.9,5.6,0,"B")
f("b2-D05","落叶堆","mid",1.0,0.8,0.08,1.15,5.35,0,"S")
f("b2-D03","矿石堆","mid",1.0,0.8,0.5,3.2,4.4,0,"S")

SHELL=[ # fixed house kit (not stickers); module = 1.5 m
("b2-A01","墙段·标准","1.5×0.25×2.6","后墙主体，约 7 段"),("b2-A02","墙段·窄","0.75×0.25×2.6","补齐边角"),
("b2-A03","墙段·带窗","1.5×0.25×2.6","大厅后墙右端"),("b2-A04","墙段·带门洞","1.5×0.25×2.6","仓储间↔大厅隔墙"),
("b2-A05","转角墙","1.5×1.5×2.6","左后角"),("b2-A06","矮墙·破损","1.5×0.25×0.9","前墙（剖切视角的矮墙）"),
("b2-A07","断墙","1.5×0.25×1.8","仓储间前角，做破败感"),("b2-A08","木门","1.0×0.1×2.1","前门，仓储间"),
("b2-A09","窗板","0.8×0.08×0.8","大厅窗户"),("b2-A10","立柱","0.25×0.25×2.8","每个墙段接缝处，遮住拼缝"),
("b2-A11","横梁·细","6.3×0.2×0.2","房间前后方向的拉梁"),("b2-A12","横梁·粗","16.5×0.3×0.3","后墙顶梁（可分段）"),
("b2-A13","屋架","6.3×0.25×2.0","每道隔墙上方一榀"),("b2-A14","屋顶瓦片","1.5×1.5×0.15","只铺后坡一部分，保持剖切"),
("b2-A15","山墙","6.3×0.25×2.0","左右两端"),("b2-A16","地砖·土石","1.5×1.5×0.1","仓储间、大厅地面"),
("b1-A01","石墙段","1.5×0.25×2.6","卧室右墙"),("b1-A02","墙段·带窗","1.5×0.25×2.6","卧室后墙，两床之间"),
("b1-A03","门框","1.2×0.25×2.3","大厅↔卧室隔墙门洞"),("b1-A04","木门·精细","1.0×0.1×2.1","装在卧室门框里"),
("b1-A05","地砖·石板","1.5×1.5×0.1","卧室地面"),
]
FACES={"big":"1.5–2万","mid":"5千–8千","small":"1.5千–3千","shell":"5千–1万"}
items=[];n=0;byid={}
def fp(L,Wd,rot): return (Wd,L) if rot in (90,270) else (L,Wd)
for room in ["S","H","B"]:
    for a in F:
        if a[9]!=room: continue
        n+=1; fw,fd=fp(a[3],a[4],a[8])
        it=dict(n=n,asset=a[0],name=a[1],tier=a[2],L=a[3],W=a[4],H=a[5],layer="floor",room=room,x=a[6],z=a[7],rot=a[8],fw=fw,fd=fd)
        items.append(it); byid[a[0]]=it
    for a in W:
        if a[9]!=room: continue
        n+=1; it=dict(n=n,asset=a[0],name=a[1],tier=a[2],L=a[3],W=a[4],H=a[5],layer="wall",room=room,wall=a[6],along=a[7],y=a[8])
        items.append(it); byid[a[0]]=it
# stacks: assign after parents, inherit room
pending=list(K)
while pending:
    rest=[]
    for a in pending:
        p=byid.get(a[6])
        if not p: rest.append(a); continue
        n+=1; it=dict(n=n,asset=a[0],name=a[1],tier=a[2],L=a[3],W=a[4],H=a[5],layer="stack",room=p["room"],on=a[6],onN=p["n"],note=a[7])
        items.append(it); byid[a[0]]=it
    assert len(rest)<len(pending), rest; pending=rest
# renumber stickers by room then layer order for a readable list
order={"S":0,"H":1,"B":2}; lay={"floor":0,"wall":1,"stack":2}
items.sort(key=lambda i:(order[i["room"]],lay[i["layer"]],i["n"]))
for i,it in enumerate(items,1): it["n"]=i
for it in items:
    if it["layer"]=="stack": it["onN"]=byid[it["on"]]["n"]
# overlap check (floor, ignoring flat rug/hay)
fl=[i for i in items if i["layer"]=="floor" and i["H"]>0.05]
bad=[]
for i in range(len(fl)):
    for j in range(i+1,len(fl)):
        a,b=fl[i],fl[j]
        if abs(a["x"]-b["x"])<(a["fw"]+b["fw"])/2-0.01 and abs(a["z"]-b["z"])<(a["fd"]+b["fd"])/2-0.01:
            if not ({a["asset"],b["asset"]} & {"b2-D04","b2-D05","b1-D01"}): bad.append((a["n"],a["name"],b["n"],b["name"]))
# bounds check
for a in fl:
    if a["room"]=="OUT": continue
    r=[R for R in ROOMS if R["id"]==a["room"]][0]
    if a["x"]-a["fw"]/2<r["x0"]-0.01 or a["x"]+a["fw"]/2>r["x1"]+0.01 or a["z"]-a["fd"]/2<-0.01 or a["z"]+a["fd"]/2>6.01: bad.append(("OOB",a["n"],a["name"]))
assets=set(i["asset"] for i in items)|set(s[0] for s in SHELL)
print("stickers",len(items),"shell",len(SHELL),"unique assets",len(assets))
print("by layer",{l:sum(1 for i in items if i["layer"]==l) for l in lay}, "by tier",{t:sum(1 for i in items if i["tier"]==t) for t in FACES})
print("by room",{r:sum(1 for i in items if i["room"]==r) for r in order})
print("problems",bad)
HINT={
 "b2-P05":(-0.2,0,"level:0.5"),"b1-P05":(0.25,0,"level:0.08"),"b1-P03":(0,0,"top"),
 "b2-T06":(-0.2,0,"top"),"b2-T07":(0.25,0,"top"),"b2-T09":(0,0,"top"),"b2-T08":(0,0,"hang:0.35"),
 "b2-P02":(0,0,"floor"),"b2-P03":(0,0,"hang:0.3"),"b1-P11":(-0.15,0.1,"top"),
 "b1-P12":(-0.2,0.1,"top"),"b1-P13":(0,0,"top"),"b1-P10":(0.15,0.1,"top"),"b1-P08":(0.35,0.1,"top"),
 "b1-P09":(-0.15,0,"top"),"b1-P07":(0,0,"top"),
 "b2-P06":(-0.38,0.05,"top"),"b2-P07":(-0.2,-0.1,"top"),"b2-P08":(-0.05,0.15,"top"),"b2-P04":(0.1,-0.12,"top"),"b2-P11":(0.26,0.08,"top"),"b2-P12":(0.4,-0.1,"top"),
 "b1-S05":(0,0,"top"),"b2-F07":(0,0,"top"),"b2-F08":(0.25,0,"top"),"b1-F10":(0,0,"top"),"b1-F11":(0.25,0,"top"),"b1-F12":(-0.38,0,"top"),
 "b1-P16":(0.2,0,"top"),"b1-P17":(0,0,"level:0.55"),"b1-D03":(0,0,"top"),"b1-P15":(-0.15,0,"top"),"b1-P18":(0.3,-0.1,"top"),
}
for it in items:
    if it["layer"]=="stack": it["u"],it["v"],it["ymode"]=HINT[it["asset"]]
# ---------- house kit placements (fixed). x,z = centre on the floor plan, ry = rotation, dims = L×H×W the model is fitted to ----------
P=[];M=1.5
def put(a,x,z,ry,L,H,Wd,y=0,part="wall",tilt=0): P.append(dict(asset=a,x=x,z=z,ry=ry,y=y,L=L,H=H,W=Wd,part=part,tilt=tilt))
for i in range(11):
    for j in range(4):
        put("b1-A05" if i>=8 else "b2-A16", M*i+.75, M*j+.75, 0, 1.5,0.1,1.5, y=-0.1, part="floor")
back=["b2-A05","b2-A01","b2-A01","b2-A01","b2-A01","b2-A01","b2-A01","b2-A03","b1-A01","b1-A02","b1-A01"]
for i,a in enumerate(back):
    if a=="b2-A05": put(a,.75,.75,0,1.5,2.6,1.5,part="corner")
    else: put(a,M*i+.75,-.125,0,1.5,2.6,0.25)
for j in range(1,4): put("b2-A01",-.125,M*j+.75,90,1.5,2.6,0.25)
for j in range(4): put("b1-A01",16.625,M*j+.75,90,1.5,2.6,0.25)
for j in range(3): put("b2-A01",4.5,M*j+.75,90,1.5,2.6,0.25); put("b2-A01",12,M*j+.75,90,1.5,2.6,0.25)
put("b2-A04",4.5,M*3+.75,90,1.5,2.6,0.25)
put("b1-A03",12,M*3+.75,90,1.5,2.4,0.25); put("b1-A04",12.35,4.25,20,1.0,2.1,0.08,part="door")
put("b2-A02",.375,6.125,0,0.75,2.6,0.25); put("b2-A08",.85,5.55,-70,0.8,2.1,0.08,part="door")
put("b2-A06",2.25,6.125,0,1.5,0.9,0.25,part="low"); put("b2-A07",3.75,6.125,0,1.5,1.8,0.25,part="low")
for i in range(3,11): put("b2-A06",M*i+.75,6.125,0,1.5,0.9,0.25,part="low")
put("b2-A09",11.25,-.36,0,0.8,0.8,0.08,y=1.2,part="upper")
for x in [0,4.5,12,16.5]:
    for z in [0,6]: put("b2-A10",x,z,0,0.25,2.9,0.25,part="post")
for i in range(1,11):
    if M*i not in (4.5,12): put("b2-A10",M*i,0,0,0.25,2.9,0.25,part="post")
put("b2-A12",8.25,0,0,16.8,0.3,0.3,y=2.75,part="upper")
for x in [0,16.5]: put("b2-A11",x,3,90,6.3,0.2,0.2,y=2.8,part="upper")
for x in [4.5,12]: put("b2-A13",x,3,90,6.3,2.0,0.25,y=2.9,part="upper")
for x in [-0.05,16.55]: put("b2-A15",x,3,90,6.3,2.0,0.25,y=2.9,part="upper")
for x in [0.75,2.25,3.75,8.25,9.75,14.25]: put("b2-A14",x,0.55,0,1.5,0.15,1.5,y=3.25,part="upper",tilt=33.7)
json.dump(dict(unit="m",grid=1.5,house=dict(w=16.5,d=6,backH=2.6,frontH=0.9),rooms=ROOMS,
  doors=[dict(wall="front",a=0.6,b=1.6,label="前门"),dict(wall="p1",a=4.2,b=5.4,label="门洞"),dict(wall="p2",a=4.2,b=5.4,label="卧室门")],
  windows=[dict(wall="back",a=10.5,b=12,label="窗"),dict(wall="back",a=13.5,b=15,label="窗")],
  partitions=[4.5,12],items=items,kit=P,shell=[dict(asset=s[0],name=s[1],size=s[2],use=s[3]) for s in SHELL],faces=FACES),
  open("layout.json","w"),ensure_ascii=False,indent=1)
