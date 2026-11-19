// ===== 시뮬레이션 모형 (교육용 정성 모형) =====
const LW=1000, LH=434, TOP=56, BOT=324, LUMEN0=BOT-TOP, COLW=5, NCOL=LW/COLW;
const PSZ=4.4, RSZ=6.2;
const VIR={stasis:true,endo:true,hyper:true};
const MOD={cyp:false,ome:false};
const SC={
  normal:{flow:1.0,shear:1.0,center:500,sigma:22,off:0,pltW:1.0,rbcTrap:0.32,tf:1.0,breach:{x0:478,x1:522,depth:44}},
  arterial:{flow:1.3,shear:1.9,center:516,sigma:28,off:6,pltW:1.7,rbcTrap:0.10,tf:1.15,plaque:{x0:350,x1:690,peak:82},rupture:{x0:498,x1:536}},
  venous:{flow:1.0,shear:0.4,center:505,sigma:20,tail:2.5,pltW:0.45,rbcTrap:1.0,tf:0,valve:{x:462,len:118}}
};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}

let S=null;
const active=new Set();

function baseAt(sc,x){
  if(sc.breach&&x>=sc.breach.x0&&x<=sc.breach.x1) return BOT+sc.breach.depth;
  if(sc.plaque){const p=sc.plaque;if(x>p.x0&&x<p.x1){const u=(x-p.x0)/(p.x1-p.x0);return BOT-p.peak*Math.pow(Math.sin(Math.PI*u),2);}}
  return BOT;
}
function newPart(k,x){
  const u=k==='p'?(Math.random()<0.5?0.03+Math.random()*0.15:0.82+Math.random()*0.15):0.06+Math.random()*0.88;
  return {k,x,u,rot:(Math.random()-0.5)*0.9,sp:0.85+Math.random()*0.3};
}
function initSim(key){
  const sc=SC[key];
  S={key,sc,t:0,adp:0,txa:0,sht:0,vc:0,xa:0,thr:0,thrEff:0,f13:0,fib:1,plasmin:0,plE:0,flowF:1,occl:0,
    items:[],strands:[],released:[],leaks:[],fading:[],cols:[],accP:0,accR:0,accS:0,accA:0,accL:0,
    bleed:0,leakRate:0,coverage:0,stability:0,firstSeal:null,sealedNow:false,rebleeds:0,stableTime:0,repair:0,
    dmg:0,emb:0,embCount:0,embFlash:0,lastEmb:-99,doses:[],lyticGiven:false,reached:new Set(),occlReached:false,
    drive:0,FD:0,cross:0,meanAct:0,nP:0,nR:0,dirty:false,lySum:0,lySpec:0,lyNon:0,exposed:[]};
  for(let i=0;i<NCOL;i++){const x=i*COLW+COLW/2;S.cols.push({i,x,base:baseAt(sc,x),items:[],h:0});}
  const ex=[];
  if(sc.breach){for(const c of S.cols){if(c.x>=sc.breach.x0-10&&c.x<=sc.breach.x1+10)ex.push(c.i);}}
  if(sc.rupture){for(const c of S.cols){if(c.x>=sc.rupture.x0&&c.x<=sc.rupture.x1)ex.push(c.i);}}
  S.exposed=ex;S.exSet=new Set(ex);
  S.parts=[];
  for(let i=0;i<120;i++)S.parts.push(newPart('r',Math.random()*LW));
  for(let i=0;i<46;i++)S.parts.push(newPart('p',Math.random()*LW));
  computeChannels();
}

function computeChannels(){
  const ch={cox:0,p2y12:0,ht2a:0,camp:0,gp:0,vitk:0,atXa:0,atIIa:0,dXa:0,dIIa:0,xia:0,antifib:0};
  const revs=[...active].filter(id=>DRUG[id]&&DRUG[id].rev);
  for(const id of active){
    const d=DRUG[id];if(!d||!d.sim)continue;
    let f=1;for(const r of revs){const m=DRUG[r].rev[id];if(m!==undefined&&!(r==='protamine'&&id==='enoxaparin'))f*=m;}
    for(const [k,v0] of Object.entries(d.sim)){
      let v=v0;
      if(id==='clopidogrel'){if(MOD.cyp)v*=0.5;if(MOD.ome)v*=0.75;}
      let ff=f;
      if(id==='enoxaparin'&&active.has('protamine'))ff*=(k==='atIIa'?0:0.45);
      v*=ff;ch[k]=1-(1-ch[k])*(1-v);
    }
  }
  if(S)S.ch=ch;
  return ch;
}

function floorAt(i){const col=S.cols[i];const lim=(S.sc.breach&&col.base>BOT)?BOT:col.base;return Math.min(lim,col.base-col.h);}
function topAt(x){return TOP+S.vc*10*Math.exp(-Math.pow((x-S.sc.center)/190,2));}
function colOf(x){return clamp(Math.floor(x/COLW),0,NCOL-1);}
function layoutCol(col){let acc=0;for(const it of col.items){const sz=it.t==='p'?PSZ:RSZ;it.ty=col.base-acc-sz/2+it.jy;acc+=sz*0.92;}col.h=acc;}
function ruptureCover(){const ex=S.exposed;if(!ex.length)return 0;let s=0;for(const i of ex)s+=Math.min(1,S.cols[i].h/18);return s/ex.length;}

function addItem(t,mode){
  const sc=S.sc;let c=-1;
  if(mode==='adh'){
    const cand=S.exposed.filter(i=>S.cols[i].h<PSZ*1.4);if(!cand.length)return;
    c=cand[(Math.random()*cand.length)|0];
  }else{
    for(let k=0;k<7;k++){
      const g=gauss();
      const x=sc.tail?sc.center+(Math.abs(g)*sc.tail-0.3)*sc.sigma:sc.center+sc.off+g*sc.sigma;
      const ci=colOf(x);const cs=S.cols;
      const ok=cs[ci].h>0||(ci>0&&cs[ci-1].h>0)||(ci<NCOL-1&&cs[ci+1].h>0)||S.exSet.has(ci)||(S.key==='venous'&&S.items.length<4);
      if(ok){c=ci;break;}
    }
    if(c<0){
      if(S.exposed.length)c=S.exposed[(Math.random()*S.exposed.length)|0];
      else if(S.items.length)c=S.items[(Math.random()*S.items.length)|0].c;
      else if(S.key==='venous')c=colOf(sc.center);
      else return;
    }
  }
  if(floorAt(c)-topAt(S.cols[c].x)<4){
    let best=-1;for(let d=1;d<=6&&best<0;d++){for(const s of [c+d,c-d]){if(s>=0&&s<NCOL&&floorAt(s)-topAt(S.cols[s].x)>=4&&(S.cols[s].h>0||S.exSet.has(s))){best=s;break;}}}
    if(best<0)return;c=best;
  }
  const col=S.cols[c];
  const it={t,c,x:col.x+(Math.random()-0.5)*COLW*1.5,jy:(Math.random()-0.5)*1.6,act:t==='p'?0.15:0,rot:Math.random()*Math.PI,ns:0,born:S.t,dead:false,y:0,ty:0};
  col.items.push(it);S.items.push(it);layoutCol(col);it.y=it.ty-12;
  return it;
}
function addStrand(){
  const n=S.items.length;
  if(n<3){if(S.key==='venous')addItem('r','agg');return;}
  let a=null;for(let k=0;k<6&&!a;k++){const c=S.items[(Math.random()*n)|0];if(!c.dead)a=c;}
  if(!a)return;
  const cand=[];
  for(let ci=Math.max(0,a.c-4);ci<=Math.min(NCOL-1,a.c+4)&&cand.length<14;ci++){
    for(const b of S.cols[ci].items){if(b!==a&&!b.dead){const dx=b.x-a.x,dy=b.ty-a.ty;if(dx*dx+dy*dy<26*26)cand.push(b);}}
  }
  if(!cand.length){if(S.key==='venous')addItem('r','agg');return;}
  const b=cand[(Math.random()*cand.length)|0];
  S.strands.push({a,b,x:0,dead:false});a.ns++;b.ns++;
  if(Math.random()<S.sc.rbcTrap*0.9*(S.trapF||0.5))addItem('r','agg'); // 새 피브린이 적혈구를 가둠
}
function releaseTop(col,vxBoost){
  const it=col.items.pop();if(!it)return;
  it.dead=true;S.dirty=true;layoutCol(col);
  S.released.push({t:it.t,x:it.x,y:it.y,vx:40+Math.random()*30+(vxBoost||0),vy:-(8+Math.random()*24),rot:it.rot,act:it.act,life:0});
}
function dislodge(){
  const b=S.sc.breach;
  for(const col of S.cols){if(col.x<b.x0-14||col.x>b.x1+14)continue;let k=Math.ceil(col.items.length*0.6);while(k-->0)releaseTop(col,30);}
}
function embolize(){
  let n=0;
  for(let i=NCOL-1;i>=0&&n<16;i--){const col=S.cols[i];while(col.items.length&&n<16&&col.x>S.sc.center+20){releaseTop(col,60);n++;if(Math.random()<0.4)break;}}
  if(n){S.embCount++;S.embFlash=3;S.lastEmb=S.t;}
}
function lyticLevel(d,tau){
  const L=DRUG[d.id].lytic;if(tau<0)return 0;
  if(L.mode==='inf'){if(tau<0.5)return tau/0.5;if(tau<16)return 1;return Math.exp(-(tau-16)*0.69/1.2);}
  if(L.mode==='bolus'){if(tau<0.3)return tau/0.3;return Math.exp(-(tau-0.3)*0.69/11);}
  const a=tau<0.3?tau/0.3:Math.exp(-(tau-0.3)*0.69/4);const t2=tau-7;
  const b=t2<0?0:(t2<0.3?t2/0.3:Math.exp(-(t2-0.3)*0.69/4));return Math.min(1.2,a+b);
}
function giveLytic(id){S.doses.push({id,t0:S.t,lv:0});S.lyticGiven=true;}
function giveCryo(){S.fib=Math.min(1,S.fib+0.5);}

function step(dt){
  const sc=S.sc,ch=S.ch,key=S.key;
  S.t+=dt;
  const inj=S.t>0.4?1:0;
  if(S.dirty){
    S.items=S.items.filter(i=>!i.dead);
    const keep=[];for(const s of S.strands){if(s.dead)continue;if(s.a.dead||s.b.dead){if(!s.a.dead)s.a.ns--;if(!s.b.dead)s.b.ns--;continue;}keep.push(s);}
    S.strands=keep;S.dirty=false;
  }
  let nP=0,nR=0,actSum=0;
  for(const it of S.items){if(it.t==='p'){nP++;actSum+=it.act;}else nR++;}
  const nI=nP+nR;S.nP=nP;S.nR=nR;S.meanAct=nP?actSum/nP:0;
  const actMass=Math.min(1.5,actSum/70),pltSurf=Math.min(1,actSum/55);
  let coverage=0;
  if(sc.breach){let s=0,n=0;for(const col of S.cols){if(col.base>BOT){s+=Math.min(1,col.h/(sc.breach.depth*0.95));n++;}}coverage=s/n;}
  S.coverage=coverage;
  const nS=S.strands.length;let xs=0;for(const s of S.strands)xs+=s.x;
  const cross=nS?xs/nS:0,FD=Math.min(1,nS/(nI*1.1+24));S.FD=FD;S.cross=cross;
  const rep=S.repair;
  let colEx=0,tfEx=0;
  if(key==='normal'){colEx=inj*(1-0.85*coverage)*(1-rep);tfEx=inj*sc.tf*(1-0.55*coverage)*(1-rep);}
  else if(key==='arterial'){const rc=ruptureCover();colEx=inj*(1-0.6*rc);tfEx=inj*sc.tf*(1-0.4*rc);}
  else{tfEx=inj*(VIR.endo?0.12:0.03);}
  const hyp=key==='venous'&&VIR.hyper?1.6:1,atEff=key==='venous'&&VIR.hyper?0.75:1;
  const flowEff=key==='venous'?(VIR.stasis?0.26:1.0):sc.flow;
  const wash=0.25+0.75*flowEff*S.flowF;
  // 매개물질
  S.adp+=(0.9*actMass-S.adp*(0.5+wash))*dt;
  S.txa+=(0.8*actMass*(1-ch.cox)-S.txa*(0.5+wash))*dt;
  S.sht+=(0.5*actMass-S.sht*(0.5+wash))*dt;
  const vcT=inj?clamp(0.45*Math.exp(-S.t/14)*(key==='normal'?1:0.4)+0.35*S.txa+0.25*S.sht*(1-ch.ht2a)-0.35*ch.camp,0,1):0;
  S.vc+=(vcT-S.vc)*1.2*dt;
  // 응고 연쇄
  const fa=1-0.55*ch.vitk;
  const surf=Math.max(pltSurf,key==='venous'?(VIR.endo?0.45:0.12):0.1);
  const fbk=S.thr/(1+S.thr); // 트롬빈 되먹임(V·VIII·XI 활성화), 포화형
  const xaGen=(0.6*tfEx+0.6*surf*fbk*(1-0.8*ch.xia))*fa*hyp;
  S.xa+=(1.2*xaGen-S.xa*(0.35*(1+4*ch.atXa)*atEff+0.9*wash+0.1))*dt;
  const xaEff=S.xa*(1-ch.dXa);
  const thrGen=1.6*xaEff*(0.4+0.6*surf)*fa*(1+0.5*fbk*(1-0.5*ch.xia));
  let thrClear=0.45*(1+4*ch.atIIa)*atEff+0.9*wash+0.1;
  if(key==='normal')thrClear+=1.6*coverage*coverage*(rep>0?2:1);
  S.thr=clamp(S.thr+(thrGen-S.thr*thrClear)*dt,0,2);
  const thrEff=S.thr*(1-ch.dIIa);S.thrEff=thrEff;
  const f13T=Math.min(1,thrEff*1.4);
  S.f13+=(f13T>S.f13?(f13T-S.f13)*0.5:-0.02*S.f13)*dt;
  // 피브린 (낮은 트롬빈은 천연 항응고계가 처리하므로 문턱 적용)
  const cap=nI*2.4+30;
  S.trapF=0.5+0.5*(1-Math.min(1,flowEff*S.flowF));
  S.accS+=Math.max(0,32*(thrEff-0.03)*S.fib*(1-nS/cap))*dt;
  while(S.accS>=1){S.accS-=1;addStrand();}
  for(const s of S.strands){if(s.x<1)s.x=Math.min(1,s.x+0.3*S.f13*dt);}
  // 혈소판 부착·응집
  // ADP(P2Y₁₂)·TXA₂는 동원을 키우는 증폭 고리
  const amp=clamp((S.adp*(1-ch.p2y12)+0.8*S.txa)/0.6,0,1);S.amp=amp;
  const baseDrive=0.35*colEx+0.45*Math.min(1,thrEff)+0.12*S.sht*(1-ch.ht2a)+0.1;
  const drive=baseDrive*(0.15+0.85*amp)*(1-0.6*ch.camp);
  S.drive=drive;
  const reg=key==='normal'?1-0.985*coverage*coverage:1;
  const fl=Math.min(1.3,flowEff*S.flowF);
  const flowSup=key==='normal'?0.55+0.45*fl:0.15+0.85*fl;
  const aggRate=44*sc.pltW*drive*(1-ch.gp)*Math.min(1,(nP+3)/10)*reg*flowSup*(0.4+0.6*S.fib);
  const adhRate=key==='venous'?0:16*colEx*Math.sqrt(sc.shear);
  S.accA+=adhRate*dt;while(S.accA>=1){S.accA-=1;addItem('p','adh');}
  S.accP+=aggRate*dt;while(S.accP>=1){S.accP-=1;addItem('p','agg');}
  const aT=clamp(0.15+0.95*drive/0.6,0.1,1);
  // 동맥 고전단: 덜 활성화되고 피브린으로 고정되지 않은 혈소판은 떨어져 나감
  if(key==='arterial'){
    const er=0.6*(1-amp)*sc.shear*(1-0.6*ch.camp*0);
    if(er>0.01)for(const col of S.cols){const n=col.items.length;if(!n)continue;const it=col.items[n-1];if(it.ns>0||it.t!=='p')continue;if(Math.random()<er*dt)releaseTop(col);}
  }
  for(const it of S.items){if(it.t==='p')it.act+=(aT-it.act)*1.2*dt;it.y+=(it.ty-it.y)*Math.min(1,10*dt);}
  // 섬유소 용해
  const pai=0.35*(nP/(nI+1));
  const tpaEndo=0.025*FD+(key==='normal'?(rep>=1?0.55:rep*0.12):0.02);
  let lySpec=0,lyNon=0,lySum=0;
  for(const d of S.doses){const L=DRUG[d.id].lytic;const lv=lyticLevel(d,S.t-d.t0)*L.pot*(1-pai*(1-L.pai1));d.lv=lv;lySum+=lv;lySpec+=lv*L.spec;lyNon+=lv*(1-L.spec);}
  S.lySum=lySum;S.lySpec=lySpec;S.lyNon=lyNon;
  const fibPres=Math.min(1,FD*1.6+0.15);
  const plT=(tpaEndo*(1-0.5*pai)+1.3*lySpec*fibPres+0.9*lyNon)*(1-ch.antifib);
  S.plasmin+=(plT-S.plasmin)*2*dt;
  const plE=Math.max(0,S.plasmin-0.02);S.plE=plE;
  S.fib=clamp(S.fib+(-0.16*lyNon*S.fib-0.025*lySpec*S.fib+0.006*(1-S.fib))*dt,0.12,1);
  if(plE>0){
    for(const s of S.strands){if(!s.dead&&Math.random()<1.5*plE*(1-0.6*s.x)*dt){s.dead=true;s.a.ns--;s.b.ns--;S.dirty=true;S.fading.push({ax:s.a.x,ay:s.a.y,bx:s.b.x,by:s.b.y,life:0});}}
    for(const col of S.cols){const n=col.items.length;if(!n)continue;const it=col.items[n-1];
      let r;if(it.t==='r'){if(it.ns>0)continue;r=3*plE;}else r=1.8*plE*(1-0.6*Math.min(1,it.ns/3));
      if(key==='normal'&&rep>=1)r*=3;
      else{const fr=(floorAt(col.i)-topAt(col.x))/LUMEN0;r*=1+3*Math.pow(clamp(1-fr,0,1),2);} // 흐름이 미는 좁은 곳부터 재개통
      if(Math.random()<r*dt){releaseTop(col);while(col.items.length&&Math.random()<0.6*Math.min(1,plE*2))releaseTop(col);}}
  }
  // 정상 지혈: 마개 안정성, 재출혈, 복구, 출혈량
  S.stability=clamp(0.25+0.75*cross*Math.min(1,FD*3),0,1);
  if(key==='normal'){
    if(coverage>=0.92){if(S.firstSeal===null)S.firstSeal=S.t;S.sealedNow=true;}
    if(S.firstSeal!==null&&S.sealedNow&&coverage<0.6&&rep<1){S.sealedNow=false;S.rebleeds++;}
    if(S.firstSeal!==null&&rep<1){
      // 피브린으로 고정되지 않은 마개는 압력에 밀려 통째로 떨어짐 (재출혈)
      const ramp=clamp((S.t-S.firstSeal-5)/5,0,1);
      const def=Math.max(0,0.62-S.stability)*ramp;
      S.strain=Math.max(0,(S.strain||0)+(def>0?def:-0.2)*dt);
      if(S.strain>1.2){dislodge();S.strain=0;}
    }
    if(coverage>=0.92&&S.stability>=0.62)S.stableTime+=dt;else S.stableTime=0;
    if(S.stableTime>6&&rep<1)S.repair=Math.min(1,rep+dt/22);
    if(rep<1&&inj){
      const leak=Math.pow(1-coverage,1.5)*(1-0.4*S.vc);S.leakRate=leak;S.bleed+=leak*dt;
      S.accL+=leak*45*dt;
      while(S.accL>=1){S.accL-=1;const x0=sc.breach.x0+4+Math.random()*(sc.breach.x1-sc.breach.x0-8);S.leaks.push({x:x0,y:BOT-4,vx:(Math.random()-0.5)*30,vy:40+Math.random()*40,rot:Math.random()*3,life:0});}
    }else S.leakRate=0;
  }
  // 폐색·혈류
  let minFree=LUMEN0;for(const col of S.cols){const f=floorAt(col.i)-topAt(col.x);if(f<minFree)minFree=f;}
  S.occl=clamp(1-minFree/LUMEN0,0,1);
  const fT=S.occl<0.6?1-0.25*S.occl:Math.max(0.03,0.85*(1-S.occl)/0.4);
  S.flowF+=(fT-S.flowF)*3*dt;
  if(key==='arterial'){if(S.occl>=0.85)S.occlReached=true;if(S.flowF<0.5)S.dmg=Math.min(1,S.dmg+(0.5-S.flowF)*0.06*dt);}
  if(key==='venous'){
    let tail=0;for(const col of S.cols)if(col.x>sc.center+50)tail+=col.items.length;
    S.emb=clamp(tail/160,0,1)*(1-0.4*cross);
    if(S.emb>0.4&&S.t-S.lastEmb>8&&Math.random()<0.15*S.emb*dt)embolize();
  }
  if(S.embFlash>0)S.embFlash-=dt;
  // 이동하는 입자들
  const base=140*flowEff*S.flowF;
  for(const p of S.parts){
    const ci=colOf(p.x),top=topAt(p.x),fl=floorAt(ci),free=Math.max(3,fl-top);
    const prof=0.12+0.88*(1-Math.pow(2*p.u-1,2));
    const jet=Math.min(3.2,LUMEN0/free);
    p.x+=base*prof*p.sp*jet*dt;
    if(p.x>LW){p.x-=LW;const np=newPart(p.k,p.x);p.u=np.u;}
  }
  for(const r of S.released){r.x+=(r.vx+base*0.8)*dt;r.y+=r.vy*dt;r.vy*=0.97;r.life+=dt;}
  S.released=S.released.filter(r=>r.life<3&&r.x<LW+20);
  for(const l of S.leaks){l.x+=l.vx*dt;l.y+=l.vy*dt;l.vx*=0.98;l.life+=dt;}
  S.leaks=S.leaks.filter(l=>l.life<1.6);
  for(const f of S.fading)f.life+=dt;
  S.fading=S.fading.filter(f=>f.life<0.5);
  detectPhase();
}

function detectPhase(){
  const R=S.reached,k=S.key;
  if(k==='normal'){
    if(S.t>0.4)R.add(0);if(S.vc>0.12)R.add(1);if(S.nP>=6)R.add(2);
    if(S.meanAct>0.45&&S.adp+S.txa>0.12)R.add(3);if(S.coverage>=0.6)R.add(4);
    if(S.thrEff>=0.18)R.add(5);if(S.cross>=0.5&&S.strands.length>=30)R.add(6);
    if(S.coverage>=0.92&&S.stability>=0.7)R.add(7);if(S.repair>0)R.add(8);
  }else if(k==='arterial'){
    if(S.t>0.4)R.add(0);if(S.nP>=6)R.add(1);if(S.meanAct>0.5&&S.nP>=40)R.add(2);
    if(S.strands.length>=25)R.add(3);if(S.occlReached)R.add(4);if(S.occlReached&&S.occl<0.6)R.add(5);
  }else{
    if(S.t>0.4&&VIR.stasis)R.add(0);if(S.xa>0.08)R.add(1);if(S.thrEff>0.2)R.add(2);
    if(S.nR>=25)R.add(3);
    let mx=0;for(const col of S.cols)if(col.items.length)mx=col.x;if(mx-S.sc.center>50)R.add(4);
    if(S.embCount>=1)R.add(5);
  }
}
function currentPhase(){let m=-1;for(const v of S.reached)if(v>m)m=v;return m;}

// 출혈 경향 지수 (약물 조합만 반영한 상대값)
function bleedIndex(ch){
  const PI=1-(1-0.5*ch.cox)*(1-0.7*ch.p2y12)*(1-0.95*ch.gp)*(1-0.3*ch.camp)*(1-0.12*ch.ht2a);
  const fa=1-0.55*ch.vitk;
  const xa0=0.72*fa/(0.35*(1+4*ch.atXa)+1.0);
  const thr0=1.6*xa0*(1-ch.dXa)*fa/(0.45*(1+4*ch.atIIa)+1.0)*(1-ch.dIIa);
  let CI=clamp(1-thr0/0.588,0,1);CI=1-(1-CI)*(1-0.15*ch.xia);
  const L=S?Math.min(1,S.lySum*(0.5+0.5*(S.lySum?S.lyNon/S.lySum:0))+(1-S.fib)*0.8):0;
  return 1-(1-0.55*PI)*(1-0.5*CI)*(1-0.85*L);
}

// ===== 그리기 =====
let cv,ctx,dpr=1,vw=LW,vx0=0,scale=1;const COL={};
function readColors(){const cs=getComputedStyle(document.documentElement);for(const k of ['bg','surface','ink','muted','line','blood','platelet','platelet-soft','fibrin','lysis','drug','tissue','wall','wall-2','lumen','endo','collagen','lipid','extra','crit'])COL[k]=cs.getPropertyValue('--'+k).trim()||'#888';}
function resizeCanvas(){
  const w=cv.parentElement.clientWidth||600;const narrow=w<640;
  vx0=narrow?235:0;vw=narrow?560:LW;scale=w/vw;
  const h=Math.round(LH*scale);dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.height=h+'px';
}
function ell(c,x,y,rx,ry,rot){c.beginPath();c.ellipse(x,y,rx,ry,rot,0,Math.PI*2);}
function drawRBC(c,x,y,rot,a){c.globalAlpha=a;c.fillStyle=COL.blood;ell(c,x,y,4.6,3.0,rot);c.fill();c.globalAlpha=a*0.35;c.fillStyle=COL.lumen;ell(c,x,y,1.9,1.1,rot);c.fill();c.globalAlpha=1;}
function drawPlt(c,x,y,act,rot,a){
  c.globalAlpha=a;
  if(act<0.35){c.fillStyle=COL['platelet-soft'];c.strokeStyle=COL.platelet;c.lineWidth=1;ell(c,x,y,2.6,1.7,rot);c.fill();c.stroke();}
  else{c.fillStyle=COL.platelet;c.beginPath();c.arc(x,y,2.3,0,Math.PI*2);c.fill();c.strokeStyle=COL.platelet;c.lineWidth=0.9;c.beginPath();const L=1.4+2.6*act;for(let k=0;k<5;k++){const an=rot+k*1.2566;c.moveTo(x+Math.cos(an)*2,y+Math.sin(an)*2);c.lineTo(x+Math.cos(an)*(2+L),y+Math.sin(an)*(2+L));}c.stroke();}
  c.globalAlpha=1;
}
function label(c,txt,x,y,align){
  const fs=12/scale;c.font=`500 ${fs}px "Noto Sans KR",system-ui,sans-serif`;c.textAlign=align||'center';c.textBaseline='middle';
  const w=c.measureText(txt).width,px=5/scale,ph=fs*0.8;
  const lx=align==='left'?x:align==='right'?x-w:x-w/2;
  c.globalAlpha=0.82;c.fillStyle=COL.surface;c.beginPath();c.roundRect?c.roundRect(lx-px,y-ph,w+px*2,ph*2,4/scale):c.rect(lx-px,y-ph,w+px*2,ph*2);c.fill();c.globalAlpha=1;
  c.fillStyle=COL.ink;c.fillText(txt,x,y);
}
function drawScene(){
  const c=ctx,sc=S.sc;
  c.setTransform(dpr*scale,0,0,dpr*scale,-vx0*dpr*scale,0);
  c.fillStyle=COL.tissue;c.fillRect(vx0-2,0,vw+4,LH);
  // 위쪽 벽
  c.fillStyle=COL.wall;c.beginPath();c.moveTo(vx0-2,18);for(let x=vx0-2;x<=vx0+vw+2;x+=10)c.lineTo(x,topAt(x));c.lineTo(vx0+vw+2,18);c.closePath();c.fill();
  c.strokeStyle=COL['wall-2'];c.lineWidth=1.2;c.globalAlpha=0.55;
  for(let x=Math.floor(vx0/26)*26;x<vx0+vw+26;x+=26){c.beginPath();c.ellipse(x,32,9,2.2,0,0,Math.PI*2);c.stroke();c.beginPath();c.ellipse(x+13,BOT+16,9,2.2,0,0,Math.PI*2);c.stroke();}
  c.globalAlpha=1;
  // 아래쪽 벽
  c.fillStyle=COL.wall;c.fillRect(vx0-2,BOT,vw+4,32);
  // 내강
  c.fillStyle=COL.lumen;c.beginPath();c.moveTo(vx0-2,topAt(vx0));for(let x=vx0;x<=vx0+vw+2;x+=10)c.lineTo(x,topAt(x));c.lineTo(vx0+vw+2,BOT);c.lineTo(vx0-2,BOT);c.closePath();c.fill();
  // 시나리오 구조
  if(sc.breach){
    const b=sc.breach;
    c.fillStyle=COL.extra;c.fillRect(b.x0-60,BOT+32,b.x1-b.x0+120,LH-BOT-32);
    const hr=Math.sqrt(Math.min(S.bleed,40))*13;
    if(hr>1){c.globalAlpha=0.32;c.fillStyle=COL.blood;ell(c,(b.x0+b.x1)/2,BOT+b.depth+36,10+hr,4+hr*0.26,0);c.fill();c.globalAlpha=1;}
    c.fillStyle=COL.lumen;c.fillRect(b.x0,BOT-1,b.x1-b.x0,b.depth+2);
    c.strokeStyle=COL.collagen;c.lineWidth=1.3;
    for(const ex of [b.x0,b.x1]){c.beginPath();for(let y=BOT;y<=BOT+b.depth;y+=2){const xx=ex+Math.sin(y*0.5)*1.6*(ex===b.x0?-1:1);y===BOT?c.moveTo(xx,y):c.lineTo(xx,y);}c.stroke();}
    if(S.repair>0){c.globalAlpha=0.65*S.repair;c.fillStyle=COL.wall;c.fillRect(b.x0,BOT,b.x1-b.x0,32);c.globalAlpha=1;}
  }
  if(sc.plaque){
    const p=sc.plaque;
    c.fillStyle=COL['wall-2'];c.beginPath();c.moveTo(p.x0,BOT);
    for(let x=p.x0;x<=p.x1;x+=4)c.lineTo(x,baseAt(sc,x));c.lineTo(p.x1,BOT);c.closePath();c.fill();
    const cx=(p.x0+p.x1)/2;c.fillStyle=COL.lipid;ell(c,cx-10,BOT-p.peak*0.42,(p.x1-p.x0)*0.26,p.peak*0.3,0);c.fill();
    const r=sc.rupture;c.beginPath();c.moveTo(r.x0,baseAt(sc,r.x0));c.lineTo((r.x0+r.x1)/2-6,BOT-p.peak*0.45);c.lineTo(r.x1,baseAt(sc,r.x1));c.closePath();c.fill();
  }
  // 내피
  c.strokeStyle=COL.endo;c.lineWidth=2.4;
  c.beginPath();for(let x=vx0-2;x<=vx0+vw+2;x+=8){const y=topAt(x);x===vx0-2?c.moveTo(x,y):c.lineTo(x,y);}c.stroke();
  c.beginPath();let pen=false;
  for(let x=vx0-2;x<=vx0+vw+2;x+=3){
    const gap=(sc.breach&&x>=sc.breach.x0&&x<=sc.breach.x1)||(sc.rupture&&x>=sc.rupture.x0&&x<=sc.rupture.x1);
    const y=sc.plaque?Math.min(BOT,baseAt(sc,x)):BOT;
    if(gap){pen=false;continue;}if(!pen){c.moveTo(x,y);pen=true;}else c.lineTo(x,y);
  }c.stroke();
  if(sc.breach&&S.repair>0){c.globalAlpha=S.repair;c.beginPath();c.moveTo(sc.breach.x0,BOT);c.lineTo(sc.breach.x1,BOT);c.stroke();c.globalAlpha=1;}
  // 판막
  if(sc.valve&&VIR.stasis){
    c.strokeStyle=COL.lysis;c.globalAlpha=0.28;c.lineWidth=1.2;
    for(let k=0;k<2;k++){c.beginPath();c.arc(sc.valve.x+52,BOT-28+k*4,18+k*9,Math.PI*0.9+S.t*0.6,Math.PI*2.3+S.t*0.6);c.stroke();}
    c.globalAlpha=1;
  }
  // 흐르는 입자
  for(const p of S.parts){if(p.x<vx0-8||p.x>vx0+vw+8)continue;const ci=colOf(p.x),top=topAt(p.x),fl=floorAt(ci);const y=top+3+p.u*(fl-top-6);
    if(p.k==='r')drawRBC(c,p.x,y,p.rot,0.92);else drawPlt(c,p.x,y,0.1,p.rot,0.95);}
  for(const l of S.leaks)drawRBC(c,l.x,l.y,l.rot,0.9*(1-l.life/1.6));
  // 혈전
  if(S.items.length){
    const ex=S.exposed.length?S.cols[S.exposed[(S.exposed.length/2)|0]].x:sc.center;
    const halo=S.adp+S.txa;
    if(halo>0.05){const g=c.createRadialGradient(ex,BOT-20,4,ex,BOT-20,90);g.addColorStop(0,COL.platelet);g.addColorStop(1,'transparent');c.globalAlpha=Math.min(0.22,halo*0.18);c.fillStyle=g;c.fillRect(ex-90,BOT-110,180,180);c.globalAlpha=1;}
  }
  for(const it of S.items)if(it.t==='r')drawRBC(c,it.x,it.y,it.rot,1);
  for(const it of S.items)if(it.t==='p')drawPlt(c,it.x,it.y,it.act,it.rot,1);
  const bk=[[],[],[]];for(const s of S.strands){bk[s.x<0.4?0:s.x<0.85?1:2].push(s);}
  c.strokeStyle=COL.fibrin;c.globalAlpha=0.9;
  bk.forEach((arr,i)=>{if(!arr.length)return;c.lineWidth=0.7+i*0.55;c.beginPath();for(const s of arr){c.moveTo(s.a.x,s.a.y);c.lineTo(s.b.x,s.b.y);}c.stroke();});
  c.fillStyle=COL.fibrin;c.beginPath();for(const s of bk[2]){const mx=(s.a.x+s.b.x)/2,my=(s.a.y+s.b.y)/2;c.moveTo(mx+1,my);c.arc(mx,my,1,0,Math.PI*2);}c.fill();
  c.globalAlpha=1;
  if(S.fading.length){c.strokeStyle=COL.lysis;c.lineWidth=1;for(const f of S.fading){c.globalAlpha=1-f.life/0.5;c.beginPath();c.moveTo(f.ax,f.ay);c.lineTo(f.bx,f.by);c.stroke();}c.globalAlpha=1;}
  if(S.plE>0.04&&S.strands.length){
    const n=Math.min(90,Math.round(S.plE*110));c.fillStyle=COL.lysis;c.globalAlpha=0.85;c.beginPath();
    for(let k=0;k<n;k++){const s=S.strands[(Math.random()*S.strands.length)|0];const u=Math.random();const x=s.a.x+(s.b.x-s.a.x)*u,y=s.a.y+(s.b.y-s.a.y)*u;c.moveTo(x+1.7,y);c.arc(x,y,1.7,0,Math.PI*2);}
    c.fill();c.globalAlpha=1;
  }
  if(S.lyNon>0.1){c.fillStyle=COL.lysis;c.globalAlpha=0.5;c.beginPath();for(let k=0;k<Math.round(S.lyNon*40);k++){const x=vx0+Math.random()*vw,y=TOP+8+Math.random()*(LUMEN0-16);c.moveTo(x+1.3,y);c.arc(x,y,1.3,0,Math.PI*2);}c.fill();c.globalAlpha=1;}
  for(const r of S.released){const a=Math.max(0,1-r.life/3);if(r.t==='r')drawRBC(c,r.x,r.y,r.rot,a);else drawPlt(c,r.x,r.y,r.act,r.rot,a);}
  // 판막 첨판은 맨 위
  if(sc.valve){const v=sc.valve;c.strokeStyle=COL['wall-2'];c.lineWidth=5;c.lineCap='round';
    c.beginPath();c.moveTo(v.x,BOT);c.quadraticCurveTo(v.x+22,BOT-72,v.x+v.len,BOT-98);c.stroke();
    c.beginPath();c.moveTo(v.x,TOP);c.quadraticCurveTo(v.x+22,TOP+72,v.x+v.len,TOP+98);c.stroke();c.lineCap='butt';}
  // 이름표
  const L=vx0+12;
  label(c,S.key==='venous'&&VIR.stasis?'느린 혈류 →':'혈류 →',L,(TOP+BOT)/2-60,'left');
  if(S.key==='normal'){label(c,'혈관 내피',L,TOP+14,'left');label(c,'손상 부위 · 콜라겐 노출',(sc.breach.x0+sc.breach.x1)/2,BOT+sc.breach.depth+16);if(S.bleed>0.3&&vw>900)label(c,'혈관 밖 혈종',(sc.breach.x0+sc.breach.x1)/2+140,BOT+sc.breach.depth+16,'left');}
  if(S.key==='arterial'){label(c,'죽상반 지질 핵',sc.plaque.x0+70,BOT+16);label(c,'섬유막 파열',(sc.rupture.x0+sc.rupture.x1)/2+90,BOT-sc.plaque.peak-6,'left');}
  if(S.key==='venous'){label(c,'판막 주머니',sc.valve.x+40,BOT+14);label(c,'정맥 판막',sc.valve.x+sc.valve.len+8,TOP+98,'left');if(S.embFlash>0)label(c,'색전 → 폐동맥으로',Math.min(vx0+vw-80,sc.center+220),TOP+40);}
  if(S.key==='arterial'&&S.flowF<0.5)label(c,'하류 허혈',vx0+vw-60,(TOP+BOT)/2,'center');
}

