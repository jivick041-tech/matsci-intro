/* 材料科學與工程導論｜修仙練功系統（講義與 3D 教具共用）
   修為・境界・心魔・每日任務・連續天數・法寶丹藥・排行榜。資料存在本機並依學號同步到老師的 Apps Script。
   修為 = 累積修為 xp − 走火入魔造成的損耗 lost；xp 只增不減（伺服器以此防止舊裝置覆蓋）。 */
(function(){
"use strict";
const SAVE_URL="https://script.google.com/macros/s/AKfycbxdty7M2R94i6-U_0SKF-ca8I1tQ-ROGE60gInag7uyXEYP-uLg_hzRAgEi5BRMfxsYjg/exec";
const GKEY="matsci-game-v1",WBKEY="matsci-wb-v4";
const ONLINE=/^https?:$/.test(location.protocol);
const DAY_CAP=150;               /* 每天可得修為上限（作答＋任務＋登入），避免臨時抱佛腳一天衝完 */
const IDLE_GRACE=2;              /* 連續沒上線 2 天內不罰，第 3 天起才長心魔 */
const ACTIVE_XP=20;              /* 一天至少拿到這麼多經驗值才算「有練習」 */

/* ---------- 等級與稱號 ---------- */
const MAXLV=30;
const need=L=>40+20*L;           /* 從 Lv L 升到 L+1 需要的經驗值 */
function lvOf(xp){let L=1,r=xp;while(L<MAXLV&&r>=need(L)){r-=need(L);L++}return{lv:L,into:r,next:L<MAXLV?need(L):0}}
const REALMS=["練氣期","築基期","金丹期","元嬰期","化神期","煉虛期","合體期","大乘期","渡劫期","真仙境"],STAGES=["初期","中期","後期"];
const realmIdx=lv=>Math.floor((lv-1)/3);
const titleOf=lv=>lv>=MAXLV?"飛升真仙":REALMS[realmIdx(lv)]+"・"+STAGES[(lv-1)%3];
const cumTo=L=>{let c=0;for(let k=1;k<L;k++)c+=need(k);return c};   /* 到達 Lv L 所需的總修為 */
/* 心魔：0–100。門檻、名稱、圖示、顏色、修為獲得倍率 */
const DEM=[[0,"道心澄明","☯️","#2f8a57",1],[30,"心魔滋生","🌫️","#b08900",.8],[60,"走火入魔","🔥","#c0392b",.6],[90,"墮入魔道","😈","#7b1fa2",.5]];
const demOf=d=>DEM.filter(x=>d>=x[0]).pop();
const WRONG_DEM=3,WRONG_CAP=5,IDLE_DEM=12,RIGHT_HEAL=2;

/* ---------- 法寶（收藏）---------- */
const RAR={c:["普通","#7b8794"],r:["稀有","#2f6fb3"],e:["史詩","#8a4fc4"],l:["傳說","#c98a12"]};
const ITEMS=[
 ["cu","純銅導線","c","⚡","Cu 是 FCC，a = 0.3615 nm。最密堆積方向 ⟨110⟩，延展性極佳，是導線的首選。"],
 ["fe","α-鐵小方塊","c","🧊","室溫的鐵是 BCC（a = 0.2866 nm），912 °C 以上變成 FCC 的 γ-鐵。"],
 ["nacl","岩鹽晶體","c","🧂","NaCl：Cl⁻ 排成 FCC，Na⁺ 填滿八面體位置，配位數 6。"],
 ["sio2","石英砂","c","⏳","SiO₄ 四面體共用全部 4 個頂點氧，形成三維網路的 SiO₂。"],
 ["gr","石墨筆芯","c","✏️","石墨層內是 sp² 共價鍵、層間是凡得瓦力，所以寫字時一層層剝落在紙上。"],
 ["brass","黃銅鈕扣","c","🟡","Zn 取代 Cu 的位置形成取代型固溶體，比純銅更硬。"],
 ["al","鋁箔","c","🥫","Al 是 FCC，表面自然生成一層緻密的 Al₂O₃ 保護膜。"],
 ["mg","鎂合金片","c","🪶","Mg 是 HCP，c/a ≈ 1.624，很輕但室溫下滑移系統少、較難變形。"],
 ["burg","布格向量指南針","r","🧭","刃差排：b ⊥ 差排線；螺旋差排：b ∥ 差排線。"],
 ["miller","米勒指數羅盤","r","📐","截距取倒數、化成最小整數；立方晶系中 [hkl] ⊥ (hkl)。"],
 ["steel","碳鋼刀刃","r","🔪","碳原子塞進鐵的八面體間隙，撐開晶格、阻礙差排移動，讓鋼變硬。"],
 ["caf2","螢石稜鏡","r","🔷","CaF₂：Ca²⁺ 配位數 8、F⁻ 配位數 4，透光範圍很寬，可做光學元件。"],
 ["ag","標準銀湯匙","r","🥄","純銀太軟，加 7.5% 銅成為 92.5% 的 sterling silver，強度提高很多。"],
 ["scope","金相顯微鏡","r","🔬","拋光、蝕刻後，晶界因為凹槽把光反射開而成為暗線。"],
 ["si","零缺陷單晶矽","e","💠","鑽石立方結構，幾乎沒有晶界與差排，是積體電路的基礎。"],
 ["bto","鈦酸鋇壓電片","e","🎵","鈣鈦礦 BaTiO₃：Ti⁴⁺ 在體心、O²⁻ 在面心，受壓會產生電壓。"],
 ["spinel","尖晶石寶石","e","💎","MgAl₂O₄：Mg²⁺ 在四面體位置、Al³⁺ 在八面體位置。"],
 ["twin","退火雙晶銅片","e","🪞","FCC 金屬退火後常出現雙晶：界面兩側原子互為鏡像。"],
 ["dia","鑽石原石","l","💍","每個碳以 sp³ 鍵結 4 個碳，APF 只有 0.34，卻是最硬的天然材料。"],
 ["gphn","石墨烯薄膜","l","🕸️","單層石墨，只有一個原子厚，導電、導熱與強度都非常優異。"],
 ["sx","單晶渦輪葉片","l","🛩️","鎳基超合金做成單晶，沒有晶界，在高溫下也不容易潛變。"]
];
/* ---------- 丹藥與符籙（可使用的道具）---------- */
const TOOLS={
 qingxin:["清心丹","🍵","c","回血：心魔 −30。"],
 tianji:["天機卷","📜","c","指引：帶你到目前最弱的觀念區，並護住下一次答錯（不生心魔）。"],
 juling:["聚靈陣","🌀","r","接下來答對的 5 題，修為加倍。"],
 biguan:["閉關符","🧘","r","自動使用：連續沒上線超過 2 天時，抵銷一天的心魔。"],
 pojing:["破境丹","💊","e","立即提升一個小境界（不受心魔阻擋）。"]
};
const TOOLW=[["qingxin",35],["tianji",25],["juling",20],["biguan",12],["pojing",8]];
const POOL={c:[],r:[],e:[],l:[]};ITEMS.forEach(it=>POOL[it[2]].push(it[0]));
const itemById=id=>ITEMS.find(x=>x[0]===id);

/* ---------- 每日任務 ---------- */
const QUESTS={
 ans5:["答對 5 題（任何章節）",5],
 first3:["第一次就答對 3 題",3],
 prac1:["答對 1 題實力加強區的題目",1],
 vocab3:["把 3 個單字標成「已熟記」",3],
 miller3:["在 3D 米勒指數教具答對 3 題",3],
 weak2:["在觀念區「{z}」答對 2 題",2],
 time10:["專注練習 10 分鐘",600],
 review2:["重做並答對 2 題以前答錯過的題目",2]
};
const QREWARD=20,QALL=30;

/* ---------- 狀態 ---------- */
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const dayDiff=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5);
function blank(){return{v:2,sid:"",nick:"",xp:0,lost:0,demon:0,aw:{},items:{},tools:{qingxin:1,tianji:1,biguan:1,juling:0,pojing:0},streak:0,best:0,lastActive:"",activeDays:0,day:null,cata:0,shield:false,ver:0}}
const eff=()=>Math.max(0,G.xp-(G.lost||0));
function migrate(){if(G.v===2)return;const t=G.tools||{};G.tools={qingxin:1,tianji:(t.anneal||0)+1,biguan:t.freeze||0,juling:t.cata||0,pojing:0};G.lost=G.lost||0;G.demon=G.demon||0;G.shield=false;G.v=2}
let G=blank();
function readWB(){try{return JSON.parse(localStorage.getItem(WBKEY)||"{}")||{}}catch(e){return{}}}
function wbProg(){const s=readWB();return(s&&s.prog)||{}}
function load(){try{const all=JSON.parse(localStorage.getItem(GKEY)||"{}");const sid=wbProg().sid||"";G=Object.assign(blank(),(all[sid]||all[""]||{}));G.sid=sid;migrate()}catch(e){G=blank()}}
function store(){try{const all=JSON.parse(localStorage.getItem(GKEY)||"{}")||{};all[G.sid||""]=G;localStorage.setItem(GKEY,JSON.stringify(all))}catch(e){}}

/* ---------- 亂數（每日任務依學號與日期固定，跨裝置相同） ---------- */
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rnd(seed){let a=seed||1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

let ctx={weak:null,miller:true};let pendingNotice=null;      /* 由頁面提供：最弱觀念區、是否可用 3D 教具 */
function ensureDay(){
  const t=today();
  if(G.day&&G.day.d===t)return;
  /* 連續天數結算 */
  const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const yest=(()=>{const d=new Date(t+"T12:00:00");d.setDate(d.getDate()-1);return ymd(d)})();
  if(G.lastActive&&G.lastActive<t){
    /* 上次有練功之後、到昨天為止，完全沒練功的天數（已結算過的不重算） */
    const start=(G.settled&&G.settled>G.lastActive)?G.settled:G.lastActive;
    const missed=Math.min(30,Math.max(0,dayDiff(start,t)-1));
    const off=dayDiff(G.lastActive,start);   /* 這段空窗中，已結算過的天數 */
    if(missed>0){let used=0,dem=0,loss=0,pen=0;
      for(let i=0;i<missed;i++){
        if(off+i+1<=IDLE_GRACE)continue;      /* 寬限期 */
        pen++;
        if((G.tools.biguan||0)>0){G.tools.biguan--;used++;continue}
        const b=G.demon||0;G.demon=Math.min(100,b+IDLE_DEM);dem+=G.demon-b;
        if(G.demon>=60){const l=Math.max(5,Math.round(eff()*(G.demon>=90?.06:.03)));const real=Math.min(l,eff());G.lost=(G.lost||0)+real;loss+=real}
      }
      G.streak=0;
      if(pen>0)pendingNotice={missed:off+missed,used,pen,dem,loss};
    }
    G.settled=yest;
  }
  const r=rnd(hash((G.sid||"anon")+t));const keys=Object.keys(QUESTS).filter(k=>k!=="weak2"||ctx.weak);
  const pick=[];const must=["ans5","first3","prac1"];pick.push(must[Math.floor(r()*must.length)]);
  while(pick.length<3){const k=keys[Math.floor(r()*keys.length)];if(!pick.includes(k)&&!(must.includes(k)&&pick.some(p=>must.includes(p))&&r()<.5))pick.push(k)}
  G.day={d:t,xp:0,cap:0,q:pick.map(k=>({k,n:0,done:false,z:k==="weak2"?ctx.weak:null})),all:false,login:false,active:false,mill:0};
  store();
}

/* ---------- 經驗值 ---------- */
let ui=null;
function gain(x,why,{capped=true,silent=false,force=false}={}){
  ensureDay();if(x<=0)return 0;
  if(!force){const m=demOf(G.demon||0)[4];if(m<1)x=Math.max(1,Math.round(x*m))}
  if(capped){const room=DAY_CAP-G.day.cap;if(room<=0){if(!G.day.capMsg){G.day.capMsg=1;celebrate("🌙 今日修為已滿","今天已經得到 "+DAY_CAP+" 修為的上限。今天再寫的題目仍然會記錄在練習簿，但不再加修為——把還沒寫的題目留到明天，修為才不會浪費！","n")}return 0}x=Math.min(x,room);G.day.cap+=x}
  const before=lvOf(eff()).lv;
  if(!force&&(G.demon||0)>=60&&before<MAXLV){const nextRealm=(realmIdx(before)+1)*3+1;const wall=cumTo(nextRealm)-1;if(eff()+x>wall){x=Math.max(0,wall-eff());if(!G.day.wallMsg){G.day.wallMsg=1;setTimeout(()=>celebrate("⛓️ 道心不穩，無法突破","心魔 ≥ 60 時無法突破到「"+REALMS[realmIdx(nextRealm)]+"」。多答對題目、完成任務，或服用清心丹降低心魔；破境丹可以強行突破。","n"),300)}}}
  G.xp+=x;G.day.xp+=x;G.ver++;
  if(!G.day.active&&((G.day.cap-(G.day.loginX||0))>=ACTIVE_XP||G.day.q.some(q=>q.done))){G.day.active=true;markActive()}
  if(!silent&&x>0)toast("+"+x+" 修為"+(why?"　"+why:""),"xp");
  const after=lvOf(eff()).lv;if(after>before){for(let L=before+1;L<=after;L++)levelUp(L)}
  store();sync();render();return x;
}
function demonChange(d,why){const b=G.demon||0;G.demon=Math.max(0,Math.min(100,b+d));if(G.demon===b)return;const sb=demOf(b),sa=demOf(G.demon);
  if(d>0&&why)toast("💢 心魔 +"+(G.demon-b)+"　"+why,"bad");
  if(sa!==sb){if(G.demon>b)celebrate(sa[2]+" "+sa[1],sa[0]>=90?"你已墮入魔道！修為獲得減半，久未練功還會倒退。多答對題目、完成每日任務，或服用清心丹，才能重回正道。":sa[0]>=60?"走火入魔：修為獲得 ×0.6，而且無法突破大境界。快用答對的題目與清心丹穩住道心。":"心魔滋生：修為獲得 ×0.8。答對題目、完成任務可以慢慢化解。","e");
    else toast(sa[2]+" 心魔消退："+sa[1],"xp")}
  store();sync();render()}
function markActive(){const t=today();if(G.lastActive===t)return;const gap=G.lastActive?dayDiff(G.lastActive,t):99;G.streak=gap===1?G.streak+1:1;G.best=Math.max(G.best,G.streak);G.lastActive=t;G.activeDays=(G.activeDays||0)+1;
  if(G.streak>1)toast("🔥 連續 "+G.streak+" 天！","streak")}
function levelUp(L){if(L>=MAXLV){celebrate("🌈 飛升成仙！","你已修成「飛升真仙」，是材料科學的大成者。","l");return}
  if((L-1)%3===0)celebrate("⚡ 突破境界！"+REALMS[realmIdx(L)],"恭喜突破到「"+titleOf(L)+"」。"+(realmIdx(L)>=6?"離飛升不遠了！":"繼續修煉，下一個境界是「"+REALMS[realmIdx(L)+1]+"」。"),realmIdx(L)>=6?"l":realmIdx(L)>=3?"e":"r");
  else toast("✨ 修為精進："+titleOf(L),"xp")}

/* ---------- 掉寶 ---------- */
function rollRarity(min){const r=Math.random()*100;let k=r<2?"l":r<10?"e":r<35?"r":"c";const order="crel";if(min&&order.indexOf(k)<order.indexOf(min))k=min;return k}
function drop(min,source){
  ensureDay();
  if(Math.random()<.35&&!min||min&&Math.random()<.4){let r=Math.random()*100,tk="qingxin";for(const[k,w]of TOOLW){if(r<w){tk=k;break}r-=w}G.tools[tk]=(G.tools[tk]||0)+1;const T=TOOLS[tk];celebrate(T[1]+" 獲得："+T[0],T[3],T[2]);store();sync();render();return}
  const rar=rollRarity(min);const id=POOL[rar][Math.floor(Math.random()*POOL[rar].length)];const it=itemById(id);
  const cur=G.items[id]||0;
  if(cur>=3){gain(10,"重複法寶化為修為",{capped:false});return}
  G.items[id]=cur+1;G.ver++;store();sync();render();
  celebrate(it[3]+" "+(cur?"法寶升星！":"獲得法寶！")+it[1],(cur?"★".repeat(cur+1)+"　":"")+it[4],rar,source);
}

/* ---------- 事件（頁面呼叫） ---------- */
function quest(k,inc=1,match){ensureDay();let changed=false;G.day.q.forEach(q=>{if(q.k!==k||q.done)return;if(match&&!match(q))return;q.n+=inc;changed=true;if(q.n>=QUESTS[q.k][1]){q.done=true;if(!G.day.active){G.day.active=true;markActive()}gain(QREWARD,"任務完成：「"+qText(q)+"」");demonChange(-5)}});
  if(changed&&!G.day.all&&G.day.q.every(q=>q.done)){G.day.all=true;gain(QALL,"今日任務全部完成！");demonChange(-10);setTimeout(()=>drop("r","寶箱"),900)}
  if(changed){store();render()}}
function qText(q){return QUESTS[q.k][0].replace("{z}",q.z?q.z.label:"")}
function dailyLogin(){ensureDay();if(G.day.login)return;G.day.login=true;G.day.loginX=0;const bonus=10+Math.min(20,2*(G.streak||0));G.day.loginX=gain(bonus,"今日上山修煉"+(G.streak?"（連續加成）":""))}

/* answer: {id, ok, first, practice, zone:{key,label}, wasWrong, kind:"open"|"auto"} */
function onAnswer(a){
  if(!a.ok)return;ensureDay();
  if(G.aw[a.id])return;
  const first=a.first;
  let x=a.kind==="open"?5:first?(a.practice?15:10):4;
  if(G.cata>0){x*=2;G.cata--}
  G.aw[a.id]=1;
  gain(x,first?"第一次就答對":"");demonChange(-RIGHT_HEAL);
  quest("ans5");if(first)quest("first3");if(a.practice)quest("prac1");if(a.wasWrong)quest("review2");
  if(a.zone)quest("weak2",1,q=>q.z&&q.z.key===a.zone.key);
  if(Math.random()<(first?.14:.07))setTimeout(()=>drop(null,"作答"),700);
}
function onWrong(a){ensureDay();a=a||{};if(a.id&&G.aw["w:"+a.id])return;if(a.id)G.aw["w:"+a.id]=1;if(G.shield){G.shield=false;toast("📜 天機卷護住了道心，這次答錯不生心魔","item");store();render();return}
  G.day.wrong=(G.day.wrong||0)+1;if(G.day.wrong>WRONG_CAP)return;demonChange(WRONG_DEM,"答錯了，回頭看提示與重點")}
function onMiller(ok,first){if(!ok)return;ensureDay();if(G.day.mill>=30)return;G.day.mill++;let x=first?6:2;if(G.cata>0){x*=2;G.cata--}gain(x,"3D 教具");demonChange(-1);quest("miller3");if(Math.random()<(first?.10:.04))setTimeout(()=>drop(null,"3D 教具"),700)}
function onVocab(){ensureDay();G.day.voc=(G.day.voc||0)+1;if(G.day.voc<=30)gain(1,"",{silent:true});quest("vocab3")}
function onTime(sec){ensureDay();quest("time10",sec)}
function onSelf(id){if(G.aw["s:"+id])return;G.aw["s:"+id]=1;gain(3,"自我評估")}
function onRate(id){if(G.aw["r:"+id])return;G.aw["r:"+id]=1;gain(5,"填寫學習回饋")}
function useTool(k){if(!(G.tools[k]>0))return;
  if(k==="qingxin"){if(!(G.demon>0)){toast("道心澄明，不需要清心丹","info");return}G.tools.qingxin--;demonChange(-30);toast("🍵 服下清心丹，心魔 −30","item")}
  else if(k==="juling"){G.tools.juling--;G.cata+=5;toast("🌀 聚靈陣啟動：接下來 5 題修為加倍","item")}
  else if(k==="tianji"){G.tools.tianji--;G.shield=true;const z=ctx.weak;if(openOv)openOv.remove();openOv=null;store();sync();render();
    modal(`<div class="gcele"><div class="gbig">📜</div><h3>天機指引</h3><p>${z?`你目前最弱的是<br><b>${esc(z.label)}</b>`:"你各個觀念區都練得不錯！挑一章的實力加強區挑戰看看。"}</p><p class="gsub">天機卷也護住了你的下一次答錯。</p>${z&&API.onGuide?`<button class="gbtn gok" data-gguide>前往修煉</button> `:""}<button class="gbtn gok" data-gclose>知道了</button></div>`);
    const gb=document.querySelector("[data-gguide]");if(gb)gb.onclick=()=>{gb.closest(".gov").remove();API.onGuide(z)};return}
  else if(k==="pojing"){const L=lvOf(eff()).lv;if(L>=MAXLV){toast("你已飛升，不需要破境丹","info");return}G.tools.pojing--;const need2=cumTo(L+1)-eff();gain(need2,"破境丹",{capped:false,force:true})}
  store();sync();render();openPanel("bag")}

/* ---------- 同步（JSONP 讀取、POST 儲存） ---------- */
let loadedFor=null,syncT=0,saving=false;
function jsonp(params,cb){if(!ONLINE){cb(null);return}const name="__mg"+Math.random().toString(36).slice(2);let done=false;const s=document.createElement("script");
  const fin=v=>{if(done)return;done=true;try{delete window[name]}catch(e){window[name]=undefined}s.remove();cb(v)};
  window[name]=v=>fin(v);s.src=SAVE_URL+"?"+Object.entries(params).map(([k,v])=>k+"="+encodeURIComponent(v)).join("&")+"&cb="+name;s.onerror=()=>fin(null);setTimeout(()=>fin(null),15000);document.head.appendChild(s)}
function merge(r){
  if(!r||typeof r!=="object")return;
  const base=(r.xp||0)>G.xp?Object.assign(blank(),r):G;const other=base===G?r:G;
  base.aw=Object.assign({},other.aw||{},base.aw||{});
  Object.entries(other.items||{}).forEach(([k,v])=>{base.items[k]=Math.max(base.items[k]||0,v)});
  base.lost=Math.max(base.lost||0,other.lost||0);base.best=Math.max(base.best||0,other.best||0);base.activeDays=Math.max(base.activeDays||0,other.activeDays||0);
  if((other.lastActive||"")>(base.lastActive||"")){base.lastActive=other.lastActive;base.streak=other.streak}
  if(!base.nick&&other.nick)base.nick=other.nick;
  if(other.day&&base.day&&other.day.d===base.day.d&&other!==base){base.day.q.forEach((q,i)=>{const o=other.day.q&&other.day.q[i];if(o&&o.k===q.k){q.n=Math.max(q.n,o.n);q.done=q.done||o.done}});base.day.all=base.day.all||other.day.all;base.day.login=base.day.login||other.day.login}
  if(base!==G&&G.day&&G.day.d===today()&&(!base.day||base.day.d!==today()))base.day=G.day;
  if(base!==G&&(G.settled||"")>(base.settled||"")){base.demon=Math.max(base.demon||0,G.demon||0);base.settled=G.settled}
  base.sid=G.sid;G=base;migrate();
}
function gload(){const sid=G.sid;if(!sid||!ONLINE){loadedFor=sid;afterLoad();return}jsonp({action:"gload",u:sid},txt=>{if(G.sid!==sid)return;if(txt){try{merge(JSON.parse(txt))}catch(e){}}loadedFor=sid;afterLoad();store();render();sync(true)})}
function afterLoad(){dailyLogin();const n=API.retroCount?API.retroCount():0;if(n>0&&!G.aw.retro){G.aw.retro=1;gain(n*4,"既有進度回溯獎勵（"+n+" 題）",{capped:false})}showNotice()}
function showNotice(){if(!pendingNotice||!document.body)return;const n=pendingNotice;pendingNotice=null;if(n.used===n.pen){toast("🧘 閉關符抵銷了 "+n.used+" 天沒練功的心魔","item");return}
  celebrate("🌫️ 久未修煉，心魔滋生","你已經 "+n.missed+" 天沒有練功（超過 "+IDLE_GRACE+" 天才開始長心魔）"+(n.used?"（閉關符抵銷了 "+n.used+" 天）":"")+"，心魔 +"+n.dem+(n.loss?"，修為倒退 "+n.loss:"")+"。今天答對題目、完成任務就能化解。","n")}
function sync(now){clearTimeout(syncT);syncT=setTimeout(push,now?50:4000)}
function push(){const p=wbProg();if(!ONLINE||!G.sid||!p.sname||loadedFor!==G.sid||saving)return;const L=lvOf(eff()).lv;saving=true;const st=demOf(G.demon||0);
  const body={kind:"game",sid:G.sid,sname:p.sname,nick:G.nick,lv:L,title:(G.demon>=60?"入魔・":"")+titleOf(L)+"｜心魔"+(G.demon||0),xp:G.xp,streak:G.streak,best:G.best,days:G.activeDays||0,items:Object.keys(G.items).length+" / "+ITEMS.length,data:JSON.stringify(G)};
  fetch(SAVE_URL,{method:"POST",mode:"no-cors",keepalive:true,credentials:"omit",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body)}).then(()=>{saving=false},()=>{saving=false;sync()})}
addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")push()});

/* ---------- 介面 ---------- */
const css=`
.gbar{grid-column:1/-1;width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0 4px;padding:10px 12px;border:1.5px solid var(--g-line);border-radius:10px;background:var(--g-bg);font-size:.88rem;color:var(--g-ink)}
.gbar .lvb{display:flex;align-items:center;justify-content:center;min-width:46px;height:46px;border-radius:50%;background:var(--g-acc);color:#fff;font-weight:800;font-size:.95rem;line-height:1;flex-direction:column}
.gbar .lvb small{font-size:.62rem;font-weight:600;opacity:.9}
.gbar .gmid{flex:1;min-width:150px}.gbar .gt{font-weight:700}.gbar .gsub{color:var(--g-mut);font-size:.78rem}
.gbar .xpb{height:7px;border-radius:4px;background:var(--g-line);margin-top:5px;overflow:hidden}.gbar .xpb i{display:block;height:100%;background:var(--g-acc);transition:width .5s}
.gbar .gst{font-weight:700;white-space:nowrap}
.gbar .gbtns{display:flex;gap:6px;flex-wrap:wrap}
.gbtn{font:inherit;font-size:.82rem;padding:6px 10px;border-radius:999px;border:1.5px solid var(--g-line);background:var(--g-card);color:var(--g-ink);cursor:pointer;white-space:nowrap}
.gbtn:hover{border-color:var(--g-acc)}.gbtn:focus-visible{outline:2px solid var(--g-acc);outline-offset:2px}
.gbtn .dot{display:inline-block;min-width:16px;padding:0 4px;border-radius:8px;background:var(--g-acc);color:#fff;font-size:.7rem;margin-left:4px}
.gtoast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}
.gtoast div{background:var(--g-ink);color:var(--g-card);padding:7px 14px;border-radius:999px;font-size:.86rem;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.18);animation:gup 2.6s ease forwards}
.gtoast div.xp{background:var(--g-acc);color:#fff}
@keyframes gup{0%{opacity:0;transform:translateY(10px)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0;transform:translateY(-14px)}}
.gov{position:fixed;inset:0;z-index:9998;background:rgba(10,16,22,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.gcard{background:var(--g-card);color:var(--g-ink);border-radius:14px;max-width:560px;width:100%;max-height:86vh;overflow:auto;padding:20px 20px 16px;box-shadow:0 20px 50px rgba(0,0,0,.3)}
.gcard h3{margin:0 0 4px;font-size:1.15rem}.gcard .gsub{color:var(--g-mut);font-size:.85rem;margin-bottom:12px}
.gcard .gx{float:right;font:inherit;border:0;background:none;font-size:1.3rem;cursor:pointer;color:var(--g-mut)}
.gq{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--g-line)}.gq:first-of-type{border-top:0}
.gq .gc{width:24px;height:24px;border-radius:50%;border:2px solid var(--g-line);display:flex;align-items:center;justify-content:center;font-size:.8rem;flex:none}
.gq.done .gc{background:var(--g-ok);border-color:var(--g-ok);color:#fff}
.gq .gqt{flex:1}.gq .gqb{height:5px;background:var(--g-line);border-radius:3px;margin-top:4px;overflow:hidden}.gq .gqb i{display:block;height:100%;background:var(--g-acc)}
.gq .gqr{font-size:.78rem;color:var(--g-mut);white-space:nowrap}
.ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}
.gitem{border:1.5px solid var(--g-line);border-radius:10px;padding:8px;text-align:center;font-size:.78rem;background:var(--g-bg);cursor:pointer;color:inherit;font-family:inherit}
.gitem .ge{font-size:1.7rem;line-height:1.3}.gitem b{display:block;font-size:.82rem}.gitem.lock{opacity:.45;cursor:default}.gitem.lock .ge{filter:grayscale(1)}
.gitem .gr{font-size:.7rem;font-weight:700}
.gdesc{margin-top:10px;padding:10px;border-radius:8px;background:var(--g-bg);font-size:.85rem;min-height:40px}
.gtb{width:100%;border-collapse:collapse;font-size:.88rem}.gtb td,.gtb th{padding:7px 6px;border-bottom:1px solid var(--g-line);text-align:left}.gtb th{color:var(--g-mut);font-weight:600;font-size:.78rem}
.gtb tr.me td{font-weight:700;color:var(--g-acc)}
.gin{font:inherit;padding:7px 10px;border:1.5px solid var(--g-line);border-radius:8px;background:var(--g-card);color:var(--g-ink);width:12em}
.gcele{text-align:center}.gcele .gbig{font-size:3rem;line-height:1.2;margin:6px 0}.gcele h3{font-size:1.25rem}
.gcele .grar{display:inline-block;padding:2px 10px;border-radius:999px;color:#fff;font-size:.78rem;font-weight:700;margin:4px 0}
.gcele .gok{margin-top:14px}
.gtools{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}.gtool{display:flex;gap:10px;align-items:center;padding:8px 10px;border:1.5px solid var(--g-line);border-radius:10px}
.gtool .ge{font-size:1.5rem}.gtool .gtt{flex:1;font-size:.84rem}.gtool b{font-size:.9rem}
.dem{min-width:130px}.dem .dl{font-size:.76rem;font-weight:700;display:flex;justify-content:space-between;gap:6px}.dem .db{height:7px;border-radius:4px;background:var(--g-line);margin-top:4px;overflow:hidden}.dem .db i{display:block;height:100%;transition:width .5s}
.gbar.evil{border-color:#c0392b;background:linear-gradient(90deg,rgba(192,57,43,.08),var(--g-bg))}.gbar.abyss{border-color:#7b1fa2;background:linear-gradient(90deg,rgba(123,31,162,.12),var(--g-bg))}
.gbar .lvb.r{font-size:.8rem}.gbar .lvb.evil{background:#c0392b}.gbar .lvb.abyss{background:#7b1fa2}
.gtoast div.bad{background:#7b1fa2;color:#fff}
.grule{font-size:.86rem;line-height:1.7}.grule h4{margin:12px 0 4px;font-size:.95rem}.grule ul{margin:0;padding-left:1.2em}
.grealm{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.grealm span{font-size:.75rem;padding:2px 8px;border-radius:999px;border:1px solid var(--g-line)}.grealm span.on{background:var(--g-acc);color:#fff;border-color:var(--g-acc)}
.gstars{color:#d39b12;letter-spacing:1px;font-size:.85em;margin-left:6px}
.gtabs{display:flex;gap:6px;margin:6px 0 12px;flex-wrap:wrap}
@media (prefers-reduced-motion: reduce){.gtoast div{animation:none}}
`;
function injectCSS(){if(document.getElementById("gcss"))return;const st=document.createElement("style");st.id="gcss";
  st.textContent=`:root{--g-bg:#f5f7f9;--g-card:#fff;--g-ink:#18232b;--g-mut:#5f6b75;--g-line:#d7dee4;--g-acc:#c4561d;--g-ok:#2f8a57}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--g-bg:#1c252c;--g-card:#151d23;--g-ink:#e8edf1;--g-mut:#9aa7b1;--g-line:#33414b;--g-acc:#e07a3f;--g-ok:#47a874}}
:root[data-theme="dark"]{--g-bg:#1c252c;--g-card:#151d23;--g-ink:#e8edf1;--g-mut:#9aa7b1;--g-line:#33414b;--g-acc:#e07a3f;--g-ok:#47a874}`+css;document.head.appendChild(st)}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let toastBox=null;
function toast(msg,kind){if(!document.body)return;if(!toastBox){toastBox=document.createElement("div");toastBox.className="gtoast";toastBox.setAttribute("aria-live","polite");document.body.appendChild(toastBox)}while(toastBox.children.length>=3)toastBox.firstChild.remove();const d=document.createElement("div");d.className=kind||"";d.textContent=msg;toastBox.appendChild(d);setTimeout(()=>d.remove(),2700)}
const celeQ=[];let celeOn=false;
function celebrate(title,body,rar,source){celeQ.push([title,body,rar,source]);if(!celeOn)nextCele()}
function nextCele(){const c=celeQ.shift();if(!c){celeOn=false;return}celeOn=true;const[title,body,rar]=c;const R=RAR[rar]||RAR.c;const m=title.match(/^(\S+)\s(.*)$/u);const icon=m&&/\p{Extended_Pictographic}/u.test(m[1])?m[1]:"⭐";const t=m&&icon!=="⭐"?m[2]:title;
  const ov=modal(`<div class="gcele"><div class="gbig">${icon}</div><h3>${esc(t)}</h3>${rar==="n"?"":`<span class="grar" style="background:${R[1]}">${R[0]}</span>`}<p>${esc(body)}</p><button class="gbtn gok" data-gclose>${rar==="n"?"知道了":"收下"}</button></div>`,()=>setTimeout(nextCele,150))}
function modal(html,onClose){const ov=document.createElement("div");ov.className="gov";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");ov.innerHTML=`<div class="gcard">${html}</div>`;
  const close=()=>{ov.remove();onClose&&onClose()};ov.addEventListener("click",e=>{if(e.target===ov||e.target.closest("[data-gclose]"))close()});ov.addEventListener("keydown",e=>{if(e.key==="Escape")close()});document.body.appendChild(ov);const f=ov.querySelector("button,input");f&&f.focus();return ov}

function barHTML(){const s=lvOf(eff()),t=titleOf(s.lv);ensureDay();const left=G.day.q.filter(q=>!q.done).length;const d=G.demon||0,st=demOf(d);const ev=d>=90?"abyss":d>=60?"evil":"";
  const rn=s.lv>=MAXLV?"飛升":REALMS[realmIdx(s.lv)].slice(0,2),sg=s.lv>=MAXLV?"":STAGES[(s.lv-1)%3].slice(0,1);
  return `<div class="lvb r ${ev}" aria-label="境界 ${t}"><small>${sg}</small>${rn}</div>
   <div class="gmid"><div class="gt">${esc(G.nick||"（尚未取道號）")}・${d>=60?"入魔・":""}${t}</div><div class="gsub">${s.next?`修為 ${s.into} / ${s.next}`:"已飛升"}・今日 ${Math.min(G.day.cap,DAY_CAP)} / ${DAY_CAP}・累積 ${G.xp}${G.lost?`（損耗 ${G.lost}）`:""}${G.cata?`・🌀 加倍剩 ${G.cata} 題`:""}${G.shield?"・📜 護心中":""}</div><div class="xpb"><i style="width:${s.next?(s.into/s.next*100).toFixed(1):100}%"></i></div></div>
   <div class="dem" title="心魔：答錯、久未練功會增加；答對、完成任務、清心丹會降低"><div class="dl"><span>${st[2]} ${st[1]}</span><span>心魔 ${d}</span></div><div class="db"><i style="width:${d}%;background:${st[3]}"></i></div></div>
   <div class="gst" title="連續練功天數">🔥 ${G.streak||0} 天</div>
   <div class="gbtns"><button class="gbtn" data-gp="quest">📋 每日任務${left?`<span class="dot">${left}</span>`:" ✓"}</button><button class="gbtn" data-gp="bag">🎒 法寶丹藥</button><button class="gbtn" data-gp="board">🏆 排行榜</button><button class="gbtn" data-gp="rule" aria-label="修煉規則">❓</button></div>`}
let bars=[];
function mount(el){injectCSS();const b=document.createElement("div");b.className="gbar";el.parentNode.insertBefore(b,el.nextSibling);bars.push(b);b.addEventListener("click",e=>{const x=e.target.closest("[data-gp]");if(x)openPanel(x.dataset.gp)});render()}
function render(){bars.forEach(b=>{const d=G.demon||0;b.classList.toggle("evil",!!G.sid&&d>=60&&d<90);b.classList.toggle("abyss",!!G.sid&&d>=90);if(!G.sid){b.innerHTML=`<div class="gmid"><div class="gt">⛰️ 登入後開始修煉：答對題目累積修為、突破境界</div><div class="gsub">輸入學號與姓名，境界會跟著學號在手機與電腦之間同步。</div></div><button class="gbtn" data-glogin>登入</button>`;const l=b.querySelector("[data-glogin]");l.onclick=()=>API.onLoginRequest?API.onLoginRequest():loginModal();return}b.innerHTML=barHTML()})}
let openOv=null;
function openPanel(which){if(openOv)openOv.remove();ensureDay();let h="";
  if(which==="quest"){const done=G.day.q.filter(q=>q.done).length;
    h=`<button class="gx" data-gclose aria-label="關閉">×</button><h3>📋 今日任務</h3><div class="gsub">${G.day.d}・每個任務 +${QREWARD} 修為、心魔 −5；全部完成再 +${QALL} 修為、心魔 −10，並開啟寶箱</div>`+
      G.day.q.map(q=>{const goal=QUESTS[q.k][1],n=Math.min(q.n,goal),isT=q.k==="time10";return `<div class="gq${q.done?" done":""}"><div class="gc">${q.done?"✓":""}</div><div class="gqt">${esc(qText(q))}<div class="gqb"><i style="width:${n/goal*100}%"></i></div></div><div class="gqr">${isT?Math.floor(n/60)+" / 10 分":n+" / "+goal}</div></div>`}).join("")+
      `<div class="gsub" style="margin-top:10px">${done===3?"🎉 今天的任務都完成了，明天再來！":"任務每天午夜更新。"}連續練功 🔥 ${G.streak||0} 天（最長 ${G.best||0} 天）。一天至少得到 ${ACTIVE_XP} 修為才算有練功，沒練功的日子心魔會增加。</div>`}
  if(which==="bag"){const got=ITEMS.filter(i=>G.items[i[0]]).length;
    h=`<button class="gx" data-gclose aria-label="關閉">×</button><h3>🎒 法寶與丹藥</h3><div class="gsub">丹藥與符籙可以使用；法寶是收藏，已收集 ${got} / ${ITEMS.length}，重複獲得會升星（最多 ★★★）。答對題目、完成任務都有機會掉落。</div>
     <div class="gtools">${Object.entries(TOOLS).map(([k,T])=>`<div class="gtool"><span class="ge">${T[1]}</span><div class="gtt"><b>${T[0]} × ${G.tools[k]||0}</b><br>${T[3]}</div>${k==="biguan"?`<span class="gsub" style="margin:0">自動使用</span>`:`<button class="gbtn" data-guse="${k}" ${G.tools[k]>0?"":"disabled"}>使用</button>`}</div>`).join("")}</div>
     <div class="ggrid">${ITEMS.map(i=>{const n=G.items[i[0]]||0,R=RAR[i[2]];return n?`<button class="gitem" data-gi="${i[0]}" style="border-color:${R[1]}"><div class="ge">${i[3]}</div><b>${esc(i[1])}</b><span class="gr" style="color:${R[1]}">${R[0]} ${"★".repeat(n)}</span></button>`:`<div class="gitem lock"><div class="ge">❔</div><b>？？？</b><span class="gr" style="color:${R[1]}">${R[0]}</span></div>`}).join("")}</div><div class="gdesc" id="gdesc">點法寶看說明。</div>`}
  if(which==="board"){h=`<button class="gx" data-gclose aria-label="關閉">×</button><h3>🏆 修仙榜</h3><div class="gsub">依累積修為排名，只顯示道號（暱稱）。</div>
     <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><label for="gnick">我的道號</label><input id="gnick" class="gin" maxlength="12" value="${esc(G.nick||"")}" placeholder="最多 12 字"><button class="gbtn" id="gnsave">儲存</button><span class="gsub" id="gnmsg" style="margin:0"></span></div>
     <div id="gboard">${ONLINE?"讀取中…":"排行榜需要連上網路。"}</div>`}
  if(which==="rule"){const L=lvOf(eff()).lv;h=`<button class="gx" data-gclose aria-label="關閉">×</button><h3>📜 修煉規則</h3><div class="grule">
    <h4>⛰️ 修仙之路（加分）</h4><ul><li>答對題目得到修為：第一次就答對 +10、實力加強區 +15、重試才答對 +4、3D 教具 +6。</li><li>每日任務每個 +${QREWARD}，全部完成再 +${QALL} 並開寶箱。每天第一次上山另有登入加成，連續天數越多越高。</li><li>修為累積到一定程度就升一個小境界；每 3 個小境界突破一個大境界：</li></ul>
    <div class="grealm">${REALMS.map((r,i)=>`<span class="${realmIdx(L)===i?"on":""}">${r}</span>`).join("")}<span class="${L>=MAXLV?"on":""}">飛升</span></div>
    <h4>😈 成魔之路（扣分）</h4><ul><li>答錯一題（每題只算第一次）心魔 +${WRONG_DEM}，每天最多 +${WRONG_DEM*WRONG_CAP}。</li><li>連續 ${IDLE_GRACE} 天沒上線不會扣；從第 ${IDLE_GRACE+1} 天起，每多一天沒練功心魔 +${IDLE_DEM}（閉關符可抵銷一天）。</li><li>心魔 30 以上「心魔滋生」：修為獲得 ×0.8。</li><li>心魔 60 以上「走火入魔」：修為獲得 ×0.6、無法突破大境界，而且每天沒練功修為倒退 3%。</li><li>心魔 90 以上「墮入魔道」：修為獲得 ×0.5，每天沒練功修為倒退 6%。</li></ul>
    <h4>☯️ 化解心魔</h4><ul><li>每答對一題心魔 −${RIGHT_HEAL}；完成一個每日任務 −5，全部完成再 −10。</li><li>🍵 清心丹：心魔 −30。📜 天機卷：指引最弱的觀念區，並護住下一次答錯。</li><li>🧘 閉關符：沒上線第 3 天起自動使用，抵銷一天心魔。🌀 聚靈陣：接下來 5 題修為加倍。💊 破境丹：直接提升一個小境界。</li></ul>
    <p class="gsub" style="margin-top:10px">🌙 每天最多獲得 ${DAY_CAP} 修為（作答、任務、登入都算）。題目數量有限，一天寫完就沒了——每天寫一些，修為才會一直進帳。超過上限後作答仍會記錄在練習簿，只是不加修為。</p></div>`}
  openOv=modal(h,()=>{openOv=null});
  openOv.querySelectorAll("[data-guse]").forEach(b=>b.onclick=()=>useTool(b.dataset.guse));
  openOv.querySelectorAll("[data-gi]").forEach(b=>b.onclick=()=>{const it=itemById(b.dataset.gi);openOv.querySelector("#gdesc").innerHTML=`<b>${it[3]} ${esc(it[1])}</b>（${RAR[it[2]][0]} ${"★".repeat(G.items[it[0]])}）<br>${esc(it[4])}`});
  if(which==="board"){const sv=openOv.querySelector("#gnsave");sv.onclick=()=>{const v=openOv.querySelector("#gnick").value.trim().slice(0,12);G.nick=v;store();sync(true);render();openOv.querySelector("#gnmsg").textContent=v?"已儲存，排行榜稍後更新":"已清除"};
    if(ONLINE)jsonp({action:"board",u:G.sid||""},txt=>{const box=openOv&&openOv.querySelector("#gboard");if(!box)return;let d=null;try{d=JSON.parse(txt)}catch(e){}
      if(!d){box.textContent="暫時讀不到排行榜，稍後再試。";return}
      box.innerHTML=d.top.length?`<table class="gtb"><thead><tr><th>名次</th><th>道號・境界</th><th>累積修為</th><th>🔥</th></tr></thead><tbody>${d.top.map((r,i)=>`<tr class="${d.me===i+1?"me":""}"><td>${["🥇","🥈","🥉"][i]||i+1}</td><td>${esc(r.nick)}<br><span class="gsub" style="margin:0">${esc(String(r.title).replace(/｜心魔\d+$/,""))}${/入魔/.test(r.title)?" 🔥":""}</span></td><td>${r.xp}</td><td>${r.streak}</td></tr>`).join("")}</tbody></table><p class="gsub" style="margin-top:10px">${d.me?`你目前是第 ${d.me} 名（共 ${d.n} 人）。`:"你的紀錄還沒同步到排行榜，答幾題後再看看。"}</p>`:"還沒有人上榜，你可以當第一個！"})}
}

function loginModal(){const p=wbProg();const ov=modal(`<button class="gx" data-gclose aria-label="關閉">×</button><h3>登入</h3><div class="gsub">和講義使用同一組學號，境界與法寶會一起累積。</div>
  <div style="display:grid;gap:8px"><label>學號 <input id="glsid" class="gin" value="${esc(p.sid||"")}" autocomplete="off"></label><label>姓名 <input id="glsn" class="gin" value="${esc(p.sname||"")}" autocomplete="off"></label></div>
  <div class="gsub" id="glmsg" style="margin-top:8px"></div><button class="gbtn" id="glok">開始</button>`);
  const ok=()=>{const a=ov.querySelector("#glsid").value.trim().slice(0,30),b=ov.querySelector("#glsn").value.trim().slice(0,30);if(!a||!b){ov.querySelector("#glmsg").textContent="請填寫學號與姓名。";return}
    const s=readWB();s.prog=Object.assign({first:Date.now(),last:Date.now(),visits:1,ch:{},sub:{}},s.prog||{},{sid:a,sname:b});try{localStorage.setItem(WBKEY,JSON.stringify(s))}catch(e){}ov.remove();API.refreshUser()};
  ov.querySelector("#glok").onclick=ok;ov.addEventListener("keydown",e=>{if(e.key==="Enter")ok()})}

/* ---------- 對外介面 ---------- */
const API={
  ready:false,onLoginRequest:null,
  init(opts){opts=opts||{};if(opts.weak!==undefined)ctx.weak=opts.weak;load();ensureDay();if(opts.mount)mount(opts.mount);if(G.sid)gload();API.ready=true;render()},
  setWeak(z){ctx.weak=z},
  refreshUser(){const sid=wbProg().sid||"";if(sid===G.sid)return;load();ensureDay();loadedFor=null;if(G.sid)gload();render()},
  onGuide:null,answer:onAnswer,wrong:onWrong,miller:onMiller,vocab:onVocab,time:onTime,self:onSelf,rate:onRate,
  stars(ok,first,total){if(!total)return"";if(ok===total&&first>=Math.ceil(total*2/3))return"★★★";if(ok===total)return"★★☆";if(ok>=Math.ceil(total/3))return"★☆☆";return"☆☆☆"},
  open:openPanel,state:()=>G,lvOf,titleOf,eff,_test:{need,drop,gain,quest,ensureDay,demonChange,useTool,reset(){G=blank();G.sid=wbProg().sid||"";ensureDay();store();render()}}
};
window.GAME=API;
})();
