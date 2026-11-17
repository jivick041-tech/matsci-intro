/* 材料科學與工程導論｜遊戲化系統（講義與 3D 教具共用）
   經驗值・等級・每日任務・連續天數・神器・排行榜。資料存在本機並依學號同步到老師的 Apps Script。 */
(function(){
"use strict";
const SAVE_URL="https://script.google.com/macros/s/AKfycbxdty7M2R94i6-U_0SKF-ca8I1tQ-ROGE60gInag7uyXEYP-uLg_hzRAgEi5BRMfxsYjg/exec";
const GKEY="matsci-game-v1",WBKEY="matsci-wb-v4";
const ONLINE=/^https?:$/.test(location.protocol);
const DAY_CAP=400;               /* 每天由作答取得的經驗值上限 */
const ACTIVE_XP=20;              /* 一天至少拿到這麼多經驗值才算「有練習」 */

/* ---------- 等級與稱號 ---------- */
const MAXLV=30;
const need=L=>40+20*L;           /* 從 Lv L 升到 L+1 需要的經驗值 */
function lvOf(xp){let L=1,r=xp;while(L<MAXLV&&r>=need(L)){r-=need(L);L++}return{lv:L,into:r,next:L<MAXLV?need(L):0}}
const TITLES=[[1,"原子學徒"],[4,"電子雲漫遊者"],[7,"鍵結見習生"],[10,"晶格探索者"],[13,"米勒指數解碼者"],[16,"空位追蹤者"],[19,"差排獵人"],[22,"晶界守護者"],[25,"相圖導航者"],[28,"材料宗師"],[30,"傳奇材料宗師"]];
const titleOf=lv=>TITLES.filter(t=>lv>=t[0]).pop()[1];

/* ---------- 神器 ---------- */
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
const TOOLS={
 freeze:["時光沙漏","🕰️","r","漏掉一天時自動使用，保住連續天數。"],
 cata:["催化劑","🧪","c","使用後，接下來答對的 5 題經驗值加倍。"],
 anneal:["再結晶藥劑","⚗️","r","使用後，下一題就算之前答錯過，答對仍算「第一次就答對」。"]
};
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
function blank(){return{v:1,sid:"",nick:"",xp:0,aw:{},items:{},tools:{freeze:1,cata:0,anneal:0},streak:0,best:0,lastActive:"",activeDays:0,day:null,cata:0,anneal:false,seenLv:1,ver:0}}
let G=blank();
function readWB(){try{return JSON.parse(localStorage.getItem(WBKEY)||"{}")||{}}catch(e){return{}}}
function wbProg(){const s=readWB();return(s&&s.prog)||{}}
function load(){try{const all=JSON.parse(localStorage.getItem(GKEY)||"{}");const sid=wbProg().sid||"";G=Object.assign(blank(),(all[sid]||all[""]||{}));G.sid=sid}catch(e){G=blank()}}
function store(){try{const all=JSON.parse(localStorage.getItem(GKEY)||"{}")||{};all[G.sid||""]=G;localStorage.setItem(GKEY,JSON.stringify(all))}catch(e){}}

/* ---------- 亂數（每日任務依學號與日期固定，跨裝置相同） ---------- */
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rnd(seed){let a=seed||1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

let ctx={weak:null,miller:true};      /* 由頁面提供：最弱觀念區、是否可用 3D 教具 */
function ensureDay(){
  const t=today();
  if(G.day&&G.day.d===t)return;
  /* 連續天數結算 */
  if(G.lastActive&&G.lastActive!==t){
    const gap=dayDiff(G.lastActive,t);
    if(gap>=2){if(gap===2&&(G.tools.freeze||0)>0){G.tools.freeze--;G.lastActive=(()=>{const d=new Date(t+"T12:00:00");d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)})();toast("🕰️ 時光沙漏保住了你的連續天數！","item")}else if(G.streak>0){G.streak=0}}
  }
  const r=rnd(hash((G.sid||"anon")+t));const keys=Object.keys(QUESTS).filter(k=>k!=="weak2"||ctx.weak);
  const pick=[];const must=["ans5","first3","prac1"];pick.push(must[Math.floor(r()*must.length)]);
  while(pick.length<3){const k=keys[Math.floor(r()*keys.length)];if(!pick.includes(k)&&!(must.includes(k)&&pick.some(p=>must.includes(p))&&r()<.5))pick.push(k)}
  G.day={d:t,xp:0,cap:0,q:pick.map(k=>({k,n:0,done:false,z:k==="weak2"?ctx.weak:null})),all:false,login:false,active:false,mill:0};
  store();
}

/* ---------- 經驗值 ---------- */
let ui=null;
function gain(x,why,{capped=true,silent=false}={}){
  ensureDay();if(x<=0)return 0;
  if(capped){const room=DAY_CAP-G.day.cap;if(room<=0){if(!G.day.capMsg){G.day.capMsg=1;toast("今天的作答經驗值已達上限，明天再來！","info")}return 0}x=Math.min(x,room);G.day.cap+=x}
  const before=lvOf(G.xp).lv;G.xp+=x;G.day.xp+=x;G.ver++;
  if(!G.day.active&&(G.day.cap>=ACTIVE_XP||G.day.q.some(q=>q.done))){G.day.active=true;markActive()}
  if(!silent)toast("+"+x+" XP"+(why?"　"+why:""),"xp");
  const after=lvOf(G.xp).lv;if(after>before){for(let L=before+1;L<=after;L++)levelUp(L)}
  store();sync();render();return x;
}
function markActive(){const t=today();if(G.lastActive===t)return;const gap=G.lastActive?dayDiff(G.lastActive,t):99;G.streak=gap===1?G.streak+1:1;G.best=Math.max(G.best,G.streak);G.lastActive=t;G.activeDays=(G.activeDays||0)+1;
  if(G.streak>1)toast("🔥 連續 "+G.streak+" 天！","streak")}
function levelUp(L){const t=titleOf(L),prev=titleOf(L-1);celebrate("升級！Lv "+L,t!==prev?"獲得新稱號「"+t+"」":"繼續加油，下一級更接近「"+(TITLES.find(x=>x[0]>L)||[0,t])[1]+"」",L%5===0?"e":"r")}

/* ---------- 掉寶 ---------- */
function rollRarity(min){const r=Math.random()*100;let k=r<2?"l":r<10?"e":r<35?"r":"c";const order="crel";if(min&&order.indexOf(k)<order.indexOf(min))k=min;return k}
function drop(min,source){
  ensureDay();
  if(Math.random()<.18&&!min||min&&Math.random()<.25){const tk=Math.random()<.45?"cata":Math.random()<.6?"freeze":"anneal";G.tools[tk]=(G.tools[tk]||0)+1;const T=TOOLS[tk];celebrate(T[1]+" 獲得道具："+T[0],T[3],T[2]);store();sync();render();return}
  const rar=rollRarity(min);const id=POOL[rar][Math.floor(Math.random()*POOL[rar].length)];const it=itemById(id);
  const cur=G.items[id]||0;
  if(cur>=3){gain(10,"重複神器轉換",{capped:false});return}
  G.items[id]=cur+1;G.ver++;store();sync();render();
  celebrate(it[3]+" "+(cur?"神器升星！":"獲得神器！")+it[1],(cur?"★".repeat(cur+1)+"　":"")+it[4],rar,source);
}

/* ---------- 事件（頁面呼叫） ---------- */
function quest(k,inc=1,match){ensureDay();let changed=false;G.day.q.forEach(q=>{if(q.k!==k||q.done)return;if(match&&!match(q))return;q.n+=inc;changed=true;if(q.n>=QUESTS[q.k][1]){q.done=true;if(!G.day.active){G.day.active=true;markActive()}gain(QREWARD,"任務完成：「"+qText(q)+"」",{capped:false})}});
  if(changed&&!G.day.all&&G.day.q.every(q=>q.done)){G.day.all=true;gain(QALL,"今日任務全部完成！",{capped:false});setTimeout(()=>drop("r","寶箱"),900)}
  if(changed){store();render()}}
function qText(q){return QUESTS[q.k][0].replace("{z}",q.z?q.z.label:"")}
function dailyLogin(){ensureDay();if(G.day.login)return;G.day.login=true;const bonus=10+Math.min(20,2*(G.streak||0));gain(bonus,"今日登入"+(G.streak?"（連續加成）":""),{capped:false})}

/* answer: {id, ok, first, practice, zone:{key,label}, wasWrong, kind:"open"|"auto"} */
function onAnswer(a){
  if(!a.ok)return;ensureDay();
  if(G.aw[a.id])return;
  let first=a.first;if(!first&&G.anneal){first=true;G.anneal=false;toast("⚗️ 再結晶藥劑生效：算第一次就答對","item")}
  let x=a.kind==="open"?5:first?(a.practice?15:10):4;
  if(G.cata>0){x*=2;G.cata--}
  G.aw[a.id]=1;
  gain(x,first?"第一次就答對":"");
  quest("ans5");if(first)quest("first3");if(a.practice)quest("prac1");if(a.wasWrong)quest("review2");
  if(a.zone)quest("weak2",1,q=>q.z&&q.z.key===a.zone.key);
  if(Math.random()<(first?.14:.07))setTimeout(()=>drop(null,"作答"),700);
}
function onMiller(ok,first){if(!ok)return;ensureDay();if(G.day.mill>=30)return;G.day.mill++;let x=first?6:2;if(G.cata>0){x*=2;G.cata--}gain(x,"3D 教具");quest("miller3");if(Math.random()<(first?.10:.04))setTimeout(()=>drop(null,"3D 教具"),700)}
function onVocab(){ensureDay();G.day.voc=(G.day.voc||0)+1;if(G.day.voc<=30)gain(1,"",{silent:true});quest("vocab3")}
function onTime(sec){ensureDay();quest("time10",sec)}
function onSelf(id){if(G.aw["s:"+id])return;G.aw["s:"+id]=1;gain(3,"自我評估")}
function onRate(id){if(G.aw["r:"+id])return;G.aw["r:"+id]=1;gain(5,"填寫學習回饋")}
function useTool(k){if(!(G.tools[k]>0))return;if(k==="cata"){G.tools.cata--;G.cata+=5;toast("🧪 催化劑啟動：接下來 5 題經驗值加倍","item")}else if(k==="anneal"){if(G.anneal)return;G.tools.anneal--;G.anneal=true;toast("⚗️ 再結晶藥劑已準備：下一題算第一次就答對","item")}store();sync();render();openPanel("bag")}

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
  base.best=Math.max(base.best||0,other.best||0);base.activeDays=Math.max(base.activeDays||0,other.activeDays||0);
  if((other.lastActive||"")>(base.lastActive||"")){base.lastActive=other.lastActive;base.streak=other.streak}
  if(!base.nick&&other.nick)base.nick=other.nick;
  if(other.day&&base.day&&other.day.d===base.day.d&&other!==base){base.day.q.forEach((q,i)=>{const o=other.day.q&&other.day.q[i];if(o&&o.k===q.k){q.n=Math.max(q.n,o.n);q.done=q.done||o.done}});base.day.all=base.day.all||other.day.all;base.day.login=base.day.login||other.day.login}
  if(base!==G&&G.day&&G.day.d===today()&&(!base.day||base.day.d!==today()))base.day=G.day;
  base.sid=G.sid;G=base;
}
function gload(){const sid=G.sid;if(!sid||!ONLINE){loadedFor=sid;afterLoad();return}jsonp({action:"gload",u:sid},txt=>{if(G.sid!==sid)return;if(txt){try{merge(JSON.parse(txt))}catch(e){}}loadedFor=sid;afterLoad();store();render();sync(true)})}
function afterLoad(){dailyLogin();const n=API.retroCount?API.retroCount():0;if(n>0&&!G.aw.retro){G.aw.retro=1;gain(n*4,"既有進度回溯獎勵（"+n+" 題）",{capped:false})}}
function sync(now){clearTimeout(syncT);syncT=setTimeout(push,now?50:4000)}
function push(){const p=wbProg();if(!ONLINE||!G.sid||!p.sname||loadedFor!==G.sid||saving)return;const L=lvOf(G.xp).lv;saving=true;
  const body={kind:"game",sid:G.sid,sname:p.sname,nick:G.nick,lv:L,title:titleOf(L),xp:G.xp,streak:G.streak,best:G.best,days:G.activeDays||0,items:Object.keys(G.items).length+" / "+ITEMS.length,data:JSON.stringify(G)};
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
  const ov=modal(`<div class="gcele"><div class="gbig">${icon}</div><h3>${esc(t)}</h3><span class="grar" style="background:${R[1]}">${R[0]}</span><p>${esc(body)}</p><button class="gbtn gok" data-gclose>收下</button></div>`,()=>setTimeout(nextCele,150))}
function modal(html,onClose){const ov=document.createElement("div");ov.className="gov";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");ov.innerHTML=`<div class="gcard">${html}</div>`;
  const close=()=>{ov.remove();onClose&&onClose()};ov.addEventListener("click",e=>{if(e.target===ov||e.target.closest("[data-gclose]"))close()});ov.addEventListener("keydown",e=>{if(e.key==="Escape")close()});document.body.appendChild(ov);const f=ov.querySelector("button,input");f&&f.focus();return ov}

function barHTML(){const s=lvOf(G.xp),t=titleOf(s.lv);ensureDay();const left=G.day.q.filter(q=>!q.done).length;
  return `<div class="lvb" aria-label="等級 ${s.lv}"><small>Lv</small>${s.lv}</div>
   <div class="gmid"><div class="gt">${esc(G.nick||"（尚未取暱稱）")}・${t}</div><div class="gsub">${s.next?`經驗值 ${s.into} / ${s.next}`:"已達最高等級"}・總計 ${G.xp} XP${G.cata?`・🧪 加倍剩 ${G.cata} 題`:""}${G.anneal?"・⚗️ 再結晶待命":""}</div><div class="xpb"><i style="width:${s.next?(s.into/s.next*100).toFixed(1):100}%"></i></div></div>
   <div class="gst" title="連續練習天數">🔥 ${G.streak||0} 天</div>
   <div class="gbtns"><button class="gbtn" data-gp="quest">📋 每日任務${left?`<span class="dot">${left}</span>`:" ✓"}</button><button class="gbtn" data-gp="bag">🎒 神器圖鑑</button><button class="gbtn" data-gp="board">🏆 排行榜</button></div>`}
let bars=[];
function mount(el){injectCSS();const b=document.createElement("div");b.className="gbar";el.parentNode.insertBefore(b,el.nextSibling);bars.push(b);b.addEventListener("click",e=>{const x=e.target.closest("[data-gp]");if(x)openPanel(x.dataset.gp)});render()}
function render(){bars.forEach(b=>{if(!G.sid){b.innerHTML=`<div class="gmid"><div class="gt">🎮 登入後開始累積經驗值、每日任務與神器</div><div class="gsub">輸入學號與姓名，等級會跟著學號在手機與電腦之間同步。</div></div><button class="gbtn" data-glogin>登入</button>`;const l=b.querySelector("[data-glogin]");l.onclick=()=>API.onLoginRequest?API.onLoginRequest():loginModal();return}b.innerHTML=barHTML()})}
let openOv=null;
function openPanel(which){if(openOv)openOv.remove();ensureDay();let h="";
  if(which==="quest"){const done=G.day.q.filter(q=>q.done).length;
    h=`<button class="gx" data-gclose aria-label="關閉">×</button><h3>📋 今日任務</h3><div class="gsub">${G.day.d}・每個任務 +${QREWARD} XP，全部完成再 +${QALL} XP 並開啟寶箱（必定稀有以上）</div>`+
      G.day.q.map(q=>{const goal=QUESTS[q.k][1],n=Math.min(q.n,goal),isT=q.k==="time10";return `<div class="gq${q.done?" done":""}"><div class="gc">${q.done?"✓":""}</div><div class="gqt">${esc(qText(q))}<div class="gqb"><i style="width:${n/goal*100}%"></i></div></div><div class="gqr">${isT?Math.floor(n/60)+" / 10 分":n+" / "+goal}</div></div>`}).join("")+
      `<div class="gsub" style="margin-top:10px">${done===3?"🎉 今天的任務都完成了，明天再來！":"任務每天午夜更新。"}連續練習 🔥 ${G.streak||0} 天（最長 ${G.best||0} 天）。一天至少拿到 ${ACTIVE_XP} XP 才算有練習。</div>`}
  if(which==="bag"){const got=ITEMS.filter(i=>G.items[i[0]]).length;
    h=`<button class="gx" data-gclose aria-label="關閉">×</button><h3>🎒 神器圖鑑</h3><div class="gsub">已收集 ${got} / ${ITEMS.length}・答對題目有機率掉落，重複獲得會升星（最多 ★★★）</div>
     <div class="gtools">${Object.entries(TOOLS).map(([k,T])=>`<div class="gtool"><span class="ge">${T[1]}</span><div class="gtt"><b>${T[0]} × ${G.tools[k]||0}</b><br>${T[3]}</div>${k==="freeze"?`<span class="gsub" style="margin:0">自動使用</span>`:`<button class="gbtn" data-guse="${k}" ${G.tools[k]>0?"":"disabled"}>使用</button>`}</div>`).join("")}</div>
     <div class="ggrid">${ITEMS.map(i=>{const n=G.items[i[0]]||0,R=RAR[i[2]];return n?`<button class="gitem" data-gi="${i[0]}" style="border-color:${R[1]}"><div class="ge">${i[3]}</div><b>${esc(i[1])}</b><span class="gr" style="color:${R[1]}">${R[0]} ${"★".repeat(n)}</span></button>`:`<div class="gitem lock"><div class="ge">❔</div><b>？？？</b><span class="gr" style="color:${R[1]}">${R[0]}</span></div>`}).join("")}</div><div class="gdesc" id="gdesc">點神器看說明。</div>`}
  if(which==="board"){h=`<button class="gx" data-gclose aria-label="關閉">×</button><h3>🏆 全班排行榜</h3><div class="gsub">依總經驗值排名，只顯示暱稱。</div>
     <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><label for="gnick">我的暱稱</label><input id="gnick" class="gin" maxlength="12" value="${esc(G.nick||"")}" placeholder="最多 12 字"><button class="gbtn" id="gnsave">儲存</button><span class="gsub" id="gnmsg" style="margin:0"></span></div>
     <div id="gboard">${ONLINE?"讀取中…":"排行榜需要連上網路。"}</div>`}
  openOv=modal(h,()=>{openOv=null});
  openOv.querySelectorAll("[data-guse]").forEach(b=>b.onclick=()=>useTool(b.dataset.guse));
  openOv.querySelectorAll("[data-gi]").forEach(b=>b.onclick=()=>{const it=itemById(b.dataset.gi);openOv.querySelector("#gdesc").innerHTML=`<b>${it[3]} ${esc(it[1])}</b>（${RAR[it[2]][0]} ${"★".repeat(G.items[it[0]])}）<br>${esc(it[4])}`});
  if(which==="board"){const sv=openOv.querySelector("#gnsave");sv.onclick=()=>{const v=openOv.querySelector("#gnick").value.trim().slice(0,12);G.nick=v;store();sync(true);render();openOv.querySelector("#gnmsg").textContent=v?"已儲存，排行榜稍後更新":"已清除"};
    if(ONLINE)jsonp({action:"board",u:G.sid||""},txt=>{const box=openOv&&openOv.querySelector("#gboard");if(!box)return;let d=null;try{d=JSON.parse(txt)}catch(e){}
      if(!d){box.textContent="暫時讀不到排行榜，稍後再試。";return}
      box.innerHTML=d.top.length?`<table class="gtb"><thead><tr><th>名次</th><th>暱稱</th><th>等級</th><th>經驗值</th><th>🔥</th></tr></thead><tbody>${d.top.map((r,i)=>`<tr class="${d.me===i+1?"me":""}"><td>${["🥇","🥈","🥉"][i]||i+1}</td><td>${esc(r.nick)}<br><span class="gsub" style="margin:0">${esc(r.title)}</span></td><td>Lv ${r.lv}</td><td>${r.xp}</td><td>${r.streak}</td></tr>`).join("")}</tbody></table><p class="gsub" style="margin-top:10px">${d.me?`你目前是第 ${d.me} 名（共 ${d.n} 人）。`:"你的紀錄還沒同步到排行榜，答幾題後再看看。"}</p>`:"還沒有人上榜，你可以當第一個！"})}
}

function loginModal(){const p=wbProg();const ov=modal(`<button class="gx" data-gclose aria-label="關閉">×</button><h3>登入</h3><div class="gsub">和講義使用同一組學號，等級與神器會一起累積。</div>
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
  answer:onAnswer,miller:onMiller,vocab:onVocab,time:onTime,self:onSelf,rate:onRate,
  stars(ok,first,total){if(!total)return"";if(ok===total&&first>=Math.ceil(total*2/3))return"★★★";if(ok===total)return"★★☆";if(ok>=Math.ceil(total/3))return"★☆☆";return"☆☆☆"},
  open:openPanel,state:()=>G,lvOf,titleOf,_test:{need,drop,gain,quest,ensureDay,reset(){G=blank();G.sid=wbProg().sid||"";ensureDay();store();render()}}
};
window.GAME=API;
})();
