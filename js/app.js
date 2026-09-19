let fairSessionsCloudV281=[];
let fairSessionDraftDirtyV282=false;
function getSavedFairLocations(){try{const list=JSON.parse(localStorage.getItem("lover_fair_locations")||"[]");return Array.isArray(list)?list.map(x=>canonicalLocation(x)).filter(Boolean):[]}catch(e){return[]}}
function getHiddenFairLocationKeysV328(){try{const x=JSON.parse(localStorage.getItem("lover_fair_locations_hidden_v328")||"[]");return new Set(Array.isArray(x)?x.map(String):[])}catch(_){return new Set()}}
function saveFairLocation(location){const loc=canonicalLocation(location);if(!loc)return;const key=normalizeFairLocationKey(loc),list=getSavedFairLocations();if(!list.some(x=>normalizeFairLocationKey(x)===key))list.push(loc);list.sort((a,b)=>a.localeCompare(b));localStorage.setItem("lover_fair_locations",JSON.stringify(list));const hidden=getHiddenFairLocationKeysV328();if(hidden.delete(key))localStorage.setItem("lover_fair_locations_hidden_v328",JSON.stringify([...hidden]));renderFairLocationOptions()}
function deleteFairLocationHistoryV309(location){const key=normalizeFairLocationKey(location),list=getSavedFairLocations().filter(x=>normalizeFairLocationKey(x)!==key),hidden=getHiddenFairLocationKeysV328();hidden.add(key);localStorage.setItem("lover_fair_locations",JSON.stringify(list));localStorage.setItem("lover_fair_locations_hidden_v328",JSON.stringify([...hidden]));renderFairLocationOptions()}
function collectFairLocations(){
  const merged=[];
  const add=value=>{const display=canonicalLocation(value),key=normalizeFairLocationKey(display);if(!display||!key||merged.some(x=>x.key===key))return;merged.push({key,display})};
  // Preserve the first locally-known display label, then add shared cloud and
  // historical turnover locations so every phone/computer sees the same list.
  getSavedFairLocations().forEach(add);
  Object.values(getLocalFairSessionsV320()).forEach(x=>add(x?.location));
  (Array.isArray(fairSessionsCloudV281)?fairSessionsCloudV281:[]).forEach(x=>add(x?.location));
  (Array.isArray(rows)?rows:[]).filter(x=>String(x?.type||"").toLowerCase()==="fair").forEach(x=>add(x?.location));
  const hidden=getHiddenFairLocationKeysV328();return merged.filter(x=>!hidden.has(x.key)).map(x=>x.display).sort((a,b)=>a.localeCompare(b,"en",{sensitivity:"base"}));
}
function fairSessionKeyV320(location){return normalizeFairLocationKey(canonicalLocation(location||""))}
function getLocalFairSessionsV320(){try{const v=JSON.parse(localStorage.getItem("lover_fair_sessions_v320")||"{}");return v&&typeof v==="object"?v:{}}catch(e){return{}}}
function saveLocalFairSessionV320(location,start,end,updatedAt=""){
  const loc=canonicalLocation(location),key=fairSessionKeyV320(loc);if(!loc||!key||!start||!end)return;
  const all=getLocalFairSessionsV320();all[key]={location:loc,start,end,updatedAt:updatedAt||new Date().toISOString()};
  localStorage.setItem("lover_fair_sessions_v320",JSON.stringify(all));
  localStorage.setItem("lover_last_fair_session",JSON.stringify(all[key]));
}
function findFairSessionV320(location){
  const key=fairSessionKeyV320(location);if(!key)return null;
  const cloud=(Array.isArray(fairSessionsCloudV281)?fairSessionsCloudV281:[]).filter(x=>fairSessionKeyV320(x.location)===key).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")))[0];
  if(cloud)return cloud;
  return getLocalFairSessionsV320()[key]||null;
}
function switchFairLocationV320(location){
  const input=document.getElementById("fairLocation");if(!input)return false;
  const loc=canonicalLocation(location);input.value=loc;
  const session=findFairSessionV320(loc);
  if(session){setDateControl("fairStart",session.start);setDateControl("fairEnd",session.end);saveLocalFairSessionV320(loc,session.start,session.end,session.updatedAt||"");fairSessionDraftDirtyV282=false;}
  else{fairSessionDraftDirtyV282=true;}
  updateFairPageMode();syncFairInputs();syncFairProductDatesV203(true);renderFairMonthlyList();refreshProductLinkContextV210("fair");return Boolean(session);
}
function renderFairLocationHistoryV309(){
  const panel=document.getElementById("fairLocationHistoryV309");
  if(!panel)return;
  const list=collectFairLocations();
  panel.innerHTML="";
  if(!list.length){panel.classList.add("hidden");return;}
  const title=document.createElement("div");title.className="fair-location-history-title-v309";title.textContent="历史地点";panel.appendChild(title);
  list.forEach(loc=>{
    const row=document.createElement("div");row.className="fair-location-history-row-v309";
    const choose=document.createElement("button");choose.type="button";choose.className="fair-location-history-choose-v309";choose.textContent=loc;
    choose.addEventListener("click",()=>{switchFairLocationV320(loc);const input=document.getElementById("fairLocation");if(input)input.focus();panel.classList.add("hidden")});
    const del=document.createElement("button");del.type="button";del.className="fair-location-history-delete-v309";del.setAttribute("aria-label",`删除 ${loc}`);del.textContent="×";
    del.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();deleteFairLocationHistoryV309(loc)});
    row.append(choose,del);panel.appendChild(row);
  });
}
function renderFairLocationOptions(){const el=document.getElementById("fairLocationListOptions");if(el){el.innerHTML="";collectFairLocations().forEach(loc=>{const option=document.createElement("option");option.value=loc;el.appendChild(option)})}renderFairLocationHistoryV309()}
function latestFairSessionV281(){const list=(Array.isArray(fairSessionsCloudV281)?fairSessionsCloudV281:[]).filter(x=>x&&x.location&&x.start&&x.end);return [...list].sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")))[0]||null}
function applyFairSessionV281(s,{force=false}={}){if(!s)return false;const l=document.getElementById("fairLocation"),a=document.getElementById("fairStart"),b=document.getElementById("fairEnd");if(!l||!a||!b)return false;if(!force&&fairSessionDraftDirtyV282)return false;l.value=canonicalLocation(s.location);setDateControl("fairStart",s.start);setDateControl("fairEnd",s.end);saveLocalFairSessionV320(canonicalLocation(s.location),s.start,s.end,s.updatedAt||"");fairSessionDraftDirtyV282=false;updateFairPageMode();syncFairInputs();renderFairLocationOptions();return true}
async function refreshFairSessionsV281({applyLatest=false,forceApply=false}={}){try{const r=await loadFairSessionsFromSheetV281();fairSessionsCloudV281=Array.isArray(r?.sessions)?r.sessions:[];fairSessionsCloudV281.forEach(s=>{if(s?.location&&s?.start&&s?.end)saveLocalFairSessionV320(s.location,s.start,s.end,s.updatedAt||"")});renderFairLocationOptions();if(applyLatest)applyFairSessionV281(latestFairSessionV281(),{force:forceApply});return fairSessionsCloudV281}catch(e){console.warn("Fair Session cloud sync failed",e);return fairSessionsCloudV281}}
const companyNames={balakong:"Lover Legend Adenium - Balakong",belimbing:"Lover Legend Gardening - Belimbing",fair:"Fair",live:"Live"};
function selectedMonth(){return document.getElementById("monthPicker").value}
function selectedYear(){return document.getElementById("yearPicker").value}
function selectedDashboardDateISO(){
  const el=document.getElementById("dashboardDate");
  return el&&/^\d{4}-\d{2}-\d{2}$/.test(el.value)?el.value:todayISO();
}
function selectedDashboardDateDisplay(){return isoToDisplay(selectedDashboardDateISO())}
function sameMonth(date){return sameMonthDisplay(date,selectedMonth())}
function sameYear(date){return sameYearDisplay(date,selectedYear())}
const LAST_PAGE_KEY_V238="lover_last_active_page_v238";
// V39.9: turnover writes are real transactions. Keep navigation guarded until cloud confirmation.
const turnoverWriteStateV382={daily:false,fair:false,live:false};
const salesCardWriteBusyV456={busy:false,label:""};
function setSalesCardWriteBusyV456(busy,label=""){salesCardWriteBusyV456.busy=!!busy;salesCardWriteBusyV456.label=String(label||"");}
function salesCardWriteBusyGuardV456(){if(!salesCardWriteBusyV456.busy)return true;alert((salesCardWriteBusyV456.label||"销售卡资料")+"正在写入云端，请等待成功后再离开页面。");return false;}
window.setSalesCardWriteBusyV456=setSalesCardWriteBusyV456;
function turnoverNewDraftDirtyV382(type){
  if(type==='daily'||type==='fair'||type==='live'){
    const ids=turnoverIdsV376(type),el=document.getElementById(ids.input);
    return !!String(el?.value||'').trim()&&Math.abs(toAmount(el.value||0))>0.005;
  }
  return false;
}
function turnoverLeaveGuardV382(type){
  if(turnoverWriteStateV382[type]){alert('资料正在保存，请等待「保存成功」后再离开。');return false;}
  if(turnoverNewDraftDirtyV382(type))return confirm('还有未储存的营业额。\n\n确定离开？');
  return true;
}
function setTurnoverWriteStateV382(type,busy){turnoverWriteStateV382[type]=!!busy;document.documentElement.classList.toggle('turnover-write-lock-v458',Object.values(turnoverWriteStateV382).some(Boolean));}
function anyTurnoverLeaveRiskV382(){return Object.values(turnoverWriteStateV382).some(Boolean)||turnoverNewDraftDirtyV382('daily')||turnoverNewDraftDirtyV382('fair')||turnoverNewDraftDirtyV382('live');}
function showPage(name,el){
  const current=document.querySelector(".page.active");
  const currentName=String(current?.id||"").replace(/^page-/,"");
  // V29.9: page "sales" uses the sales-card type "daily".
  // Without this mapping, Sales/Belimbing dirty cards were not seen by bottom navigation.
  const currentSalesCardType=currentName==="sales"?"daily":currentName;

  if(currentName&&currentName!==name&&!salesCardWriteBusyGuardV456())return false;

  if(currentName&&currentName!==name&&['daily','fair','live'].includes(currentSalesCardType)&&!turnoverLeaveGuardV382(currentSalesCardType))return false;

  if(currentName&&currentName!==name&&typeof hasUnsavedSalesCardChangesV238==="function"&&hasUnsavedSalesCardChangesV238(currentSalesCardType)){
    if(!confirm("销售卡尚未保存，确定离开？\n\n点击“确定”将放弃未保存的销售卡修改。"))return false;
    discardUnsavedSalesCardChangesV238(currentSalesCardType);
  }

  if(current&&current.id==="page-more"&&name!=="more"&&(fairCommissionDraftDirty||liveCommissionDraftDirty)){
    const pending=[];
    if(fairCommissionDraftDirty)pending.push("Fair 佣金机制");
    if(liveCommissionDraftDirty)pending.push("直播佣金制度");
    alert("请先储存"+pending.join("和")+"，才能离开 More 页面。");
    return false;
  }
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById("page-"+name).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  if(el)el.classList.add("active");
  try{localStorage.setItem(LAST_PAGE_KEY_V238,name)}catch(e){}

  // V29.9: every time Live is opened, start from today's date.
  // A previous date is loaded only when the user deliberately selects it.
  if(name==="live"&&document.getElementById("liveDate")){
    setDateControl("liveDate",todayISO());
    updateLiveInputFromSelectedDate();
    renderLiveMonthlyList();
    renderLiveDailySummary();
  }
  if(name==="home")renderDashboard();
  if(name==="report")renderTable();
  if(name==="fair"&&typeof refreshFairInputsFromRows==="function")refreshFairInputsFromRows(false);

  // V29.9: page switching never waits for or triggers cloud sync.
  // Periodic/background sync is handled separately.
}
function rowKey(r){const location=r.type==="live"?normalizeLiveHostKey(r.location||""):normalizeFairLocationKey(r.location||"");const company=r.type==="daily"?canonicalDailyCompanyKeyV518(r.company||r.location||""):r.type==="fair"?"fair":r.company;return [r.type,r.date,company,location].join("|")}
function dedupeRows(list){const m=new Map();list.forEach(r=>{const k=rowKey(r),old=m.get(k),fresh=String(r.clientUpdatedAt||r.updatedAt||""),oldFresh=String(old?.clientUpdatedAt||old?.updatedAt||"");if(!old||fresh>=oldFresh)m.set(k,r)});return [...m.values()]}
function upsertLocalRow(n){rows=dedupeRows([...rows,n])}
function getDailyAmount(d,c){const f=rows.find(r=>r.type==="daily"&&r.date===d&&r.company===c);return f?Number(f.amount||0):0}
const DAILY_TURNOVER_DRAFT_KEY_V332="lover_daily_turnover_drafts_v332";
function dailyTurnoverDraftContextV332(){const date=String(document.getElementById("saleDate")?.value||""),company=String(document.getElementById("company")?.value||"");return date&&company?date+"|"+company:""}
function readDailyTurnoverDraftsV332(){try{const value=JSON.parse(localStorage.getItem(DAILY_TURNOVER_DRAFT_KEY_V332)||"{}");return value&&typeof value==="object"?value:{}}catch(_){return{}}}
function getDailyTurnoverDraftV332(){const key=dailyTurnoverDraftContextV332();return key?readDailyTurnoverDraftsV332()[key]||null:null}
function saveDailyTurnoverDraftV332(value){const key=dailyTurnoverDraftContextV332();if(!key)return;const drafts=readDailyTurnoverDraftsV332();drafts[key]={value:String(value??""),updatedAt:Date.now()};try{localStorage.setItem(DAILY_TURNOVER_DRAFT_KEY_V332,JSON.stringify(drafts))}catch(_){}}
function clearDailyTurnoverDraftV332(){const key=dailyTurnoverDraftContextV332();if(!key)return;const drafts=readDailyTurnoverDraftsV332();delete drafts[key];try{localStorage.setItem(DAILY_TURNOVER_DRAFT_KEY_V332,JSON.stringify(drafts))}catch(_){}}
function installDailyTurnoverDraftGuardV332(){const input=document.getElementById("dailySales");if(!input||input.dataset.draftGuardV332==="1")return;input.dataset.draftGuardV332="1";input.addEventListener("input",()=>saveDailyTurnoverDraftV332(input.value));input.addEventListener("change",()=>saveDailyTurnoverDraftV332(input.value));}
function renderSavedTurnoverSummaryV333(element,name,date,amount){
  if(!element)return;
  const title=document.createElement("span"),detail=document.createElement("span");
  title.className="saved-turnover-name-v333";detail.className="saved-turnover-detail-v333";
  title.textContent=String(name||"未选择");
  detail.textContent=amount===null?String(date||""):`${String(date||"")} · 已保存 RM${money(amount)}`;
  element.replaceChildren(title,detail);
}
function updateDailyInputFromSelectedDate(){const d=isoToDisplay(document.getElementById("saleDate").value),c=document.getElementById("company").value,a=getDailyAmount(d,c),input=document.getElementById("dailySales"),draft=getDailyTurnoverDraftV332();input.value=draft?String(draft.value):formatAmount(a);renderSavedTurnoverSummaryV333(document.getElementById("salesDateResult"),companyNames[c],d,a);renderSalesMonthlyList();if(typeof refreshSalesActionLocksV270==="function")refreshSalesActionLocksV270();if(typeof loadProductLinksIntoEditorV206==="function")Promise.resolve(loadProductLinksIntoEditorV206("daily")).catch(()=>{});}
function totalBy(type,company="",mode="month"){return rows.filter(r=>r.type===type).filter(r=>company?r.company===company:true).filter(r=>mode==="today"?r.date===isoToDisplay(todayISO()):mode==="month"?sameMonth(r.date):mode==="year"?sameYear(r.date):true).reduce((s,r)=>s+Number(r.amount||0),0)}

// V42.3: Top 5 uses the last saved all-history cache immediately. Opening a
// panel schedules one low-priority cloud check shared with Historical Highs.
function weekdayZh(displayDate){
  const iso=displayToISO(displayDate);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return "";
  const parts=iso.split("-").map(Number);
  const d=new Date(parts[0],parts[1]-1,parts[2]);
  return ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][d.getDay()];
}

const HISTORY_HIGH_CACHE_KEY="lover_sales_history_high_v174";
let historicalHighsMemory=null;
let historicalHighsPromise=null;

function readHistoricalHighsCache(){
  // V35.0: an all-time record does not become invalid merely because normal
  // turnover revision changes. Keep the last confirmed local record available
  // immediately and let a low-priority cloud check improve it in background.
  if(historicalHighsMemory)return historicalHighsMemory;
  try{
    const parsed=JSON.parse(localStorage.getItem(HISTORY_HIGH_CACHE_KEY)||"null");
    if(parsed&&parsed.ok&&parsed.highs){
      historicalHighsMemory=parsed;
      return parsed;
    }
  }catch(e){}
  return null;
}

function mergeHistoricalHighsV331(localData,cloudData){
  const kinds=["balakong","belimbing","fair","live"],highs={};
  kinds.forEach(kind=>{
    const local=localData&&localData.highs?localData.highs[kind]:null;
    const cloud=cloudData&&cloudData.highs?cloudData.highs[kind]:null;
    highs[kind]=Number(cloud&&cloud.amount||0)>Number(local&&local.amount||0)?cloud:(local||cloud||null);
  });
  return{
    ok:true,
    highs,
    top5:cloudData&&cloudData.top5?cloudData.top5:(localData&&localData.top5?localData.top5:null),
    dataRevision:Number(cloudData&&cloudData.dataRevision||localData&&localData.dataRevision||0),
    cloudChecked:true,
    checkedAt:new Date().toISOString()
  };
}

function saveHistoricalHighsCache(data){
  historicalHighsMemory=data||null;
  try{
    if(data&&data.ok)localStorage.setItem(HISTORY_HIGH_CACHE_KEY,JSON.stringify(data));
  }catch(e){}
}

function historicalKindForPanel(elId){
  if(elId==="balakongTop3")return "balakong";
  if(elId==="belimbingTop3")return "belimbing";
  if(elId==="fairHomeTop3"||elId==="fairPageTop3")return "fair";
  if(elId==="liveHomeTop3"||elId==="livePageTop3")return "live";
  return "";
}

function historyRecordHtml(record,kind,state="ready"){
  if(state==="loading"||state==="checking"){
    return '<div class="history-record history-loading"><span>🏆 历史最高额</span><small>正在后台核对…</small></div>';
  }
  if(!record||!Number(record.amount||0)){
    return '<div class="history-record"><span>🏆 历史最高额</span><small>暂无历史记录</small></div>';
  }
  const weekday=weekdayZh(record.date);
  let detail="";
  if(kind==="fair")detail=`${canonicalLocation(record.location||"Fair")} · ${record.date} · ${weekday}`;
  else if(kind==="live")detail=`${canonicalLiveHost(record.location||"")||"未注明主播"} · ${record.date} · ${weekday}`;
  else detail=`${record.date} · ${weekday}`;
  return `<div class="history-record">
    <div class="history-record-left"><span class="history-record-label">🏆 历史最高额</span><span class="history-record-detail">${detail}</span></div>
    <strong>RM${money(record.amount)}</strong>
  </div>`;
}

function currentTopAmountForPanel(elId){
  let list=[];
  if(elId==="balakongTop3")list=top3RowsForMonth("daily",selectedMonth(),"balakong");
  else if(elId==="belimbingTop3")list=top3RowsForMonth("daily",selectedMonth(),"belimbing");
  else if(elId==="fairHomeTop3")list=top3RowsForMonth("fair",selectedMonth());
  else if(elId==="liveHomeTop3")list=top3RowsForMonth("live",selectedMonth());
  return list.length?Number(list[0].amount||0):0;
}

function recordGapHtml(record,elId){
  const recordAmount=Number(record&&record.amount||0);
  const currentTop=currentTopAmountForPanel(elId);
  if(!recordAmount||!currentTop)return "";
  // Sales values support cents. To BREAK (not merely tie) the record, exceed it by RM0.01.
  const gap=Math.max(0,Math.round((recordAmount-currentTop+0.01)*100)/100);
  if(gap<=0)return '<div class="history-record-gap history-record-achieved">🎯 已打破历史纪录</div>';
  return `<div class="history-record-gap">🎯 距离打破纪录还差 <strong>RM${money(gap)}</strong></div>`;
}

function renderHistoricalRecordForPanel(elId,state="ready"){
  const host=document.getElementById(elId+"History");
  if(!host)return;
  const kind=historicalKindForPanel(elId);
  const data=readHistoricalHighsCache();
  if(!data){
    host.innerHTML=historyRecordHtml(null,kind,state==="ready"?"checking":state);
    return;
  }
  const record=data&&data.highs?data.highs[kind]:null;
  host.innerHTML=historyRecordHtml(record,kind)+recordGapHtml(record,elId);
}

function renderAllVisibleHistoricalRecords(){
  ["balakongTop3","belimbingTop3","fairHomeTop3","liveHomeTop3"]
    .forEach(id=>renderHistoricalRecordForPanel(id));
}

async function ensureHistoricalHighs(){
  const cached=readHistoricalHighsCache();
  if(cached)renderAllVisibleHistoricalRecords();
  if(historicalHighsPromise)return historicalHighsPromise;
  if(typeof jsonp!=="function")return null;
  const checkedAt=cached&&cached.checkedAt?Date.parse(cached.checkedAt):0;
  if(cached&&cached.top5&&checkedAt&&Date.now()-checkedAt<300000)return cached;

  if(!cached)["balakongTop3","belimbingTop3","fairHomeTop3","liveHomeTop3"]
    .forEach(id=>renderHistoricalRecordForPanel(id,"checking"));

  historicalHighsPromise=jsonp(
    {action:"historicalHighs"},
    {timeoutMs:20000}
  ).then(data=>{
    if(data&&data.ok&&data.highs){
      // Never replace a locally known all-time record with a lower cloud value.
      // Only a genuinely higher cloud record changes what the user sees.
      const merged=mergeHistoricalHighsV331(readHistoricalHighsCache(),data);
      saveHistoricalHighsCache(merged);
      renderBusinessTop3();
      renderFairPageTop3();
      renderLivePageTop3();
      return merged;
    }
    throw new Error((data&&data.message)||"历史纪录读取失败");
  }).catch(err=>{
    console.warn("Historical highs:",err);
    renderAllVisibleHistoricalRecords();
    return null;
  }).finally(()=>{
    historicalHighsPromise=null;
  });
  return historicalHighsPromise;
}

function scheduleHistoricalHighsCheckV331(){
  const run=()=>ensureHistoricalHighs().catch(()=>{});
  if(typeof requestIdleCallback==="function")requestIdleCallback(run,{timeout:5000});
  else setTimeout(run,1800);
}

function top3RowsForMonth(type,month,company=""){
  return dedupeRows(rows)
    .filter(r=>r.type===type)
    .filter(r=>company?r.company===company:true)
    .filter(r=>displayToISO(r.date).slice(0,7)===month)
    .filter(r=>Number(r.amount||0)>0)
    .sort((a,b)=>Number(b.amount||0)-Number(a.amount||0)||displayToISO(b.date).localeCompare(displayToISO(a.date))).slice(0,5);
}
function top5RowsAllHistoryV423(kind,type,company=""){
  const cached=readHistoricalHighsCache();
  const cloudList=cached&&cached.top5&&Array.isArray(cached.top5[kind])?cached.top5[kind]:null;
  if(cloudList)return cloudList.slice(0,5);
  return dedupeRows(rows)
    .filter(r=>r.type===type)
    .filter(r=>company?r.company===company:true)
    .filter(r=>Number(r.amount||0)>0)
    .sort((a,b)=>Number(b.amount||0)-Number(a.amount||0)||displayToISO(b.date).localeCompare(displayToISO(a.date))).slice(0,5);
}
function renderTop3List(elId,list,kind){
  const el=document.getElementById(elId);
  if(!el)return;
  const medals=["🥇","🥈","🥉"];
  const rowsHtml=list.length
    ?list.map((r,i)=>{
      const weekday=weekdayZh(r.date);
      let lead="";
      if(kind==="fair")lead=`<span class="top3-name">${canonicalLocation(r.location||"Fair")}</span><span class="top3-sep"> · </span>`;
      else if(kind==="live")lead=`<span class="top3-name">${canonicalLiveHost(r.location||"")||"未注明主播"}</span><span class="top3-sep"> · </span>`;
      return `<div class="top3-row">
        <div class="top3-meta"><span class="top3-rank">${medals[i]||"#"+(i+1)}</span>${lead}<span>${r.date}</span><span class="top3-sep"> · </span><span>${weekday}</span></div>
        <strong>RM${money(r.amount)}</strong>
      </div>`;
    }).join("")
    :'<div class="top3-empty">还没有历史营业额记录</div>';

  el.innerHTML=`<div id="${elId}History" class="history-record-host"></div>${rowsHtml}`;
  renderHistoricalRecordForPanel(elId);
}
function renderBusinessTop3(){
  renderTop3List("balakongTop3",top5RowsAllHistoryV423("balakong","daily","balakong"),"daily");
  renderTop3List("belimbingTop3",top5RowsAllHistoryV423("belimbing","daily","belimbing"),"daily");
  renderTop3List("fairHomeTop3",top5RowsAllHistoryV423("fair","fair"),"fair");
  renderTop3List("liveHomeTop3",top5RowsAllHistoryV423("live","live"),"live");
}
function renderFairPageTop3(){
  renderTop3List("fairPageTop3",top5RowsAllHistoryV423("fair","fair"),"fair");
}
function renderLivePageTop3(){
  renderTop3List("livePageTop3",top5RowsAllHistoryV423("live","live"),"live");
}
function toggleTop3(id,btn){
  const panel=document.getElementById(id);
  if(!panel)return;
  const show=panel.classList.contains("hidden");
  panel.classList.toggle("hidden",!show);
  if(btn)btn.classList.toggle("active",show);
  if(show){
    if(id==="fairPageTop3")renderFairPageTop3();
    else if(id==="livePageTop3")renderLivePageTop3();
    else renderBusinessTop3();

    // V35.0: Top 5 and its last confirmed local record paint immediately.
    // Cloud comparison waits for browser idle time and never blocks page sync.
    scheduleHistoricalHighsCheckV331();
  }
}
function fairLocationsThisMonth(){const map=new Map();rows.filter(r=>r.type==="fair"&&sameMonth(r.date)&&Number(r.amount)>0).forEach(r=>{const name=canonicalLocation(r.location||"Fair"),key=normalizeFairLocationKey(name);if(!key)return;const prev=map.get(key);if(!prev||displayToISO(r.date)>=displayToISO(prev.date))map.set(key,{name,date:r.date})});return [...map.values()].map(x=>x.name).sort((a,b)=>a.localeCompare(b,"en",{sensitivity:"base"}))}
function fairByLocation(){const map=new Map();rows.filter(r=>r.type==="fair"&&sameMonth(r.date)&&Number(r.amount)>0).forEach(r=>{const name=canonicalLocation(r.location||"Fair"),key=normalizeFairLocationKey(name);if(!key)return;const prev=map.get(key)||{name,date:"",amount:0};prev.amount+=Number(r.amount||0);if(!prev.date||displayToISO(r.date)>=displayToISO(prev.date)){prev.name=name;prev.date=r.date}map.set(key,prev)});const out={};map.forEach(v=>out[v.name]=v.amount);return out}
// V42.3: click a Home Fair location to expand its newest month, plus the
// immediately preceding month only when that location has records in it.
// Each day's commission follows that historical month's saved Fair mechanism.
const fairHomeHistoryOpenV423=new Set();
const FAIR_HOME_PROFIT_CACHE_KEY_V423='loverLegendSales.fairHomeProfitLinks.v1';
function readFairHomeProfitCacheV423(){
  try{
    const raw=localStorage.getItem(FAIR_HOME_PROFIT_CACHE_KEY_V423)||localStorage.getItem('loverLegendSales.fairHomeProfitLinks.v417')||'null';
    const saved=JSON.parse(raw);
    return saved&&Array.isArray(saved.links)?saved:null;
  }catch(_e){return null}
}
function fairHomeProfitSignatureV423(links){
  return JSON.stringify((Array.isArray(links)?links:[]).map(x=>[
    String(x.linkId||''),String(x.transactionId||''),String(x.type||''),String(x.date||''),
    normalizeFairLocationKey(x.location),Number(x.profit||0),String(x.updatedAt||'')
  ]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
function saveFairHomeProfitCacheV423(links,checkedAt=Date.now()){
  try{
    localStorage.setItem(FAIR_HOME_PROFIT_CACHE_KEY_V423,JSON.stringify({
      links:Array.isArray(links)?links:[],signature:fairHomeProfitSignatureV423(links),checkedAt
    }));
  }catch(e){console.warn('V42.3 Fair 利润缓存保存失败',e)}
}
const fairHomeProfitSavedV423=readFairHomeProfitCacheV423();
let fairHomeProfitLinksV423=fairHomeProfitSavedV423?fairHomeProfitSavedV423.links:null;
let fairHomeProfitCheckedAtV423=Number(fairHomeProfitSavedV423?.checkedAt||0);
let fairHomeProfitPromiseV423=null;
let fairHomeProfitVerifiedThisSessionV423=false;
let fairHomeProfitIndexSourceV423=null;
let fairHomeProfitIndexV423=new Map();
let fairHomeProfitVerifyTimerV423=null;
let fairHomeHistoryRowsCacheV423=new Map();
let fairHomeCombinedRateCacheV423=null;
function fairCommissionRateForMonthV423(month){
  const monthTotal=dedupeRows(rows).filter(r=>r.type==="fair"&&displayToISO(r.date).slice(0,7)===month).reduce((sum,r)=>sum+Number(r.amount||0),0);
  const settings=getCommissionSettingsForMonth(month);
  if(monthTotal>=100000)return Number(settings.rate3||0)/100;
  if(monthTotal>=50000)return Number(settings.rate2||0)/100;
  return Number(settings.rate1||0)/100;
}
function fairLocationHistoryRowsV423(locationKey){
  if(fairHomeHistoryRowsCacheV423.has(locationKey))return fairHomeHistoryRowsCacheV423.get(locationKey);
  const map=new Map();
  dedupeRows(rows).filter(r=>r.type==="fair"&&normalizeFairLocationKey(r.location||"Fair")===locationKey).forEach(r=>{
    const date=String(r.date||"");if(!date)return;
    const current=map.get(date)||{date,amount:0};current.amount+=Number(r.amount||0);map.set(date,current);
  });
  const list=[...map.values()].sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date)));
  const months=[...new Set(list.map(r=>displayToISO(r.date).slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)))].sort();
  const latest=months[months.length-1];
  if(!latest){fairHomeHistoryRowsCacheV423.set(locationKey,list);return list}
  const year=Number(latest.slice(0,4)),month=Number(latest.slice(5,7));
  const previousDate=new Date(year,month-2,1);
  const previous=`${previousDate.getFullYear()}-${String(previousDate.getMonth()+1).padStart(2,'0')}`;
  const allowed=new Set(months.includes(previous)?[previous,latest]:[latest]);
  const result=list.filter(r=>allowed.has(displayToISO(r.date).slice(0,7)));
  fairHomeHistoryRowsCacheV423.set(locationKey,result);
  return result;
}
function fairHomeAllLocationKeysV423(){
  return Object.keys(fairByLocation()).map(name=>normalizeFairLocationKey(name)).filter(Boolean);
}
function fairHomeCombinedCommissionRateV423(locationKeys=fairHomeAllLocationKeysV423()){
  if(fairHomeCombinedRateCacheV423!==null)return fairHomeCombinedRateCacheV423;
  const keys=[...new Set(locationKeys)].filter(Boolean);
  const combinedSales=keys.reduce((sum,key)=>sum+fairLocationHistoryRowsV423(key).reduce((subtotal,r)=>subtotal+Number(r.amount||0),0),0);
  fairHomeCombinedRateCacheV423=getFairCommissionRate(combinedSales);
  return fairHomeCombinedRateCacheV423;
}
function fairHistoryProfitV423(links,locationKey,date){
  if(fairHomeProfitIndexSourceV423!==links){
    fairHomeProfitIndexSourceV423=links;
    fairHomeProfitIndexV423=new Map();
    const clean=typeof dedupeProfitLinksV360==="function"?dedupeProfitLinksV360(links):(Array.isArray(links)?links:[]);
    clean.forEach(x=>{
      if(String(x.type||'')!=='fair')return;
      const key=normalizeFairLocationKey(x.location)+'|'+String(x.date||'');
      fairHomeProfitIndexV423.set(key,(fairHomeProfitIndexV423.get(key)||0)+Number(x.profit||0));
    });
  }
  return fairHomeProfitIndexV423.get(locationKey+'|'+date)||0;
}
function fairHistoryTableV423(locationKey,links){
  const list=fairLocationHistoryRowsV423(locationKey),ready=Array.isArray(links),rate=fairHomeCombinedCommissionRateV423();
  if(!list.length)return '<div class="fair-home-history-empty-v423">还没有历史记录</div>';
  let totalSales=0,totalProfit=0,totalCommission=0;
  const body=list.map(r=>{
    const sales=Number(r.amount||0),commission=sales*rate,profit=ready?fairHistoryProfitV423(links,locationKey,r.date):null,margin=profit===null?null:(sales>0?profit/sales*100:0);
    totalSales+=sales;totalCommission+=commission;if(profit!==null)totalProfit+=profit;
    return `<div class="fair-home-history-row-v423"><span>${shortDayMonthV297(r.date)}</span><b>${money(sales)}</b><b>${profit===null?'--':money(profit)}</b><b>${margin===null?'--':margin.toFixed(2)+'%'}</b><b>${money(commission)}</b></div>`;
  }).join('');
  const totalMargin=ready&&totalSales>0?totalProfit/totalSales*100:0;
  return `<div class="fair-home-history-table-v423"><div class="fair-home-history-head-v423"><span>日期</span><span>营业额</span><span>利润</span><span>利润率</span><span>佣金</span></div>${body}<div class="fair-home-history-row-v423 fair-home-history-total-v423"><span>总数</span><b>${money(totalSales)}</b><b>${ready?money(totalProfit):'--'}</b><b>${ready?totalMargin.toFixed(2)+'%':'--'}</b><b>${money(totalCommission)}</b></div></div>`;
}
function fairOpenLocationsGrandV423(locationKeys,links){
  const keys=[...new Set(locationKeys)].filter(Boolean),ready=Array.isArray(links);
  if(keys.length<2)return '';
  let totalSales=0,totalProfit=0;
  keys.forEach(key=>fairLocationHistoryRowsV423(key).forEach(r=>{
    const sales=Number(r.amount||0);
    totalSales+=sales;
    if(ready)totalProfit+=fairHistoryProfitV423(links,key,r.date);
  }));
  const rate=getFairCommissionRate(totalSales),totalCommission=totalSales*rate,margin=ready&&totalSales>0?totalProfit/totalSales*100:0;
  return `<div class="fair-home-grand-v423"><strong>${keys.length}个地点总数</strong><div class="fair-home-grand-grid-v423 fair-home-grand-head-v423"><span>营业额</span><span>利润</span><span>利润率</span><span>佣金</span></div><div class="fair-home-grand-grid-v423 fair-home-grand-values-v423"><b>${money(totalSales)}</b><b>${ready?money(totalProfit):'--'}</b><b>${ready?margin.toFixed(2)+'%':'--'}</b><b>${money(totalCommission)}</b></div></div>`;
}
function paintFairHomeHistoryV423(){
  document.querySelectorAll('.fair-home-history-panel-v423[data-location-key]').forEach(panel=>{const key=decodeURIComponent(panel.dataset.locationKey||'');panel.innerHTML=fairHistoryTableV423(key,fairHomeProfitLinksV423)});
  const grand=document.getElementById('fairHomeGrandV423');if(grand){const keys=String(grand.dataset.locationKeys||'').split(',').filter(Boolean).map(decodeURIComponent);grand.outerHTML=fairOpenLocationsGrandV423(keys,fairHomeProfitLinksV423).replace('<div class="fair-home-grand-v423"',`<div id="fairHomeGrandV423" data-location-keys="${keys.map(encodeURIComponent).join(',')}" class="fair-home-grand-v423"`)}
}
function ensureFairHomeProfitLinksV423(){
  // V42.3: this runs after the tap has already painted. Cloud verification is
  // silent and only repaints when the authoritative rows actually changed.
  if(fairHomeProfitPromiseV423)return fairHomeProfitPromiseV423;
  if(fairHomeProfitVerifiedThisSessionV423)return Promise.resolve(Array.isArray(fairHomeProfitLinksV423)?fairHomeProfitLinksV423:[]);
  const oldSignature=fairHomeProfitSignatureV423(fairHomeProfitLinksV423);
  fairHomeProfitPromiseV423=Promise.resolve(loadAllSalesProductLinksV203({force:true,maxAgeMs:0})).then(links=>{
    const fresh=Array.isArray(links)?links:[],freshSignature=fairHomeProfitSignatureV423(fresh);
    fairHomeProfitCheckedAtV423=Date.now();
    fairHomeProfitVerifiedThisSessionV423=true;
    if(!Array.isArray(fairHomeProfitLinksV423)||freshSignature!==oldSignature){
      fairHomeProfitLinksV423=fresh;
      paintFairHomeHistoryV423();
    }
    saveFairHomeProfitCacheV423(fresh,fairHomeProfitCheckedAtV423);
    return fresh;
  }).catch(e=>{console.warn('V42.3 Fair 全部历史利润静默检查失败，继续显示上次资料',e);return Array.isArray(fairHomeProfitLinksV423)?fairHomeProfitLinksV423:[]}).finally(()=>{fairHomeProfitPromiseV423=null});
  return fairHomeProfitPromiseV423;
}
function scheduleFairHomeProfitVerifyV423(){
  if(fairHomeProfitVerifiedThisSessionV423||fairHomeProfitPromiseV423||fairHomeProfitVerifyTimerV423!==null)return;
  const run=()=>{fairHomeProfitVerifyTimerV423=null;ensureFairHomeProfitLinksV423()};
  if(typeof requestIdleCallback==='function'){
    fairHomeProfitVerifyTimerV423=requestIdleCallback(run,{timeout:1200});
  }else{
    fairHomeProfitVerifyTimerV423=setTimeout(run,350);
  }
}
function refreshFairHomeGrandV423(){
  const grid=document.querySelector('#fairLocationList .fair-location-grid');
  if(!grid)return;
  const old=document.getElementById('fairHomeGrandV423');
  if(!fairHomeHistoryOpenV423.size){if(old)old.remove();return}
  const keys=fairHomeAllLocationKeysV423();
  const html=fairOpenLocationsGrandV423(keys,fairHomeProfitLinksV423);
  if(!html){if(old)old.remove();return}
  const wrapped=html.replace('<div class="fair-home-grand-v423"',`<div id="fairHomeGrandV423" data-location-keys="${keys.map(encodeURIComponent).join(',')}" class="fair-home-grand-v423"`);
  if(old)old.outerHTML=wrapped;else grid.insertAdjacentHTML('beforeend',wrapped);
}
function toggleFairHomeHistoryV423(encodedKey,button){
  const key=decodeURIComponent(String(encodedKey||''));if(!key)return;
  const card=button?.closest('.fair-location-card-v423');
  const opening=!fairHomeHistoryOpenV423.has(key);
  if(opening)fairHomeHistoryOpenV423.add(key);else fairHomeHistoryOpenV423.delete(key);
  if(button){
    button.setAttribute('aria-expanded',String(opening));
    const arrow=button.querySelector('b');if(arrow)arrow.textContent=opening?'▲':'▼';
  }
  if(card)card.classList.toggle('fair-location-card-open-v423',opening);
  let panel=card?.querySelector('.fair-home-history-panel-v423');
  if(!opening){
    if(panel)panel.remove();
    if(!fairHomeHistoryOpenV423.size){
      const grand=document.getElementById('fairHomeGrandV423');if(grand)grand.remove();
    }
    return;
  }
  if(card&&!panel){
    panel=document.createElement('div');
    panel.className='fair-home-history-panel-v423';
    panel.dataset.locationKey=encodeURIComponent(key);
    panel.innerHTML='<div class="fair-home-history-empty-v423">正在显示…</div>';
    card.appendChild(panel);
  }
  // Let the arrow/card paint first. Heavy history formatting starts on the next
  // frame and updates only this card instead of rebuilding every location.
  requestAnimationFrame(()=>setTimeout(()=>{
    if(!fairHomeHistoryOpenV423.has(key))return;
    const current=card?.querySelector('.fair-home-history-panel-v423');
    if(current)current.innerHTML=fairHistoryTableV423(key,fairHomeProfitLinksV423);
    refreshFairHomeGrandV423();
    scheduleFairHomeProfitVerifyV423();
  },0));
}
window.toggleFairHomeHistoryV423=toggleFairHomeHistoryV423;
function renderFairLocationList(){
  fairHomeHistoryRowsCacheV423=new Map();
  fairHomeCombinedRateCacheV423=null;
  const g=fairByLocation(),locs=Object.keys(g).sort(),c=document.getElementById("fairLocationList");
  if(!locs.length){c.innerHTML='<div class="sub">这个月份还没有 Fair 记录</div>';return}
  const fairTotal=Object.values(g).reduce((sum,value)=>sum+Number(value||0),0),rate=getFairCommissionRate(fairTotal)*100;
  const allLocationKeys=locs.map(l=>normalizeFairLocationKey(l)).filter(Boolean);
  const hasOpenLocation=allLocationKeys.some(key=>fairHomeHistoryOpenV423.has(key));
  const grand=hasOpenLocation?fairOpenLocationsGrandV423(allLocationKeys,fairHomeProfitLinksV423):'';
  const grandHtml=grand?grand.replace('<div class="fair-home-grand-v423"',`<div id="fairHomeGrandV423" data-location-keys="${allLocationKeys.map(encodeURIComponent).join(',')}" class="fair-home-grand-v423"`):'';
  c.innerHTML='<div class="fair-location-grid">'+locs.map(l=>{const key=normalizeFairLocationKey(l),open=fairHomeHistoryOpenV423.has(key),encoded=encodeURIComponent(key);return `<div class="fair-location-card fair-location-card-v423 ${open?'fair-location-card-open-v423':''}"><button type="button" class="fair-location-summary-v423" aria-expanded="${open}" onclick="toggleFairHomeHistoryV423('${encoded}',this)"><span class="fair-location-title fair-location-toggle-v423"><span>${escapeChangeLogHtmlV200(l)}</span><b>${open?'▲':'▼'}</b></span><span class="fair-location-row"><span>营业额</span><b>${money(g[l])}</b></span><span class="fair-location-row"><span>佣金 ${Number(rate.toFixed(2))}%</span><b>${money(g[l]*rate/100)}</b></span></button>${open?`<div class="fair-home-history-panel-v423" data-location-key="${encoded}">${fairHistoryTableV423(key,fairHomeProfitLinksV423)}</div>`:''}</div>`}).join("")+grandHtml+'</div>';
}
function hasDashboardDateDailyRecord(company){
  const date=selectedDashboardDateDisplay();
  return rows.some(r=>
    r.type==="daily" &&
    r.company===company &&
    r.date===date
  );
}

function dashboardDateDailyAmount(company){
  return getDailyAmount(selectedDashboardDateDisplay(),company);
}

function dashboardDateTypeAmount(type){
  const date=selectedDashboardDateDisplay();
  return rows
    .filter(r=>r.type===type&&r.date===date)
    .reduce((sum,r)=>sum+Number(r.amount||0),0);
}

function hasDashboardDateTypeRecord(type){
  const date=selectedDashboardDateDisplay();
  return rows.some(r=>r.type===type&&r.date===date);
}

function dashboardDateLabel(){
  return selectedDashboardDateISO()===todayISO()
    ?"今天"
    :selectedDashboardDateDisplay();
}

function renderTodayCompanyStatus(){
  // V39.9: this card follows the explicit "查看日期" selector. Keep the
  // heading honest when a historical date is selected instead of always
  // calling the values "本日".
  const dailyTitle=document.getElementById("dashboardDailyTitleV375");
  if(dailyTitle){
    const selected=selectedDashboardDateISO();
    dailyTitle.textContent=selected===todayISO()?"本日营业额":`${selectedDashboardDateDisplay()} 营业额`;
  }
  const balakongRecorded=hasDashboardDateDailyRecord("balakong");
  const belimbingRecorded=hasDashboardDateDailyRecord("belimbing");
  const fairRecorded=hasDashboardDateTypeRecord("fair");
  const liveRecorded=hasDashboardDateTypeRecord("live");

  const balakongAmount=dashboardDateDailyAmount("balakong");
  const belimbingAmount=dashboardDateDailyAmount("belimbing");
  const fairAmount=dashboardDateTypeAmount("fair");
  const liveAmount=dashboardDateTypeAmount("live");
  const totalAmount=balakongAmount+belimbingAmount+fairAmount+liveAmount;

  const warning=document.getElementById("todayWarning");
  const done=document.getElementById("todayDone");
  if(!warning||!done)return;

  // V29.9: status colour represents actual business amount, not merely
  // whether a row exists. A saved RM0.00 record is still a confirmed record,
  // but it must remain red.
  const statusLine=(label,recorded,amount)=>{
    const positive=Number(amount||0)>0;
    const suffix=!recorded?" · 没有记录":(!positive?" · 已记录":"");
    return `${positive?"🟢":"🔴"} ${label}：<strong>RM${money(amount)}</strong>${suffix}`;
  };

  const lines=[
    statusLine("Balakong",balakongRecorded,balakongAmount),
    statusLine("Belimbing",belimbingRecorded,belimbingAmount),
    statusLine("Fair",fairRecorded,fairAmount),
    statusLine("Live",liveRecorded,liveAmount),
    `<span class="daily-total-line">${totalAmount>0?"🟢":"🔴"} Total：<strong>RM${money(totalAmount)}</strong></span>`
  ];

  const allRecorded=balakongRecorded&&belimbingRecorded&&fairRecorded&&liveRecorded;
  if(allRecorded){
    warning.classList.add("hidden");
    done.classList.remove("hidden");
    done.innerHTML=lines.join("<br>");
    return;
  }

  done.classList.add("hidden");
  warning.classList.remove("hidden");
  warning.innerHTML=lines.join("<br>");
}

const DEFAULT_COMMISSION_SETTINGS={
  rate1:6,
  rate2:7,
  rate3:8,
  liveHostRates:{},
  liveHosts:{},
  inactiveLiveHosts:{},
  liveRateSchedules:[],
  fairRevision:0,
  liveRevision:0
};

let commissionSettings={...DEFAULT_COMMISSION_SETTINGS};
let liveCommissionDraftDirty=false;
let fairCommissionDraftDirty=false;
let savedFairCommissionSnapshot=null;
let savedLiveCommissionSnapshot=null;

function sortedCommissionMap(source){
  return Object.fromEntries(
    Object.entries(source||{})
      .map(([key,value])=>[String(key),value])
      .sort((a,b)=>a[0].localeCompare(b[0]))
  );
}

function fairCommissionComparable(settings){
  const source=normalizeCommissionSettings(settings||getCommissionSettings());
  return JSON.stringify({
    rate1:Number(source.rate1),
    rate2:Number(source.rate2),
    rate3:Number(source.rate3)
  });
}

function liveCommissionComparable(settings){
  const source=normalizeCommissionSettings(settings||getCommissionSettings());
  return JSON.stringify({
    liveHostRates:sortedCommissionMap(source.liveHostRates),
    liveHosts:sortedCommissionMap(source.liveHosts),
    inactiveLiveHosts:sortedCommissionMap(source.inactiveLiveHosts),
    liveRateSchedules:(source.liveRateSchedules||[])
      .map(item=>({
        id:String(item.id||""),
        startDate:String(item.startDate||""),
        endDate:String(item.endDate||""),
        rate:Number(item.rate)
      }))
      .sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.endDate.localeCompare(b.endDate)||a.id.localeCompare(b.id))
  });
}

function setSavedCommissionSnapshots(settings,{fair=true,live=true}={}){
  const normalized=normalizeCommissionSettings(settings||getCommissionSettings());
  if(fair)savedFairCommissionSnapshot=fairCommissionComparable(normalized);
  if(live)savedLiveCommissionSnapshot=liveCommissionComparable(normalized);
}

function currentFairDraftComparable(){
  const current=getCommissionSettings();
  const rate1=document.getElementById("commissionRate1");
  const rate2=document.getElementById("commissionRate2");
  const rate3=document.getElementById("commissionRate3");
  if(!rate1||!rate2||!rate3)return fairCommissionComparable(current);
  const values=[Number(rate1.value),Number(rate2.value),Number(rate3.value)];
  if(!values.every(Number.isFinite))return "invalid";
  return fairCommissionComparable({...current,rate1:values[0],rate2:values[1],rate3:values[2]});
}

function currentLiveDraftComparable(){
  const current=getCommissionSettings();
  const liveHostRates={...(current.liveHostRates||{})};
  const inputs=document.querySelectorAll("[data-live-host-key]");
  inputs.forEach(input=>{
    const key=String(input.dataset.liveHostKey||"");
    const rate=Number(input.value);
    if(key&&Number.isFinite(rate)&&rate>=0)liveHostRates[key]=rate;
  });
  return liveCommissionComparable({...current,liveHostRates});
}

function updateFairCommissionDraftState(){
  if(savedFairCommissionSnapshot===null)savedFairCommissionSnapshot=fairCommissionComparable(getCommissionSettings());
  fairCommissionDraftDirty=currentFairDraftComparable()!==savedFairCommissionSnapshot;
  const message=document.getElementById("fairCommissionSettingsMsg");
  if(message&&fairCommissionDraftDirty){
    message.textContent="尚未储存 Fair 佣金机制";
    message.classList.remove("hidden");
  }else if(message&&!fairCommissionDraftDirty&&message.textContent==="尚未储存 Fair 佣金机制"){
    message.textContent="没有需要储存的更改";
    message.classList.remove("hidden");
  }
  return fairCommissionDraftDirty;
}

function updateLiveCommissionDraftState(){
  if(savedLiveCommissionSnapshot===null)savedLiveCommissionSnapshot=liveCommissionComparable(getCommissionSettings());
  liveCommissionDraftDirty=currentLiveDraftComparable()!==savedLiveCommissionSnapshot;
  const message=document.getElementById("liveCommissionSettingsMsg");
  if(message&&liveCommissionDraftDirty){
    message.textContent="尚未储存直播佣金制度";
    message.classList.remove("hidden");
  }else if(message&&!liveCommissionDraftDirty&&message.textContent==="尚未储存直播佣金制度"){
    message.textContent="没有需要储存的更改";
    message.classList.remove("hidden");
  }
  return liveCommissionDraftDirty;
}

function normalizeCommissionSettings(settings){
  const source=settings||{};
  const rate1=Number(source.rate1);
  const rate2=Number(source.rate2);
  const rate3=Number(source.rate3);
  const fairRevision=Number.isFinite(Number(source.fairRevision))&&Number(source.fairRevision)>=0?Number(source.fairRevision):0;
  const liveRevision=Number.isFinite(Number(source.liveRevision))&&Number(source.liveRevision)>=0?Number(source.liveRevision):0;
  const liveHostRates={};
  const liveHosts={};
  const inactiveLiveHosts={};
  Object.entries(source.liveHostRates||{}).forEach(([key,value])=>{
    const cleanKey=String(key||"").replace(/\s+/g,"").toLowerCase();
    const rate=Number(value);
    if(cleanKey&&Number.isFinite(rate)&&rate>=0)liveHostRates[cleanKey]=rate;
  });
  const hostSource=Array.isArray(source.liveHosts)
    ? Object.fromEntries(source.liveHosts.map(name=>[normalizeLiveHostKey(name),canonicalLiveHost(name)]))
    : (source.liveHosts||{});
  Object.entries(hostSource).forEach(([key,value])=>{
    const cleanKey=String(key||"").replace(/\s+/g,"").toLowerCase();
    const name=canonicalLiveHost(value);
    if(cleanKey&&name)liveHosts[cleanKey]=name;
  });
  Object.entries(source.inactiveLiveHosts||{}).forEach(([key,value])=>{
    const cleanKey=String(key||"").replace(/\s+/g,"").toLowerCase();
    const name=canonicalLiveHost(value);
    if(cleanKey&&name&&!liveHosts[cleanKey])inactiveLiveHosts[cleanKey]=name;
  });
  Object.keys(liveHostRates).forEach(key=>{if(!liveHosts[key]&&!inactiveLiveHosts[key])liveHosts[key]=key.replace(/(^|\s)\S/g,c=>c.toUpperCase())});

  const liveRateSchedules=(Array.isArray(source.liveRateSchedules)?source.liveRateSchedules:[])
    .map((item,index)=>{
      const startDate=String(item&&item.startDate||"");
      const endDate=String(item&&item.endDate||"");
      const rate=Number(item&&item.rate);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||
         (endDate&&!/^\d{4}-\d{2}-\d{2}$/.test(endDate))||
         (endDate&&endDate<startDate)||
         !Number.isFinite(rate)||
         rate<0)return null;
      return{
        id:String(item.id||`${startDate}_${endDate}_${index}`),
        startDate,
        endDate,
        rate
      };
    })
    .filter(Boolean)
    .sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.endDate.localeCompare(b.endDate));

  if(![rate1,rate2,rate3].every(Number.isFinite)||rate1<0||rate2<0||rate3<0){
    return{...DEFAULT_COMMISSION_SETTINGS,liveHostRates:{},liveHosts:{},inactiveLiveHosts:{},liveRateSchedules:[],fairRevision,liveRevision};
  }
  return{rate1,rate2,rate3,liveHostRates,liveHosts,inactiveLiveHosts,liveRateSchedules,fairRevision,liveRevision};
}
function getCommissionSettings(){
  return{
    ...commissionSettings,
    liveHostRates:{...(commissionSettings.liveHostRates||{})},
    liveHosts:{...(commissionSettings.liveHosts||{})},
    inactiveLiveHosts:{...(commissionSettings.inactiveLiveHosts||{})},
    liveRateSchedules:(commissionSettings.liveRateSchedules||[]).map(item=>({...item}))
  };
}

function applyCommissionSettings(settings){
  commissionSettings=normalizeCommissionSettings(settings);
  localStorage.setItem(
    "lover_commission_settings_cache",
    JSON.stringify(commissionSettings)
  );
  loadCommissionSettingsForm();
  if(typeof renderDashboard==="function")renderDashboard();
  if(typeof renderLiveMonthlyList==="function")renderLiveMonthlyList();
  if(typeof renderLiveDailySummary==="function")renderLiveDailySummary();
}

function applyCloudCommissionSettings(settings){
  const incoming=normalizeCommissionSettings(settings);
  const local=getCommissionSettings();
  const incomingFairRevision=Number(incoming.fairRevision||0);
  const localFairRevision=Number(local.fairRevision||0);
  const incomingLiveRevision=Number(incoming.liveRevision||0);
  const localLiveRevision=Number(local.liveRevision||0);

  // V29.9: Fair and Live each have their own revision.
  // A stale device/cloud response can never overwrite a newer saved setting.
  const keepLocalFair=incomingFairRevision<localFairRevision;
  const keepLocalLive=liveCommissionDraftDirty||incomingLiveRevision<localLiveRevision;

  const merged=normalizeCommissionSettings({
    ...incoming,
    rate1:keepLocalFair?local.rate1:incoming.rate1,
    rate2:keepLocalFair?local.rate2:incoming.rate2,
    rate3:keepLocalFair?local.rate3:incoming.rate3,
    fairRevision:keepLocalFair?localFairRevision:incomingFairRevision,
    liveHostRates:keepLocalLive?local.liveHostRates:incoming.liveHostRates,
    liveHosts:keepLocalLive?local.liveHosts:incoming.liveHosts,
    inactiveLiveHosts:keepLocalLive?local.inactiveLiveHosts:incoming.inactiveLiveHosts,
    liveRateSchedules:keepLocalLive?local.liveRateSchedules:incoming.liveRateSchedules,
    liveRevision:keepLocalLive?localLiveRevision:incomingLiveRevision
  });

  applyCommissionSettings(merged);
  if(!keepLocalFair)savedFairCommissionSnapshot=fairCommissionComparable(incoming);
  if(!keepLocalLive)savedLiveCommissionSnapshot=liveCommissionComparable(incoming);
  updateFairCommissionDraftState();
  updateLiveCommissionDraftState();
}

function markLiveCommissionDraftDirty(){
  updateLiveCommissionDraftState();
}

function markFairCommissionDraftDirty(){
  updateFairCommissionDraftState();
}

function nextFairCommissionRevision(current=0){
  return Math.max(Date.now(),Number(current||0)+1);
}
function nextLiveCommissionRevision(current=0){
  return Math.max(Date.now(),Number(current||0)+1);
}

let fairCommissionRetryTimer=null;
function queueFairCommissionRetry(settings,targetMonth){
  if(fairCommissionRetryTimer)clearTimeout(fairCommissionRetryTimer);
  const snapshot=normalizeCommissionSettings(settings);
  fairCommissionRetryTimer=setTimeout(()=>{
    fairCommissionRetryTimer=null;
    saveFairCommissionSettingsToSheet(snapshot,targetMonth)
      .then(saved=>{
        const confirmed=normalizeCommissionSettings(saved||snapshot);
        const local=getCommissionSettings();
        if(Number(confirmed.fairRevision||0)>=Number(local.fairRevision||0)){
          applyCommissionSettings(confirmed);
          setSavedCommissionSnapshots(confirmed,{fair:true,live:false});
          updateFairCommissionDraftState();
          saveLocalDataCache(confirmed);
          renderDashboard();
          renderTable();
        }
        const message=document.getElementById("fairCommissionSettingsMsg");
        if(message){message.textContent="✅ Fair 佣金已同步";message.classList.remove("hidden");}
        setSync("已同步",true);
      })
      .catch(error=>{
        console.warn("Fair commission background retry delayed",error);
        const message=document.getElementById("fairCommissionSettingsMsg");
        if(message){message.textContent="本机已储存，云端稍后重试";message.classList.remove("hidden");}
        setSync("Fair 佣金等待云端同步",false,true);
        queueFairCommissionRetry(snapshot,targetMonth);
      });
  },2500);
}

let liveCommissionRetryTimer=null;
function queueLiveCommissionRetry(settings,targetMonth){
  if(liveCommissionRetryTimer)clearTimeout(liveCommissionRetryTimer);
  const snapshot=normalizeCommissionSettings(settings);
  liveCommissionRetryTimer=setTimeout(()=>{
    liveCommissionRetryTimer=null;
    saveLiveCommissionSettingsToSheet(snapshot,targetMonth)
      .then(saved=>{
        const confirmed=normalizeCommissionSettings(saved||snapshot);
        const local=getCommissionSettings();
        if(Number(confirmed.liveRevision||0)>=Number(local.liveRevision||0)){
          applyCommissionSettings(confirmed);
          setSavedCommissionSnapshots(confirmed,{fair:false,live:true});
          updateLiveCommissionDraftState();
          saveLocalDataCache(confirmed);
          renderLiveHostCommissionSettings();
          renderLiveRateSchedules();
          renderDashboard();
          renderTable();
          renderLiveMonthlyList();
        }
        const message=document.getElementById("liveCommissionSettingsMsg");
        if(message){message.textContent="✅ Live 佣金制度已同步";message.classList.remove("hidden");}
        setSync("已同步",true);
      })
      .catch(error=>{
        console.warn("Live commission background retry delayed",error);
        const message=document.getElementById("liveCommissionSettingsMsg");
        if(message){message.textContent="本机资料已保留，云端仍在等待同步";message.classList.remove("hidden");}
        setSync("Live 佣金等待云端同步",false,true);
      });
  },3500);
}

function loadCachedCommissionSettings(){
  try{
    const cached=JSON.parse(
      localStorage.getItem("lover_commission_settings_cache")||"null"
    );
    if(cached)commissionSettings=normalizeCommissionSettings(cached);
  }catch(e){
    commissionSettings={...DEFAULT_COMMISSION_SETTINGS};
  }
}

function loadCommissionSettingsForm(){
  const settings=getCommissionSettings();
  const rate1=document.getElementById("commissionRate1");
  const rate2=document.getElementById("commissionRate2");
  const rate3=document.getElementById("commissionRate3");
  if(rate1)rate1.value=settings.rate1;
  if(rate2)rate2.value=settings.rate2;
  if(rate3)rate3.value=settings.rate3;
}
function commissionConfigMonth(){
  const current=String(systemState&&systemState.currentMonth||monthISO());
  return /^\d{4}-\d{2}$/.test(current)?current:monthISO();
}

function getCommissionSettingsForMonth(month){
  const current=getCommissionSettings();
  const target=/^\d{4}-\d{2}$/.test(String(month||""))?String(month):selectedMonth();
  const snapshot=(systemState.commissionSnapshots||{})[target];
  if(!snapshot)return current;

  // V29.9: historical Fair rates come from that month's snapshot, while the
  // Live schedule is selected by the actual Live record date. This prevents
  // Home's history month selector from blocking the current month's More setup.
  return normalizeCommissionSettings({
    ...current,
    ...snapshot,
    liveHostRates:{
      ...(current.liveHostRates||{}),
      ...((snapshot&&snapshot.liveHostRates)||{})
    },
    liveHosts:{
      ...(current.liveHosts||{}),
      ...((snapshot&&snapshot.liveHosts)||{})
    },
    liveRateSchedules:(current.liveRateSchedules||[])
  });
}
function getEffectiveCommissionSettings(){
  return getCommissionSettingsForMonth(selectedMonth());
}

function liveScheduleMonth(item){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(item&&item.startDate||""))
    ?String(item.startDate).slice(0,7)
    :"";
}

function liveSchedulesForMonth(month,settings=getCommissionSettings()){
  return (settings.liveRateSchedules||[])
    .filter(item=>liveScheduleMonth(item)===month)
    .sort((a,b)=>a.startDate.localeCompare(b.startDate)||String(a.endDate||"").localeCompare(String(b.endDate||"")));
}

function monthLastISO(month){
  if(!/^\d{4}-\d{2}$/.test(String(month||"")))return "";
  const [year,monthNumber]=month.split("-").map(Number);
  const day=new Date(year,monthNumber,0).getDate();
  return `${month}-${String(day).padStart(2,"0")}`;
}

function findLiveRateSchedule(date,settings=null){
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(String(date||""))
    ?String(date)
    :displayToISO(date);
  if(!iso)return null;
  const month=iso.slice(0,7);
  const effectiveSettings=settings||getCommissionSettingsForMonth(month);
  return (effectiveSettings.liveRateSchedules||[]).find(item=>{
    if(liveScheduleMonth(item)!==month)return false;
    const effectiveEnd=item.endDate||monthLastISO(month);
    return iso>=item.startDate&&iso<=effectiveEnd;
  })||null;
}

function getLiveHostRate(host,date=""){
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(String(date||""))?String(date):displayToISO(date);
  const targetMonth=iso?iso.slice(0,7):getLiveSelectedMonth();
  const settings=getCommissionSettingsForMonth(targetMonth);
  const schedule=findLiveRateSchedule(date,settings);
  if(schedule)return Number(schedule.rate||0);
  const key=normalizeLiveHostKey(host);
  const specific=Number((settings.liveHostRates||{})[key]);
  return Number.isFinite(specific)?specific:10;
}
function renderLiveHostCommissionSettings(){
  const container=document.getElementById("liveHostCommissionList");
  if(!container)return;
  const settings=getCommissionSettings();
  const hosts=collectLiveHosts();
  container.innerHTML=hosts.length?hosts.map(host=>{
    const key=normalizeLiveHostKey(host);
    const rate=Number.isFinite(Number((settings.liveHostRates||{})[key]))
      ?Number(settings.liveHostRates[key]):10;
    return `<div class="host-commission-row">
      <span class="host-commission-name">${host}</span>
      <span class="host-commission-controls">
        <span class="commission-input-row"><input type="text" inputmode="decimal" data-live-host-key="${key}" value="${rate}"><span>%</span></span>
        <button type="button" class="remove-live-host-btn" onclick="removeLiveHost('${key}')">离职／停用</button>
      </span>
    </div>`;
  }).join(""):'<div class="sub">新增 Live 主播后会自动显示在这里</div>';
  container.querySelectorAll("[data-live-host-key]").forEach(input=>{
    input.addEventListener("input",markLiveCommissionDraftDirty);
  });
}


async function removeLiveHost(hostKey){
  const key=normalizeLiveHostKey(hostKey);
  const settings=getCommissionSettings();
  const host=canonicalLiveHost((settings.liveHosts||{})[key]||collectLiveHosts().find(name=>normalizeLiveHostKey(name)===key)||key);
  if(!key||!host)return;
  if(!confirm(`确定将主播「${host}」设为已离职／停用？

停用后会从 More 和 Live 主播名单隐藏，并清除当前一般佣金率。
历史 Live、Home、Report 与佣金记录全部保留。
以后在 Live 再输入同一名字，会自动复职并对应原历史资料。`))return;

  const previousSettings=getCommissionSettings();
  const previousSavedHosts=getSavedLiveHosts();
  const liveHosts={...(previousSettings.liveHosts||{})};
  const inactiveLiveHosts={...(previousSettings.inactiveLiveHosts||{})};
  const liveHostRates={...(previousSettings.liveHostRates||{})};
  delete liveHosts[key];
  delete liveHostRates[key];
  inactiveLiveHosts[key]=host;
  const activeHosts=previousSavedHosts.filter(name=>normalizeLiveHostKey(name)!==key);
  const nextSettings=normalizeCommissionSettings({...previousSettings,liveHosts,inactiveLiveHosts,liveHostRates,liveRevision:nextLiveCommissionRevision(previousSettings.liveRevision)});

  localStorage.setItem("lover_live_hosts_v69",JSON.stringify(activeHosts));
  applyCommissionSettings(nextSettings);
  saveLocalDataCache(nextSettings);
  renderLiveHostOptions();
  renderLiveHostCommissionSettings();
  renderDashboard();
  renderTable();
  renderLiveMonthlyList();
  const liveInput=document.getElementById("liveHost");
  if(liveInput&&normalizeLiveHostKey(liveInput.value)===key){
    liveInput.value="";
    updateLiveInputFromSelectedDate();
  }

  const message=document.getElementById("liveCommissionSettingsMsg");
  if(message){message.textContent="主播已停用，云端同步中…";message.classList.remove("hidden");}
  setSync("主播已停用，云端同步中...");

  try{
    const saved=await saveLiveCommissionSettingsToSheet(nextSettings,commissionConfigMonth());
    const confirmed=normalizeCommissionSettings(saved||nextSettings);
    applyCommissionSettings(confirmed);
    setSavedCommissionSnapshots(confirmed,{fair:false,live:true});
    updateLiveCommissionDraftState();
    saveLocalDataCache(confirmed);
    renderLiveHostOptions();
    renderLiveHostCommissionSettings();
    if(message){message.textContent="✅ 主播已设为离职／停用";message.classList.remove("hidden");}
    setSync("已同步",true);
  }catch(error){
    // V29.9: timeout must not undo the user's local action.
    console.warn("Inactive host cloud sync delayed",error);
    liveCommissionDraftDirty=true;
    queueLiveCommissionRetry(nextSettings,commissionConfigMonth());
    if(message){message.textContent="主播已停用，本机资料已保留，云端稍后重试";message.classList.remove("hidden");}
    setSync("主播停用等待云端同步",false,true);
  }
}

let liveScheduleEditingId="";

function renderLiveRateSchedules(){
  const container=document.getElementById("liveRateScheduleList");
  if(!container)return;
  const schedules=liveSchedulesForMonth(commissionConfigMonth());
  container.innerHTML=schedules.length
    ?schedules.map(item=>`
      <div class="live-rate-schedule-row ${item.endDate?"":"is-open"} ${item.id===liveScheduleEditingId?"is-editing":""}">
        <div class="live-rate-schedule-info" onclick="startEditLiveRateSchedule('${item.id}')" title="点击修改日期和佣金率">
          <span>${isoToDisplay(item.startDate)} 至 ${
            item.endDate?isoToDisplay(item.endDate):'<span class="live-rate-schedule-open">进行中 · 月底自动结束</span>'
          }</span>
          <span class="live-rate-schedule-rate">${Number(item.rate)}%</span>
        </div>
        <div class="live-rate-schedule-actions">
          <button type="button" class="live-rate-schedule-remove" onclick="event.stopPropagation();removeLiveRateSchedule('${item.id}')">删除</button>
        </div>
      </div>
    `).join("")
    :`<div class="live-schedule-empty">${commissionConfigMonth()} 没有特别日期规则，使用各主播一般佣金</div>`;
}
function validateLiveRateSchedules(schedules){
  const sorted=[...(schedules||[])].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  sorted.forEach(item=>{
    const month=liveScheduleMonth(item);
    if(!month)throw new Error("直播佣金开始日期格式错误");
    if(item.endDate&&item.endDate.slice(0,7)!==month){
      throw new Error("直播特别佣金不能跨月份，请在下个月重新新增");
    }
  });

  for(let i=0;i<sorted.length-1;i++){
    const current=sorted[i];
    const next=sorted[i+1];
    if(liveScheduleMonth(current)!==liveScheduleMonth(next))continue;
    const currentEnd=current.endDate||monthLastISO(liveScheduleMonth(current));
    if(currentEnd>=next.startDate){
      throw new Error(
        `直播佣金日期不能重叠：${isoToDisplay(current.startDate)} 至 ${
          current.endDate?isoToDisplay(current.endDate):"月底"
        }`
      );
    }
  }
  return sorted;
}

function submitLiveRateSchedule(){
  const start=document.getElementById("liveScheduleStart");
  const end=document.getElementById("liveScheduleEnd");
  const rateEl=document.getElementById("liveScheduleRate");
  const startDate=String(start&&start.value||"");
  const endDate=String(end&&end.value||"");
  const rate=Number(rateEl&&rateEl.value);

  if(!startDate){
    alert("请选择开始日期");
    return false;
  }
  const configMonth=commissionConfigMonth();
  if(startDate.slice(0,7)!==configMonth){
    alert(`开始日期必须属于当前佣金设置月份：${configMonth}`);
    return false;
  }
  if(endDate&&endDate.slice(0,7)!==startDate.slice(0,7)){
    alert("结束日期不能跨月份；下个月请新增另一条特别佣金日期");
    return false;
  }
  if(endDate&&endDate<startDate){
    alert("结束日期不能早于开始日期");
    return false;
  }
  if(!Number.isFinite(rate)||rate<0){
    alert("请输入正确的直播佣金百分比");
    return false;
  }

  const previous=getCommissionSettings();
  const existing=(previous.liveRateSchedules||[]).map(item=>({...item}));

  try{
    const schedules=validateLiveRateSchedules(
      liveScheduleEditingId
        ?existing.map(item=>item.id===liveScheduleEditingId?{...item,startDate,endDate,rate}:item)
        :[...existing,{
          id:`live_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          startDate,
          endDate,
          rate
        }]
    );

    applyCommissionSettings({...previous,liveRateSchedules:schedules,liveRevision:nextLiveCommissionRevision(previous.liveRevision)});
    markLiveCommissionDraftDirty();
    clearLiveScheduleInputs();
    renderLiveRateSchedules();
    renderDashboard();
    renderTable();
    renderLiveMonthlyList();
    return true;
  }catch(error){
    alert(error.message);
    return false;
  }
}

function startEditLiveRateSchedule(id){
  const settings=getCommissionSettings();
  const item=(settings.liveRateSchedules||[]).find(rule=>rule.id===id);
  if(!item)return;

  liveScheduleEditingId=id;
  setDateControl("liveScheduleStart",item.startDate||"");
  setDateControl("liveScheduleEnd",item.endDate||"");
  const rateEl=document.getElementById("liveScheduleRate");
  if(rateEl)rateEl.value=String(item.rate??"");

  const button=document.getElementById("liveScheduleActionBtn");
  if(button)button.textContent="更新特别佣金日期";
  renderLiveRateSchedules();
}
function clearLiveScheduleInputs(){
  setDateControl("liveScheduleStart","");
  setDateControl("liveScheduleEnd","");
  const rateEl=document.getElementById("liveScheduleRate");
  if(rateEl)rateEl.value="";
  liveScheduleEditingId="";
  const button=document.getElementById("liveScheduleActionBtn");
  if(button)button.textContent="＋ 新增特别佣金日期";
}

function removeLiveRateSchedule(id){
  const previous=getCommissionSettings();
  const schedules=(previous.liveRateSchedules||[]).filter(item=>item.id!==id);
  applyCommissionSettings({...previous,liveRateSchedules:schedules,liveRevision:nextLiveCommissionRevision(previous.liveRevision)});
  markLiveCommissionDraftDirty();
  clearLiveScheduleInputs();
  renderLiveRateSchedules();
  renderDashboard();
  renderTable();
  renderLiveMonthlyList();
}


function getFairCommissionRate(total){
  const amount=Number(total||0);
  const settings=getEffectiveCommissionSettings();

  if(amount>=100000)return settings.rate3/100;
  if(amount>=50000)return settings.rate2/100;
  return settings.rate1/100;
}

function renderFairCommission(total){
  const amount=Number(total||0);
  const settings=getEffectiveCommissionSettings();
  const rate=getFairCommissionRate(amount);
  const percent=Number((rate*100).toFixed(2));

  const label=document.getElementById("fairCommissionLabel");
  const value=document.getElementById("fairCommissionTotal");
  const message=document.getElementById("fairCommissionMessage");

  if(label){
    label.textContent=`本月总佣金 ${percent}%`;
  }

  if(value){
    value.textContent=money(amount*rate);
  }

  if(!message)return;

  if(amount<50000){
    message.textContent=`加油，达到 RM50,000 就 ${settings.rate2}%`;
    message.classList.remove("hidden");
  }else if(amount<100000){
    message.textContent=`加油，达到 RM100,000 就 ${settings.rate3}%`;
    message.classList.remove("hidden");
  }else{
    message.textContent="";
    message.classList.add("hidden");
  }
}


const companyDailyOpenV186={balakong:false,belimbing:false};

function companyDailyRowsV186(company){
  const month=selectedMonth();
  const allRows=rows.filter(r=>r.type==="daily"&&(r.company==="balakong"||r.company==="belimbing"))
    .filter(r=>String(displayToISO(r.date)).slice(0,7)===month);

  const dates=[...new Set(allRows.map(r=>r.date))].sort((a,b)=>displayToISO(b).localeCompare(displayToISO(a)));

  return dates.map(date=>{
    const row=allRows.find(r=>r.company===company&&r.date===date);
    return {
      date,
      amount: row ? Number(row.amount||0) : 0
    };
  });
}

function renderCompanyDailyV186(company){
 const el=document.getElementById(company+"MonthDaily"); if(!el)return;
 if(!companyDailyOpenV186[company]){el.classList.add("hidden");el.innerHTML="";return;}
 el.classList.remove("hidden");
 const rows2=companyDailyRowsV186(company);
 el.innerHTML=`<div class="company-daily-list">${rows2.map(x=>`<div><span>${x.date}</span><b>${money(x.amount)}</b></div>`).join("")}</div>`;
}
function toggleCompanyDailyV186(company){companyDailyOpenV186[company]=!companyDailyOpenV186[company];renderCompanyDailyV186(company);}
function renderDashboard(){const bt=totalBy("daily","balakong","today"),blt=totalBy("daily","belimbing","today"),ft=totalBy("fair","","today"),bm=totalBy("daily","balakong","month"),blm=totalBy("daily","belimbing","month"),fm=totalBy("fair","","month"),by=totalBy("daily","balakong","year"),bly=totalBy("daily","belimbing","year"),fy=totalBy("fair","","year");document.getElementById("balakongMonth").textContent=money(bm);document.getElementById("belimbingMonth").textContent=money(blm);renderFairLocationList();document.getElementById("fairMonthTotal").textContent=money(fm);renderFairCommission(fm);document.getElementById("monthGrandTotal").textContent=money(bm+blm+fm);document.getElementById("balakongYearTotal").textContent=money(by);document.getElementById("belimbingYearTotal").textContent=money(bly);document.getElementById("fairYearTotal").textContent=money(fy);document.getElementById("yearGrandTotal").textContent=money(by+bly+fy);renderTodayCompanyStatus()}


function sortReportRows(list){const rank=r=>r.type==="daily"&&r.company==="balakong"?0:r.type==="daily"&&r.company==="belimbing"?1:2;return [...list].sort((a,b)=>rank(a)-rank(b)||canonicalLocation(a.location).localeCompare(canonicalLocation(b.location))||displayToISO(a.date).localeCompare(displayToISO(b.date)))}
function renderTable(){const s=sortReportRows(dedupeRows(rows).filter(r=>sameMonth(r.date)&&Number(r.amount)>0));document.getElementById("recordTable").innerHTML=s.map(r=>`<tr><td>${r.date}</td><td>${r.type==="fair"?"Fair":"每日"}</td><td>${r.type==="fair"?"Fair":(companyNames[r.company]||r.company)}</td><td>${r.location||"-"}</td><td>${money(r.amount)}</td></tr>`).join("")||'<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>'}
function renderAll(){rows=dedupeRows(rows);renderDashboard();renderBusinessTop3();renderTable();updateDailyInputFromSelectedDate();renderFairLocationOptions();updateFairPageMode();renderFairMonthlyList();renderFairDailySummary();renderFairPageTop3();renderLiveDailySummary();renderLiveMonthlyList();renderLivePageTop3()}
function setDailyTurnoverSaveButtonV382(state){
  const btn=document.getElementById('dailyTurnoverSaveBtnV382');if(!btn)return;
  if(!btn.dataset.idleText)btn.dataset.idleText=btn.textContent;
  if(state==='saving'){btn.disabled=true;btn.textContent='储存进行中…';return}
  if(state==='deleting'){btn.disabled=true;btn.textContent='删除中…';return}
  if(state==='saved'){btn.disabled=true;btn.textContent='✓ 已储存';setTimeout(()=>{btn.disabled=false;btn.textContent=btn.dataset.idleText||'储存'},1200);return}
  if(state==='deleted'){btn.disabled=true;btn.textContent='✓ 已删除';setTimeout(()=>{btn.disabled=false;btn.textContent=btn.dataset.idleText||'储存'},1200);return}
  btn.disabled=false;btn.textContent=btn.dataset.idleText||'储存';
}
async function saveDailySales(){
  if(!ensureWritableSelection())return;
  const d=isoToDisplay(document.getElementById("saleDate").value);
  const c=document.getElementById("company").value;
  const a=toAmount(document.getElementById("dailySales").value);

  if(!d){
    alert("请选择日期");
    return;
  }
  if(c==="belimbing"){
    const used=salesCardsEnteredTotalV241("daily");
    if(a+0.005<used){alert(`⚠️ 无法修改营业额\n\n当天已有销售卡合计 RM${formatAmount(used)}。\nBelimbing 营业额不能低于销售卡总额。\n请先修改或删除相关销售卡。`);return;}
  }

  const previousCloudRow=rows.find(r=>r.type==="daily"&&r.date===d&&r.company===c);
  const mutationV344=nextClientMutationV344();
  const nowV344=new Date().toISOString();
  const localRow={
    type:"daily",
    date:d,
    company:c,
    location:"",
    amount:a,
    updatedAt:nowV344,
    clientUpdatedAt:nowV344,
    ...mutationV344,
    baseCloudUpdatedAt:String(previousCloudRow?.updatedAt||"")
  };

  upsertLocalRow(localRow);
  addPendingRow(localRow);
  clearDailyTurnoverDraftV332();
  document.getElementById("dailySales").value=formatAmount(a);
  renderAll();
  setTurnoverWriteStateV382('daily',true);setDailyTurnoverSaveButtonV382('saving');

  // V29.9: normal Save uses exactly one cloud write.
  // This prevents the immediate keepalive request from racing the normal save,
  // which could turn a real change such as RM9,999 -> RM0 into a later 0 -> 0
  // comparison and suppress the modification notification.
  // The pagehide/visibility keepalive fallback remains in sheet.js for pending
  // rows only when the page is actually being closed or backgrounded.
  if(typeof saveLocalDataCache==="function")saveLocalDataCache();
  setSync("已储存 · 云端后台同步中...");

  try{
    const saved=await saveDailyToSheet(d,c,a,localRow.clientUpdatedAt,localRow.clientDeviceId,localRow.clientSequence,localRow.baseCloudUpdatedAt,true);
    if(saved)upsertLocalRow(saved);
    clearPendingRowIfVersionV343(localRow);
    renderAll();
    if(typeof saveLocalDataCache==="function")saveLocalDataCache();
    setSync("已同步",true);showTempMsg("saveMsg");setDailyTurnoverSaveButtonV382('saved');setTurnoverWriteStateV382('daily',false);
  }catch(e){
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
    else setSync("同步暂未完成",false,true);
    setDailyTurnoverSaveButtonV382('idle');setTurnoverWriteStateV382('daily',false);
  }
}
function saveFairSession(){
  const location=canonicalLocation(document.getElementById("fairLocation").value.trim());
  const start=document.getElementById("fairStart").value;
  const end=document.getElementById("fairEnd").value;

  if(!location||!start||!end)return;

  saveLocalFairSessionV320(location,start,end);
}

function getSavedFairSession(){
  try{
    const saved=JSON.parse(localStorage.getItem("lover_last_fair_session")||"null");

    if(!saved||!saved.location||!saved.start||!saved.end){
      return null;
    }

    return saved;
  }catch(e){
    return null;
  }
}

function restoreFairSession(){
  const saved=getSavedFairSession();

  if(!saved){
    return false;
  }

  document.getElementById("fairLocation").value=canonicalLocation(saved.location);
  setDateControl("fairStart",saved.start);
  setDateControl("fairEnd",saved.end);

  return true;
}

function updateFairPageMode(){
  const location=String(document.getElementById("fairLocation")?.value||"").trim();
  const hasLocation=Boolean(location);
  document.getElementById("fairEndWrap")?.classList.toggle("hidden",!hasLocation);
  document.getElementById("fairEditArea")?.classList.toggle("hidden",!hasLocation);
  document.getElementById("fairViewOnlyHint")?.classList.toggle("hidden",hasLocation);
  document.getElementById("fairDateRange")?.classList.toggle("view-only",!hasLocation);
  const label=document.getElementById("fairStartLabel");
  if(label)label.textContent=hasLocation?"开始日期":"查看日期";
  if(!hasLocation){
    const start=document.getElementById("fairStart")?.value||todayISO();
    setDateControl("fairEnd",start);
    const inputs=document.getElementById("fairInputs");
    if(inputs)inputs.innerHTML="";
  }
}

function syncFairInputs(){const start=document.getElementById("fairStart").value,end=document.getElementById("fairEnd").value,loc=canonicalLocation(document.getElementById("fairLocation").value.trim());if(!start||!end||new Date(start)>new Date(end)){document.getElementById("fairInputs").innerHTML="";return}let html="<h3>Fair 每日营业额</h3>";dateRange(start,end).forEach(d=>{const old=rows.find(r=>r.type==="fair"&&r.date===d&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));html+=`<label>${d} 营业额</label><input type="text" class="fairAmount money-input fair-amount-v341" data-date="${d}" value="${old?formatAmount(old.amount):"0.00"}" inputmode="decimal">`});document.getElementById("fairInputs").innerHTML=html;attachMoneyInputs();syncFairProductDatesV203()}
function fairInputsHaveUnsavedChanges(){
  const container=document.getElementById("fairInputs");
  const location=canonicalLocation(String(document.getElementById("fairLocation")?.value||"").trim());
  if(!container||!location)return false;
  const inputs=[...container.querySelectorAll(".fairAmount[data-date]")];
  return inputs.some(input=>{
    const date=String(input.dataset.date||"");
    const saved=rows.find(r=>r.type==="fair"&&r.date===date&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(location));
    const savedAmount=saved?Number(saved.amount||0):0;
    return Math.abs(toAmount(input.value)-savedAmount)>0.00001;
  });
}
function refreshFairInputsFromRows(force=false){
  const location=String(document.getElementById("fairLocation")?.value||"").trim();
  if(!location)return false;
  if(!force&&fairInputsHaveUnsavedChanges())return false;
  syncFairInputs();
  return true;
}
async function saveFairSales(){const fairLocationValue=String(document.getElementById("fairLocation")?.value||"").trim();if(!fairLocationValue){alert("请先输入 Fair 地点");return;}
  if(!ensureWritableSelection())return;
  const loc=canonicalLocation(document.getElementById("fairLocation").value.trim());
  const inputs=document.querySelectorAll(".fairAmount");

  if(!loc){
    alert("请输入 Fair 地点");
    return;
  }

  document.getElementById("fairLocation").value=loc;

  if(!inputs.length){
    alert("请选择 Fair 日期");
    return;
  }

  const now=new Date().toISOString();
  const mutationV344=nextClientMutationV344();
  // V35.0: send only real changes.  Unchanged Date Range days (especially
  // untouched 0.00 days) are not pending work and must never reappear as ten
  // "未同步" records on the next open.
  const records=[...inputs].map(i=>{
    const date=String(i.dataset.date||""),amount=toAmount(i.value);
    const previous=rows.find(r=>r.type==="fair"&&r.date===date&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));
    const previousAmount=previous?Number(previous.amount||0):0;
    if(Math.abs(amount-previousAmount)<=0.005)return null;
    return{date,amount,clientUpdatedAt:now,...mutationV344,baseCloudUpdatedAt:String(previous?.updatedAt||"")};
  }).filter(Boolean);

  // V36.0 DATA-SAFETY: queue the exact mutation first, but do NOT mutate the
  // authoritative local rows/Home until Google Sheet confirms the write.
  // This prevents the dangerous half-success state where this device shows
  // RM1350 while every other device/cloud still has RM1200.
  records.forEach(i=>{
    const row={
      type:"fair",
      date:i.date,
      company:"fair",
      location:loc,
      amount:i.amount,
      updatedAt:now,
      clientUpdatedAt:i.clientUpdatedAt||now,
      clientDeviceId:i.clientDeviceId||"",
      clientSequence:Number(i.clientSequence||0),
      baseCloudUpdatedAt:i.baseCloudUpdatedAt||"",
      restoreGeneration:Number(i.restoreGeneration||0)
    };
    addPendingRow(row);
    if(typeof markLocalRowMutation==="function")markLocalRowMutation(row);
  });

  // Keep the user's edited values visible in the Fair inputs while pending.
  // Home/dashboard continues to show only the last cloud-confirmed value.
  if(records.length)setSync("正在储存 Fair 到云端，请勿关闭页面...");
  // V32.6: Fair Session is saved even when every daily amount is 0.00.
  // This preserves each location's date range for instant switching; 0.00 still does not count as sales.
  const fairStartV320=document.getElementById("fairStart").value;
  const fairEndV320=document.getElementById("fairEnd").value;
  saveLocalFairSessionV320(loc,fairStartV320,fairEndV320,now);
  saveFairLocation(loc);
  fairSessionDraftDirtyV282=false;

  try{
    setSync("已储存，正在后台同步...");
    const start=document.getElementById("fairStart").value,end=document.getElementById("fairEnd").value;
    await saveFairSessionToSheetV281(loc,start,end);
    fairSessionDraftDirtyV282=false;
    saveFairSession();
    await refreshFairSessionsV281();
    const result=records.length?await saveFairBatchToSheet(loc,records,true):{ok:true,rows:[]};
    if(result&&Array.isArray(result.rows)){
      result.rows.forEach(r=>{
        if(Number(r.amount||0)<=0)rows=rows.filter(x=>syncKey(x)!==syncKey(r));
        else upsertLocalRow(r);
      });
      renderAll();
      syncFairInputs();
    }
    // V32.6: only a successfully saved Fair becomes a reusable history location.
    saveFairLocation(loc);

    // V29.9: local Fair values are direct replacements, never additions. The server
    // also removes duplicate Sheet rows whose location differs only by spaces/case.
    // The response confirms the authoritative overwrite and clears pending rows.
    records.forEach(i=>clearPendingRowIfVersionV343({
      type:"fair",
      date:i.date,
      company:"fair",
      location:loc,
      clientUpdatedAt:i.clientUpdatedAt
    }));
    if(typeof saveLocalDataCache==="function")saveLocalDataCache();
    if(records.length){
      showTempMsg("fairSaveMsg");
      const inline=result&&result.inlineNotification;
      if(inline&&inline.inline&&inline.attempted>0&&Number(inline.failed||0)>0){
        setSync("Fair 已储存到云端，但通知发送失败",true);
        if(typeof setLastNotificationDispatchStatus==="function")setLastNotificationDispatchStatus(inline);
      }else{
        setSync("已同步",true);
        if(inline&&inline.inline&&typeof setLastNotificationDispatchStatus==="function")setLastNotificationDispatchStatus(inline);
      }
    }else setSync("已同步",true);
  }catch(e){
    // V36.0: never report a failed cloud save as stored.  The exact edited
    // amount remains durable in pendingRows and will retry automatically.
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
    else setSync("同步暂未完成",false,true);
    const msg=document.getElementById("fairSaveMsg");
    if(msg){msg.textContent="⚠️ 尚未写入云端，已保留待同步资料";msg.classList.remove("hidden");setTimeout(()=>msg.classList.add("hidden"),5000);}
  }
}
function exportCSV(scope="month"){let csv="\uFEFF公司,日期,类别,地点,营业额\n";const selected=sortReportRows(dedupeRows(rows).filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0));selected.forEach(r=>{csv+=`"${r.type==="fair"?"Fair":(companyNames[r.company]||r.company)}",${r.date},"${r.type==="fair"?"Fair":"每日"}","${r.location||""}",${Number(r.amount).toFixed(2)}\n`});downloadFile(`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.csv`,csv,"text/csv;charset=utf-8;")}
const ACTIVE_MONTH_STORAGE_KEY="lover_sales_active_month_v82";
let systemState={currentMonth:monthISO(),closedMonths:[],commissionSnapshots:{},dataVersion:"5180",restoreGeneration:0};
function saveActiveMonth(month){if(/^\d{4}-\d{2}$/.test(String(month||"")))localStorage.setItem(ACTIVE_MONTH_STORAGE_KEY,String(month))}
function isSelectedMonthWritable(){return true}
function ensureWritableSelection(){return true}
function updateReadOnlyMode(){
  const m=selectedMonth(),closed=systemState.closedMonths.includes(m),history=m!==systemState.currentMonth;
  document.body.classList.remove("readonly-page");
  const el=document.getElementById("monthMode");
  if(el){
    el.className="month-mode "+(closed?"closed-mode":history?"history-mode":"current-mode");
    el.textContent=closed?`${m} · 已结算 · 可修正`:history?`${m} · 历史月份 · 可编辑`:`${m} · 当前月份 · 可编辑`;
  }
}
function sanitizeClosedMonthsClientV197(months,currentMonth){
  const current=String(currentMonth||monthISO()),now=new Date(),isCurrentLastDay=now.getDate()===new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  return [...new Set((Array.isArray(months)?months:[]).map(m=>String(m||"")).filter(m=>/^\d{4}-\d{2}$/.test(m)))]
    .filter(m=>m<current||(m===current&&isCurrentLastDay)).sort();
}
function applySystemState(state){if(state){systemState.currentMonth=state.currentMonth||monthISO();systemState.closedMonths=sanitizeClosedMonthsClientV197(state.closedMonths,systemState.currentMonth);systemState.commissionSnapshots=state.commissionSnapshots||{};systemState.dataVersion=state.dataVersion||"5180";systemState.restoreGeneration=Math.max(0,Number(state.restoreGeneration||0));if(typeof applyRestoreGenerationV347==='function')applyRestoreGenerationV347(systemState.restoreGeneration)}updateReadOnlyMode()}
async function monthClose(){
  const m=selectedMonth();
  if(m!==systemState.currentMonth){alert("只能结算系统当前月份："+systemState.currentMonth);return}
  if(systemState.closedMonths.includes(m)){alert(m+" 已经完成月底结算。\n系统日期进入新月份后会自动切换。");return}
  const now=new Date(),lastDay=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();if(now.getDate()!==lastDay){alert(`月底结算只能在当月最后一天执行。\n今天是 ${now.getDate()} 日，本月最后一天是 ${lastDay} 日。`);return}
  const ok=confirm(`准备完成 ${m} 月底结算。\n\n强烈建议先按“导出本月 Excel”，确认资料完整并保存副本。\n\n结算后：\n• 不会立即切换到下个月\n• ${m} 会保留“已结算”状态，但发现手误时仍可修正\n• Sales、Fair、Live、Commission、关联盆栽、成本、利润与备注全部保留，不会删除\n• 系统日期进入新月份后才自动切换\n\n确定继续结算？`);
  if(!ok)return;
  try{setSync("正在完成月底结算...");const result=await closeMonthInSheet(m);applySystemState(result.systemState);setSync("月底结算已完成",true);alert(`${m} 月底结算已完成。\n目前仍停留在 ${m}，资料仍可在以后发现错误时修正。\n系统日期进入新月份后会自动切换。`)}catch(e){alert("月底结算失败："+e.message);setSync("月底结算失败",false,true)}
}
async function yearClose(){
  const y=selectedYear(),now=new Date(),cy=String(now.getFullYear());
  if(y!==cy){alert("年底结算只能执行系统当前年份："+cy);return}
  if(now.getMonth()!==11||now.getDate()!==31){alert("年底结算只能在 12 月 31 日执行。\n全年资料在年底前必须继续保留。");return}
  if(!confirm(`准备进行 ${y} 年底结算。\n\n⚠️ 这是全年唯一允许清除年度营运资料的功能。\n\n请先确认：\n• 已完成 Backup 完整备份\n• 已导出全年 Excel\n• 已核对 Sales / Fair / Live / Commission / 关联盆栽 / 成本 / 利润 / 备注\n\n月底结算不会删除资料；只有年底结算会清除 ${y} 年度营运记录。\n\n确定继续？`))return;
  const phrase=prompt(`最后确认：请输入 YEAR END ${y}`);
  if(String(phrase||"").trim()!==`YEAR END ${y}`){alert("确认文字不正确，已取消。");return}
  try{setSync("正在执行年底结算...");const result=await closeYearInSheet(y);applySystemState(result.systemState);await loadFromSheet({force:true});renderAll();setSync("年底结算已完成",true);alert(`${y} 年底结算完成。请妥善保存结算前 Backup 与全年 Excel。`)}
  catch(e){alert("年底结算失败："+e.message);setSync("年底结算失败",false,true)}
}
function initializeCurrentMonth(){
  const current=monthISO();
  document.getElementById("monthPicker").value=current;
  document.getElementById("yearPicker").value=current.slice(0,4);
  const dashboardDate=document.getElementById("dashboardDate");
  if(dashboardDate&&!dashboardDate.value)setDateControl("dashboardDate",todayISO());
  saveActiveMonth(current);
}
initializeCurrentMonth();
const dailyTotalsMonthPicker=document.getElementById("dailyTotalsMonth");
if(dailyTotalsMonthPicker){
  dailyTotalsMonthPicker.value=selectedMonth();
  dailyTotalsMonthPicker.addEventListener("change",async()=>{
    const month=dailyTotalsMonthPicker.value;
    if(!/^\d{4}-\d{2}$/.test(month))return;
    await loadDailyTotalsMonth(month);
  });
}
setDateControl("saleDate",todayISO());
installDailyTurnoverDraftGuardV332();

const fairSessionRestored=restoreFairSession();

if(!fairSessionRestored){
  setDateControl("fairStart",todayISO());
  setDateControl("fairEnd",todayISO());
}

bindDateControl("saleDate",async()=>{
  updateDailyInputFromSelectedDate();
  await ensureDateControlMonthLoaded("saleDate");
  updateDailyInputFromSelectedDate();
});

bindDateControl("fairStart",async()=>{
  updateFairPageMode();
  if(String(document.getElementById("fairLocation")?.value||"").trim()){syncFairInputs();syncFairProductDatesV203(true);}
  renderFairDailySummary();
  renderFairMonthlyList();
  await ensureDateControlMonthLoaded("fairStart");
  renderFairDailySummary();
  renderFairMonthlyList();
});

bindDateControl("fairEnd",async()=>{
  if(String(document.getElementById("fairLocation")?.value||"").trim()){syncFairInputs();syncFairProductDatesV203(true);}
  renderFairMonthlyList();
  await ensureDateControlMonthLoaded("fairEnd");
  renderFairMonthlyList();
});

renderFairLocationOptions();
const fairLocationInput=document.getElementById("fairLocation");
if(fairLocationInput){
  fairLocationInput.addEventListener("input",()=>{
    updateFairPageMode();
    if(String(fairLocationInput.value||"").trim()){syncFairInputs();syncFairProductDatesV203(true);}
    renderFairMonthlyList();
  });
  fairLocationInput.addEventListener("change",()=>{const loc=canonicalLocation(fairLocationInput.value||"");if(loc&&findFairSessionV320(loc))switchFairLocationV320(loc);else refreshProductLinkContextV210("fair")});
  fairLocationInput.addEventListener("blur",()=>{const loc=canonicalLocation(fairLocationInput.value||"");if(loc&&findFairSessionV320(loc))switchFairLocationV320(loc);else refreshProductLinkContextV210("fair")});
}
updateFairPageMode();
["fairLocation","fairStart","fairEnd"].forEach(id=>{const el=document.getElementById(id);if(el&&!el.dataset.fairDraftV282){el.dataset.fairDraftV282="1";el.addEventListener("input",()=>{fairSessionDraftDirtyV282=true});el.addEventListener("change",()=>{fairSessionDraftDirtyV282=true})}});
setTimeout(()=>refreshFairSessionsV281({applyLatest:true,forceApply:!fairSessionDraftDirtyV282}),250);

document.getElementById("monthPicker").addEventListener("change",async()=>{
  saveActiveMonth(selectedMonth());
  renderLiveRateSchedules();
  document.getElementById("yearPicker").value=selectedMonth().slice(0,4);

  const dashboardDate=document.getElementById("dashboardDate");
  if(dashboardDate){
    const currentDate=dashboardDate.value;
    if(!currentDate||currentDate.slice(0,7)!==selectedMonth()){
      setDateControl(
        "dashboardDate",
        selectedMonth()===monthISO()?todayISO():selectedMonth()+"-01"
      );
    }
  }

  const reportPicker=document.getElementById("reportMonthPicker");
  if(reportPicker)reportPicker.value=selectedMonth();
  renderAll();
  updateReadOnlyMode();
  await loadFromSheet({force:true});
});
const reportMonthPicker=document.getElementById("reportMonthPicker");
if(reportMonthPicker){
  reportMonthPicker.value=selectedMonth();
  reportMonthPicker.addEventListener("change",async()=>{
    const month=reportMonthPicker.value;
    if(!/^\d{4}-\d{2}$/.test(month))return;
    document.getElementById("monthPicker").value=month;
    document.getElementById("yearPicker").value=month.slice(0,4);
    saveActiveMonth(month);
    renderAll();
    updateReadOnlyMode();
    await loadFromSheet({force:true});
  });
}
setDateControl("dashboardDate",selectedDashboardDateISO());
bindDateControl("dashboardDate",async()=>{
  const dashboardDatePicker=document.getElementById("dashboardDate");
  if(!dashboardDatePicker.value){
    setDateControl("dashboardDate",todayISO());
  }

  const dateMonth=dashboardDatePicker.value.slice(0,7);
  if(dateMonth&&dateMonth!==selectedMonth()){
    document.getElementById("monthPicker").value=dateMonth;
    document.getElementById("yearPicker").value=dateMonth.slice(0,4);
    saveActiveMonth(dateMonth);
    const reportPicker=document.getElementById("reportMonthPicker");
    if(reportPicker)reportPicker.value=dateMonth;
    renderAll();
    updateReadOnlyMode();
    await loadFromSheet({force:true});
    return;
  }

  renderDashboard();
});

document.getElementById("yearPicker").addEventListener("change",renderAll);
document.getElementById("company").addEventListener("change",updateDailyInputFromSelectedDate);

document.getElementById("fairLocation").addEventListener("focus",()=>{
  renderFairLocationHistoryV309();
  document.getElementById("fairLocationHistoryV309")?.classList.remove("hidden");
});
document.getElementById("fairLocation").addEventListener("input",()=>{
  syncFairInputs();
  syncFairProductDatesV203(true);
});

document.getElementById("fairLocation").addEventListener("blur",()=>{
  const input=document.getElementById("fairLocation");
  input.value=canonicalLocation(input.value);
  // V32.6: typing/blurring alone must not create history. A location is added
  // only after Fair is successfully saved to cloud.
  saveFairSession();
  syncFairInputs();
  setTimeout(()=>document.getElementById("fairLocationHistoryV309")?.classList.add("hidden"),180);
});

// V46.0: paint Home immediately from Local First cache, then perform one
// lightweight GLOBAL Revision check. Full month data is downloaded only when
// any other device/cloud write advanced the global Revision.
attachMoneyInputs();
try { renderAll(); } catch (error) { console.warn("Initial empty Home render failed", error); }
setTimeout(()=>{
  try{
    const last=localStorage.getItem(LAST_PAGE_KEY_V238)||"home";
    const allowed=new Set(["home","sales","fair","live","report","more"]);
    const page=allowed.has(last)?last:"home";
    const nav=document.querySelector(`.nav-item[data-page="${page}"]`);
    if(nav)showPage(page,nav);
  }catch(e){}
},0);

let startupCacheLoaded = false;
let startupSalesSyncPromise = null;

function waitForFirstHomePaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function startInitialSalesDataLoad() {
  if (startupSalesSyncPromise) return startupSalesSyncPromise;

  let startupStatusTimer = setTimeout(() => {
    if (typeof markCloudCheckPending === "function") {
      markCloudCheckPending("正在快速确认云端...");
    }
  }, 2200);

  startupSalesSyncPromise = (async () => {
    await waitForFirstHomePaint();

    try {
      startupCacheLoaded = typeof loadLocalDataCacheAsync === "function"
        ? await loadLocalDataCacheAsync()
        : (typeof loadLocalDataCache === "function" && loadLocalDataCache());
    } catch (error) {
      startupCacheLoaded = false;
      console.warn("Local cache startup failed", error);
    }

    if (typeof markCloudCheckPending === "function") {
      markCloudCheckPending(startupCacheLoaded
        ? "正在快速确认云端..."
        : "正在读取云端资料");
    }

    // This forced read is deliberately inside finally-style startup flow:
    // local cache failure can never prevent cloud synchronization.
    const result = await loadFromSheet({
      background: true,
      force: false,
      loadYear: false,
      suppressStartStatus: true,
      revisionTimeoutMs: 2500,
      timeoutMs: 10000
    });

    try { syncFairInputs(); } catch (error) {}
    return result;
  })().catch(error => {
    console.warn("Initial sales data load failed", error);
    return { ok:false, error };
  }).finally(() => {
    clearTimeout(startupStatusTimer);
  });

  return startupSalesSyncPromise;
}

// V46.0: startup performs only Local First + the lightweight global Revision
// gate. Do NOT download the whole year on every app open. Historical year data
// remains on-demand when Monthly Summary/report features are opened.
startInitialSalesDataLoad();


/* ===== V7.3 Live Module ===== */
function normalizeLiveHostKey(value){
  return String(value||"").replace(/\s+/g,"").toLowerCase();
}
function canonicalLiveHost(value){
  return String(value||"").trim().replace(/\s+/g," ");
}
function rowKey(r){
  const location=r.type==="live"
    ? normalizeLiveHostKey(r.location||"")
    : normalizeFairLocationKey(r.location||"");
  const company=r.type==="daily"?canonicalDailyCompanyKeyV518(r.company||r.location||""):r.company;
  return [r.type,r.date,company,location].join("|");
}
function getSavedLiveHosts(){
  try{return JSON.parse(localStorage.getItem("lover_live_hosts_v69")||"[]")}catch(e){return[]}
}
function collectLiveHosts(){
  const merged=[];
  const cloudHosts=Object.values((getCommissionSettings().liveHosts)||{});
  // V29.9: active host list is independent from historical Live records.
  // Deleted hosts stay in old reports but do not return to current host options.
  [...cloudHosts,...getSavedLiveHosts()]
    .filter(Boolean)
    .forEach(name=>{
      const key=normalizeLiveHostKey(name);
      if(key&&!merged.some(x=>normalizeLiveHostKey(x)===key))merged.push(canonicalLiveHost(name));
    });
  merged.sort((a,b)=>a.localeCompare(b));
  localStorage.setItem("lover_live_hosts_v69",JSON.stringify(merged));
  return merged;
}
function saveLiveHost(name){
  const host=canonicalLiveHost(name);
  if(!host)return;
  const list=collectLiveHosts();
  if(!list.some(x=>normalizeLiveHostKey(x)===normalizeLiveHostKey(host)))list.push(host);
  localStorage.setItem("lover_live_hosts_v69",JSON.stringify(list));
  renderLiveHostOptions();
}
function renderLiveHostOptions(){
  const el=document.getElementById("liveHostOptions");
  if(el)el.innerHTML=collectLiveHosts().map(name=>`<option value="${name}"></option>`).join("");
}
function selectedLiveHost(){
  const input=document.getElementById("liveHost");
  if(!input)return"";
  const raw=canonicalLiveHost(input.value);
  const existing=collectLiveHosts().find(x=>normalizeLiveHostKey(x)===normalizeLiveHostKey(raw));
  return existing||raw;
}
function getLiveAmount(date,host){
  const key=normalizeLiveHostKey(host);
  const found=rows.find(r=>r.type==="live"&&r.date===date&&normalizeLiveHostKey(r.location)===key);
  return found?Number(found.amount||0):0;
}
const LIVE_TURNOVER_DRAFT_KEY_V332="lover_live_turnover_drafts_v332";
function liveTurnoverDraftContextV332(){
  const dateISO=String(document.getElementById("liveDate")?.value||"");
  const host=selectedLiveHost();
  return dateISO&&host?dateISO+"|"+normalizeLiveHostKey(host):"";
}
function readLiveTurnoverDraftsV332(){
  try{const value=JSON.parse(localStorage.getItem(LIVE_TURNOVER_DRAFT_KEY_V332)||"{}");return value&&typeof value==="object"?value:{}}catch(_){return{}}
}
function getLiveTurnoverDraftV332(){
  const key=liveTurnoverDraftContextV332();
  return key?readLiveTurnoverDraftsV332()[key]||null:null;
}
function saveLiveTurnoverDraftV332(value){
  const key=liveTurnoverDraftContextV332();if(!key)return;
  const drafts=readLiveTurnoverDraftsV332();
  drafts[key]={value:String(value??""),updatedAt:Date.now()};
  try{localStorage.setItem(LIVE_TURNOVER_DRAFT_KEY_V332,JSON.stringify(drafts))}catch(_){}
}
function clearLiveTurnoverDraftV332(dateDisplay,host){
  const iso=displayToISO(String(dateDisplay||""));
  const key=iso&&host?iso+"|"+normalizeLiveHostKey(host):liveTurnoverDraftContextV332();
  if(!key)return;
  const drafts=readLiveTurnoverDraftsV332();delete drafts[key];
  try{localStorage.setItem(LIVE_TURNOVER_DRAFT_KEY_V332,JSON.stringify(drafts))}catch(_){}
}
function installLiveTurnoverDraftGuardV332(){
  const input=document.getElementById("liveSales");if(!input||input.dataset.draftGuardV332==="1")return;
  input.dataset.draftGuardV332="1";
  input.addEventListener("input",()=>saveLiveTurnoverDraftV332(input.value));
  input.addEventListener("change",()=>saveLiveTurnoverDraftV332(input.value));
}
function updateLiveInputFromSelectedDate(){
  const dateEl=document.getElementById("liveDate");
  const amountEl=document.getElementById("liveSales");
  const resultEl=document.getElementById("liveDateResult");
  if(!dateEl||!amountEl||!resultEl)return;
  const d=isoToDisplay(dateEl.value);
  const host=selectedLiveHost();
  const amount=host?getLiveAmount(d,host):0;
  // V35.0: background render/sync must never overwrite an unsaved amount.
  // Drafts are isolated by exact host + date and survive mobile page suspension.
  const draft=getLiveTurnoverDraftV332();
  amountEl.value=draft?String(draft.value):formatAmount(amount);
  renderSavedTurnoverSummaryV333(resultEl,host||"请选择或输入主播",d,host?amount:null);
  renderLiveDailySummary();
  renderLiveMonthlyList();
  if(typeof refreshSalesActionLocksV270==="function")refreshSalesActionLocksV270();
}
function getLiveSelectedMonth(){
  const dateEl=document.getElementById("liveDate");
  const value=String(dateEl&&dateEl.value||"");
  return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(0,7):selectedMonth();
}

function monthFromDateControl(id){
  const el=document.getElementById(id);
  const value=String(el&&el.value||"");
  return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(0,7):selectedMonth();
}

async function ensureDateControlMonthLoaded(id){
  const month=monthFromDateControl(id);
  if(!month)return {ok:true,skipped:true};

  const hasMonth=rows.some(r=>displayToISO(r.date).slice(0,7)===month);
  if(hasMonth)return {ok:true,cached:true,month};

  if(typeof loadFromSheet==="function"){
    return loadFromSheet({
      force:true,
      silent:true,
      suppressStartStatus:true,
      loadYear:false,
      month
    });
  }
  return {ok:true,skipped:true,month};
}


/* ================= V29.9 on-demand 修改 / 销售记录 ================= */
const salesChangeLogOpenV200={daily:false,fair:false,live:false};

function changeLogPanelIdV200(type){
  return type==="daily"?"salesChangeLogPanel":type==="fair"?"fairChangeLogPanel":"liveChangeLogPanel";
}
function selectedChangeLogDateV200(type){
  if(type==="fair")return String(document.getElementById("fairProductDate")?.value||"");
  const id=type==="daily"?"saleDate":"liveDate";
  return isoToDisplay(String(document.getElementById(id)?.value||""));
}
function escapeChangeLogHtmlV200(value){
  return String(value==null?"":value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}
function changeLogEntityNameV200(type,item){
  if(type==="daily")return companyNames[item.company]||item.company||"Sales";
  if(type==="fair")return canonicalLocation(item.location||"Fair");
  return canonicalLiveHost(item.location||"Live");
}
function renderChangeLogTimelineV200(type,date,items){
  const panel=document.getElementById(changeLogPanelIdV200(type));
  if(!panel)return;
  const clean=Array.isArray(items)?items:[];
  const groups=[];
  clean.forEach(item=>{
    const name=changeLogEntityNameV200(type,item);
    const key=type==="daily"?String(item.company||""):type==="fair"?normalizeFairLocationKey(name):normalizeLiveHostKey(name);
    let group=groups.find(g=>g.key===key);
    if(!group){group={key,name,items:[]};groups.push(group);}
    group.items.push(item);
  });

  // V29.9 display rule:
  // 1) any real audit row must be shown, including a single first sale (0 -> amount).
  // 2) later changes keep the first/original amount in the full timeline.
  // 3) downward correction is attached to the amount BEFORE that correction, so every row explains what happened next.
  // Only a date/entity with absolutely no audit rows shows "没有修改 / 销售记录".
  const changedGroups=groups.filter(group=>{
    const ordered=[...group.items].sort((a,b)=>Number(a.timestampMs||0)-Number(b.timestampMs||0));
    return ordered.length>0;
  });
  if(!changedGroups.length){
    panel.innerHTML=`<div class="change-log-date-title">${escapeChangeLogHtmlV200(date||"-")}</div><div class="change-log-empty">没有修改 / 销售记录</div>`;
    return;
  }

  const nextDeltaHtml=item=>{
    if(!item)return "";
    const delta=Number(item.delta||0);
    if(!delta)return "";
    const correcting=delta<0;
    const cls=correcting?"negative":"positive";
    const sign=correcting?"-":"+";
    const suffix=correcting?" 修正":"";
    return `<strong class="change-log-delta ${cls}">→ ${sign}${money(Math.abs(delta))}${suffix}</strong>`;
  };

  panel.innerHTML=`<div class="change-log-date-title">${escapeChangeLogHtmlV200(date)} · 修改 / 销售记录</div>`+changedGroups.map(group=>{
    const ordered=[...group.items].sort((a,b)=>Number(a.timestampMs||0)-Number(b.timestampMs||0));
    const first=ordered[0];
    const hasRecordedOriginal=Number(first.oldAmount||0)<=0;
    let rowsHtml="";

    // Old data that existed before the audit timeline has no trustworthy original timestamp.
    // Show the known original amount without inventing a time. Its right-side arrow explains the first real change.
    if(!hasRecordedOriginal && Number(first.oldAmount||0)>0){
      rowsHtml+=`<div class="change-log-row change-log-origin"><span class="change-log-time">—</span><span class="change-log-kind">原有金额</span><span class="change-log-value"><strong class="change-log-cumulative">${money(Number(first.oldAmount||0))}</strong>${nextDeltaHtml(first)}</span></div>`;
    }

    rowsHtml+=ordered.map((item,index)=>{
      const newAmount=Number(item.newAmount||0);
      const isRecordedFirst=hasRecordedOriginal&&index===0;
      const kind=isRecordedFirst?"第一笔销售":"当前累计";
      // The delta shown on this row belongs to the NEXT saved state.
      // Example: RM300 → +RM500, next row is RM800.
      const nextItem=ordered[index+1]||null;
      const deltaHtml=nextDeltaHtml(nextItem);
      const saleClass=((type==="live"||type==="fair")&&isRecordedFirst)?" bonsai-sale-amount":"";return `<div class="change-log-row"><span class="change-log-time">${escapeChangeLogHtmlV200(item.time||"")}</span><span class="change-log-kind">${kind}</span><span class="change-log-value"><strong class="change-log-cumulative${saleClass}">${money(newAmount)}</strong>${deltaHtml}</span></div>`;
    }).join("");

    const finalTotal=ordered.length?Number(ordered[ordered.length-1].newAmount||0):0;
    return `<div class="change-log-group"><div class="change-log-group-title">${escapeChangeLogHtmlV200(group.name)}</div>${rowsHtml}<div class="change-log-total"><span>总数</span><strong>${money(finalTotal)}</strong></div></div>`;
  }).join("");
}
async function toggleSalesChangeLogV200(type,button){
  const panel=document.getElementById(changeLogPanelIdV200(type));
  if(!panel)return;
  const date=selectedChangeLogDateV200(type);
  if(!date){alert("请先选择日期");return;}
  // Same selected date: second click closes. If the user changed the date while
  // the panel stayed open, one click refreshes directly to the newly selected date.
  if(salesChangeLogOpenV200[type]&&String(panel.dataset.logDate||"")===date){
    salesChangeLogOpenV200[type]=false;
    panel.classList.add("hidden");
    panel.innerHTML="";
    panel.dataset.logDate="";
    if(button)button.classList.remove("active");
    return;
  }
  salesChangeLogOpenV200[type]=true;
  panel.dataset.logDate=date;
  panel.classList.remove("hidden");
  const pendingForDate=(typeof pendingRows!=="undefined")&&pendingRows.some(r=>String(r.type||"")===type&&String(r.date||"")===date);
  // Fair audit data is location-specific. The legacy cache is date-only, so
  // never paint another Fair location while the exact cloud query is running.
  const cachedLogs=type!=="fair"&&!pendingForDate&&typeof getSalesChangeLogCacheV237==="function"?getSalesChangeLogCacheV237(type,date):null;
  if(Array.isArray(cachedLogs))renderChangeLogTimelineV200(type,date,cachedLogs);
  else panel.innerHTML=`<div class="change-log-loading">正在读取 ${escapeChangeLogHtmlV200(date)} 最新记录...</div>`;
  if(button)button.classList.add("active");
  try{
    const data=await loadSalesChangeLogFromSheetV200(type,date,{force:true,location:type==="fair"?canonicalLocation(document.getElementById("fairLocation")?.value||""):""});
    if(!salesChangeLogOpenV200[type]||String(panel.dataset.logDate||"")!==date)return;
    const fresh=Array.isArray(data&&data.logs)?data.logs:[];
    if(!Array.isArray(cachedLogs)||JSON.stringify(cachedLogs)!==JSON.stringify(fresh)){
      renderChangeLogTimelineV200(type,date,fresh);
    }
  }catch(error){
    if(!salesChangeLogOpenV200[type]||String(panel.dataset.logDate||"")!==date)return;
    if(!Array.isArray(cachedLogs))panel.innerHTML=`<div class="change-log-empty">读取失败，请稍后再试</div>`;
    else console.warn("修改/销售记录后台核对失败",error);
  }
}

function renderSalesMonthlyList(){
  const container=document.getElementById("salesMonthlyList");
  const totalEl=document.getElementById("salesMonthlyTotal");
  const titleEl=document.getElementById("salesMonthlyTitle");
  const labelEl=document.getElementById("salesMonthlyTotalLabel");
  if(!container||!totalEl)return;

  const month=monthFromDateControl("saleDate");
  const monthLabel=/^\d{4}-\d{2}$/.test(month)?`${month.slice(5,7)}-${month.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`${monthLabel} 销售记录`;
  if(labelEl)labelEl.textContent=`${monthLabel} 总销售额`;

  const list=rows
    .filter(r=>r.type==="daily"&&displayToISO(r.date).slice(0,7)===month&&Number(r.amount)>0)
    .sort((a,b)=>
      String(a.company||"").localeCompare(String(b.company||""))||
      displayToISO(a.date).localeCompare(displayToISO(b.date))
    );

  const total=list.reduce((sum,r)=>sum+Number(r.amount||0),0);
  if(!list.length){
    container.innerHTML='<div class="sub">这个月份还没有 Sales 记录</div>';
    totalEl.textContent="0.00";
    renderFairPageTop3();
    return;
  }

  const companies=["balakong","belimbing"];
  container.innerHTML=companies.map(company=>{
    const companyRows=list.filter(r=>r.company===company);
    if(!companyRows.length)return "";
    const companyTotal=companyRows.reduce((sum,r)=>sum+Number(r.amount||0),0);
    return `<div class="month-record-group">
      <div class="month-record-group-title">${companyNames[company]||company}</div>
      ${companyRows.map(r=>`<div class="month-record-row">
        <span>${r.date}</span>
        <strong>${money(r.amount)}</strong>
      </div>`).join("")}
      <div class="month-record-row month-record-total">
        <span>总数</span>
        <strong>${money(companyTotal)}</strong>
      </div>
    </div>`;
  }).join("");

  totalEl.textContent=money(total);
}


function renderFairDailySummary(){
  const card=document.getElementById("fairDailySummaryCard");
  const list=document.getElementById("fairDailySummaryList");
  const totalEl=document.getElementById("fairDailySummaryTotal");
  const title=document.getElementById("fairDailySummaryTitle");
  if(!card||!list||!totalEl)return;
  const location=String(document.getElementById("fairLocation")?.value||"").trim();
  const date=isoToDisplay(String(document.getElementById("fairStart")?.value||""));
  card.classList.toggle("hidden",Boolean(location));
  if(location)return;
  if(title)title.textContent=`Fair ${date||"-"} 当日销售`;
  const data=rows.filter(r=>r.type==="fair"&&r.date===date&&Number(r.amount)>0)
    .map(r=>({...r,name:canonicalLocation(r.location||"Fair")}))
    .sort((a,b)=>a.name.localeCompare(b.name,"en",{sensitivity:"base"}));
  list.className="daily-summary-list";
  list.innerHTML=data.length?data.map(r=>`<div class="daily-summary-row"><span>${r.name}</span><strong>${money(r.amount)}</strong></div>`).join(""):'<div class="daily-summary-empty">当天没有 Fair 销售记录</div>';
  totalEl.textContent=money(data.reduce((s,r)=>s+Number(r.amount||0),0));
}
function renderLiveDailySummary(){
  const card=document.getElementById("liveDailySummaryCard");
  const list=document.getElementById("liveDailySummaryList");
  const totalEl=document.getElementById("liveDailySummaryTotal");
  const title=document.getElementById("liveDailySummaryTitle");
  if(!card||!list||!totalEl)return;
  const host=selectedLiveHost();
  const date=isoToDisplay(String(document.getElementById("liveDate")?.value||""));
  card.classList.toggle("hidden",Boolean(host));
  if(host)return;
  if(title)title.textContent=`Live ${date||"-"} 当日销售`;
  const data=rows.filter(r=>r.type==="live"&&r.date===date&&Number(r.amount)>0)
    .map(r=>({...r,name:canonicalLiveHost(r.location||"")}))
    .sort((a,b)=>a.name.localeCompare(b.name,"en",{sensitivity:"base"}));
  list.className="daily-summary-list";
  list.innerHTML=data.length?data.map(r=>`<div class="daily-summary-row"><span>${r.name}</span><strong>${money(r.amount)}</strong></div>`).join(""):'<div class="daily-summary-empty">当天没有 Live 销售记录</div>';
  totalEl.textContent=money(data.reduce((s,r)=>s+Number(r.amount||0),0));
}
function renderFairMonthlyList(){
  const container=document.getElementById("fairMonthlyList");
  const totalEl=document.getElementById("fairMonthlySalesTotal");
  const titleEl=document.getElementById("fairMonthlyTitle");
  const labelEl=document.getElementById("fairMonthlyTotalLabel");
  if(!container||!totalEl)return;

  const month=monthFromDateControl("fairStart");
  const monthLabel=/^\d{4}-\d{2}$/.test(month)?`${month.slice(5,7)}-${month.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`${monthLabel} 销售记录`;
  if(labelEl)labelEl.textContent=`${monthLabel} 总销售额`;

  const list=rows
    .filter(r=>r.type==="fair"&&displayToISO(r.date).slice(0,7)===month&&Number(r.amount)>0)
    .map(r=>({...r,displayLocation:canonicalLocation(r.location||"Fair")}))
    .sort((a,b)=>
      a.displayLocation.localeCompare(b.displayLocation,"en",{sensitivity:"base"})||
      displayToISO(a.date).localeCompare(displayToISO(b.date))
    );

  const total=list.reduce((sum,r)=>sum+Number(r.amount||0),0);
  if(!list.length){
    container.innerHTML='<div class="sub">这个月份还没有 Fair 记录</div>';
    totalEl.textContent="0.00";
    return;
  }

  const locations=[];
  list.forEach(r=>{
    let group=locations.find(item=>item.name===r.displayLocation);
    if(!group){
      group={name:r.displayLocation,rows:[]};
      locations.push(group);
    }
    group.rows.push(r);
  });

  container.innerHTML=locations.map(group=>{
    const locationTotal=group.rows.reduce((sum,r)=>sum+Number(r.amount||0),0);
    return `<div class="month-record-group">
      <div class="month-record-group-title">${group.name}</div>
      ${group.rows.map(r=>`<div class="month-record-row">
        <span>${r.date}</span>
        <strong>${money(r.amount)}</strong>
      </div>`).join("")}
      <div class="month-record-row month-record-total">
        <span>总数</span>
        <strong>${money(locationTotal)}</strong>
      </div>
    </div>`;
  }).join("");

  totalEl.textContent=money(total);
  renderFairPageTop3();
}
function renderLiveMonthlyList(){
  const container=document.getElementById("liveMonthlyList");
  const totalEl=document.getElementById("liveSelectedHostTotal");
  const commissionTotalEl=document.getElementById("liveSelectedCommissionTotal");
  const titleEl=document.getElementById("liveMonthlyTitle");
  const totalLabelEl=document.getElementById("liveMonthlyTotalLabel");
  const commissionLabelEl=document.getElementById("liveMonthlyCommissionLabel");
  if(!container||!totalEl)return;

  const liveMonth=getLiveSelectedMonth();
  const monthLabel=/^\d{4}-\d{2}$/.test(liveMonth)?`${liveMonth.slice(5,7)}-${liveMonth.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`${monthLabel} 销售记录`;
  if(totalLabelEl)totalLabelEl.textContent=`${monthLabel} 总销售额`;
  if(commissionLabelEl)commissionLabelEl.textContent=`${monthLabel} 总佣金`;

  const list=rows
    .filter(r=>r.type==="live"&&displayToISO(r.date).slice(0,7)===liveMonth&&Number(r.amount)>0)
    .map(r=>{
      const rate=getLiveHostRate(r.location,r.date);
      const amount=Number(r.amount||0);
      return{
        ...r,
        displayHost:canonicalLiveHost(r.location),
        commissionRate:rate,
        commissionAmount:amount*rate/100
      };
    })
    .sort((a,b)=>{
      const hostSort=a.displayHost.localeCompare(b.displayHost,"en",{sensitivity:"base"});
      return hostSort||displayToISO(a.date).localeCompare(displayToISO(b.date));
    });

  const total=list.reduce((sum,r)=>sum+Number(r.amount||0),0);
  const commissionTotal=list.reduce((sum,r)=>sum+Number(r.commissionAmount||0),0);

  if(!list.length){
    container.innerHTML='<div class="sub">这个月份还没有 Live 记录</div>';
    totalEl.textContent="0.00";
    if(commissionTotalEl)commissionTotalEl.textContent="0.00";
    return;
  }

  const groups=[];
  list.forEach(r=>{
    const key=normalizeLiveHostKey(r.displayHost);
    let group=groups.find(item=>item.key===key);
    if(!group){
      group={key,name:r.displayHost,rows:[]};
      groups.push(group);
    }
    group.rows.push(r);
  });

  container.innerHTML=groups.map(group=>{
    const hostTotal=group.rows.reduce((sum,r)=>sum+Number(r.amount||0),0);
    const hostCommission=group.rows.reduce((sum,r)=>sum+Number(r.commissionAmount||0),0);
    return `<div class="live-sales-group">
      <div class="live-sales-group-title"><span>${group.name}</span></div>
      <div class="live-record-row live-record-head">
        <span>日期</span>
        <span class="live-record-value">销售额</span>
        <span class="live-record-rate">佣金率</span>
        <span class="live-record-commission">佣金</span>
      </div>
      ${group.rows.map(r=>`<div class="live-record-row">
        <span>${r.date}</span>
        <strong class="live-record-value">${money(r.amount)}</strong>
        <span class="live-record-rate">${r.commissionRate}%</span>
        <strong class="live-record-commission">${money(r.commissionAmount)}</strong>
      </div>`).join("")}
      <div class="live-record-row live-record-total">
        <span>总数</span>
        <strong class="live-record-value">${money(hostTotal)}</strong>
        <span></span>
        <strong class="live-record-commission">${money(hostCommission)}</strong>
      </div>
    </div>`;
  }).join("");

  totalEl.textContent=money(total);
  if(commissionTotalEl)commissionTotalEl.textContent=money(commissionTotal);
  renderLivePageTop3();
}

const LIVE_LAST_SESSION_KEY="lover_live_last_saved_session_v72";
function saveLastLiveSession(host,dateISO){
  const cleanHost=canonicalLiveHost(host);
  if(!cleanHost||!dateISO)return;
  try{
    localStorage.setItem(LIVE_LAST_SESSION_KEY,JSON.stringify({host:cleanHost,dateISO}));
  }catch(e){}
  renderLivePageTop3();
}
function restoreLastLiveSession(){
  const hostEl=document.getElementById("liveHost");
  const dateEl=document.getElementById("liveDate");
  if(!hostEl||!dateEl)return;
  try{
    const saved=JSON.parse(localStorage.getItem(LIVE_LAST_SESSION_KEY)||"null");
    if(saved&&saved.host)hostEl.value=canonicalLiveHost(saved.host);
  }catch(e){}
  // V29.9: do not restore the previously saved date.
  setDateControl("liveDate",todayISO());
  updateLiveInputFromSelectedDate();
}
function liveByHostThisMonth(){
  const map={};
  rows.filter(r=>r.type==="live"&&sameMonth(r.date)&&Number(r.amount)>0).forEach(r=>{
    const key=normalizeLiveHostKey(r.location);
    if(!key)return;
    if(!map[key])map[key]={name:canonicalLiveHost(r.location),total:0,commission:0,rates:new Set()};
    const amount=Number(r.amount||0);
    const rate=getLiveHostRate(r.location,r.date);
    map[key].total+=amount;
    map[key].commission+=amount*rate/100;
    map[key].rates.add(rate);
  });
  return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderLiveHostSummary(){
  const el=document.getElementById("liveHostSummary");
  if(!el)return;
  const data=liveByHostThisMonth();
  el.innerHTML=data.length?data.map(item=>{
    const rates=[...item.rates].sort((a,b)=>a-b);
    const rateText=rates.length===1?`${rates[0]}%`:"按日期";
    return `<div class="fair-location-card"><div class="fair-location-title">${item.name}</div><div class="fair-location-row"><span>销售额</span><b>${money(item.total)}</b></div><div class="fair-location-row"><span>佣金 ${rateText}</span><b>${money(item.commission)}</b></div></div>`;
  }).join(""):'<div class="sub">这个月份还没有 Live 记录</div>';
}
function reactivateLiveHostIfNeeded(name){
  const raw=canonicalLiveHost(name);
  const key=normalizeLiveHostKey(raw);
  if(!key)return{host:raw,reactivated:false};
  const current=getCommissionSettings();
  const inactive={...(current.inactiveLiveHosts||{})};
  const historic=rows.find(r=>r.type==="live"&&normalizeLiveHostKey(r.location)===key);
  const original=canonicalLiveHost(inactive[key]||(historic&&historic.location)||raw);
  if(!inactive[key])return{host:(current.liveHosts||{})[key]||original,reactivated:false};
  const liveHosts={...(current.liveHosts||{}),[key]:original};
  const liveHostRates={...(current.liveHostRates||{}),[key]:10};
  delete inactive[key];
  const next=normalizeCommissionSettings({...current,liveHosts,liveHostRates,inactiveLiveHosts:inactive});
  const list=getSavedLiveHosts().filter(x=>normalizeLiveHostKey(x)!==key);
  list.push(original);
  localStorage.setItem("lover_live_hosts_v69",JSON.stringify(list));
  applyCommissionSettings(next);
  saveLocalDataCache(next);
  renderLiveHostOptions();
  renderLiveHostCommissionSettings();
  saveLiveCommissionSettingsToSheet(next,selectedMonth()).then(saved=>{
    const confirmed=normalizeCommissionSettings(saved||next);
    applyCommissionSettings(confirmed);
    saveLocalDataCache(confirmed);
    renderLiveHostOptions();
    renderLiveHostCommissionSettings();
    setSync("主播已复职并同步",true);
  }).catch(()=>setSync("主播已复职，云端稍后重试",false,true));
  return{host:original,reactivated:true};
}


/* ================= V29.9 Import Cost System product search ================= */
// Search/mapping behavior mirrors Lover Legend Cost and Pricing Calculator V8.2.
const IMPORT_SYSTEM_CLOUD_URL_V214="https://script.google.com/macros/s/AKfycbxWKdEC7vy_7pZ2_CPie-9L5DeIofPggZlLuwB7gW-31HqWXEOxshtCR-HB-m5qLYS6/exec";
let importProductsV214=[];
let importProductsPromiseV214=null;

function normalizeImportProductSearchTextV214(value){
  return String(value||"")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\u3000\-_./\\,，、:：;；()（）[\]【】{}"'`~!！?？@#$%^&*+=|<>]+/g,"");
}
const PRODUCT_PREFIX_RULES_V437=[["黄杨","BX"],["凌珊","BB"],["罗汉松","PD"],["李氏樱桃","SK"],["水梅","JL"],["酸豆","AS"],["寿娘子","SC"],["三角梅","BV"],["七里香","MR"],["九里香","MR"],["仙丹","IX"],["福建茶","HK"]];
function compatibleImportProductIdsV437(record){
  const current=String(record?.productId||record?.id||"").trim().toUpperCase();
  const suffix=current.match(/^[A-Z]{2}(\d{4})$/)?.[1];
  if(!suffix)return[current];
  const name=String(record?.productName||record?.name||"").replace(/\s+/g,"");
  const rule=PRODUCT_PREFIX_RULES_V437.find(([keyword])=>name.includes(keyword));
  return[...new Set([current,`PZ${suffix}`,rule?`${rule[1]}${suffix}`:""].filter(Boolean))];
}
function extractImportProductCodesV214(value){
  const source=String(value||"").normalize("NFKC").toLocaleLowerCase();
  return source.match(/[a-z]{1,6}[0-9][a-z0-9]*/g)||[];
}
function isExactProductCodeQueryV214(value){
  const query=normalizeImportProductSearchTextV214(value);
  return /^[a-z]{1,6}[0-9][a-z0-9]*$/.test(query);
}
function unorderedImportProductMatchV214(sourceValue,queryValue){
  const source=normalizeImportProductSearchTextV214(sourceValue);
  const query=normalizeImportProductSearchTextV214(queryValue);
  if(!query)return true;
  if(isExactProductCodeQueryV214(query)){
    // V29.9: code search supports case-insensitive prefix/partial entry.
    const codes=extractImportProductCodesV214(sourceValue);
    return codes.some(code=>code===query||code.startsWith(query));
  }
  if(source.includes(query))return true;
  if(!/^[\p{Script=Han}]+$/u.test(query))return false;
  const counts=new Map();
  Array.from(source).forEach(ch=>counts.set(ch,(counts.get(ch)||0)+1));
  return Array.from(query).every(ch=>{
    const count=counts.get(ch)||0;
    if(count<1)return false;
    counts.set(ch,count-1);
    return true;
  });
}

// V51.0: mirror Import System V21.8 exact Original Cost search.
// Pure numeric queries are reserved for exact unitPrice matching only.
// Currency is ignored; 120 matches 120 / 120.00, never 1200 or 1201.
// Uses the already-loaded Import product records, so no new API request or polling is added.
function parseOriginalCostSearchQueryV510(queryValue){
  const text=String(queryValue||"")
    .normalize("NFKC")
    .replace(/[,，\s]/g,"");
  if(!/^\d+(?:\.\d+)?$/.test(text))return null;
  const value=Number(text);
  return Number.isFinite(value)?value:null;
}
function originalCostNumberMatchesV510(value,queryValue){
  const query=parseOriginalCostSearchQueryV510(queryValue);
  if(query===null)return false;
  const cost=Number(value);
  return Number.isFinite(cost)&&Math.abs(cost-query)<0.000001;
}
function importProductSearchMatchesV510(record,searchableValue,queryValue){
  if(parseOriginalCostSearchQueryV510(queryValue)!==null){
    return originalCostNumberMatchesV510(record?.unitPrice,queryValue);
  }
  return unorderedImportProductMatchV214(searchableValue,queryValue);
}
function isDateLikeCorruptedNumberV214(value){
  if(typeof value!=="string")return false;
  const text=value.trim();
  return /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(text)||/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(text);
}
function parseCloudNumberV214(value){
  if(typeof value==="number")return Number.isFinite(value)?value:0;
  if(isDateLikeCorruptedNumberV214(value))return 0;
  const normalized=String(value??"").replace(/,/g,"").replace(/[^0-9.\-]/g,"").trim();
  const number=Number(normalized);
  return Number.isFinite(number)?number:0;
}
function normalizePercentValueV214(value){
  const n=parseCloudNumberV214(value);
  if(!Number.isFinite(n)||n<=0)return 0;
  return n>0&&n<1?n*100:n;
}
function buildCloudImportProductRecordsV214(data){
  const imports=Array.isArray(data?.imports)?data.imports:[];
  const batches=Array.isArray(data?.batches)?data.batches:[];
  const products=Array.isArray(data?.products)?data.products:[];

  const productById=new Map(products.map(product=>[String(product?.id||""),product]));
  const productByName=new Map(products.map(product=>[
    normalizeImportProductSearchTextV214(product?.name||""),product
  ]));
  const normalizeImportNumber=value=>String(value||"").trim().toLocaleLowerCase();

  const batchesByNumber=new Map();
  batches.forEach(batch=>{
    const key=normalizeImportNumber(batch?.importNumber);
    if(!key)return;
    if(!batchesByNumber.has(key))batchesByNumber.set(key,[]);
    batchesByNumber.get(key).push(batch);
  });

  function findMatchedItem(batch,productName){
    if(!batch||!Array.isArray(batch?.items))return null;
    const wanted=normalizeImportProductSearchTextV214(productName);
    if(!wanted)return null;
    const exact=batch.items.find(item=>
      normalizeImportProductSearchTextV214(item?.productName||item?.name||"")===wanted
    );
    if(exact)return exact;
    return batch.items.find(item=>{
      const itemName=normalizeImportProductSearchTextV214(item?.productName||item?.name||"");
      return itemName&&(itemName.includes(wanted)||wanted.includes(itemName));
    })||null;
  }

  function scoreBatch(batch,productName){
    const matchedItem=findMatchedItem(batch,productName);
    const rate=parseCloudNumberV214(batch?.rate??batch?.exchangeRate??batch?.fixedRate);
    const shippingRate=normalizePercentValueV214(
      batch?.shippingRate??batch?.fixedShippingRate??batch?.overseasShippingRate??batch?.overseasFreightRate
    );
    const inlandMisc=normalizePercentValueV214(
      batch?.inlandMiscRate??batch?.inlandMiscPercent??batch?.fixedInlandMiscPercent??batch?.inlandMiscPercentage
    );
    const updatedAt=Date.parse(batch?.updatedAt||batch?.createdAt||"")||0;
    return{
      batch,matchedItem,
      score:Number(Boolean(matchedItem))*100+Number(rate>0)*10+Number(inlandMisc>0)*5+Number(shippingRate>0)*5,
      updatedAt
    };
  }

  function resolveImportMapping(importNumber,productName){
    const candidates=batchesByNumber.get(normalizeImportNumber(importNumber))||[];
    if(!candidates.length)return{batch:null,matchedItem:null};
    const scored=candidates.map(batch=>scoreBatch(batch,productName))
      .sort((a,b)=>b.score-a.score||b.updatedAt-a.updatedAt);
    return{batch:scored[0]?.batch||null,matchedItem:scored[0]?.matchedItem||null};
  }

  const records=[];
  const seen=new Set();

  function addRecord(source){
    const productName=String(source?.productName||source?.name||"").trim();
    const category=String(source?.category||"盆栽").trim();
    const importNumber=String(source?.importNumber||"").trim();
    const currency=String(source?.currency||"").trim().toUpperCase();
    const unitPrice=parseCloudNumberV214(source?.unitPrice);

    if(!productName||!["盆栽","杂花杂木"].includes(category)||!currency||!Number.isFinite(unitPrice)||unitPrice<=0)return;

    const key=[
      normalizeImportProductSearchTextV214(productName),
      normalizeImportNumber(importNumber),
      currency,
      unitPrice
    ].join("|");
    if(seen.has(key))return;
    seen.add(key);

    const {batch,matchedItem}=resolveImportMapping(importNumber,productName);
    const product=
      productById.get(String(source?.productId||""))||
      productByName.get(normalizeImportProductSearchTextV214(productName))||
      null;

    const inlandMiscPercent=
      normalizePercentValueV214(
        batch?.inlandMiscRate??batch?.inlandMiscPercent??batch?.fixedInlandMiscPercent??batch?.inlandMiscPercentage
      )||
      normalizePercentValueV214(
        source?.inlandMiscRate??source?.inlandMiscPercent??source?.fixedInlandMiscPercent??source?.inlandFeePercent??source?.domesticMiscPercent
      )||0;

    const shippingRate=
      normalizePercentValueV214(
        batch?.shippingRate??batch?.fixedShippingRate??batch?.overseasShippingRate??batch?.overseasFreightRate
      )||
      normalizePercentValueV214(
        source?.shippingRate??source?.fixedShippingRate??source?.overseasShippingRate
      )||0;

    records.push({
      id:String(source?.id||key),
      // V46.0: prefer the current Products ID. Old cached/import PZ IDs still
      // match by exact product name, then are upgraded before a card is saved.
      productId:String(product?.id||source?.productId||""),
      productName,
      importNumber,
      unitPrice,
      currency,
      inlandMiscPercent,
      shippingRate,
      averageCost:parseCloudNumberV214(product?.averageCost??source?.averageCostRM??source?.unitCost),
      minimumPrice:parseCloudNumberV214(product?.minimumPrice??source?.minimumPrice??0),
      stock:product?.stock===undefined||product?.stock===null?null:parseCloudNumberV214(product.stock),
      mappingStatus:batch?"BATCH_MATCHED":"BATCH_MISSING",
      matchedItem:Boolean(matchedItem)
    });
  }

  imports.forEach(addRecord);
  records.sort((a,b)=>a.productName.localeCompare(b.productName,"zh-Hans-CN",{numeric:true,sensitivity:"base"}));
  return records;
}


const IMPORT_PRODUCTS_CACHE_KEY_V224="lover_import_products_cache_v224";
const IMPORT_PRODUCTS_CACHE_MAX_AGE_V224=6*60*60*1000;

function readImportProductsCacheV224(){
  try{
    const cached=JSON.parse(localStorage.getItem(IMPORT_PRODUCTS_CACHE_KEY_V224)||"null");
    if(!cached||!Array.isArray(cached.records)||!cached.records.length)return [];
    return cached.records;
  }catch(e){ return []; }
}
function saveImportProductsCacheV224(records){
  try{
    localStorage.setItem(IMPORT_PRODUCTS_CACHE_KEY_V224,JSON.stringify({
      savedAt:Date.now(),records:Array.isArray(records)?records:[]
    }));
  }catch(e){}
}
function hydrateImportProductsCacheV224(){
  if(importProductsV214.length)return importProductsV214;
  const cached=readImportProductsCacheV224();
  if(cached.length)importProductsV214=cached;
  return importProductsV214;
}

let importProductsFreshPromiseV400=null;
async function fetchImportProductsFreshV395(timeoutMs=12000){
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),Math.max(3000,Number(timeoutMs||12000))):0;
  try{
    const response=await fetch(IMPORT_SYSTEM_CLOUD_URL_V214,{
      method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"pull",knownRevision:0,hasLocalData:false,forceFull:true,_ts:Date.now()}),
      cache:"no-store",signal:controller?controller.signal:undefined
    });
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!data?.ok||!Array.isArray(data.products)||!Array.isArray(data.imports)||!Array.isArray(data.batches))throw new Error(data?.error||"进口系统资料不完整");
    importProductsV214=buildCloudImportProductRecordsV214(data);saveImportProductsCacheV224(importProductsV214);return importProductsV214;
  }catch(e){if(e&&e.name==='AbortError')throw new Error('库存云端核对超时');throw e}
  finally{if(timer)clearTimeout(timer)}
}

async function loadImportProductsV214(force=false){
  hydrateImportProductsCacheV224();
  if(importProductsV214.length&&!force)return importProductsV214;
  if(importProductsPromiseV214)return importProductsPromiseV214;
  importProductsPromiseV214=(async()=>{
    const response=await fetch(IMPORT_SYSTEM_CLOUD_URL_V214,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"pull",knownRevision:0,hasLocalData:false,forceFull:true}),
      cache:"no-store"
    });
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!data?.ok||!Array.isArray(data.products)||!Array.isArray(data.imports)||!Array.isArray(data.batches)){
      throw new Error(data?.error||"进口系统资料不完整");
    }
    importProductsV214=buildCloudImportProductRecordsV214(data);
    saveImportProductsCacheV224(importProductsV214);
    return importProductsV214;
  })().finally(()=>{importProductsPromiseV214=null;});
  return importProductsPromiseV214;
}

function prefetchImportProductsV224(){
  hydrateImportProductsCacheV224();
  const run=()=>loadImportProductsV214(true).catch(err=>console.warn("Import products prefetch skipped",err));
  if("requestIdleCallback" in window)requestIdleCallback(run,{timeout:2500});
  else setTimeout(run,800);
}
if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",prefetchImportProductsV224,{once:true});
else prefetchImportProductsV224();

function formatOriginalUnitPriceV214(value){
  return Number(value||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function formatPercentV214(value){
  return Number(value||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function getVndPotMossFeeV267(record){
  const currency=String(record?.currency||"").trim().toUpperCase();
  const originalPrice=Math.max(0,Number(record?.unitPrice||0));
  if(currency!=="VND"||originalPrice<=0)return 0;
  // V50.2: match Import V21.5 VND pot/misc tiers exactly.
  if(originalPrice>=10000000)return 180;
  if(originalPrice>=4000000)return 105;
  if(originalPrice>=1000000)return 55;
  return 35;
}

function productExtraInputV278(item){return item?.querySelector?.(".product-link-extra-v278")||null}
function syncCardExtraTotalFromProductsV278(card){
  const total=salesCardProductsV239(card).reduce((s,item)=>s+Math.max(0,toAmount(productExtraInputV278(item)?.value||0)),0);
  const input=card?.querySelector?.(".sales-card-extra-total-v239");
  if(input)input.value=formatAmount(total);
  return total;
}
function syncSalesCardAutoExtraV267(card){
  if(!card)return;
  [...card.querySelectorAll(".product-link-item")].forEach(item=>{
    const input=productExtraInputV278(item);
    if(!input||input.dataset.manual==="1")return;
    const unitFee=Math.max(0,Number(item.dataset.autoPotMossFeeV267||0));
    const qty=Math.max(1,Number(item.querySelector(".product-link-qty")?.value||1));
    // V50.2: Import V21.5 VND pot/misc fee is a per-unit selling cost.
    // Auto mode therefore uses unit fee x quantity on Sales / Fair / Live.
    input.value=formatAmount(unitFee*qty);
  });
  syncCardExtraTotalFromProductsV278(card);
  recalcSalesCardTransactionV239(card);
}

function applyImportRecordToProductCardV214(item,nameInput,record){
  nameInput.value=String(record?.productName||"");
  nameInput.dataset.productId=String(record?.productId||record?.id||"");
  item.dataset.importMapped="1";
  item.dataset.minimumPrice=String(Number(record?.minimumPrice||0));
  item.dataset.currentStock=record?.stock===null||record?.stock===undefined?"":String(Math.max(0,Math.trunc(Number(record.stock)||0)));

  const costInput=item.querySelector(".product-link-avg-cost");
  if(costInput)costInput.value=formatAmount(Number(record?.averageCost||0));

  item.dataset.autoPotMossFeeV267=String(getVndPotMossFeeV267(record));
  const card=item.closest(".sales-card-transaction-v239");
  if(card){
    syncSalesCardAutoExtraV267(card);
    if(typeof markSalesCardTransactionDirtyV239==="function")markSalesCardTransactionDirtyV239(card);
  }
  else recalcProductLinkProfitV211(item);

  updateProductLinkMinimumWarningV214(item);
  if(typeof markSalesCardDirtyV238==="function")markSalesCardDirtyV238(item);
}
function clearImportMappingForManualProductV214(item){
  const nameInput=item.querySelector(".product-link-name");
  if(nameInput)nameInput.dataset.productId="";
  item.dataset.minimumPrice="0";
  item.dataset.currentStock="";
  item.dataset.autoPotMossFeeV267="0";
  const extraInputV278=productExtraInputV278(item);
  if(extraInputV278&&extraInputV278.dataset.manual!=="1")extraInputV278.value="0.00";
  const extraCardV278=item.closest(".sales-card-transaction-v239");
  if(extraCardV278)syncCardExtraTotalFromProductsV278(extraCardV278);
  if(item.dataset.importMapped==="1"){
    const costInput=item.querySelector(".product-link-avg-cost");
    if(costInput)costInput.value="0.00";
  }
  item.dataset.importMapped="0";
  item.dataset.autoPotMossFeeV267="0";
  const card=item.closest(".sales-card-transaction-v239");
  if(card){
    syncSalesCardAutoExtraV267(card);
    // V51.0: clearing/changing a product on an unconfirmed card is a draft edit,
    // never an Import-pending/confirmed transition. Search behavior is unchanged.
    if(String(card.dataset.confirmedOnceV401||'')!=='1'){
      card.dataset.confirmedOnceV401='0';
      card.dataset.inventoryStatus='DRAFT_INVENTORY_CHANGED';
      item.dataset.inventoryStatus='DRAFT_INVENTORY_CHANGED';
    }
  }
  updateProductLinkMinimumWarningV214(item);
}
function updateProductLinkMinimumWarningV214(item){
  if(!item)return;
  const warning=item.querySelector(".product-link-minimum-warning");
  const actualPrice=toAmount(item.querySelector(".product-link-price")?.value||0);
  const minimumPrice=Math.max(0,Number(item.dataset.minimumPrice||0));
  if(!warning)return;
  const low=minimumPrice>0&&actualPrice>0&&actualPrice<minimumPrice;
  warning.hidden=!low;
  warning.textContent=low?`⚠ 低于最低售价 RM${formatAmount(minimumPrice)}`:"";
  const priceInput=item.querySelector(".product-link-price");
  if(priceInput)priceInput.classList.toggle("below-minimum-price",low);
}
function setupImportProductSearchV214(item,nameInput,resultsBox,closeButton){
  // V29.9: iPhone/iOS safe search state.
  // The dropdown remains open through async Import loading, keyboard candidate changes,
  // transient blur/focus changes and background sales-card loading.
  let searchOpen=false;
  let renderSeq=0;

  const open=()=>{
    searchOpen=true;
    item.dataset.importSearchOpen="1";
    resultsBox.hidden=false;
  };
  const close=()=>{
    searchOpen=false;
    item.dataset.importSearchOpen="0";
    resultsBox.hidden=true;
    resultsBox.innerHTML="";
  };

  const render=async()=>{
    const seq=++renderSeq;
    const keyword=String(nameInput.value||"").trim();
    open();

    try{
      const products=await loadImportProductsV214();

      // A newer keystroke/render already started. Never let an older async result
      // change the visible state of the current dropdown.
      if(seq!==renderSeq||!searchOpen)return;

      const matches=products.filter(record=>{
        const searchable=[
          ...(compatibleImportProductIdsV437(record)),
          record.productName,
          record.importNumber,
          record.currency,
          record.unitPrice,
          record.averageCost,
          record.shippingRate,
          record.inlandMiscPercent,
          record.minimumPrice
        ].join(" ");
        return importProductSearchMatchesV510(record,searchable,keyword);
      }).slice(0,30);

      resultsBox.innerHTML="";
      if(!matches.length){
        const empty=document.createElement("div");
        empty.className="product-link-search-empty";
        empty.textContent="没有符合的进口产品；可继续手动输入产品名称";
        resultsBox.appendChild(empty);
        open();
        return;
      }

      matches.forEach(record=>{
        const row=document.createElement("button");
        row.type="button";
        row.className="product-link-search-option";

        const line1=document.createElement("div");
        line1.className="product-link-search-line1";
        line1.textContent=
          `${record.productName} · ${String(record.productId||"")} · 原购买单价 ${String(record.currency||"").toUpperCase()} ${formatOriginalUnitPriceV214(record.unitPrice)}`+
          ` · 内地杂费 ${formatPercentV214(record.inlandMiscPercent)}%`+
          ` · 平均成本 RM ${formatAmount(Number(record.averageCost||0))}`;

        const line2=document.createElement("div");
        line2.className="product-link-search-line2";
        line2.textContent=
          `最低售价 RM ${formatAmount(Number(record.minimumPrice||0))}`+
          ` · 海外运费 ${formatPercentV214(record.shippingRate)}%`+
          ` · ${record.mappingStatus==="BATCH_MATCHED"?"Batch 已匹配":"Batch 未匹配"}`;

        row.append(line1,line2);

        // V29.9: distinguish an intentional tap from list scrolling on iPhone/iOS.
        let touchStartX=0,touchStartY=0,touchMoved=false,touchHandled=false;
        const chooseRecord=e=>{
          if(e){
            e.preventDefault();
            e.stopPropagation();
          }
          applyImportRecordToProductCardV214(item,nameInput,record);
          close();
        };
        row.addEventListener("touchstart",e=>{
          if(!e.touches||e.touches.length!==1)return;
          const t=e.touches[0];
          touchStartX=t.clientX;
          touchStartY=t.clientY;
          touchMoved=false;
          touchHandled=false;
        },{passive:true});
        row.addEventListener("touchmove",e=>{
          if(!e.touches||e.touches.length!==1)return;
          const t=e.touches[0];
          const dx=t.clientX-touchStartX;
          const dy=t.clientY-touchStartY;
          if(Math.hypot(dx,dy)>12)touchMoved=true;
        },{passive:true});
        row.addEventListener("touchend",e=>{
          if(touchMoved)return;
          touchHandled=true;
          chooseRecord(e);
        },{passive:false});
        row.addEventListener("click",e=>{
          if(touchHandled){
            touchHandled=false;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          chooseRecord(e);
        });
        resultsBox.appendChild(row);
      });

      open();
    }catch(err){
      if(seq!==renderSeq||!searchOpen)return;
      resultsBox.innerHTML="";
      const empty=document.createElement("div");
      empty.className="product-link-search-empty error";
      empty.textContent="读取进口系统失败；仍可手动输入产品名称";
      resultsBox.appendChild(empty);
      open();
      console.warn("Import product search failed",err);
    }
  };

  nameInput.addEventListener("focus",()=>{
    open();
    render();
  });
  nameInput.addEventListener("input",()=>{
    clearImportMappingForManualProductV214(item);
    open();
    render();
  });

  if(closeButton){
    closeButton.setAttribute("aria-label","清空当前产品选择");
    closeButton.setAttribute("title","清空当前产品选择");
    closeButton.addEventListener("pointerdown",e=>{
      e.preventDefault();
      e.stopPropagation();
    });
    closeButton.addEventListener("click",e=>{
      e.preventDefault();
      e.stopPropagation();

      // V29.9: X means CLEAR CURRENT PRODUCT SELECTION.
      // Never focus the input again here, otherwise focus() reopens the search list.
      ++renderSeq;
      close();

      const wasMapped=String(nameInput.dataset.productId||"")!=="";
      nameInput.value="";
      nameInput.dataset.productId="";
      item.dataset.minimumPrice="0";
      item.dataset.importMapped="0";

      const costInput=item.querySelector(".product-link-avg-cost");
      if(costInput)costInput.value="0.00";

      updateProductLinkMinimumWarningV214(item);

      const card=item.closest(".sales-card-transaction-v239");
      if(card&&String(card.dataset.confirmedOnceV401||'')!=='1'){
        // V51.0: X still clears only the current product selection/name mapping,
        // but an editable draft must stay editable and must never become Import pending.
        card.dataset.confirmedOnceV401='0';
        item.dataset.inventoryStatus='DRAFT_INVENTORY_CHANGED';
        card.dataset.inventoryStatus='DRAFT_INVENTORY_CHANGED';
        if(card._renderInventoryStatusV249)card._renderInventoryStatusV249();
        if(card._renderSalesStateV317)card._renderSalesStateV317();
      }

      if(typeof markSalesCardDirtyV238==="function")markSalesCardDirtyV238(item);
      if(card&&typeof markSalesCardTransactionDirtyV239==="function")markSalesCardTransactionDirtyV239(card);
      if(card&&typeof recalcSalesCardTransactionV239==="function")recalcSalesCardTransactionV239(card);
      else recalcProductLinkProfitV211(item);

      // Keep quantity / sale price / delivery / remark untouched.
      // X clears only the selected/import-mapped product and its imported cost metadata.
      try{nameInput.blur()}catch(_){}
    });
  }

  // Do NOT close on blur/focusout. iOS can blur the field while its keyboard,
  // candidates, previous/next controls or async DOM work are still active.
  // A real tap/click outside the search area is the only non-selection close path.
  document.addEventListener("click",e=>{
    if(!searchOpen)return;
    const wrap=item.querySelector(".product-link-search-wrap");
    if(wrap&&wrap.contains(e.target))return;
    close();
  },false);
}


/* ================= V29.9 Sales Card unsaved-change protection ================= */
function markSalesCardDirtyV238(item){
  if(!item)return;
  item.dataset.dirty="1";
}
function clearSalesCardDirtyV238(item){
  if(item)item.dataset.dirty="0";
}
function hasUnsavedSalesCardChangesV238(type){
  if(!["daily","live","fair"].includes(String(type||"")))return false;
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  if(!wrap)return false;
  // V29.9: use the same transaction-level dirty signal that Live already maintains.
  // This is essential for Sales/Belimbing shared fields and newly edited cards.
  if([...wrap.querySelectorAll(".sales-card-transaction-v239")].some(card=>card.dataset.dirty==="1"))return true;
  return [...wrap.querySelectorAll(".product-link-item")].some(item=>item.dataset.dirty==="1");
}
function discardUnsavedSalesCardChangesV238(type){
  if(!["daily","live","fair"].includes(String(type||"")))return;
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  if(!wrap)return;
  [...wrap.querySelectorAll(".sales-card-transaction-v239")].forEach(clearSalesCardTransactionDirtyV239);
  [...wrap.querySelectorAll(".product-link-item")].forEach(clearSalesCardDirtyV238);
}
function confirmDiscardSalesCardChangesV238(type){
  if(!hasUnsavedSalesCardChangesV238(type))return true;
  const ok=confirm("销售卡尚未保存，确定离开？\\n\\n点击“确定”将放弃未保存的销售卡修改。");
  if(ok)discardUnsavedSalesCardChangesV238(type);
  return ok;
}

/* ================= V29.9 optional bonsai product association ================= */

let productLinkItemSeqV206=0;
function productLinkContextV206(type){
  if(type==="daily"){
    const company=String(document.getElementById('company')?.value||'belimbing');
    return{pre:"daily",date:isoToDisplay(document.getElementById("saleDate")?.value||""),location:company==='balakong'?'Balakong':'Belimbing'};
  }
  const pre=type==="live"?"live":"fair";
  const date=type==="live"?isoToDisplay(document.getElementById("liveDate")?.value||""):String(document.getElementById("fairProductDate")?.value||"");
  const location=type==="live"?selectedLiveHost():canonicalLocation(String(document.getElementById("fairLocation")?.value||"").trim());
  return{pre,date,location};
}
function productLinkPreV208(type){return type==="live"?"live":type==="daily"?"daily":"fair";}
function ensureProductLinkFirstCardV208(type){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  if(!wrap)return false;
  if(!wrap.querySelector('.product-link-item'))addProductLinkItemV209(type);
  return true;
}
function toggleProductLinkBoxV206(type){
  const pre=productLinkPreV208(type),box=document.getElementById(pre+"ProductLinkBox"),body=document.getElementById(pre+"ProductLinkBody");
  if(!box||!body)return;
  // V35.0: opening the Fair sales card is a view action, not a Date Range
  // reset. Preserve the user's selected associated date so the editor loads
  // that exact day's cards instead of silently jumping back to today.
  const selectedFairDate=type==="fair"?String(document.getElementById("fairProductDate")?.value||""):"";
  const opening=body.classList.contains("hidden");
  if(!opening&&!confirmDiscardSalesCardChangesV238(type))return false;
  body.classList.toggle("hidden",!opening);box.classList.toggle("product-link-collapsed",!opening);
  const btn=box.querySelector(".product-link-toggle");if(btn)btn.setAttribute("aria-expanded",opening?"true":"false");
  if(opening){
    // V29.9: Sales Cards and Daily Profit are mutually exclusive.
    const profitPanel=productProfitSummaryPanelV216(type);
    if(profitPanel){profitPanel.classList.add("hidden");profitPanel.innerHTML=""}
    productProfitSummaryOpenV216[type]=false;
    const profitBtn=document.querySelector(`#${pre}ProductLinkBox .product-profit-toggle-btn`);
    if(profitBtn){profitBtn.textContent="📊 当天利润";profitBtn.disabled=false}
    // V29.9: saved cards first. Do not flash a fake 0.00 card while cloud data loads.
    if(type==="fair"){
      syncFairProductDatesV203(false);
      const fairDateSelect=document.getElementById("fairProductDate");
      if(fairDateSelect&&selectedFairDate&&[...fairDateSelect.options].some(option=>option.value===selectedFairDate)){
        fairDateSelect.value=selectedFairDate;
      }
    }
    Promise.resolve(loadProductLinksIntoEditorV206(type)).catch(()=>{});
  }
}
function liveDeliveryDefaultV203(price){
  const n=Math.max(0,Number(price||0));
  if(n<=0)return 0;
  // V50.2: match Import V21.5 木架＋本地运费 A–F exactly.
  if(n<300)return 20;
  if(n<=500)return 50;
  if(n<=1000)return 80;
  if(n<=2000)return 120;
  if(n<5000)return 150;
  return 180;
}
function fairMonthlyTotalForProductCardV220(){
  const ctx=productLinkContextV206("fair");
  const date=String(ctx.date||"");
  const month=date.length>=10?date.slice(3):"";
  if(!month)return 0;
  return rows.filter(r=>String(r.type||"")==="fair"&&String(r.date||"").slice(3)===month)
    .reduce((sum,r)=>sum+Number(r.amount||0),0);
}
function productLinkDefaultCommissionRateV211(type){
  if(String(type||"").toLowerCase()==="daily")return 0;
  if(String(type||"").toLowerCase()==="live")return 10;
  return Number((getFairCommissionRate(fairMonthlyTotalForProductCardV220())*100).toFixed(2));
}
function recalcProductLinkProfitV211(item){
  if(!item)return;
  const qty=Math.max(0,Number(item.querySelector('.product-link-qty')?.value||0));
  const avgCost=toAmount(item.querySelector('.product-link-avg-cost')?.value||0);
  const actualPrice=toAmount(item.querySelector('.product-link-price')?.value||0);
  const rate=Math.max(0,Number(item.querySelector('.product-link-commission-rate')?.value||0));
  const delivery=toAmount(item.querySelector('.product-link-delivery')?.value||0);
  const extra=toAmount(item.querySelector('.product-link-extra')?.value||0);
  const commission=actualPrice*rate/100;
  const profit=actualPrice-commission-(avgCost*qty)-delivery-extra;
  const margin=actualPrice>0?profit/actualPrice*100:0;
  const commissionEl=item.querySelector('.product-link-commission-amount');
  const profitEl=item.querySelector('.product-link-profit');
  const marginEl=item.querySelector('.product-link-profit-rate');
  if(commissionEl)commissionEl.textContent='RM'+formatAmount(commission);
  if(profitEl)profitEl.value=formatAmount(profit);
  if(marginEl)marginEl.value=Number.isFinite(margin)?margin.toFixed(2)+'%':'0.00%';
}
function buildProductLinkItemV209(type,id,data={}){
  const live=type==="live",linkId=String(data.linkId||""),saved=!!linkId,qty=Math.max(1,Number(data.quantity||1));
  const item=document.createElement("div");
  item.className="product-link-item";
  item.dataset.productLinkItem=String(id);
  item.dataset.linkId=linkId;
  item.dataset.saved=saved?"1":"0";
  item.dataset.dirty="0";
  item.dataset.minimumPrice=String(Number(data.minimumPrice||0));
  item.dataset.importMapped=String(data.productId||"")?"1":"0";

  const head=document.createElement("div");head.className="product-link-item-head";
  const title=document.createElement("b");title.textContent=saved?"已保存":"";
  if(saved)title.className="product-link-saved-tag";
  head.append(title);item.appendChild(head);

  const label=(text)=>{const el=document.createElement("label");el.textContent=text;return el};
  const input=(cls,value,placeholder)=>{const el=document.createElement("input");el.className=cls;el.value=value??"";if(placeholder)el.placeholder=placeholder;return el};

  item.appendChild(label("搜索或输入产品"));
  const name=input("product-link-name",String(data.productName||""),"输入产品名称、编号或原成本搜索，或直接手动输入");
  name.dataset.productId=String(data.productId||"");
  const searchWrap=document.createElement("div");searchWrap.className="product-link-search-wrap";
  const searchInputRow=document.createElement("div");searchInputRow.className="product-link-search-input-row";
  searchInputRow.appendChild(name);
  const searchClose=document.createElement("button");searchClose.type="button";searchClose.className="product-link-search-close";searchClose.textContent="×";searchClose.setAttribute("aria-label","收起产品列表");
  searchInputRow.appendChild(searchClose);
  searchWrap.appendChild(searchInputRow);
  const searchResults=document.createElement("div");searchResults.className="product-link-search-results";searchResults.hidden=true;
  searchWrap.appendChild(searchResults);
  item.appendChild(searchWrap);
  setupImportProductSearchV214(item,name,searchResults,searchClose);

  const grid1=document.createElement("div");grid1.className="product-link-grid";
  const qWrap=document.createElement("div");qWrap.appendChild(label("数量"));
  const q=input("product-link-qty qty-input-no-spinner",String(qty));q.type="number";q.min="1";q.step="1";q.inputMode="numeric";qWrap.appendChild(q);
  const cWrap=document.createElement("div");cWrap.appendChild(label("平均成本"));
  const c=input("product-link-avg-cost money-input",formatAmount(Number(data.averageCost||0)));c.inputMode="decimal";cWrap.appendChild(c);
  grid1.append(qWrap,cWrap);item.appendChild(grid1);

  const grid2=document.createElement("div");grid2.className="product-link-grid";
  const pWrap=document.createElement("div");pWrap.appendChild(label("实际售价"));
  const p=input("product-link-price money-input",formatAmount(Number(data.actualPrice||0)));p.inputMode="decimal";pWrap.appendChild(p);
  const minWarn=document.createElement("div");minWarn.className="product-link-minimum-warning";minWarn.hidden=true;pWrap.appendChild(minWarn);
  const rateWrap=document.createElement("div");rateWrap.appendChild(label(live?"主播佣金 %":"Fair 佣金 %"));
  const defaultRate=data.commissionRate!==undefined&&data.commissionRate!==null&&data.commissionRate!==""?Number(data.commissionRate):productLinkDefaultCommissionRateV211(type);
  const rate=input("product-link-commission-rate",Number(defaultRate||0).toFixed(2));rate.type="text";rate.inputMode="decimal";rateWrap.appendChild(rate);
  const rateHint=document.createElement("div");rateHint.className="product-link-commission-hint";rateHint.innerHTML='<span></span><b class="product-link-commission-amount">RM0.00</b>';rateWrap.appendChild(rateHint);
  grid2.append(pWrap,rateWrap);item.appendChild(grid2);

  const grid3=document.createElement("div");grid3.className="product-link-grid";
  const dWrap=document.createElement("div");dWrap.appendChild(label("本地运费"));
  const d=input("product-link-delivery money-input",formatAmount(Number(data.localDelivery||0)));d.inputMode="decimal";d.dataset.manual=(saved||Number(data.localDelivery||0)>0)?"1":"0";d.addEventListener("input",()=>{d.dataset.manual="1";recalcProductLinkProfitV211(item)});dWrap.appendChild(d);
  const eWrap=document.createElement("div");eWrap.appendChild(label("附加费用 花盆/苔藓"));
  const e=input("product-link-extra money-input",formatAmount(Number(data.extraFee||0)));e.inputMode="decimal";eWrap.appendChild(e);
  grid3.append(dWrap,eWrap);item.appendChild(grid3);

  const grid4=document.createElement("div");grid4.className="product-link-grid product-link-profit-grid";
  const profitWrap=document.createElement("div");profitWrap.appendChild(label("利润"));
  const profit=input("product-link-profit money-input","0.00");profit.readOnly=true;profit.tabIndex=-1;profitWrap.appendChild(profit);
  const marginWrap=document.createElement("div");marginWrap.appendChild(label("利润率"));
  const margin=input("product-link-profit-rate","0.00%");margin.readOnly=true;margin.tabIndex=-1;marginWrap.appendChild(margin);
  grid4.append(profitWrap,marginWrap);item.appendChild(grid4);

  item.appendChild(label("备注（顾客网络名字或电话号码）"));
  const remark=input("product-link-remark",String(data.remark||""),"顾客名字、电话或其他讯息");remark.maxLength=100;item.appendChild(remark);
  const remove=document.createElement("button");remove.type="button";remove.className="product-link-remove-btn product-link-remove-bottom";remove.textContent="删除销售卡";remove.addEventListener("click",()=>removeProductLinkItemV206(type,id));item.appendChild(remove);

  const recalc=()=>recalcProductLinkProfitV211(item);
  q.addEventListener("input",recalc);c.addEventListener("input",recalc);rate.addEventListener("input",recalc);e.addEventListener("input",recalc);
  p.addEventListener("input",()=>{applyLiveDeliveryDefaultItemV206(p);updateProductLinkMinimumWarningV214(item);recalc()});
  [name,q,c,p,rate,d,e,remark].forEach(el=>el.addEventListener("input",()=>markSalesCardDirtyV238(item)));
  [c,p,d,e].forEach(el=>el.addEventListener("blur",()=>{el.value=formatAmount(toAmount(el.value||0));recalc();}));
  rate.addEventListener("blur",()=>{const n=Math.max(0,Number(String(rate.value||"0").replace(/[^0-9.\-]/g,""))||0);rate.value=n.toFixed(2);recalc();});
  setTimeout(()=>{updateProductLinkMinimumWarningV214(item);recalc()},0);
  return item;
}
function addProductLinkItemV209(type,data={}){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  if(!wrap){console.error("V29.9 product item container missing",type);return false}
  const id=++productLinkItemSeqV206;
  const item=buildProductLinkItemV209(type,id,data);
  wrap.appendChild(item);
  return true;
}
function addProductLinkItemV206(type,data={}){return addProductLinkItemV209(type,data)}
// Explicit globals keep both legacy and V29.9 button bindings reliable.
window.addProductLinkItemV206=addProductLinkItemV206;
window.addProductLinkItemV209=addProductLinkItemV209;
window.toggleProductLinkBoxV206=toggleProductLinkBoxV206;
async function removeProductLinkItemV206(type,id){
  const {pre}=productLinkContextV206(type),wrap=document.getElementById(pre+"ProductItems"),el=wrap?.querySelector(`[data-product-link-item="${id}"]`);if(!el)return;
  const linkId=String(el.dataset.linkId||""),saved=el.dataset.saved==="1";
  if(linkId&&saved){
    if(!confirm("确定删除这棵已保存的盆栽关联？\n\n这会同步删除 Google Sheet 的 Sales_Product_Links 记录。"))return;
    try{setSync("正在删除盆栽关联...");await deleteSalesProductLinkV206(linkId);el.remove();setSync("盆栽关联已删除",true);alert("盆栽关联已删除。");}
    catch(e){alert("删除盆栽关联失败："+(e.message||e));setSync("盆栽关联删除失败",false,true);return;}
  }else el.remove();
  if(wrap&&!wrap.children.length)addProductLinkItemV209(type);
}
function applyLiveDeliveryDefaultItemV206(priceInput){const item=priceInput?.closest('.product-link-item'),d=item?.querySelector('.product-link-delivery');if(!d||d.dataset.manual==='1')return;d.value=formatAmount(liveDeliveryDefaultV203(toAmount(priceInput.value||0)));}
function fairDefaultProductDateV277(dates){
  const list=Array.isArray(dates)?dates.filter(Boolean):[];
  if(!list.length)return "";
  const today=isoToDisplay(todayISO());
  if(list.includes(today))return today;
  const todayIso=displayToISO(today);
  const past=list.filter(d=>displayToISO(d)<=todayIso);
  if(past.length)return past[past.length-1];
  return list[0];
}
function syncFairProductDatesV203(forceDefault=false){
  const sel=document.getElementById("fairProductDate");if(!sel)return;
  const start=document.getElementById("fairStart")?.value,end=document.getElementById("fairEnd")?.value||start;
  if(!start||!end){
    sel.innerHTML="";
    if(typeof refreshSalesActionLocksV270==="function")refreshSalesActionLocksV270();
    return;
  }
  const current=sel.value;
  const dates=dateRange(start,end);
  const target=fairDefaultProductDateV277(dates);
  sel.innerHTML=dates.map(d=>`<option value="${d}">${d}</option>`).join("");
  if(!forceDefault&&dates.includes(current))sel.value=current;
  else if(target)sel.value=target;
  if(typeof refreshSalesActionLocksV270==="function")refreshSalesActionLocksV270();
}
function handleFairProductDateChangeV342(){
  if(typeof refreshSalesActionLocksV270==="function")refreshSalesActionLocksV270();
  const amount=typeof selectedActionAmountV270==="function"?selectedActionAmountV270("fair"):0;
  if(amount<=0.005)return false;
  const panel=productProfitSummaryPanelV216("fair");
  if(panel&&!panel.classList.contains("hidden")){panel.classList.add("hidden");panel.innerHTML="";productProfitSummaryOpenV216.fair=false;const btn=document.querySelector("#fairProductLinkBox .product-profit-toggle-btn");if(btn)btn.textContent="📊 当天利润"}
  if(productLinkBoxIsOpenV210("fair"))Promise.resolve(loadProductLinksIntoEditorV206("fair")).catch(()=>{});
  return true;
}
window.handleFairProductDateChangeV342=handleFairProductDateChangeV342;
function collectProductLinksV206(type){
  const {pre,date,location}=productLinkContextV206(type),wrap=document.getElementById(pre+"ProductItems"),items=[...(wrap?.querySelectorAll('.product-link-item')||[])];
  return items.map(item=>{
    let linkId=String(item.dataset.linkId||"");
    const productName=String(item.querySelector('.product-link-name')?.value||"").trim(),actualPrice=toAmount(item.querySelector('.product-link-price')?.value||0),remark=String(item.querySelector('.product-link-remark')?.value||"").trim();
    if(!linkId&&(productName||actualPrice||remark)){linkId="spl_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);item.dataset.linkId=linkId;}
    const quantity=Math.max(0,Number(item.querySelector('.product-link-qty')?.value||0)),averageCost=toAmount(item.querySelector('.product-link-avg-cost')?.value||0),commissionRate=Math.max(0,Number(item.querySelector('.product-link-commission-rate')?.value||0)),localDelivery=toAmount(item.querySelector('.product-link-delivery')?.value||0),extraFee=toAmount(item.querySelector('.product-link-extra')?.value||0);
    const commissionAmount=actualPrice*commissionRate/100,profit=actualPrice-commissionAmount-(averageCost*quantity)-localDelivery-extraFee,profitRate=actualPrice>0?profit/actualPrice*100:0;
    const productId=String(item.querySelector(".product-link-name")?.dataset.productId||"");const minimumPrice=Math.max(0,Number(item.dataset.minimumPrice||0));return{linkId,type,date,location,productId,productName,quantity,averageCost,minimumPrice,actualPrice,commissionRate,commissionAmount,localDelivery,extraFee,profit,profitRate,remark};
  }).filter(x=>x.linkId||x.productName||x.actualPrice||x.remark);
}
function renderProductLinksEditorV206(type,links){const {pre}=productLinkContextV206(type),wrap=document.getElementById(pre+"ProductItems");if(!wrap)return;wrap.innerHTML="";const list=Array.isArray(links)?links:[];if(list.length)list.forEach(x=>addProductLinkItemV209(type,x));else addProductLinkItemV209(type);}
function clearUnsavedSalesCardEditorsV224(){
  ["live","fair","daily"].forEach(type=>{
    const pre=productLinkPreV208(type);
    const wrap=document.getElementById(pre+"ProductItems");
    if(!wrap)return;

    const cards=[...wrap.querySelectorAll(".product-link-item")];
    cards.forEach(card=>{
      const linkId=String(card.dataset.linkId||"").trim();
      if(!linkId)card.remove();
    });

    // 已保存销售卡保留；另加一张空白销售卡，方便 Refresh 后马上继续输入。
    addProductLinkItemV209(type);

    // 不收起销售卡、不切换页面、不改变当天利润开关。
    if(type==="fair")syncFairProductDatesV203();
  });
}
window.clearUnsavedSalesCardEditorsV224=clearUnsavedSalesCardEditorsV224;

function productLinkBoxIsOpenV210(type){
  const pre=productLinkPreV208(type),body=document.getElementById(pre+"ProductLinkBody");
  return !!body&&!body.classList.contains("hidden");
}
function refreshProductLinkContextV210(type){
  if(!productLinkBoxIsOpenV210(type))return;
  Promise.resolve(loadProductLinksIntoEditorV206(type)).catch(()=>{});
}
function productImportSearchIsActiveV226(type){
  const pre=productLinkPreV208(type);
  const wrap=document.getElementById(pre+"ProductItems");
  if(!wrap)return false;
  return [...wrap.querySelectorAll(".product-link-item")].some(item=>{
    const input=item.querySelector(".product-link-name");
    const results=item.querySelector(".product-link-search-results");
    return item.dataset.importSearchOpen==="1" ||
      document.activeElement===input ||
      (results&&!results.hidden);
  });
}

function renderProductLinksLoadingV231(type){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  if(!wrap||productImportSearchIsActiveV226(type))return;
  wrap.innerHTML='<div class="product-link-loading-v231">正在读取已保存销售卡…</div>';
}
const SALES_CARD_LOAD_SEQ_V245={daily:0,live:0,fair:0};
// V46.0: Sales Card freshness is controlled by the global Revision gate.
// Cached exact contexts open instantly; they are refreshed only after another
// device advances the cloud Sales Card revision.
const SALES_CARD_VERIFY_SEQ_V445={daily:0,live:0,fair:0};
const SALES_CARD_VERIFY_PENDING_V445={daily:'',live:'',fair:''};
function salesCardCloudVerifyPendingV445(){return Object.values(SALES_CARD_VERIFY_PENDING_V445).some(Boolean)}
window.salesCardCloudVerifyPendingV445=salesCardCloudVerifyPendingV445;
function salesCardCloudFingerprintV445(links){
  const safe=(Array.isArray(links)?links:[]).map(x=>({
    linkId:String(x?.linkId||''),transactionId:String(x?.transactionId||x?.saleId||''),productOrder:Number(x?.productOrder||1),
    productId:String(x?.productId||''),productName:String(x?.productName||''),quantity:Number(x?.quantity||0),
    averageCost:Number(x?.averageCost||0),minimumPrice:Number(x?.minimumPrice||0),actualPrice:Number(x?.actualPrice||0),
    commissionRate:Number(x?.commissionRate||0),commissionAmount:Number(x?.commissionAmount||0),localDelivery:Number(x?.localDelivery||0),
    extraFee:Number(x?.extraFee||0),profit:Number(x?.profit||0),profitRate:Number(x?.profitRate||0),remark:String(x?.remark||''),
    importSyncStatus:String(x?.importSyncStatus||''),confirmedOnce:x?.confirmedOnce===true,status:String(x?.status||'active')
  }));
  safe.sort((a,b)=>String(a.transactionId).localeCompare(String(b.transactionId))||a.productOrder-b.productOrder||String(a.linkId).localeCompare(String(b.linkId)));
  return JSON.stringify(safe);
}
async function verifyCachedSalesCardContextV445(type,date,location,contextKey,cachedSnapshot){
  const verifySeq=(SALES_CARD_VERIFY_SEQ_V445[type]||0)+1;
  SALES_CARD_VERIFY_SEQ_V445[type]=verifySeq;
  SALES_CARD_VERIFY_PENDING_V445[type]=contextKey;
  setSync('销售卡核对中...');
  try{
    const pendingKey=salesDraftPendingKeyV314(type,date,location);
    const pending=readSalesDraftPendingV314()[pendingKey];
    if(pending){
      setSync('本机销售卡待云端同步');
      setTimeout(()=>syncQueuedSalesDraftV314(pendingKey,String(pending.token||'')).catch(()=>{}),0);
      return cachedSnapshot;
    }
    let cloudRaw;
    try{cloudRaw=await loadSalesProductLinksV206(type,date,location,{force:true,maxAgeMs:0});}
    catch(firstError){await new Promise(resolve=>setTimeout(resolve,350));cloudRaw=await loadSalesProductLinksV206(type,date,location,{force:true,maxAgeMs:0});}
    const filtered=filterDeletedSalesLinksV350(type,date,location,cloudRaw);
    const deduped=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(filtered):filtered;
    pruneSalesCardFinalStatesV447(type,date,location,deduped);
    const cloud=captureSalesCardFinalStatesV431(type,date,location,deduped);
    const current=productLinkContextV206(type);
    const currentKey=salesCardContextKeyV245(type,current.date,current.location);
    const stillCurrent=SALES_CARD_VERIFY_SEQ_V445[type]===verifySeq&&currentKey===contextKey;
    const dirty=typeof hasUnsavedSalesCardChangesV238==='function'&&hasUnsavedSalesCardChangesV238(type);
    if(stillCurrent&&!dirty){
      const changed=salesCardCloudFingerprintV445(cachedSnapshot)!==salesCardCloudFingerprintV445(cloud);
      if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,date,location,cloud);
      if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(type,date,location,cloud);
      if(changed&&!productImportSearchIsActiveV226(type))renderProductLinksEditorV206(type,cloud);
      applyCloudDraftStatusesV322(type,cloud);
    }
    if(stillCurrent){
      if(dirty){
        setSync('销售卡有未保存修改');
      }else{
        if(SALES_CARD_VERIFY_PENDING_V445[type]===contextKey)SALES_CARD_VERIFY_PENDING_V445[type]='';
        setSync('已同步',true);
      }
    }
    return cloud;
  }catch(e){
    const current=productLinkContextV206(type);
    const currentKey=salesCardContextKeyV245(type,current.date,current.location);
    if(SALES_CARD_VERIFY_SEQ_V445[type]===verifySeq&&currentKey===contextKey)setSync('销售卡云端核对失败',false,true);
    return null;
  }finally{
    if(SALES_CARD_VERIFY_SEQ_V445[type]===verifySeq&&SALES_CARD_VERIFY_PENDING_V445[type]===contextKey)SALES_CARD_VERIFY_PENDING_V445[type]='';
  }
}
// V36.0: invalidate any cloud read that began before a local delete/save acknowledgement.
function invalidateSalesCardLoadRequestsV351(type){
  const t=String(type||'');if(!t)return;
  SALES_CARD_LOAD_SEQ_V245[t]=(SALES_CARD_LOAD_SEQ_V245[t]||0)+1;
}
window.invalidateSalesCardLoadRequestsV351=invalidateSalesCardLoadRequestsV351;
function salesCardContextKeyV245(type,date,location){
  return [String(type||""),String(date||""),String(location||"").trim().toLowerCase()].join("|");
}
// V46.0: a completed sale is a whole-card, permanent local fact. Keep it in
// a separate cache so an older draft snapshot can never downgrade the card.
const SALES_CARD_FINAL_STATE_KEY_V431='lover_sales_card_final_state_v431';
function readSalesCardFinalStatesV431(){try{const x=JSON.parse(localStorage.getItem(SALES_CARD_FINAL_STATE_KEY_V431)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return{}}}
function writeSalesCardFinalStatesV431(x){try{localStorage.setItem(SALES_CARD_FINAL_STATE_KEY_V431,JSON.stringify(x||{}))}catch(_){}}
function salesCardFinalStateKeyV431(type,date,location,transactionId){return salesCardContextKeyV245(type,date,location)+'|'+String(transactionId||'').trim()}
function rememberSalesCardFinalStateV431(type,date,location,transactionId,kind){
  const tx=String(transactionId||'').trim();if(!tx||!['inventory','non_inventory'].includes(kind))return;
  const all=readSalesCardFinalStatesV431();all[salesCardFinalStateKeyV431(type,date,location,tx)]={kind,at:Date.now()};writeSalesCardFinalStatesV431(all);
}
// V46.0: an authoritative cloud context may legitimately become empty after a
// card is deleted on another device. Remove final-state residue for transactions
// that no longer exist so a deleted card can never be resurrected by local state.
function pruneSalesCardFinalStatesV447(type,date,location,links){
  const all=readSalesCardFinalStatesV431();
  const prefix=salesCardContextKeyV245(type,date,location)+'|';
  const active=new Set((Array.isArray(links)?links:[]).map(x=>String(x?.transactionId||x?.saleId||'').trim()).filter(Boolean));
  let changed=false;
  Object.keys(all).forEach(key=>{
    if(!key.startsWith(prefix))return;
    const tx=key.slice(prefix.length);
    if(!active.has(tx)){delete all[key];changed=true;}
  });
  if(changed)writeSalesCardFinalStatesV431(all);
}
function applySalesCardFinalStatesV431(type,date,location,links){
  const list=(Array.isArray(links)?links:[]).map(x=>({...x})),all=readSalesCardFinalStatesV431(),groups=new Map();
  list.forEach(x=>{const tx=String(x.transactionId||x.saleId||'').trim();if(tx){if(!groups.has(tx))groups.set(tx,[]);groups.get(tx).push(x)}});
  groups.forEach((rows,tx)=>{
    const rec=all[salesCardFinalStateKeyV431(type,date,location,tx)];if(!rec)return;
    rows.forEach(x=>{x.confirmedOnce=true;x.importSyncStatus=rec.kind==='non_inventory'?'NON_INVENTORY':(String(x.productId||'').trim()?'INVENTORY_CONFIRMED':'NON_INVENTORY')});
  });
  return list;
}
function captureSalesCardFinalStatesV431(type,date,location,links){
  const list=Array.isArray(links)?links:[],groups=new Map();
  list.forEach(x=>{const tx=String(x.transactionId||x.saleId||'').trim();if(tx){if(!groups.has(tx))groups.set(tx,[]);groups.get(tx).push(x)}});
  groups.forEach((rows,tx)=>{
    const confirmed=rows.some(x=>x.confirmedOnce===true||salesCardStatusIsConfirmedV322(x.importSyncStatus));if(!confirmed)return;
    const inventoryRows=rows.filter(x=>String(x.productId||'').trim());
    if(!inventoryRows.length&&rows.every(x=>String(x.importSyncStatus||'')==='NON_INVENTORY'))rememberSalesCardFinalStateV431(type,date,location,tx,'non_inventory');
    else if(inventoryRows.length&&inventoryRows.every(x=>String(x.importSyncStatus||'')==='INVENTORY_CONFIRMED'))rememberSalesCardFinalStateV431(type,date,location,tx,'inventory');
  });
  return applySalesCardFinalStatesV431(type,date,location,list);
}
window.applySalesCardFinalStatesV431=applySalesCardFinalStatesV431;
async function loadProductLinksIntoEditorV206(type){
  const {date,location}=productLinkContextV206(type);
  const seq=(SALES_CARD_LOAD_SEQ_V245[type]||0)+1;
  SALES_CARD_LOAD_SEQ_V245[type]=seq;

  if(!date||!location){
    if(!productImportSearchIsActiveV226(type))renderProductLinksEditorV206(type,[]);
    return;
  }

  const contextKey=salesCardContextKeyV245(type,date,location);
  const cachedRaw=(typeof getCachedSalesProductLinksV216==='function')
    ?getCachedSalesProductLinksV216(type,date,location):null;
  const cached=Array.isArray(cachedRaw)
    ?applySalesCardFinalStatesV431(type,date,location,filterDeletedSalesLinksV350(type,date,location,cachedRaw))
    :cachedRaw;

  // V50.2: keep the V50.2 Local First sync architecture.
  // A cached Sales Card opens immediately and is NOT exact-read merely because
  // a legacy/global verification watermark differs. Real cross-device changes
  // are already handled by the V50.2 shared priorityRevisionV456 change journal,
  // which fetches only card contexts that actually changed.
  if(Array.isArray(cached)){
    if(!productImportSearchIsActiveV226(type))renderProductLinksEditorV206(type,cached);
    applyCloudDraftStatusesV322(type,cached);
    const pendingKey=salesDraftPendingKeyV314(type,date,location);
    const pending=readSalesDraftPendingV314()[pendingKey];
    if(pending){
      const pre=productLinkPreV208(type),msg=document.getElementById(pre+'ProductLinkMsg');
      if(msg){msg.classList.remove('hidden');msg.textContent='🟡 本机销售卡已打开 · 云端后台自动重试';}
      setSync('本机销售卡待云端同步');
      setTimeout(()=>syncQueuedSalesDraftV314(pendingKey,String(pending.token||'')).catch(()=>{}),0);
    }
    return cached;
  }

  // No cache on this device: read only this exact context from cloud.
  // Mark it pending so another foreground sync cannot claim green 已同步 first.
  SALES_CARD_VERIFY_PENDING_V445[type]=contextKey;
  renderProductLinksLoadingV231(type);
  try{
    const pendingKey=salesDraftPendingKeyV314(type,date,location);
    let pendingDraft=readSalesDraftPendingV314()[pendingKey];
    if(pendingDraft){
      // A durable local draft is itself valid local data. Paint it immediately,
      // queue cloud retry, and never make the user wait for cloud.
      const localItems=Array.isArray(pendingDraft.items)?pendingDraft.items:[];
      if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,date,location,localItems);
      if(!productImportSearchIsActiveV226(type))renderProductLinksEditorV206(type,localItems);
      setTimeout(()=>syncQueuedSalesDraftV314(pendingKey,String(pendingDraft.token||'')).catch(()=>{}),0);
      return localItems;
    }

    let cloudLinksRaw;
    try{
      cloudLinksRaw=await loadSalesProductLinksV206(type,date,location,{force:true,maxAgeMs:0});
    }catch(firstError){
      await new Promise(resolve=>setTimeout(resolve,500));
      cloudLinksRaw=await loadSalesProductLinksV206(type,date,location,{force:true,maxAgeMs:0});
    }
    const cloudLinks=filterDeletedSalesLinksV350(type,date,location,cloudLinksRaw);
    const dedupedLinks=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(cloudLinks):cloudLinks;
    pruneSalesCardFinalStatesV447(type,date,location,dedupedLinks);
    const links=captureSalesCardFinalStatesV431(type,date,location,dedupedLinks);
    if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,date,location,links);
    if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(type,date,location,links);
    const verifiedRevisionV451=typeof getPrioritySyncLocalV315==='function'?Number((getPrioritySyncLocalV315()||{}).salesCardRevision||0):0;
    if(typeof markSalesCardContextVerifiedV451==='function')markSalesCardContextVerifiedV451(type,date,location,verifiedRevisionV451);

    const current=productLinkContextV206(type);
    const currentKey=salesCardContextKeyV245(type,current.date,current.location);
    if(SALES_CARD_LOAD_SEQ_V245[type]===seq&&currentKey===contextKey&&!productImportSearchIsActiveV226(type)){
      renderProductLinksEditorV206(type,links);
      applyCloudDraftStatusesV322(type,links);
      setTimeout(()=>{if(typeof refreshInventoryPendingV250==='function')refreshInventoryPendingV250(true)},0);
      if(SALES_CARD_VERIFY_PENDING_V445[type]===contextKey)SALES_CARD_VERIFY_PENDING_V445[type]='';
      // V50.2: an explicit Sales Card view does not declare the whole context synced.
    }
    return links;
  }catch(e){
    const current=productLinkContextV206(type);
    const currentKey=salesCardContextKeyV245(type,current.date,current.location);
    if(SALES_CARD_LOAD_SEQ_V245[type]===seq&&currentKey===contextKey&&!productImportSearchIsActiveV226(type)){
      if(SALES_CARD_VERIFY_PENDING_V445[type]===contextKey)SALES_CARD_VERIFY_PENDING_V445[type]='';
      const pre=productLinkPreV208(type),wrap=document.getElementById(pre+'ProductItems');
      if(wrap)wrap.innerHTML='<div class="product-link-loading-v231">销售卡读取失败，请再试一次。</div>';
      // V50.2: card-view read failure stays inside the card panel; global sync is unchanged.
    }
    return null;
  }
}
async function saveProductLinksV206(type){
  const items=collectProductLinksV206(type);if(!items.length){alert("请至少输入一张销售卡；如果这次没有销售卡，可以保持收起，不需要保存。");return null}
  const first=items[0];if(!first.date||!first.location){alert(type==="live"?"请先选择日期和主播":type==="fair"?"请先选择 Fair 日期和地点":"请先选择日期");return null}
  for(const x of items){if(!x.productName){alert("每一张销售卡都需要填写产品名称。");return null}if(!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0){alert("每一张销售卡数量必须大于 0。");return null}}
  const official=dedupeRows(rows).filter(r=>r.type===type&&r.date===first.date&&(type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(first.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(first.location))).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
  const batchTotal=items.reduce((s,x)=>s+Number(x.actualPrice||0),0);if(official>0&&batchTotal>official+0.005){alert(`盆栽实际售价合计 RM${formatAmount(batchTotal)} 已超过当天营业额 RM${formatAmount(official)}。`);return null}
  try{
    setSync("销售卡同步中...");
    const result=await saveSalesProductLinksV206(items);
    renderProductLinksEditorV206(type,result?.links||[]);
    setSync("销售卡已保存",true);
    alert("销售卡保存成功。\n\n如有库存变动，请到 Import Cost System 处理。");
    if(typeof refreshInventoryPendingV250==="function")refreshInventoryPendingV250(true);
    if(result?.warning)alert(result.warning);
    return result;
  }
  catch(e){alert("销售卡保存失败："+(e.message||e));setSync("销售卡同步失败",false,true);return null}
}


/* ================= V29.9 multi-product Sales Card ================= */
let salesCardSeqV239=0;

function salesCardTxnIdV239(data={}){
  return String(data.transactionId||"").trim()||("txn_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,9));
}
function salesCardWrappersV239(type){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  return [...(wrap?.querySelectorAll(".sales-card-transaction-v239")||[])];
}
function markSalesCardTransactionDirtyV239(card){
  if(!card)return;
  card.dataset.dirty="1";
  card.querySelectorAll(".product-link-item").forEach(x=>x.dataset.dirty="1");
  if(typeof refreshSingleCardActionsV405==='function')refreshSingleCardActionsV405(card);
}
function clearSalesCardTransactionDirtyV239(card){
  if(!card)return;
  card.dataset.dirty="0";
  card.querySelectorAll(".product-link-item").forEach(x=>x.dataset.dirty="0");
  if(typeof refreshSingleCardActionsV405==='function')refreshSingleCardActionsV405(card);
}
function salesCardProductsV239(card){
  return [...(card?.querySelectorAll(".product-link-item")||[])];
}
function salesCardSharedValuesV239(card){
  return{
    commissionRate:Math.max(0,Number(String(card.querySelector(".sales-card-commission-rate-v239")?.value||"0").replace(/[^0-9.\-]/g,""))||0),
    deliveryTotal:Math.max(0,toAmount(card.querySelector(".sales-card-delivery-total-v239")?.value||0)),
    extraTotal:Math.max(0,toAmount(card.querySelector(".sales-card-extra-total-v239")?.value||0)),
    remark:String(card.querySelector(".sales-card-remark-v239")?.value||"").trim()
  };
}
function salesCardAutoDeliveryForItemV239(item){
  const card=item?.closest?.(".sales-card-transaction-v239");
  // V50.2: only Live auto-generates 木架＋本地运费. Sales / Fair stay manual.
  if(String(card?.dataset?.type||"").toLowerCase()!=="live")return 0;
  const price=toAmount(item.querySelector(".product-link-price")?.value||0);
  const qty=Math.max(1,Number(item.querySelector(".product-link-qty")?.value||1));
  return liveDeliveryDefaultV203(price)*qty;
}
function allocateSalesCardSharedCostsV239(card){
  const products=salesCardProductsV239(card);
  const shared=salesCardSharedValuesV239(card);
  const prices=products.map(x=>Math.max(0,toAmount(x.querySelector(".product-link-price")?.value||0)));
  const defaults=products.map(salesCardAutoDeliveryForItemV239);
  const priceTotal=prices.reduce((a,b)=>a+b,0);
  const defaultDeliveryTotal=defaults.reduce((a,b)=>a+b,0);
  const deliveryManual=card.dataset.deliveryManual==="1";

  return products.map((item,i)=>{
    let delivery=defaults[i];
    if(deliveryManual){
      const denom=defaultDeliveryTotal>0?defaultDeliveryTotal:priceTotal;
      const weight=denom>0?(defaultDeliveryTotal>0?defaults[i]/denom:prices[i]/denom):(products.length?1/products.length:0);
      delivery=shared.deliveryTotal*weight;
    }
    const extraWeight=priceTotal>0?prices[i]/priceTotal:(products.length?1/products.length:0);
    const extra=shared.extraTotal*extraWeight;
    const commission=prices[i]*shared.commissionRate/100;
    return{delivery,extra,commission,price:prices[i],commissionRate:shared.commissionRate};
  });
}
function recalcSalesCardTransactionV239(card){
  if(!card)return;
  const products=salesCardProductsV239(card);
  if(card.dataset.deliveryManual!=="1"){
    const autoTotal=products.reduce((s,x)=>s+salesCardAutoDeliveryForItemV239(x),0);
    const d=card.querySelector(".sales-card-delivery-total-v239");
    if(d)d.value=formatAmount(autoTotal);
  }
  const alloc=allocateSalesCardSharedCostsV239(card);
  let totalPrice=0,totalCost=0,totalProfit=0,totalCommission=0,totalDelivery=0,totalExtra=0;
  products.forEach((item,i)=>{
    const qty=Math.max(0,Number(item.querySelector(".product-link-qty")?.value||0));
    const avgCost=toAmount(item.querySelector(".product-link-avg-cost")?.value||0);
    const cost=avgCost*qty,price=alloc[i]?.price||0;
    const profit=price-(alloc[i]?.commission||0)-cost-(alloc[i]?.delivery||0)-(alloc[i]?.extra||0);
    const rate=price>0?profit/price*100:0;
    totalPrice+=price;totalCost+=cost;totalProfit+=profit;totalCommission+=(alloc[i]?.commission||0);totalDelivery+=(alloc[i]?.delivery||0);totalExtra+=(alloc[i]?.extra||0);
    item.dataset.allocatedDelivery=String(alloc[i]?.delivery||0);
    item.dataset.allocatedExtra=String(alloc[i]?.extra||0);
    const profitEl=item.querySelector(".product-link-profit");
    const rateEl=item.querySelector(".product-link-profit-rate");
    const shipEl=item.querySelector(".product-item-auto-delivery-v239");
    if(profitEl)profitEl.textContent=formatAmount(profit);
    if(rateEl)rateEl.textContent=(Number.isFinite(rate)?rate:0).toFixed(2)+"%";
    if(shipEl)shipEl.textContent="运费 "+formatAmount(alloc[i]?.delivery||0);
  });
  const rate=totalPrice>0?totalProfit/totalPrice*100:0;
  const set=(sel,val)=>{const el=card.querySelector(sel);if(el)el.textContent=val};
  set(".sales-card-price-total-v239","RM"+formatAmount(totalPrice));
  // V35.0: displayed total cost uses the same complete cost basis as profit.
  // Profit itself is intentionally unchanged to avoid double-deducting fees.
  set(".sales-card-cost-total-v239","RM"+formatAmount(totalCost+totalDelivery+totalExtra+totalCommission));
  set(".sales-card-commission-amount-v239","RM"+formatAmount(totalCommission));
  set(".sales-card-profit-total-v239","RM"+formatAmount(totalProfit));
  set(".sales-card-profit-rate-v239",(Number.isFinite(rate)?rate:0).toFixed(2)+"%");
  const official=dedupeRows(rows).filter(r=>{
    const ctx=productLinkContextV206(card.dataset.type);
    if(r.type!==card.dataset.type||r.date!==ctx.date)return false;
    return card.dataset.type==="daily"?r.company===(String(ctx.location||'').toLowerCase().includes('balakong')?'balakong':'belimbing'):card.dataset.type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(ctx.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(ctx.location);
  }).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
  const warn=card.querySelector(".sales-card-total-warning-v239");
  if(warn){
    warn.hidden=!(official>0&&totalPrice>official+0.005);
    warn.textContent=warn.hidden?"":`这张销售卡售价合计 RM${formatAmount(totalPrice)} 已超过当天营业额 RM${formatAmount(official)}`;
  }
}


// V29.9 Live 木架等级
const LIVE_CRATE_V269=[["0","自取0"],["20","A20"],["50","B50"],["80","C80"],["120","D120"],["150","E150"],["180","F180"]];
function liveCrateRateForPriceV461(price){
  const value=Math.max(0,Number(price||0));
  if(value<300)return 20;
  if(value<=500)return 50;
  if(value<=1000)return 80;
  if(value<=2000)return 120;
  if(value<5000)return 150;
  return 180;
}
function createLiveCrateV269(price=0){
 const s=document.createElement("select");
 s.className="live-crate-v269";
 LIVE_CRATE_V269.forEach(x=>{let o=document.createElement("option");o.value=x[0];o.textContent=x[1];s.appendChild(o)});
 s.value=String(liveCrateRateForPriceV461(price));
 s.dataset.manual="0";
 return s;
}
function getLiveCrateV269(item){
 return Number(item?.querySelector(".live-crate-v269")?.value||0);
}
function buildProductSubItemV239(type,card,data={},order=1){
  const id=++productLinkItemSeqV206;
  const linkId=String(data.linkId||""),saved=!!linkId,qty=Math.max(1,Number(data.quantity||1));
  const item=document.createElement("div");
  item.className="product-link-item product-link-subitem-v239";
  item.dataset.productLinkItem=String(id);
  item.dataset.linkId=linkId;
  item.dataset.saved=saved?"1":"0";
  item.dataset.dirty="0";
  item.dataset.minimumPrice=String(Number(data.minimumPrice||0));
  item.dataset.importMapped=String(data.productId||"")?"1":"0";
  item.dataset.productOrder=String(order);
  item.dataset.inventoryStatus=String(data.importSyncStatus||"PENDING_IMPORT_LINK");

  const head=document.createElement("div");head.className="product-subitem-head-v239";
  const title=document.createElement("b");title.className="product-subitem-title-v239";title.textContent=`产品 ${order}`;
  const remove=document.createElement("button");remove.type="button";remove.className="product-subitem-remove-v239";remove.textContent="删除产品";
  head.append(title,remove);item.appendChild(head);

  const label=(text)=>{const el=document.createElement("label");el.textContent=text;return el};
  const input=(cls,value,placeholder)=>{const el=document.createElement("input");el.className=cls;el.value=value??"";if(placeholder)el.placeholder=placeholder;return el};

  item.appendChild(label("搜索或输入产品"));
  const name=input("product-link-name",String(data.productName||""),"输入产品名称、编号或原成本搜索，或直接手动输入");
  name.dataset.productId=String(data.productId||"");
  const searchWrap=document.createElement("div");searchWrap.className="product-link-search-wrap";
  const searchInputRow=document.createElement("div");searchInputRow.className="product-link-search-input-row";
  searchInputRow.appendChild(name);
  const searchClose=document.createElement("button");searchClose.type="button";searchClose.className="product-link-search-close";searchClose.textContent="×";searchClose.setAttribute("aria-label","收起产品列表");
  searchInputRow.appendChild(searchClose);searchWrap.appendChild(searchInputRow);
  const searchResults=document.createElement("div");searchResults.className="product-link-search-results";searchResults.hidden=true;
  searchWrap.appendChild(searchResults);item.appendChild(searchWrap);
  setupImportProductSearchV214(item,name,searchResults,searchClose);

  const grid=document.createElement("div");grid.className="product-subitem-grid-v239";
  const qWrap=document.createElement("div");qWrap.appendChild(label("数量"));
  const q=input("product-link-qty qty-input-no-spinner",String(qty));q.type="number";q.min="1";q.step="1";q.inputMode="numeric";qWrap.appendChild(q);
  const cWrap=document.createElement("div");cWrap.appendChild(label("平均成本"));
  const c=input("product-link-avg-cost money-input",formatAmount(Number(data.averageCost||0)));c.inputMode="decimal";cWrap.appendChild(c);
  const pWrap=document.createElement("div");pWrap.appendChild(label("这棵售价"));
  const p=input("product-link-price money-input",formatAmount(Number(data.actualPrice||0)));p.inputMode="decimal";pWrap.appendChild(p);
  const minWarn=document.createElement("div");minWarn.className="product-link-minimum-warning";minWarn.hidden=true;pWrap.appendChild(minWarn);
  grid.append(qWrap,cWrap,pWrap);item.appendChild(grid);

  const result=document.createElement("div");result.className="product-subitem-result-v239";
  const crate=document.createElement("span");crate.className="live-crate-wrap-v269";
  if(String(type).toLowerCase()==="live"){crate.innerHTML="木架等级 ";crate.appendChild(createLiveCrateV269(Number(data.actualPrice||0)));}
  const ship=document.createElement("span");ship.className="product-item-auto-delivery-v239";ship.textContent="运费 0.00";
  const profit=document.createElement("span");profit.innerHTML='利润 <b class="product-link-profit">0.00</b>';
  const rate=document.createElement("span");rate.innerHTML='利润率 <b class="product-link-profit-rate">0.00%</b>';
  if(String(type).toLowerCase()==="live") result.append(crate,ship,profit,rate); else result.append(ship,profit,rate);
  item.appendChild(result);

  const onEdit=()=>{markSalesCardDirtyV238(item);markSalesCardTransactionDirtyV239(card);recalcSalesCardTransactionV239(card)};
  [name,q,c,p].forEach(el=>el.addEventListener("input",onEdit));
  const legacyLiveCrateV461=item.querySelector(".live-crate-v269");
  legacyLiveCrateV461?.addEventListener("change",()=>{legacyLiveCrateV461.dataset.manual="1";onEdit()});
  if(String(type).toLowerCase()==="live")p.addEventListener("input",()=>{
    if(legacyLiveCrateV461&&legacyLiveCrateV461.dataset.manual!=="1")legacyLiveCrateV461.value=String(liveCrateRateForPriceV461(toAmount(p.value||0)));
  });
  [c,p].forEach(el=>el.addEventListener("blur",()=>{
    el.value=formatAmount(toAmount(el.value||0));
    // V29.9: blur fires before the Save button click. Re-mark the card dirty here so
    // a late initialization/render timer can never erase the user's first price edit.
    markSalesCardDirtyV238(item);
    markSalesCardTransactionDirtyV239(card);
    recalcSalesCardTransactionV239(card);
  }));
  p.addEventListener("input",()=>updateProductLinkMinimumWarningV214(item));
  p.addEventListener("change",()=>{markSalesCardDirtyV238(item);markSalesCardTransactionDirtyV239(card);recalcSalesCardTransactionV239(card)});
  bindSingleTapDeleteProductV254(remove,()=>removeProductFromTransactionV239(type,card,item));
  setTimeout(()=>{updateProductLinkMinimumWarningV214(item);recalcSalesCardTransactionV239(card)},0);
  return item;
}

function renumberTransactionProductsV239(card){
  salesCardProductsV239(card).forEach((item,i)=>{
    item.dataset.productOrder=String(i+1);
    const title=item.querySelector(".product-subitem-title-v239");
    if(title)title.textContent=`产品 ${i+1}`;
  });
}

// V50.8: draft product order is presentation metadata only. Keep it contiguous
// immediately after deletes and at every draft serialization/cache boundary.
function normalizeDraftProductOrdersV503(card){
  if(!card||salesCardIsConfirmedV322(card))return;
  renumberTransactionProductsV239(card);
  salesCardProductsV239(card).forEach((item,i)=>{item.dataset.productOrder=String(i+1)});
}
function addProductToTransactionV239(type,txnId,data={}){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  const card=[...(wrap?.querySelectorAll(".sales-card-transaction-v239")||[])].find(x=>x.dataset.transactionId===txnId);
  if(!card)return false;
  if(salesCardIsConfirmedV322(card)){alert('这张销售卡已经确认并永久锁定，只能阅读。顾客加购请新增销售卡。');return false}
  const list=card.querySelector(".sales-card-products-v239");
  const item=buildProductSubItemV239(type,card,data,salesCardProductsV239(card).length+1);
  list.appendChild(item);
  markSalesCardTransactionDirtyV239(card);
  recalcSalesCardTransactionV239(card);
  return true;
}
window.addProductToTransactionV239=addProductToTransactionV239;


function bindSingleTapDeleteProductV254(button,handler){
  if(!button||typeof handler!=="function")return;
  let skipNextClick=false;

  // V29.9: for touch/pen, pointerup is the one and only real activation.
  // The synthetic click generated later by the browser is always swallowed once,
  // regardless of how long an alert/confirm dialog stayed open.
  button.addEventListener("pointerup",e=>{
    if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
    e.preventDefault();
    e.stopPropagation();
    skipNextClick=true;
    Promise.resolve(handler()).catch(err=>console.warn("删除产品失败",err));
  },{passive:false});

  // Desktop mouse activation remains normal.
  button.addEventListener("click",e=>{
    if(skipNextClick){
      skipNextClick=false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    Promise.resolve(handler()).catch(err=>console.warn("删除产品失败",err));
  });

  button.addEventListener("keydown",e=>{
    if(e.key!=="Enter"&&e.key!==" ")return;
    e.preventDefault();
    e.stopPropagation();
    Promise.resolve(handler()).catch(err=>console.warn("删除产品失败",err));
  });
}

async function removeProductFromTransactionV239(type,card,item){
  if(!item||item.dataset.deletingV253==="1")return;
  if(salesCardIsConfirmedV322(card)){alert('这张销售卡已经确认并永久锁定，不能修改产品。');return}
  const products=salesCardProductsV239(card);
  if(products.length<=1){alert("一张销售卡至少需要保留一个产品。");return}

  item.dataset.deletingV253="1";
  const linkId=String(item.dataset.linkId||"");
  const isSaved=!!(linkId&&item.dataset.saved==="1");

  // V29.9:
  // Removing a product from a saved sales card is an EDIT, not an immediate backend delete.
  // We only remove it from the editor and mark the whole card dirty.
  // On the FIRST press of "Save", the backend compares the original active Link IDs
  // against the submitted Link IDs and writes Sale Status=deleted + Deleted At.
  if(isSaved&&!confirm("确定从这张草稿销售卡删除这个产品？\n\n删除会在点击这张卡的「更新草稿」后正式生效。")){
    item.dataset.deletingV253="0";
    return;
  }

  item.remove();
  renumberTransactionProductsV239(card);
  markSalesCardTransactionDirtyV239(card);
  card.dataset.productRemovedV259="1";
  recalcSalesCardTransactionV239(card);
}

function salesCardWriteReadyV449(){
  // V46.0: do not freeze unrelated work while cloud sync is slow. Existing
  // devices carry a last-known Sales Card revision on every save/delete and
  // Code.gs rejects stale writes atomically. Only a device with no known card
  // revision at all is held during a positively detected cloud refresh.
  try{
    const p=typeof getPrioritySyncLocalV315==='function'?getPrioritySyncLocalV315():{};
    if(Object.prototype.hasOwnProperty.call(p||{},'salesCardRevision'))return true;
  }catch(_){}
  return !(typeof window!=='undefined'&&typeof window.cloudAtomicSyncPendingV448==='function'&&window.cloudAtomicSyncPendingV448());
}
function requireSalesCardWriteReadyV449(){
  if(salesCardWriteReadyV449())return true;
  alert('云端最新版本尚未确认，暂时不能保存、确认或删除销售卡。\n\n系统会继续后台重试；显示「已同步」后再保存，避免旧资料覆盖其他设备的新资料。');
  return false;
}

async function deleteSalesCardTransactionV239(type,txnId){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  const card=[...(wrap?.querySelectorAll(".sales-card-transaction-v239")||[])].find(x=>x.dataset.transactionId===txnId);
  if(!card)return;
  if(salesCardIsConfirmedV322(card)){alert('这张销售卡已经确认并永久锁定，不能删除。');return}
  const saved=salesCardProductsV239(card).filter(x=>x.dataset.saved==="1"&&String(x.dataset.linkId||""));
  if(saved.length&&!confirm(`确定删除这张销售卡？

系统会保留 saleId 的删除记录，让 Import Cost System 知道这张销售已经取消。`))return;
  const ctx=productLinkContextV206(type);
  const commitDeletedContextV459=(fresh)=>{
    const safe=Array.isArray(fresh)?fresh:[];
    if(typeof pruneSalesCardFinalStatesV447==='function')pruneSalesCardFinalStatesV447(type,ctx.date,ctx.location,safe);
    if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,ctx.date,ctx.location,safe);
    if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(type,ctx.date,ctx.location,safe);
    if(typeof replaceProfitAggregateContextV457==='function')replaceProfitAggregateContextV457(type,ctx.date,ctx.location,safe);
    else if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(type,ctx.date,ctx.location,safe);
    if(typeof invalidateSalesCardLoadRequestsV351==='function')invalidateSalesCardLoadRequestsV351(type);
    const current=productLinkContextV206(type),same=salesCardContextKeyV245(type,current.date,current.location)===salesCardContextKeyV245(type,ctx.date,ctx.location);
    if(same&&!productImportSearchIsActiveV226(type)&&!(typeof hasUnsavedSalesCardChangesV238==='function'&&hasUnsavedSalesCardChangesV238(type))){renderProductLinksEditorV206(type,safe);applyCloudDraftStatusesV322(type,safe);}
    const profitPanelV459=typeof productProfitSummaryPanelV216==='function'?productProfitSummaryPanelV216(type):null;
    if((productProfitSummaryOpenV216?.[type]||(profitPanelV459&&!profitPanelV459.classList.contains('hidden')))&&typeof renderProductProfitSummaryV216==='function'){
      const dayV459=typeof getDailyProfitCacheV237==='function'?(getDailyProfitCacheV237(type,ctx.date)||[]):safe;renderProductProfitSummaryV216(type,dayV459);
    }
  };
  setSalesCardWriteBusyV456(true,"删除销售卡");
  try{
    if(saved.length){
      setSync(salesCardActionStatusV493(type,'删除中'));
      let result=null;
      try{result=await deleteSalesTransactionV256(txnId)}
      catch(e){
        if(!e?.deleteTimeoutV459)throw e;
        setSync(salesCardActionStatusV493(type,'确认删除中'));
        const verify=await verifySalesTransactionDeletedV459(txnId,type,ctx.date,ctx.location);
        if(!verify?.deleted)throw new Error('删除失败，请重试');
        result=verify;
      }
      // V46.0 normal success already returns the exact authoritative context.
      // Timeout verification does the same. No second context request is needed.
      const fresh=Array.isArray(result?.links)?result.links:null;
      if(fresh)commitDeletedContextV459(fresh);
      else{
        // Backward-compatible fallback only if an older API is still deployed.
        setSync(salesCardActionStatusV493(type,'确认删除中'));
        const verify=await verifySalesTransactionDeletedV459(txnId,type,ctx.date,ctx.location);
        if(!verify?.deleted)throw new Error('删除失败，请重试');
        commitDeletedContextV459(Array.isArray(verify.links)?verify.links:[]);
      }
    }else{
      card.remove();
      if(!salesCardWrappersV239(type).length)addProductLinkItemV209(type);
    }
    setSync("已同步",true);
    alert('删除成功');
  }catch(e){
    if(e?.deleteVerifyUnknownV459){
      setSync('删除结果尚未确认',false,true);
      alert('删除结果尚未确认，请不要重复按删除。\n\n系统下次同步会继续读取云端最终状态。');
      if(typeof scheduleCompleteSalesCardReconcileV425==='function')scheduleCompleteSalesCardReconcileV425(type,ctx.date,ctx.location);
    }else{
      setSync('删除失败，请重试',false,true);
      alert('删除失败，请重试'+((e&&e.message&&e.message!=='删除失败，请重试')?'：'+e.message:''));
    }
  }
  finally{setSalesCardWriteBusyV456(false);}
}
window.deleteSalesCardTransactionV239=deleteSalesCardTransactionV239;

/* ================= V32.6 confirmed-sale edit state =================
   A sale can be confirmed only once. After confirmation the whole card is locked
   against deletion, but its products may still be corrected and saved. Those
   corrections stay a CONFIRMED sale and, when inventory identity/quantity differs,
   become PENDING_IMPORT_LINK for Import to process as a +/- inventory difference. */
function salesCardStatusIsConfirmedV322(status){
  const s=String(status||'').trim();
  return s==='PENDING_IMPORT_LINK'||s==='INVENTORY_CONFIRMED'||s==='NON_INVENTORY';
}
function salesCardIsEditableDraftV509(card){
  if(!card)return false;
  if(String(card.dataset.confirmedOnceV401||'')==='1')return false;
  const cardStatus=String(card.dataset.inventoryStatus||'').trim();
  if(card.dataset.dirty==='1'||card.dataset.productRemovedV259==='1'||cardStatus==='DRAFT'||cardStatus==='DRAFT_INVENTORY_CHANGED')return true;
  const items=[...card.querySelectorAll('.product-link-item')];
  if(items.some(i=>{const s=String(i.dataset.inventoryStatus||'').trim();return s==='DRAFT'||s==='DRAFT_INVENTORY_CHANGED';}))return true;
  // Blank status on an explicitly unconfirmed editor is also a draft, not confirmation.
  return !salesCardStatusIsConfirmedV322(cardStatus)&&!items.some(i=>salesCardStatusIsConfirmedV322(i.dataset.inventoryStatus));
}
function salesCardIsConfirmedV322(card){
  if(!card)return false;
  if(salesCardIsEditableDraftV509(card))return false;
  if(String(card.dataset.confirmedOnceV401||'')==='1')return true;
  if(salesCardStatusIsConfirmedV322(card.dataset.inventoryStatus)){card.dataset.confirmedOnceV401='1';return true;}
  const confirmed=[...card.querySelectorAll('.product-link-item')].some(i=>salesCardStatusIsConfirmedV322(i.dataset.inventoryStatus));
  if(confirmed)card.dataset.confirmedOnceV401='1';
  return confirmed;
}
function applyConfirmedCardReadOnlyV405(card){
  if(!card)return false;
  const locked=salesCardIsConfirmedV322(card);
  card.classList.toggle('sales-card-confirmed-readonly-v405',locked);
  card.querySelectorAll('input,select,textarea').forEach(el=>{el.disabled=locked;el.setAttribute('aria-readonly',locked?'true':'false')});
  card.querySelectorAll('.sales-card-add-product-v239,.product-subitem-remove-v239,.product-link-search-close,.product-link-remove-bottom,.sales-card-draft-btn-v405,.sales-card-confirm-btn-v405').forEach(btn=>{btn.hidden=locked;btn.disabled=locked});
  return locked;
}
function refreshSingleCardActionsV405(card){
  if(!card)return;
  if(applyConfirmedCardReadOnlyV405(card))return;
  const saved=salesCardIsSavedV241(card),dirty=card.dataset.dirty==='1';
  const save=card.querySelector('.sales-card-draft-btn-v405'),confirmBtn=card.querySelector('.sales-card-confirm-btn-v405');
  if(save){save.hidden=false;save.disabled=!dirty&&saved;save.textContent=saved?'💾 更新草稿':'💾 保存草稿'}
  if(confirmBtn){confirmBtn.hidden=false;confirmBtn.disabled=false;confirmBtn.title=!saved?'尚未保存：点击后可选择先保存草稿或直接确认':dirty?'已有修改：点击后可选择先更新草稿或直接确认':'确认后永久锁定'}
}
function updateSalesCardDeleteLockV322(card){
  if(!card)return;
  const btn=card.querySelector('.product-link-remove-bottom');
  const locked=salesCardIsConfirmedV322(card);
  if(btn){btn.disabled=locked;btn.setAttribute('aria-disabled',locked?'true':'false');btn.classList.toggle('is-confirmed-locked-v322',locked);btn.textContent=locked?'删除销售卡（已确认，不能删除）':'删除销售卡'}
  applyConfirmedCardReadOnlyV405(card);refreshSingleCardActionsV405(card);
}
let SALES_TARGET_TXN_V405='';
async function saveSingleSalesCardV405(type,txnId,mode,button){
  const card=salesCardWrappersV239(type).find(c=>String(c.dataset.transactionId||'')===String(txnId||''));if(!card)return null;
  if(salesCardIsConfirmedV322(card)){alert('这张销售卡已经确认并永久锁定，只能阅读。');return null}
  if(mode==='confirm'&&(!salesCardIsSavedV241(card)||card.dataset.dirty==='1')){
    const saveFirst=confirm('这张销售卡尚未保存最新草稿。\n\n建议先保存草稿，方便最后检查售价、产品或换货资料。\n\n按「确定」= 先保存草稿\n按「取消」= 继续选择是否直接确认销售');
    if(saveFirst){const draftBtn=card.querySelector('.sales-card-draft-btn-v405')||button;return await saveSingleSalesCardV405(type,txnId,'draft',draftBtn)}
    if(!confirm('仍然要直接确认销售吗？\n\n直接确认会把当前内容保存并立即确认，确认后永久锁定。'))return null;
  }else if(mode==='confirm'){
    if(!confirm('确认销售后，这张销售卡将永久锁定，不能修改或删除。\n\n顾客加购请新增销售卡；取消或换货请到 Import 手动调整库存并备注。\n\n确定确认销售？'))return null;
  }
  SALES_TARGET_TXN_V405=String(txnId||'');
  setSalesCardWriteBusyV456(true,mode==='confirm'?'确认销售':'保存草稿');
  try{return await saveProductLinksV206(type,mode,button)}finally{setSalesCardWriteBusyV456(false);SALES_TARGET_TXN_V405='';refreshSingleCardActionsV405(card)}
}
window.saveSingleSalesCardV405=saveSingleSalesCardV405;
function refreshConfirmSaleButtonV322(type){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+'ProductItems');
  if(!wrap)return;
  const btn=[...document.querySelectorAll('.confirm-sale-btn-v285')].find(b=>String(b.getAttribute('onclick')||'').includes(`saveProductLinksV206('${type}','confirm'`));
  if(!btn)return;
  const cards=[...wrap.querySelectorAll('.sales-card-transaction-v239')];
  const hasConfirmable=cards.some(card=>!salesCardIsConfirmedV322(card)&&(card.dataset.dirty==='1'||!salesCardIsSavedV241(card)||String(card.dataset.inventoryStatus||'').startsWith('DRAFT')));
  btn.disabled=!hasConfirmable;
  btn.classList.toggle('is-confirmed-locked-v322',!hasConfirmable);
  btn.textContent=hasConfirmable?'✅ 确认销售':'✅ 已确认销售';
}
function applyCloudDraftStatusesV322(type,savedLinks){
  const list=Array.isArray(savedLinks)?savedLinks:[];
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+'ProductItems');if(!wrap)return;
  const byTxn=new Map();
  list.forEach(x=>{const tx=String(x.transactionId||'');if(!tx)return;if(!byTxn.has(tx))byTxn.set(tx,[]);byTxn.get(tx).push(x)});
  [...wrap.querySelectorAll('.sales-card-transaction-v239')].forEach(card=>{
    const recs=byTxn.get(String(card.dataset.transactionId||''));if(!recs)return;
    const transactionConfirmed=recs.some(r=>r.confirmedOnce===true||salesCardStatusIsConfirmedV322(r.importSyncStatus));
    const normalized=recs.map(r=>{const x={...r},st=String(r.importSyncStatus||'');if(transactionConfirmed&&(st==='DRAFT'||st==='DRAFT_INVENTORY_CHANGED'))x.importSyncStatus=String(r.productId||'').trim()?'PENDING_IMPORT_LINK':'NON_INVENTORY';return x});
    const byLink=new Map(normalized.map(x=>[String(x.linkId||''),x]));
    let status='';
    card.querySelectorAll('.product-link-item').forEach(item=>{
      const rec=byLink.get(String(item.dataset.linkId||''));if(!rec)return;
      item.dataset.inventoryStatus=String(rec.importSyncStatus||'');
      status=status||item.dataset.inventoryStatus;
    });
    if(transactionConfirmed)card.dataset.confirmedOnceV401='1';
    const recStatuses=normalized.map(r=>String(r.importSyncStatus||''));
    if(recStatuses.some(st=>st==='PENDING_IMPORT_LINK'))card.dataset.inventoryStatus='PENDING_IMPORT_LINK';
    else if(recStatuses.length&&recStatuses.every(st=>st==='INVENTORY_CONFIRMED'||st==='NON_INVENTORY'))card.dataset.inventoryStatus='INVENTORY_CONFIRMED';
    else if(status)card.dataset.inventoryStatus=status;
    if(card._renderSalesStateV317)card._renderSalesStateV317();
    updateSalesCardDeleteLockV322(card);
  });
  refreshConfirmSaleButtonV322(type);
}
window.salesCardIsConfirmedV322=salesCardIsConfirmedV322;

function buildSalesCardTransactionV239(type,dataList=[]){
  const list=Array.isArray(dataList)&&dataList.length?dataList:[{}];
  const seed=list[0]||{},txnId=salesCardTxnIdV239(seed);
  const card=document.createElement("section");
  card.className="sales-card-transaction-v239";
  card.dataset.transactionId=txnId;
  card.dataset.type=type;
  card.dataset.dirty="0";
  card.dataset.deliveryManual="0";

  const header=document.createElement("div");header.className="sales-card-header-v239";
  const title=document.createElement("b");title.textContent=list.some(x=>x.linkId)?"已保存销售卡":"新销售卡";
  const amountGroup=document.createElement("span");amountGroup.className="sales-card-header-amounts-v427";
  const total=document.createElement("b");total.className="sales-card-price-total-v239";total.textContent="RM0.00";
  const grand=document.createElement("b");grand.className="sales-card-grand-total-v427";grand.hidden=true;grand.textContent="卡总数：RM0.00";
  amountGroup.append(total,grand);header.append(title,amountGroup);card.appendChild(header);

  // V29.9: Sales only reminds. Inventory confirmation is handled in Import Cost System.
  const inventoryBox=document.createElement("div");inventoryBox.className="sales-card-inventory-v249";inventoryBox.hidden=true;
  const renderInventoryStatus=()=>{inventoryBox.hidden=true;inventoryBox.innerHTML="";};
  card.appendChild(inventoryBox);
  card._renderInventoryStatusV249=renderInventoryStatus;

  const products=document.createElement("div");products.className="sales-card-products-v239";card.appendChild(products);
  list.sort((a,b)=>Number(a.productOrder||0)-Number(b.productOrder||0)).forEach((x,i)=>products.appendChild(buildProductSubItemV239(type,card,x,i+1)));
  setTimeout(()=>{if(card._renderInventoryStatusV249)card._renderInventoryStatusV249()},0);

  const add=document.createElement("button");add.type="button";add.className="secondary-btn sales-card-add-product-v239";add.textContent="＋ 新增产品";
  add.addEventListener("click",()=>addProductToTransactionV239(type,txnId,{}));card.appendChild(add);

  const shared=document.createElement("div");shared.className="sales-card-shared-v239";
  const make=(labelText,cls,value,readonly=false)=>{
    const w=document.createElement("div"),lab=document.createElement("label"),inp=document.createElement("input");
    lab.textContent=labelText;inp.className=cls;inp.value=value;inp.inputMode="decimal";if(readonly)inp.readOnly=true;w.append(lab,inp);return{w,inp};
  };
  const defaultRate=seed.commissionRate!==undefined&&seed.commissionRate!==null?Number(seed.commissionRate):productLinkDefaultCommissionRateV211(type);
  const commission=make(type==="live"?"主播佣金 %":type==="fair"?"Fair 佣金 %":"门市佣金 %","sales-card-commission-rate-v239",Number(type==="daily"?0:(defaultRate||0)).toFixed(2));
  if(type==="daily"){commission.w.classList.add("hidden");commission.inp.value="0.00";}
  const delivery=make("本地运费总数","sales-card-delivery-total-v239",formatAmount(list.reduce((s,x)=>s+Number(x.localDelivery||0),0)));
  const extra=make("附加费用 花盆/苔藓","sales-card-extra-total-v239",formatAmount(list.reduce((s,x)=>s+Number(x.extraFee||0),0)));
  shared.append(commission.w,delivery.w,extra.w);card.appendChild(shared);

  const commissionHint=document.createElement("div");commissionHint.className="sales-card-commission-hint-v239";commissionHint.innerHTML='佣金一次计算：<b class="sales-card-commission-amount-v239">RM0.00</b>';card.appendChild(commissionHint);

  const summary=document.createElement("div");summary.className="sales-card-summary-v239";
  summary.innerHTML='<div><span>总成本</span><b class="sales-card-cost-total-v239">RM0.00</b></div><div><span>总利润</span><b class="sales-card-profit-total-v239">RM0.00</b></div><div><span>整体利润率</span><b class="sales-card-profit-rate-v239">0.00%</b></div>';
  card.appendChild(summary);

  const warn=document.createElement("div");warn.className="sales-card-total-warning-v239";warn.hidden=true;card.appendChild(warn);

  const rlab=document.createElement("label");rlab.textContent="备注（顾客网络名字或电话号码）";card.appendChild(rlab);
  const remark=document.createElement("input");remark.className="sales-card-remark-v239";remark.maxLength=100;remark.placeholder="顾客名字、电话或其他讯息";remark.value=String(list.find(x=>String(x.remark||"").trim())?.remark||"");card.appendChild(remark);

  const actions=document.createElement("div");actions.className="sales-card-actions-v405";
  const saveDraft=document.createElement("button");saveDraft.type="button";saveDraft.className="secondary-btn sales-card-draft-btn-v405";saveDraft.textContent="💾 保存草稿";saveDraft.addEventListener("click",()=>saveSingleSalesCardV405(type,txnId,"draft",saveDraft));
  const confirmSale=document.createElement("button");confirmSale.type="button";confirmSale.className="secondary-btn sales-card-confirm-btn-v405";confirmSale.textContent="✅ 确认销售";confirmSale.addEventListener("click",()=>saveSingleSalesCardV405(type,txnId,"confirm",confirmSale));
  actions.append(saveDraft,confirmSale);card.appendChild(actions);

  const remove=document.createElement("button");remove.type="button";remove.className="product-link-remove-btn product-link-remove-bottom";remove.textContent="删除销售卡";
  remove.addEventListener("click",()=>deleteSalesCardTransactionV239(type,txnId));card.appendChild(remove);

  const sharedEdit=()=>{markSalesCardTransactionDirtyV239(card);recalcSalesCardTransactionV239(card)};
  commission.inp.addEventListener("input",sharedEdit);
  delivery.inp.addEventListener("input",()=>{card.dataset.deliveryManual="1";sharedEdit()});
  extra.inp.addEventListener("input",sharedEdit);
  remark.addEventListener("input",()=>markSalesCardTransactionDirtyV239(card));
  [delivery.inp,extra.inp].forEach(x=>x.addEventListener("blur",()=>{x.value=formatAmount(toAmount(x.value||0));recalcSalesCardTransactionV239(card)}));
  commission.inp.addEventListener("blur",()=>{commission.inp.value=(Math.max(0,Number(commission.inp.value)||0)).toFixed(2);recalcSalesCardTransactionV239(card)});

  // Existing saved rows may contain the exact auto sum; only mark manual when different.
  const autoSum=list.reduce((s,x)=>s+liveDeliveryDefaultV203(Number(x.actualPrice||0)),0);
  const savedDelivery=list.reduce((s,x)=>s+Number(x.localDelivery||0),0);
  card.dataset.deliveryManual=(list.some(x=>x.linkId)&&Math.abs(savedDelivery-autoSum)>0.01)?"1":"0";
  setTimeout(()=>{
    // V29.9: initialization may finish after a very fast first edit.
    // Only clear the initial state when no user edit has marked the card dirty.
    if(card.dataset.dirty!=="1"&&card.dataset.productRemovedV259!=="1")clearSalesCardTransactionDirtyV239(card);
    recalcSalesCardTransactionV239(card);
  },0);
  return card;
}

function addProductLinkItemV209(type,data={}){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  if(!wrap){console.error("V29.9 sales card container missing",type);return false}
  const card=buildSalesCardTransactionV239(type,[data||{}]);
  wrap.appendChild(card);
  return true;
}
function addProductLinkItemV206(type,data={}){return addProductLinkItemV209(type,data)}
window.addProductLinkItemV206=addProductLinkItemV206;
window.addProductLinkItemV209=addProductLinkItemV209;

function renderProductLinksEditorV206(type,links){
  const {pre}=productLinkContextV206(type),wrap=document.getElementById(pre+"ProductItems");if(!wrap)return;
  wrap.innerHTML="";
  const list=Array.isArray(links)?links:[];
  if(!list.length){addProductLinkItemV209(type);return}
  const groups=new Map();
  list.forEach((x,i)=>{
    const txn=String(x.transactionId||"").trim()||("legacy_"+String(x.linkId||i));
    if(!groups.has(txn))groups.set(txn,[]);
    groups.get(txn).push({...x,transactionId:txn,productOrder:Number(x.productOrder||groups.get(txn).length+1)});
  });
  groups.forEach(items=>wrap.appendChild(buildSalesCardTransactionV239(type,items)));
}

function collectProductLinksV206(type){
  const {pre,date,location}=productLinkContextV206(type),wrap=document.getElementById(pre+"ProductItems");
  const result=[];
  salesCardWrappersV239(type).forEach(card=>{
    normalizeDraftProductOrdersV503(card);
    const txnId=String(card.dataset.transactionId||salesCardTxnIdV239());
    const shared=salesCardSharedValuesV239(card);
    const products=salesCardProductsV239(card);
    const alloc=allocateSalesCardSharedCostsV239(card);
    products.forEach((item,i)=>{
      let linkId=String(item.dataset.linkId||"");
      const productName=String(item.querySelector(".product-link-name")?.value||"").trim();
      const actualPrice=toAmount(item.querySelector(".product-link-price")?.value||0);
      if(!linkId&&(productName||actualPrice||shared.remark)){linkId="spl_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);item.dataset.linkId=linkId}
      const quantity=Math.max(0,Number(item.querySelector(".product-link-qty")?.value||0));
      const averageCost=toAmount(item.querySelector(".product-link-avg-cost")?.value||0);
      const productId=String(item.querySelector(".product-link-name")?.dataset.productId||"");
      const minimumPrice=Math.max(0,Number(item.dataset.minimumPrice||0));
      const localDelivery=alloc[i]?.delivery||0,extraFee=alloc[i]?.extra||0,commissionRate=shared.commissionRate;
      const commissionAmount=actualPrice*commissionRate/100;
      const profit=actualPrice-commissionAmount-(averageCost*quantity)-localDelivery-extraFee;
      const profitRate=actualPrice>0?profit/actualPrice*100:0;
      if(linkId||productName||actualPrice||shared.remark)result.push({
        linkId,type,date,location,transactionId:txnId,productOrder:i+1,
        productId,productName,quantity,averageCost,minimumPrice,actualPrice,
        commissionRate,commissionAmount,localDelivery,extraFee,profit,profitRate,remark:shared.remark,importSyncStatus:String(item.dataset.inventoryStatus||card.dataset.inventoryStatus||"PENDING_IMPORT_LINK")
      });
    });
  });
  return result;
}

async function saveProductLinksV206(type){
  const items=collectProductLinksV206(type);
  if(!items.length){alert("请至少输入一张销售卡；如果这次没有销售卡，可以保持收起，不需要保存。");return null}
  const first=items[0];if(!first.date||!first.location){alert(type==="live"?"请先选择日期和主播":type==="fair"?"请先选择 Fair 日期和地点":"请先选择日期");return null}
  for(const x of items){
    if(!x.productName){alert("每一个产品都需要填写产品名称。");return null}
    if(!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0){alert("每一个产品数量必须大于 0。");return null}
    if(!Number.isFinite(Number(x.unitPrice))||Number(x.unitPrice)<=0){
      alert(`产品${Number(x.productOrder||0)||""} 售价必须大于 RM0.00，无法保存销售卡。`);
      return null;
    }
  }

  // Every transaction card may contain multiple products; each card's product prices form that card total.
  const cards=salesCardWrappersV239(type);
  for(const card of cards){
    const products=salesCardProductsV239(card);
    const saleTotal=products.reduce((s,x)=>s+toAmount(x.querySelector(".product-link-price")?.value||0),0);
    if(saleTotal<=0&&products.some(x=>String(x.querySelector(".product-link-name")?.value||"").trim())){
      if(!confirm("这张销售卡售价合计为 RM0.00，确定仍然保存？"))return null;
    }
  }

  const official=dedupeRows(rows).filter(r=>r.type===type&&r.date===first.date&&(type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(first.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(first.location))).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
  const batchTotal=items.reduce((s,x)=>s+Number(x.actualPrice||0),0);
  if(official>0&&batchTotal>official+0.005){alert(`所有销售卡售价合计 RM${formatAmount(batchTotal)} 已超过当天营业额 RM${formatAmount(official)}。`);return null}
  try{
    setSync("销售卡同步中...");
    const result=await saveSalesProductLinksV206(items);
    renderProductLinksEditorV206(type,result?.links||[]);
    setSync("销售卡已保存",true);
    alert("销售卡保存成功。");
    if(result?.warning)alert(result.warning);
    return result;
  }catch(e){alert("销售卡保存失败："+(e.message||e));setSync("销售卡同步失败",false,true);return null}
}

function clearUnsavedSalesCardEditorsV224(){
  ["live","fair"].forEach(type=>{
    const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");if(!wrap)return;
    salesCardWrappersV239(type).forEach(card=>{
      const hasSaved=salesCardProductsV239(card).some(x=>x.dataset.saved==="1"&&String(x.dataset.linkId||""));
      if(!hasSaved)card.remove();
    });
    salesCardWrappersV239(type).forEach(clearSalesCardTransactionDirtyV239);
    if(!salesCardWrappersV239(type).length)addProductLinkItemV209(type);
    if(type==="fair")syncFairProductDatesV203();
  });
}
window.clearUnsavedSalesCardEditorsV224=clearUnsavedSalesCardEditorsV224;



/* ================= V29.9 Sales Card unit-price + stable optimistic UI ================= */
const LIVE_OPTIMISTIC_LOCKS_V240=new Map();

function liveOptimisticKeyV240(date,host){
  return String(date||"")+"|"+normalizeLiveHostKey(String(host||""));
}
function setLiveOptimisticLockV240(date,host,amount){
  LIVE_OPTIMISTIC_LOCKS_V240.set(liveOptimisticKeyV240(date,host),{amount:Number(amount||0),at:Date.now()});
}
function getLiveOptimisticLockV240(date,host){
  const x=LIVE_OPTIMISTIC_LOCKS_V240.get(liveOptimisticKeyV240(date,host));
  if(!x)return null;
  if(Date.now()-Number(x.at||0)>15000){LIVE_OPTIMISTIC_LOCKS_V240.delete(liveOptimisticKeyV240(date,host));return null}
  return x;
}
function clearLiveOptimisticLockV240(date,host){
  LIVE_OPTIMISTIC_LOCKS_V240.delete(liveOptimisticKeyV240(date,host));
}

function salesCardUnitPriceV240(item){
  return Math.max(0,toAmount(item?.querySelector(".product-link-price")?.value||0));
}
function salesCardQtyV240(item){
  return Math.max(1,Number(item?.querySelector(".product-link-qty")?.value||1));
}
function salesCardProductTotalV240(item){
  return salesCardQtyV240(item)*salesCardUnitPriceV240(item);
}
function productDeliveryInputV240(item){
  return item?.querySelector(".product-link-delivery-v240");
}
function productAutoDeliveryV240(item){
  const card=item?.closest?.(".sales-card-transaction-v239");
  // V50.2: Sales / Fair never auto-generate delivery; manual input is preserved.
  if(String(card?.dataset?.type||"").toLowerCase()!=="live")return 0;
  const rate=Number(item?.querySelector(".product-link-crate-v270")?.value||getLiveCrateV269(item)||0);
  return rate*salesCardQtyV240(item);
}
function salesCardSharedValuesV239(card){
  return{
    commissionRate:Math.max(0,Number(String(card.querySelector(".sales-card-commission-rate-v239")?.value||"0").replace(/[^0-9.\-]/g,""))||0),
    deliveryTotal:Math.max(0,toAmount(card.querySelector(".sales-card-delivery-total-v239")?.value||0)),
    extraTotal:Math.max(0,toAmount(card.querySelector(".sales-card-extra-total-v239")?.value||0)),
    remark:String(card.querySelector(".sales-card-remark-v239")?.value||"").trim()
  };
}
function syncCardDeliveryTotalFromProductsV240(card){
  const total=salesCardProductsV239(card).reduce((s,item)=>s+Math.max(0,toAmount(productDeliveryInputV240(item)?.value||0)),0);
  const input=card.querySelector(".sales-card-delivery-total-v239");
  if(input)input.value=formatAmount(total);
  return total;
}
function distributeCardDeliveryTotalV240(card,newTotal){
  const products=salesCardProductsV239(card);
  const autos=products.map(productAutoDeliveryV240);
  const autoTotal=autos.reduce((a,b)=>a+b,0);
  products.forEach((item,i)=>{
    const input=productDeliveryInputV240(item);if(!input)return;
    const weight=autoTotal>0?autos[i]/autoTotal:(products.length?1/products.length:0);
    input.value=formatAmount(Math.max(0,Number(newTotal||0))*weight);
    input.dataset.manual="1";
  });
}
function allocateSalesCardSharedCostsV239(card){
  const products=salesCardProductsV239(card),shared=salesCardSharedValuesV239(card);
  const totals=products.map(salesCardProductTotalV240);
  return products.map((item,i)=>{
    const dInput=productDeliveryInputV240(item);
    const delivery=Math.max(0,toAmount(dInput?.value||0));
    const extra=Math.max(0,toAmount(productExtraInputV278(item)?.value||0));
    return{
      delivery,
      extra,
      commission:totals[i]*shared.commissionRate/100,
      price:totals[i],
      unitPrice:salesCardUnitPriceV240(item),
      commissionRate:shared.commissionRate
    };
  });
}
function recalcSalesCardTransactionV239(card){
  if(!card)return;
  const products=salesCardProductsV239(card);

  products.forEach(item=>{
    const dInput=productDeliveryInputV240(item);
    if(dInput&&dInput.dataset.manual!=="1")dInput.value=formatAmount(productAutoDeliveryV240(item));
    const totalEl=item.querySelector(".product-item-total-v240");
    if(totalEl)totalEl.textContent=formatAmount(salesCardProductTotalV240(item));
  });
  syncCardDeliveryTotalFromProductsV240(card);
  syncCardExtraTotalFromProductsV278(card);

  const alloc=allocateSalesCardSharedCostsV239(card);
  let totalPrice=0,totalCost=0,totalProfit=0,totalCommission=0,totalDelivery=0,totalExtra=0;
  products.forEach((item,i)=>{
    const qty=salesCardQtyV240(item),avgCost=toAmount(item.querySelector(".product-link-avg-cost")?.value||0);
    const cost=avgCost*qty,price=alloc[i]?.price||0;
    const profit=price-(alloc[i]?.commission||0)-cost-(alloc[i]?.delivery||0)-(alloc[i]?.extra||0);
    const rate=price>0?profit/price*100:0;
    totalPrice+=price;totalCost+=cost;totalProfit+=profit;totalCommission+=(alloc[i]?.commission||0);totalDelivery+=(alloc[i]?.delivery||0);totalExtra+=(alloc[i]?.extra||0);
    item.dataset.allocatedDelivery=String(alloc[i]?.delivery||0);
    item.dataset.allocatedExtra=String(alloc[i]?.extra||0);
    const profitEl=item.querySelector(".product-link-profit");
    const rateEl=item.querySelector(".product-link-profit-rate");
    if(profitEl)profitEl.textContent=formatAmount(profit);
    if(rateEl)rateEl.textContent=(Number.isFinite(rate)?rate:0).toFixed(2)+"%";
  });

  const set=(sel,val)=>{const el=card.querySelector(sel);if(el)el.textContent=val};
  const overallRate=totalPrice>0?totalProfit/totalPrice*100:0;
  card.dataset.cardPriceTotalV427=String(totalPrice);
  set(".sales-card-price-total-v239","RM"+formatAmount(totalPrice));
  set(".sales-card-price-summary-v240","RM"+formatAmount(totalPrice));
  // Complete cost basis; totalProfit already deducts these items exactly once.
  set(".sales-card-cost-total-v239","RM"+formatAmount(totalCost+totalDelivery+totalExtra+totalCommission));
  set(".sales-card-commission-amount-v239","RM"+formatAmount(totalCommission));
  set(".sales-card-profit-total-v239","RM"+formatAmount(totalProfit));
  set(".sales-card-profit-rate-v239",(Number.isFinite(overallRate)?overallRate:0).toFixed(2)+"%");

  const ctx=productLinkContextV206(card.dataset.type);
  const official=dedupeRows(rows).filter(r=>{
    if(r.type!==card.dataset.type||r.date!==ctx.date)return false;
    return card.dataset.type==="daily"?r.company===(String(ctx.location||'').toLowerCase().includes('balakong')?'balakong':'belimbing'):card.dataset.type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(ctx.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(ctx.location);
  }).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
  const warn=card.querySelector(".sales-card-total-warning-v239");
  if(warn){
    warn.hidden=!(official>0&&totalPrice>official+0.005);
    warn.textContent=warn.hidden?"":`这张销售卡售价总数 RM${formatAmount(totalPrice)} 已超过当天营业额 RM${formatAmount(official)}`;
  }
  updateSalesCardsGrandTotalV427(String(card.dataset.type||""));
}

function updateSalesCardsGrandTotalV427(type){
  const cards=salesCardWrappersV239(type);
  const grandTotal=cards.reduce((sum,current)=>sum+Math.max(0,Number(current.dataset.cardPriceTotalV427)||0),0);
  cards.forEach((current,index)=>{
    const grand=current.querySelector('.sales-card-grand-total-v427');if(!grand)return;
    grand.hidden=index!==0;
    grand.textContent=`卡总数：RM${formatAmount(grandTotal)}`;
  });
}

function buildProductSubItemV239(type,card,data={},order=1){
  const id=++productLinkItemSeqV206;
  const linkId=String(data.linkId||""),saved=!!linkId,qty=Math.max(1,Number(data.quantity||1));
  const legacyTotal=Math.max(0,Number(data.actualPrice||0));
  const unitPrice=data.unitPrice!==undefined&&data.unitPrice!==null&&data.unitPrice!==""?Math.max(0,Number(data.unitPrice||0)):(qty>0?legacyTotal/qty:legacyTotal);

  const item=document.createElement("div");
  item.className="product-link-item product-link-subitem-v239";
  item.dataset.productLinkItem=String(id);
  item.dataset.linkId=linkId;
  item.dataset.saved=saved?"1":"0";
  item.dataset.dirty="0";
  item.dataset.minimumPrice=String(Number(data.minimumPrice||0));
  item.dataset.importMapped=String(data.productId||"")?"1":"0";
  item.dataset.productOrder=String(order);
  // V51.0: every visible row has an explicit state. Missing status on a saved/unconfirmed
  // row is a draft-safe fallback, never PENDING_IMPORT_LINK.
  item.dataset.inventoryStatus=String(data.importSyncStatus||'DRAFT');

  const head=document.createElement("div");head.className="product-subitem-head-v239";
  const title=document.createElement("b");title.className="product-subitem-title-v239";title.textContent=`产品 ${order}`;
  const remove=document.createElement("button");remove.type="button";remove.className="product-subitem-remove-v239";remove.textContent="删除产品";
  head.append(title,remove);item.appendChild(head);

  const label=(text)=>{const el=document.createElement("label");el.textContent=text;return el};
  const input=(cls,value,placeholder)=>{const el=document.createElement("input");el.className=cls;el.value=value??"";if(placeholder)el.placeholder=placeholder;return el};

  item.appendChild(label("搜索或输入产品"));
  const name=input("product-link-name",String(data.productName||""),"输入产品名称、编号或原成本搜索，或直接手动输入");
  name.dataset.productId=String(data.productId||"");
  const searchWrap=document.createElement("div");searchWrap.className="product-link-search-wrap";
  const searchInputRow=document.createElement("div");searchInputRow.className="product-link-search-input-row";
  searchInputRow.appendChild(name);
  const searchClose=document.createElement("button");searchClose.type="button";searchClose.className="product-link-search-close";searchClose.textContent="×";searchClose.setAttribute("aria-label","收起产品列表");
  searchInputRow.appendChild(searchClose);searchWrap.appendChild(searchInputRow);
  const searchResults=document.createElement("div");searchResults.className="product-link-search-results";searchResults.hidden=true;
  searchWrap.appendChild(searchResults);item.appendChild(searchWrap);
  setupImportProductSearchV214(item,name,searchResults,searchClose);

  const grid=document.createElement("div");grid.className="product-subitem-grid-v240";
  const qWrap=document.createElement("div");qWrap.appendChild(label("数量"));
  const q=input("product-link-qty qty-input-no-spinner",String(qty));q.type="number";q.min="1";q.step="1";q.inputMode="numeric";qWrap.appendChild(q);
  const cWrap=document.createElement("div");cWrap.appendChild(label("平均成本"));
  const c=input("product-link-avg-cost money-input",formatAmount(Number(data.averageCost||0)));c.inputMode="decimal";cWrap.appendChild(c);
  const pWrap=document.createElement("div");pWrap.appendChild(label("售价"));
  const p=input("product-link-price money-input",formatAmount(unitPrice));p.inputMode="decimal";pWrap.appendChild(p);
  const minWarn=document.createElement("div");minWarn.className="product-link-minimum-warning";minWarn.hidden=true;pWrap.appendChild(minWarn);
  const tWrap=document.createElement("div");tWrap.appendChild(label("总数"));
  const total=document.createElement("div");total.className="product-item-total-box-v240";total.innerHTML='<b class="product-item-total-v240">'+formatAmount(qty*unitPrice)+'</b>';tWrap.appendChild(total);
  grid.append(qWrap,cWrap,pWrap,tWrap);item.appendChild(grid);

  const result=document.createElement("div");result.className="product-subitem-result-v240"+(type==="live"?" live-crate-result-v270":"");
  const storedDelivery=Math.max(0,Number(data.localDelivery||0));
  let shipInput,crateSelect=null;
  if(type==="live"){
    const crate=document.createElement("label");crate.className="product-result-cell-v252";
    const crateTitle=document.createElement("small");crateTitle.textContent="木架等级";crate.appendChild(crateTitle);
    crateSelect=document.createElement("select");crateSelect.className="product-link-crate-v270";
    const opts=[[0,"自取0"],[20,"A20"],[50,"B50"],[80,"C80"],[120,"D120"],[150,"E150"],[180,"F180"]];
    // V50.2: only Live auto-selects the Import V21.5 crate/local-delivery tier
    // from this product's unit selling price. Existing saved cards are preserved.
    const perTreeStored=qty>0?storedDelivery/qty:storedDelivery;
    const autoCrateFromPrice=liveCrateRateForPriceV461(unitPrice);
    const initialCrate=saved?(opts.some(x=>x[0]===perTreeStored)?perTreeStored:(opts.some(x=>x[0]===storedDelivery)?storedDelivery:autoCrateFromPrice)):autoCrateFromPrice;
    const savedLooksAuto=saved&&(opts.some(x=>x[0]===perTreeStored)||opts.some(x=>x[0]===storedDelivery));
    opts.forEach(([v,t])=>{const o=document.createElement("option");o.value=String(v);o.textContent=t;crateSelect.appendChild(o)});
    crateSelect.value=String(initialCrate);
    crateSelect.dataset.manual=saved?"1":"0";
    crate.appendChild(crateSelect);result.appendChild(crate);

    const ship=document.createElement("label");ship.className="product-result-cell-v252 product-delivery-inline-v240";
    const shipTitle=document.createElement("small");shipTitle.textContent="运费总数";ship.appendChild(shipTitle);
    shipInput=input("product-link-delivery-v240",formatAmount(saved?storedDelivery:initialCrate*qty));
    // Preserve an old saved total exactly on first paint. If quantity/crate is
    // edited, autoCrate switches to the corrected rate × quantity calculation.
    shipInput.inputMode="decimal";shipInput.dataset.manual=saved?"1":"0";shipInput.dataset.autoCrate=savedLooksAuto||!saved?"1":"0";ship.appendChild(shipInput);result.appendChild(ship);

    crateSelect.addEventListener("change",()=>{
      crateSelect.dataset.manual="1";
      shipInput.dataset.autoCrate="1";shipInput.dataset.manual="0";
      shipInput.value=formatAmount(Number(crateSelect.value||0)*salesCardQtyV240(item));
      markSalesCardDirtyV238(item);markSalesCardTransactionDirtyV239(card);
      syncCardDeliveryTotalFromProductsV240(card);recalcSalesCardTransactionV239(card);
    });
  }else{
    const ship=document.createElement("label");ship.className="product-result-cell-v252 product-delivery-inline-v240";
    const shipTitle=document.createElement("small");shipTitle.textContent="运费";ship.appendChild(shipTitle);
    shipInput=input("product-link-delivery-v240",formatAmount(saved?storedDelivery:0));shipInput.inputMode="decimal";shipInput.dataset.manual="1";ship.appendChild(shipInput);result.appendChild(ship);
  }

  const extraWrap=document.createElement("label");extraWrap.className="product-result-cell-v252 product-extra-inline-v278";
  const extraTitle=document.createElement("small");extraTitle.textContent="附加费用";
  const extraInput=input("product-link-extra-v278",formatAmount(Number(data.extraFee||0)));
  extraInput.inputMode="decimal";extraInput.dataset.manual=saved||Number(data.extraFee||0)>0?"1":"0";
  extraWrap.append(extraTitle,extraInput);result.appendChild(extraWrap);

  const profit=document.createElement("span");profit.className="product-result-cell-v252";
  const profitTitle=document.createElement("small");profitTitle.textContent="利润";
  const profitValue=document.createElement("b");profitValue.className="product-link-profit";profitValue.textContent="0.00";
  profit.append(profitTitle,profitValue);

  const rate=document.createElement("span");rate.className="product-result-cell-v252";
  const rateTitle=document.createElement("small");rateTitle.textContent="利润率";
  const rateValue=document.createElement("b");rateValue.className="product-link-profit-rate";rateValue.textContent="0.00%";
  rate.append(rateTitle,rateValue);

  result.append(profit,rate);item.appendChild(result);

  // Quantity changes recalculate an automatic Live crate delivery total.
  // A manually entered delivery remains an explicit product total.
  q.addEventListener("input",()=>{
    if(type==="live"&&shipInput?.dataset.autoCrate==="1"){
      shipInput.dataset.manual="0";
      shipInput.value=formatAmount(productAutoDeliveryV240(item));
      syncCardDeliveryTotalFromProductsV240(card);
    }
    // V46.3: keep automatic VND pot/misc cost in step with quantity.
    const autoExtra=productExtraInputV278(item);
    if(autoExtra&&autoExtra.dataset.manual!=="1"){
      const unitFee=Math.max(0,Number(item.dataset.autoPotMossFeeV267||0));
      autoExtra.value=formatAmount(unitFee*salesCardQtyV240(item));
      syncCardExtraTotalFromProductsV278(card);
    }
  });
  const onCoreEdit=()=>{markSalesCardDirtyV238(item);markSalesCardTransactionDirtyV239(card);recalcSalesCardTransactionV239(card)};
  [name,q,c,p].forEach(el=>el.addEventListener("input",onCoreEdit));
  [name,q].forEach(el=>el.addEventListener("input",()=>{
    // V32.6: editing is not confirmation. Keep a saved draft as DRAFT until
    // “确认销售” succeeds; the server is authoritative for the final status.
    if(String(card.dataset.inventoryStatus||"").startsWith("DRAFT")){
      card.dataset.inventoryStatus="DRAFT_INVENTORY_CHANGED";
      item.dataset.inventoryStatus="DRAFT_INVENTORY_CHANGED";
    }
    if(card._renderSalesStateV317)card._renderSalesStateV317();
  }));
  [c,p].forEach(el=>el.addEventListener("blur",()=>{el.value=formatAmount(toAmount(el.value||0));recalcSalesCardTransactionV239(card)}));
  p.addEventListener("input",()=>{
    updateProductLinkMinimumWarningV214(item);
    if(type==="live"&&crateSelect&&crateSelect.dataset.manual!=="1"){
      crateSelect.value=String(liveCrateRateForPriceV461(toAmount(p.value||0)));
      if(shipInput?.dataset.autoCrate==="1"){
        shipInput.dataset.manual="0";
        shipInput.value=formatAmount(Number(crateSelect.value||0)*salesCardQtyV240(item));
        syncCardDeliveryTotalFromProductsV240(card);
      }
      recalcSalesCardTransactionV239(card);
    }
  });
  shipInput.addEventListener("input",()=>{shipInput.dataset.manual="1";shipInput.dataset.autoCrate="0";markSalesCardDirtyV238(item);markSalesCardTransactionDirtyV239(card);syncCardDeliveryTotalFromProductsV240(card);recalcSalesCardTransactionV239(card)});
  shipInput.addEventListener("blur",()=>{shipInput.value=formatAmount(toAmount(shipInput.value||0));syncCardDeliveryTotalFromProductsV240(card);recalcSalesCardTransactionV239(card)});
  extraInput.addEventListener("input",()=>{extraInput.dataset.manual="1";markSalesCardDirtyV238(item);markSalesCardTransactionDirtyV239(card);syncCardExtraTotalFromProductsV278(card);recalcSalesCardTransactionV239(card)});
  extraInput.addEventListener("blur",()=>{extraInput.value=formatAmount(toAmount(extraInput.value||0));syncCardExtraTotalFromProductsV278(card);recalcSalesCardTransactionV239(card)});
  bindSingleTapDeleteProductV254(remove,()=>removeProductFromTransactionV239(type,card,item));
  setTimeout(()=>{updateProductLinkMinimumWarningV214(item);recalcSalesCardTransactionV239(card)},0);
  return item;
}

function buildSalesCardTransactionV239(type,dataList=[]){
  const list=Array.isArray(dataList)&&dataList.length?dataList:[{}];
  const seed=list[0]||{},txnId=salesCardTxnIdV239(seed);
  const card=document.createElement("section");
  card.className="sales-card-transaction-v239";
  card.dataset.transactionId=txnId;
  card.dataset.type=type;
  card.dataset.dirty="0";
  const savedStatusesV317=list.filter(x=>String(x.linkId||"")||String(x.productId||"")).map(x=>String(x.importSyncStatus||"").trim()).filter(Boolean);
  const hasDraftV317=savedStatusesV317.some(s=>s==="DRAFT"||s==="DRAFT_INVENTORY_CHANGED");
  const hasPendingV317=savedStatusesV317.some(s=>s==="PENDING_IMPORT_LINK");
  const hasConfirmedV317=savedStatusesV317.length>0&&savedStatusesV317.every(s=>s==="INVENTORY_CONFIRMED");
  // V42.3: confirmation belongs to the sales-card transaction, not only to the
  // current product rows. Once any row was confirmed/non-inventory, later draft
  // edits must never turn the card back into an unconfirmed draft.
  card.dataset.confirmedOnceV401=hasDraftV317?"0":((list.some(x=>x&&x.confirmedOnce===true)||savedStatusesV317.some(s=>salesCardStatusIsConfirmedV322(s)))?"1":"0");
  card.dataset.inventoryStatus=hasDraftV317?"DRAFT":hasPendingV317?"PENDING_IMPORT_LINK":hasConfirmedV317?"INVENTORY_CONFIRMED":"";

  const header=document.createElement("div");header.className="sales-card-header-v239";
  const title=document.createElement("b");title.textContent=list.some(x=>x.linkId)?"已保存销售卡":"新销售卡";
  const amountGroup=document.createElement("span");amountGroup.className="sales-card-header-amounts-v427";
  const total=document.createElement("b");total.className="sales-card-price-total-v239";total.textContent="RM0.00";
  const grand=document.createElement("b");grand.className="sales-card-grand-total-v427";grand.hidden=true;grand.textContent="卡总数：RM0.00";
  amountGroup.append(total,grand);header.append(title,amountGroup);card.appendChild(header);

  // V32.6: make the sales-card state explicit on Sales / Fair / Live.
  // Draft is local/saved but NOT a confirmed sale and must never reach Import.
  const stateBoxV317=document.createElement("div");
  stateBoxV317.className="sales-card-state-v317";
  stateBoxV317.hidden=true;
  const renderStateV317=()=>{
    const savedItems=[...card.querySelectorAll(".product-link-item")].filter(i=>i.dataset.saved==="1"&&String(i.dataset.linkId||""));
    if(!savedItems.length){stateBoxV317.hidden=true;stateBoxV317.textContent="";return;}
    const sts=savedItems.map(i=>String(i.dataset.inventoryStatus||card.dataset.inventoryStatus||"").trim()).filter(Boolean);
    const confirmedOnceV401=salesCardIsConfirmedV322(card);
    const draft=!confirmedOnceV401&&(sts.some(st=>st==="DRAFT"||st==="DRAFT_INVENTORY_CHANGED")||String(card.dataset.inventoryStatus||"").startsWith("DRAFT"));
    const pending=!draft&&(sts.some(st=>st==="PENDING_IMPORT_LINK"||st==="DRAFT"||st==="DRAFT_INVENTORY_CHANGED")||String(card.dataset.inventoryStatus||"")==="PENDING_IMPORT_LINK");
    const done=!draft&&!pending&&sts.length>0&&sts.every(st=>st==="INVENTORY_CONFIRMED"||st==="NON_INVENTORY");
    const allNonInventory=done&&sts.every(st=>st==="NON_INVENTORY");
    stateBoxV317.hidden=false;
    stateBoxV317.className="sales-card-state-v317 "+(draft?"is-draft":pending?"is-pending":done?"is-done":"is-draft");
    stateBoxV317.textContent=draft?"🟡 草稿已保存 · 尚未确认销售":pending?"🟢 已确认销售 · 等待 Import 处理库存":allNonInventory?"✅ 已确认销售 · 一次性产品无需处理库存":done?"✅ 已确认销售 · Import 已处理库存":"🟡 草稿已保存 · 尚未确认销售";
    updateSalesCardDeleteLockV322(card);
    setTimeout(()=>refreshConfirmSaleButtonV322(type),0);
  };
  card.appendChild(stateBoxV317);
  card._renderSalesStateV317=renderStateV317;

  const products=document.createElement("div");products.className="sales-card-products-v239";card.appendChild(products);
  list.sort((a,b)=>Number(a.productOrder||0)-Number(b.productOrder||0)).forEach((x,i)=>products.appendChild(buildProductSubItemV239(type,card,x,i+1)));

  const add=document.createElement("button");add.type="button";add.className="secondary-btn sales-card-add-product-v239";add.textContent="＋ 新增产品";
  add.addEventListener("click",()=>addProductToTransactionV239(type,txnId,{}));card.appendChild(add);

  const shared=document.createElement("div");shared.className="sales-card-shared-v239";
  const make=(labelText,cls,value)=>{
    const w=document.createElement("div"),lab=document.createElement("label"),inp=document.createElement("input");
    lab.textContent=labelText;inp.className=cls;inp.value=value;inp.inputMode="decimal";w.append(lab,inp);return{w,inp};
  };
  const defaultRate=seed.commissionRate!==undefined&&seed.commissionRate!==null?Number(seed.commissionRate):productLinkDefaultCommissionRateV211(type);
  const commission=make(type==="live"?"主播佣金 %":type==="fair"?"Fair 佣金 %":"佣金 %","sales-card-commission-rate-v239",Number(defaultRate||0).toFixed(2));
  const delivery=make("本地运费总数","sales-card-delivery-total-v239",formatAmount(list.reduce((s,x)=>s+Number(x.localDelivery||0),0)));
  const extra=make("附加费用总数","sales-card-extra-total-v239",formatAmount(list.reduce((s,x)=>s+Number(x.extraFee||0),0)));
  extra.inp.readOnly=true;extra.inp.tabIndex=-1;extra.w.classList.add("sales-card-auto-total-v278");
  shared.append(commission.w,delivery.w,extra.w);card.appendChild(shared);

  const commissionHint=document.createElement("div");commissionHint.className="sales-card-commission-hint-v239";commissionHint.innerHTML='佣金一次计算：<b class="sales-card-commission-amount-v239">RM0.00</b>';card.appendChild(commissionHint);

  const saleSummary=document.createElement("div");saleSummary.className="sales-card-sale-total-v240";
  saleSummary.innerHTML='<span>售价总数</span><b class="sales-card-price-summary-v240">RM0.00</b>';card.appendChild(saleSummary);

  const summary=document.createElement("div");summary.className="sales-card-summary-v239";
  summary.innerHTML='<div><span>总成本</span><b class="sales-card-cost-total-v239">RM0.00</b></div><div><span>总利润</span><b class="sales-card-profit-total-v239">RM0.00</b></div><div><span>整体利润率</span><b class="sales-card-profit-rate-v239">0.00%</b></div>';
  card.appendChild(summary);

  const warn=document.createElement("div");warn.className="sales-card-total-warning-v239";warn.hidden=true;card.appendChild(warn);
  const rlab=document.createElement("label");rlab.textContent="备注（顾客网络名字或电话号码）";card.appendChild(rlab);
  const remark=document.createElement("input");remark.className="sales-card-remark-v239";remark.maxLength=100;remark.placeholder="顾客名字、电话或其他讯息";remark.value=String(list.find(x=>String(x.remark||"").trim())?.remark||"");card.appendChild(remark);

  // V42.3: this is the active Sales / Fair / Live card builder. Keep each
  // card's draft and confirmation actions beside that card instead of relying
  // on the obsolete page-level controls.
  const actions=document.createElement("div");actions.className="sales-card-actions-v405";
  const saveDraft=document.createElement("button");saveDraft.type="button";saveDraft.className="secondary-btn sales-card-draft-btn-v405";saveDraft.textContent="💾 保存草稿";saveDraft.addEventListener("click",()=>saveSingleSalesCardV405(type,txnId,"draft",saveDraft));
  const confirmSale=document.createElement("button");confirmSale.type="button";confirmSale.className="secondary-btn sales-card-confirm-btn-v405";confirmSale.textContent="✅ 确认销售";confirmSale.addEventListener("click",()=>saveSingleSalesCardV405(type,txnId,"confirm",confirmSale));
  actions.append(saveDraft,confirmSale);card.appendChild(actions);

  const remove=document.createElement("button");remove.type="button";remove.className="product-link-remove-btn product-link-remove-bottom";remove.textContent="删除销售卡";
  remove.addEventListener("click",()=>deleteSalesCardTransactionV239(type,txnId));card.appendChild(remove);

  const sharedEdit=()=>{markSalesCardTransactionDirtyV239(card);recalcSalesCardTransactionV239(card)};
  commission.inp.addEventListener("input",sharedEdit);
  remark.addEventListener("input",()=>markSalesCardTransactionDirtyV239(card));
  delivery.inp.addEventListener("change",()=>{
    const target=Math.max(0,toAmount(delivery.inp.value||0));
    distributeCardDeliveryTotalV240(card,target);
    markSalesCardTransactionDirtyV239(card);recalcSalesCardTransactionV239(card);
  });
  delivery.inp.addEventListener("blur",()=>{delivery.inp.value=formatAmount(toAmount(delivery.inp.value||0));});
  commission.inp.addEventListener("blur",()=>{commission.inp.value=(Math.max(0,Number(commission.inp.value)||0)).toFixed(2);recalcSalesCardTransactionV239(card)});

  setTimeout(()=>{clearSalesCardTransactionDirtyV239(card);recalcSalesCardTransactionV239(card);if(card._renderSalesStateV317)card._renderSalesStateV317();updateSalesCardDeleteLockV322(card);refreshConfirmSaleButtonV322(type)},0);
  return card;
}

function collectProductLinksV206(type){
  const {date,location}=productLinkContextV206(type),result=[];
  salesCardWrappersV239(type).forEach(card=>{
    const txnId=String(card.dataset.transactionId||salesCardTxnIdV239());
    const shared=salesCardSharedValuesV239(card);
    const products=salesCardProductsV239(card),alloc=allocateSalesCardSharedCostsV239(card);
    products.forEach((item,i)=>{
      let linkId=String(item.dataset.linkId||"");
      const productName=String(item.querySelector(".product-link-name")?.value||"").trim();
      const quantity=salesCardQtyV240(item),unitPrice=salesCardUnitPriceV240(item),actualPrice=quantity*unitPrice;
      if(!linkId&&(productName||actualPrice||shared.remark)){linkId="spl_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);item.dataset.linkId=linkId}
      const averageCost=toAmount(item.querySelector(".product-link-avg-cost")?.value||0);
      const productId=String(item.querySelector(".product-link-name")?.dataset.productId||"");
      const minimumPrice=Math.max(0,Number(item.dataset.minimumPrice||0));
      const localDelivery=alloc[i]?.delivery||0,extraFee=Math.max(0,toAmount(productExtraInputV278(item)?.value||0)),commissionRate=shared.commissionRate;
      const commissionAmount=actualPrice*commissionRate/100;
      const profit=actualPrice-commissionAmount-(averageCost*quantity)-localDelivery-extraFee;
      const profitRate=actualPrice>0?profit/actualPrice*100:0;
      if(linkId||productName||actualPrice||shared.remark)result.push({
        linkId,type,date,location,transactionId:txnId,productOrder:i+1,
        productId,productName,quantity,averageCost,minimumPrice,unitPrice,actualPrice,
        commissionRate,commissionAmount,localDelivery,extraFee,profit,profitRate,remark:shared.remark,confirmedOnce:salesCardIsConfirmedV322(card)
      });
    });
  });
  return result;
}

async function saveProductLinksV206(type){
  const items=collectProductLinksV206(type);
  if(!items.length){alert("请至少输入一张销售卡；如果这次没有销售卡，可以保持收起，不需要保存。");return null}
  const first=items[0];if(!first.date||!first.location){alert(type==="live"?"请先选择日期和主播":type==="fair"?"请先选择 Fair 日期和地点":"请先选择日期");return null}
  for(const x of items){
    if(!x.productName){alert("每一个产品都需要填写产品名称。");return null}
    if(!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0){alert("每一个产品数量必须大于 0。");return null}
  }
  const official=dedupeRows(rows).filter(r=>r.type===type&&r.date===first.date&&(type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(first.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(first.location))).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
  const batchTotal=items.reduce((s,x)=>s+Number(x.actualPrice||0),0);
  if(official>0&&batchTotal>official+0.005){alert(`所有销售卡售价总数 RM${formatAmount(batchTotal)} 已超过当天营业额 RM${formatAmount(official)}。`);return null}

  // V29.9 optimistic local cache: keep the current UI stable; do not redraw from an older async response.
  if(typeof setCachedSalesProductLinksV216==="function")setCachedSalesProductLinksV216(type,first.date,first.location,items);
  if(typeof setSalesCardPersistentCacheV232==="function")setSalesCardPersistentCacheV232(type,first.date,first.location,items);
  if(typeof mergeDailyProfitContextCacheV237==="function")mergeDailyProfitContextCacheV237(type,first.date,first.location,items);

  try{
    setSync("销售卡同步中...");
    const result=await saveSalesProductLinksV206(items);
    const savedLinks=Array.isArray(result?.links)&&result.links.length?result.links:items;
    const statusByTxn={};
    savedLinks.forEach(x=>{if(String(x.productId||""))statusByTxn[String(x.transactionId||"")]=statusByTxn[String(x.transactionId||"")]||String(x.importSyncStatus||"PENDING_IMPORT_LINK")});

    if(typeof setCachedSalesProductLinksV216==="function")setCachedSalesProductLinksV216(type,first.date,first.location,savedLinks);
    if(typeof setSalesCardPersistentCacheV232==="function")setSalesCardPersistentCacheV232(type,first.date,first.location,savedLinks);
    // V50.8: the saved Sales Card context is also the authoritative profit context.
    // Replace the exact context in every profit cache immediately, using the same
    // server response. No extra cloud read and no delayed background handoff.
    if(typeof replaceProfitAggregateContextV457==="function")replaceProfitAggregateContextV457(type,first.date,first.location,savedLinks);
    else if(typeof mergeDailyProfitContextCacheV237==="function")mergeDailyProfitContextCacheV237(type,first.date,first.location,savedLinks);
    const dayProfitLinksV505=typeof getDailyProfitCacheV237==="function"?(getDailyProfitCacheV237(type,first.date)||[]):savedLinks;
    if(typeof seedSelectedDayProfitV368==="function")seedSelectedDayProfitV368(type,first.date,dayProfitLinksV505);
    if(productProfitSummaryOpenV216?.[type]&&productProfitSelectedDateV216(type)===first.date&&typeof renderProductProfitSummaryV216==="function")renderProductProfitSummaryV216(type,dayProfitLinksV505);
    salesCardWrappersV239(type).forEach(card=>{
      clearSalesCardTransactionDirtyV239(card);
      card.querySelectorAll(".product-link-item").forEach(item=>{item.dataset.saved="1";item.dataset.dirty="0"});
      const tag=card.querySelector(".sales-card-header-v239 b:first-child");if(tag)tag.textContent="已保存销售卡";
      const tx=String(card.dataset.transactionId||"");if(statusByTxn[tx])card.dataset.inventoryStatus=statusByTxn[tx];
      if(card._renderInventoryStatusV249)card._renderInventoryStatusV249();
    });
    setSync("销售卡已保存",true);
    alert("销售卡保存成功。");
    if(result?.warning)alert(result.warning);
    return result;
  }catch(e){
    setSync("销售卡同步失败",false,true);alert("销售卡保存失败："+(e.message||e));return null;
  }
}

async function saveLiveSales(){
  if(!ensureWritableSelection())return;
  const dateEl=document.getElementById("liveDate"),hostInput=document.getElementById("liveHost"),amountEl=document.getElementById("liveSales");
  const d=isoToDisplay(dateEl.value);let host=selectedLiveHost();const amount=toAmount(amountEl.value);
  if(!host){alert("请输入主播名字");return}
  if(!d){alert("请选择日期");return}
  const restored=reactivateLiveHostIfNeeded(host);host=restored.host;hostInput.value=host;
  saveLiveHost(host);saveLastLiveSession(host,dateEl.value);
  const now=new Date().toISOString(),localRow={type:"live",date:d,company:"live",location:host,amount,updatedAt:now,clientUpdatedAt:now};
  setLiveOptimisticLockV240(d,host,amount);
  if(amount<=0)rows=rows.filter(r=>rowKey(r)!==rowKey(localRow));else upsertLocalRow(localRow);
  addPendingRow(localRow);amountEl.value=formatAmount(amount);renderAll();amountEl.value=formatAmount(amount);showTempMsg("liveSaveMsg");
  try{
    setSync("已储存，正在后台同步...");
    const saved=await saveLiveToSheet(d,host,amount,now);
    const lock=getLiveOptimisticLockV240(d,host);
    if(lock){
      const finalRow=saved&&Number(saved.amount)>0?{...saved,amount:lock.amount}:localRow;
      if(lock.amount<=0)rows=rows.filter(r=>rowKey(r)!==rowKey(localRow));else upsertLocalRow(finalRow);
      amountEl.value=formatAmount(lock.amount);
    }else if(saved&&Number(saved.amount)>0)upsertLocalRow(saved);
    clearPendingRowIfVersionV343(localRow);renderAll();
    const lock2=getLiveOptimisticLockV240(d,host);if(lock2)amountEl.value=formatAmount(lock2.amount);
    clearLiveOptimisticLockV240(d,host);setSync("已同步",true);
  }catch(e){
    const lock=getLiveOptimisticLockV240(d,host);if(lock)amountEl.value=formatAmount(lock.amount);
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();else setSync("同步暂未完成",false,true);
  }
}


/* ================= V32.6 Home on-demand today total profit =================
   Deliberately NOT part of startup / priority sync. Turnover + sales-card
   revisions remain foreground priority. Profit is queried only when opened. */
let homeTodayProfitOpenV318=false;
function homeTodayProfitDateV318(){return selectedDashboardDateDisplay()}
function homeTodayProfitUniqueLinksV318(links,date){
  const seen=new Set();
  return (Array.isArray(links)?links:[]).filter(x=>{
    if(String(x.date||"")!==String(date||""))return false;
    const type=String(x.type||"");
    if(!["daily","fair","live"].includes(type))return false;
    const id=String(x.linkId||x.transactionId||"").trim();
    const fallback=[type,x.date,x.location,x.productId,x.productName,x.quantity,x.actualPrice].join("|");
    const key=id||fallback; if(seen.has(key))return false; seen.add(key); return true;
  });
}
function homeTodayProfitBreakdownV318(links,date){
  const list=homeTodayProfitUniqueLinksV318(links,date);
  const sum=t=>list.filter(x=>String(x.type||"")===t).reduce((a,x)=>a+(Number.isFinite(Number(x.profit))?Number(x.profit):0),0);
  const sales=sum("daily"),fair=sum("fair"),live=sum("live");
  return {sales,fair,live,total:sales+fair+live};
}
function renderHomeTodayProfitV318(links,date){
  const panel=document.getElementById("homeTodayProfitPanelV318");if(!panel)return;
  const p=homeTodayProfitBreakdownV318(links,date);
  panel.innerHTML=`<div class="home-today-profit-row-v318"><span>Sales 利润</span><b>RM${formatAmount(p.sales)}</b></div><div class="home-today-profit-row-v318"><span>Fair 利润</span><b>RM${formatAmount(p.fair)}</b></div><div class="home-today-profit-row-v318"><span>Live 利润</span><b>RM${formatAmount(p.live)}</b></div><div class="home-today-profit-row-v318 home-today-profit-total-v318"><span>今日总利润</span><b>RM${formatAmount(p.total)}</b></div>`;
  panel.classList.remove("hidden");
}
function homeTodayProfitCachedLinksV318(date){
  const types=["daily","fair","live"],all=[];let found=false;
  types.forEach(t=>{const x=typeof getDailyProfitCacheV237==="function"?getDailyProfitCacheV237(t,date):null;if(Array.isArray(x)){found=true;all.push(...x)}});
  return found?all:null;
}
async function toggleHomeTodayProfitV318(button){
  const panel=document.getElementById("homeTodayProfitPanelV318");if(!panel)return;
  if(homeTodayProfitOpenV318&&!panel.classList.contains("hidden")){homeTodayProfitOpenV318=false;panel.classList.add("hidden");if(button)button.textContent="📊 今日总利润";return}
  const date=homeTodayProfitDateV318();if(!date)return;
  const cached=homeTodayProfitCachedLinksV318(date);
  if(Array.isArray(cached)){renderHomeTodayProfitV318(cached,date);homeTodayProfitOpenV318=true;if(button)button.textContent="📊 收起今日总利润"}
  else if(button){button.disabled=true;button.textContent="读取利润中..."}
  try{
    // On-demand only: this request never runs from startup, resume, or priority sync.
    const all=await loadAllSalesProductLinksV203({force:true,maxAgeMs:0});
    const fresh=(Array.isArray(all)?all:[]).filter(x=>String(x.date||"")===date);
    ["daily","fair","live"].forEach(t=>{if(typeof setDailyProfitCacheV237==="function")setDailyProfitCacheV237(t,date,fresh.filter(x=>String(x.type||"")===t))});
    renderHomeTodayProfitV318(fresh,date);homeTodayProfitOpenV318=true;if(button)button.textContent="📊 收起今日总利润";
  }catch(e){if(!Array.isArray(cached))alert("读取今日总利润失败："+(e.message||e));else console.warn("今日总利润后台核对失败",e)}
  finally{if(button)button.disabled=false}
}

/* ================= V29.9 same-day linked bonsai profit summary ================= */
const productProfitSummaryOpenV216={live:false,fair:false};
function productProfitSummaryPanelV216(type){return document.getElementById(productLinkPreV208(type)+"ProductProfitSummary")}
function productProfitSelectedDateV216(type){
  return type==="daily"?isoToDisplay(document.getElementById("saleDate")?.value||""):type==="live"?isoToDisplay(document.getElementById("liveDate")?.value||""):String(document.getElementById("fairProductDate")?.value||"");
}
function productProfitGroupKeyV216(type,value){return type==="daily"?(String(value||'').toLowerCase().includes('balakong')?'balakong':'belimbing'):type==="live"?normalizeLiveHostKey(value):normalizeFairLocationKey(value)}
function productProfitSalesByGroupV216(type,date){
  const map=new Map();
  dedupeRows(rows).forEach(r=>{
    if(r.type!==type||r.date!==date)return;
    if(type==="daily"){const wanted=String(document.getElementById('company')?.value||'belimbing');if(r.company!==wanted)return;}
    const name=type==="daily"?(String(r.location||'Belimbing').toLowerCase().includes('balakong')?'Balakong':'Belimbing'):String(r.location||"").trim();if(!name)return;
    const key=productProfitGroupKeyV216(type,name);
    const rec=map.get(key)||{name,sales:0};
    rec.sales=Math.max(rec.sales,Number(r.amount||0));map.set(key,rec);
  });
  return map;
}
function productProfitGroupLinksV216(type,date,links){
  const groups=new Map();
  (links||[]).filter(x=>String(x.type||"")===type&&String(x.date||"")===date&&String(x.productName||"").trim()).forEach(x=>{
    const name=type==="daily"?(String(x.location||'Belimbing').toLowerCase().includes('balakong')?'Balakong':'Belimbing'):String(x.location||"").trim()||"未指定",key=productProfitGroupKeyV216(type,name)||name;
    if(!groups.has(key))groups.set(key,{name,links:[]});
    groups.get(key).links.push(x);
  });
  return groups;
}
function productProfitGroupStatsV216(group,salesMap,type){
  const totalProfit=group.links.reduce((s,x)=>s+Number(x.profit||0),0);
  const sales=Number(salesMap.get(productProfitGroupKeyV216(type,group.name))?.sales||0);
  return{totalProfit,sales,overallRate:sales>0?totalProfit/sales*100:0};
}
function productProfitDesktopRowsV216(list){
  return list.map(x=>`<tr><td>${escapeChangeLogHtmlV200(String(x.productName||""))}</td><td>${formatAmount(Number(x.averageCost||0)*Math.max(1,Number(x.quantity||1)))}</td><td>${formatAmount(Number(x.actualPrice||0))}</td><td>${formatAmount(Number(x.profit||0))}</td><td>${Number(x.profitRate||0).toFixed(2)}%</td></tr>`).join("");
}
function productProfitMobileCardsV216(list){
  return list.map(x=>`<div class="product-profit-mobile-card"><div class="product-profit-mobile-name">${escapeChangeLogHtmlV200(String(x.productName||""))}</div><div class="product-profit-mobile-grid"><div><span>成本</span><b>${formatAmount(Number(x.averageCost||0)*Math.max(1,Number(x.quantity||1)))}</b></div><div><span>售价</span><b>${formatAmount(Number(x.actualPrice||0))}</b></div><div><span>利润</span><b>${formatAmount(Number(x.profit||0))}</b></div><div><span>利润率</span><b>${Number(x.profitRate||0).toFixed(2)}%</b></div></div></div>`).join("");
}
function renderProductProfitSummaryV216(type,allLinks){
  const panel=productProfitSummaryPanelV216(type);if(!panel)return;
  const date=productProfitSelectedDateV216(type),salesMap=productProfitSalesByGroupV216(type,date),groups=productProfitGroupLinksV216(type,date,allLinks);
  salesMap.forEach((rec,key)=>{if(!groups.has(key))groups.set(key,{name:rec.name,links:[]})});
  const ordered=Array.from(groups.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),"zh-Hans-CN",{numeric:true,sensitivity:"base"}));
  let dayProfit=0,daySales=0;
  const sections=ordered.map(group=>{
    const s=productProfitGroupStatsV216(group,salesMap,type);dayProfit+=s.totalProfit;daySales+=s.sales;
    return `<section class="product-profit-group"><div class="product-profit-group-title">${type==="live"?"主播":type==="fair"?"地点":"门市"}：${escapeChangeLogHtmlV200(group.name)}</div><div class="product-profit-table-wrap"><table class="product-profit-table"><thead><tr><th>产品名</th><th>成本总数</th><th>售价总数</th><th>利润总数</th><th>利润率</th></tr></thead><tbody>${group.links.length?productProfitDesktopRowsV216(group.links):`<tr><td colspan="5" class="product-profit-empty">没有已保存的关联盆栽资料</td></tr>`}</tbody></table></div><div class="product-profit-mobile-list">${group.links.length?productProfitMobileCardsV216(group.links):`<div class="product-profit-empty">没有已保存的关联盆栽资料</div>`}</div><div class="product-profit-total profit-highlight"><span>总利润</span><b>RM${formatAmount(s.totalProfit)}</b></div><div class="product-profit-total profit-highlight"><span>整体利润率</span><b>${s.overallRate.toFixed(2)}%</b></div><div class="product-profit-formula">全部利润总和 ÷ ${type==="live"?"该主播":type==="fair"?"该地点":"门市"}销售额 RM${formatAmount(s.sales)}</div></section>`;
  }).join("");
  const dayRate=daySales>0?dayProfit/daySales*100:0;
  panel.innerHTML=`<div class="product-profit-summary-head"><div><b>${date} · ${type==="daily"?(String(document.getElementById('company')?.value||'')==='balakong'?"Balakong 门市":"Belimbing 门市"):type==="live"?"全部主播":"全部地点"}</b></div><button type="button" class="secondary-btn product-profit-export-btn" onclick="exportProductProfitExcelV216('${type}')">📈 导出 Excel</button></div>${sections||`<div class="product-profit-empty">当天还没有关联盆栽资料</div>`}<div class="product-profit-day-summary"><div class="product-profit-total profit-highlight"><span>当天总利润</span><b>RM${formatAmount(dayProfit)}</b></div><div class="product-profit-total profit-highlight"><span>当天整体利润率</span><b>${dayRate.toFixed(2)}%</b></div></div>`;
  panel.dataset.summaryDate=date;
  panel.dataset.summaryLinks=JSON.stringify((allLinks||[]).filter(x=>String(x.type||"")===type&&String(x.date||"")===date));
}
async function toggleProductProfitSummaryV216(type,button){
  const panel=productProfitSummaryPanelV216(type);if(!panel)return;
  if(productLinkBoxIsOpenV210(type)&&hasUnsavedSalesCardChangesV238(type)&&!confirmDiscardSalesCardChangesV238(type))return;
  const date=productProfitSelectedDateV216(type);if(!date){alert("请先选择日期");return}
  if(productProfitSummaryOpenV216[type]&&!panel.classList.contains("hidden")){productProfitSummaryOpenV216[type]=false;panel.classList.add("hidden");panel.innerHTML="";if(button)button.textContent="📊 当天利润";return}
  try{
    // V29.9: opening Daily Profit closes Sales Cards first, then paints local cache immediately.
    const pre=productLinkPreV208(type),box=document.getElementById(pre+"ProductLinkBox"),body=document.getElementById(pre+"ProductLinkBody");
    if(body)body.classList.add("hidden");
    if(box)box.classList.add("product-link-collapsed");
    const cardBtn=box?.querySelector(".product-link-toggle");
    if(cardBtn)cardBtn.setAttribute("aria-expanded","false");

    const cachedLinks=typeof getDailyProfitCacheV237==="function"?getDailyProfitCacheV237(type,date):null;
    const offline=typeof navigator!=="undefined"&&navigator.onLine===false;
    // V36.0: while online, never flash an old independent Profit cache before the
    // authoritative Sales Card list arrives. This removes the 2-profit -> 1-profit
    // oscillation. Cache is only a true offline fallback.
    if(offline&&Array.isArray(cachedLinks)){
      renderProductProfitSummaryV216(type,cachedLinks);
      panel.classList.remove("hidden");
      productProfitSummaryOpenV216[type]=true;
      if(button)button.textContent="📊 收起利润";
    }else if(button){button.disabled=true;button.textContent="读取中..."}

    const allLinks=await loadAllSalesProductLinksV203({force:false,maxAgeMs:180000});
    const freshRaw=(allLinks||[]).filter(x=>String(x.type||"")===type&&String(x.date||"")===date);
    const fresh=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(freshRaw):freshRaw;
    if(typeof setDailyProfitCacheV237==="function")setDailyProfitCacheV237(type,date,fresh);

    if(!productProfitSummaryOpenV216[type]&&Array.isArray(cachedLinks))return;
    if(!Array.isArray(cachedLinks)||JSON.stringify(cachedLinks)!==JSON.stringify(fresh)){
      renderProductProfitSummaryV216(type,fresh);
    }
    panel.classList.remove("hidden");
    productProfitSummaryOpenV216[type]=true;
    if(button)button.textContent="📊 收起利润";
  }catch(e){
    const cachedLinks=typeof getDailyProfitCacheV237==="function"?getDailyProfitCacheV237(type,date):null;
    if(Array.isArray(cachedLinks)){renderProductProfitSummaryV216(type,cachedLinks);panel.classList.remove("hidden");productProfitSummaryOpenV216[type]=true;if(button)button.textContent="📊 收起利润";console.warn("当天利润云端读取失败，显示离线缓存",e)}
    else alert("读取当天利润失败："+(e.message||e));
  }
  finally{if(button)button.disabled=false}
}
function xlsxVisualWidthV216(value){
  let width=0;for(const ch of String(value??""))width+=/[\u2E80-\u9FFF\uF900-\uFAFF]/.test(ch)?2:1;return width;
}
function excelDateSerialV242(date){
  const m=String(date||"").match(/^(\d{2})-(\d{2})-(\d{4})$/);if(!m)return null;
  return Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1]))/86400000+25569;
}
function buildProductProfitXlsxV216(type,list,dates){
  const table=[];
  let grandProfit=0,grandSales=0;
  dates.forEach((date,dateIndex)=>{
    const salesMap=productProfitSalesByGroupV216(type,date);
    const groups=productProfitGroupLinksV216(type,date,list);
    salesMap.forEach((rec,key)=>{if(!groups.has(key))groups.set(key,{name:rec.name,links:[]})});
    const ordered=Array.from(groups.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),"zh-Hans-CN",{numeric:true,sensitivity:"base"}));
    let dayProfit=0,daySales=0;
    if(dateIndex)table.push([]);
    table.push([{v:date,kind:"date"}]);
    ordered.forEach(group=>{
      const st=productProfitGroupStatsV216(group,salesMap,type);dayProfit+=st.totalProfit;daySales+=st.sales;
      table.push([type==="live"?"主播":"地点",group.name]);
      table.push(["产品名","数量","成本（产品+运费+附加）","单棵售价","总数","利润","利润率","备注"]);
      group.links.forEach(x=>{
        const qty=Math.max(1,Number(x.quantity||1));
        const total=Number(x.actualPrice||0);
        const unit=(x.unitPrice!==undefined&&x.unitPrice!==null&&x.unitPrice!=="")?Number(x.unitPrice||0):(qty?total/qty:total);
        table.push([
          String(x.productName||""),qty,productOperatingCostV335(x),unit,total,
          Number(x.profit||0),Number(x.profitRate||0)/100,String(x.remark||"")
        ]);
      });
      table.push(["总利润",st.totalProfit]);table.push(["销售额",st.sales]);table.push(["整体利润率",st.overallRate/100]);table.push([]);
    });
    const dayRate=daySales>0?dayProfit/daySales:0;
    table.push(["当天总利润",dayProfit]);table.push(["当天销售额",daySales]);table.push(["当天整体利润率",dayRate]);
    grandProfit+=dayProfit;grandSales+=daySales;
  });
  if(dates.length>1){table.push([]);table.push(["全部总利润",grandProfit]);table.push(["全部销售额",grandSales]);table.push(["全部整体利润率",grandSales>0?grandProfit/grandSales:0]);}
  const colCount=8;
  const widths=Array.from({length:colCount},(_,c)=>{let max=c===0?30:(c===7?28:12);table.forEach(row=>{const cell=row[c];const v=cell&&typeof cell==="object"?cell.v:cell;max=Math.max(max,xlsxVisualWidthV216(v)+3)});return Math.min(70,max)});
  const cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("");
  const moneyLabels=new Set(["总利润","销售额","当天总利润","当天销售额","全部总利润","全部销售额"]);
  const pctLabels=new Set(["整体利润率","当天整体利润率","全部整体利润率"]);
  const rowsXml=table.map((row,ri)=>`<row r="${ri+1}">${Array.from({length:colCount},(_,ci)=>{
    const cell=row[ci],ref=xlsxColNameV196(ci)+(ri+1);if(cell===undefined||cell===null||cell==="")return"";
    if(cell&&typeof cell==="object"&&cell.kind==="date"){const serial=excelDateSerialV242(cell.v);return serial===null?`<c r="${ref}" t="inlineStr"><is><t>${xlsxXmlEscapeV196(cell.v)}</t></is></c>`:`<c r="${ref}" s="5"><v>${serial}</v></c>`}
    const v=cell,label=String(row[0]&&typeof row[0]==="object"?row[0].v:row[0]||"");
    if(label==="产品名")return`<c r="${ref}" t="inlineStr" s="1"><is><t>${xlsxXmlEscapeV196(v)}</t></is></c>`;
    const productRow=row.length>=8&&typeof row[1]==="number";
    if(productRow&&ci===1)return`<c r="${ref}" s="3"><v>${Number(v)}</v></c>`;
    if(productRow&&[2,3,4,5].includes(ci))return`<c r="${ref}" s="2"><v>${Number(v).toFixed(2)}</v></c>`;
    if(productRow&&ci===6)return`<c r="${ref}" s="4"><v>${Number(v).toFixed(6)}</v></c>`;
    if(moneyLabels.has(label)&&ci===1)return`<c r="${ref}" s="2"><v>${Number(v).toFixed(2)}</v></c>`;
    if(pctLabels.has(label)&&ci===1)return`<c r="${ref}" s="4"><v>${Number(v).toFixed(6)}</v></c>`;
    return`<c r="${ref}" t="inlineStr"><is><t>${xlsxXmlEscapeV196(v)}</t></is></c>`
  }).join("")}</row>`).join("");
  const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rowsXml}</sheetData></worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd-mm-yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  return[{name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},{name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},{name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Profit" sheetId="1" r:id="rId1"/></sheets></workbook>`},{name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},{name:"xl/styles.xml",data:styles},{name:"xl/worksheets/sheet1.xml",data:sheetXml}];
}
let productProfitExportBusyV242=false;
async function exportProductProfitExcelV216(type){
  if(productProfitExportBusyV242)return;
  const choice=prompt("选择导出范围：\n1 = 按日期\n2 = 整个月\n3 = 全部数据","1");if(!choice)return;
  const mode=choice==="1"?"date":choice==="2"?"month":choice==="3"?"all":"";if(!mode){alert("请输入 1、2 或 3。");return}
  let target="";
  if(mode==="date"){target=prompt("日期 DD-MM-YYYY：",productProfitSelectedDateV216(type))||"";if(!/^\d{2}-\d{2}-\d{4}$/.test(target)){alert("日期格式错误");return}}
  if(mode==="month"){const d=productProfitSelectedDateV216(type);target=prompt("月份 MM-YYYY：",d?d.slice(3):"")||"";if(!/^\d{2}-\d{4}$/.test(target)){alert("月份格式错误");return}}
  productProfitExportBusyV242=true;
  try{
    const all=await loadAllSalesProductLinksV203({force:true,maxAgeMs:0});
    const filtered=all.filter(x=>String(x.type||"")===type&&(mode==="all"||mode==="date"&&String(x.date||"")===target||mode==="month"&&String(x.date||"").slice(3)===target));
    if(!filtered.length){alert("所选范围没有销售卡利润资料。");return}
    const dates=[...new Set(filtered.map(x=>String(x.date||"")))].filter(Boolean).sort((a,b)=>{const pa=a.split("-").reverse().join(""),pb=b.split("-").reverse().join("");return pa.localeCompare(pb)});
    const files=buildProductProfitXlsxV216(type,filtered,dates);
    const blob=new Blob([zipStoreV196(files)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),u=URL.createObjectURL(blob),a=document.createElement("a");
    const suffix=mode==="date"?target:mode==="month"?target:"All";
    a.href=u;a.download=`Lover_${type==="live"?"Live":"Fair"}_Profit_${suffix}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
  }catch(e){alert("导出失败："+(e.message||e))}
  finally{productProfitExportBusyV242=false}
}
window.toggleProductProfitSummaryV216=toggleProductProfitSummaryV216;
window.exportProductProfitExcelV216=exportProductProfitExcelV216;

async function saveLiveSales(){
  if(!ensureWritableSelection())return;
  const dateEl=document.getElementById("liveDate");
  const hostInput=document.getElementById("liveHost");
  const amountEl=document.getElementById("liveSales");
  const d=isoToDisplay(dateEl.value);
  let host=selectedLiveHost();
  const amount=toAmount(amountEl.value);
  if(!host){alert("请输入主播名字");return}
  if(!d){alert("请选择日期");return}
  const restored=reactivateLiveHostIfNeeded(host);
  host=restored.host;
  hostInput.value=host;
  saveLiveHost(host);
  saveLastLiveSession(host,dateEl.value);
  const now=new Date().toISOString();
  const localRow={type:"live",date:d,company:"live",location:host,amount,updatedAt:now,clientUpdatedAt:now};
  if(amount<=0)rows=rows.filter(r=>rowKey(r)!==rowKey(localRow));
  else upsertLocalRow(localRow);
  addPendingRow(localRow);
  renderAll();
  showTempMsg("liveSaveMsg");
  try{
    setSync("已储存，正在后台同步...");
    const saved=await saveLiveToSheet(d,host,amount,now);
    if(saved&&Number(saved.amount)>0)upsertLocalRow(saved);
    else rows=rows.filter(r=>rowKey(r)!==rowKey(localRow));
    clearPendingRowIfVersionV343(localRow);
    renderAll();
    setSync("已同步",true);
  }catch(e){
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
    else setSync("同步暂未完成",false,true);
  }
}
let monthGrandHistoryOpenV223=false;
let monthGrandHistoryLoadingV223=false;
let monthGrandProfitLinksV295=[];

function homeCardMetricsByPeriodV433(links,period,kind="total"){
  return (links||[]).reduce((totals,x)=>{
    if(["deleted","cancelled"].includes(String(x.status||"active").toLowerCase()))return totals;
    const date=String(x.date||"");
    const iso=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:displayToISO(date);
    if(!iso||!(iso.slice(0,7)===period||iso.slice(0,4)===period))return totals;
    const type=String(x.type||"").toLowerCase();
    if(!["daily","fair","live"].includes(type))return totals;
    const location=String(x.location||"").toLowerCase();
    if(kind==="balakong"&&(type!=="daily"||!location.includes("balakong")))return totals;
    if(kind==="belimbing"&&(type!=="daily"||location.includes("balakong")))return totals;
    if(kind==="fair"&&type!=="fair")return totals;
    if(kind==="live"&&type!=="live")return totals;
    const profit=Number(x.profit),sale=Number(x.actualPrice);
    if(Number.isFinite(profit))totals.profit+=profit;
    if(Number.isFinite(sale)&&sale>0)totals.cardSales+=sale;
    return totals;
  },{profit:0,cardSales:0});
}

function monthGrandProfitV295(month){
  return homeCardMetricsByPeriodV433(monthGrandProfitLinksV295,month).profit;
}

function monthGrandHistoryRowsV223(){
  const year=String(document.getElementById("yearPicker")?.value||selectedYear()||"");
  return buildMonthlySummary()
    .filter(item=>!year||String(item.month||"").slice(0,4)===year)
    .filter(item=>Number(item.total||0)>0)
    .sort((a,b)=>String(a.month||"").localeCompare(String(b.month||"")))
    .map(item=>({
      key:item.month,
      label:String(item.month||"").slice(5,7)+"-"+String(item.month||"").slice(0,4),
      amount:Number(item.total||0),
      ...homeCardMetricsByPeriodV433(monthGrandProfitLinksV295,String(item.month||""))
    }));
}

function renderMonthGrandHistoryV223(){
  const panel=document.getElementById("monthGrandHistory");
  const arrow=document.getElementById("monthGrandHistoryArrow");
  if(!panel)return;

  if(!monthGrandHistoryOpenV223){
    panel.classList.add("hidden");
    panel.innerHTML="";
    if(arrow)arrow.textContent="▼";
    return;
  }

  const list=monthGrandHistoryRowsV223();
  const grandSales=list.reduce((sum,item)=>sum+Number(item.amount||0),0);
  const grandProfit=list.reduce((sum,item)=>sum+Number(item.profit||0),0);
  const grandCardSales=list.reduce((sum,item)=>sum+Number(item.cardSales||0),0);
  const grandRate=grandCardSales>0?grandProfit/grandCardSales*100:0;
  panel.classList.remove("hidden");
  if(arrow)arrow.textContent="▲";

  if(monthGrandHistoryLoadingV223&&!list.length){
    panel.innerHTML='<div class="sub">正在读取月份营业额和利润...</div>';
    return;
  }

  panel.innerHTML=list.length
    ?`<div class="month-grand-profit-table-v295"><div class="month-grand-profit-head-v295"><span>日期</span><span>营业额</span><span>利润</span><span>利润率</span></div>${list.map(x=>{const rate=Number(x.cardSales||0)>0?Number(x.profit||0)/Number(x.cardSales||0)*100:0;return `<div class="month-grand-profit-row-v295"><span>${x.label}</span><b>${money(x.amount)}</b><b>${money(x.profit)}</b><b>${rate.toFixed(2)}%</b></div>`}).join("")}<div class="month-grand-profit-row-v295 month-grand-profit-total-v295"><span>总数</span><b>${money(grandSales)}</b><b>${money(grandProfit)}</b><b>${grandRate.toFixed(2)}%</b></div></div>`
    :'<div class="sub">还没有月份营业额记录</div>';
}

async function toggleMonthGrandHistoryV223(){
  monthGrandHistoryOpenV223=!monthGrandHistoryOpenV223;
  renderMonthGrandHistoryV223();
  if(!monthGrandHistoryOpenV223)return;

  const year=String(document.getElementById("yearPicker")?.value||selectedYear()||"");
  monthGrandHistoryLoadingV223=true;
  renderMonthGrandHistoryV223();
  try{
    const tasks=[];
    if(typeof loadYearInBackground==="function"&&/^\d{4}$/.test(year))tasks.push(loadYearInBackground(year));
    if(typeof loadAllSalesProductLinksV203==="function")tasks.push(loadAllSalesProductLinksV203({force:false,maxAgeMs:120000}).then(x=>{monthGrandProfitLinksV295=Array.isArray(x)?x:[]}));
    await Promise.all(tasks);
  }catch(e){
    console.warn("Month turnover/profit history load skipped:",e);
  }finally{
    monthGrandHistoryLoadingV223=false;
    renderMonthGrandHistoryV223();
  }
}
window.toggleMonthGrandHistoryV223=toggleMonthGrandHistoryV223;


/* ================= V29.9 expandable yearly monthly breakdown + profit ================= */
const yearBreakdownOpenV224={balakong:false,belimbing:false,fair:false,live:false,total:false};
const yearBreakdownLoadingV224={balakong:false,belimbing:false,fair:false,live:false,total:false};
let yearBreakdownLinksV286=[];

function yearBreakdownProfitV286(kind,key){
  const isYear=kind==="total";
  return (yearBreakdownLinksV286||[]).reduce((sum,x)=>{
    if(["deleted","cancelled"].includes(String(x.status||"active").toLowerCase()))return sum;
    const date=String(x.date||"");
    const iso=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:displayToISO(date);
    if(!iso)return sum;
    const rowKey=isYear?iso.slice(0,4):iso.slice(0,7);
    if(rowKey!==key)return sum;
    const type=String(x.type||"").toLowerCase();
    if(kind==="balakong"&&(type!=="daily"||!String(x.location||'').toLowerCase().includes('balakong')))return sum;
    if(kind==="belimbing"&&(type!=="daily"||String(x.location||'Belimbing').toLowerCase().includes('balakong')))return sum;
    if(kind==="fair"&&type!=="fair")return sum;
    if(kind==="live"&&type!=="live")return sum;
    const profit=Number(x.profit);
    return sum+(Number.isFinite(profit)?profit:0);
  },0);
}
function yearBreakdownRowsV224(kind){
  if(kind==="total"){
    const byYear=new Map();
    buildMonthlySummary().forEach(item=>{
      const year=String(item.month||"").slice(0,4);
      if(!/^\d{4}$/.test(year))return;
      byYear.set(year,(byYear.get(year)||0)+Number(item.total||0));
    });
    return [...byYear.entries()].map(([year,amount])=>({month:year,year,amount:Number(amount||0),...homeCardMetricsByPeriodV433(yearBreakdownLinksV286,year)}))
      .filter(item=>Math.abs(item.amount)>0.000001).sort((a,b)=>String(a.year).localeCompare(String(b.year)));
  }
  const year=String(document.getElementById("yearPicker")?.value||selectedYear()||"");
  return buildMonthlySummary().filter(item=>!year||String(item.month||"").slice(0,4)===year)
    .map(item=>({month:item.month,amount:Number(item[kind]||0),...homeCardMetricsByPeriodV433(yearBreakdownLinksV286,String(item.month||""),kind)}))
    .filter(item=>Math.abs(item.amount)>0.000001).sort((a,b)=>String(a.month).localeCompare(String(b.month)));
}
function yearBreakdownTableV286(list,kind){
  const grandSales=list.reduce((s,x)=>s+Number(x.amount||0),0),grandProfit=list.reduce((s,x)=>s+Number(x.profit||0),0),grandCardSales=list.reduce((s,x)=>s+Number(x.cardSales||0),0),grandRate=grandCardSales>0?grandProfit/grandCardSales*100:0;
  const rowsHtml=list.map(x=>{const sales=Number(x.amount||0),profit=Number(x.profit||0),denominator=Number(x.cardSales||0),rate=denominator>0?profit/denominator*100:0;const label=kind==="total"?String(x.year||x.month):String(x.month).slice(5,7)+"-"+String(x.month).slice(0,4);return `<div class="year-profit-row-v286"><span>${label}</span><b>${money(sales)}</b><b>${money(profit)}</b><b>${rate.toFixed(2)}%</b></div>`}).join("");
  return `<div class="year-profit-table-v286"><div class="year-profit-head-v286"><span>日期</span><span>营业额</span><span>利润</span><span>利润率</span></div>${rowsHtml}<div class="year-profit-row-v286 year-profit-total-v286"><span>总数</span><b>${money(grandSales)}</b><b>${money(grandProfit)}</b><b>${grandRate.toFixed(2)}%</b></div></div>`;
}
function renderYearBreakdownV224(kind){
  const panel=document.getElementById("yearBreakdown-"+kind),arrow=document.getElementById("yearBreakdownArrow-"+kind);if(!panel)return;
  const box=panel.closest(".box");
  if(box)box.classList.toggle("year-breakdown-expanded-v290",!!yearBreakdownOpenV224[kind]);
  if(!yearBreakdownOpenV224[kind]){panel.classList.add("hidden");panel.innerHTML="";if(arrow)arrow.textContent="▼";return;}
  const list=yearBreakdownRowsV224(kind);panel.classList.remove("hidden");if(arrow)arrow.textContent="▲";
  if(yearBreakdownLoadingV224[kind]&&!list.length){panel.innerHTML='<div class="sub">正在读取年度资料...</div>';return;}
  panel.innerHTML=list.length?yearBreakdownTableV286(list,kind):'<div class="sub">还没有月份营业额记录</div>';
}
function renderAllYearBreakdownsV224(){Object.keys(yearBreakdownOpenV224).forEach(renderYearBreakdownV224);}
async function toggleYearBreakdownV224(kind){
  if(!(kind in yearBreakdownOpenV224))return;yearBreakdownOpenV224[kind]=!yearBreakdownOpenV224[kind];renderYearBreakdownV224(kind);if(!yearBreakdownOpenV224[kind])return;
  const year=String(document.getElementById("yearPicker")?.value||selectedYear()||"");yearBreakdownLoadingV224[kind]=true;renderYearBreakdownV224(kind);
  try{
    const tasks=[];
    if(typeof loadYearInBackground==="function"&&/^\d{4}$/.test(year))tasks.push(loadYearInBackground(year));
    if(typeof loadAllSalesProductLinksV203==="function")tasks.push(loadAllSalesProductLinksV203({force:false,maxAgeMs:120000}).then(x=>{yearBreakdownLinksV286=Array.isArray(x)?x:[]}));
    await Promise.all(tasks);
  }catch(e){console.warn("Year breakdown load skipped:",kind,e)}finally{yearBreakdownLoadingV224[kind]=false;renderYearBreakdownV224(kind)}
}
window.toggleYearBreakdownV224=toggleYearBreakdownV224;

function renderDashboard(){
  const bm=totalBy("daily","balakong","month"),blm=totalBy("daily","belimbing","month"),fm=totalBy("fair","","month"),lm=totalBy("live","","month");
  const by=totalBy("daily","balakong","year"),bly=totalBy("daily","belimbing","year"),fy=totalBy("fair","","year"),ly=totalBy("live","","year");
  document.getElementById("balakongMonth").textContent=money(bm);
  document.getElementById("belimbingMonth").textContent=money(blm);
  renderFairLocationList();
  document.getElementById("fairMonthTotal").textContent=money(fm);
  renderFairCommission(fm);
  renderLiveHostSummary();
  document.getElementById("liveMonthTotal").textContent=money(lm);
  const liveCommission=liveByHostThisMonth().reduce((sum,item)=>sum+item.commission,0);
  document.getElementById("liveCommissionLabel").textContent="本月总佣金";
  document.getElementById("liveCommissionTotal").textContent=money(liveCommission);
  document.getElementById("monthGrandTotal").textContent=money(bm+blm+fm+lm); 
  renderMonthGrandHistoryV223();
  document.getElementById("balakongYearTotal").textContent=money(by);
  document.getElementById("belimbingYearTotal").textContent=money(bly);
  document.getElementById("fairYearTotal").textContent=money(fy);
  document.getElementById("liveYearTotal").textContent=money(ly);
  document.getElementById("yearGrandTotal").textContent=money(by+bly+fy+ly);
  renderAllYearBreakdownsV224();
  renderTodayCompanyStatus();
  renderBusinessTop3();
}


function sortReportRows(list){
  const rank=r=>r.type==="daily"&&r.company==="balakong"?0:r.type==="daily"&&r.company==="belimbing"?1:r.type==="fair"?2:3;
  return [...list].sort((a,b)=>rank(a)-rank(b)||(rLocation(a)).localeCompare(rLocation(b))||displayToISO(a.date).localeCompare(displayToISO(b.date)));
}
function rLocation(r){return r.type==="live"?canonicalLiveHost(r.location):canonicalLocation(r.location)}
function renderTable(){
  const reportPicker=document.getElementById("reportMonthPicker");
  const reportLabel=document.getElementById("reportMonthLabel");
  if(reportPicker&&reportPicker.value!==selectedMonth())reportPicker.value=selectedMonth();
  if(reportLabel){const m=selectedMonth();reportLabel.textContent=m?`月份：${m.slice(5,7)}-${m.slice(0,4)}`:"月份：-";}
  const s=sortReportRows(dedupeRows(rows).filter(r=>sameMonth(r.date)&&Number(r.amount)>0));
  document.getElementById("recordTable").innerHTML=s.map(r=>{const rate=r.type==="live"?getLiveHostRate(r.location,r.date):r.type==="fair"?getFairCommissionRate(totalBy("fair","","month"))*100:0;const commission=(r.type==="live"||r.type==="fair")?Number(r.amount||0)*rate/100:0;return `<tr><td>${r.date}</td><td>${r.type==="fair"?"Fair":r.type==="live"?"Live":"每日"}</td><td>${r.type==="live"?"Live":(companyNames[r.company]||r.company)}</td><td>${r.location||"-"}</td><td>${money(r.amount)}</td><td>${rate?Number(rate.toFixed(2))+"%":"-"}</td><td>${rate?money(commission):"-"}</td></tr>`}).join("")||'<tr><td colspan="7" style="text-align:center;">这个月份还没有记录</td></tr>';
}
function renderAll(){
  // V29.9: one complete render path. This replaces the older partial duplicate
  // so Fair daily/monthly totals, Home totals and Report always refresh together.
  rows=dedupeRows(rows);
  renderDashboard();
  renderTable();
  updateDailyInputFromSelectedDate();
  renderFairLocationOptions();
  updateFairPageMode();
  renderFairMonthlyList();
  renderFairDailySummary();
  renderLiveHostOptions();
  updateLiveInputFromSelectedDate();
  renderLiveDailySummary();
  renderLiveMonthlyList();
  loadCommissionSettingsForm();
  renderLiveHostCommissionSettings();
  renderLiveRateSchedules();
  renderMonthlySummary();
  const dailyTotalsCard=document.getElementById("dailyTotalsCard");
  if(dailyTotalsCard&&!dailyTotalsCard.classList.contains("hidden"))renderDailyTotals();
}

function getMonthKeyFromRow(row){
  const iso=displayToISO(row&&row.date);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.slice(0,7):"";
}
function buildMonthlySummary(){
  const map=new Map();
  const seedMonths=new Set([selectedMonth(),systemState.currentMonth,...(systemState.closedMonths||[])]);
  seedMonths.forEach(month=>{if(/^\d{4}-\d{2}$/.test(month))map.set(month,{month,balakong:0,belimbing:0,fair:0,live:0})});
  dedupeRows(rows).forEach(row=>{
    const month=getMonthKeyFromRow(row);
    if(!month)return;
    if(!map.has(month))map.set(month,{month,balakong:0,belimbing:0,fair:0,live:0});
    const item=map.get(month),amount=Number(row.amount||0);
    if(row.type==="daily"&&row.company==="balakong")item.balakong+=amount;
    else if(row.type==="daily"&&row.company==="belimbing")item.belimbing+=amount;
    else if(row.type==="fair")item.fair+=amount;
    else if(row.type==="live")item.live+=amount;
  });
  return [...map.values()].map(item=>({...item,total:item.balakong+item.belimbing+item.fair+item.live})).sort((a,b)=>b.month.localeCompare(a.month));
}
// V29.9: expandable daily total list. It uses cached rows immediately and only
// reads the selected historical month from cloud when the user asks for it.
function buildDailyTotals(month){
  const totals=new Map();
  dedupeRows(rows).forEach(row=>{
    const iso=displayToISO(row&&row.date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||iso.slice(0,7)!==month)return;
    const amount=Number(row.amount||0);
    if(!Number.isFinite(amount)||amount===0)return;
    totals.set(iso,(totals.get(iso)||0)+amount);
  });
  return [...totals.entries()]
    .map(([date,total])=>({date,total}))
    .filter(item=>Math.abs(item.total)>0.000001)
    .sort((a,b)=>b.date.localeCompare(a.date));
}
function renderDailyTotals(){
  const picker=document.getElementById("dailyTotalsMonth");
  const listEl=document.getElementById("dailyTotalsList");
  const grandTotalEl=document.getElementById("dailyTotalsMonthGrandTotal");
  if(!picker||!listEl)return;
  const month=/^\d{4}-\d{2}$/.test(picker.value)?picker.value:selectedMonth();
  const list=buildDailyTotals(month);
  const monthGrandTotal=list.reduce((sum,item)=>sum+Number(item.total||0),0);
  if(grandTotalEl)grandTotalEl.textContent=`RM${money(monthGrandTotal)}`;
  listEl.innerHTML=list.length
    ?list.map(item=>`<div class="daily-total-row"><span class="daily-total-date">${isoToDisplay(item.date)}</span><span class="daily-total-amount">RM${money(item.total)}</span></div>`).join("")
    :'<div class="daily-total-empty">这个月份还没有营业额记录</div>';
}
async function loadDailyTotalsMonth(month){
  const status=document.getElementById("dailyTotalsStatus");
  renderDailyTotals();

  // V29.9: current month already follows the normal Home sync flow.
  // Do not make a second cloud request just because the daily summary is opened.
  // This keeps startup / Home sync speed unchanged.
  const currentMonth=selectedMonth();
  if(month===currentMonth){
    if(status)status.textContent="";
    return;
  }

  // Historical months are fetched only when the user explicitly selects them.
  if(typeof loadMonthCloudShared!=="function"||typeof mergeCloudMonthRows!=="function"){
    if(status)status.textContent="";
    return;
  }

  if(status)status.textContent="正在读取 "+month.slice(5,7)+"-"+month.slice(0,4)+" 云端资料...";
  const started=Date.now();
  try{
    const json=await loadMonthCloudShared(month,15000);
    if(!json||!json.ok)throw new Error((json&&json.message)||"读取失败");
    if(typeof loadPendingRows==="function")loadPendingRows();
    mergeCloudMonthRows(month,json.rows||[],started);
    if(json.dataRevision&&typeof applyLocalDataRevision==="function")applyLocalDataRevision(json.dataRevision);
    if(typeof saveLocalDataCache==="function")saveLocalDataCache(json.commissionSettings||null,json.accessSettings||null);
    renderDailyTotals();
    if(status)status.textContent="已载入";
  }catch(e){
    // Keep the already rendered local data. Do not show a cloud-error warning,
    // and do not add retries that could slow down the main sync path.
    if(status)status.textContent="";
    console.warn("Daily totals historical month cloud read skipped:",e);
  }
}
async function toggleDailyTotals(force){
  const card=document.getElementById("dailyTotalsCard");
  const btn=document.getElementById("dailyTotalsBtn");
  const picker=document.getElementById("dailyTotalsMonth");
  if(!card||!picker)return;
  const show=typeof force==="boolean"?force:card.classList.contains("hidden");
  card.classList.toggle("hidden",!show);
  if(btn)btn.classList.toggle("active",show);
  if(!show)return;
  if(!/^\d{4}-\d{2}$/.test(picker.value))picker.value=selectedMonth();
  renderDailyTotals();
  setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"nearest"}),30);
  await loadDailyTotalsMonth(picker.value);
}

function renderMonthlySummary(){
  const body=document.getElementById("monthlySummaryBody");
  if(!body)return;
  const list=buildMonthlySummary();
  if(!list.length){body.innerHTML='<div class="summary-empty">还没有月份资料</div>';return;}
  const current=selectedMonth();
  const sorted=[...list].sort((a,b)=>b.month.localeCompare(a.month));
  const monthLabel=m=>m.slice(5,7)+"-"+m.slice(0,4);
  const value=(item,key)=>`RM${money(item[key]||0)}`;
  const head=sorted.map(item=>`<button type="button" class="monthly-month-head${item.month===current?" active":""}" onclick="selectSummaryMonth('${item.month}')">${monthLabel(item.month)}</button>`).join("");
  const row=(label,key)=>`<div class="monthly-grid-label${key==="total"?" monthly-total-cell":""}">${label}</div>${sorted.map(item=>`<div class="monthly-grid-value${key==="total"?" monthly-total-cell":""}">${value(item,key)}</div>`).join("")}`;
  body.style.setProperty("--month-count",String(sorted.length));
  body.innerHTML=`<div class="monthly-grid-head-label">月份</div>${head}${row("Balakong","balakong")}${row("Belimbing","belimbing")}${row("Fair","fair")}${row("Live","live")}${row("总数","total")}`;
}
async function toggleMonthlySummary(force){
  const card=document.getElementById("monthlySummaryCard");
  const btn=document.getElementById("monthlySummaryBtn");
  if(!card)return;

  const show=typeof force==="boolean"
    ?force
    :card.classList.contains("hidden");

  card.classList.toggle("hidden",!show);
  if(btn)btn.classList.toggle("active",show);
  if(!show)return;

  // V29.9: show cache immediately and complete historical months in background.
  renderMonthlySummary();
  setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"start"}),50);

  const year=String(document.getElementById("yearPicker")?.value||selectedYear()||"");
  if(typeof loadYearInBackground==="function"&&/^\d{4}$/.test(year)){
    if(btn)btn.disabled=true;
    try{
      const result=await loadYearInBackground(year);
      if(result&&result.ok)renderMonthlySummary();
    }finally{
      if(btn)btn.disabled=false;
    }
  }
}
function selectSummaryMonth(month){
  if(!/^\d{4}-\d{2}$/.test(month))return;
  document.getElementById("monthPicker").value=month;
  document.getElementById("yearPicker").value=month.slice(0,4);
  saveActiveMonth(month);
  renderAll();
  updateReadOnlyMode();
  window.scrollTo({top:0,behavior:"smooth"});
}

function xlsxXmlEscapeV196(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
function xlsxColNameV196(n){let s="";for(let x=n+1;x>0;x=Math.floor((x-1)/26))s=String.fromCharCode(65+(x-1)%26)+s;return s}
function crc32V196(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function u16V196(n){return new Uint8Array([n&255,(n>>>8)&255])}
function u32V196(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
function joinBytesV196(parts){const len=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(len);let o=0;parts.forEach(b=>{out.set(b,o);o+=b.length});return out}
function zipStoreV196(files){const te=new TextEncoder(),locals=[],centrals=[];let offset=0;for(const f of files){const name=te.encode(f.name),data=typeof f.data==="string"?te.encode(f.data):f.data,crc=crc32V196(data);const local=joinBytesV196([u32V196(0x04034b50),u16V196(20),u16V196(0),u16V196(0),u16V196(0),u16V196(0),u32V196(crc),u32V196(data.length),u32V196(data.length),u16V196(name.length),u16V196(0),name,data]);locals.push(local);centrals.push(joinBytesV196([u32V196(0x02014b50),u16V196(20),u16V196(20),u16V196(0),u16V196(0),u16V196(0),u16V196(0),u32V196(crc),u32V196(data.length),u32V196(data.length),u16V196(name.length),u16V196(0),u16V196(0),u16V196(0),u16V196(0),u32V196(0),u32V196(offset),name]));offset+=local.length}const central=joinBytesV196(centrals),body=joinBytesV196(locals);const end=joinBytesV196([u32V196(0x06054b50),u16V196(0),u16V196(0),u16V196(files.length),u16V196(files.length),u32V196(central.length),u32V196(body.length),u16V196(0)]);return joinBytesV196([body,central,end])}
function exportCSV(scope="month"){
  const selected=sortReportRows(dedupeRows(rows).filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0));
  const fairTotal=selected.filter(r=>r.type==="fair").reduce((sum,r)=>sum+Number(r.amount||0),0);
  const table=[["公司","日期","类别","地点/主播","营业额","佣金%","佣金金额"]];
  selected.forEach(r=>{const rate=r.type==="live"?getLiveHostRate(r.location,r.date):r.type==="fair"?getFairCommissionRate(fairTotal)*100:0;const commission=(r.type==="live"||r.type==="fair")?Number(r.amount||0)*rate/100:0;table.push([r.type==="live"?"Live":(companyNames[r.company]||r.company),r.date,r.type==="fair"?"Fair":r.type==="live"?"Live":"每日",r.location||"",Number(r.amount||0),rate?Number(rate.toFixed(2)):null,rate?Number(commission.toFixed(2)):null])});
  const widths=table[0].map((_,c)=>Math.min(40,Math.max(10,...table.map(row=>String(row[c]??"").length+2))));
  const cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("");
  const rowsXml=table.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{const ref=xlsxColNameV196(ci)+(ri+1);if(ri===0)return `<c r="${ref}" t="inlineStr" s="1"><is><t>${xlsxXmlEscapeV196(v)}</t></is></c>`;if((ci===4||ci===6)&&v!==null)return `<c r="${ref}" s="2"><v>${Number(v).toFixed(2)}</v></c>`;if(ci===5&&v!==null)return `<c r="${ref}" s="3"><v>${Number(v).toFixed(2)}</v></c>`;return `<c r="${ref}" t="inlineStr"><is><t>${xlsxXmlEscapeV196(v??"")}</t></is></c>`}).join("")}</row>`).join("");
  const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rowsXml}</sheetData></worksheet>`;
  const files=[
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/styles.xml",data:`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`},
    {name:"xl/worksheets/sheet1.xml",data:sheetXml}
  ];
  const blob=new Blob([zipStoreV196(files)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
}

bindDateControl("liveScheduleStart");
bindDateControl("liveScheduleEnd");

/* ================= V29.9 pre-change sales-card context guard ================= */
function salesCardGuardTypeV273(el){
  const id=String(el?.id||"");
  if(id==="saleDate"||id==="company")return "daily";
  if(id==="liveDate"||id==="liveHost")return "live";
  if(id==="fairProductDate"||id==="fairLocation"||id==="fairStart"||id==="fairEnd")return "fair";
  return "";
}
function salesCardContextValueV273(el){return String(el?.value??"");}
function restoreGuardedContextV273(el,oldValue){
  if(!el)return;
  el.value=String(oldValue??"");
  if(el.id==="saleDate"||el.id==="liveDate"||el.id==="fairStart"||el.id==="fairEnd"){
    const display=document.getElementById(el.id+"Display");
    if(display)display.value=isoToDisplay(el.value);
  }
}
function installSalesCardContextGuardsV273(){
  const ids=["saleDate","company","liveDate","liveHost","fairProductDate","fairLocation","fairStart","fairEnd"];
  ids.forEach(id=>{
    const el=document.getElementById(id);if(!el||el.dataset.guardV273==="1")return;
    el.dataset.guardV273="1";
    el.dataset.acceptedContextV273=salesCardContextValueV273(el);
    const snapshot=()=>{if(!hasUnsavedSalesCardChangesV238(salesCardGuardTypeV273(el)))el.dataset.acceptedContextV273=salesCardContextValueV273(el)};
    el.addEventListener("focus",snapshot,true);
    el.addEventListener("pointerdown",snapshot,true);
    el.addEventListener("change",event=>{
      const type=salesCardGuardTypeV273(el);if(!type)return;
      const next=salesCardContextValueV273(el),prev=String(el.dataset.acceptedContextV273??"");
      if(next===prev)return;
      if(hasUnsavedSalesCardChangesV238(type)){
        const ok=confirm("销售卡尚未保存，确定离开？\\n\\n点击“确定”将放弃未保存的销售卡修改。");
        if(!ok){
          event.preventDefault();event.stopImmediatePropagation();
          restoreGuardedContextV273(el,prev);
          return false;
        }
        discardUnsavedSalesCardChangesV238(type);
      }
      el.dataset.acceptedContextV273=next;
    },true);
  });
}
installSalesCardContextGuardsV273();

/* Live controls */
if(document.getElementById("liveDate")){
  setDateControl("liveDate",todayISO());
  bindDateControl("liveDate",updateLiveInputFromSelectedDate);
  document.getElementById("liveDate").addEventListener("change",()=>refreshProductLinkContextV210("live"));
}
if(document.getElementById("liveHost")){
  document.getElementById("liveHost").addEventListener("input",updateLiveInputFromSelectedDate);
  document.getElementById("liveHost").addEventListener("change",()=>refreshProductLinkContextV210("live"));
  document.getElementById("liveHost").addEventListener("blur",()=>{
    const input=document.getElementById("liveHost");
    const host=selectedLiveHost();
    input.value=host;
    if(host)saveLiveHost(host);
    updateLiveInputFromSelectedDate();
    refreshProductLinkContextV210("live");
  });
}

installLiveTurnoverDraftGuardV332();
restoreLastLiveSession();

["commissionRate1","commissionRate2","commissionRate3"].forEach(id=>{
  const el=document.getElementById(id);
  if(el)el.addEventListener("input",markFairCommissionDraftDirty);
});
window.addEventListener("beforeunload",event=>{
  const unsavedCards=hasUnsavedSalesCardChangesV238("daily")||hasUnsavedSalesCardChangesV238("live")||hasUnsavedSalesCardChangesV238("fair");
  if(!(fairCommissionDraftDirty||liveCommissionDraftDirty||restoreLeaveProtectionActiveV409()||unsavedCards||anyTurnoverLeaveRiskV382()||SALES_CONFIRMATION_IN_FLIGHT_V407))return;
  event.preventDefault();
  event.returnValue="";
});

// V7.1: Fair and Live commission settings are saved and reset independently.
function readFairCommissionInputs(){
  const rate1=Number(document.getElementById("commissionRate1").value);
  const rate2=Number(document.getElementById("commissionRate2").value);
  const rate3=Number(document.getElementById("commissionRate3").value);
  if(![rate1,rate2,rate3].every(v=>Number.isFinite(v)&&v>=0)){
    throw new Error("请输入正确的 Fair 佣金百分比");
  }
  return {rate1,rate2,rate3};
}

function readLiveCommissionInputs(){
  const liveHostRates={};
  const liveHosts={};
  collectLiveHosts().forEach(name=>{const key=normalizeLiveHostKey(name);if(key)liveHosts[key]=canonicalLiveHost(name)});
  document.querySelectorAll("[data-live-host-key]").forEach(input=>{
    const key=String(input.dataset.liveHostKey||"");
    const rate=Number(input.value);
    if(key&&Number.isFinite(rate)&&rate>=0)liveHostRates[key]=rate;
  });
  const liveRateSchedules=validateLiveRateSchedules(
    (getCommissionSettings().liveRateSchedules||[]).map(item=>({...item}))
  );
  return {liveHostRates,liveHosts,liveRateSchedules};
}

async function saveFairCommissionSettings(){
  const button=document.getElementById("saveFairCommissionBtn");
  const message=document.getElementById("fairCommissionSettingsMsg");
  try{
    const previous=getCommissionSettings();
    const fair=readFairCommissionInputs();
    const candidate=normalizeCommissionSettings({...previous,...fair});
    const unchanged=Number(previous.rate1)===Number(candidate.rate1)&&Number(previous.rate2)===Number(candidate.rate2)&&Number(previous.rate3)===Number(candidate.rate3);
    if(unchanged&&!fairCommissionDraftDirty){
      setSavedCommissionSnapshots(previous,{fair:true,live:false});
      updateFairCommissionDraftState();
      if(message){message.textContent="没有需要储存的更改";message.classList.remove("hidden");}
      return;
    }

    const settings=normalizeCommissionSettings({
      ...candidate,
      fairRevision:nextFairCommissionRevision(previous.fairRevision)
    });

    // V29.9: save locally immediately. Do not make the user wait for Apps Script.
    applyCommissionSettings(settings);
    setSavedCommissionSnapshots(settings,{fair:true,live:false});
    updateFairCommissionDraftState();
    if((systemState.closedMonths||[]).includes(selectedMonth())){
      systemState.commissionSnapshots={...(systemState.commissionSnapshots||{}),[selectedMonth()]:settings};
    }
    saveLocalDataCache(settings);
    renderDashboard();
    renderTable();

    if(button){button.disabled=false;button.textContent="💾 储存 Fair 佣金";}
    if(message){message.textContent="本机已储存，云端同步中…";message.classList.remove("hidden");}
    setSync("Fair 佣金本机已更新，云端同步中...");

    saveFairCommissionSettingsToSheet(settings,selectedMonth())
      .then(saved=>{
        const confirmed=normalizeCommissionSettings(saved||settings);
        const local=getCommissionSettings();
        if(Number(confirmed.fairRevision||0)<Number(local.fairRevision||0))return;
        applyCommissionSettings(confirmed);
        if((systemState.closedMonths||[]).includes(selectedMonth())){
          systemState.commissionSnapshots={...(systemState.commissionSnapshots||{}),[selectedMonth()]:confirmed};
        }
        setSavedCommissionSnapshots(confirmed,{fair:true,live:false});
        updateFairCommissionDraftState();
        saveLocalDataCache(confirmed);
        renderDashboard();
        renderTable();
        if(message){message.textContent="✅ Fair 佣金已同步";message.classList.remove("hidden");}
        setSync("已同步",true);
      })
      .catch(error=>{
        console.warn("Fair commission cloud sync delayed",error);
        if(message){message.textContent="本机已储存，云端稍后重试";message.classList.remove("hidden");}
        fairCommissionDraftDirty=false;
        queueFairCommissionRetry(settings,selectedMonth());
        setSync("Fair 佣金云端稍后重试",false,true);
      });
  }catch(error){
    if(message){message.textContent=error.message||"Fair 佣金储存失败";message.classList.remove("hidden");}
    if(button){button.disabled=false;button.textContent="💾 储存 Fair 佣金";}
  }
}

async function saveLiveCommissionSettings(){
  const button=document.getElementById("saveLiveCommissionBtn");
  const message=document.getElementById("liveCommissionSettingsMsg");

  try{
    const previous=getCommissionSettings();
    const pendingStart=String(document.getElementById("liveScheduleStart")?.value||"");
    const pendingEnd=String(document.getElementById("liveScheduleEnd")?.value||"");
    const pendingRate=String(document.getElementById("liveScheduleRate")?.value||"").trim();
    if(pendingStart||pendingEnd||pendingRate){
      if(!submitLiveRateSchedule())return;
    }
    const live=readLiveCommissionInputs();
    const candidate=normalizeCommissionSettings({...previous,...live});
    const comparable=x=>JSON.stringify({liveHostRates:x.liveHostRates||{},liveHosts:x.liveHosts||{},inactiveLiveHosts:x.inactiveLiveHosts||{},liveRateSchedules:x.liveRateSchedules||[]});
    // V29.9: deleting the last special commission rule leaves candidate and
    // previous structurally identical because the delete was already applied
    // locally.  A dirty draft must still be written to cloud so [] overwrites
    // the old month snapshot instead of letting the deleted rule return.
    if(comparable(candidate)===comparable(previous) && !liveCommissionDraftDirty){
      setSavedCommissionSnapshots(previous,{fair:false,live:true});
      updateLiveCommissionDraftState();
      if(message){message.textContent="没有需要储存的更改";message.classList.remove("hidden");}
      return;
    }
    const settings=normalizeCommissionSettings({...candidate,liveRevision:nextLiveCommissionRevision(previous.liveRevision)});

    applyCommissionSettings(settings);
    setSavedCommissionSnapshots(settings,{fair:false,live:true});
    updateLiveCommissionDraftState();
    renderLiveHostCommissionSettings();
    renderLiveRateSchedules();
    renderDashboard();
    renderTable();
    renderLiveMonthlyList();
    renderLiveDailySummary();
    saveLocalDataCache(settings);

    if(button){
      button.disabled=false;
      button.textContent="💾 储存直播佣金制度";
    }
    if(message){
      message.textContent="本机已储存，云端同步中…";
      message.classList.remove("hidden");
    }
    setSync("Live 佣金本机已更新，云端同步中...");

    saveLiveCommissionSettingsToSheet(settings,commissionConfigMonth())
      .then(saved=>{
        const confirmed=normalizeCommissionSettings(saved||settings);
        const local=getCommissionSettings();
        if(Number(confirmed.liveRevision||0)<Number(local.liveRevision||0))return;
        applyCommissionSettings(confirmed);
        setSavedCommissionSnapshots(confirmed,{fair:false,live:true});
        updateLiveCommissionDraftState();
        saveLocalDataCache(confirmed);
        renderLiveHostCommissionSettings();
        renderLiveRateSchedules();
        renderDashboard();
        renderTable();
        renderLiveMonthlyList();
        if(message){
          message.textContent="✅ Live 佣金制度已同步";
          message.classList.remove("hidden");
        }
        setSync("已同步",true);
      })
      .catch(error=>{
        console.warn("Live commission cloud sync delayed",error);
        if(message){
          message.textContent="本机已储存，云端稍后重试";
          message.classList.remove("hidden");
        }
        liveCommissionDraftDirty=true;
        queueLiveCommissionRetry(settings,commissionConfigMonth());
        setSync("Live 佣金云端稍后重试",false,true);
      });
  }catch(error){
    if(message){
      message.textContent=error.message||"Live 佣金制度储存失败";
      message.classList.remove("hidden");
    }
    if(button){
      button.disabled=false;
      button.textContent="💾 储存直播佣金制度";
    }
  }
}

async function resetFairCommissionSettings(){
  if(!confirm("确定只恢复 Fair 默认佣金？\n\nRM50,000 以下：6%\nRM50,000 以上：7%\nRM100,000 以上：8%\n\nLive 与各主播佣金不会改变。"))return;

  const previous=getCommissionSettings();
  const settings=normalizeCommissionSettings({
    ...previous,
    rate1:6,rate2:7,rate3:8,
    fairRevision:nextFairCommissionRevision(previous.fairRevision)
  });

  applyCommissionSettings(settings);
  setSavedCommissionSnapshots(settings,{fair:true,live:false});
  updateFairCommissionDraftState();
  if((systemState.closedMonths||[]).includes(selectedMonth())){
    systemState.commissionSnapshots={...(systemState.commissionSnapshots||{}),[selectedMonth()]:settings};
  }
  saveLocalDataCache(settings);
  loadCommissionSettingsForm();
  renderDashboard();
  renderTable();
  setSync("Fair 默认佣金本机已更新，云端同步中...");
  alert("Fair 佣金已恢复默认。本机已生效，云端正在后台同步。");

  saveFairCommissionSettingsToSheet(settings,selectedMonth())
    .then(saved=>{
      const confirmed=normalizeCommissionSettings(saved||settings);
      const local=getCommissionSettings();
      if(Number(confirmed.fairRevision||0)<Number(local.fairRevision||0))return;
      applyCommissionSettings(confirmed);
      setSavedCommissionSnapshots(confirmed,{fair:true,live:false});
      updateFairCommissionDraftState();
      saveLocalDataCache(confirmed);
      loadCommissionSettingsForm();
      renderDashboard();
      renderTable();
      setSync("已同步",true);
    })
    .catch(error=>{
      console.warn("Fair reset cloud sync delayed",error);
      queueFairCommissionRetry(settings,selectedMonth());
      setSync("Fair 默认佣金云端稍后重试",false,true);
    });
}



/* ================= V29.9 Reliable Backup / Restore ================= */
const BACKUP_RESTORE_STATE_KEY_V234="lover_backup_restore_status_v234";
let backupRestoreOperationRunningV234=false;
let remoteRestoreMaintenanceActiveV345=false;

function renderRemoteRestoreMaintenanceV345(active,message=""){
  // V42.3: the device that started/resumed this Restore stays on its More
  // status panel. Only other devices use the full-screen maintenance overlay.
  remoteRestoreMaintenanceActiveV345=Boolean(active)&&!restoreLeaveProtectionActiveV409();
  let overlay=document.getElementById("restoreMaintenanceOverlayV345");
  if(!remoteRestoreMaintenanceActiveV345){if(overlay)overlay.remove();return}
  if(!overlay){
    overlay=document.createElement("div");overlay.id="restoreMaintenanceOverlayV345";
    overlay.style.cssText="position:fixed;inset:0;z-index:100000;background:rgba(243,246,241,.96);display:flex;align-items:center;justify-content:center;padding:24px;text-align:center";
    document.body.appendChild(overlay);
  }
  overlay.innerHTML=`<div style="max-width:560px;background:#fff;border:2px solid #d6a51f;border-radius:22px;padding:28px;box-shadow:0 12px 40px rgba(0,0,0,.15)"><div style="font-size:42px">♻️</div><h2 style="margin:10px 0;color:#8a5a00">Sales 系统正在 Restore</h2><p style="font-size:18px;line-height:1.6;margin:0">${escapeChangeLogHtmlV200(message||"系统有 Restore 任务正在进行。")}</p><p style="font-size:16px;color:#666;margin:12px 0 0">为避免覆盖恢复中的资料，本设备暂时不能保存、同步或确认销售。Restore 完成后页面会自动恢复。</p></div>`;
}
async function checkRemoteRestoreMaintenanceV345(){
  if(restoreLeaveProtectionActiveV409()){renderRemoteRestoreMaintenanceV345(false);forceRestorePageV410();return}
  try{
    const status=await jsonp({action:"maintenanceStatusV345"},{timeoutMs:7000});
    if(status&&status.restoreGeneration!==undefined&&typeof applyRestoreGenerationV347==='function')applyRestoreGenerationV347(status.restoreGeneration);
    renderRemoteRestoreMaintenanceV345(Boolean(status&&status.active),status&&status.message);
  }catch(_){}
}

function getBackupRestoreStateV234(){
  try{return JSON.parse(localStorage.getItem(BACKUP_RESTORE_STATE_KEY_V234)||"null")}catch(e){return null}
}
function setBackupRestoreStateV234(state){
  const value={...(state||{}),updatedAt:new Date().toISOString()};
  localStorage.setItem(BACKUP_RESTORE_STATE_KEY_V234,JSON.stringify(value));
  renderBackupRestoreStatusV234(value);
  return value;
}
function clearBackupRestoreStateV234(){
  localStorage.removeItem(BACKUP_RESTORE_STATE_KEY_V234);
  renderBackupRestoreStatusV234(null);
}

// V42.3: the persisted Restore job remains authoritative through the final
// verification stage. The in-memory flag can briefly be false while polling,
// so navigation/refresh protection must also inspect this durable state.
function restoreLeaveProtectionActiveV409(){
  const state=getBackupRestoreStateV234();
  return Boolean(backupRestoreOperationRunningV234||(state&&state.type==='restore'&&state.status==='running'));
}
function confirmRestorePageSwitchV409(){
  if(!restoreLeaveProtectionActiveV409())return true;
  window.alert('Restore 正在进行，暂时不能切换到其他页面。\n\n请留在 More / Restore 页面，等待显示「Restore 完成」。');
  forceRestorePageV410();
  return false;
}
window.restoreLeaveProtectionActiveV409=restoreLeaveProtectionActiveV409;
window.confirmRestorePageSwitchV409=confirmRestorePageSwitchV409;

function forceRestorePageV410(){
  if(!restoreLeaveProtectionActiveV409())return;
  document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id==='page-more'));
  document.querySelectorAll('.nav-item').forEach(nav=>nav.classList.toggle('active',String(nav.dataset?.page||'')==='more'));
  try{localStorage.setItem(LAST_PAGE_KEY_V238,'more')}catch(_){}
}
window.forceRestorePageV410=forceRestorePageV410;

function renderBackupRestoreStatusV234(state=getBackupRestoreStateV234()){
  if(state&&state.type==='restore'&&state.status==='running')forceRestorePageV410();
  const box=document.getElementById("backupRestoreStatusV234");
  if(!box)return;
  if(!state){box.className="backup-restore-status-v234 hidden";box.innerHTML="";return}
  const type=state.type==="restore"?"Restore":"Backup";
  const status=state.status||"running";
  const title=status==="running"?`⚠ ${type} 进行中 — 请勿关闭或刷新页面`:status==="success"?`✅ ${type} 成功`:`❌ ${type} 失败`;
  const detail=String(state.message||"");
  const time=state.updatedAt?new Date(state.updatedAt).toLocaleString():"";
  box.className=`backup-restore-status-v234 ${status}`;
  box.innerHTML=`<div class="br-title">${title}</div><div class="br-detail">${escapeChangeLogHtmlV200(detail)}</div><div class="br-time">${escapeChangeLogHtmlV200(time)}</div>`;
}
function getBackupPayload(){
  return{
    system:"Lover Legend Sales System",
    version:"5180",
    createdAt:new Date().toISOString(),
    rows:dedupeRows(rows),
    commissionSettings:getCommissionSettings(),
    accessSettings:typeof getAccessPasswordSettings==="function"?getAccessPasswordSettings():null,
    closedMonths:sanitizeClosedMonthsClientV197(systemState.closedMonths,systemState.currentMonth),
    commissionSnapshots:{...(systemState.commissionSnapshots||{})},
    currentMonth:systemState.currentMonth,
    fairLocations:getSavedFairLocations(),
    liveHosts:typeof getSavedLiveHosts==="function"?getSavedLiveHosts():[]
  };
}
async function backupAllData(){
  if(backupRestoreOperationRunningV234||restoreLeaveProtectionActiveV409()){alert("Backup / Restore 正在进行中，请等待完成。");return}
  backupRestoreOperationRunningV234=true;
  setBackupRestoreStateV234({type:"backup",status:"running",message:"正在读取完整营业资料及销售卡，请勿关闭或刷新页面。"});
  setSync("Backup 进行中，请勿关闭页面...");
  try{
    const payload=getBackupPayload();
    // Prefer a recent complete cache; first Backup without cache still reads cloud truth.
    setBackupRestoreStateV234({type:"backup",status:"running",message:"正在读取销售卡资料..."});
    payload.productLinks=await loadAllSalesProductLinksV203({force:false,maxAgeMs:120000});
    setBackupRestoreStateV234({type:"backup",status:"running",message:"正在读取新增 / 修改历史..."});
    payload.salesChangeLogs=await loadAllSalesChangeLogsV236();
    setBackupRestoreStateV234({type:'backup',status:'running',message:'正在读取 Fair / Live 营业额明细...'});
    payload.turnoverEntries=typeof loadAllTurnoverEntriesV376==='function'?await loadAllTurnoverEntriesV376():[];
    payload.fairSessions=await refreshFairSessionsV281({applyLatest:false});
    payload.backupIncludes={sales:true,fair:true,live:true,commission:true,closedMonths:true,commissionSnapshots:true,productLinks:true,salesChangeLogs:true,fairSessions:true,profitData:true,remarks:true,averageCost:true,minimumPrice:true,deliveryAndExtraFees:true,turnoverEntries:true};
    setBackupRestoreStateV234({type:"backup",status:"running",message:"正在生成 Backup 文件..."});
    const stamp=new Date().toISOString().replace(/[:T]/g,"-").slice(0,19);
    downloadFile(`Lover_Legend_Sales_V37_6_Backup_${stamp}.json`,JSON.stringify(payload,null,2),"application/json;charset=utf-8");
    setBackupRestoreStateV234({type:"backup",status:"success",message:`Backup 完成：营业记录 ${payload.rows.length} 笔，销售卡 ${payload.productLinks.length} 笔，新增/修改历史 ${payload.salesChangeLogs.length} 笔。`});
    setSystemStoredAtV442(SYSTEM_BACKUP_AT_KEY_V442);
    setSync("Backup 已完成",true);
    alert(`Backup 成功。\n\n营业记录：${payload.rows.length} 笔\n销售卡：${payload.productLinks.length} 笔\n新增/修改历史：${payload.salesChangeLogs.length} 笔\n\nBackup 文件已经生成。`);
  }catch(e){
    console.error("Backup failed",e);
    setBackupRestoreStateV234({type:"backup",status:"failed",message:e&&e.message?e.message:String(e)});
    setSync("Backup 失败",false,true);
    alert("Backup 失败：\n\n"+(e&&e.message?e.message:e));
  }finally{
    backupRestoreOperationRunningV234=false;
  }
}
async function finishRestoreClientV234(payload){
  if(typeof clearStaleRestoreQueuesV347==='function')clearStaleRestoreQueuesV347();
  localStorage.setItem("lover_fair_locations",JSON.stringify(payload.fairLocations||[]));
  if(payload.liveHosts)localStorage.setItem("lover_live_hosts",JSON.stringify(payload.liveHosts));
  fairCommissionDraftDirty=false;
  liveCommissionDraftDirty=false;
  localStorage.setItem("lover_commission_settings_cache",JSON.stringify(payload.commissionSettings));
  applyCommissionSettings(payload.commissionSettings);
  setSavedCommissionSnapshots(payload.commissionSettings);
  await loadFromSheet({force:true});
  loadCommissionSettingsForm();
  renderLiveHostCommissionSettings();
  document.getElementById("monthPicker").value=monthISO();
  document.getElementById("yearPicker").value=monthISO().slice(0,4);
  renderAll();updateReadOnlyMode();
}
async function restoreBackupFile(file){
  if(backupRestoreOperationRunningV234||restoreLeaveProtectionActiveV409()){alert("Backup / Restore 正在进行中，请等待完成。");return}
  let payload;
  try{payload=JSON.parse(await file.text())}catch(e){alert("Backup 文件无法读取或不是有效 JSON。");return}
  if(!payload||!Array.isArray(payload.rows)||!payload.commissionSettings){alert("这不是有效的 Lover Legend Sales Backup。");return}
  payload.closedMonths=sanitizeClosedMonthsClientV197(payload.closedMonths,payload.currentMonth||monthISO());
  const ok=confirm(`准备 Restore 完整备份。\n\n备份版本：${payload.version||"未知"}\n备份时间：${payload.createdAt||"未知"}\n营业记录：${payload.rows.length} 笔\n销售卡：${Array.isArray(payload.productLinks)?payload.productLinks.length:0} 笔\n新增/修改历史：${Array.isArray(payload.salesChangeLogs)?payload.salesChangeLogs.length:"旧版 Backup（将重建基准）"}\n\nRestore 进行中会显示状态，请勿关闭或刷新页面。\n恢复将覆盖 Google Sheet 现有营业资料与销售卡。\n\n确定继续？`);
  if(!ok)return;

  backupRestoreOperationRunningV234=true;
  const current=getCommissionSettings();
  payload={...payload};
  payload.commissionSettings=normalizeCommissionSettings({
    ...payload.commissionSettings,
    fairRevision:nextFairCommissionRevision(Math.max(Number(current.fairRevision||0),Number(payload.commissionSettings.fairRevision||0))),
    liveRevision:nextLiveCommissionRevision(Math.max(Number(current.liveRevision||0),Number(payload.commissionSettings.liveRevision||0)))
  });
  try{
    setBackupRestoreStateV234({type:"restore",status:"running",message:"Restore 正在准备，请勿关闭或刷新页面。"});
    setSync("Restore 进行中，请勿关闭页面...");
    const result=await restoreBackupToSheet(payload,info=>{
      const jobId=String(info.jobId||"");
      setBackupRestoreStateV234({
        type:"restore",status:"running",jobId,
        restoreId:info.restoreId||"",
        message:info.message||"Restore 进行中..."
      });
    });
    await finishRestoreClientV234(payload);
    setBackupRestoreStateV234({type:"restore",status:"success",jobId:result.jobId||"",message:`Restore 完成并已验证。营业记录 ${payload.rows.length} 笔，销售卡 ${Array.isArray(payload.productLinks)?payload.productLinks.length:0} 笔，新增/修改历史已同步。`});
    setSystemStoredAtV442(SYSTEM_RESTORE_AT_KEY_V442);
    setSync("Restore 已完成",true);
    alert("Restore 成功。\n\nGoogle Sheet、销售卡及系统设置已经恢复并重新载入。");
  }catch(e){
    const state=getBackupRestoreStateV234()||{};
    // A transient frontend timeout does not overwrite an active server job as failed.
    let serverState=null;
    if(state.jobId){
      try{serverState=await getRestoreJobStatusV234(state.jobId)}catch(_){}
    }
    if(serverState&&serverState.ok&&serverState.state==="running"){
      setBackupRestoreStateV234({type:"restore",status:"running",jobId:state.jobId,message:serverState.message||"Restore 后端仍在进行中。重新打开系统会继续显示状态。"});
      alert("Restore 前端连接暂时中断，但后端仍在进行中。\n\n请不要重复 Restore。重新打开系统后会继续显示 Restore 状态。");
    }else{
      const msg=(serverState&&serverState.error)||e.message||String(e);
      backupRestoreOperationRunningV234=false;
      setBackupRestoreStateV234({type:"restore",status:"failed",jobId:state.jobId||"",message:msg});
      setSync("Restore 失败",false,true);
      alert("Restore 失败：\n\n"+msg);
    }
  }finally{
    backupRestoreOperationRunningV234=false;
  }
}
async function resumeRestoreStatusV234(){
  const state=getBackupRestoreStateV234();
  renderBackupRestoreStatusV234(state);
  if(!state||state.type!=="restore"||state.status!=="running"||!state.jobId)return;
  try{
    const status=await getRestoreJobStatusV234(state.jobId);
    if(!status||!status.ok)return;
    if(status.state==="success"){
      setBackupRestoreStateV234({type:"restore",status:"success",jobId:state.jobId,message:status.message||"Restore 已完成。请刷新资料确认。"});
      alert("上一次 Restore 已成功完成。");
      return;
    }
    if(status.state==="failed"){
      backupRestoreOperationRunningV234=false;
      setBackupRestoreStateV234({type:"restore",status:"failed",jobId:state.jobId,message:status.error||status.message||"Restore 失败"});
      setSync("Restore 失败",false,true);
      alert("上一次 Restore 失败："+(status.error||status.message||"未知错误"));
      return;
    }
    // Persisted running job: continue one small step at a time in background.
    backupRestoreOperationRunningV234=true;
    setBackupRestoreStateV234({type:"restore",status:"running",jobId:state.jobId,message:status.message||"Restore 仍在进行中..."});
    for(let i=0;i<200;i++){
      let st=await getRestoreJobStatusV234(state.jobId);
      if(st.state==="success"){
        setBackupRestoreStateV234({type:"restore",status:"success",jobId:state.jobId,message:st.message||"Restore 已完成。"});
        alert("Restore 已成功完成。");
        break;
      }
      if(st.state==="failed"){
        setBackupRestoreStateV234({type:"restore",status:"failed",jobId:state.jobId,message:st.error||st.message||"Restore 失败"});
        alert("Restore 失败："+(st.error||st.message||"未知错误"));
        break;
      }
      setBackupRestoreStateV234({type:"restore",status:"running",jobId:state.jobId,message:st.message||"Restore 进行中..."});
      try{await continueRestoreJobV234(state.jobId)}catch(_){}
      await new Promise(r=>setTimeout(r,1200));
    }
  }catch(e){
    console.warn("Restore resume status failed",e);
  }finally{
    backupRestoreOperationRunningV234=false;
  }
}
const restoreInput=document.getElementById("restoreFile");
if(restoreInput)restoreInput.addEventListener("change",async e=>{const file=e.target.files&&e.target.files[0];e.target.value="";if(file)await restoreBackupFile(file)});
setTimeout(async()=>{
  renderBackupRestoreStatusV234();
  const state=getBackupRestoreStateV234();
  if(state&&state.type==="restore"&&state.status==="running"&&state.jobId){
    try{
      const remote=await getRestoreJobStatusV234(state.jobId);
      if(remote&&remote.ok&&remote.state==="failed"){
        backupRestoreOperationRunningV234=false;
        setBackupRestoreStateV234({type:"restore",status:"failed",jobId:state.jobId,message:remote.error||remote.message||"Restore 失败"});
        setSync("Restore 失败",false,true);
        return;
      }
      if(remote&&remote.ok&&remote.state==="success"){
        backupRestoreOperationRunningV234=false;
        setBackupRestoreStateV234({type:"restore",status:"success",jobId:state.jobId,message:remote.message||"Restore 已完成。"});
        return;
      }
    }catch(_){}
  }
  resumeRestoreStatusV234();
},800);
setTimeout(checkRemoteRestoreMaintenanceV345,1200);
setInterval(checkRemoteRestoreMaintenanceV345,5000);

let lastObservedSystemMonth=monthISO();setInterval(()=>{const nowMonth=monthISO();if(nowMonth!==lastObservedSystemMonth){lastObservedSystemMonth=nowMonth;systemState.currentMonth=nowMonth;document.getElementById("monthPicker").value=nowMonth;document.getElementById("yearPicker").value=nowMonth.slice(0,4);renderAll();updateReadOnlyMode();loadFromSheet({force:true})}},60000);

/* ================= V29.9 Sales Card transaction integrity / instant cache ================= */
function salesCardHasUserDataV241(card){
  if(!card)return false;
  if(card.dataset.dirty==="1")return true;
  if(String(card.querySelector('.sales-card-remark-v239')?.value||'').trim())return true;
  return salesCardProductsV239(card).some(item=>String(item.querySelector('.product-link-name')?.value||'').trim()||salesCardProductTotalV240(item)>0);
}
function salesCardIsSavedV241(card){return !!card&&salesCardProductsV239(card).some(x=>x.dataset.saved==="1"&&String(x.dataset.linkId||''));}
function salesCardsOfficialAmountV241(type){
  const ctx=productLinkContextV206(type);
  return dedupeRows(rows).filter(r=>r.type===type&&r.date===ctx.date&&(type==="daily"?r.company===(String(ctx.location||'').toLowerCase().includes('balakong')?'balakong':'belimbing'):type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(ctx.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(ctx.location))).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
}
function salesCardsEnteredTotalV241(type){return salesCardWrappersV239(type).reduce((s,c)=>s+salesCardProductsV239(c).reduce((a,i)=>a+salesCardProductTotalV240(i),0),0);}
function addProductLinkItemV209(type,data={}){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+'ProductItems');if(!wrap)return false;
  // V46.0: New Sales Card is local-only and instant. If a first-time cloud
  // read is still showing, cancel its right to repaint this editor.
  if(wrap.querySelector('.product-link-loading-v231')){
    invalidateSalesCardLoadRequestsV351(type);
    wrap.innerHTML='';
  }
  const cards=salesCardWrappersV239(type),unsaved=cards.find(c=>!salesCardIsSavedV241(c));
  if(unsaved){alert('请先保存目前这张销售卡，才可以新增第二张销售卡。');unsaved.scrollIntoView({behavior:'smooth',block:'center'});return false;}
  const official=salesCardsOfficialAmountV241(type),used=salesCardsEnteredTotalV241(type);
  if(official>0&&used>=official-0.005){alert(`当天营业额 RM${formatAmount(official)} 已全部分配到销售卡，不能再新增销售卡。`);return false;}
  wrap.appendChild(buildSalesCardTransactionV239(type,[data||{}]));
  renumberSavedSalesCardsV241(type);
  return true;
}
function addProductLinkItemV206(type,data={}){return addProductLinkItemV209(type,data)}
window.addProductLinkItemV206=addProductLinkItemV206;window.addProductLinkItemV209=addProductLinkItemV209;

const _deleteSalesCardTransactionV240=deleteSalesCardTransactionV239;
deleteSalesCardTransactionV239=async function(type,txnId){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+'ProductItems');
  const card=[...(wrap?.querySelectorAll('.sales-card-transaction-v239')||[])].find(x=>x.dataset.transactionId===txnId);if(!card)return;
  if(!salesCardIsSavedV241(card)){
    if(salesCardHasUserDataV241(card)&&!confirm('这张销售卡尚未保存，确定删除？\n\n确认后，刚才输入的资料不会保存。'))return;
    card.remove();renumberSavedSalesCardsV241(type);setSync('未保存销售卡已删除',true);return;
  }
  return _deleteSalesCardTransactionV240(type,txnId);
};
window.deleteSalesCardTransactionV239=deleteSalesCardTransactionV239;

function renumberSavedSalesCardsV241(type){
  let n=0;salesCardWrappersV239(type).forEach(card=>{const title=card.querySelector('.sales-card-header-v239 b:first-child');if(!title)return;n++;title.textContent=(salesCardIsSavedV241(card)?'已保存销售卡 ':'销售卡 ')+n;});updateSalesCardsGrandTotalV427(type);
}
const _renderProductLinksEditorV240=renderProductLinksEditorV206;
renderProductLinksEditorV206=function(type,links){_renderProductLinksEditorV240(type,links);renumberSavedSalesCardsV241(type)};

const _buildSalesCardTransactionV240=buildSalesCardTransactionV239;
buildSalesCardTransactionV239=function(type,dataList=[]){const card=_buildSalesCardTransactionV240(type,dataList);setTimeout(()=>renumberSavedSalesCardsV241(type),0);return card};

const _saveProductLinksV240=saveProductLinksV206;

/* ================= V32.6 instant draft save + durable cloud retry =================
   Draft edits must never hold the user on “保存中…”.  The latest draft is written
   to persistent local cache first, the UI is released immediately, and the cloud
   write runs in the background.  Confirmation still waits for cloud so Import/FIFO
   never sees an older draft. */
// V32.6: Draft profit is real dashboard profit immediately after Save Draft.
// Draft/Confirmed are the same sale card for profit purposes; replace by transactionId
// so repeated saves and later confirmation can never double-count the same card.
function mergeProfitLinksByTransactionV321(existing,incoming,replaceTxnIds=[]){
  const fresh=(Array.isArray(incoming)?incoming:[]).filter(x=>!['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase()));
  const txns=new Set((Array.isArray(replaceTxnIds)?replaceTxnIds:[]).map(String).filter(Boolean));
  fresh.forEach(x=>{const id=String(x?.transactionId||'').trim();if(id)txns.add(id)});
  const linkIds=new Set(fresh.map(x=>String(x?.linkId||'').trim()).filter(Boolean));
  const kept=(Array.isArray(existing)?existing:[]).filter(x=>{
    if(['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase()))return false;
    const txn=String(x?.transactionId||'').trim(),link=String(x?.linkId||'').trim();
    return !(txn&&txns.has(txn))&&!(link&&linkIds.has(link));
  });
  return [...kept,...fresh];
}
function refreshProfitAggregateCachesV321(savedLinks,replaceTxnIds=[]){
  const incoming=Array.isArray(savedLinks)?savedLinks:[];
  if(typeof mergeAllSalesProductLinksCacheV321==='function')mergeAllSalesProductLinksCacheV321(incoming,replaceTxnIds);
  if(Array.isArray(monthGrandProfitLinksV295))monthGrandProfitLinksV295=mergeProfitLinksByTransactionV321(monthGrandProfitLinksV295,incoming,replaceTxnIds);
  if(Array.isArray(yearBreakdownLinksV286))yearBreakdownLinksV286=mergeProfitLinksByTransactionV321(yearBreakdownLinksV286,incoming,replaceTxnIds);
  // Repaint only panels the user already opened; this does not join foreground sync.
  if(monthGrandHistoryOpenV223)renderMonthGrandHistoryV223();
  if(Object.values(yearBreakdownOpenV224||{}).some(Boolean))renderAllYearBreakdownsV224();
}
window.refreshProfitAggregateCachesV321=refreshProfitAggregateCachesV321;

function purgeDeletedSalesLinkV348(linkId){
  const target=String(linkId||'').trim();if(!target)return;
  const pending=readSalesDraftPendingV314();let pendingChanged=false;
  Object.keys(pending).forEach(key=>{
    const entry=pending[key],before=Array.isArray(entry?.items)?entry.items:[];
    const after=before.filter(x=>String(x?.linkId||'').trim()!==target);
    if(after.length===before.length)return;
    pendingChanged=true;
    if(after.length)pending[key]={...entry,items:after,token:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),savedAt:Date.now()};
    else delete pending[key];
  });
  if(pendingChanged)writeSalesDraftPendingV314(pending);
  if(Array.isArray(monthGrandProfitLinksV295))monthGrandProfitLinksV295=monthGrandProfitLinksV295.filter(x=>String(x?.linkId||'').trim()!==target);
  if(Array.isArray(yearBreakdownLinksV286))yearBreakdownLinksV286=yearBreakdownLinksV286.filter(x=>String(x?.linkId||'').trim()!==target);
  if(typeof clearDailyProfitCacheV237==='function')clearDailyProfitCacheV237();
  if(typeof clearSalesCardPersistentCacheV232==='function')clearSalesCardPersistentCacheV232();
  if(monthGrandHistoryOpenV223)renderMonthGrandHistoryV223();
  if(Object.values(yearBreakdownOpenV224||{}).some(Boolean))renderAllYearBreakdownsV224();
}
window.purgeDeletedSalesLinkV348=purgeDeletedSalesLinkV348;

/* ================= V35.0 deleted-link tombstone guard =================
   A product deleted in the editor must stay deleted even if an older cloud read
   finishes before the Save Draft request. Tombstones are kept per exact context
   until the server acknowledges the delete. */
const SALES_DELETED_LINKS_KEY_V350='lover_sales_deleted_links_v350';
function readDeletedSalesLinksV350(){try{const x=JSON.parse(localStorage.getItem(SALES_DELETED_LINKS_KEY_V350)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return{}}}
function writeDeletedSalesLinksV350(obj){try{localStorage.setItem(SALES_DELETED_LINKS_KEY_V350,JSON.stringify(obj||{}));return true}catch(_){return false}}
function deletedSalesLinksKeyV350(type,date,location){return salesDraftPendingKeyV314(type,date,location)}
function getDeletedSalesLinkIdsV350(type,date,location){const all=readDeletedSalesLinksV350(),list=all[deletedSalesLinksKeyV350(type,date,location)];return Array.isArray(list)?[...new Set(list.map(String).filter(Boolean))]:[]}
function rememberDeletedSalesLinkV350(type,date,location,linkId){const id=String(linkId||'').trim();if(!id)return;const all=readDeletedSalesLinksV350(),key=deletedSalesLinksKeyV350(type,date,location),set=new Set(Array.isArray(all[key])?all[key].map(String):[]);set.add(id);all[key]=[...set];writeDeletedSalesLinksV350(all)}
function clearDeletedSalesLinkIdsV350(type,date,location,ids=[]){const remove=new Set((Array.isArray(ids)?ids:[]).map(String).filter(Boolean));if(!remove.size)return;const all=readDeletedSalesLinksV350(),key=deletedSalesLinksKeyV350(type,date,location),left=(Array.isArray(all[key])?all[key]:[]).map(String).filter(id=>!remove.has(id));if(left.length)all[key]=left;else delete all[key];writeDeletedSalesLinksV350(all)}
function filterDeletedSalesLinksV350(type,date,location,links){const dead=new Set(getDeletedSalesLinkIdsV350(type,date,location));return (Array.isArray(links)?links:[]).filter(x=>!dead.has(String(x?.linkId||'')))}
function acknowledgeDeletedSalesLinksV351(type,date,location,ids,authoritativeLinks){
  const dead=[...new Set((Array.isArray(ids)?ids:[]).map(x=>String(x||'').trim()).filter(Boolean))];
  if(!dead.length)return true;
  const stillThere=new Set((Array.isArray(authoritativeLinks)?authoritativeLinks:[]).map(x=>String(x?.linkId||'').trim()).filter(Boolean));
  if(dead.some(id=>stillThere.has(id)))return false;
  invalidateSalesCardLoadRequestsV351(type);
  clearDeletedSalesLinkIdsV350(type,date,location,dead);
  return true;
}
window.acknowledgeDeletedSalesLinksV351=acknowledgeDeletedSalesLinksV351;
window.getDeletedSalesLinkIdsV350=getDeletedSalesLinkIdsV350;
const SALES_DRAFT_PENDING_KEY_V314='lover_sales_draft_pending_v314';
const SALES_DRAFT_INFLIGHT_V314=new Map();
let SALES_DRAFT_RETRY_TIMER_V314=null;
function readSalesDraftPendingV314(){try{const x=JSON.parse(localStorage.getItem(SALES_DRAFT_PENDING_KEY_V314)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return{}}}
function writeSalesDraftPendingV314(obj){try{localStorage.setItem(SALES_DRAFT_PENDING_KEY_V314,JSON.stringify(obj||{}));return true}catch(_){return false}}
function salesDraftPendingKeyV314(type,date,location){return [String(type||''),String(date||''),String(location||'').trim().toLowerCase()].join('|')}
function queueSalesDraftV314(type,date,location,items,deletedLinkIdsV508=[]){
  const all=readSalesDraftPendingV314(),key=salesDraftPendingKeyV314(type,date,location),token=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),mutation=nextClientMutationV344();
  const basePriorityV452=typeof getPrioritySyncLocalV315==='function'?getPrioritySyncLocalV315():{};
  const deletedV508=[...new Set((Array.isArray(deletedLinkIdsV508)?deletedLinkIdsV508:[]).map(x=>String(x||'').trim()).filter(Boolean))];
  all[key]={type,date,location,items:Array.isArray(items)?items:[],deletedLinkIds:deletedV508,token,savedAt:Date.now(),baseSalesCardRevision:Object.prototype.hasOwnProperty.call(basePriorityV452||{},'salesCardRevision')?Number(basePriorityV452.salesCardRevision||0):null,restoreGeneration:typeof getLocalRestoreGenerationV347==='function'?getLocalRestoreGenerationV347():0,clientDeviceId:mutation.clientDeviceId,clientSequence:mutation.clientSequence};
  if(!writeSalesDraftPendingV314(all))throw new Error('无法写入本机草稿安全记录');
  const verify=readSalesDraftPendingV314()[key];
  if(!verify||verify.token!==token)throw new Error('本机草稿安全记录验证失败');
  return {key,token};
}
function removeSalesDraftPendingV314(key,token=''){
  const all=readSalesDraftPendingV314(),cur=all[key];
  if(!cur)return;
  if(token&&String(cur.token||'')!==String(token||''))return;
  delete all[key];writeSalesDraftPendingV314(all);
}
function markDraftSavedLocallyV314(type,ctx,dirty,items,dirtyIds){
  const old=(typeof getSalesCardPersistentCacheV232==='function'?getSalesCardPersistentCacheV232(type,ctx.date,ctx.location):[])||[];
  const oldByTxn=new Map();
  old.forEach(x=>{const tx=String(x.transactionId||'');if(!tx)return;if(!oldByTxn.has(tx))oldByTxn.set(tx,[]);oldByTxn.get(tx).push(x)});
  const cardByTxn=new Map(dirty.map(c=>[String(c.dataset.transactionId||''),c]));
  const local=items.map(x=>{
    const tx=String(x.transactionId||''),card=cardByTxn.get(tx),prev=oldByTxn.get(tx)||[];
    const activeDraft=!!card&&salesCardIsEditableDraftV509(card);
    const wasConfirmed=!activeDraft&&(salesCardIsConfirmedV322(card)||prev.some(r=>r.confirmedOnce===true||salesCardStatusIsConfirmedV322(r.importSyncStatus)));
    if(wasConfirmed&&card)card.dataset.confirmedOnceV401='1';
    else if(activeDraft&&card)card.dataset.confirmedOnceV401='0';
    const prior=prev.find(r=>String(r.linkId||'')&&String(r.linkId||'')===String(x.linkId||''));
    let status='DRAFT';
    if(wasConfirmed){
      // V42.3: preserve each already-confirmed row, but a NEW product added to an
      // already-confirmed card is immediately shown as pending Import inventory.
      // This prevents the whole card from visually falling back to "尚未确认销售".
      if(!prior)status='PENDING_IMPORT_LINK';
      else{
        const oldStatus=String(prior.importSyncStatus||'');
        const sameProduct=String(prior.productId||'')===String(x.productId||'')&&String(prior.productName||'')===String(x.productName||'');
        const qtyChanged=Number(prior.quantity||0)!==Number(x.quantity||0);
        if(oldStatus==='NON_INVENTORY'&&!x.productId)status='NON_INVENTORY';
        else if(oldStatus==='PENDING_IMPORT_LINK')status='PENDING_IMPORT_LINK';
        else if(oldStatus==='INVENTORY_CONFIRMED'&&sameProduct&&!qtyChanged)status='INVENTORY_CONFIRMED';
        else status='PENDING_IMPORT_LINK';
      }
    }
    return {...x,importSyncStatus:status,confirmedOnce:wasConfirmed};
  });
  const merged=[...old.filter(x=>!dirtyIds.has(String(x.transactionId||''))),...local];
  if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,ctx.date,ctx.location,merged);
  if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(type,ctx.date,ctx.location,merged);
  if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(type,ctx.date,ctx.location,merged);
  refreshProfitAggregateCachesV321(local,[...dirtyIds]);
  const byTxn=new Map();local.forEach(x=>{const tx=String(x.transactionId||'');if(!byTxn.has(tx))byTxn.set(tx,[]);byTxn.get(tx).push(x)});
  dirty.forEach(card=>{
    normalizeDraftProductOrdersV503(card);
    clearSalesCardTransactionDirtyV239(card);delete card.dataset.productRemovedV259;
    const tx=String(card.dataset.transactionId||''),rows=byTxn.get(tx)||[];
    if(rows.some(r=>salesCardStatusIsConfirmedV322(r.importSyncStatus)))card.dataset.confirmedOnceV401='1';
    const hasPending=rows.some(r=>String(r.importSyncStatus||'')==='PENDING_IMPORT_LINK');
    const allDone=rows.length&&rows.every(r=>['INVENTORY_CONFIRMED','NON_INVENTORY'].includes(String(r.importSyncStatus||'')));
    card.dataset.inventoryStatus=hasPending?'PENDING_IMPORT_LINK':allDone?'INVENTORY_CONFIRMED':(salesCardIsConfirmedV322(card)?'PENDING_IMPORT_LINK':'DRAFT');
    const rowByLink=new Map(rows.map(r=>[String(r.linkId||''),r]));
    card.querySelectorAll('.product-link-item').forEach(i=>{
      i.dataset.saved='1';i.dataset.dirty='0';
      const rec=rowByLink.get(String(i.dataset.linkId||''));
      if(rec)i.dataset.inventoryStatus=String(rec.importSyncStatus||'');
      else if(salesCardIsConfirmedV322(card))i.dataset.inventoryStatus='PENDING_IMPORT_LINK';
    });
    const tag=card.querySelector('.sales-card-header-v239 b:first-child');if(tag)tag.textContent='已保存销售卡';
    if(card._renderSalesStateV317)card._renderSalesStateV317();updateSalesCardDeleteLockV322(card);
  });
  renumberSavedSalesCardsV241(type);refreshConfirmSaleButtonV322(type);
  return merged;
}

// V42.4: a single-card Draft response contains only the transaction that was
// saved. Merge that acknowledgement into the exact date/location cache instead
// of treating it as the complete card list. Confirmed cards are immutable and
// their status can never be downgraded by a partial/stale draft response.
function mergeSingleCardDraftAckV424(entry,serverLinks){
  const incoming=typeof dedupeAuthoritativeSalesLinksV354==='function'
    ?dedupeAuthoritativeSalesLinksV354(Array.isArray(serverLinks)?serverLinks:[])
    :(Array.isArray(serverLinks)?serverLinks:[]);
  const persistent=typeof getSalesCardPersistentCacheV232==='function'
    ?getSalesCardPersistentCacheV232(entry.type,entry.date,entry.location):null;
  const memory=typeof getCachedSalesProductLinksV216==='function'
    ?getCachedSalesProductLinksV216(entry.type,entry.date,entry.location):null;
  const existing=Array.isArray(persistent)?persistent:(Array.isArray(memory)?memory:[]);
  const replacedTxns=new Set((Array.isArray(entry.items)?entry.items:[])
    .map(x=>String(x?.transactionId||'').trim()).filter(Boolean));
  const deletedIds=new Set((Array.isArray(entry.deletedLinkIds)?entry.deletedLinkIds:[])
    .map(x=>String(x||'').trim()).filter(Boolean));
  const oldByLink=new Map(existing.map(x=>[String(x?.linkId||''),x]));
  const oldByTxn=new Map();
  existing.forEach(x=>{const tx=String(x?.transactionId||'').trim();if(tx&&!oldByTxn.has(tx))oldByTxn.set(tx,x)});
  const protectedIncoming=incoming.map(x=>{
    const prior=oldByLink.get(String(x?.linkId||''))||oldByTxn.get(String(x?.transactionId||'').trim());
    const priorConfirmed=prior&&(prior.confirmedOnce===true||salesCardStatusIsConfirmedV322(prior.importSyncStatus));
    const nextConfirmed=x&&(x.confirmedOnce===true||salesCardStatusIsConfirmedV322(x.importSyncStatus));
    if(priorConfirmed&&!nextConfirmed)return{...x,importSyncStatus:String(prior.importSyncStatus||'INVENTORY_CONFIRMED'),confirmedOnce:true};
    return x;
  });
  const kept=existing.filter(x=>{
    const tx=String(x?.transactionId||'').trim(),id=String(x?.linkId||'').trim();
    return !deletedIds.has(id)&&!(tx&&replacedTxns.has(tx));
  });
  return typeof dedupeAuthoritativeSalesLinksV354==='function'
    ?dedupeAuthoritativeSalesLinksV354([...kept,...protectedIncoming])
    :[...kept,...protectedIncoming];
}

// V42.7: remove V42.3's partial/stale display cache once after upgrade.
// Durable queued drafts use a separate key and remain protected.
const SALES_CARD_CACHE_REPAIR_KEY_V425='lover_sales_card_cache_repaired_v425';
try{
  if(localStorage.getItem(SALES_CARD_CACHE_REPAIR_KEY_V425)!=='1'){
    if(typeof clearSalesCardPersistentCacheV232==='function')clearSalesCardPersistentCacheV232();
    if(typeof salesProductLinksCacheV216!=='undefined'&&salesProductLinksCacheV216&&typeof salesProductLinksCacheV216.clear==='function')salesProductLinksCacheV216.clear();
    localStorage.setItem(SALES_CARD_CACHE_REPAIR_KEY_V425,'1');
  }
}catch(_e){}

// Read the complete exact context after a one-card acknowledgement. This is a
// status-only Sales read and never calls Import's inventory confirmation API.
async function reconcileCompleteSalesCardContextV425(type,date,location){
  if(!type||!date||!location)return null;
  try{
    const raw=await loadSalesProductLinksV206(type,date,location,{force:true,maxAgeMs:0});
    const filtered=filterDeletedSalesLinksV350(type,date,location,raw);
    const cloud=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(filtered):filtered;
    if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,date,location,cloud);
    if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(type,date,location,cloud);
    if(typeof replaceProfitAggregateContextV457==='function')replaceProfitAggregateContextV457(type,date,location,cloud);
    else if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(type,date,location,cloud);
    const current=productLinkContextV206(type);
    const exact=salesCardContextKeyV245(type,current.date,current.location)===salesCardContextKeyV245(type,date,location);
    const hasOpenUnsavedCard=salesCardWrappersV239(type).some(card=>!salesCardIsSavedV241(card));
    const dirty=(typeof hasUnsavedSalesCardChangesV238==='function'&&hasUnsavedSalesCardChangesV238(type))||hasOpenUnsavedCard;
    // V42.8: status acknowledgement is safe to apply in place even while
    // another card is open or being edited. Only the full editor rebuild must
    // stay blocked, otherwise Import can finish successfully while the card
    // remains visually stuck on the yellow draft state until a refresh.
    if(exact)applyCloudDraftStatusesV322(type,cloud);
    if(exact&&!dirty&&!productImportSearchIsActiveV226(type)){
      invalidateSalesCardLoadRequestsV351(type);
      renderProductLinksEditorV206(type,cloud);
      applyCloudDraftStatusesV322(type,cloud);
    }
    return cloud;
  }catch(e){console.warn('V42.8 完整销售卡状态后台核对失败',e);return null}
}
function scheduleCompleteSalesCardReconcileV425(type,date,location){
  setTimeout(()=>reconcileCompleteSalesCardContextV425(type,date,location),120);
}

async function syncQueuedSalesDraftV314(key,expectedToken=''){
  if(SALES_DRAFT_INFLIGHT_V314.has(key))return SALES_DRAFT_INFLIGHT_V314.get(key);
  const all=readSalesDraftPendingV314(),entry=all[key];
  if(!entry)return {ok:true,skipped:true};
  if(expectedToken&&String(entry.token||'')!==String(expectedToken))return {ok:true,stale:true};
  const p=(async()=>{
    try{
      const result=await window.saveSalesProductLinksApiV241(entry.items,'draft',Number(entry.restoreGeneration||0),String(entry.clientDeviceId||''),Number(entry.clientSequence||0),Array.isArray(entry.deletedLinkIds)?entry.deletedLinkIds:[],entry.baseSalesCardRevision);
      const latest=readSalesDraftPendingV314()[key];
      if(latest&&String(latest.token||'')===String(entry.token||'')){
        removeSalesDraftPendingV314(key,entry.token);
        clearDeletedSalesLinkIdsV350(entry.type,entry.date,entry.location,entry.deletedLinkIds||[]);
        const saved=Array.isArray(result?.links)&&result.links.length?result.links:entry.items;
        const merged=mergeSingleCardDraftAckV424(entry,saved);
        if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(entry.type,entry.date,entry.location,merged);
        if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(entry.type,entry.date,entry.location,merged);
        if(typeof replaceProfitAggregateContextV457==='function')replaceProfitAggregateContextV457(entry.type,entry.date,entry.location,merged);
        else if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(entry.type,entry.date,entry.location,merged);
        refreshProfitAggregateCachesV321(saved,[...new Set(entry.items.map(x=>String(x.transactionId||'')).filter(Boolean))]);
        applyCloudDraftStatusesV322(entry.type,merged);
        if(typeof refreshInventoryPendingV250==='function')setTimeout(()=>refreshInventoryPendingV250(true),0);
        setSync('已同步',true);
        scheduleCompleteSalesCardReconcileV425(entry.type,entry.date,entry.location);
      }
      return result;
    }catch(err){
      setSync('草稿已安全保存 · 云端待同步',false,true);
      scheduleSalesDraftRetryV314(5000);
      throw err;
    }finally{SALES_DRAFT_INFLIGHT_V314.delete(key)}
  })();
  SALES_DRAFT_INFLIGHT_V314.set(key,p);return p;
}
function scheduleSalesDraftRetryV314(delay=5000){
  clearTimeout(SALES_DRAFT_RETRY_TIMER_V314);
  SALES_DRAFT_RETRY_TIMER_V314=setTimeout(()=>retryAllSalesDraftsV314(),delay);
}
async function retryAllSalesDraftsV314(){
  if(typeof navigator!=='undefined'&&!navigator.onLine)return scheduleSalesDraftRetryV314(15000);
  const keys=Object.keys(readSalesDraftPendingV314());
  for(const key of keys){try{await syncQueuedSalesDraftV314(key)}catch(_){}}
}
async function flushSalesDraftBeforeConfirmV314(type,date,location){
  const key=salesDraftPendingKeyV314(type,date,location);
  const inflight=SALES_DRAFT_INFLIGHT_V314.get(key);if(inflight){try{await inflight}catch(_){}}
  const current=readSalesDraftPendingV314()[key];
  if(current){
    let result=await window.saveSalesProductLinksApiV241(current.items,'draft',Number(current.restoreGeneration||0),String(current.clientDeviceId||''),Number(current.clientSequence||0),Array.isArray(current.deletedLinkIds)?current.deletedLinkIds:[],current.baseSalesCardRevision);
    if(result?.staleMutation&&Array.isArray(current.deletedLinkIds)&&current.deletedLinkIds.length){
      const retryMutation=nextClientMutationV344();
      result=await window.saveSalesProductLinksApiV241(current.items,'draft',Number(current.restoreGeneration||0),String(retryMutation.clientDeviceId||''),Number(retryMutation.clientSequence||0),current.deletedLinkIds,current.baseSalesCardRevision);
      if(result?.staleMutation)throw new Error('删除产品同步遇到较新的云端版本，请再次保存草稿');
    }
    removeSalesDraftPendingV314(key,current.token);
    acknowledgeDeletedSalesLinksV351(current.type,current.date,current.location,current.deletedLinkIds||[],Array.isArray(result?.links)?result.links:current.items);
    return result
  }
  return null;
}
window.addEventListener('online',()=>scheduleSalesDraftRetryV314(100));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSalesDraftRetryV314(250)});
setTimeout(()=>scheduleSalesDraftRetryV314(1200),0);


/* ================= V35.0 Sales stock oversell guard =================
   Before Save Draft / Confirm, re-read Import current stock.  New/unprocessed
   cards must fit the full requested quantity.  A card already confirmed AND
   fully inventory-confirmed only needs enough stock for its positive net
   increase; unchanged/reduced quantities are never blocked. */
async function validateSalesInventoryAvailabilityV325(type,items,saveMode='draft'){
  const list=Array.isArray(items)?items:[];
  const mapped=list.filter(x=>String(x?.productId||'').trim());
  if(!mapped.length)return true;
  let records=[];
  let lastInventoryError=null;
  // V42.3: keep the same authoritative Import oversell guard, but avoid the old
  // third sequential cloud read. Concurrent saves share one fresh preflight; a
  // delayed independent backup still protects against a single slow Apps Script
  // request. No cached stock is allowed to approve a sale.
  try{
    if(!importProductsFreshPromiseV400){
      importProductsFreshPromiseV400=(async()=>{
        const primary=fetchImportProductsFreshV395(7000);
        const backup=new Promise(resolve=>setTimeout(resolve,450)).then(()=>fetchImportProductsFreshV395(8500));
        try{return await Promise.any([primary,backup])}
        finally{importProductsFreshPromiseV400=null}
      })();
    }
    records=await importProductsFreshPromiseV400;
  }catch(err){lastInventoryError=err}
  if(!lastInventoryError&&(!Array.isArray(records)||!records.length))lastInventoryError=new Error('进口系统资料不完整');
  if(lastInventoryError){
    const err=lastInventoryError;
    alert('⚠️ 无法核对 Import 最新库存，销售卡未保存。\n\n'+String(err?.message||err)+'\n\n请稍后再试，避免超卖。');
    return false;
  }
  const byId=new Map(),byName=new Map();
  (records||[]).forEach(r=>{const id=String(r?.productId||'').trim();if(id)byId.set(id,r);const n=normalizeImportProductSearchTextV214(r?.productName||'');if(n&&!byName.has(n))byName.set(n,r)});
  const ctx=productLinkContextV206(type);
  const previous=(typeof getCachedSalesProductLinksV216==='function'?getCachedSalesProductLinksV216(type,ctx.date,ctx.location):[])||[];
  const prevByLink=new Map(previous.filter(r=>String(r?.linkId||'')).map(r=>[String(r.linkId),r]));
  const cardByTxn=new Map(salesCardWrappersV239(type).map(c=>[String(c.dataset.transactionId||''),c]));
  const demand=new Map();
  const meta=new Map();
  for(const x of mapped){
    const id=String(x.productId||'').trim(),name=String(x.productName||'').trim();
    const rec=byId.get(id)||byName.get(normalizeImportProductSearchTextV214(name));
    if(!rec)continue;
    const card=cardByTxn.get(String(x.transactionId||''));
    const status=String(card?.dataset?.inventoryStatus||x.importSyncStatus||'').trim();
    const confirmed=!!card&&salesCardIsConfirmedV322(card);
    const prev=prevByLink.get(String(x.linkId||''));
    const sameProduct=prev&&String(prev.productId||'')===id;
    const qty=Math.max(0,Math.trunc(Number(x.quantity)||0));
    let required=qty;
    if(confirmed&&status==='INVENTORY_CONFIRMED'&&sameProduct){
      required=Math.max(0,qty-Math.max(0,Math.trunc(Number(prev.quantity)||0)));
    }
    if(required<=0)continue;
    const key=id||normalizeImportProductSearchTextV214(name);
    demand.set(key,(demand.get(key)||0)+required);meta.set(key,{rec,name});
  }
  for(const [key,required] of demand){
    const {rec,name}=meta.get(key);const stock=Math.max(0,Math.trunc(Number(rec?.stock)||0));
    if(required>stock){
      alert(`⚠️ 库存不足，销售卡未保存。\n\n${name}\nImport 当前库存：${stock} 棵\n这次需要库存：${required} 棵\n\n销售数量不能超过当前可用库存。`);
      return false;
    }
  }
  return true;
}
window.validateSalesInventoryAvailabilityV325=validateSalesInventoryAvailabilityV325;

let SALES_CONFIRMATION_IN_FLIGHT_V407=false;
function salesBoardLabelV493(type){return type==='fair'?'Fair':type==='live'?'Live':'Sales'}
function salesCardActionStatusV493(type,action){return `${salesBoardLabelV493(type)} · Sales Card ${action}`}
// V50.8: a draft product removal is page-local until Save Draft begins.
// It must never become a persistent tombstone that can hide a valid cloud row after reload.
function cardDeletedLinkIdsV508(card){
  try{return [...new Set(JSON.parse(String(card?.dataset?.deletedLinkIdsV508||'[]')).map(x=>String(x||'').trim()).filter(Boolean))]}catch(_){return[]}
}
function rememberCardDeletedLinkV508(card,linkId){
  const id=String(linkId||'').trim();if(!card||!id)return;const ids=new Set(cardDeletedLinkIdsV508(card));ids.add(id);card.dataset.deletedLinkIdsV508=JSON.stringify([...ids]);
}
function collectDirtyDeletedLinkIdsV508(cards){return [...new Set((Array.isArray(cards)?cards:[]).flatMap(cardDeletedLinkIdsV508).filter(Boolean))]}
saveProductLinksV206=async function(type,saveMode='confirm',button=null){
  saveMode=saveMode==='draft'?'draft':'confirm';
  if(button?.dataset?.busyV285==='1')return null;
  // V42.3 protects navigation from the instant Confirm is pressed.
  if(saveMode==='confirm')SALES_CONFIRMATION_IN_FLIGHT_V407=true;
  const originalButtonText=button?.textContent||'';
  if(button){button.dataset.busyV285='1';button.disabled=true;button.textContent=saveMode==='draft'?'保存中…':'确认中…';}
  const releaseButton=()=>{if(saveMode==='confirm')SALES_CONFIRMATION_IN_FLIGHT_V407=false;if(button){button.disabled=false;button.dataset.busyV285='0';button.textContent=originalButtonText;}};
  const cards=salesCardWrappersV239(type),dirty=cards.filter(c=>{
    if(SALES_TARGET_TXN_V405&&String(c.dataset.transactionId||'')!==SALES_TARGET_TXN_V405)return false;
    if(salesCardIsConfirmedV322(c))return false;
    const needsSave=c.dataset.dirty==='1'||c.dataset.productRemovedV259==='1'||!salesCardIsSavedV241(c)||(saveMode==='confirm'&&String(c.dataset.inventoryStatus||'').startsWith('DRAFT'));
    if(!needsSave)return false;
    return true;
  });
  if(!dirty.length){alert(saveMode==='confirm'?'这张销售卡已经确认销售，或尚未先保存草稿。':'销售卡没有需要保存的修改。');releaseButton();refreshConfirmSaleButtonV322(type);return null;}
  const all=collectProductLinksV206(type),dirtyIds=new Set(dirty.map(c=>String(c.dataset.transactionId||''))),items=all.filter(x=>dirtyIds.has(String(x.transactionId||'')));
  if(!items.length){alert('请填写销售卡产品资料。');releaseButton();return null;}
  // V42.3: a draft is local/cloud sales-card data only. Import availability is
  // checked at final confirmation, never while saving or editing a draft.
  if(saveMode==='confirm'&&!(await validateSalesInventoryAvailabilityV325(type,items,saveMode))){releaseButton();return null;}
  const official=salesCardsOfficialAmountV241(type),allTotal=all.reduce((s,x)=>s+Number(x.actualPrice||0),0);
  if(official>0&&allTotal>official+0.005){alert(`所有销售卡售价总数 RM${formatAmount(allTotal)} 已超过当天营业额 RM${formatAmount(official)}。`);releaseButton();return null;}
  for(const x of items){
    if(!x.productName){alert('每一个产品都需要填写产品名称。');releaseButton();return null}
    if(!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0){alert(`产品${Number(x.productOrder||0)||''} 数量必须大于 0。`);releaseButton();return null}
    if(!Number.isFinite(Number(x.unitPrice))||Number(x.unitPrice)<=0){alert(`产品${Number(x.productOrder||0)||''} 售价必须大于 RM0.00，无法保存销售卡。`);releaseButton();return null}
  }
  const ctx=productLinkContextV206(type);

  if(saveMode==='draft'){
    try{
      // V46.0: local safety copy is still written first, but “保存成功” is not
      // shown until Code.gs confirms the cloud write. This prevents a user from
      // leaving while the only copy is still a pending background draft.
      const deletedLinkIdsV508=collectDirtyDeletedLinkIdsV508(dirty);
      const queued=queueSalesDraftV314(type,ctx.date,ctx.location,items,deletedLinkIdsV508);
      // V50.8: do not publish the edited card into persistent/authoritative cache
      // before the cloud ACK. The DOM stays editable/dirty while the safety queue
      // protects the write. This prevents local draft authority from outranking cloud.
      setSync(salesCardActionStatusV493(type,'保存中'));
      const result=await syncQueuedSalesDraftV314(queued.key,queued.token);
      if(!result||result.ok===false)throw new Error((result&&result.message)||'云端未确认保存');
      // V46.0: action result and sync state are separate. The alert reports the
      // write result; the compact sync indicator reports cloud freshness only.
      dirty.forEach(card=>{try{delete card.dataset.deletedLinkIdsV508}catch(_){}});
      setSync('已同步',true);
      releaseButton();
      alert('保存成功');
      return result;
    }catch(e){
      releaseButton();setSync('保存失败 · 本机安全副本仍保留',false,true);alert('保存失败：'+(e.message||e)+'\n\n本机安全副本仍保留，请同步最新资料后重试。');return null;
    }
  }

  try{
    // V32.6: “直接确认” and “先保存草稿再确认” are intentionally the same
    // transaction path. If a draft exists, flush it first; if it does not, the
    // confirm API atomically saves the current card and confirms that SAME
    // transaction/link set. There is never a second sale/card created here.
    await flushSalesDraftBeforeConfirmV314(type,ctx.date,ctx.location);
    setSync(salesCardActionStatusV493(type,'确认中'));
    const mutationV350=nextClientMutationV344();
    const deletedLinkIdsV350=[...new Set([...getDeletedSalesLinkIdsV350(type,ctx.date,ctx.location),...collectDirtyDeletedLinkIdsV508(dirty)])];
    let result;
    try{
      result=await window.saveSalesProductLinksApiV241(items,'confirm',typeof getLocalRestoreGenerationV347==='function'?getLocalRestoreGenerationV347():0,String(mutationV350.clientDeviceId||''),Number(mutationV350.clientSequence||0),deletedLinkIdsV350);
    }catch(confirmErrorV515){
      // V51.5: Apps Script may finish after the browser's response timer. Only
      // on a real timeout, verify the authoritative cloud card before showing
      // failure. Normal confirmation keeps exactly the same single request.
      if(!/超时|timeout/i.test(String(confirmErrorV515?.message||confirmErrorV515)))throw confirmErrorV515;
      let recoveredLinksV515=[];
      for(const waitMsV515 of [500,1500,3000]){
        await new Promise(resolveV515=>setTimeout(resolveV515,waitMsV515));
        try{
          const cloudV515=await loadSalesProductLinksV206(type,ctx.date,ctx.location,{force:true,maxAgeMs:0});
          const activeV515=(Array.isArray(cloudV515)?cloudV515:[]).filter(x=>String(x.status||'active')!=='deleted');
          const allConfirmedV515=[...dirtyIds].every(txnV515=>{
            const cardLinksV515=activeV515.filter(x=>String(x.transactionId||'')===txnV515);
            return cardLinksV515.length>0&&cardLinksV515.some(x=>x.confirmedOnce===true||salesCardStatusIsConfirmedV322(x.importSyncStatus));
          });
          if(allConfirmedV515){recoveredLinksV515=activeV515.filter(x=>dirtyIds.has(String(x.transactionId||'')));break;}
        }catch(_){ }
      }
      if(!recoveredLinksV515.length)throw confirmErrorV515;
      result={ok:true,links:recoveredLinksV515,recoveredAfterTimeoutV515:true};
    }
    if(result?.staleMutation&&deletedLinkIdsV350.length){
      const retryMutationV351=nextClientMutationV344();
      result=await window.saveSalesProductLinksApiV241(items,'confirm',typeof getLocalRestoreGenerationV347==='function'?getLocalRestoreGenerationV347():0,String(retryMutationV351.clientDeviceId||''),Number(retryMutationV351.clientSequence||0),deletedLinkIdsV350);
      if(result?.staleMutation)throw new Error('删除产品同步遇到较新的云端版本，请先保存草稿后再确认销售');
    }
    let saved=Array.isArray(result?.links)?result.links:items;
    saved=captureSalesCardFinalStatesV431(type,ctx.date,ctx.location,saved);
    if(!acknowledgeDeletedSalesLinksV351(type,ctx.date,ctx.location,deletedLinkIdsV350,saved))throw new Error('云端仍返回已删除产品，已保留删除保护，请重新保存草稿');
    const old=(typeof getSalesCardPersistentCacheV232==='function'?getSalesCardPersistentCacheV232(type,ctx.date,ctx.location):[])||[];
    const final=[...old.filter(x=>!dirtyIds.has(String(x.transactionId||''))),...saved];
    if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,ctx.date,ctx.location,final);
    if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(type,ctx.date,ctx.location,final);
    if(typeof replaceProfitAggregateContextV457==='function')replaceProfitAggregateContextV457(type,ctx.date,ctx.location,final);
    else if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(type,ctx.date,ctx.location,final);
    refreshProfitAggregateCachesV321(saved,[...dirtyIds]);
    const savedByLink=new Map(saved.map(x=>[String(x.linkId||''),x]));
    dirty.forEach(card=>{clearSalesCardTransactionDirtyV239(card);delete card.dataset.productRemovedV259;let cardStatus='';card.querySelectorAll('.product-link-item').forEach(i=>{i.dataset.saved='1';i.dataset.dirty='0';const rec=savedByLink.get(String(i.dataset.linkId||''));if(rec){i.dataset.inventoryStatus=String(rec.importSyncStatus||'');i.dataset.productId=String(rec.productId||'');const cost=i.querySelector('.product-link-avg-cost');if(cost&&rec.averageCost!==undefined)cost.value=formatAmount(Number(rec.averageCost||0));cardStatus=cardStatus||i.dataset.inventoryStatus;}});if(cardStatus)card.dataset.inventoryStatus=cardStatus;if(card._renderSalesStateV317)card._renderSalesStateV317();recalcSalesCardTransactionV239(card);});
    renumberSavedSalesCardsV241(type);dirty.forEach(updateSalesCardDeleteLockV322);refreshConfirmSaleButtonV322(type);if(typeof refreshInventoryPendingV250==='function')setTimeout(()=>refreshInventoryPendingV250(true),0);scheduleCompleteSalesCardReconcileV425(type,ctx.date,ctx.location);setSync('销售已确认',true);alert('销售确认成功。\n\n如有库存变动，请到 Import Cost System 处理。');if(result?.warning)alert(result.warning);return result;
  }catch(e){setSync('销售确认失败',false,true);alert('销售确认失败：'+(e.message||e)+'\n\n草稿仍保留，请稍后重试确认销售。');return null}
  finally{SALES_CONFIRMATION_IN_FLIGHT_V407=false;releaseButton()}
};

// V32.6: draft cards may be edited/deleted at any time; once confirmed they are immutable for deletion.
const _deleteSalesCardTransactionV313=deleteSalesCardTransactionV239;
deleteSalesCardTransactionV239=async function(type,txnId){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+'ProductItems');
  const card=[...(wrap?.querySelectorAll('.sales-card-transaction-v239')||[])].find(x=>x.dataset.transactionId===txnId);if(!card)return;
  const savedItems=[...card.querySelectorAll('.product-link-item')].filter(i=>i.dataset.saved==='1'&&String(i.dataset.linkId||''));
  const statuses=savedItems.map(i=>String(i.dataset.inventoryStatus||'').trim()).filter(Boolean);
  const confirmed=statuses.some(s=>!['DRAFT','DRAFT_INVENTORY_CHANGED'].includes(s));
  if(confirmed){alert('这张销售卡已经确认销售，不能删除。');return;}
  return _deleteSalesCardTransactionV313(type,txnId);
};
window.deleteSalesCardTransactionV239=deleteSalesCardTransactionV239;

function productProfitNameV241(x){const q=Math.max(1,Number(x.quantity||1));return escapeChangeLogHtmlV200(String(x.productName||''))+(q>1?` <small class="product-profit-qty-v241">×${q}</small>`:'')}
productProfitDesktopRowsV216=function(list){return list.map(x=>`<tr><td>${productProfitNameV241(x)}</td><td>${formatAmount(Number(x.averageCost||0)*Math.max(1,Number(x.quantity||1)))}</td><td>${formatAmount(Number(x.actualPrice||0))}</td><td>${formatAmount(Number(x.profit||0))}</td><td>${Number(x.profitRate||0).toFixed(2)}%</td></tr>`).join('')};
productProfitMobileCardsV216=function(list){return list.map(x=>`<div class="product-profit-mobile-card"><div class="product-profit-mobile-name">${productProfitNameV241(x)}</div><div class="product-profit-mobile-grid"><div><span>成本</span><b>${formatAmount(Number(x.averageCost||0)*Math.max(1,Number(x.quantity||1)))}</b></div><div><span>售价</span><b>${formatAmount(Number(x.actualPrice||0))}</b></div><div><span>利润</span><b>${formatAmount(Number(x.profit||0))}</b></div><div><span>利润率</span><b>${Number(x.profitRate||0).toFixed(2)}%</b></div></div></div>`).join('')};


/* ================= V29.9 Live optimistic revision guard ================= */
const LIVE_SAVE_REV_V243=new Map();
function liveSaveRevKeyV243(date,host){return String(date||"")+"|"+normalizeLiveHostKey(String(host||""))}
function nextLiveSaveRevV243(date,host){
  const key=liveSaveRevKeyV243(date,host),rev=Number(LIVE_SAVE_REV_V243.get(key)||0)+1;
  LIVE_SAVE_REV_V243.set(key,rev);return rev;
}
function isCurrentLiveSaveRevV243(date,host,rev){return Number(LIVE_SAVE_REV_V243.get(liveSaveRevKeyV243(date,host))||0)===Number(rev||0)}

async function refreshOpenSalesChangeLogAfterSaveV243(type,date){
  try{
    if(typeof clearSalesChangeLogCacheV237==="function")clearSalesChangeLogCacheV237(type,date);
    const panel=document.getElementById(changeLogPanelIdV200(type));
    if(panel&&salesChangeLogOpenV200[type]&&String(panel.dataset.logDate||"")===date){
      panel.innerHTML=`<div class="change-log-loading">正在同步最新修改 / 销售记录...</div>`;
    }
    const data=await loadSalesChangeLogFromSheetV200(type,date,{force:true});
    if(panel&&salesChangeLogOpenV200[type]&&String(panel.dataset.logDate||"")===date){
      renderChangeLogTimelineV200(type,date,Array.isArray(data?.logs)?data.logs:[]);
    }
  }catch(e){console.warn("V29.9 修改/销售记录后台刷新失败",e)}
}

saveLiveSales=async function(){
  if(!ensureWritableSelection())return;
  const dateEl=document.getElementById("liveDate");
  const hostInput=document.getElementById("liveHost");
  const amountEl=document.getElementById("liveSales");
  const d=isoToDisplay(dateEl.value);
  let host=selectedLiveHost();
  const amount=toAmount(amountEl.value);
  if(!host){alert("请输入主播名字");return}
  if(!d){alert("请选择日期");return}

  // V29.9 preflight: do not even mutate local turnover when saved cards exceed the new amount.
  try{
    const activeLinks=await loadSalesProductLinksV206("live",d,host,{force:true});
    const cardAmount=(Array.isArray(activeLinks)?activeLinks:[]).reduce((s,x)=>s+Math.max(0,Number(x.actualPrice||0)),0);
    if(amount+0.005<cardAmount){
      alert(`⚠️ 无法修改营业额\n\n当天已有销售卡合计 RM${formatAmount(cardAmount)}。\nLive 营业额不能低于销售卡总额。\n请先修改或删除相关销售卡。`);
      amountEl.value=formatAmount(salesCardsOfficialAmountV241("live"));
      clearLiveTurnoverDraftV332(d,host);
      return;
    }
  }catch(e){
    // V32.6: a cloud preflight timeout must not lock turnover editing.
    // The authoritative saveLive() server guard still rejects any amount below
    // active saved cards. With no saved card, the user may edit turnover freely.
    console.warn("V32.6 销售卡预检暂时失败，继续交由云端保存时核对",e);
  }

  const restored=reactivateLiveHostIfNeeded(host);
  host=restored.host;hostInput.value=host;
  saveLiveHost(host);saveLastLiveSession(host,dateEl.value);

  const rev=nextLiveSaveRevV243(d,host);
  const now=new Date().toISOString();
  const previousCloudRow=rows.find(r=>r.type==="live"&&r.date===d&&canonicalLiveHost(r.location)===canonicalLiveHost(host));
  const mutationV344=nextClientMutationV344();
  const localRow={type:"live",date:d,company:"live",location:host,amount,updatedAt:now,clientUpdatedAt:now,...mutationV344,baseCloudUpdatedAt:String(previousCloudRow?.updatedAt||"")};

  // Critical V29.9 guard: any cloud request started before this local mutation
  // is not allowed to overwrite this newer value.
  if(typeof markLocalRowMutation==="function")markLocalRowMutation(localRow,Date.now()+1);
  if(amount<=0)rows=rows.filter(r=>rowKey(r)!==rowKey(localRow)); else upsertLocalRow(localRow);
  addPendingRow(localRow);
  amountEl.value=formatAmount(amount);
  if(typeof clearSalesChangeLogCacheV237==="function")clearSalesChangeLogCacheV237("live",d);

  renderAll();
  if(isCurrentLiveSaveRevV243(d,host,rev))amountEl.value=formatAmount(amount);
  try{if(typeof saveLocalDataCache==="function")saveLocalDataCache()}catch(_){}
  showTempMsg("liveSaveMsg");

  try{
    setSync("已储存，正在后台同步...");
    const saved=await saveLiveToSheet(d,host,amount,now,localRow.clientDeviceId,localRow.clientSequence,localRow.baseCloudUpdatedAt,true);
    if(!isCurrentLiveSaveRevV243(d,host,rev))return;

    const finalAmount=amount;
    const finalRow=saved?{...saved,amount:finalAmount}:localRow;
    if(finalAmount<=0)rows=rows.filter(r=>rowKey(r)!==rowKey(localRow)); else upsertLocalRow(finalRow);
    if(typeof markLocalRowMutation==="function")markLocalRowMutation(finalRow,Date.now()+1);
    clearPendingRowIfVersionV343(localRow);
    clearLiveTurnoverDraftV332(d,host);

    renderAll();
    amountEl.value=formatAmount(finalAmount);
    try{if(typeof saveLocalDataCache==="function")saveLocalDataCache()}catch(_){}
    setSync("已同步",true);

    // Do not paint stale audit cache. Fetch the fresh log and update silently.
    refreshOpenSalesChangeLogAfterSaveV243("live",d);
  }catch(e){
    if(!isCurrentLiveSaveRevV243(d,host,rev))return;
    amountEl.value=formatAmount(amount);
    if(typeof markLocalRowMutation==="function")markLocalRowMutation(localRow,Date.now()+1);
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
    else setSync("同步暂未完成",false,true);
  }
};
window.saveLiveSales=saveLiveSales;



/* ================= V29.9 Profit list copy + compact totals ================= */
async function copyProfitProductNameV244(el){
  if(!el)return;
  const raw=String(el.dataset.copyName||"").trim();
  if(!raw)return;
  try{
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(raw);
    else{
      const ta=document.createElement("textarea");ta.value=raw;ta.style.position="fixed";ta.style.opacity="0";
      document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
    }
    const original=el.innerHTML;
    el.textContent="已复制";
    el.classList.add("copied-v244");
    setTimeout(()=>{el.innerHTML=original;el.classList.remove("copied-v244")},900);
  }catch(e){console.warn("复制产品名失败",e)}
}
window.copyProfitProductNameV244=copyProfitProductNameV244;

function profitProductDisplayV244(x){
  const q=Math.max(1,Number(x.quantity||1));
  const raw=String(x.productName||"")+(q>1?` ×${q}`:"");
  const html=escapeChangeLogHtmlV200(String(x.productName||""))+(q>1?` <small class="product-profit-qty-v241">×${q}</small>`:"");
  return `<button type="button" class="profit-product-copy-v244" data-copy-name="${escapeChangeLogHtmlV200(raw)}" onclick="copyProfitProductNameV244(this)">${html}</button>`;
}
productProfitDesktopRowsV216=function(list){
  return list.map(x=>{
    const q=Math.max(1,Number(x.quantity||1));
    const totalCost=Number(x.averageCost||0)*q;
    const totalSale=Number(x.actualPrice||0);
    const totalProfit=Number(x.profit||0);
    return `<tr><td>${profitProductDisplayV244(x)}</td><td>${formatAmount(totalCost)}</td><td>${formatAmount(totalSale)}</td><td>${formatAmount(totalProfit)}</td><td>${Number(x.profitRate||0).toFixed(2)}%</td></tr>`;
  }).join("");
};
productProfitMobileCardsV216=function(list){
  return list.map(x=>{
    const q=Math.max(1,Number(x.quantity||1));
    const totalCost=Number(x.averageCost||0)*q;
    const totalSale=Number(x.actualPrice||0);
    const totalProfit=Number(x.profit||0);
    return `<div class="product-profit-mobile-card">
      <div class="product-profit-mobile-name">${profitProductDisplayV244(x)}</div>
      <div class="product-profit-mobile-grid product-profit-mobile-grid-v244">
        <div><span>成本总数</span><b>${formatAmount(totalCost)}</b></div>
        <div><span>售价总数</span><b>${formatAmount(totalSale)}</b></div>
        <div><span>利润总数</span><b>${formatAmount(totalProfit)}</b></div>
        <div><span>利润率</span><b>${Number(x.profitRate||0).toFixed(2)}%</b></div>
      </div>
    </div>`;
  }).join("");
};



/* ================= V35.0 labelled profit rollup + true overall margin ================= */
// V35.0: the displayed cost uses inventory cost + product delivery + extra fee.
// Commission remains a separate card-level deduction and is not added here.
function productOperatingCostV335(x){
  const q=Math.max(1,Number(x&&x.quantity||1));
  return Number(x&&x.averageCost||0)*q+
    Math.max(0,Number(x&&x.localDelivery||0))+
    Math.max(0,Number(x&&x.extraFee||0));
}
function productProfitTotalsV246(list){
  return (list||[]).reduce((a,x)=>{a.cost+=productOperatingCostV335(x);a.sale+=Number(x.actualPrice||0);a.profit+=Number(x.profit||0);return a},{cost:0,sale:0,profit:0});
}
productProfitDesktopRowsV216=function(list){
  return list.map(x=>{const cost=productOperatingCostV335(x),sale=Number(x.actualPrice||0),profit=Number(x.profit||0);return `<tr><td>${profitProductDisplayV244(x)}</td><td>${formatAmount(cost)}</td><td>${formatAmount(sale)}</td><td>${formatAmount(profit)}</td><td>${Number(x.profitRate||0).toFixed(2)}%</td></tr>`}).join('');
};
productProfitMobileCardsV216=function(list){
  return list.map(x=>{const cost=productOperatingCostV335(x),sale=Number(x.actualPrice||0),profit=Number(x.profit||0);return `<div class="product-profit-mobile-card"><div class="product-profit-mobile-name">${profitProductDisplayV244(x)}</div><div class="product-profit-mobile-grid product-profit-mobile-grid-v244"><div><span>成本（含运费/附加）</span><b>${formatAmount(cost)}</b></div><div><span>售价</span><b>${formatAmount(sale)}</b></div><div><span>利润</span><b>${formatAmount(profit)}</b></div><div><span>利润率</span><b>${Number(x.profitRate||0).toFixed(2)}%</b></div></div></div>`}).join('');
};
renderProductProfitSummaryV216=function(type,allLinks){
  const panel=productProfitSummaryPanelV216(type);if(!panel)return;
  const date=productProfitSelectedDateV216(type),salesMap=productProfitSalesByGroupV216(type,date),groups=productProfitGroupLinksV216(type,date,allLinks);
  salesMap.forEach((rec,key)=>{if(!groups.has(key))groups.set(key,{name:rec.name,links:[]})});
  const ordered=Array.from(groups.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),'zh-Hans-CN',{numeric:true,sensitivity:'base'}));
  let dayProfit=0,daySales=0;
  const sections=ordered.map(group=>{const s=productProfitGroupStatsV216(group,salesMap,type),t=productProfitTotalsV246(group.links);dayProfit+=s.totalProfit;daySales+=s.sales;
    const overallRate=t.sale>0?t.profit/t.sale*100:0;
    const commission=Math.max(0,t.sale-t.cost-t.profit);
    const completeCost=t.cost+commission;
    const totals=group.links.length?`<div class="product-profit-rollup-v336">
      <div><span>营运成本</span><b>${formatAmount(t.cost)}</b></div>
      <div><span>${type==='live'?'主播佣金':'佣金'}</span><b>${formatAmount(commission)}</b></div>
      <div><span>完整总成本</span><b>${formatAmount(completeCost)}</b></div>
      <div><span>售价总数</span><b>${formatAmount(t.sale)}</b></div>
      <div><span>总利润</span><b>${formatAmount(t.profit)}</b></div>
      <div><span>整体利润率</span><b>${overallRate.toFixed(2)}%</b></div>
    </div>`:'';
    return `<section class="product-profit-group"><div class="product-profit-group-title">${type==='live'?'主播':'地点'}：${escapeChangeLogHtmlV200(group.name)}</div><div class="product-profit-table-wrap"><table class="product-profit-table"><thead><tr><th>产品名</th><th>成本（含运费/附加）</th><th>售价</th><th>利润</th><th>利润率</th></tr></thead><tbody>${group.links.length?productProfitDesktopRowsV216(group.links):`<tr><td colspan="5" class="product-profit-empty">没有已保存的销售卡资料</td></tr>`}</tbody></table></div><div class="product-profit-mobile-list">${group.links.length?productProfitMobileCardsV216(group.links):`<div class="product-profit-empty">没有已保存的销售卡资料</div>`}</div>${totals}</section>`;
  }).join('');
  const dayRate=daySales>0?dayProfit/daySales*100:0;
  panel.innerHTML=`<div class="product-profit-summary-head"><div><b>${date} · ${type==='live'?'全部主播':'全部地点'}</b></div><button type="button" class="secondary-btn product-profit-export-btn" onclick="exportProductProfitExcelV216('${type}')">📈 导出 Excel</button></div>${sections||`<div class="product-profit-empty">当天还没有销售卡资料</div>`}<div class="product-profit-day-summary"><div class="product-profit-total profit-highlight"><span>当天总利润</span><b>RM${formatAmount(dayProfit)}</b></div><div class="product-profit-total profit-highlight"><span>当天整体利润率</span><b>${dayRate.toFixed(2)}%</b></div></div>`;
  panel.dataset.summaryDate=date;panel.dataset.summaryLinks=JSON.stringify((allLinks||[]).filter(x=>String(x.type||'')===type&&String(x.date||'')===date));
};


/* ================= V29.9 cross-date inventory reminders =================
   One independent inventory reminder per product/linkId.
   Compatible with both per-product API rows and older aggregated products[] payloads. */
let inventoryPendingCacheV250=[];
let inventoryPendingLoadingV250=null;
let inventoryPendingLastAtV250=0;

function inventoryPendingDaysOldV250(date){
  const iso=displayToISO(String(date||""));if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return 0;
  const d=new Date(iso+"T00:00:00"),today=new Date(todayISO()+"T00:00:00");
  return Math.max(0,Math.floor((today-d)/86400000));
}

function normalizePendingInventoryItemsV263(list){
  const out=[];
  (Array.isArray(list)?list:[]).forEach(parent=>{
    const base={
      type:String(parent?.type||""),
      date:String(parent?.date||parent?.saleDate||""),
      location:String(parent?.location||parent?.host||parent?.fairLocation||""),
      transactionId:String(parent?.transactionId||parent?.saleId||""),
      saleId:String(parent?.saleId||parent?.transactionId||""),
      updatedAt:String(parent?.updatedAt||""),
      saleTime:String(parent?.saleTime||"")
    };

    if(String(parent?.linkId||"").trim() || String(parent?.productName||"").trim()){
      out.push({
        ...parent,...base,
        linkId:String(parent?.linkId||"").trim(),
        productId:String(parent?.productId||"").trim(),
        productName:String(parent?.productName||"").trim(),
        quantity:Math.max(1,Number(parent?.quantity||1))
      });
      return;
    }

    const products=Array.isArray(parent?.products)?parent.products:[];
    products.forEach((p,index)=>{
      out.push({
        ...base,...p,
        linkId:String(p?.linkId||p?.id||"").trim(),
        productId:String(p?.productId||"").trim(),
        productName:String(p?.productName||p?.name||"").trim(),
        quantity:Math.max(1,Number(p?.quantity||1)),
        productOrder:Math.max(1,Number(p?.productOrder||index+1))
      });
    });
  });

  const seen=new Set();
  return out.filter((item,index)=>{
    const key=String(item.linkId||"").trim()||
      [item.transactionId,item.productId||item.productName,item.productOrder||index].join("|");
    if(seen.has(key))return false;
    seen.add(key);
    return !!String(item.productName||"").trim();
  });
}

function inventoryPendingTimeV325(item){
  const direct=String(item?.saleTime||"").trim();if(direct)return direct.slice(0,5);
  const raw=String(item?.updatedAt||"").trim();
  const m=raw.match(/(?:T|\s)(\d{1,2}):(\d{2})/);return m?`${m[1].padStart(2,"0")}:${m[2]}`:"";
}

function inventoryPendingProductTextV250(item){
  return `${String(item?.productName||"未命名产品")} ${Math.max(1,Number(item?.quantity||1))}棵`;
}

function copyInventoryProductNameV262(name,el){
  const text=String(name||"").trim();if(!text)return;
  const original=el?.textContent||text;
  const done=()=>{if(el)el.textContent="已复制";setTimeout(()=>{if(el)el.textContent=original},800);};
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(done).catch(()=>{});
  else{const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");done()}catch(_){}ta.remove()}
}
window.copyInventoryProductNameV262=copyInventoryProductNameV262;

const IMPORT_COST_SYSTEM_URL_V266="https://alexliew829.github.io/lover-legend-import-system/";

function openImportCostSystemV266(target={}){
  // V29.9: Sales must stay open; Import always opens in a separate tab/window.
  // Pass the clicked transaction so Import can put that Sales card first.
  const saleId=String(target?.saleId||target?.transactionId||"").trim();
  const linkId=String(target?.linkId||"").trim();
  const type=String(target?.type||"").trim();
  const date=String(target?.date||target?.saleDate||"").trim();
  const location=String(target?.location||target?.host||target?.fairLocation||"").trim();

  const url=new URL(IMPORT_COST_SYSTEM_URL_V266);
  if(saleId)url.searchParams.set("salesTxn",saleId);
  if(linkId)url.searchParams.set("salesLink",linkId);
  if(type)url.searchParams.set("salesType",type);
  if(date)url.searchParams.set("salesDate",date);
  if(location)url.searchParams.set("salesLocation",location);

  const newTab=window.open("","_blank");
  if(!newTab){
    alert("浏览器阻止了新标签页。\n\nSales System 会保持不变，请允许此网站开启新标签页后再试一次。");
    return false;
  }
  try{newTab.opener=null}catch(_){}
  try{newTab.location.replace(url.toString())}catch(_){newTab.location.href=url.toString()}
  return true;
}
window.openImportCostSystemV266=openImportCostSystemV266;

function renderInventoryPendingGlobalV250(){
  ["daily","live","fair"].forEach(pageType=>{
    const box=document.getElementById(pageType+"InventoryReminderV250");if(!box)return;
    const list=inventoryPendingCacheV250.filter(item=>{
      // V46.0: a draft card must never flash an Import-inventory reminder.
      // The pending endpoint can briefly return an older state while a save or
      // confirmation request is still settling, so the visible card is the
      // final display guard. A real confirmed card remains eligible normally.
      if(inventoryPendingMatchesVisibleDraftV438(item))return false;
      const itemType=String(item.type||"").toLowerCase();
      if(pageType==="daily"){const selected=String(document.getElementById('company')?.value||'belimbing');const actual=String(item.location||'Belimbing').toLowerCase().includes('balakong')?'balakong':'belimbing';return itemType==='daily'&&actual===selected;}
      return itemType===pageType;
    });
    if(!list.length){box.classList.add("hidden");box.innerHTML="";return}
    box.classList.remove("hidden");

    const groups=new Map();
    list.forEach(item=>{
      const key=[item.date,item.type,item.location,item.transactionId||item.saleId].join("|");
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(item);
    });

    box.innerHTML=[...groups.values()].map(group=>{
      const first=group[0],itemCount=group.length;
      const old=inventoryPendingDaysOldV250(first.date),stale=old>=1;
      const targetPayload={
        transactionId:String(first.transactionId||first.saleId||""),
        saleId:String(first.saleId||first.transactionId||""),
        linkId:String(first.linkId||""),
        type:String(first.type||""),
        date:String(first.date||""),
        location:String(first.location||"")
      };
      return `<button type="button" class="inventory-summary-v264${stale?" stale-v250":""}" onclick='openImportCostSystemV266(${JSON.stringify(targetPayload)})'>
        <div class="inventory-summary-title-v264">⚠️ 有 ${itemCount} 项需要处理的库存变动</div>
        <div class="inventory-summary-meta-v264">${escapeChangeLogHtmlV200(first.date)}${inventoryPendingTimeV325(first)?" "+escapeChangeLogHtmlV200(inventoryPendingTimeV325(first)):""} · ${String(first.type||"").toLowerCase()==="daily"?"Sales · "+escapeChangeLogHtmlV200(first.location||'Belimbing'):String(first.type||"").toLowerCase()==="live"?"Live · "+escapeChangeLogHtmlV200(first.location):"Fair · "+escapeChangeLogHtmlV200(first.location)}</div>
        <div class="inventory-summary-action-v264">请到 Import Cost System 处理 <span aria-hidden="true">›</span></div>
      </button>`;
    }).join("");
  });
}

function inventoryPendingMatchesVisibleDraftV438(item){
  const transactionId=String(item?.transactionId||item?.saleId||'').trim();
  if(!transactionId)return false;
  try{
    for(const type of ['daily','fair','live']){
      const card=salesCardWrappersV239(type).find(x=>String(x?.dataset?.transactionId||'').trim()===transactionId);
      if(card)return !salesCardIsConfirmedV322(card);
    }
  }catch(_){ }
  return false;
}

async function refreshInventoryPendingV250(force=false){
  if(inventoryPendingLoadingV250)return inventoryPendingLoadingV250;
  if(!force&&Date.now()-inventoryPendingLastAtV250<30000){renderInventoryPendingGlobalV250();return inventoryPendingCacheV250}
  inventoryPendingLoadingV250=(async()=>{
    try{
      const list=await loadPendingInventorySalesCardsV250();
      inventoryPendingCacheV250=normalizePendingInventoryItemsV263(list);
      inventoryPendingLastAtV250=Date.now();
      reconcileVisibleSalesCardAckV407(inventoryPendingCacheV250,{pendingFeedOnly:true});
      if(typeof loadSalesInventoryAckStatusV408==='function'){
        const visible=[...document.querySelectorAll('.product-link-item[data-saved="1"]')].map(x=>String(x.dataset.linkId||'')).filter(Boolean);
        if(visible.length){
          const states=await loadSalesInventoryAckStatusV408(visible);
          reconcileVisibleSalesCardAckV407(states,{pendingFeedOnly:false});
          // V46.0: if an exact ACK lookup completed between the pending-feed
          // read and this render, remove only those explicitly completed visible
          // links from the pending banner cache. Never infer completion for IDs
          // missing from the ACK response.
          const explicitDoneIdsV460=new Set(states.filter(x=>['INVENTORY_CONFIRMED','NON_INVENTORY'].includes(String(x?.status||'').trim())).map(x=>String(x?.linkId||'').trim()).filter(Boolean));
          if(explicitDoneIdsV460.size)inventoryPendingCacheV250=inventoryPendingCacheV250.filter(x=>!explicitDoneIdsV460.has(String(x?.linkId||'').trim()));
        }
      }
      renderInventoryPendingGlobalV250();
      return inventoryPendingCacheV250;
    }catch(e){
      console.warn("库存待处理读取失败",e);
      renderInventoryPendingGlobalV250();
      return inventoryPendingCacheV250;
    }finally{inventoryPendingLoadingV250=null}
  })();
  return inventoryPendingLoadingV250;
}
window.refreshInventoryPendingV250=refreshInventoryPendingV250;

// V46.0: pending feed and ACK status are separate evidence. A pending-feed hit
// can force a visible card back to waiting; only an explicit ACK status response
// may promote that exact link to INVENTORY_CONFIRMED / NON_INVENTORY.
function reconcileVisibleSalesCardAckV407(items=[],options={}){
  const source=Array.isArray(items)?items:[];
  const pendingFeedOnly=options&&options.pendingFeedOnly===true;
  const statusById=new Map();
  source.forEach(x=>{
    const id=String(x?.linkId||'').trim();if(!id)return;
    // V46.0: the global pending feed proves only that a line is still pending.
    // Absence from that feed is NEVER proof of Import ACK. Only the dedicated
    // ACK endpoint may explicitly promote a line to INVENTORY_CONFIRMED.
    const status=pendingFeedOnly?'PENDING_IMPORT_LINK':String(x?.status||'').trim();
    if(['DRAFT','DRAFT_INVENTORY_CHANGED','PENDING_IMPORT_LINK','INVENTORY_CONFIRMED','NON_INVENTORY'].includes(status))statusById.set(id,status);
  });
  if(!statusById.size)return;
  ['daily','fair','live'].forEach(type=>{
    const ctx=productLinkContextV206(type);if(!ctx.date||!ctx.location)return;
    const changedStatuses=new Map();
    salesCardWrappersV239(type).forEach(card=>{
      // V51.0: Import pending/ACK is evidence for confirmed sales only. While a
      // visible card is an unconfirmed/dirty draft, stale background status must
      // not change its state, lock its inputs, or persist into local caches.
      if(salesCardIsEditableDraftV509(card))return;
      let changed=false,hasPending=false,hasSaved=false,allDone=true;
      const savedItems=[...card.querySelectorAll('.product-link-item')].filter(item=>item.dataset.saved==='1'&&String(item.dataset.linkId||'').trim());
      savedItems.forEach(item=>{
        const linkId=String(item.dataset.linkId||'').trim();
        if(!linkId)return;hasSaved=true;
        const cloudStatus=statusById.get(linkId);
        if(cloudStatus&&String(item.dataset.inventoryStatus||'').trim()!==cloudStatus){
          item.dataset.inventoryStatus=cloudStatus;changedStatuses.set(linkId,cloudStatus);changed=true;
        }
        const finalStatus=String(item.dataset.inventoryStatus||'').trim();
        if(finalStatus==='PENDING_IMPORT_LINK'||finalStatus==='DRAFT'||finalStatus==='DRAFT_INVENTORY_CHANGED')hasPending=true;
        if(!['INVENTORY_CONFIRMED','NON_INVENTORY'].includes(finalStatus))allDone=false;
      });
      if(!changed)return;
      card.dataset.inventoryStatus=hasPending?'PENDING_IMPORT_LINK':(hasSaved&&allDone?'INVENTORY_CONFIRMED':card.dataset.inventoryStatus);
      if(card._renderSalesStateV317)card._renderSalesStateV317();
      updateSalesCardDeleteLockV322(card);
    });
    if(!changedStatuses.size)return;
    const updateLinks=list=>captureSalesCardFinalStatesV431(type,ctx.date,ctx.location,(Array.isArray(list)?list:[]).map(x=>{
      const id=String(x?.linkId||'').trim(),status=changedStatuses.get(id);
      return status?{...x,importSyncStatus:status,confirmedOnce:['PENDING_IMPORT_LINK','INVENTORY_CONFIRMED','NON_INVENTORY'].includes(status)||x.confirmedOnce===true}:x;
    }));
    const cached=typeof getCachedSalesProductLinksV216==='function'?getCachedSalesProductLinksV216(type,ctx.date,ctx.location):null;
    const persistent=typeof getSalesCardPersistentCacheV232==='function'?getSalesCardPersistentCacheV232(type,ctx.date,ctx.location):null;
    if(Array.isArray(cached)&&typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,ctx.date,ctx.location,updateLinks(cached));
    if(Array.isArray(persistent)&&typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(type,ctx.date,ctx.location,updateLinks(persistent));
  });
}
window.reconcileVisibleSalesCardAckV407=reconcileVisibleSalesCardAckV407;


// V29.9: Sales-side inventory confirmation removed. Import is the only inventory authority.

async function openPendingInventorySalesCardV250(raw){
  const item=typeof raw==="string"?JSON.parse(raw):raw;if(!item)return;
  const type=String(item.type||"").toLowerCase();
  const page=type==="daily"?"sales":type;
  const nav=document.querySelector(`.nav-item[data-page="${page}"]`);
  if(nav)showPage(page,nav);
  await new Promise(r=>setTimeout(r,0));

  if(type==="daily"){
    const company=document.getElementById("company");if(company)company.value=String(item.location||'Belimbing').toLowerCase().includes('balakong')?'balakong':'belimbing';
    setDateControl("saleDate",displayToISO(item.date));
    updateDailyInputFromSelectedDate();
  }else if(type==="live"){
    document.getElementById("liveHost").value=item.location;
    setDateControl("liveDate",displayToISO(item.date));
    updateLiveInputFromSelectedDate();
  }else{
    document.getElementById("fairLocation").value=item.location;
    const iso=displayToISO(item.date);
    setDateControl("fairStart",iso);
    setDateControl("fairEnd",iso);
    if(typeof syncFairInputs==="function")syncFairInputs();
    if(typeof syncFairProductDatesV203==="function")syncFairProductDatesV203();
    const sel=document.getElementById("fairProductDate");if(sel)sel.value=item.date;
  }

  const pre=productLinkPreV208(type),body=document.getElementById(pre+"ProductLinkBody"),box=document.getElementById(pre+"ProductLinkBox");
  if(body&&body.classList.contains("hidden")){
    body.classList.remove("hidden");if(box)box.classList.remove("product-link-collapsed");
    const toggle=box?.querySelector(".product-link-toggle");if(toggle)toggle.setAttribute("aria-expanded","true");
  }
  await loadProductLinksIntoEditorV206(type);
  setTimeout(()=>{
    const card=salesCardWrappersV239(type).find(c=>String(c.dataset.transactionId||"")===String(item.transactionId||""));
    if(card)card.scrollIntoView({behavior:"smooth",block:"center"});
  },100);
}
window.openPendingInventorySalesCardV250=openPendingInventorySalesCardV250;

// Always refresh global pending status when Live / Fair page opens.
const _showPageV249=showPage;
showPage=function(name,el){
  if(SALES_CONFIRMATION_IN_FLIGHT_V407&&!confirm('销售确认仍在同步中。现在切换页面可能无法立即知道确认结果。\n\n建议等待销售卡显示确认成功。仍要切换页面？'))return false;
  const result=_showPageV249(name,el);
  if(result===false)return false;
  if(name==="sales"||name==="live"||name==="fair")setTimeout(()=>refreshInventoryPendingV250(true),50);
  return result;
};
window.showPage=showPage;

// Cross-day reminder also initializes shortly after startup.
setTimeout(()=>refreshInventoryPendingV250(true),1200);

// V29.9: after the user processes inventory in the separate Import tab/app,
// returning to Sales should refresh the compact reminder automatically.
let inventoryPendingResumeTimerV265=null;
let inventoryPendingLastResumeAtV265=0;
function scheduleInventoryPendingResumeRefreshV265(){
  if(document.hidden)return;
  clearTimeout(inventoryPendingResumeTimerV265);
  inventoryPendingResumeTimerV265=setTimeout(()=>{
    const now=Date.now();
    if(now-inventoryPendingLastResumeAtV265<1200)return;
    inventoryPendingLastResumeAtV265=now;
    refreshInventoryPendingV250(true);
  },500);
}
// V32.6: cloud resume synchronization is centralized in update.js.
// Refresh Import reminders once only after that resume cycle completes, instead
// of competing with it through visibilitychange + focus + pageshow.
window.addEventListener("lover-sales-resume-ready",scheduleInventoryPendingResumeRefreshV265);
// V42.3: do not wait for the full Sales cloud-resume cycle. Import ACK is a
// separate lightweight request and must refresh as soon as this tab is visible.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleInventoryPendingResumeRefreshV265()});
window.addEventListener('focus',scheduleInventoryPendingResumeRefreshV265);


/* ================= V29.9 RM0 防误触：Sales / Fair / Live ================= */
function selectedActionAmountV270(type){
  if(type==="daily"){
    if(String(document.getElementById("company")?.value||"")!=="belimbing")return 0;
    return getDailyAmount(isoToDisplay(document.getElementById("saleDate")?.value||""),"belimbing");
  }
  if(type==="live")return salesCardsOfficialAmountV241("live");
  return salesCardsOfficialAmountV241("fair");
}
function setActionLockedV270(type,locked){
  const pre=productLinkPreV208(type),box=document.getElementById(pre+"ProductLinkBox");
  const cardBtn=box?.querySelector(".product-link-toggle"),profitBtn=box?.querySelector(".product-profit-toggle-btn");
  const logBtn=document.getElementById(type+"ChangeLogBtnV270");
  [cardBtn,profitBtn,logBtn].forEach(btn=>{if(btn){btn.disabled=!!locked;btn.classList.toggle("sales-action-locked-v270",!!locked)}});
  if(box)box.classList.toggle("sales-action-box-locked-v270",!!locked);
}
function closeZeroSalesPanelsV271(type){
  const pre=productLinkPreV208(type);
  const box=document.getElementById(pre+"ProductLinkBox");
  const body=document.getElementById(pre+"ProductLinkBody");
  if(body)body.classList.add("hidden");
  if(box)box.classList.add("product-link-collapsed");
  const cardBtn=box?.querySelector(".product-link-toggle");
  if(cardBtn)cardBtn.setAttribute("aria-expanded","false");

  const profitPanel=productProfitSummaryPanelV216(type);
  if(profitPanel){profitPanel.classList.add("hidden");profitPanel.innerHTML="";}
  productProfitSummaryOpenV216[type]=false;
  const profitBtn=box?.querySelector(".product-profit-toggle-btn");
  if(profitBtn)profitBtn.textContent="📊 当天利润";

  const logPanel=document.getElementById(changeLogPanelIdV200(type));
  if(logPanel){logPanel.classList.add("hidden");logPanel.innerHTML="";logPanel.dataset.logDate="";}
  if(salesChangeLogOpenV200&&Object.prototype.hasOwnProperty.call(salesChangeLogOpenV200,type))salesChangeLogOpenV200[type]=false;
  const logBtn=document.getElementById(type+"ChangeLogBtnV270");
  if(logBtn)logBtn.classList.remove("active");

  // Only clear the editor UI. Nothing is deleted from Google Sheet / History.
  const items=document.getElementById(pre+"ProductItems");
  if(items)items.innerHTML="";
}
function refreshSalesActionLocksV270(){
  ["daily","fair","live"].forEach(type=>{
    const locked=selectedActionAmountV270(type)<=0.005;
    if(locked)closeZeroSalesPanelsV271(type);
    setActionLockedV270(type,locked);
  });
}
setTimeout(refreshSalesActionLocksV270,0);
const _renderAllV270=renderAll;
renderAll=function(){const r=_renderAllV270.apply(this,arguments);setTimeout(refreshSalesActionLocksV270,0);return r};


/* ================= V29.9 Sales / Fair / Live 营业利润汇总 ================= */
const profitRollupOpenV285={daily:false,fair:false,live:false};
function profitRollupPanelV285(type){return document.getElementById(type+'ProfitRollupV285')}
function displayDateFromIsoV285(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:String(iso||'')}
function dateKeyV285(display){const m=String(display||'').match(/^(\d{2})-(\d{2})-(\d{4})$/);return m?`${m[3]}${m[2]}${m[1]}`:''}
function selectedMonthDisplayV285(){const v=document.getElementById('monthPicker')?.value||monthISO();return String(v||'').slice(5,7)+'-'+String(v||'').slice(0,4)}
function rowTurnoverV285(type,name,start,end){
  const sk=dateKeyV285(start),ek=dateKeyV285(end);let total=0;
  dedupeRows(rows).forEach(r=>{if(r.type!==type)return;const dk=dateKeyV285(r.date);if(!dk||dk<sk||dk>ek)return;
    if(type==='daily'){const company=String(name||'').toLowerCase().includes('balakong')?'balakong':'belimbing';if(r.company!==company)return;}else if(type==='live'){if(normalizeLiveHostKey(r.location)!==normalizeLiveHostKey(name))return;}else if(normalizeFairLocationKey(r.location)!==normalizeFairLocationKey(name))return;
    total+=Number(r.amount||0);
  });return total;
}
function linksProfitV285(links,type,name,start,end){const sk=dateKeyV285(start),ek=dateKeyV285(end);return (links||[]).reduce((sum,x)=>{if(String(x.type||'')!==type)return sum;const dk=dateKeyV285(x.date);if(!dk||dk<sk||dk>ek)return sum;if(type==='daily'){const wanted=String(name||'').toLowerCase().includes('balakong')?'balakong':'belimbing',actual=String(x.location||'Belimbing').toLowerCase().includes('balakong')?'balakong':'belimbing';return wanted===actual?sum+Number(x.profit||0):sum}if(type==='live'&&normalizeLiveHostKey(x.location)!==normalizeLiveHostKey(name))return sum;if(type==='fair'&&normalizeFairLocationKey(x.location)!==normalizeFairLocationKey(name))return sum;return sum+Number(x.profit||0)},0)}
function profitRollupCardV285(title,start,end,sales,profit){const rate=sales>0?profit/sales*100:0;return `<div class="profit-rollup-card-v285"><div class="profit-rollup-title-v285">${escapeChangeLogHtmlV200(title)}</div><div class="profit-rollup-date-v285">${start}${end&&end!==start?' ～ '+end:''}</div><div class="profit-rollup-metrics-v285"><div><span>营业</span><b>RM${formatAmount(sales)}</b></div><div><span>利润</span><b>RM${formatAmount(profit)}</b></div><div><span>利润率</span><b>${rate.toFixed(2)}%</b></div></div></div>`}
async function renderProfitRollupV285(type){
  const panel=profitRollupPanelV285(type);if(!panel)return;panel.innerHTML='<div class="product-link-loading-v231">正在计算营业 / 利润…</div>';
  const month=selectedMonthDisplayV285(),links=await loadAllSalesProductLinksV203({force:true,maxAgeMs:0});let cards=[];
  if(type==='fair'){
    const sessions=(Array.isArray(fairSessionsCloudV281)?fairSessionsCloudV281:[]).filter(x=>x&&x.location&&x.start&&x.end&&String((/^\d{4}-/.test(String(x.start))?isoToDisplay(x.start):x.start)).slice(3)===month);
    const seen=new Set();sessions.sort((a,b)=>dateKeyV285(/^\d{4}-/.test(String(a.start))?isoToDisplay(a.start):a.start).localeCompare(dateKeyV285(/^\d{4}-/.test(String(b.start))?isoToDisplay(b.start):b.start))).forEach(x=>{const start=/^\d{4}-/.test(String(x.start))?isoToDisplay(x.start):x.start,end=/^\d{4}-/.test(String(x.end))?isoToDisplay(x.end):x.end,key=[normalizeFairLocationKey(x.location),start,end].join('|');if(seen.has(key))return;seen.add(key);const sales=rowTurnoverV285('fair',x.location,start,end),profit=linksProfitV285(links,'fair',x.location,start,end);cards.push({title:x.location,start,end,sales,profit})});
  }else if(type==='live'){
    const monthRows=dedupeRows(rows).filter(r=>r.type==='live'&&String(r.date||'').slice(3)===month),names=[...new Set(monthRows.map(r=>canonicalLiveHost(r.location)).filter(Boolean))].sort();const start='01-'+month;let lastDay=31;const [mm,yy]=month.split('-').map(Number);lastDay=new Date(yy,mm,0).getDate();const end=String(lastDay).padStart(2,'0')+'-'+month;names.forEach(name=>cards.push({title:name,start,end,sales:rowTurnoverV285('live',name,start,end),profit:linksProfitV285(links,'live',name,start,end)}));
  }else{
    const start='01-'+month,[mm,yy]=month.split('-').map(Number),end=String(new Date(yy,mm,0).getDate()).padStart(2,'0')+'-'+month;cards=['Balakong','Belimbing'].map(name=>({title:name,start,end,sales:rowTurnoverV285('daily',name,start,end),profit:linksProfitV285(links,'daily',name,start,end)}));
  }
  const totalSales=cards.reduce((s,x)=>s+x.sales,0),totalProfit=cards.reduce((s,x)=>s+x.profit,0),totalRate=totalSales>0?totalProfit/totalSales*100:0;
  const label=type==='fair'?'Fair':type==='live'?'Live':'Sales';panel.innerHTML=`<div class="profit-rollup-head-v285"><b>${label} · ${month}</b></div>${cards.length?cards.map(x=>profitRollupCardV285(x.title,x.start,x.end,x.sales,x.profit)).join(''):'<div class="product-profit-empty">这个月份没有资料</div>'}<div class="profit-rollup-total-v285"><strong>${label} 总计</strong><div><span>营业</span><b>RM${formatAmount(totalSales)}</b></div><div><span>利润</span><b>RM${formatAmount(totalProfit)}</b></div><div><span>整体利润率</span><b>${totalRate.toFixed(2)}%</b></div></div>`;
}
async function toggleProfitRollupV285(type,button){const panel=profitRollupPanelV285(type);if(!panel)return;if(profitRollupOpenV285[type]&&!panel.classList.contains('hidden')){profitRollupOpenV285[type]=false;panel.classList.add('hidden');if(button)button.textContent=`📊 ${type==='fair'?'Fair':type==='live'?'Live':'Sales'} 营业 / 利润汇总`;return}if(button){button.disabled=true;button.textContent='读取中…'}try{if(type==='fair')await refreshFairSessionsV281({applyLatest:false});await renderProfitRollupV285(type);panel.classList.remove('hidden');profitRollupOpenV285[type]=true;if(button)button.textContent='📊 收起营业 / 利润汇总'}catch(e){alert('读取营业 / 利润汇总失败：'+(e.message||e))}finally{if(button)button.disabled=false}}
window.toggleProfitRollupV285=toggleProfitRollupV285;

/* ================= V29.9 Fair / Live 每日・分组・总利润 ================= */
let monthlyProfitRenderTokenV294={fair:0,live:0};
function profitByDayV294(links,type,name,date){
  return (Array.isArray(links)?links:[]).reduce((sum,x)=>{
    if(String(x.type||'')!==type||String(x.date||'')!==String(date||''))return sum;
    if(type==='fair'&&normalizeFairLocationKey(x.location)!==normalizeFairLocationKey(name))return sum;
    if(type==='live'&&normalizeLiveHostKey(x.location)!==normalizeLiveHostKey(name))return sum;
    return sum+Number(x.profit||0);
  },0);
}
function marginTextV294(profit,sales){return (sales>0?profit/sales*100:0).toFixed(2)+'%'}
function fairProfitRowV294(r,profit,hasCards=true){
  const sales=Number(r.amount||0);
  return `<div class="month-profit-row-v294"><span>${r.date}</span><strong>${money(sales)}</strong><strong class="profit-value-v294">${hasCards?money(profit):'--'}</strong><strong class="profit-rate-v294">${hasCards?marginTextV294(profit,sales):'--'}</strong></div>`;
}
function shortDayMonthV297(date){
  const text=String(date||'').trim();
  const m=text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if(m)return `${m[1]}-${m[2]}`;
  const iso=displayToISO(text);
  const im=String(iso||'').match(/^\d{4}-(\d{2})-(\d{2})$/);
  return im?`${im[2]}-${im[1]}`:text;
}
function liveProfitRowV294(r,profit,hasCards=true){
  const sales=Number(r.amount||0);
  return `<div class="month-profit-row-v294 live-profit-row-v294"><span>${shortDayMonthV297(r.date)}</span><strong>${money(sales)}</strong><strong class="live-commission-value-v297">${money(r.commissionAmount)}</strong><strong class="profit-value-v294">${hasCards?money(profit):'--'}</strong><strong class="profit-rate-v294">${hasCards?marginTextV294(profit,sales):'--'}</strong></div>`;
}
function profitHeadV294(){return `<div class="month-profit-row-v294 month-profit-head-v294"><span>日期</span><span>营业额</span><span>利润</span><span>利润率</span></div>`}
function liveProfitHeadV297(group){
  const rates=[...new Set((group&&Array.isArray(group.rows)?group.rows:[]).map(r=>Number(r.commissionRate||0).toFixed(2).replace(/\.00$/,'')).filter(Boolean))];
  const label=rates.length===1?`佣金 ${rates[0]}%`:'佣金';
  return `<div class="month-profit-row-v294 live-profit-row-v294 live-profit-head-v297"><span>日期</span><span>营业额</span><span>${label}</span><span>利润</span><span>利润率</span></div>`;
}

renderFairMonthlyList=function(){
  const container=document.getElementById("fairMonthlyList"),totalEl=document.getElementById("fairMonthlySalesTotal"),titleEl=document.getElementById("fairMonthlyTitle"),labelEl=document.getElementById("fairMonthlyTotalLabel");
  if(!container||!totalEl)return;
  const month=monthFromDateControl("fairStart"),monthLabel=/^\d{4}-\d{2}$/.test(month)?`${month.slice(5,7)}-${month.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`${monthLabel} 销售记录`;
  if(labelEl)labelEl.textContent=`${monthLabel} 总销售额`;
  const list=rows.filter(r=>r.type==="fair"&&displayToISO(r.date).slice(0,7)===month&&Number(r.amount)>0).map(r=>({...r,displayLocation:canonicalLocation(r.location||"Fair")})).sort((a,b)=>a.displayLocation.localeCompare(b.displayLocation,"en",{sensitivity:"base"})||displayToISO(a.date).localeCompare(displayToISO(b.date)));
  const total=list.reduce((sum,r)=>sum+Number(r.amount||0),0); totalEl.textContent=money(total);
  const fairRate=getFairCommissionRate(total),fairRatePct=Number((fairRate*100).toFixed(2)),fairCommissionTotal=total*fairRate;
  const monthlyCommissionEl=document.getElementById("fairMonthlyCommissionTotal"),monthlyCommissionLabel=document.getElementById("fairMonthlyCommissionLabel");
  if(monthlyCommissionEl)monthlyCommissionEl.textContent=money(fairCommissionTotal);
  if(monthlyCommissionLabel)monthlyCommissionLabel.textContent=`${monthLabel} 总佣金 ${fairRatePct}%`;
  if(!list.length){container.innerHTML='<div class="sub">这个月份还没有 Fair 记录</div>';if(monthlyCommissionEl)monthlyCommissionEl.textContent="0.00";renderFairPageTop3();return;}
  const locations=[];list.forEach(r=>{const key=normalizeFairLocationKey(r.displayLocation);let g=locations.find(x=>x.key===key);if(!g){g={key,name:r.displayLocation,latestDate:r.date,rows:[]};locations.push(g)}else if(displayToISO(r.date)>=displayToISO(g.latestDate)){g.name=r.displayLocation;g.latestDate=r.date}g.rows.push(r)});
  const token=++monthlyProfitRenderTokenV294.fair;
  container.innerHTML=locations.map(group=>{const sales=group.rows.reduce((s,r)=>s+Number(r.amount||0),0),commission=sales*fairRate;return `<div class="month-record-group month-profit-group-v294" data-profit-group="${escapeChangeLogHtmlV200(group.name)}"><div class="month-record-group-title fair-location-title-v298"><span>${escapeChangeLogHtmlV200(group.name)}</span><b>佣金 ${fairRatePct}% · RM${money(commission)}</b></div>${profitHeadV294()}${group.rows.map(r=>`<div class="month-profit-row-v294"><span>${r.date}</span><strong>${money(Number(r.amount||0))}</strong><strong class="profit-value-v294">--</strong><strong class="profit-rate-v294">--</strong></div>`).join('')}<div class="month-profit-row-v294 month-profit-total-v294"><span>总数</span><strong>${money(sales)}</strong><strong class="profit-value-v294">--</strong><strong class="profit-rate-v294">--</strong></div></div>`}).join('')+`<div id="fairProfitGrandV294" class="profit-grand-v294"><strong>全部地点总计</strong><div><span>营业额</span><b>${money(total)}</b></div><div><span>利润</span><b>0.00</b></div><div><span>整体利润率</span><b>0.00%</b></div></div>`;
  renderFairPageTop3();
  profitLinksForMonthPromiseV496('fair',month).then(links=>{
    if(token!==monthlyProfitRenderTokenV294.fair)return;
    container.innerHTML=locations.map(group=>{
      let groupProfit=0,groupSales=0,groupCardCount=0;
      const rowsHtml=group.rows.map(r=>{const p=profitByDayV294(links,'fair',group.name,r.date),hasCards=hasProfitCardsForContextV501(links,'fair',group.name,r.date);if(hasCards)groupCardCount++;groupProfit+=p;groupSales+=Number(r.amount||0);return fairProfitRowV294(r,p,hasCards)}).join('');
      const groupCommission=groupSales*fairRate;
      return `<div class="month-record-group month-profit-group-v294"><div class="month-record-group-title fair-location-title-v298"><span>${escapeChangeLogHtmlV200(group.name)}</span><b>佣金 ${fairRatePct}% · RM${money(groupCommission)}</b></div>${profitHeadV294()}${rowsHtml}<div class="month-profit-row-v294 month-profit-total-v294"><span>总数</span><strong>${money(groupSales)}</strong><strong class="profit-value-v294">${groupCardCount?money(groupProfit):'--'}</strong><strong class="profit-rate-v294">${groupCardCount?marginTextV294(groupProfit,groupSales):'--'}</strong></div></div>`;
    }).join('');
    const totalProfit=locations.reduce((sum,g)=>sum+g.rows.reduce((s,r)=>s+profitByDayV294(links,'fair',g.name,r.date),0),0);
    container.insertAdjacentHTML('beforeend',`<div id="fairProfitGrandV294" class="profit-grand-v294"><strong>全部地点总计</strong><div><span>营业额</span><b>${money(total)}</b></div><div><span>利润</span><b>${money(totalProfit)}</b></div><div><span>整体利润率</span><b>${marginTextV294(totalProfit,total)}</b></div></div>`);
  }).catch(e=>console.warn('V29.9 Fair 利润读取失败',e));
};

renderLiveMonthlyList=function(){
  const container=document.getElementById("liveMonthlyList"),totalEl=document.getElementById("liveSelectedHostTotal"),commissionTotalEl=document.getElementById("liveSelectedCommissionTotal"),titleEl=document.getElementById("liveMonthlyTitle"),totalLabelEl=document.getElementById("liveMonthlyTotalLabel"),commissionLabelEl=document.getElementById("liveMonthlyCommissionLabel");
  if(!container||!totalEl)return;
  const liveMonth=getLiveSelectedMonth(),monthLabel=/^\d{4}-\d{2}$/.test(liveMonth)?`${liveMonth.slice(5,7)}-${liveMonth.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`${monthLabel} 销售记录`;if(totalLabelEl)totalLabelEl.textContent=`${monthLabel} 总销售额`;if(commissionLabelEl)commissionLabelEl.textContent=`${monthLabel} 总佣金`;
  const list=rows.filter(r=>r.type==="live"&&displayToISO(r.date).slice(0,7)===liveMonth&&Number(r.amount)>0).map(r=>{const rate=getLiveHostRate(r.location,r.date),amount=Number(r.amount||0);return{...r,displayHost:canonicalLiveHost(r.location),commissionRate:rate,commissionAmount:amount*rate/100}}).sort((a,b)=>a.displayHost.localeCompare(b.displayHost,"en",{sensitivity:"base"})||displayToISO(a.date).localeCompare(displayToISO(b.date)));
  const total=list.reduce((s,r)=>s+Number(r.amount||0),0),commissionTotal=list.reduce((s,r)=>s+Number(r.commissionAmount||0),0);totalEl.textContent=money(total);if(commissionTotalEl)commissionTotalEl.textContent=money(commissionTotal);
  if(!list.length){container.innerHTML='<div class="sub">这个月份还没有 Live 记录</div>';renderLivePageTop3();return;}
  const groups=[];list.forEach(r=>{const key=normalizeLiveHostKey(r.displayHost);let g=groups.find(x=>x.key===key);if(!g){g={key,name:r.displayHost,rows:[]};groups.push(g)}g.rows.push(r)});
  const token=++monthlyProfitRenderTokenV294.live;
  container.innerHTML=groups.map(group=>{const sales=group.rows.reduce((s,r)=>s+Number(r.amount||0),0),comm=group.rows.reduce((s,r)=>s+Number(r.commissionAmount||0),0);return `<div class="live-sales-group month-profit-group-v294"><div class="live-sales-group-title"><span>${escapeChangeLogHtmlV200(group.name)}</span></div>${liveProfitHeadV297(group)}${group.rows.map(r=>`<div class="month-profit-row-v294 live-profit-row-v294"><span>${shortDayMonthV297(r.date)}</span><strong>${money(Number(r.amount||0))}</strong><strong class="live-commission-value-v297">${money(Number(r.commissionAmount||0))}</strong><strong class="profit-value-v294">--</strong><strong class="profit-rate-v294">--</strong></div>`).join('')}<div class="month-profit-row-v294 live-profit-row-v294 month-profit-total-v294"><span>总数</span><strong>${money(sales)}</strong><strong class="live-commission-value-v297">${money(comm)}</strong><strong class="profit-value-v294">--</strong><strong class="profit-rate-v294">--</strong></div></div>`}).join('')+`<div class="profit-grand-v294"><strong>全部主播总计</strong><div><span>营业额</span><b>${money(total)}</b></div><div><span>利润</span><b>0.00</b></div><div><span>整体利润率</span><b>0.00%</b></div></div>`;
  renderLivePageTop3();
  profitLinksForMonthPromiseV496('live',liveMonth).then(links=>{
    if(token!==monthlyProfitRenderTokenV294.live)return;
    container.innerHTML=groups.map(group=>{let gp=0,gs=0,cardCount=0;const comm=group.rows.reduce((s,r)=>s+Number(r.commissionAmount||0),0);const html=group.rows.map(r=>{const p=profitByDayV294(links,'live',group.name,r.date),hasCards=hasProfitCardsForContextV501(links,'live',group.name,r.date);if(hasCards)cardCount++;gp+=p;gs+=Number(r.amount||0);return liveProfitRowV294(r,p,hasCards)}).join('');return `<div class="live-sales-group month-profit-group-v294"><div class="live-sales-group-title"><span>${escapeChangeLogHtmlV200(group.name)}</span></div>${liveProfitHeadV297(group)}${html}<div class="month-profit-row-v294 live-profit-row-v294 month-profit-total-v294"><span>总数</span><strong>${money(gs)}</strong><strong class="live-commission-value-v297">${money(comm)}</strong><strong class="profit-value-v294">${cardCount?money(gp):'--'}</strong><strong class="profit-rate-v294">${cardCount?marginTextV294(gp,gs):'--'}</strong></div></div>`}).join('');
    const totalProfit=groups.reduce((sum,g)=>sum+g.rows.reduce((s,r)=>s+profitByDayV294(links,'live',g.name,r.date),0),0);
    container.insertAdjacentHTML('beforeend',`<div class="profit-grand-v294"><strong>全部主播总计</strong><div><span>营业额</span><b>${money(total)}</b></div><div><span>利润</span><b>${money(totalProfit)}</b></div><div><span>整体利润率</span><b>${marginTextV294(totalProfit,total)}</b></div></div>`);
  }).catch(e=>console.warn('V29.9 Live 利润读取失败',e));
};

/* ================= V35.0 authoritative save/context fixes ================= */
const FAIR_TURNOVER_SAVE_REV_V346=new Map(),LIVE_TURNOVER_SAVE_REV_V346=new Map();
function turnoverRevKeyV346(type,date,location){return `${type}|${date}|${type==='fair'?normalizeFairLocationKey(location):normalizeLiveHostKey(location)}`}
function nextTurnoverRevV346(map,key){const n=Number(map.get(key)||0)+1;map.set(key,n);return n}

saveLiveSales=async function(){
  if(!ensureWritableSelection())return;
  const dateEl=document.getElementById('liveDate'),hostInput=document.getElementById('liveHost'),amountEl=document.getElementById('liveSales');
  const d=isoToDisplay(dateEl?.value||'');let host=selectedLiveHost();const amount=toAmount(amountEl?.value||0);
  if(!host){alert('请输入主播名字');return}if(!d){alert('请选择日期');return}
  host=reactivateLiveHostIfNeeded(host).host;hostInput.value=host;saveLiveHost(host);saveLastLiveSession(host,dateEl.value);
  const now=new Date().toISOString(),mutation=nextClientMutationV344();
  const previous=rows.find(r=>r.type==='live'&&r.date===d&&normalizeLiveHostKey(r.location)===normalizeLiveHostKey(host));
  const localRow={type:'live',date:d,company:'live',location:host,amount,updatedAt:now,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:String(previous?.updatedAt||'')};
  const key=turnoverRevKeyV346('live',d,host),rev=nextTurnoverRevV346(LIVE_TURNOVER_SAVE_REV_V346,key);
  if(amount<=0)rows=rows.filter(r=>syncKey(r)!==syncKey(localRow));else upsertLocalRow(localRow);
  addPendingRow(localRow);if(typeof markLocalRowMutation==='function')markLocalRowMutation(localRow);saveLocalDataCache();renderAll();setSync('Live 已保存到本机 · 正在同步云端...');
  try{
    const saved=await saveLiveToSheet(d,host,amount,now,mutation.clientDeviceId||'',Number(mutation.clientSequence||0),localRow.baseCloudUpdatedAt,true);
    if(LIVE_TURNOVER_SAVE_REV_V346.get(key)!==rev)return;
    if(saved&&Number(saved.amount)>0)upsertLocalRow(saved);else rows=rows.filter(r=>syncKey(r)!==syncKey(localRow));
    if(!isLive&&saved&&Number(saved.amount)>0)saveFairLocation(entity);
    clearPendingRowIfVersionV343(localRow);saveLocalDataCache();renderAll();showTempMsg('liveSaveMsg');setSync('已同步',true);
  }catch(e){if(LIVE_TURNOVER_SAVE_REV_V346.get(key)===rev)setPendingRetrySyncStatus()}
};
window.saveLiveSales=saveLiveSales;

saveFairSales=async function(){
  const raw=String(document.getElementById('fairLocation')?.value||'').trim();if(!raw){alert('请先输入 Fair 地点');return}if(!ensureWritableSelection())return;
  const loc=canonicalLocation(raw),inputs=[...document.querySelectorAll('.fairAmount[data-date]')];if(!inputs.length){alert('请选择 Fair 日期');return}
  document.getElementById('fairLocation').value=loc;
  const now=new Date().toISOString(),mutation=nextClientMutationV344(),records=[];
  inputs.forEach(input=>{
    const date=String(input.dataset.date||''),amount=toAmount(input.value),previous=rows.find(r=>r.type==='fair'&&r.date===date&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));
    if(Math.abs(amount-Number(previous?.amount||0))<=0.005)return;
    const rec={date,amount,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:String(previous?.updatedAt||'')};records.push(rec);
    const row={type:'fair',date,company:'fair',location:loc,amount,updatedAt:now,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:rec.baseCloudUpdatedAt};
    if(amount<=0)rows=rows.filter(r=>syncKey(r)!==syncKey(row));else upsertLocalRow(row);
    addPendingRow(row);if(typeof markLocalRowMutation==='function')markLocalRowMutation(row);
  });
  const start=document.getElementById('fairStart').value,end=document.getElementById('fairEnd').value;
  saveLocalFairSessionV320(loc,start,end,now);saveFairLocation(loc);fairSessionDraftDirtyV282=false;saveLocalDataCache();renderAll();syncFairInputs();syncFairProductDatesV203(false);
  if(!records.length){setSync('Fair 日期范围已储存 · 正在同步云端...');try{await saveFairSessionToSheetV281(loc,start,end);setSync('已同步',true)}catch(_){setSync('Fair 日期范围已储存 · 云端待同步',false,true)}return}
  const contextKey=normalizeFairLocationKey(loc),rev=nextTurnoverRevV346(FAIR_TURNOVER_SAVE_REV_V346,contextKey);setSync('Fair 已保存到本机 · 正在同步云端...');
  try{
    const result=await saveFairBatchToSheet(loc,records,true);if(FAIR_TURNOVER_SAVE_REV_V346.get(contextKey)!==rev)return;
    (result?.rows||[]).forEach(r=>{if(Number(r.amount||0)<=0)rows=rows.filter(x=>syncKey(x)!==syncKey(r));else upsertLocalRow(r)});
    records.forEach(i=>clearPendingRowIfVersionV343({type:'fair',date:i.date,company:'fair',location:loc,clientUpdatedAt:i.clientUpdatedAt}));
    saveLocalDataCache();renderAll();syncFairInputs();syncFairProductDatesV203(false);showTempMsg('fairSaveMsg');setSync('已同步',true);
    Promise.resolve(saveFairSessionToSheetV281(loc,start,end)).then(()=>refreshFairSessionsV281()).catch(()=>{});
  }catch(e){if(FAIR_TURNOVER_SAVE_REV_V346.get(contextKey)===rev)setPendingRetrySyncStatus()}
};
window.saveFairSales=saveFairSales;

syncQueuedSalesDraftV314=async function(key,expectedToken=''){
  const older=SALES_DRAFT_INFLIGHT_V314.get(key);
  if(older){try{await older}catch(_){}const latest=readSalesDraftPendingV314()[key];if(!latest)return{ok:true,skipped:true};if(expectedToken&&String(latest.token)!==String(expectedToken))return{ok:true,stale:true};return syncQueuedSalesDraftV314(key,latest.token)}
  const entry=readSalesDraftPendingV314()[key];if(!entry)return{ok:true,skipped:true};if(expectedToken&&String(entry.token)!==String(expectedToken))return{ok:true,stale:true};
  const task=(async()=>{try{
    const result=await window.saveSalesProductLinksApiV241(entry.items,'draft',Number(entry.restoreGeneration||0),String(entry.clientDeviceId||''),Number(entry.clientSequence||0),Array.isArray(entry.deletedLinkIds)?entry.deletedLinkIds:[],entry.baseSalesCardRevision),latest=readSalesDraftPendingV314()[key];
    if(latest&&String(latest.token)===String(entry.token)){
      const deletedIds=Array.isArray(entry.deletedLinkIds)?entry.deletedLinkIds:[];
      if(result?.staleMutation&&deletedIds.length){
        const all=readSalesDraftPendingV314(),cur=all[key];
        if(cur&&String(cur.token)===String(entry.token)){
          const m=nextClientMutationV344();
          all[key]={...cur,clientDeviceId:String(m.clientDeviceId||''),clientSequence:Number(m.clientSequence||0),token:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),savedAt:Date.now()};
          writeSalesDraftPendingV314(all);scheduleSalesDraftRetryV314(80);
        }
        setSync('删除产品正在重新确认云端版本...',false,true);
        return result;
      }
      const saved=Array.isArray(result?.links)?result.links:entry.items;
      if(!acknowledgeDeletedSalesLinksV351(entry.type,entry.date,entry.location,deletedIds,saved)){
        scheduleSalesDraftRetryV314(300);throw new Error('云端仍返回已删除产品，继续保留删除保护');
      }
      removeSalesDraftPendingV314(key,entry.token);
      const authoritativeSaved=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(saved):saved;
      const mergedContextV424=mergeSingleCardDraftAckV424(entry,authoritativeSaved);
      setCachedSalesProductLinksV216(entry.type,entry.date,entry.location,mergedContextV424);setSalesCardPersistentCacheV232(entry.type,entry.date,entry.location,mergedContextV424);if(typeof replaceProfitAggregateContextV457==='function')replaceProfitAggregateContextV457(entry.type,entry.date,entry.location,mergedContextV424);else mergeDailyProfitContextCacheV237(entry.type,entry.date,entry.location,mergedContextV424);
      const acknowledgedTxnIdsV511=new Set(entry.items.map(x=>String(x.transactionId||'')).filter(Boolean));
      refreshProfitAggregateCachesV321(authoritativeSaved,[...acknowledgedTxnIdsV511]);applyCloudDraftStatusesV322(entry.type,mergedContextV424);
      const ctxNow=productLinkContextV206(entry.type);
      // V51.1: the cloud ACK is authoritative for this exact queued draft. Clear
      // only those acknowledged cards' local dirty flags so navigation no longer
      // warns after "保存成功". This is DOM-only bookkeeping: no API call, polling,
      // save/delete path, calculation, Import ACK, or synchronization timing changes.
      const exactVisibleContextV511=String(ctxNow.date||'')===String(entry.date||'')&&salesCardContextKeyV245(entry.type,ctxNow.date,ctxNow.location)===salesCardContextKeyV245(entry.type,entry.date,entry.location);
      if(exactVisibleContextV511){
        salesCardWrappersV239(entry.type).forEach(card=>{
          if(!acknowledgedTxnIdsV511.has(String(card.dataset.transactionId||'')))return;
          clearSalesCardTransactionDirtyV239(card);delete card.dataset.productRemovedV259;
          card.querySelectorAll('.product-link-item').forEach(item=>{item.dataset.saved='1';item.dataset.dirty='0'});
          const tag=card.querySelector('.sales-card-header-v239 b:first-child');if(tag)tag.textContent='已保存销售卡';
          if(card._renderSalesStateV317)card._renderSalesStateV317();updateSalesCardDeleteLockV322(card);
        });
        renumberSavedSalesCardsV241(entry.type);refreshConfirmSaleButtonV322(entry.type);
      }
      const hasOpenUnsavedCard=salesCardWrappersV239(entry.type).some(card=>!salesCardIsSavedV241(card));
      if(String(ctxNow.date||'')===String(entry.date||'')&&salesCardContextKeyV245(entry.type,ctxNow.date,ctxNow.location)===salesCardContextKeyV245(entry.type,entry.date,entry.location)&&!productImportSearchIsActiveV226(entry.type)&&!hasOpenUnsavedCard){invalidateSalesCardLoadRequestsV351(entry.type);renderProductLinksEditorV206(entry.type,mergedContextV424)}
      setSync('已同步',true);
      scheduleCompleteSalesCardReconcileV425(entry.type,entry.date,entry.location);
    }return result;
  }catch(err){setSync('草稿已安全保存 · 云端待同步',false,true);scheduleSalesDraftRetryV314(5000);throw err}finally{SALES_DRAFT_INFLIGHT_V314.delete(key)}})();
  SALES_DRAFT_INFLIGHT_V314.set(key,task);return task;
};

const _productProfitSalesByGroupV346=productProfitSalesByGroupV216;
productProfitSalesByGroupV216=function(type,date){const map=_productProfitSalesByGroupV346(type,date);if(type!=='fair')return map;const wanted=normalizeFairLocationKey(document.getElementById('fairLocation')?.value||'');[...map.keys()].forEach(key=>{if(key!==wanted)map.delete(key)});return map};
const _productProfitGroupLinksV346=productProfitGroupLinksV216;
productProfitGroupLinksV216=function(type,date,links){const groups=_productProfitGroupLinksV346(type,date,links);if(type!=='fair')return groups;const wanted=normalizeFairLocationKey(document.getElementById('fairLocation')?.value||'');[...groups.keys()].forEach(key=>{if(key!==wanted)groups.delete(key)});return groups};

function refreshFairExactContextV346(){
  syncFairProductDatesV203(false);const amount=selectedActionAmountV270('fair');
  const panel=productProfitSummaryPanelV216('fair');if(panel){panel.classList.add('hidden');panel.innerHTML=''}productProfitSummaryOpenV216.fair=false;
  const log=document.getElementById(changeLogPanelIdV200('fair'));if(log){log.classList.add('hidden');log.innerHTML=''}salesChangeLogOpenV200.fair=false;
  if(amount<=0.005)closeZeroSalesPanelsV271('fair');else if(productLinkBoxIsOpenV210('fair'))loadProductLinksIntoEditorV206('fair').catch(()=>{});
  refreshSalesActionLocksV270();
}
handleFairProductDateChangeV342=function(){refreshFairExactContextV346();return true};window.handleFairProductDateChangeV342=handleFairProductDateChangeV342;
['fairLocation','fairStart','fairEnd'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>setTimeout(refreshFairExactContextV346,0)));

/* ================= V35.0 whole-card delete/cache authority ================= */
const _removeProductLinkItemV349=removeProductLinkItemV206;
removeProductLinkItemV206=async function(type,id){
  const ctx=productLinkContextV206(type),wrap=document.getElementById(ctx.pre+'ProductItems'),el=wrap?.querySelector(`[data-product-link-item="${id}"]`);
  if(!el)return;
  const linkId=String(el.dataset.linkId||''),saved=el.dataset.saved==='1';
  if(!linkId||!saved)return _removeProductLinkItemV349(type,id);
  if(!confirm('确定删除这个已保存产品？\n\n删除会同步到云端，旧草稿不能再把它恢复。'))return;
  try{
    setSync('正在从销售卡及云端删除产品...');
    rememberDeletedSalesLinkV350(type,ctx.date,ctx.location,linkId);
    invalidateSalesCardLoadRequestsV351(type);
    await deleteSalesProductLinkV206(linkId);
    purgeDeletedSalesLinkV348(linkId);
    invalidateSalesCardLoadRequestsV351(type);
    clearDeletedSalesLinkIdsV350(type,ctx.date,ctx.location,[linkId]);
    el.remove();
    const cloud=await loadSalesProductLinksV206(type,ctx.date,ctx.location,{force:true,maxAgeMs:0});
    setCachedSalesProductLinksV216(type,ctx.date,ctx.location,cloud);
    setSalesCardPersistentCacheV232(type,ctx.date,ctx.location,cloud);
    mergeDailyProfitContextCacheV237(type,ctx.date,ctx.location,cloud);
    refreshProfitAggregateCachesV321(cloud,[...new Set(cloud.map(x=>String(x.transactionId||'')).filter(Boolean))]);
    renderProductLinksEditorV206(type,cloud);recalcProductLinkSummaryV206(type);
    setSync('已同步',true);
  }catch(e){alert('删除产品失败：'+(e.message||e));setSync('产品删除失败 · 未改变云端资料',false,true)}
};
window.removeProductLinkItemV206=removeProductLinkItemV206;

removeProductFromTransactionV239=async function(type,card,item){
  if(!item||item.dataset.deletingV253==='1')return;
  // V50.8: X is an edit action only. Confirmed cards are immutable, while an
  // editable draft must stay DRAFT throughout the local edit.
  if(salesCardIsConfirmedV322(card)){alert('这张销售卡已经确认并永久锁定，不能删除产品。');return}
  if(salesCardProductsV239(card).length<=1){alert('一张销售卡至少需要保留一个产品。');return}
  const linkId=String(item.dataset.linkId||''),saved=!!(linkId&&item.dataset.saved==='1');
  if(saved&&!confirm('确定从这张销售卡删除这个产品？\n\n删除会在点击「保存草稿」后正式同步到云端。'))return;
  item.dataset.deletingV253='1';
  // Keep the deletion only on this live editor until Save Draft starts. Do NOT
  // write a persistent tombstone or alter persistent Sales Card / Profit cache.
  // If the page is closed before Save Draft, the authoritative cloud card wins.
  if(linkId)rememberCardDeletedLinkV508(card,linkId);
  item.remove();normalizeDraftProductOrdersV503(card);
  card.dataset.confirmedOnceV401='0';
  card.dataset.inventoryStatus='DRAFT';
  card.querySelectorAll('.product-link-item').forEach(i=>{i.dataset.inventoryStatus='DRAFT';});
  markSalesCardTransactionDirtyV239(card);card.dataset.productRemovedV259='1';recalcSalesCardTransactionV239(card);
  if(card._renderSalesStateV317)card._renderSalesStateV317();
  updateSalesCardDeleteLockV322(card);refreshSingleCardActionsV405(card);
  setSync('产品已从本机草稿删除 · 请点击保存草稿同步云端',false,true);
};
window.removeProductFromTransactionV239=removeProductFromTransactionV239;


/* ================= V36.0 Fair = Live single-day workflow =================
   Fair keeps its V36.0 monthly report cards/commission display, but the edit
   workflow is intentionally identical to Live: entity + one date + turnover.
   Date Range and visible Sales Card associated-date selection are retired.
*/
function fairSelectedDateV353(){
  return isoToDisplay(String(document.getElementById('fairStart')?.value||''));
}
function fairSelectedLocationV353(){
  return canonicalLocation(String(document.getElementById('fairLocation')?.value||'').trim());
}
function updateFairSingleAmountV353(){
  const el=document.getElementById('fairSales');if(!el)return;
  const date=fairSelectedDateV353(),loc=fairSelectedLocationV353();
  const saved=rows.find(r=>r.type==='fair'&&r.date===date&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));
  el.value=formatAmount(saved?Number(saved.amount||0):0);
  const hidden=document.getElementById('fairInputs');
  if(hidden)hidden.innerHTML=`<input class="fairAmount" data-date="${date}" value="${el.value}">`;
  const sel=document.getElementById('fairProductDate');
  if(sel){sel.innerHTML=date?`<option value="${date}">${date}</option>`:'';sel.value=date||'';}
  if(typeof refreshSalesActionLocksV270==='function')refreshSalesActionLocksV270();
}
window.updateFairSingleAmountV353=updateFairSingleAmountV353;

updateFairPageMode=function(){
  const hasLocation=Boolean(fairSelectedLocationV353());
  document.getElementById('fairEditArea')?.classList.toggle('hidden',!hasLocation);
  document.getElementById('fairViewOnlyHint')?.classList.toggle('hidden',hasLocation);
  const label=document.getElementById('fairStartLabel');if(label)label.textContent='日期';
  const end=document.getElementById('fairEnd'),start=document.getElementById('fairStart');if(end&&start)end.value=start.value||'';
  if(hasLocation)updateFairSingleAmountV353();
};

syncFairInputs=function(){
  const start=document.getElementById('fairStart'),end=document.getElementById('fairEnd');
  if(end&&start)end.value=start.value||'';
  updateFairSingleAmountV353();
};
refreshFairInputsFromRows=function(force=false){updateFairSingleAmountV353();return true};
fairInputsHaveUnsavedChanges=function(){
  const el=document.getElementById('fairSales'),loc=fairSelectedLocationV353(),date=fairSelectedDateV353();
  if(!el||!loc||!date)return false;
  const saved=rows.find(r=>r.type==='fair'&&r.date===date&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));
  return Math.abs(toAmount(el.value)-Number(saved?.amount||0))>0.005;
};

syncFairProductDatesV203=function(){
  const date=fairSelectedDateV353(),sel=document.getElementById('fairProductDate');
  if(sel){sel.innerHTML=date?`<option value="${date}">${date}</option>`:'';sel.value=date||'';}
  if(typeof refreshSalesActionLocksV270==='function')refreshSalesActionLocksV270();
};
handleFairProductDateChangeV342=function(){refreshFairExactContextV346();return true};
window.handleFairProductDateChangeV342=handleFairProductDateChangeV342;

const _productLinkContextV353=productLinkContextV206;
productLinkContextV206=function(type){
  if(type!=='fair')return _productLinkContextV353(type);
  return{pre:'fair',date:fairSelectedDateV353(),location:fairSelectedLocationV353()};
};
const _selectedChangeLogDateV353=selectedChangeLogDateV200;
selectedChangeLogDateV200=function(type){return type==='fair'?fairSelectedDateV353():_selectedChangeLogDateV353(type)};
const _productProfitSelectedDateV353=productProfitSelectedDateV216;
productProfitSelectedDateV216=function(type){return type==='fair'?fairSelectedDateV353():_productProfitSelectedDateV353(type)};

// Date Range sessions are retained only as legacy data for Backup/old history.
// They no longer control Fair editing or Sales Card context.
switchFairLocationV320=function(location){
  const loc=canonicalLocation(location);if(!loc)return false;
  const input=document.getElementById('fairLocation');if(input)input.value=loc;
  saveFairLocation(loc);updateFairPageMode();updateFairSingleAmountV353();renderFairMonthlyList();refreshProductLinkContextV210('fair');return true;
};
applyFairSessionV281=function(){return false};
refreshFairSessionsV281=async function(){return Array.isArray(fairSessionsCloudV281)?fairSessionsCloudV281:[]};

// Same user-visible save lifecycle as Live: local authoritative draft + pending,
// render immediately, one cloud write, authoritative response, clear pending.
saveFairSales=async function(){
  if(!ensureWritableSelection())return;
  const dateEl=document.getElementById('fairStart'),locationInput=document.getElementById('fairLocation'),amountEl=document.getElementById('fairSales');
  const d=isoToDisplay(dateEl?.value||''),loc=fairSelectedLocationV353(),amount=toAmount(amountEl?.value||0);
  if(!loc){alert('请输入 Fair 地点');return}
  if(!d){alert('请选择日期');return}
  locationInput.value=loc;saveFairLocation(loc);
  const end=document.getElementById('fairEnd');if(end)end.value=dateEl.value||'';
  const now=new Date().toISOString(),mutation=nextClientMutationV344();
  const previous=rows.find(r=>r.type==='fair'&&r.date===d&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));
  const localRow={type:'fair',date:d,company:'fair',location:loc,amount,updatedAt:now,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:String(previous?.updatedAt||'')};
  const key=turnoverRevKeyV346('fair',d,loc),rev=nextTurnoverRevV346(FAIR_TURNOVER_SAVE_REV_V346,key);
  if(amount<=0)rows=rows.filter(r=>syncKey(r)!==syncKey(localRow));else upsertLocalRow(localRow);
  addPendingRow(localRow);if(typeof markLocalRowMutation==='function')markLocalRowMutation(localRow);saveLocalDataCache();renderAll();updateFairSingleAmountV353();setSync('Fair 已保存到本机 · 正在同步云端...');
  try{
    const result=await saveFairBatchToSheet(loc,[{date:d,amount,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:localRow.baseCloudUpdatedAt}],true);
    if(FAIR_TURNOVER_SAVE_REV_V346.get(key)!==rev)return;
    const saved=Array.isArray(result?.rows)?result.rows.find(r=>String(r.date||'')===d):null;
    if(saved&&Number(saved.amount)>0)upsertLocalRow(saved);else if(amount<=0)rows=rows.filter(r=>syncKey(r)!==syncKey(localRow));
    clearPendingRowIfVersionV343(localRow);saveLocalDataCache();renderAll();updateFairSingleAmountV353();showTempMsg('fairSaveMsg');setSync('已同步',true);
  }catch(e){if(FAIR_TURNOVER_SAVE_REV_V346.get(key)===rev)setPendingRetrySyncStatus()}
};
window.saveFairSales=saveFairSales;

// Keep Fair context synchronized exactly like Live when location/date changes.
document.getElementById('fairLocation')?.addEventListener('input',()=>{updateFairPageMode();updateFairSingleAmountV353();});
document.getElementById('fairLocation')?.addEventListener('change',()=>{updateFairPageMode();updateFairSingleAmountV353();refreshFairExactContextV346();});
document.getElementById('fairStart')?.addEventListener('change',()=>{const e=document.getElementById('fairEnd');if(e)e.value=document.getElementById('fairStart').value||'';updateFairSingleAmountV353();refreshFairExactContextV346();renderFairDailySummary();renderFairMonthlyList();});
document.getElementById('fairSales')?.addEventListener('input',()=>{const h=document.querySelector('#fairInputs .fairAmount');if(h)h.value=document.getElementById('fairSales').value;});
setTimeout(()=>{const e=document.getElementById('fairEnd'),s=document.getElementById('fairStart');if(e&&s)e.value=s.value||todayISO();updateFairPageMode();updateFairSingleAmountV353();},0);

/* V36.0 final alignment: Live and Fair call one single-day turnover engine. */
async function saveLiveFairSingleDayV353(type){
  if(!ensureWritableSelection())return;
  const isLive=type==='live';
  const dateEl=document.getElementById(isLive?'liveDate':'fairStart');
  const entityEl=document.getElementById(isLive?'liveHost':'fairLocation');
  const amountEl=document.getElementById(isLive?'liveSales':'fairSales');
  const d=isoToDisplay(dateEl?.value||'');
  let entity=isLive?selectedLiveHost():fairSelectedLocationV353();
  const amount=toAmount(amountEl?.value||0);
  if(!entity){alert(isLive?'请输入主播名字':'请输入 Fair 地点');return}
  if(!d){alert('请选择日期');return}

  if(isLive){
    entity=reactivateLiveHostIfNeeded(entity).host;
    entityEl.value=entity;saveLiveHost(entity);saveLastLiveSession(entity,dateEl.value);
  }else{
    entity=canonicalLocation(entity);entityEl.value=entity;
    const fairEnd=document.getElementById('fairEnd');if(fairEnd)fairEnd.value=dateEl.value||'';
  }

  const now=new Date().toISOString(),mutation=nextClientMutationV344();
  const normalizer=isLive?normalizeLiveHostKey:normalizeFairLocationKey;
  const previous=rows.find(r=>r.type===type&&r.date===d&&normalizer(r.location)===normalizer(entity));
  const localRow={type,date:d,company:type,location:entity,amount,updatedAt:now,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:String(previous?.updatedAt||'')};
  const revMap=isLive?LIVE_TURNOVER_SAVE_REV_V346:FAIR_TURNOVER_SAVE_REV_V346;
  const key=turnoverRevKeyV346(type,d,entity),rev=nextTurnoverRevV346(revMap,key);

  if(amount<=0)rows=rows.filter(r=>syncKey(r)!==syncKey(localRow));else upsertLocalRow(localRow);
  addPendingRow(localRow);if(typeof markLocalRowMutation==='function')markLocalRowMutation(localRow);
  saveLocalDataCache();renderAll();
  if(!isLive)updateFairSingleAmountV353();
  setSync(`${isLive?'Live':'Fair'} 已保存到本机 · 正在同步云端...`);

  try{
    let saved=null;
    if(isLive){
      saved=await saveLiveToSheet(d,entity,amount,now,mutation.clientDeviceId||'',Number(mutation.clientSequence||0),localRow.baseCloudUpdatedAt,true);
    }else{
      const result=await saveFairBatchToSheet(entity,[{date:d,amount,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:localRow.baseCloudUpdatedAt}],true);
      saved=Array.isArray(result?.rows)?result.rows.find(r=>String(r.date||'')===d):null;
    }
    if(revMap.get(key)!==rev)return;
    if(saved&&Number(saved.amount)>0)upsertLocalRow(saved);else rows=rows.filter(r=>syncKey(r)!==syncKey(localRow));
    clearPendingRowIfVersionV343(localRow);saveLocalDataCache();renderAll();
    if(!isLive)updateFairSingleAmountV353();
    showTempMsg(isLive?'liveSaveMsg':'fairSaveMsg');
    setSync('已同步',true);
  }catch(e){
    if(revMap.get(key)===rev)setPendingRetrySyncStatus();
  }
}
saveLiveSales=function(){return saveLiveFairSingleDayV353('live')};
saveFairSales=function(){return saveLiveFairSingleDayV353('fair')};
window.saveLiveSales=saveLiveSales;window.saveFairSales=saveFairSales;


/* ================= V36.0 Fair/Live UI + read-path parity =================
   Fair keeps its monthly Fair report cards, but the top editor now uses the
   same one-date interaction model as Live. Legacy Fair Session/Date Range data
   remains readable for Backup/history only and is not consulted here.
*/
const FAIR_TURNOVER_DRAFT_KEY_V356='lover_fair_turnover_drafts_v356';
function fairTurnoverDraftContextV356(){
  const date=String(document.getElementById('fairStart')?.value||''),loc=fairSelectedLocationV353();
  return date&&loc?date+'|'+normalizeFairLocationKey(loc):'';
}
function readFairTurnoverDraftsV356(){try{const v=JSON.parse(localStorage.getItem(FAIR_TURNOVER_DRAFT_KEY_V356)||'{}');return v&&typeof v==='object'?v:{}}catch(_){return{}}}
function getFairTurnoverDraftV356(){const k=fairTurnoverDraftContextV356();return k?readFairTurnoverDraftsV356()[k]||null:null}
function saveFairTurnoverDraftV356(value){const k=fairTurnoverDraftContextV356();if(!k)return;const d=readFairTurnoverDraftsV356();d[k]={value:String(value??''),updatedAt:Date.now()};try{localStorage.setItem(FAIR_TURNOVER_DRAFT_KEY_V356,JSON.stringify(d))}catch(_){}}
function clearFairTurnoverDraftV356(dateDisplay,location){const iso=displayToISO(String(dateDisplay||''));const k=iso&&location?iso+'|'+normalizeFairLocationKey(location):fairTurnoverDraftContextV356();if(!k)return;const d=readFairTurnoverDraftsV356();delete d[k];try{localStorage.setItem(FAIR_TURNOVER_DRAFT_KEY_V356,JSON.stringify(d))}catch(_){}}

updateFairSingleAmountV353=function(){
  const el=document.getElementById('fairSales'),resultEl=document.getElementById('fairDateResult');if(!el)return;
  const date=fairSelectedDateV353(),loc=fairSelectedLocationV353();
  const saved=rows.find(r=>r.type==='fair'&&r.date===date&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));
  const draft=getFairTurnoverDraftV356();
  el.value=draft?String(draft.value):formatAmount(saved?Number(saved.amount||0):0);
  if(resultEl)renderSavedTurnoverSummaryV333(resultEl,loc||'请选择或输入 Fair 地点',date,loc?(saved?Number(saved.amount||0):0):null);
  const hidden=document.getElementById('fairInputs');
  if(hidden)hidden.innerHTML=`<input class="fairAmount" data-date="${date}" value="${el.value}">`;
  const sel=document.getElementById('fairProductDate');
  if(sel){sel.innerHTML=date?`<option value="${date}">${date}</option>`:'';sel.value=date||'';}
  renderFairDailySummary();renderFairMonthlyList();
  if(typeof refreshSalesActionLocksV270==='function')refreshSalesActionLocksV270();
};
window.updateFairSingleAmountV353=updateFairSingleAmountV353;

// Fair product/profit/change-log dates are the visible selected Fair date only.
const _selectedChangeLogDateV356=selectedChangeLogDateV200;
selectedChangeLogDateV200=function(type){return type==='fair'?fairSelectedDateV353():_selectedChangeLogDateV356(type)};
const _productProfitSelectedDateV356=productProfitSelectedDateV216;
productProfitSelectedDateV216=function(type){return type==='fair'?fairSelectedDateV353():_productProfitSelectedDateV356(type)};
const _productLinkContextV356=productLinkContextV206;
productLinkContextV206=function(type){return type==='fair'?{pre:'fair',date:fairSelectedDateV353(),location:fairSelectedLocationV353()}:_productLinkContextV356(type)};

function installFairLiveParityV356(){
  // Strip V32-V35 anonymous Fair Session listeners by replacing only the two
  // user controls, then bind the same lightweight interactions used by Live.
  const oldLoc=document.getElementById('fairLocation');
  if(oldLoc&&oldLoc.dataset.v356Parity!=='1'){
    const loc=oldLoc.cloneNode(true);delete loc.dataset.guardV273;delete loc.dataset.fairDraftV282;delete loc.dataset.v358History;delete loc.dataset.v359History;loc.dataset.v356Parity='1';oldLoc.replaceWith(loc);
    loc.addEventListener('input',()=>updateFairSingleAmountV353());
    loc.addEventListener('change',()=>{updateFairSingleAmountV353();refreshProductLinkContextV210('fair')});
    loc.addEventListener('blur',()=>{const value=canonicalLocation(loc.value||'');loc.value=value;updateFairSingleAmountV353();refreshProductLinkContextV210('fair')});
  }
  const hidden=document.getElementById('fairStart');
  const field=hidden?.closest('.date-field');
  if(field&&field.dataset.v356Parity!=='1'){
    const clone=field.cloneNode(true);clone.dataset.v356Parity='1';field.replaceWith(clone);
    const date=document.getElementById('fairStart');
    const display=document.getElementById('fairStartDisplay');
    if(date){delete date.dataset.guardV273;delete date.dataset.fairDraftV282;}
    // V36.0 desktop fix: cloneNode copies dataset flags but not event listeners.
    // Clear the stale picker-bound marker and rebind the same native picker used by Live.
    if(display)delete display.dataset.pickerBound;
    bindDateControl('fairStart',async()=>{
      updateFairSingleAmountV353();
      await ensureDateControlMonthLoaded('fairStart');
      updateFairSingleAmountV353();
      refreshProductLinkContextV210('fair');
    });
    bindSingleClickDatePicker('fairStart');
  }
  const amount=document.getElementById('fairSales');
  if(amount&&amount.dataset.draftGuardV356!=='1'){
    amount.dataset.draftGuardV356='1';
    amount.addEventListener('input',()=>saveFairTurnoverDraftV356(amount.value));
    amount.addEventListener('change',()=>saveFairTurnoverDraftV356(amount.value));
  }
  // Reinstall unsaved-sales-card context guards on the replacement controls.
  installSalesCardContextGuardsV273();
}

// On every Fair entry, start from today exactly like Live. The user may then
// choose any date manually; only that chosen date drives turnover/card/profit/log.
const _showPageV356=showPage;
showPage=function(name,el){
  const result=_showPageV356(name,el);if(result===false)return false;
  if(name==='fair'){
    installFairLiveParityV356();
    setDateControl('fairStart',todayISO());
    const end=document.getElementById('fairEnd');if(end)end.value=todayISO();
    updateFairSingleAmountV353();
    renderFairMonthlyList();renderFairDailySummary();
    refreshProductLinkContextV210('fair');
  }
  return result;
};
window.showPage=showPage;

// Clear the exact Fair turnover draft only after the shared Live/Fair engine
// has received authoritative cloud success.
const _saveLiveFairSingleDayV356=saveLiveFairSingleDayV353;
saveLiveFairSingleDayV353=async function(type){
  const date=type==='fair'?fairSelectedDateV353():'';
  const loc=type==='fair'?fairSelectedLocationV353():'';
  const pendingBefore=type==='fair'?pendingRows.length:0;
  const out=await _saveLiveFairSingleDayV356(type);
  if(type==='fair'){
    const stillPending=pendingRows.some(r=>r.type==='fair'&&r.date===date&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));
    if(!stillPending&&pendingRows.length<=pendingBefore)clearFairTurnoverDraftV356(date,loc);
    updateFairSingleAmountV353();
  }
  return out;
};
saveFairSales=function(){return saveLiveFairSingleDayV353('fair')};
saveLiveSales=function(){return saveLiveFairSingleDayV353('live')};
window.saveFairSales=saveFairSales;window.saveLiveSales=saveLiveSales;

// Legacy Fair Session network reads are fully disabled in the active editor.
applyFairSessionV281=function(){return false};
refreshFairSessionsV281=async function(){return Array.isArray(fairSessionsCloudV281)?fairSessionsCloudV281:[]};

setTimeout(()=>{installFairLiveParityV356();if(document.getElementById('page-fair')?.classList.contains('active')){setDateControl('fairStart',todayISO());updateFairSingleAmountV353();}},0);


/* ================= V36.0 Fair shared location dropdown =================
   Restore the pre-V35.6 location UX: a real in-page history dropdown with
   selectable rows and delete buttons. iOS datalist/keyboard suggestions are
   disabled. History is shared through the existing hidden Fair Session sheet;
   legacy session date ranges are never applied to the active editor.
*/
let fairLocationDeletedKeysCloudV358=new Set();
async function refreshFairLocationHistoryCloudV358(){
  try{
    const r=await loadFairSessionsFromSheetV281();
    fairSessionsCloudV281=Array.isArray(r?.sessions)?r.sessions:[];
    fairLocationDeletedKeysCloudV358=new Set(Array.isArray(r?.deletedKeys)?r.deletedKeys.map(String):[]);
    renderFairLocationOptions();
    return fairSessionsCloudV281;
  }catch(e){console.warn('Fair location history cloud sync failed',e);return fairSessionsCloudV281}
}
window.refreshFairLocationHistoryCloudV358=refreshFairLocationHistoryCloudV358;

collectFairLocations=function(){
  const merged=[];
  const add=value=>{const display=canonicalLocation(value),key=normalizeFairLocationKey(display);if(!display||!key||merged.some(x=>x.key===key))return;merged.push({key,display})};
  getSavedFairLocations().forEach(add);
  (Array.isArray(fairSessionsCloudV281)?fairSessionsCloudV281:[]).forEach(x=>add(x?.location));
  (Array.isArray(rows)?rows:[]).filter(x=>String(x?.type||'').toLowerCase()==='fair').forEach(x=>add(x?.location));
  const hidden=getHiddenFairLocationKeysV328();
  return merged.filter(x=>!hidden.has(x.key)&&!fairLocationDeletedKeysCloudV358.has(x.key)).map(x=>x.display).sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}));
};

renderFairLocationHistoryV309=function(){
  const panel=document.getElementById('fairLocationHistoryV309');if(!panel)return;
  const input=document.getElementById('fairLocation'),q=normalizeFairLocationKey(input?.value||'');
  const all=collectFairLocations();
  const list=q?all.filter(loc=>normalizeFairLocationKey(loc).includes(q)):all;
  panel.innerHTML='';
  if(!list.length){panel.classList.add('hidden');return;}
  const title=document.createElement('div');title.className='fair-location-history-title-v309';title.textContent='历史地点';panel.appendChild(title);
  list.forEach(loc=>{
    const row=document.createElement('div');row.className='fair-location-history-row-v309';
    const choose=document.createElement('button');choose.type='button';choose.className='fair-location-history-choose-v309';choose.textContent=loc;
    choose.addEventListener('pointerdown',e=>e.preventDefault());
    choose.addEventListener('click',()=>{const input=document.getElementById('fairLocation');if(input)input.value=canonicalLocation(loc);updateFairPageMode();updateFairSingleAmountV353();refreshProductLinkContextV210('fair');panel.classList.add('hidden');input?.blur();});
    const del=document.createElement('button');del.type='button';del.className='fair-location-history-delete-v309';del.setAttribute('aria-label',`删除 ${loc}`);del.textContent='×';
    del.addEventListener('pointerdown',e=>e.preventDefault());
    del.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();if(!confirm(`确定从历史地点删除「${loc}」？\n\n只删除地点选项，不会删除旧营业额、销售卡或利润资料。`))return;
      const key=normalizeFairLocationKey(loc),local=getSavedFairLocations().filter(x=>normalizeFairLocationKey(x)!==key);localStorage.setItem('lover_fair_locations',JSON.stringify(local));
      fairLocationDeletedKeysCloudV358.add(key);renderFairLocationOptions();panel.classList.remove('hidden');
      try{const r=await deleteFairLocationFromSheetV358(loc);fairSessionsCloudV281=Array.isArray(r?.sessions)?r.sessions:fairSessionsCloudV281;fairLocationDeletedKeysCloudV358=new Set(Array.isArray(r?.deletedKeys)?r.deletedKeys.map(String):[...fairLocationDeletedKeysCloudV358]);renderFairLocationOptions();panel.classList.remove('hidden');setSync('Fair 地点已删除 · 云端已同步',true)}catch(err){fairLocationDeletedKeysCloudV358.delete(key);renderFairLocationOptions();panel.classList.remove('hidden');alert('删除 Fair 地点失败：'+(err.message||err));}
    });
    row.append(choose,del);panel.appendChild(row);
  });
};

function bindFairLocationDropdownV358(){
  const input=document.getElementById('fairLocation');if(!input)return;
  input.removeAttribute('list');input.setAttribute('autocomplete','off');
  if(input.dataset.v359History!=='1'){
    input.dataset.v359History='1';
    const show=async()=>{renderFairLocationHistoryV309();document.getElementById('fairLocationHistoryV309')?.classList.remove('hidden');await refreshFairLocationHistoryCloudV358();if(document.activeElement===input){renderFairLocationHistoryV309();document.getElementById('fairLocationHistoryV309')?.classList.remove('hidden')}};
    input.addEventListener('focus',show);
    input.addEventListener('click',show);
    input.addEventListener('input',()=>{renderFairLocationHistoryV309();document.getElementById('fairLocationHistoryV309')?.classList.remove('hidden')});
    input.addEventListener('blur',()=>setTimeout(()=>document.getElementById('fairLocationHistoryV309')?.classList.add('hidden'),260));
  }
  const btn=document.getElementById('fairLocationDropdownBtnV359');
  if(btn&&btn.dataset.v359History!=='1'){
    btn.dataset.v359History='1';
    btn.addEventListener('pointerdown',e=>e.preventDefault());
    btn.addEventListener('click',async()=>{const panel=document.getElementById('fairLocationHistoryV309');renderFairLocationHistoryV309();panel?.classList.remove('hidden');await refreshFairLocationHistoryCloudV358();renderFairLocationHistoryV309();panel?.classList.remove('hidden');input.focus({preventScroll:true});});
  }
}

const _installFairLiveParityV358=installFairLiveParityV356;
installFairLiveParityV356=function(){const r=_installFairLiveParityV358();const input=document.getElementById('fairLocation');if(input){delete input.dataset.v358History;delete input.dataset.v359History;}bindFairLocationDropdownV358();return r};
const _showPageV358=showPage;
showPage=function(name,el){const r=_showPageV358(name,el);if(r===false)return false;if(name==='fair'){bindFairLocationDropdownV358();refreshFairLocationHistoryCloudV358()}return r};
window.showPage=showPage;

// After authoritative Fair save, refresh shared history so this device also
// reflects the canonical cloud spelling/status immediately.
const _saveFairSalesV358=saveFairSales;
saveFairSales=async function(){const r=await _saveFairSalesV358();refreshFairLocationHistoryCloudV358();return r};
window.saveFairSales=saveFairSales;
setTimeout(()=>{bindFairLocationDropdownV358();refreshFairLocationHistoryCloudV358()},0);


/* ================= V36.0 Fair normalized location + reliable dropdown ================= */
setTimeout(()=>{const input=document.getElementById('fairLocation');input?.removeAttribute('list');bindFairLocationDropdownV358();},50);


/* ================= V36.0 selected-day Fair / Live totals =================
   The yellow box is no longer an entity-specific "saved amount" badge.
   It is the authoritative selected-date total across ALL Fair locations or
   ALL Live hosts: turnover + sales-card profit + overall profit rate.
*/
let selectedDayTotalTokenV360={fair:0,live:0};
function selectedDayDateV360(type){
  return type==='fair'?fairSelectedDateV353():isoToDisplay(String(document.getElementById('liveDate')?.value||''));
}
function selectedDayTurnoverV360(type,date){
  return dedupeRows(rows).filter(r=>String(r.type||'')===type&&String(r.date||'')===String(date||'')).reduce((sum,r)=>sum+Number(r.amount||0),0);
}
function dedupeProfitLinksV360(links){
  const map=new Map();
  (Array.isArray(links)?links:[]).forEach((x,i)=>{
    if(!x)return;
    const status=String(x.status||x.linkStatus||'').toLowerCase();
    if(status==='deleted'||status==='cancelled'||status==='canceled')return;
    const id=String(x.linkId||x.id||'').trim();
    const slot=[String(x.type||''),String(x.date||''),String(x.transactionId||x.transactionID||''),String(x.productOrder??x.productIndex??''),String(x.productName||'')].join('|');
    const key=id||slot||('row|'+i);
    const old=map.get(key);
    const fresh=String(x.updatedAt||x.clientUpdatedAt||x.changedAt||'');
    const oldFresh=String(old?.updatedAt||old?.clientUpdatedAt||old?.changedAt||'');
    if(!old||fresh>=oldFresh)map.set(key,x);
  });
  return [...map.values()];
}
function selectedDayProfitV360(type,date,links){
  return dedupeProfitLinksV360(links).filter(x=>String(x.type||'')===type&&String(x.date||'')===String(date||'')).reduce((sum,x)=>sum+Number(x.profit||0),0);
}
function paintSelectedDayTotalV360(type,date,sales,profit,loading=false,error=false){
  const el=document.getElementById(type==='fair'?'fairDateResult':'liveDateResult');if(!el)return;
  const label=type==='fair'?'Fair':'Live';
  const rate=sales>0?profit/sales*100:0;
  el.classList.remove('selected-day-total-v360');
  el.classList.add('selected-day-total-v361');
  el.setAttribute('data-selected-date',String(date||''));
  el.innerHTML=`<strong class="selected-day-total-title-v361">${label} 当日总计</strong><div><span>营业额</span><b>${money(sales)}</b></div><div><span>利润</span><b>${loading?'读取中…':error?'读取失败':money(profit)}</b></div><div><span>利润率</span><b>${loading||error?'—':rate.toFixed(2)+'%'}</b></div>`;
}
async function renderSelectedDayTotalV360(type){
  const date=selectedDayDateV360(type),token=++selectedDayTotalTokenV360[type];
  const sales=selectedDayTurnoverV360(type,date);
  paintSelectedDayTotalV360(type,date,sales,0,true,false);
  try{
    const links=await loadAllSalesProductLinksV203({force:false,maxAgeMs:120000});
    if(token!==selectedDayTotalTokenV360[type]||date!==selectedDayDateV360(type))return;
    const profit=selectedDayProfitV360(type,date,links);
    paintSelectedDayTotalV360(type,date,sales,profit,false,false);
  }catch(e){
    if(token!==selectedDayTotalTokenV360[type]||date!==selectedDayDateV360(type))return;
    paintSelectedDayTotalV360(type,date,sales,0,false,true);
  }
}
window.renderSelectedDayTotalV360=renderSelectedDayTotalV360;

const _updateLiveInputFromSelectedDateV360=updateLiveInputFromSelectedDate;
updateLiveInputFromSelectedDate=function(){
  _updateLiveInputFromSelectedDateV360();
  const input=document.getElementById('liveSales'),draft=getLiveTurnoverDraftV332();
  if(input&&draft&&document.activeElement!==input)input.value=formatAmount(toAmount(draft.value));
  renderSelectedDayTotalV360('live');
};
window.updateLiveInputFromSelectedDate=updateLiveInputFromSelectedDate;

const _updateFairSingleAmountV360=updateFairSingleAmountV353;
updateFairSingleAmountV353=function(){
  _updateFairSingleAmountV360();
  renderSelectedDayTotalV360('fair');
};
window.updateFairSingleAmountV353=updateFairSingleAmountV353;

function bindLiveAmountFormatV360(){
  const input=document.getElementById('liveSales');if(!input||input.dataset.v360Money==='1')return;
  input.dataset.v360Money='1';
  input.addEventListener('blur',()=>{
    input.value=formatAmount(toAmount(input.value));
    saveLiveTurnoverDraftV332(input.value);
  });
  input.addEventListener('change',()=>{
    if(document.activeElement!==input){input.value=formatAmount(toAmount(input.value));saveLiveTurnoverDraftV332(input.value)}
  });
}
const _showPageV360=showPage;
showPage=function(name,el){
  const r=_showPageV360(name,el);if(r===false)return false;
  if(name==='fair')renderSelectedDayTotalV360('fair');
  if(name==='live'){bindLiveAmountFormatV360();renderSelectedDayTotalV360('live')}
  return r;
};
window.showPage=showPage;

// Refresh the selected-day total immediately after authoritative turnover saves.
const _saveLiveSalesV360=saveLiveSales;
saveLiveSales=async function(){const r=await _saveLiveSalesV360();bindLiveAmountFormatV360();renderSelectedDayTotalV360('live');return r};
window.saveLiveSales=saveLiveSales;
const _saveFairSalesV360=saveFairSales;
saveFairSales=async function(){const r=await _saveFairSalesV360();renderSelectedDayTotalV360('fair');return r};
window.saveFairSales=saveFairSales;

setTimeout(()=>{bindLiveAmountFormatV360();renderSelectedDayTotalV360('fair');renderSelectedDayTotalV360('live')},80);


/* ================= V36.8 selected-day Sales / Fair / Live grand totals =================
   Sales = both nurseries; Fair = all locations; Live = all hosts.
   The summary is date-scoped only and intentionally ignores the currently selected entity.
*/
let selectedDayGrandTokenV362={daily:0,fair:0,live:0};
function selectedDayDateV362(type){
  if(type==='daily')return isoToDisplay(String(document.getElementById('saleDate')?.value||''));
  return selectedDayDateV360(type);
}
function selectedDayTurnoverV362(type,date){
  const list=dedupeRows(rows).filter(r=>String(r.type||'')===type&&String(r.date||'')===String(date||''));
  if(type==='daily'){
    const byCompany={balakong:0,belimbing:0};
    list.forEach(r=>{const company=canonicalDailyCompanyKeyV518(r.company||r.location||'');byCompany[company]=Math.max(byCompany[company]||0,Number(r.amount||0))});
    return Number(byCompany.balakong||0)+Number(byCompany.belimbing||0);
  }
  return list.reduce((sum,r)=>sum+Number(r.amount||0),0);
}
function selectedDayProfitV362(type,date,links){
  return dedupeProfitLinksV360(links).filter(x=>String(x.type||'')===type&&String(x.date||'')===String(date||'')).reduce((sum,x)=>sum+Number(x.profit||0),0);
}
function selectedDaySummaryElV362(type){
  return document.getElementById(type==='daily'?'salesDateResult':type==='fair'?'fairDateResult':'liveDateResult');
}
function selectedDayLabelV362(type){return type==='daily'?'两间花圃总计':type==='fair'?'全部地点总计':'全部主播总计'}
function paintSelectedDayGrandV362(type,date,sales,profit,loading=false,error=false){
  const el=selectedDaySummaryElV362(type);if(!el)return;
  const rate=sales>0?profit/sales*100:0;
  el.className='sales-date-result selected-day-grand-v362';
  el.setAttribute('data-selected-date',String(date||''));
  el.innerHTML=`<strong>${selectedDayLabelV362(type)}</strong><div><span>营业额</span><b>${money(sales)}</b></div><div><span>利润</span><b>${loading?'读取中…':error?'读取失败':money(profit)}</b></div><div><span>利润率</span><b>${loading||error?'—':rate.toFixed(2)+'%'}</b></div>`;
}
async function renderSelectedDayGrandV362(type){
  const date=selectedDayDateV362(type),token=++selectedDayGrandTokenV362[type];
  const sales=selectedDayTurnoverV362(type,date);
  paintSelectedDayGrandV362(type,date,sales,0,true,false);
  try{
    const links=await loadAllSalesProductLinksV203({force:false,maxAgeMs:120000});
    if(token!==selectedDayGrandTokenV362[type]||date!==selectedDayDateV362(type))return;
    paintSelectedDayGrandV362(type,date,sales,selectedDayProfitV362(type,date,links),false,false);
  }catch(e){
    if(token!==selectedDayGrandTokenV362[type]||date!==selectedDayDateV362(type))return;
    paintSelectedDayGrandV362(type,date,sales,0,false,true);
  }
}
window.renderSelectedDayGrandV362=renderSelectedDayGrandV362;

// Override V36.0 renderer so all existing Fair/Live refresh hooks use the V36.8 compact grand-total renderer.
renderSelectedDayTotalV360=function(type){return renderSelectedDayGrandV362(type)};
window.renderSelectedDayTotalV360=renderSelectedDayTotalV360;

const _updateDailyInputFromSelectedDateV362=updateDailyInputFromSelectedDate;
updateDailyInputFromSelectedDate=function(){
  _updateDailyInputFromSelectedDateV362();
  renderSelectedDayGrandV362('daily');
};
window.updateDailyInputFromSelectedDate=updateDailyInputFromSelectedDate;

const _saveDailySalesV362=saveDailySales;
saveDailySales=async function(){const r=await _saveDailySalesV362();renderSelectedDayGrandV362('daily');return r};
window.saveDailySales=saveDailySales;

const _showPageV362=showPage;
showPage=function(name,el){
  const r=_showPageV362(name,el);if(r===false)return false;
  if(name==='sales')renderSelectedDayGrandV362('daily');
  if(name==='fair')renderSelectedDayGrandV362('fair');
  if(name==='live')renderSelectedDayGrandV362('live');
  return r;
};
window.showPage=showPage;
setTimeout(()=>{renderSelectedDayGrandV362('daily');renderSelectedDayGrandV362('fair');renderSelectedDayGrandV362('live')},120);


/* ================= V36.8 data/read performance + monthly rollup =================
   - Sales keeps its existing monthly design.
   - Fair/Live monthly summary is exactly two rows: month total+commission, then profit+overall margin.
   - Profit pending is "--" (never false 0.00).
   - Selected-day grand total is re-applied after every historical-date refresh so legacy saved-amount text cannot win.
   - Change-log exact context cache/prefetch reduces repeated cloud reads.
*/
let monthlyRollupTokenV365={fair:0,live:0};
function monthInfoV365(type){
  const month=type==='fair'?monthFromDateControl('fairStart'):getLiveSelectedMonth();
  const label=/^\d{4}-\d{2}$/.test(month)?`${month.slice(5,7)}-${month.slice(0,4)}`:'-';
  return{month,label};
}
function monthlySalesV365(type,month){
  return dedupeRows(rows).filter(r=>String(r.type||'')===type&&displayToISO(String(r.date||'')).slice(0,7)===month&&Number(r.amount||0)>0).reduce((s,r)=>s+Number(r.amount||0),0);
}
function monthlyProfitV365(type,month,links){
  const clean=typeof dedupeProfitLinksV360==='function'?dedupeProfitLinksV360(links):(Array.isArray(links)?links:[]);
  return clean.filter(x=>String(x.type||'')===type&&displayToISO(String(x.date||'')).slice(0,7)===month).reduce((s,x)=>s+Number(x.profit||0),0);
}
function paintMonthlyRollupV365(type,state='loading',links=null){
  const info=monthInfoV365(type),sales=monthlySalesV365(type,info.month);
  const prefix=type==='fair'?'fair':'live';
  const totalLabel=document.getElementById(prefix==='fair'?'fairMonthlyTotalLabel':'liveMonthlyTotalLabel');
  const totalEl=document.getElementById(prefix==='fair'?'fairMonthlySalesTotal':'liveSelectedHostTotal');
  const commLabel=document.getElementById(prefix==='fair'?'fairMonthlyCommissionLabel':'liveMonthlyCommissionLabel');
  const commEl=document.getElementById(prefix==='fair'?'fairMonthlyCommissionTotal':'liveSelectedCommissionTotal');
  const profitEl=document.getElementById(prefix+'MonthlyProfitV365'),rateEl=document.getElementById(prefix+'MonthlyProfitRateV365');
  if(totalLabel)totalLabel.textContent=`${info.label} 总销售`;
  if(totalEl)totalEl.textContent=money(sales);
  if(type==='fair'){
    const rate=getFairCommissionRate(sales),pct=Number((rate*100).toFixed(2));
    if(commLabel)commLabel.textContent=`总佣金 ${pct}%`;
    if(commEl)commEl.textContent=money(sales*rate);
  }else{
    const monthRows=dedupeRows(rows).filter(r=>r.type==='live'&&displayToISO(String(r.date||'')).slice(0,7)===info.month&&Number(r.amount||0)>0);
    const comm=monthRows.reduce((sum,r)=>sum+Number(r.amount||0)*Number(getLiveHostRate(r.location,r.date)||0)/100,0);
    if(commLabel)commLabel.textContent='总佣金';
    if(commEl)commEl.textContent=money(comm);
  }
  if(!profitEl||!rateEl)return;
  if(state!=='ready'||!Array.isArray(links)){profitEl.textContent='--';rateEl.textContent='--';return}
  const profit=monthlyProfitV365(type,info.month,links),rate=sales>0?profit/sales*100:0;
  profitEl.textContent=money(profit);rateEl.textContent=rate.toFixed(2)+'%';
}
function refreshMonthlyRollupV365(type){
  const token=++monthlyRollupTokenV365[type];
  const info=monthInfoV365(type),cached=profitLinksForMonthCacheV496(type,info.month);
  if(Array.isArray(cached))paintMonthlyRollupV365(type,'ready',cached);
  else paintMonthlyRollupV365(type,'loading');
  scheduleSilentProfitRefreshV496('monthly-rollup-'+type);
}
const _renderFairMonthlyListV365=renderFairMonthlyList;
renderFairMonthlyList=function(){const r=_renderFairMonthlyListV365();paintMonthlyRollupV365('fair','loading');refreshMonthlyRollupV365('fair');return r};
window.renderFairMonthlyList=renderFairMonthlyList;
const _renderLiveMonthlyListV365=renderLiveMonthlyList;
renderLiveMonthlyList=function(){const r=_renderLiveMonthlyListV365();paintMonthlyRollupV365('live','loading');refreshMonthlyRollupV365('live');return r};
window.renderLiveMonthlyList=renderLiveMonthlyList;

// Exact-context Change Log cache. Fair includes normalized location; Sales/Live are date-wide like the existing UI.
const salesChangeLogExactCacheV365=new Map();
const salesChangeLogPendingV365=new Map();
function changeLogExactKeyV365(type,date){
  const loc=type==='fair'?normalizeFairLocationKey(canonicalLocation(document.getElementById('fairLocation')?.value||'')):'';
  return`${type}|${date}|${loc}`;
}
async function loadExactChangeLogV365(type,date,{force=false}={}){
  const key=changeLogExactKeyV365(type,date),hit=salesChangeLogExactCacheV365.get(key),now=Date.now();
  if(!force&&hit&&now-hit.at<60000)return hit.logs;
  if(salesChangeLogPendingV365.has(key))return salesChangeLogPendingV365.get(key);
  const location=type==='fair'?canonicalLocation(document.getElementById('fairLocation')?.value||''):'';
  if(type==='fair'&&!location)return[];
  const p=Promise.resolve(loadSalesChangeLogFromSheetV200(type,date,{force:true,location})).then(data=>{
    const logs=Array.isArray(data?.logs)?data.logs:[];salesChangeLogExactCacheV365.set(key,{logs,at:Date.now()});return logs;
  }).finally(()=>salesChangeLogPendingV365.delete(key));
  salesChangeLogPendingV365.set(key,p);return p;
}
async function toggleSalesChangeLogV365(type,button){
  const panel=document.getElementById(changeLogPanelIdV200(type));if(!panel)return;
  const date=selectedChangeLogDateV200(type);if(!date){alert('请先选择日期');return}
  if(salesChangeLogOpenV200[type]&&String(panel.dataset.logDate||'')===date){salesChangeLogOpenV200[type]=false;panel.classList.add('hidden');panel.innerHTML='';panel.dataset.logDate='';button?.classList.remove('active');return}
  salesChangeLogOpenV200[type]=true;panel.dataset.logDate=date;panel.classList.remove('hidden');button?.classList.add('active');
  const key=changeLogExactKeyV365(type,date),cached=salesChangeLogExactCacheV365.get(key);
  if(cached&&Array.isArray(cached.logs))renderChangeLogTimelineV200(type,date,cached.logs);else panel.innerHTML=`<div class="change-log-loading">正在读取 ${escapeChangeLogHtmlV200(date)} 最新记录...</div>`;
  try{
    const logs=await loadExactChangeLogV365(type,date,{force:!cached||Date.now()-cached.at>=60000});
    if(!salesChangeLogOpenV200[type]||String(panel.dataset.logDate||'')!==date)return;renderChangeLogTimelineV200(type,date,logs);
  }catch(e){if(!salesChangeLogOpenV200[type]||String(panel.dataset.logDate||'')!==date)return;if(!(cached&&Array.isArray(cached.logs)))panel.innerHTML='<div class="change-log-empty">读取失败，请稍后再试</div>'}
}
toggleSalesChangeLogV200=toggleSalesChangeLogV365;window.toggleSalesChangeLogV200=toggleSalesChangeLogV365;
function prefetchChangeLogV365(type){
  const date=selectedChangeLogDateV200(type);if(!date)return;const key=changeLogExactKeyV365(type,date),hit=salesChangeLogExactCacheV365.get(key);if(hit&&Date.now()-hit.at<60000)return;
  setTimeout(()=>loadExactChangeLogV365(type,date,{force:false}).catch(()=>{}),120);
}

// Historical-date protection: any legacy "已保存 RM..." paint is immediately replaced by the date-wide grand total.
function ensureSelectedDayGrandV365(type){
  const el=selectedDaySummaryElV362(type);if(!el)return;
  const expected=selectedDayLabelV362(type),title=el.querySelector('strong')?.textContent||'';
  if(!el.classList.contains('selected-day-grand-v362')||title!==expected){setTimeout(()=>renderSelectedDayGrandV362(type),0)}
}
function installSelectedDayGuardV365(){
  [['daily','saleDate'],['fair','fairStart'],['live','liveDate']].forEach(([type,id])=>{
    const el=selectedDaySummaryElV362(type);if(el&&!el.dataset.v365Guard){el.dataset.v365Guard='1';new MutationObserver(()=>ensureSelectedDayGrandV365(type)).observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}
    const input=document.getElementById(id);if(input&&!input.dataset.v365Grand){input.dataset.v365Grand='1';input.addEventListener('change',()=>{[0,60,280].forEach(ms=>setTimeout(()=>renderSelectedDayGrandV362(type),ms));prefetchChangeLogV365(type)})}
  });
}
const _showPageV365=showPage;
showPage=function(name,el){const r=_showPageV365(name,el);if(r===false)return false;const type=name==='sales'?'daily':name==='fair'?'fair':name==='live'?'live':'';if(type){setTimeout(()=>{renderSelectedDayGrandV362(type);prefetchChangeLogV365(type);if(type==='fair'||type==='live')refreshMonthlyRollupV365(type)},40)}return r};
window.showPage=showPage;
setTimeout(()=>{installSelectedDayGuardV365();['daily','fair','live'].forEach(prefetchChangeLogV365);refreshMonthlyRollupV365('fair');refreshMonthlyRollupV365('live')},180);

/* ================= V36.8 instant Daily Profit reuse =================
   The selected-day grand total already loads the authoritative all-links cache.
   Reuse that exact data immediately when Daily Profit opens instead of waiting for
   another full-table read. A cloud refresh is only needed when no fresh memory/cache exists.
*/
async function toggleProductProfitSummaryV367(type,button){
  const panel=productProfitSummaryPanelV216(type);if(!panel)return;
  if(productLinkBoxIsOpenV210(type)&&hasUnsavedSalesCardChangesV238(type)&&!confirmDiscardSalesCardChangesV238(type))return;
  const date=productProfitSelectedDateV216(type);if(!date){alert('请先选择日期');return}
  if(productProfitSummaryOpenV216[type]&&!panel.classList.contains('hidden')){
    productProfitSummaryOpenV216[type]=false;panel.classList.add('hidden');panel.innerHTML='';if(button)button.textContent='📊 当天利润';return;
  }
  const pre=productLinkPreV208(type),box=document.getElementById(pre+'ProductLinkBox'),body=document.getElementById(pre+'ProductLinkBody');
  if(body)body.classList.add('hidden');if(box)box.classList.add('product-link-collapsed');box?.querySelector('.product-link-toggle')?.setAttribute('aria-expanded','false');
  const allCached=typeof peekAllSalesProductLinksCacheV367==='function'?peekAllSalesProductLinksCacheV367(180000):null;
  const dailyCached=typeof getDailyProfitCacheV237==='function'?getDailyProfitCacheV237(type,date):null;
  const source=Array.isArray(allCached)?allCached:(Array.isArray(dailyCached)?dailyCached:null);
  if(Array.isArray(source)){
    const raw=source.filter(x=>String(x.type||'')===type&&String(x.date||'')===date);
    const fresh=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(raw):raw;
    if(typeof setDailyProfitCacheV237==='function')setDailyProfitCacheV237(type,date,fresh);
    renderProductProfitSummaryV216(type,fresh);panel.classList.remove('hidden');productProfitSummaryOpenV216[type]=true;if(button)button.textContent='📊 收起利润';
    // If this came from the authoritative all-links cache, no second read is useful.
    if(Array.isArray(allCached))return;
  }else if(button){button.disabled=true;button.textContent='读取中...'}
  try{
    const allLinks=await loadAllSalesProductLinksV203({force:false,maxAgeMs:180000});
    const raw=(allLinks||[]).filter(x=>String(x.type||'')===type&&String(x.date||'')===date);
    const fresh=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(raw):raw;
    if(typeof setDailyProfitCacheV237==='function')setDailyProfitCacheV237(type,date,fresh);
    renderProductProfitSummaryV216(type,fresh);panel.classList.remove('hidden');productProfitSummaryOpenV216[type]=true;if(button)button.textContent='📊 收起利润';
  }catch(e){
    if(!Array.isArray(source))alert('读取当天利润失败：'+(e.message||e));
  }finally{if(button)button.disabled=false}
}
toggleProductProfitSummaryV216=toggleProductProfitSummaryV367;
window.toggleProductProfitSummaryV216=toggleProductProfitSummaryV367;


/* ================= V36.8 authoritative selected-day profit handoff =================
   Root fix: once the selected-day grand total has received authoritative Sales Product Links,
   store the exact day/type links in memory + Daily Profit cache. Opening Daily Profit then paints
   from that same authoritative result immediately and never launches a second full-table read.
*/
const selectedDayProfitLinksV368=new Map();
const selectedDayProfitReadyV368=new Map();
function selectedDayProfitKeyV368(type,date){return String(type||'')+'|'+String(date||'')}
function seedSelectedDayProfitV368(type,date,allLinks){
  const raw=(Array.isArray(allLinks)?allLinks:[]).filter(x=>String(x.type||'')===String(type||'')&&String(x.date||'')===String(date||''));
  const fresh=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(raw):dedupeProfitLinksV360(raw);
  const key=selectedDayProfitKeyV368(type,date);
  selectedDayProfitLinksV368.set(key,fresh);
  selectedDayProfitReadyV368.set(key,Date.now());
  if(typeof setDailyProfitCacheV237==='function')setDailyProfitCacheV237(type,date,fresh);
  return fresh;
}
function getSelectedDayProfitLinksV368(type,date,maxAgeMs=180000){
  const key=selectedDayProfitKeyV368(type,date),at=Number(selectedDayProfitReadyV368.get(key)||0),links=selectedDayProfitLinksV368.get(key);
  if(Array.isArray(links)&&Date.now()-at<=Number(maxAgeMs||0))return links;
  return null;
}
window.getSelectedDayProfitLinksV368=getSelectedDayProfitLinksV368;

renderSelectedDayGrandV362=async function(type){
  const date=selectedDayDateV362(type),token=++selectedDayGrandTokenV362[type];
  const sales=selectedDayTurnoverV362(type,date);
  paintSelectedDayGrandV362(type,date,sales,0,true,false);
  try{
    const links=await loadAllSalesProductLinksV203({force:false,maxAgeMs:180000});
    if(token!==selectedDayGrandTokenV362[type]||date!==selectedDayDateV362(type))return;
    const dayLinks=seedSelectedDayProfitV368(type,date,links);
    const profit=dayLinks.reduce((sum,x)=>sum+Number(x.profit||0),0);
    paintSelectedDayGrandV362(type,date,sales,profit,false,false);
    // If Daily Profit is already open for this exact date, repaint it from the same result now.
    if(productProfitSummaryOpenV216?.[type]&&productProfitSelectedDateV216(type)===date){
      renderProductProfitSummaryV216(type,dayLinks);
      const btn=document.querySelector(`#${productLinkPreV208(type)}ProductLinkBox .product-profit-toggle-btn`);
      if(btn){btn.disabled=false;btn.textContent='📊 收起利润'}
    }
  }catch(e){
    if(token!==selectedDayGrandTokenV362[type]||date!==selectedDayDateV362(type))return;
    paintSelectedDayGrandV362(type,date,sales,0,false,true);
  }
};
window.renderSelectedDayGrandV362=renderSelectedDayGrandV362;
renderSelectedDayTotalV360=function(type){return renderSelectedDayGrandV362(type)};
window.renderSelectedDayTotalV360=renderSelectedDayTotalV360;

async function toggleProductProfitSummaryV368(type,button){
  const panel=productProfitSummaryPanelV216(type);if(!panel)return;
  if(productLinkBoxIsOpenV210(type)&&hasUnsavedSalesCardChangesV238(type)&&!confirmDiscardSalesCardChangesV238(type))return;
  const date=productProfitSelectedDateV216(type);if(!date){alert('请先选择日期');return}
  if(productProfitSummaryOpenV216[type]&&!panel.classList.contains('hidden')){
    productProfitSummaryOpenV216[type]=false;panel.classList.add('hidden');panel.innerHTML='';if(button)button.textContent='📊 当天利润';return;
  }
  const pre=productLinkPreV208(type),box=document.getElementById(pre+'ProductLinkBox'),body=document.getElementById(pre+'ProductLinkBody');
  if(body)body.classList.add('hidden');if(box)box.classList.add('product-link-collapsed');box?.querySelector('.product-link-toggle')?.setAttribute('aria-expanded','false');

  // 1) Exact authoritative handoff from the selected-day total (fastest, never stale within this page).
  let source=getSelectedDayProfitLinksV368(type,date,180000);
  // 2) In-memory authoritative all-links cache (same cloud response, no network).
  if(!Array.isArray(source)){
    const allCached=typeof peekAllSalesProductLinksCacheV367==='function'?peekAllSalesProductLinksCacheV367(180000):null;
    if(Array.isArray(allCached))source=seedSelectedDayProfitV368(type,date,allCached);
  }
  // 3) Persistent day cache is an immediate visual fallback only. Do not block the UI on a new scan.
  if(!Array.isArray(source)&&typeof getDailyProfitCacheV237==='function')source=getDailyProfitCacheV237(type,date);

  if(Array.isArray(source)){
    renderProductProfitSummaryV216(type,source);
    panel.classList.remove('hidden');productProfitSummaryOpenV216[type]=true;
    if(button){button.disabled=false;button.textContent='📊 收起利润'}
    // If the exact authoritative page handoff exists, there is nothing else to fetch.
    if(Array.isArray(getSelectedDayProfitLinksV368(type,date,180000)))return;
  }else{
    panel.classList.remove('hidden');
    panel.innerHTML='<div class="product-profit-empty">正在同步当天利润…</div>';
    productProfitSummaryOpenV216[type]=true;
    if(button){button.disabled=false;button.textContent='📊 收起利润'}
  }

  // Background refresh only. It never leaves the button stuck on “读取中…”.
  try{
    const allLinks=await loadAllSalesProductLinksV203({force:false,maxAgeMs:180000});
    if(!productProfitSummaryOpenV216[type]||productProfitSelectedDateV216(type)!==date)return;
    const fresh=seedSelectedDayProfitV368(type,date,allLinks);
    renderProductProfitSummaryV216(type,fresh);
  }catch(e){
    if(!Array.isArray(source)&&productProfitSummaryOpenV216[type]&&productProfitSelectedDateV216(type)===date){
      panel.innerHTML='<div class="product-profit-empty">读取失败，请稍后再试</div>';
    }
  }
}
toggleProductProfitSummaryV216=toggleProductProfitSummaryV368;
window.toggleProductProfitSummaryV216=toggleProductProfitSummaryV368;

// V36.8: seed the exact date cache proactively after page/date changes.
function seedVisibleDayProfitV368(type){setTimeout(()=>renderSelectedDayGrandV362(type),0)}
setTimeout(()=>{['daily','fair','live'].forEach(seedVisibleDayProfitV368)},220);

/* ================= V46.0 field drag/drop protection =================
   Prevent selected text/numbers from being dragged into another input and
   overwriting price/cost/quantity/remark fields. Normal keyboard typing and
   clipboard copy/paste remain available. */
(function installFieldDragDropGuardV449(){
  const isField=target=>!!(target&&target.closest&&target.closest('input,textarea,select,[contenteditable="true"]'));
  document.addEventListener('dragstart',event=>{if(isField(event.target))event.preventDefault()},true);
  document.addEventListener('dragover',event=>{if(isField(event.target)){event.preventDefault();try{event.dataTransfer.dropEffect='none'}catch(_){}}},true);
  document.addEventListener('drop',event=>{if(isField(event.target)){event.preventDefault();event.stopPropagation()}},true);
})();

/* ================= V46.0 once-per-day unconfirmed draft reminder =================
   Read the complete fresh cloud list across Sales/Fair/Live and every location.
   Include same-day saved drafts, group by transaction, and stop automatically
   once the card is confirmed. */
const SALES_DRAFT_REMINDER_KEY_V369='lover_sales_draft_reminder_v369';
function localDayISO369(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function parseSalesDraftTimestampV369(value){
  const s=String(value||'').trim();if(!s)return 0;
  let t=Date.parse(s);if(Number.isFinite(t))return t;
  const m=s.match(/^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if(!m)return 0;
  const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||0),Number(m[5]||0),Number(m[6]||0));
  return d.getTime();
}
function salesDraftReminderTypeLabelV369(type){
  return type==='live'?'Live':type==='fair'?'Fair':'Sales';
}
function collectUnconfirmedDraftsV369(allLinks){
  const groups=new Map();
  const add=(x,localSavedAt=0)=>{
    const status=String(x?.importSyncStatus||'').trim();
    if(status!=='DRAFT'&&status!=='DRAFT_INVENTORY_CHANGED')return;
    if(String(x?.status||'active').toLowerCase()==='deleted')return;
    const type=String(x?.type||''),date=String(x?.date||''),location=String(x?.location||'').trim();
    const txn=String(x?.transactionId||x?.saleId||x?.linkId||'').trim()||[type,date,location].join('|');
    const key=[type,date,location.toLowerCase(),txn].join('|');
    let g=groups.get(key);if(!g){g={key,type,date,location,txn,total:0,updatedMs:0};groups.set(key,g)}
    g.total+=Number(x?.actualPrice||0);
    g.updatedMs=Math.max(g.updatedMs,Number(localSavedAt||0),parseSalesDraftTimestampV369(x?.updatedAt||x?.createdAt));
  };
  (Array.isArray(allLinks)?allLinks:[]).forEach(x=>add(x));
  // Include durable local drafts that have not reached cloud yet.
  try{
    const pending=typeof readSalesDraftPendingV314==='function'?readSalesDraftPendingV314():{};
    Object.values(pending||{}).forEach(entry=>(Array.isArray(entry?.items)?entry.items:[]).forEach(x=>{const st=String(x?.importSyncStatus||'').trim();add({...x,importSyncStatus:st||'DRAFT'},Number(entry?.savedAt||0));}));
  }catch(_){}
  return [...groups.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.type).localeCompare(String(b.type))||String(a.location).localeCompare(String(b.location)));
}
function readDraftReminderStateV369(){
  try{const x=JSON.parse(localStorage.getItem(SALES_DRAFT_REMINDER_KEY_V369)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return{}}
}
function writeDraftReminderStateV369(state){try{localStorage.setItem(SALES_DRAFT_REMINDER_KEY_V369,JSON.stringify(state||{}))}catch(_){}
}
let unconfirmedDraftReminderItemsV429=[];
let unconfirmedDraftReminderCheckingV441=false;
function removeDraftReminderUiV429(){
  document.getElementById('salesDraftNoticeV429')?.remove();
  document.getElementById('salesDraftListModalV429')?.remove();
}
function ensureDraftReminderReturnButtonV429(){
  let btn=document.getElementById('salesDraftReturnV429');
  if(!btn){
    btn=document.createElement('button');btn.type='button';btn.id='salesDraftReturnV429';btn.className='sales-draft-return-v429';
    btn.addEventListener('click',()=>openUnconfirmedDraftListV429(true));document.body.appendChild(btn);
  }
  const count=unconfirmedDraftReminderItemsV429.length;
  btn.textContent=`← 未处理销售卡（${count}）`;btn.hidden=!count;
  try{document.body.classList.toggle('has-sales-draft-return-v444',count>0)}catch(_){}
}
function renderUnconfirmedDraftListV429(drafts){
  document.getElementById('salesDraftListModalV429')?.remove();
  document.getElementById('salesDraftNoticeV429')?.remove();
  const returnBtn=document.getElementById('salesDraftReturnV429');if(returnBtn)returnBtn.hidden=true;
  const overlay=document.createElement('div');overlay.id='salesDraftListModalV429';overlay.className='sales-draft-modal-v429';
  const panel=document.createElement('section');panel.className='sales-draft-modal-panel-v429';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','尚未确认销售卡清单');
  const head=document.createElement('div');head.className='sales-draft-modal-head-v429';
  const title=document.createElement('div');title.innerHTML=`<b>⚠️ 销售卡尚未处理</b><span>${drafts.length} 张草稿等待确认</span>`;
  const closeReminder=(dismissToday=false)=>{
    if(dismissToday)writeDraftReminderStateV369({lastReminderDay:localDayISO369(),lastCount:drafts.length,updatedAt:Date.now()});
    overlay.remove();ensureDraftReminderReturnButtonV429();
  };
  const close=document.createElement('button');close.type='button';close.className='sales-draft-modal-close-v429';close.setAttribute('aria-label','关闭');close.textContent='×';close.addEventListener('click',()=>closeReminder(true));
  head.append(title,close);panel.appendChild(head);
  const list=document.createElement('div');list.className='sales-draft-list-v429';
  drafts.forEach((g,i)=>{
    const row=document.createElement('button');row.type='button';row.className='sales-draft-row-v429';
    const place=g.location?' · '+g.location:'';
    row.innerHTML=`<span><b>销售卡 ${i+1}</b><small>${escapeChangeLogHtmlV200(g.date)} · ${escapeChangeLogHtmlV200(salesDraftReminderTypeLabelV369(g.type)+place)}</small></span><strong>RM${formatAmount(g.total)}</strong><i aria-hidden="true">›</i>`;
    row.addEventListener('click',async()=>{overlay.remove();await openPendingInventorySalesCardV250(g);ensureDraftReminderReturnButtonV429();});
    list.appendChild(row);
  });
  panel.appendChild(list);overlay.appendChild(panel);overlay.addEventListener('click',e=>{if(e.target===overlay)closeReminder(false)});document.body.appendChild(overlay);
}
async function latestUnconfirmedDraftsV429(force=false){
  let links=null;
  try{
    if(!force&&typeof peekAllSalesProductLinksCacheV367==='function')links=peekAllSalesProductLinksCacheV367(60000);
    if(!Array.isArray(links)&&typeof loadAllSalesProductLinksV203==='function')links=await loadAllSalesProductLinksV203({force:Boolean(force),maxAgeMs:force?0:60000});
  }catch(_){links=[]}
  unconfirmedDraftReminderItemsV429=collectUnconfirmedDraftsV369(links);
  ensureDraftReminderReturnButtonV429();return unconfirmedDraftReminderItemsV429;
}
async function openUnconfirmedDraftListV429(force=true){
  const drafts=await latestUnconfirmedDraftsV429(force);
  if(!drafts.length){removeDraftReminderUiV429();const btn=document.getElementById('salesDraftReturnV429');if(btn)btn.hidden=true;showToast('✅ 没有尚未确认的销售卡');return}
  renderUnconfirmedDraftListV429(drafts);
}
window.openUnconfirmedDraftListV429=openUnconfirmedDraftListV429;
async function checkUnconfirmedDraftReminderV369(){
  const today=localDayISO369(),state=readDraftReminderStateV369();
  if(String(state.lastReminderDay||'')===today)return;
  if(document.getElementById('salesDraftListModalV429')||unconfirmedDraftReminderCheckingV441)return;
  unconfirmedDraftReminderCheckingV441=true;
  let links=null;
  try{
    if(typeof loadAllSalesProductLinksV203==='function')links=await loadAllSalesProductLinksV203({force:true,maxAgeMs:0});
    const drafts=collectUnconfirmedDraftsV369(links);
    if(!drafts.length)return;
    unconfirmedDraftReminderItemsV429=drafts;
    // V46.0: only the explicit X button dismisses today's reminder. Leaving,
    // selecting a card, or tapping the backdrop does not mark it as seen.
    renderUnconfirmedDraftListV429(drafts);
  }catch(_){return}
  finally{unconfirmedDraftReminderCheckingV441=false}
}
window.checkUnconfirmedDraftReminderV369=checkUnconfirmedDraftReminderV369;
setTimeout(()=>checkUnconfirmedDraftReminderV369().catch(()=>{}),1800);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>checkUnconfirmedDraftReminderV369().catch(()=>{}),300)});
window.addEventListener('focus',()=>setTimeout(()=>checkUnconfirmedDraftReminderV369().catch(()=>{}),300));


/* ================= V39.9 Import -> associated Sales card deep link =================
   Import Cost System can return to the exact Sales/Fair/Live context without
   confirming a sale or touching inventory. The transactionId is used only to
   scroll/highlight the matching saved card after that day's cards are loaded. */
function getImportSalesCardDeepLinkV370(){
  try{
    const p=new URLSearchParams(window.location.search||'');
    if(p.get('openSalesCard')!=='1')return null;
    return {
      type:String(p.get('salesType')||'').trim().toLowerCase(),
      date:String(p.get('salesDate')||'').trim(),
      location:String(p.get('salesLocation')||'').trim(),
      transactionId:String(p.get('salesTxn')||'').trim(),
      linkId:String(p.get('salesLink')||'').trim()
    };
  }catch(_){return null}
}
function salesDeepLinkPageV370(type){return type==='live'?'live':type==='fair'?'fair':'sales'}
function highlightAssociatedSalesCardV370(type,target){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+'ProductItems');
  if(!wrap)return false;
  const cards=[...wrap.querySelectorAll('.sales-card-transaction-v239')];
  let card=null;
  if(target.transactionId)card=cards.find(c=>String(c.dataset.transactionId||'')===target.transactionId)||null;
  if(!card&&target.linkId){
    card=cards.find(c=>[...c.querySelectorAll('.product-link-item')].some(i=>String(i.dataset.linkId||'')===target.linkId))||null;
  }
  if(!card)return false;
  card.classList.add('associated-sales-card-v370');
  card.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(()=>card.classList.remove('associated-sales-card-v370'),5000);
  return true;
}
async function openAssociatedSalesCardFromImportV370(){
  const target=getImportSalesCardDeepLinkV370();if(!target)return;
  let type=target.type;
  if(type==='sales')type='daily';
  if(!['daily','fair','live'].includes(type))return;
  const page=salesDeepLinkPageV370(type);
  const nav=document.querySelector(`.nav-item[data-page="${page}"]`);
  showPage(page,nav);
  const iso=/^\d{2}-\d{2}-\d{4}$/.test(target.date)?displayToISO(target.date):target.date;
  if(type==='live'){
    const host=document.getElementById('liveHost');if(host&&target.location)host.value=target.location;
    if(iso)setDateControl('liveDate',iso);
    updateLiveInputFromSelectedDate();renderLiveDailySummary();renderLiveMonthlyList();
  }else if(type==='fair'){
    const loc=document.getElementById('fairLocation');if(loc&&target.location)loc.value=canonicalLocation(target.location);
    if(iso){setDateControl('fairStart',iso);setDateControl('fairEnd',iso)}
    if(target.location&&iso)saveLocalFairSessionV320(target.location,iso,iso);
    updateFairPageMode();syncFairInputs();syncFairProductDatesV203(true);
    const fairProductDate=document.getElementById('fairProductDate');if(fairProductDate&&target.date)fairProductDate.value=target.date;
    refreshFairInputsFromRows(false);renderFairDailySummary();renderFairMonthlyList();
  }else{
    const company=document.getElementById('company');
    const loc=String(target.location||'').toLowerCase();
    if(company){company.value=loc.includes('balakong')?'balakong':'belimbing'}
    if(iso)setDateControl('saleDate',iso);
    updateDailyInputFromSelectedDate();
  }
  const pre=productLinkPreV208(type),body=document.getElementById(pre+'ProductLinkBody'),box=document.getElementById(pre+'ProductLinkBox');
  if(body&&body.classList.contains('hidden')){
    body.classList.remove('hidden');box?.classList.remove('product-link-collapsed');
    box?.querySelector('.product-link-toggle')?.setAttribute('aria-expanded','true');
  }
  try{await loadProductLinksIntoEditorV206(type)}catch(e){console.warn('V39.9 associated card load failed',e)}
  if(!highlightAssociatedSalesCardV370(type,target)){
    setTimeout(()=>highlightAssociatedSalesCardV370(type,target),600);
  }
  try{
    const clean=new URL(window.location.href);['openSalesCard','salesType','salesDate','salesLocation','salesTxn','salesLink'].forEach(k=>clean.searchParams.delete(k));
    history.replaceState(null,'',clean.pathname+(clean.search||'')+clean.hash);
  }catch(_){}
}
window.openAssociatedSalesCardFromImportV370=openAssociatedSalesCardFromImportV370;
window.addEventListener('load',()=>setTimeout(()=>openAssociatedSalesCardFromImportV370(),500));


/* ================= V39.9 Fair/Live incremental turnover composer =================
   Accounting compatibility rule: existing Fair/Live row.amount remains the only
   amount consumed by commission, profit, Home and monthly reports. The entry
   breakdown is auxiliary. Old rows are shown as one legacy component until the
   user first adds/edits/deletes an entry. Sales (Balakong/Belimbing) is untouched.
*/
const TURNOVER_ENTRY_CACHE_KEY_V376='lover_turnover_entries_v376';
const TURNOVER_ENTRY_PENDING_KEY_V376='lover_turnover_entries_pending_v376';
const TURNOVER_NEW_DRAFT_KEY_V376='lover_turnover_new_drafts_v376';
function readTurnoverNewDraftsV376(){try{const x=JSON.parse(localStorage.getItem(TURNOVER_NEW_DRAFT_KEY_V376)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return{}}}
function turnoverNewDraftKeyV376(type){const c=turnoverContextV376(type);return c.date&&c.location?turnoverContextKeyV376(type,c.date,c.location):''}
function saveTurnoverNewDraftV376(type,value){const key=turnoverNewDraftKeyV376(type);if(!key)return;const all=readTurnoverNewDraftsV376();if(String(value||'').trim())all[key]={value:String(value),at:Date.now()};else delete all[key];try{localStorage.setItem(TURNOVER_NEW_DRAFT_KEY_V376,JSON.stringify(all))}catch(_){}}
function restoreTurnoverNewDraftV376(type){const ids=turnoverIdsV376(type),input=document.getElementById(ids.input);if(!input||document.activeElement===input)return;const key=turnoverNewDraftKeyV376(type),x=key?readTurnoverNewDraftsV376()[key]:null;input.value=x?String(x.value||''):''}
function clearTurnoverNewDraftV376(type){saveTurnoverNewDraftV376(type,'')}
// V46.3: remove only a proven stale new-turnover draft. If the local draft amount
// matches an old cached turnover component but the authoritative total has changed
// (for example the turnover was deleted on another device), it is not a new unsaved
// entry anymore. Genuine unmatched local edits remain protected.
function clearStaleTurnoverNewDraftV461(type){
  const ctx=turnoverContextV376(type);if(!ctx.date||!ctx.location||turnoverWriteStateV382[type])return false;
  const key=turnoverContextKeyV376(type,ctx.date,ctx.location),drafts=readTurnoverNewDraftsV376(),draft=drafts[key];if(!draft)return false;
  const pending=readTurnoverEntryPendingV376();if(pending&&pending[key])return false;
  const cached=getTurnoverEntryCacheV376(type,ctx.date,ctx.location);if(!cached||!Array.isArray(cached.entries)||!cached.entries.length)return false;
  const official=officialTurnoverV376(type,ctx.date,ctx.location),cachedTotal=entriesSumV376(cached.entries);
  if(Math.abs(cachedTotal-official)<=0.005)return false;
  const amount=Math.round(toAmount(draft.value||0)*100)/100;
  const matched=normalizeTurnoverEntriesClientV376(cached.entries).some(x=>Math.abs(Number(x.amount||0)-amount)<=0.005);
  if(!matched)return false;
  const input=document.getElementById(turnoverIdsV376(type).input);if(document.activeElement===input)return false;
  delete drafts[key];try{localStorage.setItem(TURNOVER_NEW_DRAFT_KEY_V376,JSON.stringify(drafts))}catch(_){}
  if(input&&Math.abs(Math.round(toAmount(input.value||0)*100)/100-amount)<=0.005)input.value='';
  return true;
}
function clearLateConfirmedTurnoverDraftV439(row){
  const type=String(row?.type||'').trim();if(!['daily','fair','live'].includes(type))return false;
  const date=String(row?.date||'').trim(),location=type==='daily'?(String(row?.company||'').toLowerCase()==='balakong'?'Balakong':'Belimbing'):String(row?.location||'').trim();
  if(!date||!location)return false;
  const expected=Math.round(Number(row?.amount||0)*100)/100,key=turnoverContextKeyV376(type,date,location),cached=getTurnoverEntryCacheV376(type,date,location),entries=normalizeTurnoverEntriesClientV376(cached?.entries||[]);
  if(!String(cached?.source||'').startsWith('optimistic-v382')||Math.abs(entriesSumV376(entries)-expected)>0.005)return false;
  const drafts=readTurnoverNewDraftsV376(),draft=drafts[key],last=entries[entries.length-1],draftAmount=Math.round(toAmount(draft?.value||0)*100)/100;
  if(draft&&last&&Math.abs(draftAmount-Number(last.amount||0))<=0.005){delete drafts[key];try{localStorage.setItem(TURNOVER_NEW_DRAFT_KEY_V376,JSON.stringify(drafts))}catch(_){}}
  setTurnoverEntryCacheV376(type,date,location,entries,'cloud-confirmed-v439');
  const ctx=turnoverContextV376(type);
  if(ctx.date===date&&turnoverContextKeyV376(type,ctx.date,ctx.location)===key){
    const input=document.getElementById(turnoverIdsV376(type).input),inputAmount=Math.round(toAmount(input?.value||0)*100)/100;
    if(input&&last&&Math.abs(inputAmount-Number(last.amount||0))<=0.005)input.value='';
    setTurnoverSaveButtonV382(type,'saved');renderTurnoverComposerV376(type);
  }
  return true;
}
window.addEventListener('lover-sales-pending-cloud-confirmed-v439',event=>{
  const confirmed=Array.isArray(event?.detail?.rows)?event.detail.rows:[];
  let cleared=false;confirmed.forEach(row=>{if(clearLateConfirmedTurnoverDraftV439(row))cleared=true});
  if(cleared)setSync('营业额已确认同步',true);
});
function readTurnoverEntryPendingV376(){try{const x=JSON.parse(localStorage.getItem(TURNOVER_ENTRY_PENDING_KEY_V376)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return{}}}
function writeTurnoverEntryPendingV376(x){try{localStorage.setItem(TURNOVER_ENTRY_PENDING_KEY_V376,JSON.stringify(x||{}))}catch(_){}}
function rememberTurnoverEntryPendingV376(type,date,location,entries,total){const p=readTurnoverEntryPendingV376(),key=turnoverContextKeyV376(type,date,location);p[key]={type,date,location,entries:normalizeTurnoverEntriesClientV376(entries),total:Number(total||0),savedAt:Date.now()};writeTurnoverEntryPendingV376(p)}
function clearTurnoverEntryPendingV376(type,date,location){const p=readTurnoverEntryPendingV376(),key=turnoverContextKeyV376(type,date,location);if(p[key]){delete p[key];writeTurnoverEntryPendingV376(p)}}
const turnoverEntryMemoryV376=new Map();
const turnoverEntryLoadTokenV376={daily:0,fair:0,live:0};
function turnoverContextV376(type){
  if(type==='daily')return{type,date:isoToDisplay(String(document.getElementById('saleDate')?.value||'')),location:String(document.getElementById('company')?.value||'')==='balakong'?'Balakong':'Belimbing'};
  if(type==='fair')return{type,date:fairSelectedDateV353(),location:fairSelectedLocationV353()};
  return{type,date:isoToDisplay(String(document.getElementById('liveDate')?.value||'')),location:selectedLiveHost()};
}
function turnoverContextKeyV376(type,date,location){const n=type==='live'?normalizeLiveHostKey(location):normalizeFairLocationKey(location);return[type,date,n].join('|')}
function readTurnoverLocalV376(){try{const x=JSON.parse(localStorage.getItem(TURNOVER_ENTRY_CACHE_KEY_V376)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return{}}}
function writeTurnoverLocalV376(obj){try{localStorage.setItem(TURNOVER_ENTRY_CACHE_KEY_V376,JSON.stringify(obj||{}))}catch(_){}}
function normalizeTurnoverEntriesClientV376(entries){return(Array.isArray(entries)?entries:[]).slice(0,200).map((x,i)=>{const o=x&&typeof x==='object'?x:{amount:x},amount=Math.round(Number(o.amount||0)*100)/100;if(!Number.isFinite(amount)||amount<=0.005)return null;return{id:String(o.id||('e'+Date.now()+'_'+i)),amount,createdAt:String(o.createdAt||''),updatedAt:String(o.updatedAt||'')}}).filter(Boolean)}
function officialTurnoverV376(type,date,location){
  if(type==='daily'){const company=String(location||'').toLowerCase().includes('balakong')?'balakong':'belimbing';const found=dedupeRows(rows).find(r=>r.type==='daily'&&r.date===date&&r.company===company);return found?Number(found.amount||0):0;}
  const norm=type==='live'?normalizeLiveHostKey:normalizeFairLocationKey;
  const found=dedupeRows(rows).find(r=>r.type===type&&r.date===date&&norm(r.location)===norm(location));return found?Number(found.amount||0):0;
}
function entriesSumV376(entries){return Math.round(normalizeTurnoverEntriesClientV376(entries).reduce((s,x)=>s+Number(x.amount||0),0)*100)/100}
// V50.8: current turnover detail is sourced only from TurnoverEntries.
// Sales Change Log is audit/history only; it must never create, split, merge,
// edit, or delete a visible turnover entry. This keeps entry IDs stable across
// devices and makes edit/delete deterministic.
function fallbackTurnoverEntriesV376(type,date,location){
  const total=officialTurnoverV376(type,date,location);
  return total>0?[{id:'legacy_'+turnoverContextKeyV376(type,date,location),amount:total,legacy:true,createdAt:'',updatedAt:''}]:[];
}
function displayTurnoverEntriesV488(type,date,location,official,cached){
  const clean=normalizeTurnoverEntriesClientV376(cached?.entries||[]);
  if(!clean.length)return{entries:fallbackTurnoverEntriesV376(type,date,location),pending:false};
  const sum=entriesSumV376(clean),target=Math.round(Number(official||0)*100)/100;
  if(Math.abs(sum-target)<=0.005)return{entries:clean,pending:false};
  if(target<=0.005)return{entries:[],pending:true};
  if(sum>target+0.005){
    const delta=Math.round((sum-target)*100)/100;
    for(let i=clean.length-1;i>=0;i--){
      if(Math.abs(Number(clean[i].amount||0)-delta)<=0.005){
        const next=clean.slice();next.splice(i,1);
        if(Math.abs(entriesSumV376(next)-target)<=0.005)return{entries:next,pending:true};
      }
    }
    let removed=0;
    for(let i=clean.length-1;i>=0;i--){
      removed=Math.round((removed+Number(clean[i].amount||0))*100)/100;
      if(Math.abs(removed-delta)<=0.005){
        const next=clean.slice(0,i);
        if(Math.abs(entriesSumV376(next)-target)<=0.005)return{entries:next,pending:true};
      }
      if(removed>delta+0.005)break;
    }
  }
  return{entries:clean,pending:true};
}
function turnoverDetailPendingV488(type){
  const ctx=turnoverContextV376(type);if(!ctx.date||!ctx.location)return false;
  const cached=getTurnoverEntryCacheV376(type,ctx.date,ctx.location);if(!cached||!Array.isArray(cached.entries)||!cached.entries.length)return false;
  return Math.abs(entriesSumV376(cached.entries)-officialTurnoverV376(type,ctx.date,ctx.location))>0.005;
}
function setTurnoverEntryCacheV376(type,date,location,entries,source='local'){
  if(!date||!location)return;const key=turnoverContextKeyV376(type,date,location),clean=normalizeTurnoverEntriesClientV376(entries);turnoverEntryMemoryV376.set(key,{entries:clean,source,at:Date.now()});const all=readTurnoverLocalV376();all[key]={entries:clean,source,at:Date.now()};writeTurnoverLocalV376(all)
}
function getTurnoverEntryCacheV376(type,date,location){
  const key=turnoverContextKeyV376(type,date,location),mem=turnoverEntryMemoryV376.get(key);if(mem)return mem;
  const local=readTurnoverLocalV376()[key];if(local&&Array.isArray(local.entries)){const value={entries:normalizeTurnoverEntriesClientV376(local.entries),source:local.source||'local',at:Number(local.at||0)};turnoverEntryMemoryV376.set(key,value);return value}return null;
}
function replaceAuthoritativeDailyLocalV518(date,location,amount,updatedAt=''){
  const company=canonicalDailyCompanyKeyV518(location||'');
  const same=r=>String(r?.type||'')==='daily'&&String(r?.date||'')===String(date||'')&&canonicalDailyCompanyKeyV518(r?.company||r?.location||'')===company;
  rows=rows.filter(r=>!same(r));
  if(typeof pendingRows!=='undefined'&&Array.isArray(pendingRows)){
    pendingRows=pendingRows.filter(r=>!same(r));
    if(typeof savePendingRows==='function')savePendingRows();
  }
  const value=Math.round(Number(amount||0)*100)/100;
  if(value>0)rows.push({type:'daily',date:String(date||''),company,location:'',amount:value,updatedAt:String(updatedAt||'')});
  return company;
}
function turnoverIdsV376(type){return type==='daily'?{history:'dailyTurnoverHistoryV432',total:'dailyTurnoverTotalV432',input:'dailyTurnoverNewV432',hidden:'dailySales'}:type==='fair'?{history:'fairTurnoverHistoryV376',total:'fairTurnoverTotalV376',input:'fairTurnoverNewV376',hidden:'fairSales'}:{history:'liveTurnoverHistoryV376',total:'liveTurnoverTotalV376',input:'liveTurnoverNewV376',hidden:'liveSales'}}
function renderTurnoverComposerV376(type){
  const ctx=turnoverContextV376(type),ids=turnoverIdsV376(type),history=document.getElementById(ids.history),totalEl=document.getElementById(ids.total),hidden=document.getElementById(ids.hidden);if(!history||!totalEl||!hidden)return;
  if(!ctx.date||!ctx.location){history.innerHTML='<span class="turnover-history-empty-v376">请选择日期及'+(type==='live'?'主播':type==='daily'?'公司':'地点')+'</span>';totalEl.textContent='0.00';hidden.value='0.00';return}
  clearStaleTurnoverNewDraftV461(type);
  restoreTurnoverNewDraftV376(type);
  const official=officialTurnoverV376(type,ctx.date,ctx.location),cached=getTurnoverEntryCacheV376(type,ctx.date,ctx.location);
  const display=displayTurnoverEntriesV488(type,ctx.date,ctx.location,official,cached),entries=display.entries;
  // The total is always authoritative. Entry history is auxiliary and may remain
  // on the last known breakdown for a few seconds while its independent read catches up.
  hidden.value=formatAmount(official);totalEl.textContent=formatAmount(official);
  if(!entries.length){history.innerHTML='';return}
  history.innerHTML='';entries.forEach((entry,index)=>{
    if(index){const plus=document.createElement('span');plus.className='turnover-plus-v376';plus.textContent='+';history.appendChild(plus)}
    const btn=document.createElement('button');btn.type='button';btn.className='turnover-piece-v376';btn.textContent=Number(entry.amount||0).toLocaleString('en-MY',{minimumFractionDigits:0,maximumFractionDigits:2});btn.title=display.pending?'营业额明细同步中…':'点击修改；长按删除';btn.dataset.entryId=entry.id;btn.disabled=!!turnoverWriteStateV382[type]||display.pending;btn.addEventListener('contextmenu',e=>e.preventDefault());
    let timer=0,longPressed=false;
    const cancel=()=>{if(timer){clearTimeout(timer);timer=0}};
    btn.addEventListener('pointerdown',()=>{longPressed=false;timer=setTimeout(()=>{longPressed=true;deleteTurnoverEntryV376(type,entry.id)},650)});
    ['pointerup','pointercancel','pointerleave'].forEach(ev=>btn.addEventListener(ev,cancel));
    btn.addEventListener('click',e=>{if(longPressed){e.preventDefault();longPressed=false;return}editTurnoverEntryV376(type,entry.id)});
    history.appendChild(btn);
  });
}
async function refreshTurnoverEntriesV376(type,{force=false,fast=false}={}){
  const ctx=turnoverContextV376(type);if(!ctx.date||!ctx.location){renderTurnoverComposerV376(type);return null}
  renderTurnoverComposerV376(type);const token=++turnoverEntryLoadTokenV376[type];
  try{
    const rec=await loadTurnoverEntriesFromSheetV376(type,ctx.date,ctx.location);if(token!==turnoverEntryLoadTokenV376[type])return null;
    const current=turnoverContextV376(type);if(current.date!==ctx.date||turnoverContextKeyV376(type,current.date,current.location)!==turnoverContextKeyV376(type,ctx.date,ctx.location))return null;
    if(rec&&Array.isArray(rec.entries)){
      // V50.8: publish only the real TurnoverEntries row. If the authoritative
      // total arrives first, keep the previous detail temporarily rather than
      // inventing a delta chip from Change Log. The next selective detail read
      // will replace it with the real edited/deleted entry set.
      const clean=normalizeTurnoverEntriesClientV376(rec.entries);
      setTurnoverEntryCacheV376(type,ctx.date,ctx.location,clean,'cloud-v506');
      if(type==='daily'&&Number.isFinite(Number(rec.amount))){
        replaceAuthoritativeDailyLocalV518(ctx.date,ctx.location,Number(rec.amount||0),String(rec.updatedAt||''));
        saveLocalDataCache();
        if(typeof renderSelectedDayGrandV362==='function')renderSelectedDayGrandV362('daily');
      }
    }
  }catch(e){console.warn('V50.8 turnover entry read',e)}
  renderTurnoverComposerV376(type);return getTurnoverEntryCacheV376(type,ctx.date,ctx.location);
}
function proposedEntriesV376(type){const ctx=turnoverContextV376(type),cached=getTurnoverEntryCacheV376(type,ctx.date,ctx.location),official=officialTurnoverV376(type,ctx.date,ctx.location);const validCached=cached&&Math.abs(entriesSumV376(cached.entries)-official)<=0.005?cached.entries:null;return normalizeTurnoverEntriesClientV376(validCached||fallbackTurnoverEntriesV376(type,ctx.date,ctx.location))}
async function confirmTurnoverCloudAfterTimeoutV395(localRow,expectedEntries=null,notificationMeta={}){
  // V51.0: a timeout is success only when BOTH authoritative total and the exact
  // TurnoverEntries context reached cloud. This prevents false success with split state.
  try{
    const type=String(localRow?.type||''),date=String(localRow?.date||'');
    const location=type==='daily'?String(localRow?.company||''):String(localRow?.location||'');
    if(!type||!date||!location)return null;
    const cloud=typeof getTurnoverContextFromSheetV509==='function'?await getTurnoverContextFromSheetV509(type,date,location):null;
    if(!cloud)return null;
    const wanted=normalizeTurnoverEntriesClientV376(expectedEntries||[]),got=normalizeTurnoverEntriesClientV376(cloud.entries||[]);
    if(Array.isArray(expectedEntries)){
      const action=String(notificationMeta?.action||''),entryId=String(notificationMeta?.entryId||'');
      if(entryId&&['added_entry','retried_entry'].includes(action)){
        const expected=wanted.find(e=>String(e.id||'')===entryId),actual=got.find(e=>String(e.id||'')===entryId);
        if(!expected||!actual||Math.abs(Number(expected.amount||0)-Number(actual.amount||0))>0.005)return null;
      }else if(entryId&&action==='modified_entry'){
        const actual=got.find(e=>String(e.id||'')===entryId);if(!actual||Math.abs(Number(actual.amount||0)-Number(notificationMeta?.newAmount||0))>0.005)return null;
      }else if(entryId&&action==='deleted_entry'){
        if(got.some(e=>String(e.id||'')===entryId))return null;
      }else{
        const sig=x=>x.map(e=>`${String(e.id||'')}@${Number(e.amount||0).toFixed(2)}`).join('|');
        if(Math.abs(Number(cloud.amount||0)-Number(localRow.amount||0))>0.005||sig(wanted)!==sig(got))return null;
      }
    }
    clearPendingRowIfVersionV343(localRow);
    if(Number(cloud.amount||0)>0)upsertLocalRow({...localRow,amount:Number(cloud.amount||0),updatedAt:String(cloud.updatedAt||localRow.updatedAt||'')});
    else rows=rows.filter(r=>syncKey(r)!==syncKey(localRow));
    if(Array.isArray(cloud.entries))setTurnoverEntryCacheV376(type,date,location,cloud.entries,'cloud-v509-timeout-confirmed');
    saveLocalDataCache();renderAll();
    return {...localRow,...cloud};
  }catch(_){return null}
}
async function awaitTurnoverWriteOrVerifyV516(writePromise,localRow,expectedEntries,notificationMeta){
  // V51.8: keep the original fast path untouched. If its ACK is unusually slow,
  // verify only this exact turnover context instead of leaving the button busy
  // for the full 45-second transport timeout.
  const outcomeV516=Promise.resolve(writePromise).then(value=>({ok:true,value}),error=>({ok:false,error}));
  const firstV516=await Promise.race([
    outcomeV516,
    new Promise(resolve=>setTimeout(()=>resolve({pending:true}),6500))
  ]);
  if(!firstV516.pending){if(firstV516.ok)return firstV516.value;throw firstV516.error;}
  const confirmedV516=await confirmTurnoverCloudAfterTimeoutV395(localRow,expectedEntries,notificationMeta);
  if(confirmedV516)return{...confirmedV516,turnoverEntriesRecord:{entries:normalizeTurnoverEntriesClientV376(confirmedV516.entries||expectedEntries||[])},verifiedAfterSlowAckV516:true};
  const finalV516=await outcomeV516;if(finalV516.ok)return finalV516.value;throw finalV516.error;
}
async function fastSyncVisibleTurnoverContextV516(){
  // Revision-probe fallback: update only the visible turnover context. Other
  // cloud data remains on the existing protected selective-sync path.
  let type='';
  if(document.getElementById('page-sales')?.classList.contains('active'))type='daily';
  else if(document.getElementById('page-fair')?.classList.contains('active'))type='fair';
  else if(document.getElementById('page-live')?.classList.contains('active'))type='live';
  if(!type||typeof getTurnoverContextFromSheetV509!=='function')return null;
  const ctx=turnoverContextV376(type);if(!ctx.date||!ctx.location)return null;
  const rec=await getTurnoverContextFromSheetV509(type,ctx.date,ctx.location,6000);if(!rec)return null;
  const previous=officialTurnoverV376(type,ctx.date,ctx.location),amount=Math.round(Number(rec.amount||0)*100)/100;
  if(type==='daily'){
    // V51.8: replace every spelling/case variant and obsolete pending cache.
    replaceAuthoritativeDailyLocalV518(ctx.date,ctx.location,amount,String(rec.updatedAt||''));
  }else{
    const row={type,date:ctx.date,company:type,location:ctx.location,amount,updatedAt:String(rec.updatedAt||'')};
    if(amount>0)upsertLocalRow(row);else rows=rows.filter(r=>syncKey(r)!==syncKey(row));
  }
  if(Array.isArray(rec.entries))setTurnoverEntryCacheV376(type,ctx.date,ctx.location,rec.entries,'cloud-v516-fast-visible');
  saveLocalDataCache();renderAll();renderTurnoverComposerV376(type);
  return{ok:true,type,date:ctx.date,location:ctx.location,amount,updated:Math.abs(previous-amount)>0.005};
}
window.fastSyncVisibleTurnoverContextV516=fastSyncVisibleTurnoverContextV516;
async function saveTurnoverTotalV376(type,total,notificationMeta={},turnoverEntries=null){
  if(type==='daily'){
    if(!ensureWritableSelection())return null;
    const ctx=turnoverContextV376(type),company=String(document.getElementById('company')?.value||''),hidden=document.getElementById('dailySales');
    if(!ctx.date){alert('请选择日期');return null}total=Math.round(Number(total||0)*100)/100;if(hidden)hidden.value=formatAmount(total);
    const previous=rows.find(r=>r.type==='daily'&&r.date===ctx.date&&r.company===company),now=new Date().toISOString(),mutation=nextClientMutationV344();
    const turnoverMutation={action:String(notificationMeta?.action||''),amount:Number(notificationMeta?.amount||0),oldAmount:Number(notificationMeta?.oldAmount||0),newAmount:Number(notificationMeta?.newAmount||0),entryId:String(notificationMeta?.entryId||'')};
    const localRow={type:'daily',date:ctx.date,company,location:'',amount:total,updatedAt:now,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:String(previous?.updatedAt||''),turnoverMutation};
    const deletingTurnover=String(notificationMeta?.action||'')==='deleted_entry';
    addPendingRow(localRow);if(typeof markLocalRowMutation==='function')markLocalRowMutation(localRow);setSync(deletingTurnover?'Sales · 营业额 删除中':'Sales · 新增营业额 保存中');
    try{
      const saved=await awaitTurnoverWriteOrVerifyV516(saveDailyToSheet(ctx.date,company,total,now,mutation.clientDeviceId||'',Number(mutation.clientSequence||0),localRow.baseCloudUpdatedAt,true,getLocalRestoreGenerationV347(),notificationMeta,turnoverEntries),localRow,turnoverEntries,notificationMeta);
      if(saved&&Number(saved.amount)>0)upsertLocalRow(saved);else if(total<=0)rows=rows.filter(r=>syncKey(r)!==syncKey(localRow));else upsertLocalRow(localRow);
      const ackEntries=normalizeTurnoverEntriesClientV376(saved?.turnoverEntriesRecord?.entries||turnoverEntries||[]);
      clearPendingRowIfVersionV343(localRow);saveLocalDataCache();renderAll();setSync(deletingTurnover?`${ctx.location} 营业额删除成功`:`${ctx.location} Sales 已同步`,true);return{ok:true,entries:ackEntries,amount:Number(saved?.amount||total)};
    }catch(e){const confirmed=await confirmTurnoverCloudAfterTimeoutV395(localRow,turnoverEntries,notificationMeta);if(confirmed){setSync(deletingTurnover?`${ctx.location} 营业额删除成功`:`${ctx.location} 营业额已同步`,true);return{ok:true,entries:normalizeTurnoverEntriesClientV376(confirmed.entries||turnoverEntries||[]),amount:Number(confirmed.amount||total)}}setPendingRetrySyncStatus();alert(`${ctx.location} 营业额${deletingTurnover?'删除':'保存'}失败：${e.message||e}`);return null}
  }
  if(!ensureWritableSelection())return null;const isLive=type==='live',ctx=turnoverContextV376(type),dateEl=document.getElementById(isLive?'liveDate':'fairStart'),entityEl=document.getElementById(isLive?'liveHost':'fairLocation'),hidden=document.getElementById(isLive?'liveSales':'fairSales');
  if(!ctx.location){alert(isLive?'请输入主播名字':'请输入 Fair 地点');return null}if(!ctx.date){alert('请选择日期');return null}
  let entity=ctx.location;if(isLive){entity=reactivateLiveHostIfNeeded(entity).host;entityEl.value=entity;saveLiveHost(entity);saveLastLiveSession(entity,dateEl.value)}else{entity=canonicalLocation(entity);entityEl.value=entity;saveFairLocation(entity)}
  total=Math.round(Number(total||0)*100)/100;hidden.value=formatAmount(total);
  const now=new Date().toISOString(),mutation=nextClientMutationV344(),normalizer=isLive?normalizeLiveHostKey:normalizeFairLocationKey,previous=rows.find(r=>r.type===type&&r.date===ctx.date&&normalizer(r.location)===normalizer(entity));
  const turnoverMutation={action:String(notificationMeta?.action||''),amount:Number(notificationMeta?.amount||0),oldAmount:Number(notificationMeta?.oldAmount||0),newAmount:Number(notificationMeta?.newAmount||0),entryId:String(notificationMeta?.entryId||'')};
  const localRow={type,date:ctx.date,company:type,location:entity,amount:total,updatedAt:now,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:String(previous?.updatedAt||''),turnoverMutation};
  const deletingTurnover=String(notificationMeta?.action||'')==='deleted_entry';
  addPendingRow(localRow);if(typeof markLocalRowMutation==='function')markLocalRowMutation(localRow);setSync(deletingTurnover?`${isLive?'Live':'Fair'} · 营业额 删除中`:`${isLive?'Live':'Fair'} · 新增营业额 保存中`);
  try{
    let saved=null;
    const writePromiseV516=isLive
      ?saveLiveToSheet(ctx.date,entity,total,now,mutation.clientDeviceId||'',Number(mutation.clientSequence||0),localRow.baseCloudUpdatedAt,true,getLocalRestoreGenerationV347(),notificationMeta,turnoverEntries)
      :(async()=>{const result=await saveFairBatchToSheet(entity,[{date:ctx.date,amount:total,clientUpdatedAt:now,...mutation,baseCloudUpdatedAt:localRow.baseCloudUpdatedAt,notificationAction:String(notificationMeta?.action||''),notificationAmount:Number(notificationMeta?.amount||0),notificationOldAmount:Number(notificationMeta?.oldAmount||0),notificationNewAmount:Number(notificationMeta?.newAmount||0),notificationEntryId:String(notificationMeta?.entryId||'')}],true,turnoverEntries);const row=Array.isArray(result?.rows)?result.rows.find(r=>String(r.date||'')===ctx.date):null;if(row&&result?.turnoverEntriesRecord)row.turnoverEntriesRecord=result.turnoverEntriesRecord;return row})();
    saved=await awaitTurnoverWriteOrVerifyV516(writePromiseV516,localRow,turnoverEntries,notificationMeta);
    if(saved&&Number(saved.amount)>0)upsertLocalRow(saved);else if(total<=0)rows=rows.filter(r=>syncKey(r)!==syncKey(localRow));else upsertLocalRow({...localRow,amount:total});
    const ackEntries=normalizeTurnoverEntriesClientV376(saved?.turnoverEntriesRecord?.entries||turnoverEntries||[]);
    clearPendingRowIfVersionV343(localRow);saveLocalDataCache();renderAll();setSync(deletingTurnover?`${isLive?'Live':'Fair'} 营业额删除成功`:`${isLive?'Live':'Fair'} 营业额已同步`,true);return{ok:true,entries:ackEntries,amount:Number(saved?.amount||total)};
  }catch(e){
    // V39.9: a browser timeout is not proof that the write failed. Read the
    // authoritative month first. If the exact requested total is already there,
    // acknowledge it locally and NEVER ask the user to save the same entry again.
    const confirmed=await confirmTurnoverCloudAfterTimeoutV395(localRow,turnoverEntries,notificationMeta);
    if(confirmed){setSync(deletingTurnover?`${isLive?'Live':'Fair'} 营业额删除成功`:`${isLive?'Live':'Fair'} 营业额已同步`,true);return{ok:true,entries:normalizeTurnoverEntriesClientV376(confirmed.entries||turnoverEntries||[]),amount:Number(confirmed.amount||total)}}
    setPendingRetrySyncStatus();alert(`${isLive?'Live':'Fair'} 营业额${deletingTurnover?'删除':'保存'}失败：${e.message||e}`);return null
  }
}
async function commitTurnoverEntriesV376(type,entries,actionText,notificationMeta={}){
  setTurnoverWriteStateV382(type,true);renderTurnoverComposerV376(type);
  const ctx=turnoverContextV376(type),clean=normalizeTurnoverEntriesClientV376(entries),total=entriesSumV376(clean),before=officialTurnoverV376(type,ctx.date,ctx.location);
  // V51.4: the server applies only the targeted entry ID under one lock and
  // returns the merged authoritative list. A stale device can never replace
  // entries that were added by another device.
  const ack=await saveTurnoverTotalV376(type,total,notificationMeta,clean);if(!ack?.ok){setTurnoverWriteStateV382(type,false);renderTurnoverComposerV376(type);return false}
  // Once the atomic cloud context is confirmed (including timeout-confirm), clear
  // only the proven new-entry draft so it cannot be submitted twice.
  if(['added_entry','retried_entry'].includes(String(notificationMeta?.action||''))){
    const input=document.getElementById(turnoverIdsV376(type).input),savedAmount=Math.round(Number(notificationMeta?.amount||0)*100)/100;
    if(input&&Math.abs(Math.round(toAmount(input.value||0)*100)/100-savedAmount)<=0.005)input.value='';
    clearTurnoverNewDraftV376(type);
  }
  clearTurnoverEntryPendingV376(type,ctx.date,ctx.location);
  const authoritative=Array.isArray(ack.entries)?normalizeTurnoverEntriesClientV376(ack.entries):clean;
  setTurnoverEntryCacheV376(type,ctx.date,ctx.location,authoritative,'cloud-v514-server-merged');renderTurnoverComposerV376(type);
  showTempMsg(type==='daily'?'saveMsg':type==='live'?'liveSaveMsg':'fairSaveMsg');
  // Saving turnover changes the same authoritative total used by every old calculation.
  if(typeof renderSelectedDayGrandV362==='function')renderSelectedDayGrandV362(type);
  if(type==='fair'){renderFairDailySummary();renderFairMonthlyList()}else if(type==='live'){renderLiveDailySummary();renderLiveMonthlyList()}else renderSalesMonthlyList();
  setTurnoverWriteStateV382(type,false);renderTurnoverComposerV376(type);
  return true;
}
function turnoverSaveButtonV382(type){return document.getElementById(type==='daily'?'dailyTurnoverSaveBtnV382':type==='live'?'liveTurnoverSaveBtnV382':'fairTurnoverSaveBtnV382')}
function setTurnoverSaveButtonV382(type,state){
  const btn=turnoverSaveButtonV382(type);if(!btn)return;
  if(!btn.dataset.idleText)btn.dataset.idleText=btn.textContent;
  if(state==='saving'){btn.disabled=true;btn.textContent='储存进行中…';return}
  if(state==='saved'){btn.disabled=true;btn.textContent='✓ 已储存';setTimeout(()=>{btn.disabled=false;btn.textContent=btn.dataset.idleText||'储存'},1200);return}
  btn.disabled=false;btn.textContent=btn.dataset.idleText||'储存';
}
async function addTurnoverEntryV376(type){
  if(turnoverWriteStateV382[type])return false;
  if(turnoverDetailPendingV488(type)){scheduleTurnoverDetailRepairV486(type);setSync('营业额明细同步中，请稍候…',true);return false}
  const ids=turnoverIdsV376(type),input=document.getElementById(ids.input),value=Math.round(toAmount(input?.value||0)*100)/100;if(!value||value<0){alert('请输入新一笔营业额');return false}
  const ctx=turnoverContextV376(type),cached=getTurnoverEntryCacheV376(type,ctx.date,ctx.location);
  // V46.0: after an Apps Script timeout the optimistic entry intentionally
  // remains available for retry. If the user presses Save again with the same
  // value, resend that exact entry set instead of appending the value twice.
  // This is safe whether the first cloud request failed or completed late.
  const cachedEntries=normalizeTurnoverEntriesClientV376(cached?.entries||[]),lastCached=cachedEntries[cachedEntries.length-1];
  const retrySameTimedOutEntry=String(cached?.source||'').startsWith('optimistic-v382')&&Date.now()-Number(cached?.at||0)<=15*60*1000&&!!lastCached&&Math.abs(Number(lastCached.amount||0)-value)<=0.005;
  const entries=retrySameTimedOutEntry?cachedEntries:proposedEntriesV376(type);
  if(!retrySameTimedOutEntry)entries.push({id:'v382_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),amount:value,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  // V39.9: show the new component/total immediately while the authoritative cloud write runs.
  setTurnoverEntryCacheV376(type,ctx.date,ctx.location,entries,'optimistic-v382');
  const ids2=turnoverIdsV376(type),totalEl=document.getElementById(ids2.total),hidden=document.getElementById(ids2.hidden),optimisticTotal=entriesSumV376(entries);
  if(totalEl)totalEl.textContent=formatAmount(optimisticTotal);if(hidden)hidden.value=formatAmount(optimisticTotal);
  setTurnoverSaveButtonV382(type,'saving');
  const targetEntry=entries[entries.length-1]||null;
  const ok=await commitTurnoverEntriesV376(type,entries,retrySameTimedOutEntry?'重试':'新增',{action:retrySameTimedOutEntry?'retried_entry':'added_entry',amount:value,entryId:String(targetEntry?.id||'')});
  if(ok&&input){input.value='';clearTurnoverNewDraftV376(type);input.focus();setTurnoverSaveButtonV382(type,'saved')}else setTurnoverSaveButtonV382(type,'idle');
  return ok;
}
async function editTurnoverEntryV376(type,id){
  if(turnoverWriteStateV382[type])return false;
  if(turnoverDetailPendingV488(type)){scheduleTurnoverDetailRepairV486(type);setSync('营业额明细同步中，请稍候…',true);return false}
  const entries=proposedEntriesV376(type),index=entries.findIndex(x=>x.id===id);if(index<0)return;const old=Number(entries[index].amount||0),raw=prompt(`修改这笔营业额\n\n原金额 RM${formatAmount(old)}`,formatAmount(old));if(raw===null)return;const next=Math.round(toAmount(raw)*100)/100;if(!Number.isFinite(next)||next<0){alert('请输入有效营业额');return}if(Math.abs(next-old)<=0.005)return;
  const before=entriesSumV376(entries),after=Math.round((before-old+next)*100)/100;if(!confirm(`确认把 RM${formatAmount(old)} 修改为 RM${formatAmount(next)}？\n\n营业额总数：RM${formatAmount(before)} → RM${formatAmount(after)}`))return;
  entries[index]={...entries[index],amount:next,updatedAt:new Date().toISOString()};setTurnoverSaveButtonV382(type,'saving');const ok=await commitTurnoverEntriesV376(type,entries,'修改',{action:'modified_entry',oldAmount:old,newAmount:next,entryId:String(id||'')});if(ok)setTurnoverSaveButtonV382(type,'saved');else setTurnoverSaveButtonV382(type,'idle');
}
async function deleteTurnoverEntryV376(type,id){
  if(turnoverWriteStateV382[type])return false;
  if(turnoverDetailPendingV488(type)){scheduleTurnoverDetailRepairV486(type);setSync('营业额明细同步中，请稍候…',true);return false}
  const entries=proposedEntriesV376(type),index=entries.findIndex(x=>x.id===id);if(index<0)return;const old=Number(entries[index].amount||0),before=entriesSumV376(entries),after=Math.round((before-old)*100)/100;if(!confirm(`确认删除这笔 RM${formatAmount(old)} 营业额？\n\n营业额总数：RM${formatAmount(before)} → RM${formatAmount(after)}\n\n删除后才会保存。`))return;
  entries.splice(index,1);setTurnoverSaveButtonV382(type,'deleting');const ok=await commitTurnoverEntriesV376(type,entries,'删除',{action:'deleted_entry',oldAmount:old,entryId:String(id||'')});if(ok)setTurnoverSaveButtonV382(type,'deleted');else setTurnoverSaveButtonV382(type,'idle');
}
window.editTurnoverEntryV376=editTurnoverEntryV376;window.deleteTurnoverEntryV376=deleteTurnoverEntryV376;

// The visible input is NEW money only. Total is read-only and derived from chips.
saveDailySales=function(){return addTurnoverEntryV376('daily')};saveFairSales=function(){return addTurnoverEntryV376('fair')};saveLiveSales=function(){return addTurnoverEntryV376('live')};window.saveDailySales=saveDailySales;window.saveFairSales=saveFairSales;window.saveLiveSales=saveLiveSales;

// Context refresh: preserve old official amounts and load breakdown opportunistically.
const _updateFairSingleAmountV376=updateFairSingleAmountV353;
updateFairSingleAmountV353=function(){_updateFairSingleAmountV376();renderTurnoverComposerV376('fair');setTimeout(()=>refreshTurnoverEntriesV376('fair'),0)};window.updateFairSingleAmountV353=updateFairSingleAmountV353;
const _updateLiveInputFromSelectedDateV376=updateLiveInputFromSelectedDate;
updateLiveInputFromSelectedDate=function(){_updateLiveInputFromSelectedDateV376();renderTurnoverComposerV376('live');setTimeout(()=>refreshTurnoverEntriesV376('live'),0)};window.updateLiveInputFromSelectedDate=updateLiveInputFromSelectedDate;

// Existing turnover draft guards target the now hidden total; disable them and keep new-entry fields transient.
try{localStorage.removeItem('lover_live_turnover_drafts_v332');localStorage.removeItem('lover_fair_turnover_drafts_v356')}catch(_){}
['dailyTurnoverNewV432','fairTurnoverNewV376','liveTurnoverNewV376'].forEach(id=>{const el=document.getElementById(id);if(el){const type=id.startsWith('daily')?'daily':id.startsWith('fair')?'fair':'live';el.addEventListener('input',()=>saveTurnoverNewDraftV376(type,el.value));el.addEventListener('change',()=>saveTurnoverNewDraftV376(type,el.value));el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addTurnoverEntryV376(type)}})}});

// V39.9 save-card handoff: immediately repaint the selected day's profit from the saved result/cache.
const _saveProductLinksV376=saveProductLinksV206;
saveProductLinksV206=async function(type,...args){
  // V46.0: do not freeze unrelated contexts while the global background probe is slow.
  // Every save still carries the last known Sales Card revision and Code.gs rejects
  // a stale overwrite atomically; the exact context is refreshed immediately on conflict.
  const result=await _saveProductLinksV376(type,...args);if(!result)return result;
  try{
    const ctx=productLinkContextV206(type);
    const exact=Array.isArray(result.links)?result.links:[];
    if(Array.isArray(exact)&&typeof replaceProfitAggregateContextV457==='function')replaceProfitAggregateContextV457(type,ctx.date,ctx.location,exact);
    const dayLinks=typeof getDailyProfitCacheV237==='function'?(getDailyProfitCacheV237(type,ctx.date)||[]):exact;
    // V50.8: seed the selected-day authority with the WHOLE day cache, never with
    // one Fair location / Live host context only. This keeps Card + Profit atomic.
    if(Array.isArray(dayLinks)&&typeof seedSelectedDayProfitV368==='function')seedSelectedDayProfitV368(type,ctx.date,dayLinks);
    if(Array.isArray(dayLinks)&&productProfitSummaryOpenV216?.[type]&&productProfitSelectedDateV216(type)===ctx.date&&typeof renderProductProfitSummaryV216==='function')renderProductProfitSummaryV216(type,dayLinks);
    if(typeof renderSelectedDayGrandV362==='function')renderSelectedDayGrandV362(type);
    if(type==='fair')renderFairMonthlyList();if(type==='live')renderLiveMonthlyList();
  }catch(e){console.warn('V50.8 immediate card/profit repaint',e)}return result;
};window.saveProductLinksV206=saveProductLinksV206;

// V39.9 deep-link fast path: handle target as soon as scripts are ready instead of waiting for full load + 500ms.
const _openAssociatedSalesCardFromImportV376=openAssociatedSalesCardFromImportV370;
let associatedSalesCardOpeningV376=false;
openAssociatedSalesCardFromImportV370=async function(){
  if(associatedSalesCardOpeningV376||!getImportSalesCardDeepLinkV370())return;
  associatedSalesCardOpeningV376=true;
  try{return await _openAssociatedSalesCardFromImportV376()}finally{associatedSalesCardOpeningV376=false}
};
window.openAssociatedSalesCardFromImportV370=openAssociatedSalesCardFromImportV370;
setTimeout(()=>{try{openAssociatedSalesCardFromImportV370()}catch(_){ }},40);

// Backup includes the auxiliary breakdown; old backups remain valid and restore as one legacy component.
const _backupAllDataV376=backupAllData;
backupAllData=async function(){return _backupAllDataV376()};window.backupAllData=backupAllData;

const turnoverPendingRetryTimersV502={};
function scheduleTurnoverEntryPendingRetryV502(type,date,location,attempt=0){
  const key=turnoverContextKeyV376(type,date,location);if(turnoverPendingRetryTimersV502[key])return;
  const delays=[700,1800,4000,8000,15000],delay=delays[Math.min(attempt,delays.length-1)];
  turnoverPendingRetryTimersV502[key]=setTimeout(async()=>{
    delete turnoverPendingRetryTimersV502[key];
    const pending=readTurnoverEntryPendingV376(),item=pending[key];if(!item)return;
    try{
      const rec=await saveTurnoverEntriesToSheetV376(item.type,item.date,item.location,item.entries,item.total,new Date().toISOString());
      clearTurnoverEntryPendingV376(item.type,item.date,item.location);
      setTurnoverEntryCacheV376(item.type,item.date,item.location,rec?.entries||item.entries,'cloud-v502');
      const current=turnoverContextV376(item.type);if(turnoverContextKeyV376(item.type,current.date,current.location)===key)renderTurnoverComposerV376(item.type);
    }catch(e){
      const msg=String(e&&e.message||e);
      if(msg.includes('云端营业额已经改变')){clearTurnoverEntryPendingV376(item.type,item.date,item.location);setTimeout(()=>ensureTurnoverDetailFreshV502(item.type),100)}
      else if(attempt<delays.length-1)scheduleTurnoverEntryPendingRetryV502(item.type,item.date,item.location,attempt+1);
      else console.warn('V50.2 turnover detail retry exhausted',e);
    }
  },delay);
}
window.scheduleTurnoverEntryPendingRetryV502=scheduleTurnoverEntryPendingRetryV502;
async function retryTurnoverEntryPendingV376(){
  const pending=readTurnoverEntryPendingV376();
  for(const [key,item] of Object.entries(pending)){
    try{
      await saveTurnoverEntriesToSheetV376(item.type,item.date,item.location,item.entries,item.total,new Date().toISOString());delete pending[key];
      setTurnoverEntryCacheV376(item.type,item.date,item.location,item.entries,'cloud-v502');
    }catch(e){
      if(String(e&&e.message||e).includes('云端营业额已经改变'))delete pending[key];
      else{console.warn('V50.2 turnover detail retry',e);scheduleTurnoverEntryPendingRetryV502(item.type,item.date,item.location,0);}
    }
  }
  writeTurnoverEntryPendingV376(pending);
}
window.retryTurnoverEntryPendingV376=retryTurnoverEntryPendingV376;
setTimeout(()=>{renderTurnoverComposerV376('daily');renderTurnoverComposerV376('fair');renderTurnoverComposerV376('live');retryTurnoverEntryPendingV376()},250);
window.addEventListener('focus',()=>setTimeout(()=>retryTurnoverEntryPendingV376(),250));


/* ================= V39.9 turnover UI + legacy-date compatibility =================
   Important: turnover total remains read-only. Only history chips are editable;
   the new-entry field is never generic money-formatted to 0.00. Existing official
   Fair/Live rows remain authoritative and are never rewritten merely by viewing.
*/
function refreshTurnoverContextV377(type,{cloud=true}={}){
  try{renderTurnoverComposerV376(type)}catch(e){console.warn('V39.9 turnover render',e)}
  if(cloud){
    setTimeout(()=>{try{refreshTurnoverEntriesV376(type,{force:true})}catch(e){console.warn('V39.9 turnover cloud refresh',e)}},0);
  }
}
function bindTurnoverContextRefreshV377(){
  const bind=(id,event,type)=>{const el=document.getElementById(id);if(!el)return;const key='turnoverV377Bound'+event.charAt(0).toUpperCase()+event.slice(1);if(el.dataset[key]==='1')return;el.dataset[key]='1';el.addEventListener(event,()=>refreshTurnoverContextV377(type,{cloud:true}))};
  bind('liveDate','change','live');
  bind('liveHost','input','live');
  bind('liveHost','change','live');
  bind('fairStart','change','fair');
  bind('fairLocation','input','fair');
  bind('fairLocation','change','fair');
  bind('saleDate','change','daily');
  bind('company','change','daily');
}
bindTurnoverContextRefreshV377();

// Earlier date controls captured the old update function before V39.9 replaced it.
// Repaint composers after every authoritative render so legacy rows appear immediately.
// V50.2: keep V48.3/V46.6 main sync untouched. After an authoritative turnover
// total has already been applied, repair only the auxiliary 100 + 200 + 300
// breakdown in the background. This never participates in revision decisions,
// never changes global sync status and never blocks the authoritative total.
const turnoverDetailRepairStateV486={daily:{timer:0,key:'',target:null,attempt:0},fair:{timer:0,key:'',target:null,attempt:0},live:{timer:0,key:'',target:null,attempt:0}};
function scheduleTurnoverDetailRepairV486(type){
  if(!['daily','fair','live'].includes(type)||turnoverWriteStateV382[type])return;
  const ctx=turnoverContextV376(type);if(!ctx.date||!ctx.location)return;
  const official=Math.round(Number(officialTurnoverV376(type,ctx.date,ctx.location)||0)*100)/100;
  const cached=getTurnoverEntryCacheV376(type,ctx.date,ctx.location);
  const cachedSum=cached?Math.round(entriesSumV376(cached.entries)*100)/100:null;
  if(official<=0.005&&!cached)return;
  // V50.2: a matching sum is not enough. Old devices may cache one fake legacy
  // chip equal to the total. Skip only after this context has been canonically
  // resolved by the V50.2 auxiliary endpoint.
  if(cached&&Math.abs(cachedSum-official)<=0.005&&['cloud-v501','cloud-v502'].includes(String(cached.source||'')))return;
  const state=turnoverDetailRepairStateV486[type],key=turnoverContextKeyV376(type,ctx.date,ctx.location);
  if(state.timer&&state.key===key&&Math.abs(Number(state.target)-official)<=0.005)return;
  if(state.timer){clearTimeout(state.timer);state.timer=0}
  if(state.key!==key||Math.abs(Number(state.target)-official)>0.005){state.key=key;state.target=official;state.attempt=0}
  const delays=[250,900,2200,5000,9000];
  const run=async()=>{
    state.timer=0;
    const current=turnoverContextV376(type);if(turnoverContextKeyV376(type,current.date,current.location)!==key)return;
    if(turnoverWriteStateV382[type]){state.timer=setTimeout(run,500);return}
    try{await refreshTurnoverEntriesV376(type,{force:true})}catch(_){}
    const after=getTurnoverEntryCacheV376(type,current.date,current.location),afterSum=after?Math.round(entriesSumV376(after.entries)*100)/100:null;
    const nowOfficial=Math.round(Number(officialTurnoverV376(type,current.date,current.location)||0)*100)/100;
    if(after&&Math.abs(afterSum-nowOfficial)<=0.005){state.attempt=0;return}
    if(state.attempt<delays.length-1){state.attempt++;state.timer=setTimeout(run,delays[state.attempt])}
  };
  state.timer=setTimeout(run,delays[state.attempt]);
}


// V51.0: fetch only turnover detail contexts that are BOTH changed and currently
// visible. This runs in parallel with the month fetch and commits before "已同步".
async function syncTurnoverDetailsForChangesV509(changes){
  const list=Array.isArray(changes)?changes.filter(x=>x&&x.kind==='turnover'):[];
  if(!list.length)return true;
  const tasks=[];
  ['daily','fair','live'].forEach(type=>{
    const ctx=turnoverContextV376(type);if(!ctx.date||!ctx.location)return;
    const norm=type==='live'?normalizeLiveHostKey:normalizeFairLocationKey;
    const touched=list.some(x=>String(x.type||'')===type&&String(x.date||'')===ctx.date&&norm(String(x.location||''))===norm(ctx.location));
    if(!touched)return;
    tasks.push(loadTurnoverEntriesFromSheetV376(type,ctx.date,ctx.location).then(rec=>{
      if(rec&&Array.isArray(rec.entries))setTurnoverEntryCacheV376(type,ctx.date,ctx.location,rec.entries,'cloud-v509-revision');
      return rec;
    }));
  });
  if(tasks.length)await Promise.all(tasks);
  return true;
}
window.syncTurnoverDetailsForChangesV509=syncTurnoverDetailsForChangesV509;

// V50.8 lean turnover-detail lane. No 1.8s polling, no focus polling, and no
// all-module post-render repair. Detail is auxiliary: refresh only the currently
// visible context when an authoritative render/context change asks for it.
const turnoverDetailFastStateV502={daily:{busy:false,last:0},fair:{busy:false,last:0},live:{busy:false,last:0}};
function activeTurnoverTypeV502(){
  const id=String(document.querySelector('.page.active')?.id||'');
  if(id==='page-sales')return'daily';if(id==='page-fair')return'fair';if(id==='page-live')return'live';return'';
}
async function ensureTurnoverDetailFreshV502(type){
  if(!['daily','fair','live'].includes(type)||document.hidden||turnoverWriteStateV382[type])return false;
  const ctx=turnoverContextV376(type);if(!ctx.date||!ctx.location)return false;
  const official=Math.round(Number(officialTurnoverV376(type,ctx.date,ctx.location)||0)*100)/100;
  const cached=getTurnoverEntryCacheV376(type,ctx.date,ctx.location),sum=cached?Math.round(entriesSumV376(cached.entries)*100)/100:null;
  const canonical=cached&&['cloud-v502','cloud-v501'].includes(String(cached.source||''));
  if(cached&&Math.abs(Number(sum)-official)<=0.005&&canonical)return true;
  const st=turnoverDetailFastStateV502[type],now=Date.now();if(st.busy||now-st.last<1200)return false;
  st.busy=true;st.last=now;
  try{await refreshTurnoverEntriesV376(type,{force:true,fast:true});return true}catch(_){return false}finally{st.busy=false;st.last=Date.now()}
}
window.ensureTurnoverDetailFreshV502=ensureTurnoverDetailFreshV502;
function requestVisibleTurnoverDetailV504(){
  const type=activeTurnoverTypeV502();if(!type)return;
  setTimeout(()=>ensureTurnoverDetailFreshV502(type),80);
}
window.requestVisibleTurnoverDetailV504=requestVisibleTurnoverDetailV504;

const _renderAllV377=renderAll;
renderAll=function(){
  const result=_renderAllV377.apply(this,arguments);
  try{
    renderTurnoverComposerV376('daily');renderTurnoverComposerV376('fair');renderTurnoverComposerV376('live');
    // V50.8: only the visible context may request auxiliary detail, once. Never
    // schedule Sales + Fair + Live repairs together after every main render.
    requestVisibleTurnoverDetailV504();
  }catch(e){console.warn('V50.8 post-render turnover',e)}
  return result;
};
window.renderAll=renderAll;

// Keep the new-entry input truly empty when it has no draft so its instruction
// is visible before the user taps it. Never turn blank into 0.00.
['dailyTurnoverNewV432','fairTurnoverNewV376','liveTurnoverNewV376'].forEach(id=>{
  const el=document.getElementById(id);if(!el)return;
  el.classList.remove('money-input');
  if(!String(el.value||'').trim()||Number(el.value)===0)el.value='';
  el.setAttribute('placeholder','输入新一笔营业额');
  el.setAttribute('autocomplete','off');
});

// V42.3 final navigation gate, installed after every legacy showPage wrapper.
const _showPageV409=showPage;
showPage=function(name,el){
  const current=String(document.querySelector('.page.active')?.id||'').replace(/^page-/,'');
  if(current&&current!==String(name||'')&&!confirmRestorePageSwitchV409())return false;
  return _showPageV409(name,el);
};
window.showPage=showPage;

/* ================= V46.0 transaction UX + global drag/drop safety ================= */
let SALES_MUTATION_LOCK_V450=false;
function setSalesMutationLockV450(value,label=''){
  SALES_MUTATION_LOCK_V450=!!value;
  window.SALES_MUTATION_LOCK_V450=SALES_MUTATION_LOCK_V450;
  document.documentElement.classList.toggle('sales-mutation-lock-v450',SALES_MUTATION_LOCK_V450);
  if(SALES_MUTATION_LOCK_V450&&label)setSync(label);
}
function salesMutationLockedV450(){return SALES_MUTATION_LOCK_V450===true}
window.salesMutationLockedV450=salesMutationLockedV450;
window.addEventListener('beforeunload',e=>{if(!SALES_MUTATION_LOCK_V450)return;e.preventDefault();e.returnValue='资料尚未完成保存，请等待成功后再离开。';return e.returnValue});
// V46.0: mobile OS/app switching cannot be cancelled by a web page. If the app is
// backgrounded during a write, preserve the durable local safety copy and force an
// immediate cloud retry/check when the app returns. In-app navigation remains blocked.
let SAVE_INTERRUPTED_BY_BACKGROUND_V457=false;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(SALES_MUTATION_LOCK_V450||Object.values(turnoverWriteStateV382).some(Boolean)){
      SAVE_INTERRUPTED_BY_BACKGROUND_V457=true;
      try{if(typeof flushPendingRowsKeepalive==='function')flushPendingRowsKeepalive()}catch(_){}
    }
    return;
  }
  if(SAVE_INTERRUPTED_BY_BACKGROUND_V457){
    SAVE_INTERRUPTED_BY_BACKGROUND_V457=false;
    try{if(typeof scheduleSalesDraftRetryV314==='function')scheduleSalesDraftRetryV314(50)}catch(_){}
    try{if(typeof retryRevisionNowV455==='function')setTimeout(retryRevisionNowV455,120)}catch(_){}
  }
});

// Any field may still be typed/edited/pasted normally. Only mouse/text drag-and-drop
// into form fields is blocked system-wide so selected price/cost text cannot be
// accidentally dropped over another field.
['dragover','drop'].forEach(evt=>document.addEventListener(evt,e=>{
  const t=e.target;
  if(t&&t.closest&&t.closest('input,textarea,select,[contenteditable="true"]')){e.preventDefault();e.stopPropagation();}
},true));
document.addEventListener('beforeinput',e=>{if(String(e.inputType||'')==='insertFromDrop'){e.preventDefault();e.stopPropagation();}},true);

const _showPageV450=showPage;
showPage=function(name,el){
  const current=String(document.querySelector('.page.active')?.id||'').replace(/^page-/,'');
  if(SALES_MUTATION_LOCK_V450&&current&&current!==String(name||'')){
    alert('资料尚未完成保存，请等待成功后再离开。');return false;
  }
  return _showPageV450(name,el);
};
window.showPage=showPage;

const _saveProductLinksV450=saveProductLinksV206;
saveProductLinksV206=async function(type,...args){
  if(SALES_MUTATION_LOCK_V450)return null;
  setSalesMutationLockV450(true,'保存中…');
  try{return await _saveProductLinksV450(type,...args)}finally{setSalesMutationLockV450(false)}
};
window.saveProductLinksV206=saveProductLinksV206;

const _deleteSalesCardTransactionV450=deleteSalesCardTransactionV239;
deleteSalesCardTransactionV239=async function(type,txnId){
  if(SALES_MUTATION_LOCK_V450)return;
  setSalesMutationLockV450(true,'删除中…');
  try{return await _deleteSalesCardTransactionV450(type,txnId)}finally{setSalesMutationLockV450(false)}
};
window.deleteSalesCardTransactionV239=deleteSalesCardTransactionV239;

/* ================= V46.0 system status + system information ================= */
const SYSTEM_RELEASE_REVISION_V442='910 → 930';
const SYSTEM_BACKUP_AT_KEY_V442='lover_sales_last_backup_at_v442';
const SYSTEM_RESTORE_AT_KEY_V442='lover_sales_last_restore_at_v442';
let systemHealthStateV442={level:'warning',issues:[],checked:false,data:null,expanded:false};
// V50.2: the read-only health endpoint is advisory only. A slow health scan must
// never override a confirmed business-data sync with a false red connection error.
const SYSTEM_HEALTH_SESSION_START_V466=Date.now();
let systemConfirmedSyncAtV466=0;
function systemLastSyncMsV466(){
  try{const raw=localStorage.getItem('lover_sales_last_sync_at_v442');const ms=Date.parse(raw||'');return Number.isFinite(ms)?ms:0}catch(_){return 0}
}
function systemHealthHasCurrentSessionSyncV466(){
  const last=Math.max(Number(systemConfirmedSyncAtV466||0),systemLastSyncMsV466());
  return last>=SYSTEM_HEALTH_SESSION_START_V466-2000;
}
function isConfirmedSyncTextV466(text){return /已同步\s*$/.test(String(text||'').trim())}
function recoverSystemHealthAfterConfirmedSyncV466(text){
  if(!isConfirmedSyncTextV466(text))return;
  systemConfirmedSyncAtV466=Date.now();
  if(systemHealthStateV442?.source==='transport-timeout'){
    systemHealthStateV442={level:'normal',issues:[],checked:true,data:systemHealthStateV442.data||null,expanded:false,source:'confirmed-sync'};
    renderSystemHealthV442();
  }
}
window.addEventListener('lover-sales-sync-complete-v458',e=>recoverSystemHealthAfterConfirmedSyncV466(e?.detail?.text));
function formatSystemDateTimeV442(value){
  if(!value)return '-';
  const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return '-';
  const p=n=>String(n).padStart(2,'0');return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function setSystemStoredAtV442(key){try{localStorage.setItem(key,new Date().toISOString())}catch(_){}}
function getSystemStoredAtV442(key){try{return localStorage.getItem(key)||''}catch(_){return''}}
function systemLastSyncTextV442(){
  try{const saved=localStorage.getItem('lover_sales_last_sync_at_v442');if(saved)return formatSystemDateTimeV442(saved)}catch(_){}
  return '-';
}
function renderSystemInformationV442(data){
  const set=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text};
  set('systemInfoApiV442',data?.apiVersion?`V${String(data.apiVersion).replace(/^V/i,'').replace(/^5000$/,'48.8')}`:'连接异常');
  set('systemInfoSheetV442',data?.sheetConnected?'已连接 Google Web App':'连接异常');
  set('systemInfoLastSyncV442',systemLastSyncTextV442());
  set('systemInfoBackupV442',formatSystemDateTimeV442(getSystemStoredAtV442(SYSTEM_BACKUP_AT_KEY_V442)));
  set('systemInfoRestoreV442',formatSystemDateTimeV442(getSystemStoredAtV442(SYSTEM_RESTORE_AT_KEY_V442)));
  set('systemInfoRowsV442',Number.isFinite(Number(rows?.length))?String(rows.length):'-');
  set('systemInfoCardsV442',Number.isFinite(Number(data?.salesCardCount))?String(data.salesCardCount):'-');
  set('systemInfoPendingV442',Number.isFinite(Number(data?.pendingInventoryCount))?String(data.pendingInventoryCount):'-');
}
function renderSystemHealthV442(){
  const btn=document.getElementById('systemHealthStatusV442'),box=document.getElementById('systemHealthDetailsV442');if(!btn||!box)return;
  btn.classList.remove('normal','warning','error');btn.classList.add(systemHealthStateV442.level);
  const issues=Array.isArray(systemHealthStateV442.issues)?systemHealthStateV442.issues:[];
  if(!systemHealthStateV442.expanded||!issues.length){box.className='system-health-details-v442 hidden';box.innerHTML='';return}
  box.className=`system-health-details-v442 ${systemHealthStateV442.level==='error'?'error':''}`;
  box.innerHTML=`<div class="health-title-v442">⚠️ 需要检查</div><ul>${issues.map(x=>`<li>${escapeChangeLogHtmlV200(String(x))}</li>`).join('')}</ul>`;
}
function toggleSystemHealthDetailsV442(){
  if(!systemHealthStateV442.checked||systemHealthStateV442.level==='normal')return;
  systemHealthStateV442.expanded=!systemHealthStateV442.expanded;renderSystemHealthV442();
}
async function runSystemHealthCheckV442(userTriggered=false){
  const refresh=document.getElementById('systemHealthRefreshV442');
  if(refresh?.disabled)return;
  if(refresh){refresh.disabled=true;refresh.textContent='检查中…';}
  try{
    const data=await jsonp({action:'healthV443',clientVersion:'5180'},{timeoutMs:15000});
    if(!data?.ok)throw new Error(data?.message||'系统检查失败');
    const issues=[];
    if(String(data.apiVersion||'')!=='5180')issues.push(`Frontend / API 版本不一致（Frontend 5180 / API ${data.apiVersion||'未知'}）`);
    (Array.isArray(data.issues)?data.issues:[]).forEach(x=>issues.push(String(x)));
    const severe=Boolean(data.severe)||!data.sheetConnected||String(data.apiVersion||'')!=='5180';
    systemHealthStateV442={level:severe?'error':issues.length?'warning':'normal',issues,checked:true,data,expanded:false};
    renderSystemInformationV442(data);renderSystemHealthV442();
  }catch(e){
    const message=String(e?.message||e);
    const syncedThisSession=systemHealthHasCurrentSessionSyncV466();
    systemHealthStateV442={
      level:syncedThisSession?'normal':'warning',
      issues:syncedThisSession?[]:[`系统检查暂时超时：${message}。资料同步状态不受影响，可稍后重新检查。`],
      checked:true,
      data:systemHealthStateV442?.data||null,
      expanded:false,
      source:'transport-timeout'
    };
    renderSystemHealthV442();
  }finally{if(refresh){refresh.disabled=false;refresh.textContent='重新检查';}}
}
window.toggleSystemHealthDetailsV442=toggleSystemHealthDetailsV442;window.runSystemHealthCheckV442=runSystemHealthCheckV442;
setTimeout(()=>runSystemHealthCheckV442(false),1200);


/* ================= V50.2 minimal Sales Card UX fixes (V50.2 baseline) =================
   Built directly on V50.2. Do not change the V50.2 revision/sync cadence.
   A Sales Card that has no unsaved changes is only a view state, so collapse it
   when the user leaves that Sales / Fair / Live page. Saved cards therefore
   reopen collapsed; genuinely unsaved edits keep the existing leave guard. */
function collapseCleanSalesCardV491(type){
  if(!['daily','fair','live'].includes(String(type||'')))return false;
  try{if(typeof hasUnsavedSalesCardChangesV238==='function'&&hasUnsavedSalesCardChangesV238(type))return false}catch(_){return false}
  const pre=typeof productLinkPreV208==='function'?productLinkPreV208(type):(type==='daily'?'daily':type);
  const box=document.getElementById(pre+'ProductLinkBox'),body=document.getElementById(pre+'ProductLinkBody');
  if(body)body.classList.add('hidden');
  if(box){box.classList.add('product-link-collapsed');box.querySelector('.product-link-toggle')?.setAttribute('aria-expanded','false')}
  return true;
}
window.collapseCleanSalesCardV491=collapseCleanSalesCardV491;
const _showPageV491=showPage;
showPage=function(name,el){
  const current=String(document.querySelector('.page.active')?.id||'').replace(/^page-/,'');
  const currentType=current==='sales'?'daily':current==='fair'?'fair':current==='live'?'live':'';
  const leaving=!!currentType&&current!==String(name||'');
  const cleanBefore=leaving&&!(typeof hasUnsavedSalesCardChangesV238==='function'&&hasUnsavedSalesCardChangesV238(currentType));
  const result=_showPageV491(name,el);
  if(result===false)return false;
  if(cleanBefore)collapseCleanSalesCardV491(currentType);
  return result;
};
window.showPage=showPage;


/* ================= V50.2 persistent profit view cache =================
   Profit is secondary display data. It never blocks or mutates the V48.8/V50.2
   main revision/sync authority. Existing authoritative Sales Card context updates
   continue to patch daily profit cache immediately; this layer reuses those caches
   across page opens and refreshes them silently only after Sales Card revision changes.
*/
const PROFIT_SNAPSHOT_META_KEY_V496='lover_profit_snapshot_meta_v496';
let silentProfitRefreshPendingV496=null;
let silentProfitRefreshTimerV496=null;
function profitSnapshotMetaV496(){try{const x=JSON.parse(localStorage.getItem(PROFIT_SNAPSHOT_META_KEY_V496)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return{}}}
function writeProfitSnapshotMetaV496(revision){try{localStorage.setItem(PROFIT_SNAPSHOT_META_KEY_V496,JSON.stringify({salesCardRevision:Number(revision||0),at:Date.now()}))}catch(_){}}
function knownSalesCardRevisionV496(){try{return Number((typeof getPrioritySyncLocalV315==='function'?getPrioritySyncLocalV315():{})?.salesCardRevision||0)}catch(_){return 0}}
function mainSyncBusyV496(){
  try{return (typeof syncStatusNodesV457==='function'?syncStatusNodesV457():[]).some(n=>/后台检查中|同步中|云端新资料|等待后台检查/.test(String(n?.textContent||'')))}catch(_){return false}
}
function profitExpectedDatesV496(type,month){
  return [...new Set(dedupeRows(rows).filter(r=>String(r.type||'')===String(type||'')&&displayToISO(String(r.date||'')).slice(0,7)===String(month||'')&&Number(r.amount||0)>0).map(r=>String(r.date||'')))];
}
function profitLinksForMonthCacheV496(type,month){
  const dates=profitExpectedDatesV496(type,month),all=[];
  for(const d of dates){
    const cached=typeof getDailyProfitCacheV237==='function'?getDailyProfitCacheV237(type,d):null;
    if(!Array.isArray(cached))return null;
    all.push(...cached);
  }
  return typeof dedupeProfitLinksV360==='function'?dedupeProfitLinksV360(all):all;
}
function profitLinksForMonthPromiseV496(type,month){
  const cached=profitLinksForMonthCacheV496(type,month);
  scheduleSilentProfitRefreshV496('month-'+type);
  return Array.isArray(cached)?Promise.resolve(cached):Promise.reject(new Error('profit-cache-miss'));
}
function profitLinksForDayCacheV496(type,date){
  const cached=typeof getDailyProfitCacheV237==='function'?getDailyProfitCacheV237(type,date):null;
  return Array.isArray(cached)?cached:null;
}
function profitSnapshotNeedsRefreshV496(){
  const meta=profitSnapshotMetaV496(),known=knownSalesCardRevisionV496();
  if(!meta.at)return true;
  if(known>0&&Number(meta.salesCardRevision||0)!==known)return true;
  return false;
}
function publishSilentProfitSnapshotV496(links,revision){
  const clean=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(Array.isArray(links)?links:[]):(Array.isArray(links)?links:[]);
  const groups=new Map();
  clean.forEach(x=>{if(!x?.type||!x?.date)return;const k=String(x.type)+'|'+String(x.date);if(!groups.has(k))groups.set(k,{type:String(x.type),date:String(x.date),links:[]});groups.get(k).links.push(x)});
  // Profit cache only. Never touch Sales Card caches, revision authority or setSync().
  if(typeof clearDailyProfitCacheV237==='function')clearDailyProfitCacheV237();
  groups.forEach(g=>{try{setDailyProfitCacheV237(g.type,g.date,g.links)}catch(_){}});
  writeProfitSnapshotMetaV496(revision||knownSalesCardRevisionV496());
  return clean;
}
function repaintProfitViewsV496(){
  try{['daily','fair','live'].forEach(t=>renderSelectedDayGrandV362(t))}catch(_){ }
  try{renderFairMonthlyList()}catch(_){ }
  try{renderLiveMonthlyList()}catch(_){ }
  try{if(typeof homeTodayProfitOpenV318!=='undefined'&&homeTodayProfitOpenV318){const d=homeTodayProfitDateV318(),c=homeTodayProfitCachedLinksV318(d);if(Array.isArray(c))renderHomeTodayProfitV318(c,d)}}catch(_){ }
}
async function runSilentProfitRefreshV496(reason='background'){
  if(silentProfitRefreshPendingV496)return silentProfitRefreshPendingV496;
  if(!profitSnapshotNeedsRefreshV496()||mainSyncBusyV496())return null;
  silentProfitRefreshPendingV496=(async()=>{
    try{
      const json=await jsonp({action:'getAllSalesProductLinks'},{timeoutMs:15000});
      if(!json?.ok)throw new Error(json?.message||'利润资料读取失败');
      const clean=publishSilentProfitSnapshotV496(json.links,Number(json.salesCardRevision||knownSalesCardRevisionV496()));
      repaintProfitViewsV496();
      return clean;
    }catch(e){console.warn('V50.2 静默利润读取失败',reason,e);return null}
    finally{silentProfitRefreshPendingV496=null}
  })();
  return silentProfitRefreshPendingV496;
}
function scheduleSilentProfitRefreshV496(reason='background',delay=1800){
  if(!profitSnapshotNeedsRefreshV496())return;
  if(silentProfitRefreshTimerV496)return;
  silentProfitRefreshTimerV496=setTimeout(async()=>{
    silentProfitRefreshTimerV496=null;
    if(document.visibilityState==='hidden'||mainSyncBusyV496()){scheduleSilentProfitRefreshV496(reason,2500);return}
    await runSilentProfitRefreshV496(reason);
  },Math.max(500,Number(delay||0)));
}
window.scheduleSilentProfitRefreshV496=scheduleSilentProfitRefreshV496;

renderSelectedDayGrandV362=async function(type){
  const date=selectedDayDateV362(type),token=++selectedDayGrandTokenV362[type],sales=selectedDayTurnoverV362(type,date);
  const cached=profitLinksForDayCacheV496(type,date);
  if(Array.isArray(cached))paintSelectedDayGrandV362(type,date,sales,selectedDayProfitV362(type,date,cached),false,false);
  else paintSelectedDayGrandV362(type,date,sales,0,true,false);
  scheduleSilentProfitRefreshV496('selected-day-'+type);
};
window.renderSelectedDayGrandV362=renderSelectedDayGrandV362;
renderSelectedDayTotalV360=function(type){return renderSelectedDayGrandV362(type)};
window.renderSelectedDayTotalV360=renderSelectedDayTotalV360;

toggleHomeTodayProfitV318=async function(button){
  const panel=document.getElementById('homeTodayProfitPanelV318');if(!panel)return;
  if(homeTodayProfitOpenV318&&!panel.classList.contains('hidden')){homeTodayProfitOpenV318=false;panel.classList.add('hidden');if(button)button.textContent='📊 今日总利润';return}
  const date=homeTodayProfitDateV318();if(!date)return;
  const cached=homeTodayProfitCachedLinksV318(date);
  if(Array.isArray(cached)){renderHomeTodayProfitV318(cached,date);homeTodayProfitOpenV318=true;if(button)button.textContent='📊 收起今日总利润'}
  else{homeTodayProfitOpenV318=true;panel.classList.remove('hidden');panel.innerHTML='<div class="change-log-loading">利润缓存准备中…</div>';if(button)button.textContent='📊 收起今日总利润'}
  scheduleSilentProfitRefreshV496('home-today');
};
window.toggleHomeTodayProfitV318=toggleHomeTodayProfitV318;

window.addEventListener('lover-sales-sync-complete-v458',()=>scheduleSilentProfitRefreshV496('after-main-sync',900));
setTimeout(()=>scheduleSilentProfitRefreshV496('startup-idle',2500),2500);


/* ================= V50.2 historical profit cache completion =================
   Historical profit is auxiliary only. Missing old-month cache is allowed to
   refill even when Sales Card revision has not changed. Empty dates are cached
   explicitly as [] so turnover-only days show “—” immediately and never stay
   on “读取中…”. This does not touch main sync / save / delete / ACK logic.
*/
function hasProfitCardsForContextV501(links,type,name,date){
  const clean=typeof dedupeProfitLinksV360==='function'?dedupeProfitLinksV360(Array.isArray(links)?links:[]):(Array.isArray(links)?links:[]);
  return clean.some(x=>{
    if(String(x.type||'')!==String(type||'')||String(x.date||'')!==String(date||''))return false;
    if(type==='fair')return normalizeFairLocationKey(x.location||'')===normalizeFairLocationKey(name||'');
    if(type==='live')return normalizeLiveHostKey(x.location||'')===normalizeLiveHostKey(name||'');
    if(type==='daily')return normalizeCompany(String(x.location||x.company||name||''))===normalizeCompany(String(name||x.location||x.company||''));
    return true;
  });
}
function monthHasAnyProfitCardsV501(links,type,month){
  return (Array.isArray(links)?links:[]).some(x=>String(x.type||'')===String(type||'')&&displayToISO(String(x.date||'')).slice(0,7)===String(month||''));
}
const _publishSilentProfitSnapshotV500=publishSilentProfitSnapshotV496;
publishSilentProfitSnapshotV496=function(links,revision){
  const clean=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(Array.isArray(links)?links:[]):(Array.isArray(links)?links:[]);
  if(typeof clearDailyProfitCacheV237==='function')clearDailyProfitCacheV237();
  // Mark every known turnover date as a resolved no-card day first.
  try{dedupeRows(rows).filter(r=>['daily','fair','live'].includes(String(r.type||''))&&Number(r.amount||0)>0).forEach(r=>setDailyProfitCacheV237(String(r.type),String(r.date),[]))}catch(_){}
  const groups=new Map();
  clean.forEach(x=>{if(!x?.type||!x?.date)return;const k=String(x.type)+'|'+String(x.date);if(!groups.has(k))groups.set(k,{type:String(x.type),date:String(x.date),links:[]});groups.get(k).links.push(x)});
  groups.forEach(g=>{try{setDailyProfitCacheV237(g.type,g.date,g.links)}catch(_){}});
  writeProfitSnapshotMetaV496(revision||knownSalesCardRevisionV496());
  return clean;
};
let silentProfitForceTimerV501=null;
async function runSilentProfitRefreshV501(reason='historical-cache',force=false){
  if(silentProfitRefreshPendingV496)return silentProfitRefreshPendingV496;
  if(!force&&!profitSnapshotNeedsRefreshV496())return null;
  if(mainSyncBusyV496())return null;
  silentProfitRefreshPendingV496=(async()=>{
    try{
      const json=await jsonp({action:'getAllSalesProductLinks'},{timeoutMs:15000});
      if(!json?.ok)throw new Error(json?.message||'利润资料读取失败');
      const clean=publishSilentProfitSnapshotV496(json.links,Number(json.salesCardRevision||knownSalesCardRevisionV496()));
      repaintProfitViewsV496();
      return clean;
    }catch(e){console.warn('V50.2 历史利润静默补读失败',reason,e);return null}
    finally{silentProfitRefreshPendingV496=null}
  })();
  return silentProfitRefreshPendingV496;
}
function scheduleSilentProfitForceV501(reason='historical-cache',delay=500){
  if(silentProfitForceTimerV501)return;
  silentProfitForceTimerV501=setTimeout(async()=>{
    silentProfitForceTimerV501=null;
    if(document.visibilityState==='hidden'||mainSyncBusyV496()){scheduleSilentProfitForceV501(reason,1800);return}
    await runSilentProfitRefreshV501(reason,true);
  },Math.max(250,Number(delay||0)));
}
profitLinksForMonthPromiseV496=function(type,month){
  const cached=profitLinksForMonthCacheV496(type,month);
  if(Array.isArray(cached)){scheduleSilentProfitRefreshV496('month-'+type);return Promise.resolve(cached)}
  // Old month can be incomplete even when revision is unchanged. Refill silently.
  scheduleSilentProfitForceV501('month-cache-miss-'+type,350);
  return Promise.reject(new Error('profit-cache-miss'));
};
const _paintMonthlyRollupV365V500=paintMonthlyRollupV365;
paintMonthlyRollupV365=function(type,state='loading',links=null){
  _paintMonthlyRollupV365V500(type,state,links);
  if(state==='ready'&&Array.isArray(links)&&!monthHasAnyProfitCardsV501(links,type,monthInfoV365(type).month)){
    const prefix=type==='fair'?'fair':'live',profitEl=document.getElementById(prefix+'MonthlyProfitV365'),rateEl=document.getElementById(prefix+'MonthlyProfitRateV365');
    if(profitEl)profitEl.textContent='--';if(rateEl)rateEl.textContent='--';
  }
};
function paintSelectedDayNoProfitV501(type,date,sales){
  const el=selectedDaySummaryElV362(type);if(!el)return;
  el.className='sales-date-result selected-day-grand-v362';el.setAttribute('data-selected-date',String(date||''));
  el.innerHTML=`<strong>${selectedDayLabelV362(type)}</strong><div><span>营业额</span><b>${money(sales)}</b></div><div><span>利润</span><b>—</b></div><div><span>利润率</span><b>—</b></div>`;
}
renderSelectedDayGrandV362=async function(type){
  const date=selectedDayDateV362(type),token=++selectedDayGrandTokenV362[type],sales=selectedDayTurnoverV362(type,date),cached=profitLinksForDayCacheV496(type,date);
  if(Array.isArray(cached)){
    if(cached.length)paintSelectedDayGrandV362(type,date,sales,selectedDayProfitV362(type,date,cached),false,false);
    else paintSelectedDayNoProfitV501(type,date,sales);
  }else{
    // Never show a blocking “读取中…” for profit. Cache miss is silently repaired.
    paintSelectedDayNoProfitV501(type,date,sales);
    scheduleSilentProfitForceV501('selected-day-cache-miss-'+type,350);
  }
  scheduleSilentProfitRefreshV496('selected-day-'+type);
};
window.renderSelectedDayGrandV362=renderSelectedDayGrandV362;
renderSelectedDayTotalV360=function(type){return renderSelectedDayGrandV362(type)};
window.renderSelectedDayTotalV360=renderSelectedDayTotalV360;


/* ================= V50.8 Sales Card + Profit single-context authority =================
   A Sales Card context and its profit are published from the same authoritative links.
   No full-cache purge, no extra cloud read, and no delayed profit refresh is required.
   Draft product removal only creates a tombstone until Save Draft succeeds. */
function purgeDeletedSalesLinkV507(linkId){
  const target=String(linkId||'').trim();if(!target)return;
  const without=list=>(Array.isArray(list)?list:[]).filter(x=>String(x?.linkId||'').trim()!==target);
  try{
    const pending=readSalesDraftPendingV314();let changed=false;
    Object.keys(pending||{}).forEach(key=>{const entry=pending[key],before=Array.isArray(entry?.items)?entry.items:[],after=without(before);if(after.length===before.length)return;changed=true;if(after.length)pending[key]={...entry,items:after,token:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),savedAt:Date.now()};else delete pending[key]});
    if(changed)writeSalesDraftPendingV314(pending);
  }catch(_){}
  try{if(Array.isArray(monthGrandProfitLinksV295))monthGrandProfitLinksV295=without(monthGrandProfitLinksV295)}catch(_){}
  try{if(Array.isArray(yearBreakdownLinksV286))yearBreakdownLinksV286=without(yearBreakdownLinksV286)}catch(_){}
  try{if(Array.isArray(allSalesProductLinksCacheV216?.links))allSalesProductLinksCacheV216={...allSalesProductLinksCacheV216,links:without(allSalesProductLinksCacheV216.links),at:Date.now()}}catch(_){}
  // Remove the deleted row from exact local caches only. Never clear unrelated dates/locations.
  try{
    if(typeof readViewCacheMapV237==='function'&&typeof writeViewCacheMapV237==='function'&&typeof PROFIT_CACHE_KEY_V237!=='undefined'){
      const all=readViewCacheMapV237(PROFIT_CACHE_KEY_V237);let changed=false;
      Object.keys(all||{}).forEach(key=>{const rec=all[key];if(!rec||!Array.isArray(rec.links))return;const next=without(rec.links);if(next.length!==rec.links.length){all[key]={...rec,links:next,at:Date.now()};changed=true}});
      if(changed)writeViewCacheMapV237(PROFIT_CACHE_KEY_V237,all);
    }
  }catch(_){}
  try{
    if(typeof readSalesCardPersistentCacheV232==='function'&&typeof writeSalesCardPersistentCacheV232==='function'){
      const all=readSalesCardPersistentCacheV232();let changed=false;
      Object.keys(all||{}).forEach(key=>{const rec=all[key];if(!rec||!Array.isArray(rec.links))return;const next=without(rec.links);if(next.length!==rec.links.length){all[key]={...rec,links:next,at:Date.now()};changed=true}});
      if(changed)writeSalesCardPersistentCacheV232(all);
    }
  }catch(_){}
  try{if(typeof salesProductLinksCacheV216!=='undefined'&&salesProductLinksCacheV216?.forEach)salesProductLinksCacheV216.forEach((rec,key)=>{if(rec&&Array.isArray(rec.links)){const next=without(rec.links);if(next.length!==rec.links.length)salesProductLinksCacheV216.set(key,{...rec,links:next,at:Date.now()})}})}catch(_){}
  try{if(typeof selectedDayProfitLinksV368!=='undefined'&&selectedDayProfitLinksV368?.forEach)selectedDayProfitLinksV368.forEach((list,key)=>{const next=without(list);if(next.length!==list.length){selectedDayProfitLinksV368.set(key,next);selectedDayProfitReadyV368.set(key,Date.now())}})}catch(_){}
  try{if(monthGrandHistoryOpenV223&&typeof renderMonthGrandHistoryV223==='function')renderMonthGrandHistoryV223()}catch(_){}
  try{if(Object.values(yearBreakdownOpenV224||{}).some(Boolean)&&typeof renderAllYearBreakdownsV224==='function')renderAllYearBreakdownsV224()}catch(_){}
}
purgeDeletedSalesLinkV348=purgeDeletedSalesLinkV507;
window.purgeDeletedSalesLinkV348=purgeDeletedSalesLinkV507;

function replaceProfitAggregateContextV507(type,date,location,links){
  const t=String(type||''),d=String(date||''),loc=String(location||'').trim().toLowerCase();
  const fresh=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(Array.isArray(links)?links:[]):(Array.isArray(links)?links:[]);
  const sameCtx=x=>String(x?.type||'')===t&&String(x?.date||'')===d&&String(x?.location||'').trim().toLowerCase()===loc;
  const active=x=>!['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase());
  try{if(Array.isArray(allSalesProductLinksCacheV216?.links)){const kept=allSalesProductLinksCacheV216.links.filter(x=>!sameCtx(x)&&active(x));allSalesProductLinksCacheV216={links:[...kept,...fresh],at:Date.now()}}}catch(_){}
  try{if(Array.isArray(monthGrandProfitLinksV295)){const kept=monthGrandProfitLinksV295.filter(x=>!sameCtx(x)&&active(x));monthGrandProfitLinksV295=[...kept,...fresh]}if(Array.isArray(yearBreakdownLinksV286)){const kept=yearBreakdownLinksV286.filter(x=>!sameCtx(x)&&active(x));yearBreakdownLinksV286=[...kept,...fresh]}}catch(_){}
  try{if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(t,d,location,fresh)}catch(_){}
  const day=(()=>{try{return typeof getDailyProfitCacheV237==='function'?(getDailyProfitCacheV237(t,d)||[]):fresh}catch(_){return fresh}})();
  // Publish the whole selected day to the in-memory day authority immediately.
  try{if(typeof seedSelectedDayProfitV368==='function')seedSelectedDayProfitV368(t,d,day)}catch(_){}
  // Repaint visible profit from the same day payload. No loadAllSalesProductLinks request.
  try{
    const panel=typeof productProfitSummaryPanelV216==='function'?productProfitSummaryPanelV216(t):null;
    const visible=!!(panel&&!panel.classList.contains('hidden'));
    if(typeof productProfitSelectedDateV216==='function'&&(productProfitSummaryOpenV216?.[t]||visible)&&productProfitSelectedDateV216(t)===d&&typeof renderProductProfitSummaryV216==='function')renderProductProfitSummaryV216(t,day);
  }catch(_){}
  // Repaint the top selected-day profit locally instead of calling the old async full-table renderer.
  try{
    if(typeof selectedDayDateV362==='function'&&selectedDayDateV362(t)===d&&typeof paintSelectedDayGrandV362==='function'&&typeof selectedDayTurnoverV362==='function'&&typeof selectedDayProfitV362==='function'){
      const sales=selectedDayTurnoverV362(t,d),profit=selectedDayProfitV362(t,d,day);paintSelectedDayGrandV362(t,d,sales,profit,false,false);
    }
  }catch(_){}
  try{if(typeof homeTodayProfitOpenV318!=='undefined'&&homeTodayProfitOpenV318&&typeof homeTodayProfitDateV318==='function'&&homeTodayProfitDateV318()===d&&typeof renderHomeTodayProfitV318==='function')renderHomeTodayProfitV318(day,d)}catch(_){}
  try{if(monthGrandHistoryOpenV223&&typeof renderMonthGrandHistoryV223==='function')renderMonthGrandHistoryV223()}catch(_){}
  try{if(Object.values(yearBreakdownOpenV224||{}).some(Boolean)&&typeof renderAllYearBreakdownsV224==='function')renderAllYearBreakdownsV224()}catch(_){}
  try{if(t==='fair'&&typeof renderFairMonthlyList==='function')renderFairMonthlyList();if(t==='live'&&typeof renderLiveMonthlyList==='function')renderLiveMonthlyList()}catch(_){}
  return fresh;
}
replaceProfitAggregateContextV457=replaceProfitAggregateContextV507;
window.replaceProfitAggregateContextV457=replaceProfitAggregateContextV507;
