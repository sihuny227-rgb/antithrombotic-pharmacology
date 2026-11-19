// ===== 화면 연결 =====
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const CC={ap:'var(--platelet)',ac:'var(--fibrin)',ly:'var(--lysis)',rv:'var(--muted)',rs:'var(--drug)'};
let running=true,speed=1,visible=true,userPhase=null,selDrug='tenecteplase',selNode='iia',lastUI=0,lastAlert=0,alertSig='';
const SHORT={gp2b3a:'티로피반·엡티피바타이드',ufh:'헤파린(UFH)',enoxaparin:'에녹사파린',xia:'XIa 억제제(연구)',vitk:'비타민 K',pcc:'4인자 PCC',andexanet:'안덱사네트',cryo:'동결침전제제',plt:'혈소판 수혈'};
const sname=id=>SHORT[id]||DRUG[id].name;

// ---- 약물 패널 ----
function buildDrugPanel(){
  const g=[['ap','항혈소판제',true],['ac','항응고제',true],['ly','혈전용해제',true],['rv','역전·지혈제',false]];
  let h='';
  for(const [cls,title,open] of g){
    const list=DRUGS.filter(d=>(cls==='ac'?(d.cls==='ac'||d.cls==='rs'):d.cls===cls)&&(d.sim||d.rev||d.lytic||d.cryo));
    h+=`<details class="dgroup" ${open?'open':''}><summary>${title}<span class="cnt" id="cnt-${cls}"></span></summary>`;
    if(cls==='ly'){
      h+='<div class="lytic-list">'+list.map(d=>`<div class="lytic" title="${esc(d.name)} · ${esc(d.brand)}"><span><b>${d.name}</b> <small>${d.lytic.mode==='bolus'?'단회 볼루스':d.lytic.mode==='double'?'2회 볼루스':'지속 주입'} · 피브린 특이성 ${d.lytic.spec>=0.9?'매우 높음':d.lytic.spec>=0.7?'높음':d.lytic.spec>=0.5?'중간':'낮음'}</small></span><button class="btn small" type="button" data-give="${d.id}">투여</button><span class="lvl"><i id="lv-${d.id}"></i></span></div>`).join('')+'</div>';
    }else{
      h+='<div class="dlist">'+list.map(d=>d.cryo?`<button class="btn small" type="button" id="btnCryo">${d.name} 투여</button>`:`<label class="dchip ${d.cls}" title="${esc(d.name)} · ${esc(d.brand)}"><input type="checkbox" id="d-${d.id}" data-drug="${d.id}"><span>${esc(sname(d.id))}</span></label>`).join('')+'</div>';
      if(cls==='ap')h+=`<div class="submods" id="clopiMods" hidden><span>클로피도그렐 조건:</span><label><input type="checkbox" id="m-cyp"> CYP2C19 기능저하형</label><label><input type="checkbox" id="m-ome"> 오메프라졸 병용</label></div>`;
    }
    h+='</details>';
  }
  $('#drugPanel').innerHTML=h;
  $('#drugPanel').addEventListener('change',e=>{
    const t=e.target;
    if(t.dataset.drug){setDrug(t.dataset.drug,t.checked);}
    else if(t.id==='m-cyp'){MOD.cyp=t.checked;drugsChanged();}
    else if(t.id==='m-ome'){MOD.ome=t.checked;drugsChanged();}
  });
  $('#drugPanel').addEventListener('click',e=>{
    const b=e.target.closest('[data-give]');if(b){giveLytic(b.dataset.give);if(!running)togglePlay(true);drugsChanged();return;}
    if(e.target.closest('#btnCryo')){giveCryo();flashAlert('동결침전제제로 피브리노겐을 보충했습니다.');}
  });
}
function setDrug(id,on){
  if(on)active.add(id);else active.delete(id);
  const cb=document.getElementById('d-'+id);if(cb)cb.checked=on;
  drugsChanged();
}
function drugsChanged(){
  computeChannels();
  $('#clopiMods').hidden=!active.has('clopidogrel');
  for(const cls of ['ap','ac','rv']){const n=[...active].filter(id=>cls==='ac'?['ac','rs'].includes(DRUG[id].cls):DRUG[id].cls===cls).length;const el=$('#cnt-'+cls);if(el)el.textContent=n?n+'개 적용':'';}
  const nl=S.doses.length;$('#cnt-ly').textContent=nl?nl+'회 투여':'';
  updateHudDrugs();updateMapActive();updateAlerts(true);updateRisk();renderDetailActions();
}
function updateHudDrugs(){
  const ids=[...active];const lys=[...new Set(S.doses.map(d=>d.id))];
  const all=[...ids.map(id=>sname(id)),...lys.map(id=>DRUG[id].name)];
  const shown=all.slice(0,4).map(n=>`<span class="pill drug">${esc(n)}</span>`).join('')+(all.length>4?`<span class="pill drug">+${all.length-4}</span>`:'');
  $('#hudDrugs').innerHTML=shown;
}

// ---- 시나리오 ----
function setScenario(key){
  for(const b of document.querySelectorAll('#scenTabs button'))b.setAttribute('aria-selected',b.dataset.scen===key?'true':'false');
  initSim(key);userPhase=null;
  const sc=SCENARIOS[key];$('#scenDesc').textContent=sc.desc;
  const o=$('#scenOpts');
  if(key==='venous'){o.innerHTML=`<span class="lbl">Virchow 3요소</span>`+[['stasis','혈류 정체'],['endo','내피 활성화'],['hyper','과응고 상태']].map(([k,t])=>`<label class="dchip rs"><input type="checkbox" id="v-${k}" data-vir="${k}" ${VIR[k]?'checked':''}><span>${t}</span></label>`).join('');}
  else o.innerHTML='';
  buildPhases();drugsChanged();
  if(!running)drawScene();
}
$('#scenOpts').addEventListener('change',e=>{const k=e.target.dataset.vir;if(k){VIR[k]=e.target.checked;}});
$('#scenTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setScenario(b.dataset.scen);});

function buildPhases(){
  const ph=SCENARIOS[S.key].phases;
  $('#phases').innerHTML=ph.map((p,i)=>`<li data-i="${i}"><button type="button" data-ph="${i}"><span class="n">${i+1}</span><span>${p[0]}</span></button></li>`).join('');
  renderPhaseState(true);
}
$('#phases').addEventListener('click',e=>{const b=e.target.closest('[data-ph]');if(!b)return;const i=+b.dataset.ph;userPhase=(userPhase===i||i===currentPhase())?null:i;renderPhaseState(true);});
let lastPhaseShown=-2;
function renderPhaseState(force){
  const cur=currentPhase();const show=userPhase!==null?userPhase:Math.max(0,cur);
  for(const li of document.querySelectorAll('#phases li')){const i=+li.dataset.i;li.classList.toggle('done',S.reached.has(i)&&i!==cur);li.classList.toggle('cur',i===cur);li.classList.toggle('sel',i===userPhase);}
  if(show===lastPhaseShown&&!force)return;lastPhaseShown=show;
  const p=SCENARIOS[S.key].phases[show];
  const chips=p[2].length?`<div class="chips">${p[2].map(id=>`<button class="chip" type="button" data-open="${id}"><i class="cdot" style="background:${CC[DRUG[id].cls]}"></i>${esc(sname(id))}</button>`).join('')}</div>`:'';
  $('#phaseNote').innerHTML=`<p class="kicker">${userPhase!==null?'선택한 단계':'지금 단계'} ${show+1}/${SCENARIOS[S.key].phases.length}</p><h3>${p[0]}</h3><p>${p[1]}</p>${chips}`;
}
$('#phaseNote').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)openDrug(b.dataset.open,true);});

// ---- 재생 ----
function togglePlay(force){
  running=force===undefined?!running:force;
  $('#btnPlay span').textContent=running?'일시정지':'재생';
  $('#playIcon').setAttribute('d',running?'M4 2.5h3v11H4zM9 2.5h3v11H9z':'M4 2.5v11l9-5.5z');
}
$('#btnPlay').addEventListener('click',()=>togglePlay());
$('#btnReset').addEventListener('click',()=>{setScenario(S.key);togglePlay(true);});
$('#speedSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;speed=+b.dataset.sp;for(const x of document.querySelectorAll('#speedSeg button'))x.setAttribute('aria-pressed',x===b?'true':'false');});
$('#btnClear').addEventListener('click',()=>{active.clear();MOD.cyp=MOD.ome=false;for(const cb of document.querySelectorAll('#drugPanel input'))cb.checked=false;drugsChanged();});

// ---- 계기판 ----
function setMeter(id,v,txt){const el=document.getElementById('m'+id);el.style.width=(clamp(v,0,1)*100).toFixed(1)+'%';document.getElementById('v'+id).textContent=txt!==undefined?txt:Math.round(clamp(v,0,1)*100);}
function updateRisk(){
  const r=bleedIndex(S.ch);const lv=r<0.1?0:r<0.3?1:r<0.5?2:3;
  const names=['기본','증가','높음','매우 높음'],cols=['var(--ok)','var(--warn)','var(--crit)','var(--crit)'];
  $('#riskTxt').textContent=names[lv];$('#riskTxt').style.color=cols[lv];
  [...$('#riskBar').children].forEach((el,i)=>{el.style.background=i<=lv?cols[lv]:'var(--surface-2)';});
}
function uiTick(){
  const plug=S.key==='normal'?S.coverage:clamp(S.nP/420,0,1);
  setMeter('Plt',plug);setMeter('Thr',S.thrEff/1.1);setMeter('Fib',S.FD);setMeter('X',S.cross);setMeter('Pls',S.plasmin/0.9);setMeter('Fbg',S.fib);
  $('#tLabel').textContent=`t = ${S.t.toFixed(1)} s (모형 시간)`;
  for(const d of DRUGS.filter(x=>x.lytic)){let lv=0;for(const z of S.doses)if(z.id===d.id)lv=Math.max(lv,z.lv||0);const el=document.getElementById('lv-'+d.id);if(el)el.style.width=Math.min(100,lv*100)+'%';}
  // 상태·결과
  let cls='',txt='';const st=$('#hudStatus');
  const o=$('#outcome');
  if(S.key==='normal'){
    if(S.repair>=1){cls='ok';txt='혈관 복구 완료';}else if(S.repair>0){cls='ok';txt='지혈됨 · 복구 중';}
    else if(S.coverage>=0.92){cls='ok';txt='지혈됨';}
    else if(S.t<0.4){cls='';txt='손상 직전';}
    else if(S.firstSeal!==null&&S.coverage<0.6){cls='crit';txt='재출혈';}
    else if(S.coverage<0.6){cls='crit';txt='출혈 중';}else{cls='warn';txt='부분 지혈';}
    o.innerHTML=`<div class="out-row"><span>출혈량 <span class="kicker">(상대)</span></span><span class="out-big">${S.bleed.toFixed(1)}</span></div>
      <div class="out-row"><span>첫 지혈까지</span><span class="mono">${S.firstSeal===null?'—':S.firstSeal.toFixed(1)+' s'}</span></div>
      <div class="out-row"><span>재출혈</span><span class="mono">${S.rebleeds}회</span></div>
      <div class="out-row"><span>혈관 복구</span><span class="mono">${Math.round(S.repair*100)}%</span></div>`;
  }else if(S.key==='arterial'){
    const oc=Math.round(S.occl*100);
    if(S.occlReached&&S.occl<0.6){cls='ok';txt=`재관류 · 협착 ${oc}%`;}else if(S.occl>=0.85){cls='crit';txt=`폐색 ${oc}%`;}else if(S.occl>=0.6){cls='warn';txt=`협착 ${oc}%`;}else{cls='';txt=`내강 협착 ${oc}%`;}
    o.innerHTML=`<div class="out-row"><span>내강 협착</span><span class="out-big">${oc}%</span></div>
      <div class="out-row"><span>혈류</span><span class="mono">${Math.round(S.flowF*100)}%</span></div>
      <div class="out-row"><span>하류 허혈 손상 <span class="kicker">(상대)</span></span><span class="mono">${Math.round(S.dmg*100)}%</span></div>`;
  }else{
    const oc=Math.round(Math.max(0,S.occl)*100);const size=clamp(S.items.length/600,0,1);
    if(S.embFlash>0){cls='crit';txt='색전 발생';}else if(S.occl>=0.5){cls='warn';txt=`정맥 폐색 ${oc}%`;}else if(S.items.length>12){cls='warn';txt='혈전 성장 중';}else{cls='ok';txt='혈전 없음';}
    o.innerHTML=`<div class="out-row"><span>정맥 폐색</span><span class="out-big">${oc}%</span></div>
      <div class="out-row"><span>혈전 크기 <span class="kicker">(상대)</span></span><span class="mono">${Math.round(size*100)}</span></div>
      <div class="out-row"><span>색전 발생</span><span class="mono">${S.embCount}회</span></div>`;
  }
  st.className='pill '+cls;st.querySelector('span').textContent=txt;
  cv.setAttribute('aria-label',`${SCENARIOS[S.key].title} 시뮬레이션: ${txt}`);
  updateRisk();renderPhaseState(false);
}

// ---- 주의 알림 ----
let flashMsg=null,flashUntil=0;
function flashAlert(m){flashMsg=m;flashUntil=performance.now()+4000;updateAlerts(true);}
function updateAlerts(force){
  const A=[];const has=id=>active.has(id);
  const ap=[...active].filter(id=>DRUG[id].cls==='ap'),ac=[...active].filter(id=>DRUG[id].cls==='ac');
  const doacs=['apixaban','rivaroxaban','edoxaban','dabigatran'];
  const ly=S.lyticGiven;
  if(flashMsg&&performance.now()<flashUntil)A.push(['info','적용됨',flashMsg,null]);
  if(S.key==='arterial'&&S.occlReached&&!ly)A.push(['warn','혈관이 막혔습니다','항혈소판제·항응고제는 이미 생긴 혈전을 녹이지 못합니다. 재관류가 목표라면 혈전용해제를 ‘투여’해 보세요. 실제로는 시간창·금기를 먼저 확인합니다.','aha26']);
  if(ly){
    A.push(['info','혈전용해제 투여됨','플라스민이 피브린을 잘라 혈전이 풀립니다. 효과는 시간 의존적이고, 교차결합이 많거나 혈소판이 풍부한 혈전은 더 저항합니다.','aha26']);
    if(ap.length||ac.length)A.push(['crit','혈전용해제 + 항혈전제','출혈 위험이 크게 늘어납니다. 뇌졸중 혈전용해 후 24시간은 항혈전제를 보류하는 것이 표준입니다.','aha26']);
    if(doacs.some(has))A.push(['crit','최근 DOAC 복용','48시간 내 DOAC 복용은 뇌졸중 혈전용해의 원칙적 제외 기준입니다. 약물 특이 검사가 정상이면 예외를 검토합니다.','aha26']);
    if(has('warfarin'))A.push(['crit','와파린 복용 중 혈전용해','INR >1.7이면 뇌졸중 혈전용해의 제외 기준입니다.','aha26']);
    if(has('gp2b3a'))A.push(['crit','GPIIb/IIIa 억제제 + 혈전용해','2026 AHA/ASA는 혈전용해 보조로 엡티피바타이드를 권장하지 않습니다.','aha26pr']);
    if(S.key==='normal')A.push(['crit','상처가 있는 상태의 혈전용해','지혈에 필요한 마개까지 녹아 다시 출혈합니다. 두개내출혈이 혈전용해의 가장 큰 위험인 이유입니다.','activase']);
    if(has('txa'))A.push(['info','트라넥삼산이 용해를 막음','항섬유소용해제는 혈전용해제의 작용을 상쇄합니다.','ncs']);
    if(S.doses.some(d=>DRUG[d.id].lytic.spec<0.5))A.push(['warn','비특이 혈전용해','혈중 피브리노겐까지 분해해 전신 출혈 경향이 커집니다. 출혈 시 동결침전제제로 피브리노겐을 보충합니다.','ncs']);
  }
  if(ap.length+(ac.length?1:0)>=3||(ac.length&&ap.length>=2))A.push(['crit','삼중요법','경구 항응고제 + DAPT는 출혈이 크게 늘어 가능한 짧게 씁니다. 2025 ACC/AHA는 아스피린을 대개 1~4주 내 중단합니다.','acc25']);
  else if(ac.length&&ap.length)A.push(['warn','항응고제 + 항혈소판제','심방세동에서 적응증 없는 항혈소판제 추가는 출혈만 늘립니다 (2024 ESC).','esc24']);
  else if(ap.length>=2)A.push(['warn','항혈소판제 2제 병용','DAPT는 ACS·PCI 후나 경증 뇌졸중 21일처럼 기간을 정해 씁니다.','acc25']);
  const p2=['clopidogrel','prasugrel','ticagrelor','cangrelor'].filter(has);
  if(p2.length>=2&&!(p2.length===2&&has('cangrelor')))A.push(['crit','P2Y₁₂ 억제제 중복','같은 수용체를 막는 경구약을 겹쳐 쓰지 않습니다.','doc']);
  if(ac.length>=2){if(has('warfarin')&&ac.some(x=>['ufh','enoxaparin','fondaparinux'].includes(x))&&ac.length===2)A.push(['info','와파린 시작 중첩','급성 VTE는 헤파린계를 최소 5일 중첩하고 INR이 치료범위에 들면 주사제를 끊습니다.','doc']);else A.push(['crit','항응고제 중복','전환 시점 외에는 항응고제를 함께 쓰지 않습니다.','doc']);}
  if(has('clopidogrel')&&MOD.ome)A.push(['warn','클로피도그렐 + 오메프라졸','CYP2C19 억제로 활성대사체가 줄어듭니다. 12시간 간격으로도 해결되지 않아 판토프라졸 등을 고려합니다.','plavix']);
  if(has('clopidogrel')&&MOD.cyp)A.push(['warn','CYP2C19 기능저하형','클로피도그렐 효과가 떨어집니다. 금기를 확인하고 프라수그렐·티카그렐러를 고려합니다.','plavix']);
  if(has('prasugrel'))A.push(['warn','프라수그렐','과거 뇌졸중·TIA는 금기, 75세 이상 일반적 비권장, 60 kg 미만 5 mg.','doc']);
  if(has('ticagrelor')&&has('aspirin'))A.push(['info','티카그렐러 + 아스피린','유지 아스피린은 100 mg/일 이하. 넘으면 티카그렐러 효과가 떨어집니다.','doc']);
  if(has('cilostazol'))A.push(['warn','실로스타졸','심부전 환자에게는 금기입니다.','doc']);
  if(has('ufh')||has('enoxaparin'))A.push(['info','헤파린 투여 중','5~10일째 혈소판 수를 확인합니다. 50% 넘게 떨어지고 새 혈전이 생기면 HIT를 의심합니다.','doc']);
  if(has('warfarin'))A.push(['info','와파린의 시간 지연','실제로는 효과까지 수일(II 반감기 60~72시간)이 걸리고 초기에 Protein C가 먼저 줄어듭니다. 모형은 치료 INR 상태를 가정합니다.','doc']);
  if(has('txa')&&!ly)A.push(['warn','트라넥삼산','섬유소 용해를 막으므로 혈전 고위험 환자에서는 주의합니다.','ncs']);
  if(has('protamine')&&!has('ufh')&&!has('enoxaparin'))A.push(['info','역전할 헤파린 없음','프로타민은 헤파린에만 의미가 있고 폰다파리눅스에는 무효입니다.','doc']);
  if(has('idarucizumab')&&!has('dabigatran'))A.push(['info','이다루시주맙은 다비가트란 전용','다른 항응고제에는 효과가 없습니다.','doc']);
  if(has('pcc')&&!has('warfarin')&&!['apixaban','rivaroxaban','edoxaban'].some(has))A.push(['info','PCC 대상 약물 없음','4인자 PCC는 와파린 출혈 교정, Xa 억제제 출혈 지혈 보조에 씁니다.','doc']);
  if(has('pcc')&&has('warfarin')&&!has('vitk'))A.push(['warn','PCC 단독','비타민 K 없이 PCC만 쓰면 INR이 다시 오릅니다.','doc']);
  if(has('plt')&&has('ticagrelor'))A.push(['warn','티카그렐러와 혈소판 수혈','혈중 약물이 수혈한 혈소판도 억제해 효과가 제한됩니다.','doc']);
  if(has('xia'))A.push(['info','XIa 억제제는 미허가','모형 효과는 기전 설명용입니다. 정상 지혈보다 병적 혈전 증폭을 더 줄이는 모습을 비교해 보세요.','oceanic']);
  if(S.key==='arterial'&&ac.length&&!ap.length)A.push(['info','동맥 혈전에 항응고제 단독','혈소판이 많은 백색 혈전은 항응고제만으로 잘 막히지 않습니다. 동맥 2차 예방은 항혈소판제가 기본입니다.','doc']);
  if(S.key==='venous'&&ap.length&&!ac.length)A.push(['info','정맥 혈전에 항혈소판제 단독','피브린·적혈구가 많은 정맥 혈전에는 항응고제가 1차 선택입니다.','doc']);
  if(S.key==='normal'&&S.rebleeds>0&&ac.length)A.push(['info','항응고제와 재출혈','피브린 교차결합이 약해 마개가 떨어집니다. 응고인자 계통의 출혈은 지연·재발하는 양상이 특징입니다.','doc']);
  const sig=A.map(a=>a[1]+a[2]).join('|');
  if(!force&&sig===alertSig)return;alertSig=sig;
  $('#alertCnt').textContent=A.length?A.length+'건':'';
  $('#alerts').innerHTML=A.length?A.map(a=>`<div class="alert ${a[0]}"><b>${a[1]}</b> · ${a[2]}${a[3]?` <a class="src" href="#ref-${a[3]}">근거</a>`:''}</div>`).join(''):'<p class="empty">약물을 켜거나 시나리오를 진행하면 병용 주의, 금기, 해석 팁이 여기에 나타납니다.</p>';
}

// ---- 표적 지도 ----
const MAP_NODES=[
 ['col',24,52,140,46,'콜라겐 노출','+ vWF','plt'],['adh',236,52,160,46,'GPIb-IX-V · GPVI','혈소판 부착','plt'],
 ['adp',236,112,160,40,'ADP → P2Y₁₂','','plt'],['tx',236,164,160,40,'COX-1 → TXA₂','','plt'],['sht',236,214,160,36,'5-HT → 5-HT₂A','','plt'],
 ['act',470,100,170,72,'혈소판 활성화','Ca²⁺↑ · 모양 변화 · 방출','plt'],['camp',470,192,160,44,'cAMP–PKA 억제 신호','PDE3가 cAMP 분해','nat'],
 ['gp',712,104,160,50,'GPIIb/IIIa','활성형 전환','plt'],['plug',930,104,170,50,'피브리노겐 가교','혈소판 마개 (1차)','plt'],
 ['clot',1020,226,160,56,'안정화된 혈전','혈소판 + 교차결합 피브린','end'],
 ['tf',24,320,150,48,'조직인자(TF)','+ VIIa · 개시','coag'],['tfpi',24,384,100,30,'TFPI','','nat'],['pcs',150,404,120,32,'Protein C · S','','nat'],
 ['xii',24,474,110,42,'XII → XIIa','접촉계','coag'],['xi',160,474,110,42,'XI → XIa','','coag'],['ix',296,474,130,42,'IXa + VIIIa','tenase','coag'],
 ['xa',300,320,170,52,'X → Xa','+ Va · prothrombinase','coag'],['iia',620,320,170,52,'프로트롬빈(II)','→ 트롬빈(IIa)','coag'],
 ['fbn',900,320,150,52,'피브리노겐(I)','→ 피브린','coag'],['xiii',900,430,150,46,'XIIIa 교차결합','피브린 안정화','coag'],
 ['at',500,440,130,32,'안티트롬빈(AT)','','nat'],['vitk',560,520,420,50,'비타민 K 순환 · VKORC1','→ γ-카르복실화된 II · VII · IX · X · Protein C·S','coag'],
 ['plg',24,648,150,46,'플라스미노겐','피브린에 결합','lys'],['pls',330,648,150,46,'플라스민','','lys'],['fdp',600,648,190,46,'피브린 분해','→ FDP · D-dimer','lys'],
 ['tpa',210,712,160,34,'tPA(내피) · uPA','','lys'],['pai',24,720,110,30,'PAI-1','','nat'],['a2ap',420,712,140,32,'α₂-항플라스민','','nat']
];
const MAP_EDGES=[
 ['M164 75 L236 75'],['M396 75 C432 75 438 116 470 120'],['M396 132 L470 132'],['M396 184 C432 184 440 150 470 148'],['M396 232 C444 232 448 166 470 162'],
 ['M550 192 L550 175','inh'],['M640 134 L712 130'],['M872 129 L930 129'],['M1030 154 C1040 190 1080 200 1092 226'],
 ['M636 320 L636 176','','PAR-1/4',642,268,'start'],
 ['M174 344 L300 346'],['M74 384 L74 370','inh'],['M134 495 L160 495'],['M270 495 L296 495'],['M361 474 L380 374'],
 ['M470 346 L620 346'],['M790 346 L900 346'],['M975 372 L975 430'],['M1050 453 C1095 450 1100 330 1100 284'],
 ['M650 372 Q550 418 450 372','fb','되먹임: V · VIII · XI 활성화',550,412,'middle'],
 ['M270 410 L320 374','inh'],['M240 436 L330 474','inh'],['M520 440 L440 374','inh'],['M610 440 L660 374','inh'],
 ['M174 671 L330 671'],['M290 712 L252 674'],['M134 735 L210 730','inh'],['M470 712 L432 696','inh'],['M480 671 L600 671'],
 ['M790 671 C1190 660 1190 400 1050 362','lys','피브린 분해',1168,560,'end']
];
const MAP_PILLS=[
 [24,110,['clopidogrel','prasugrel']],[24,132,['ticagrelor','cangrelor']],[24,172,['aspirin','triflusal']],[24,222,['sarpogrelate']],
 [470,242,['cilostazol','dipyridamole']],[712,162,['gp2b3a']],[930,162,['plt']],
 [300,294,['apixaban','rivaroxaban','edoxaban','andexanet']],[650,294,['dabigatran','argatroban','bivalirudin','idarucizumab']],[1060,294,['cryo']],
 [500,478,['ufh','enoxaparin','fondaparinux','protamine']],[160,522,['xia']],[560,576,['warfarin','vitk','pcc']],
 [30,698,['txa']],[210,758,['alteplase','tenecteplase','reteplase','urokinase','streptokinase']]
];
function textW(s){let w=0;for(const ch of s){const c=ch.charCodeAt(0);w+=(c>=0xAC00&&c<=0xD7A3)?11:ch===' '?3.4:6.4;}return w;}
function buildMap(){
  const lanes=`<rect class="lane" x="6" y="10" width="1188" height="262" rx="12" style="fill:var(--platelet-soft);opacity:.55"/>
   <rect class="lane" x="6" y="286" width="1188" height="318" rx="12" style="fill:var(--fibrin-soft);opacity:.55"/>
   <rect class="lane" x="6" y="618" width="1188" height="172" rx="12" style="fill:var(--lysis-soft);opacity:.6"/>
   <text class="lane-l" x="24" y="34">1차 지혈 · 혈소판</text><text class="lane-l" x="24" y="308">2차 지혈 · 응고인자</text><text class="lane-l" x="24" y="638">섬유소 용해</text>`;
  const defs=`<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--muted)"/></marker>
   <marker id="bar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M5 0 L5 10" style="stroke:var(--muted);stroke-width:2.4"/></marker></defs>`;
  const edges=MAP_EDGES.map(([d,c,l,lx,ly,anc])=>{
    const sty=c==='lys'?'style="stroke:var(--lysis);stroke-dasharray:5 3"':'';
    return `<path class="edge ${c||''}" d="${d}" ${sty} marker-end="url(#${c==='inh'?'bar':'arr'})"/>`+(l?`<text class="edge-l" x="${lx}" y="${ly}" text-anchor="${anc||'start'}">${l}</text>`:'');}).join('');
  const nodes=MAP_NODES.map(([id,x,y,w,h,l1,l2,k])=>{
    const t=l2?`<text x="${x+10}" y="${y+20}">${l1}</text><text class="sub" x="${x+10}" y="${y+37}">${l2}</text>`:`<text x="${x+10}" y="${y+h/2+4.5}">${l1}</text>`;
    return `<g class="node k-${k}" data-node="${id}" tabindex="0" role="button" aria-label="${esc(l1)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>${t}</g>`;}).join('');
  let pills='';
  for(const [x0,y,ids] of MAP_PILLS){let x=x0;for(const id of ids){const d=DRUG[id];const tx=sname(id);const w=15+textW(tx)+9;
    pills+=`<g class="mpill ${d.cls==='rs'?'res':''}" data-pill="${id}" tabindex="0" role="button" aria-label="${esc(tx)} 가이드 열기"><rect x="${x}" y="${y}" width="${w}" height="18" rx="9"/><circle cx="${x+8}" cy="${y+9}" r="3.2" style="fill:${CC[d.cls]}"/><text x="${x+15}" y="${y+12.6}">${esc(tx)}</text></g>`;x+=w+4;}}
  $('#mapBox').innerHTML=`<svg viewBox="0 0 1200 800" role="group" aria-label="응고·혈소판·섬유소 용해 경로와 약물 표적 지도">${defs}${lanes}${edges}${nodes}${pills}</svg>`;
  $('#mapBox').addEventListener('click',e=>{const p=e.target.closest('[data-pill]');if(p){openDrug(p.dataset.pill,true);return;}const n=e.target.closest('[data-node]');if(n)showNode(n.dataset.node);});
  $('#mapBox').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const p=e.target.closest('[data-pill]');if(p){e.preventDefault();openDrug(p.dataset.pill,true);return;}const n=e.target.closest('[data-node]');if(n){e.preventDefault();showNode(n.dataset.node);}});
}
function showNode(id){
  selNode=id;const [t,b]=NODE_INFO[id];
  const ds=DRUGS.filter(d=>d.nodes.includes(id));
  for(const g of document.querySelectorAll('#mapBox .node'))g.classList.toggle('sel',g.dataset.node===id);
  $('#mapInfo').innerHTML=`<p class="lab">선택한 단계</p><h3>${t}</h3><p>${b}</p>`+(ds.length?`<p class="lab">이 지점에 작용하는 약물</p><div class="chips">${ds.map(d=>`<button class="chip" type="button" data-open="${d.id}"><i class="cdot" style="background:${CC[d.cls]}"></i>${esc(sname(d.id))}</button>`).join('')}</div>`:'<p class="lab">직접 작용하는 약물 없음</p>');
}
$('#mapInfo').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)openDrug(b.dataset.open,true);});
function updateMapActive(){
  const lys=new Set(S.doses.map(d=>d.id));
  const on=new Set([...active,...lys]);
  const blocked=new Set();for(const id of on)for(const n of DRUG[id].nodes)blocked.add(n);
  for(const g of document.querySelectorAll('#mapBox .mpill')){g.classList.toggle('on',on.has(g.dataset.pill));g.classList.toggle('sel',g.dataset.pill===selDrug);}
  for(const g of document.querySelectorAll('#mapBox .node'))g.classList.toggle('blocked',blocked.has(g.dataset.node));
}

// ---- 약물 가이드 ----
let clsFilter='all',query='';
function renderCards(){
  const q=query.trim().toLowerCase().replace(/\s+/g,'');
  const norm=s=>String(s).toLowerCase().replace(/\s+/g,'').replace(/₁/g,'1').replace(/₂/g,'2');
  const list=DRUGS.filter(d=>(clsFilter==='all'||d.cls===clsFilter||(clsFilter==='ac'&&d.cls==='rs'))&&(!q||norm([d.name,d.en,d.brand,d.target,d.key,d.goal].join(' ')).includes(norm(q))));
  $('#dcards').innerHTML=list.length?list.map(d=>`<button class="dcard" type="button" data-id="${d.id}" aria-current="${d.id===selDrug}"><span class="nm"><i class="cdot" style="background:${CC[d.cls]}"></i>${esc(d.name)}</span><span class="en">${esc(d.en)} · ${CLS[d.cls]}</span><span class="tg"><b>표적</b> ${esc(d.target)}</span><span class="br"><b>제품</b> ${esc(d.brand)}</span></button>`).join(''):'<p class="empty">찾는 약물이 없습니다. 성분명, 상품명, 표적(예: P2Y12, Xa)으로 검색해 보세요.</p>';
}
$('#dcards').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)openDrug(b.dataset.id,false);});
$('#clsSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;clsFilter=b.dataset.cls;for(const x of document.querySelectorAll('#clsSeg button'))x.setAttribute('aria-pressed',x===b?'true':'false');renderCards();});
$('#q').addEventListener('input',e=>{query=e.target.value;renderCards();});
function openDrug(id,scroll){
  selDrug=id;renderCards();renderDetail();updateMapActive();
  if(scroll)$('#guide').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function renderDetail(){
  const d=DRUG[selDrug];
  const li=a=>a.map(x=>`<li>${esc(x)}</li>`).join('');
  const dl=a=>a.filter(x=>x[0]&&x[0]!=='—').map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v||'—')}</dd>`).join('');
  const inter=dl(d.interact);
  $('#detail').innerHTML=`<div class="d-head"><div><h3>${esc(d.name)}</h3><p class="en">${esc(d.en)} · ${esc(d.brand)}</p></div><span class="pill" style="color:${CC[d.cls]}"><i class="dot" style="background:${CC[d.cls]}"></i>${CLS[d.cls]}</span></div>
   <div class="d-key"><div class="kbox t"><span class="lab">표적</span><p>${esc(d.target)}</p></div><div class="kbox g"><span class="lab">치료 목표</span><p>${esc(d.goal)}</p></div><div class="kbox c"><span class="lab">주의 핵심</span><p>${esc(d.key)}</p></div></div>
   <div class="d-sec"><h4>작용 기전</h4><p>${esc(d.mech)}</p></div>
   ${d.trial?`<div class="d-sec"><h4>임상시험 현황</h4><p>${esc(d.trial)}</p></div>`:''}
   <div class="d-sec"><h4>용법 (성인 대표)</h4><ul>${li(d.dose)}</ul></div>
   <div class="d-sec"><h4>부작용과 발생 기전</h4><dl>${d.adverse.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v||'—')}</dd>`).join('')}</dl></div>
   <div class="d-sec"><h4>금기·주의</h4><ul>${li(d.caution)}</ul></div>
   ${inter?`<div class="d-sec"><h4>상호작용</h4><dl>${inter}</dl></div>`:''}
   <div class="d-sec"><h4>모니터링</h4><p>${esc(d.monitor)}</p></div>
   ${d.reverse&&d.reverse!=='—'?`<div class="d-sec"><h4>출혈·역전</h4><p>${esc(d.reverse)}</p></div>`:''}
   ${d.periop?`<div class="d-sec"><h4>시술 전</h4><p>${esc(d.periop)}</p></div>`:''}
   <div class="d-actions" id="dActions"></div>
   <div class="src-tags">${d.src.map(k=>`<a href="#ref-${k}">${esc(SRC[k].t.split(' (')[0])}</a>`).join('')}</div>`;
  renderDetailActions();
}
function renderDetailActions(){
  const el=document.getElementById('dActions');if(!el)return;const d=DRUG[selDrug];let b='';
  if(d.lytic)b+=`<button class="btn primary" type="button" data-act="give">시뮬레이터에서 투여</button>`;
  else if(d.cryo)b+=`<button class="btn primary" type="button" data-act="cryo">시뮬레이터에서 투여</button>`;
  else if(d.sim||d.rev)b+=`<button class="btn ${active.has(d.id)?'':'primary'}" type="button" data-act="toggle">${active.has(d.id)?'시뮬레이터에서 해제':'시뮬레이터에 적용'}</button>`;
  b+=`<button class="btn" type="button" data-act="map">표적 지도에서 보기</button>`;
  el.innerHTML=b;
}
$('#detail').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const d=DRUG[selDrug];const rm=matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
  if(b.dataset.act==='toggle'){setDrug(d.id,!active.has(d.id));$('#sim').scrollIntoView({behavior:rm});}
  else if(b.dataset.act==='give'){giveLytic(d.id);togglePlay(true);drugsChanged();$('#sim').scrollIntoView({behavior:rm});}
  else if(b.dataset.act==='cryo'){giveCryo();flashAlert('동결침전제제로 피브리노겐을 보충했습니다.');$('#sim').scrollIntoView({behavior:rm});}
  else if(b.dataset.act==='map'){showNode(d.nodes[0]);updateMapActive();$('#map').scrollIntoView({behavior:rm});}
});

// ---- 체중별 용량 ----
function renderDose(){
  const w=+$('#wt').value;$('#wtOut').textContent=w+' kg';
  const alt=Math.min(0.9*w,90),altB=alt*0.1;
  const tnk=Math.min(0.25*w,25);
  const tS=w<60?30:w<70?35:w<80?40:w<90?45:50;
  const accel=w<=67?{a:0.75*w,b:0.5*w}:{a:50,b:35};const accT=15+accel.a+accel.b;
  const f=v=>(Math.round(v*10)/10).toFixed(1);
  $('#doseOut').innerHTML=`
   <div class="dose"><span class="k">알테플라제 · 뇌졸중</span><span class="v">${f(alt)} mg</span><span class="s">볼루스 ${f(altB)} mg (1분) → ${f(alt-altB)} mg을 60분 주입${alt>=90?' · 최대 용량 도달':''}</span></div>
   <div class="dose"><span class="k">테넥테플라제 · 뇌졸중</span><span class="v">${f(tnk)} mg</span><span class="s">0.25 mg/kg, 5초 단회 볼루스${tnk>=25?' · 최대 25 mg':''}. 미국 허가는 15~25 mg 체중 구간표</span></div>
   <div class="dose warnb"><span class="k">테넥테플라제 · STEMI</span><span class="v">${tS} mg</span><span class="s">체중 구간 단회 볼루스. 같은 체중의 뇌졸중 용량과 다름</span></div>
   <div class="dose"><span class="k">알테플라제 · STEMI 가속 요법</span><span class="v">${f(accT)} mg</span><span class="s">15 mg 볼루스 → ${f(accel.a)} mg/30분 → ${f(accel.b)} mg/60분</span></div>
   <div class="dose"><span class="k">알테플라제 · 고위험 PE</span><span class="v">100 mg</span><span class="s">2시간 지속 주입, 체중 무관</span></div>`;
}
$('#wt').addEventListener('input',renderDose);

// ---- 근거 목록 ----
function renderRefs(){
  $('#refList').innerHTML=Object.entries(SRC).map(([k,s])=>`<li id="ref-${k}">${s.u?`<a href="${s.u}" target="_blank" rel="noopener">${esc(s.t)}</a>`:esc(s.t)}</li>`).join('');
}

// ---- 루프 ----
let lastTs=0;
function frame(ts){
  const dt=lastTs?Math.min(0.05,(ts-lastTs)/1000):0;lastTs=ts;
  if(running&&visible){let sim=dt*speed;const h=1/60;while(sim>1e-6){const d=Math.min(h,sim);step(d);sim-=d;}}
  if(visible)drawScene();
  if(ts-lastUI>120){lastUI=ts;uiTick();}
  if(ts-lastAlert>600){lastAlert=ts;updateAlerts(false);}
  requestAnimationFrame(frame);
}
function boot(){
  cv=$('#cv');ctx=cv.getContext('2d');readColors();
  buildDrugPanel();buildMap();renderRefs();renderDose();
  setScenario('normal');renderCards();renderDetail();showNode(selNode);updateMapActive();
  resizeCanvas();
  new ResizeObserver(()=>{resizeCanvas();drawScene();}).observe(cv.parentElement);
  const mq=matchMedia('(prefers-color-scheme: dark)');const rc=()=>{readColors();drawScene();};
  mq.addEventListener?mq.addEventListener('change',rc):mq.addListener(rc);
  new MutationObserver(rc).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  if('IntersectionObserver' in window)new IntersectionObserver(es=>{visible=es[0].isIntersecting;},{threshold:0}).observe(cv.parentElement);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){for(let i=0;i<60*18;i++)step(1/60);togglePlay(false);}
  else togglePlay(true);
  uiTick();drawScene();updateAlerts(true);
  requestAnimationFrame(frame);
}
boot();
