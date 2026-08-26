let fairSessionsCloudV281=[];
let fairSessionDraftDirtyV282=false;
function getSavedFairLocations(){try{const list=JSON.parse(localStorage.getItem("lover_fair_locations")||"[]");return Array.isArray(list)?list.map(x=>canonicalLocation(x)).filter(Boolean):[]}catch(e){return[]}}
function saveFairLocation(location){const loc=canonicalLocation(location);if(!loc)return;const list=getSavedFairLocations();if(!list.some(x=>normalizeFairLocationKey(x)===normalizeFairLocationKey(loc)))list.push(loc);list.sort((a,b)=>a.localeCompare(b));localStorage.setItem("lover_fair_locations",JSON.stringify(list));renderFairLocationOptions()}
function deleteFairLocationHistoryV309(location){const key=normalizeFairLocationKey(location);const list=getSavedFairLocations().filter(x=>normalizeFairLocationKey(x)!==key);localStorage.setItem("lover_fair_locations",JSON.stringify(list));renderFairLocationOptions()}
function collectFairLocations(){return getSavedFairLocations()}
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
async function refreshFairSessionsV281({applyLatest=false,forceApply=false}={}){try{const r=await loadFairSessionsFromSheetV281();fairSessionsCloudV281=Array.isArray(r?.sessions)?r.sessions:[];renderFairLocationOptions();if(applyLatest)applyFairSessionV281(latestFairSessionV281(),{force:forceApply});return fairSessionsCloudV281}catch(e){console.warn("Fair Session cloud sync failed",e);return fairSessionsCloudV281}}
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
function showPage(name,el){
  const current=document.querySelector(".page.active");
  const currentName=String(current?.id||"").replace(/^page-/,"");
  // V29.9: page "sales" uses the sales-card type "daily".
  // Without this mapping, Sales/Belimbing dirty cards were not seen by bottom navigation.
  const currentSalesCardType=currentName==="sales"?"daily":currentName;

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
function rowKey(r){const location=r.type==="live"?normalizeLiveHostKey(r.location||""):normalizeFairLocationKey(r.location||"");const company=r.type==="fair"?"fair":r.company;return [r.type,r.date,company,location].join("|")}
function dedupeRows(list){const m=new Map();list.forEach(r=>{const k=rowKey(r),old=m.get(k);if(!old||String(r.updatedAt||"")>=String(old.updatedAt||""))m.set(k,r)});return [...m.values()]}
function upsertLocalRow(n){rows=dedupeRows([...rows,n])}
function getDailyAmount(d,c){const f=rows.find(r=>r.type==="daily"&&r.date===d&&r.company===c);return f?Number(f.amount||0):0}
function updateDailyInputFromSelectedDate(){const d=isoToDisplay(document.getElementById("saleDate").value),c=document.getElementById("company").value,a=getDailyAmount(d,c);document.getElementById("dailySales").value=formatAmount(a);document.getElementById("salesDateResult").textContent=`${companyNames[c]}｜${d}｜${money(a)}`;renderSalesMonthlyList();if(typeof refreshSalesActionLocksV270==="function")refreshSalesActionLocksV270();if(c==="belimbing"&&typeof loadProductLinksIntoEditorV206==="function")Promise.resolve(loadProductLinksIntoEditorV206("daily")).catch(()=>{});}
function totalBy(type,company="",mode="month"){return rows.filter(r=>r.type===type).filter(r=>company?r.company===company:true).filter(r=>mode==="today"?r.date===isoToDisplay(todayISO()):mode==="month"?sameMonth(r.date):mode==="year"?sameYear(r.date):true).reduce((s,r)=>s+Number(r.amount||0),0)}

// V29.9: Top 5 business performance. Uses rows already loaded in memory only;
// opening/closing Top 5 never triggers an extra cloud request.
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
  const localRevision=typeof getLocalDataRevision==="function"?Number(getLocalDataRevision()||0):0;
  // V29.9: a changed/deleted turnover invalidates the old historical-high cache immediately.
  if(historicalHighsMemory){
    if(localRevision&&Number(historicalHighsMemory.dataRevision||0)===localRevision)return historicalHighsMemory;
    historicalHighsMemory=null;
  }
  try{
    const parsed=JSON.parse(localStorage.getItem(HISTORY_HIGH_CACHE_KEY)||"null");
    if(parsed&&parsed.ok&&parsed.highs&&localRevision&&Number(parsed.dataRevision||0)===localRevision){
      historicalHighsMemory=parsed;
      return parsed;
    }
  }catch(e){}
  return null;
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
  if(elId==="fairHomeTop3")return "fair";
  if(elId==="liveHomeTop3")return "live";
  return "";
}

function historyRecordHtml(record,kind,state="ready"){
  if(state==="loading"){
    return '<div class="history-record history-loading"><span>🏆 历史最高额</span><small>正在读取…</small></div>';
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
  if(state==="loading"&&!data){
    host.innerHTML=historyRecordHtml(null,kind,"loading");
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
  if(cached){
    renderAllVisibleHistoricalRecords();
    return cached;
  }
  if(historicalHighsPromise)return historicalHighsPromise;
  if(typeof jsonp!=="function")return null;

  ["balakongTop3","belimbingTop3","fairHomeTop3","liveHomeTop3"]
    .forEach(id=>renderHistoricalRecordForPanel(id,"loading"));

  historicalHighsPromise=jsonp(
    {action:"historicalHighs"},
    {timeoutMs:20000}
  ).then(data=>{
    if(data&&data.ok&&data.highs){
      saveHistoricalHighsCache(data);
      renderAllVisibleHistoricalRecords();
      return data;
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

function top3RowsForMonth(type,month,company=""){
  return dedupeRows(rows)
    .filter(r=>r.type===type)
    .filter(r=>company?r.company===company:true)
    .filter(r=>displayToISO(r.date).slice(0,7)===month)
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
    :'<div class="top3-empty">这个月份还没有营业额记录</div>';

  el.innerHTML=`<div id="${elId}History" class="history-record-host"></div>${rowsHtml}`;
  renderHistoricalRecordForPanel(elId);
}
function renderBusinessTop3(){
  const month=selectedMonth();
  renderTop3List("balakongTop3",top3RowsForMonth("daily",month,"balakong"),"daily");
  renderTop3List("belimbingTop3",top3RowsForMonth("daily",month,"belimbing"),"daily");
  renderTop3List("fairHomeTop3",top3RowsForMonth("fair",month),"fair");
  renderTop3List("liveHomeTop3",top3RowsForMonth("live",month),"live");
}
function renderFairPageTop3(){
  const month=monthFromDateControl("fairStart");
  renderTop3List("fairPageTop3",top3RowsForMonth("fair",month),"fair");
}
function renderLivePageTop3(){
  const month=getLiveSelectedMonth();
  renderTop3List("livePageTop3",top3RowsForMonth("live",month),"live");
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

    // V29.9: historical record is lazy. Top 5 opens instantly from local rows;
    // one shared history request runs only after the user explicitly expands Top 5.
    setTimeout(()=>{ ensureHistoricalHighs(); },0);
  }
}
function fairLocationsThisMonth(){return [...new Set(rows.filter(r=>r.type==="fair"&&sameMonth(r.date)&&Number(r.amount)>0).map(r=>canonicalLocation(r.location||"Fair")))].sort()}
function fairByLocation(){const g={};rows.filter(r=>r.type==="fair"&&sameMonth(r.date)&&Number(r.amount)>0).forEach(r=>{const l=canonicalLocation(r.location||"Fair");g[l]=(g[l]||0)+Number(r.amount||0)});return g}
function renderFairLocationList(){const g=fairByLocation(),locs=Object.keys(g).sort(),c=document.getElementById("fairLocationList");if(!locs.length){c.innerHTML='<div class="sub">这个月份还没有 Fair 记录</div>';return}const fairTotal=Object.values(g).reduce((sum,value)=>sum+Number(value||0),0);const rate=getFairCommissionRate(fairTotal)*100;c.innerHTML='<div class="fair-location-grid">'+locs.map(l=>`<div class="fair-location-card"><div class="fair-location-title">${l}</div><div class="fair-location-row"><span>营业额</span><b>${money(g[l])}</b></div><div class="fair-location-row"><span>佣金 ${Number(rate.toFixed(2))}%</span><b>${money(g[l]*rate/100)}</b></div></div>`).join("")+'</div>'}
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
    label.textContent=`Fair 本月总佣金 ${percent}%`;
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

  const localRow={
    type:"daily",
    date:d,
    company:c,
    location:"",
    amount:a,
    updatedAt:new Date().toISOString(),
    clientUpdatedAt:new Date().toISOString()
  };

  upsertLocalRow(localRow);
  addPendingRow(localRow);
  document.getElementById("dailySales").value=formatAmount(a);
  renderAll();
  showTempMsg("saveMsg");

  // V29.9: normal Save uses exactly one cloud write.
  // This prevents the immediate keepalive request from racing the normal save,
  // which could turn a real change such as RM9,999 -> RM0 into a later 0 -> 0
  // comparison and suppress the modification notification.
  // The pagehide/visibility keepalive fallback remains in sheet.js for pending
  // rows only when the page is actually being closed or backgrounded.
  if(typeof saveLocalDataCache==="function")saveLocalDataCache();
  setSync("已储存 · 云端后台同步中...");

  Promise.resolve().then(async()=>{
    try{
      const saved=await saveDailyToSheet(d,c,a,localRow.clientUpdatedAt);
      if(saved)upsertLocalRow(saved);
      clearPendingRow(localRow);
      renderAll();
      if(typeof saveLocalDataCache==="function")saveLocalDataCache();
      setSync("已同步",true);
    }catch(e){
      if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
      else setSync("同步暂未完成",false,true);
    }
  });
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

function syncFairInputs(){const start=document.getElementById("fairStart").value,end=document.getElementById("fairEnd").value,loc=canonicalLocation(document.getElementById("fairLocation").value.trim());if(!start||!end||new Date(start)>new Date(end)){document.getElementById("fairInputs").innerHTML="";return}let html="<h3>Fair 每日营业额</h3>";dateRange(start,end).forEach(d=>{const old=rows.find(r=>r.type==="fair"&&r.date===d&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));html+=`<label>${d} 营业额</label><input type="text" class="fairAmount money-input" data-date="${d}" value="${old?formatAmount(old.amount):"0.00"}" inputmode="decimal">`});document.getElementById("fairInputs").innerHTML=html;attachMoneyInputs();syncFairProductDatesV203()}
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
  const records=[...inputs].map(i=>({
    date:i.dataset.date,
    amount:toAmount(i.value),
    clientUpdatedAt:now
  }));

  records.forEach(i=>{
    const row={
      type:"fair",
      date:i.date,
      company:"fair",
      location:loc,
      amount:i.amount,
      updatedAt:now,
      clientUpdatedAt:now
    };

    if(Number(i.amount)<=0){
      rows=rows.filter(r=>!(
        r.type==="fair" &&
        r.date===i.date &&
        normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc)
      ));
    }else{
      upsertLocalRow(row);
    }

    addPendingRow(row);
    if(typeof markLocalRowMutation==="function")markLocalRowMutation(row);
  });

  renderAll();
  if(typeof saveLocalDataCache==="function")saveLocalDataCache();
  showTempMsg("fairSaveMsg");
  // V32.5: Fair Session is saved even when every daily amount is 0.00.
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
    const result=await saveFairBatchToSheet(loc,records);
    // V32.5: only a successfully saved Fair becomes a reusable history location.
    saveFairLocation(loc);

    // V29.9: local Fair values are direct replacements, never additions. The server
    // also removes duplicate Sheet rows whose location differs only by spaces/case.
    // The response confirms the authoritative overwrite and clears pending rows.
    records.forEach(i=>clearPendingRow({
      type:"fair",
      date:i.date,
      company:"fair",
      location:loc
    }));
    if(typeof saveLocalDataCache==="function")saveLocalDataCache();
    setSync("已同步",true);
  }catch(e){
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
    else setSync("同步暂未完成",false,true);
  }
}
function exportCSV(scope="month"){let csv="\uFEFF公司,日期,类别,地点,营业额\n";const selected=sortReportRows(dedupeRows(rows).filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0));selected.forEach(r=>{csv+=`"${r.type==="fair"?"Fair":(companyNames[r.company]||r.company)}",${r.date},"${r.type==="fair"?"Fair":"每日"}","${r.location||""}",${Number(r.amount).toFixed(2)}\n`});downloadFile(`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.csv`,csv,"text/csv;charset=utf-8;")}
const ACTIVE_MONTH_STORAGE_KEY="lover_sales_active_month_v82";
let systemState={currentMonth:monthISO(),closedMonths:[],commissionSnapshots:{},dataVersion:"2830"};
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
function applySystemState(state){if(state){systemState.currentMonth=state.currentMonth||monthISO();systemState.closedMonths=sanitizeClosedMonthsClientV197(state.closedMonths,systemState.currentMonth);systemState.commissionSnapshots=state.commissionSnapshots||{};systemState.dataVersion=state.dataVersion||"2830"}updateReadOnlyMode()}
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
  // V32.5: typing/blurring alone must not create history. A location is added
  // only after Fair is successfully saved to cloud.
  saveFairSession();
  syncFairInputs();
  setTimeout(()=>document.getElementById("fairLocationHistoryV309")?.classList.add("hidden"),180);
});

// V29.9: paint Home immediately, restore local cache, then perform only a
// lightweight Revision check. Full month data is downloaded only when the
// cloud Revision proves that another device changed data.
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

// V29.9: start cached Home immediately, then warm the current year's historical
// months in the background so Monthly Summary is complete on first open.
startInitialSalesDataLoad().finally(()=>{
  const startupYear=String(document.getElementById("yearPicker")?.value||selectedYear()||"");
  if(typeof loadYearInBackground==="function"&&/^\d{4}$/.test(startupYear)){
    loadYearInBackground(startupYear).catch(()=>{});
  }
});


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
  return [r.type,r.date,r.company,location].join("|");
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
function updateLiveInputFromSelectedDate(){
  const dateEl=document.getElementById("liveDate");
  const amountEl=document.getElementById("liveSales");
  const resultEl=document.getElementById("liveDateResult");
  if(!dateEl||!amountEl||!resultEl)return;
  const d=isoToDisplay(dateEl.value);
  const host=selectedLiveHost();
  const amount=host?getLiveAmount(d,host):0;
  amountEl.value=formatAmount(amount);
  resultEl.textContent=host?`${host}｜${d}｜${money(amount)}`:`请选择或输入主播｜${d}`;
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
  const id=type==="daily"?"saleDate":type==="fair"?"fairStart":"liveDate";
  const iso=String(document.getElementById(id)?.value||"");
  return isoToDisplay(iso);
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
  const cachedLogs=!pendingForDate&&typeof getSalesChangeLogCacheV237==="function"?getSalesChangeLogCacheV237(type,date):null;
  if(Array.isArray(cachedLogs))renderChangeLogTimelineV200(type,date,cachedLogs);
  else panel.innerHTML=`<div class="change-log-loading">正在读取 ${escapeChangeLogHtmlV200(date)} 最新记录...</div>`;
  if(button)button.classList.add("active");
  try{
    const data=await loadSalesChangeLogFromSheetV200(type,date,{force:true});
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
  if(titleEl)titleEl.textContent=`Sales ${monthLabel} 销售记录`;
  if(labelEl)labelEl.textContent=`Sales ${monthLabel} 总销售额`;

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
  if(titleEl)titleEl.textContent=`Fair ${monthLabel} 销售记录`;
  if(labelEl)labelEl.textContent=`Fair ${monthLabel} 总销售额`;

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
  if(titleEl)titleEl.textContent=`Live ${monthLabel} 销售记录`;
  if(totalLabelEl)totalLabelEl.textContent=`Live ${monthLabel} 总销售额`;
  if(commissionLabelEl)commissionLabelEl.textContent=`Live ${monthLabel} 总佣金`;

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

    if(!productName||category!=="盆栽"||!currency||!Number.isFinite(unitPrice)||unitPrice<=0)return;

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
      productId:String(source?.productId||product?.id||""),
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
    input.value=formatAmount(Math.max(0,Number(item.dataset.autoPotMossFeeV267||0)));
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
  if(card)syncSalesCardAutoExtraV267(card);
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
          record.productName,
          record.importNumber,
          record.currency,
          record.unitPrice,
          record.averageCost,
          record.shippingRate,
          record.inlandMiscPercent,
          record.minimumPrice
        ].join(" ");
        return unorderedImportProductMatchV214(searchable,keyword);
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
          `${record.productName} · 原购买单价 ${String(record.currency||"").toUpperCase()} ${formatOriginalUnitPriceV214(record.unitPrice)}`+
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
      if(wasMapped&&card){
        item.dataset.inventoryStatus="PENDING_IMPORT_LINK";
        card.dataset.inventoryStatus="PENDING_IMPORT_LINK";
        if(card._renderInventoryStatusV249)card._renderInventoryStatusV249();
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
    return{pre:"daily",date:isoToDisplay(document.getElementById("saleDate")?.value||""),location:"Belimbing"};
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
    if(type==="fair")syncFairProductDatesV203(true);
    Promise.resolve(loadProductLinksIntoEditorV206(type)).catch(()=>{});
  }
}
function liveDeliveryDefaultV203(price){
  const n=Number(price||0);
  if(n<=0)return 0;
  if(n<=300)return 30;
  if(n<500)return 50;
  if(n<2000)return 80;
  if(n<5000)return 120;
  return 150;
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
  const name=input("product-link-name",String(data.productName||""),"输入产品名称搜索，或直接手动输入");
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
const SALES_CARD_LOAD_SEQ_V245={live:0,fair:0};
function salesCardContextKeyV245(type,date,location){
  return [String(type||""),String(date||""),String(location||"").trim().toLowerCase()].join("|");
}
async function loadProductLinksIntoEditorV206(type){
  const {date,location}=productLinkContextV206(type);
  const seq=(SALES_CARD_LOAD_SEQ_V245[type]||0)+1;
  SALES_CARD_LOAD_SEQ_V245[type]=seq;

  if(!date||!location){
    if(!productImportSearchIsActiveV226(type))renderProductLinksEditorV206(type,[]);
    return;
  }

  const contextKey=salesCardContextKeyV245(type,date,location);

  // V29.9:
  // 1) Exact context cache exists -> paint immediately, even after reopening/browser restart.
  // 2) No cache on this device -> show loading and read Google Sheet; never assume blank.
  // 3) Cloud always verifies in background and only repaints if data changed.
  // 4) A request from an older date/host/location is never allowed to paint this editor.
  const cached=(typeof getCachedSalesProductLinksV216==="function")
    ? getCachedSalesProductLinksV216(type,date,location)
    : null;

  if(Array.isArray(cached)){
    // V32.5: keep the last-known saved cards visible while the exact cloud
    // context is being verified. Never replace a known draft with a fake blank
    // editor just because priority sync detected a newer card revision.
    if(!productImportSearchIsActiveV226(type))renderProductLinksEditorV206(type,cached);
    const pre=productLinkPreV208(type),msg=document.getElementById(pre+"ProductLinkMsg");
    if(msg){msg.classList.remove("hidden");msg.textContent="🔄 正在确认最新销售卡… 已保留上次资料";}
  }else{
    renderProductLinksLoadingV231(type);
  }

  try{
    const links=await loadSalesProductLinksV206(type,date,location,{force:true,maxAgeMs:0});
    const current=productLinkContextV206(type);
    const currentKey=salesCardContextKeyV245(type,current.date,current.location);

    if(
      SALES_CARD_LOAD_SEQ_V245[type]===seq &&
      currentKey===contextKey &&
      !productImportSearchIsActiveV226(type)
    ){
      const before=JSON.stringify(Array.isArray(cached)?cached:[]);
      const after=JSON.stringify(Array.isArray(links)?links:[]);
      if(!Array.isArray(cached)||before!==after){
        renderProductLinksEditorV206(type,links);
      }
      const pre=productLinkPreV208(type),msg=document.getElementById(pre+"ProductLinkMsg");
      if(msg&&msg.textContent.includes("正在确认最新销售卡")){msg.classList.add("hidden");msg.textContent="✅ 销售卡资料已保存";}
    }
  }catch(e){
    const current=productLinkContextV206(type);
    const currentKey=salesCardContextKeyV245(type,current.date,current.location);

    // If an exact cache was already shown, keep it on screen.
    // Only show an error when this device had no cache and cloud also failed.
    if(
      SALES_CARD_LOAD_SEQ_V245[type]===seq &&
      !Array.isArray(cached) &&
      currentKey===contextKey &&
      !productImportSearchIsActiveV226(type)
    ){
      const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
      if(wrap)wrap.innerHTML='<div class="product-link-loading-v231">销售卡读取失败，请再试一次。</div>';
      setSync("销售卡读取失败",false,true);
    }
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
}
function clearSalesCardTransactionDirtyV239(card){
  if(!card)return;
  card.dataset.dirty="0";
  card.querySelectorAll(".product-link-item").forEach(x=>x.dataset.dirty="0");
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
  if(String(card?.dataset?.type||"").toLowerCase()==="fair")return 0;
  const price=toAmount(item.querySelector(".product-link-price")?.value||0);
  return liveDeliveryDefaultV203(price);
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
  let totalPrice=0,totalCost=0,totalProfit=0,totalCommission=0;
  products.forEach((item,i)=>{
    const qty=Math.max(0,Number(item.querySelector(".product-link-qty")?.value||0));
    const avgCost=toAmount(item.querySelector(".product-link-avg-cost")?.value||0);
    const cost=avgCost*qty,price=alloc[i]?.price||0;
    const profit=price-(alloc[i]?.commission||0)-cost-(alloc[i]?.delivery||0)-(alloc[i]?.extra||0);
    const rate=price>0?profit/price*100:0;
    totalPrice+=price;totalCost+=cost;totalProfit+=profit;totalCommission+=(alloc[i]?.commission||0);
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
  set(".sales-card-cost-total-v239","RM"+formatAmount(totalCost));
  set(".sales-card-commission-amount-v239","RM"+formatAmount(totalCommission));
  set(".sales-card-profit-total-v239","RM"+formatAmount(totalProfit));
  set(".sales-card-profit-rate-v239",(Number.isFinite(rate)?rate:0).toFixed(2)+"%");
  const official=dedupeRows(rows).filter(r=>{
    const ctx=productLinkContextV206(card.dataset.type);
    if(r.type!==card.dataset.type||r.date!==ctx.date)return false;
    return card.dataset.type==="daily"?r.company==="belimbing":card.dataset.type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(ctx.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(ctx.location);
  }).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
  const warn=card.querySelector(".sales-card-total-warning-v239");
  if(warn){
    warn.hidden=!(official>0&&totalPrice>official+0.005);
    warn.textContent=warn.hidden?"":`这张销售卡售价合计 RM${formatAmount(totalPrice)} 已超过当天营业额 RM${formatAmount(official)}`;
  }
}


// V29.9 Live 木架等级
const LIVE_CRATE_V269=[["0","自取0"],["20","A20"],["50","B50"],["80","C80"],["120","D120"],["150","E150"]];
function createLiveCrateV269(){
 const s=document.createElement("select");
 s.className="live-crate-v269";
 LIVE_CRATE_V269.forEach(x=>{let o=document.createElement("option");o.value=x[0];o.textContent=x[1];s.appendChild(o)});
 s.value="80";
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
  const name=input("product-link-name",String(data.productName||""),"输入产品名称搜索，或直接手动输入");
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
  if(String(type).toLowerCase()==="live"){crate.innerHTML="木架等级 ";crate.appendChild(createLiveCrateV269());}
  const ship=document.createElement("span");ship.className="product-item-auto-delivery-v239";ship.textContent="运费 0.00";
  const profit=document.createElement("span");profit.innerHTML='利润 <b class="product-link-profit">0.00</b>';
  const rate=document.createElement("span");rate.innerHTML='利润率 <b class="product-link-profit-rate">0.00%</b>';
  if(String(type).toLowerCase()==="live") result.append(crate,ship,profit,rate); else result.append(ship,profit,rate);
  item.appendChild(result);

  const onEdit=()=>{markSalesCardDirtyV238(item);markSalesCardTransactionDirtyV239(card);recalcSalesCardTransactionV239(card)};
  [name,q,c,p].forEach(el=>el.addEventListener("input",onEdit));
  item.querySelector(".live-crate-v269")?.addEventListener("change",onEdit);
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
function addProductToTransactionV239(type,txnId,data={}){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  const card=[...(wrap?.querySelectorAll(".sales-card-transaction-v239")||[])].find(x=>x.dataset.transactionId===txnId);
  if(!card)return false;
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
  if(isSaved&&!confirm("确定从这张销售卡删除这个产品？\n\n删除会在点击「保存全部销售卡资料」后正式生效。")){
    item.dataset.deletingV253="0";
    return;
  }

  item.remove();
  renumberTransactionProductsV239(card);
  markSalesCardTransactionDirtyV239(card);
  card.dataset.productRemovedV259="1";
  recalcSalesCardTransactionV239(card);
}

async function deleteSalesCardTransactionV239(type,txnId){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  const card=[...(wrap?.querySelectorAll(".sales-card-transaction-v239")||[])].find(x=>x.dataset.transactionId===txnId);
  if(!card)return;
  const saved=salesCardProductsV239(card).filter(x=>x.dataset.saved==="1"&&String(x.dataset.linkId||""));
  if(saved.length&&!confirm(`确定删除这张销售卡？

系统会保留 saleId 的删除记录，让 Import Cost System 知道这张销售已经取消。`))return;
  try{
    if(saved.length)await deleteSalesTransactionV256(txnId);
    card.remove();
    if(!salesCardWrappersV239(type).length)addProductLinkItemV209(type);
    // V29.9: refresh profit view from active backend links after card deletion.
    try{
      const date=productProfitSelectedDateV216(type);
      const fresh=await loadAllSalesProductLinksV203({force:true});
      if(productProfitSummaryOpenV216[type])renderProductProfitSummaryV216(type,fresh);
      clearDailyProfitCacheV237(type,date);
    }catch(_){ }
    setSync("销售卡已删除，利润记录已同步移除",true);
  }catch(e){alert("删除销售卡失败："+(e.message||e))}
}
window.deleteSalesCardTransactionV239=deleteSalesCardTransactionV239;

/* ================= V32.5 confirmed-sale edit state =================
   A sale can be confirmed only once. After confirmation the whole card is locked
   against deletion, but its products may still be corrected and saved. Those
   corrections stay a CONFIRMED sale and, when inventory identity/quantity differs,
   become PENDING_IMPORT_LINK for Import to process as a +/- inventory difference. */
function salesCardStatusIsConfirmedV322(status){
  const s=String(status||'').trim();
  return s==='PENDING_IMPORT_LINK'||s==='INVENTORY_CONFIRMED';
}
function salesCardIsConfirmedV322(card){
  if(!card)return false;
  if(salesCardStatusIsConfirmedV322(card.dataset.inventoryStatus))return true;
  return [...card.querySelectorAll('.product-link-item')].some(i=>salesCardStatusIsConfirmedV322(i.dataset.inventoryStatus));
}
function updateSalesCardDeleteLockV322(card){
  if(!card)return;
  const btn=card.querySelector('.product-link-remove-bottom');
  if(!btn)return;
  const locked=salesCardIsConfirmedV322(card);
  btn.disabled=locked;
  btn.setAttribute('aria-disabled',locked?'true':'false');
  btn.classList.toggle('is-confirmed-locked-v322',locked);
  btn.textContent=locked?'删除销售卡（已确认，不能删除）':'删除销售卡';
}
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
    const byLink=new Map(recs.map(x=>[String(x.linkId||''),x]));
    let status='';
    card.querySelectorAll('.product-link-item').forEach(item=>{
      const rec=byLink.get(String(item.dataset.linkId||''));if(!rec)return;
      item.dataset.inventoryStatus=String(rec.importSyncStatus||'');
      status=status||item.dataset.inventoryStatus;
    });
    if(status)card.dataset.inventoryStatus=status;
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
  const total=document.createElement("b");total.className="sales-card-price-total-v239";total.textContent="RM0.00";
  header.append(title,total);card.appendChild(header);

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
  if(String(card?.dataset?.type||"").toLowerCase()==="fair")return 0;
  return getLiveCrateV269(item);
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
  let totalPrice=0,totalCost=0,totalProfit=0,totalCommission=0;
  products.forEach((item,i)=>{
    const qty=salesCardQtyV240(item),avgCost=toAmount(item.querySelector(".product-link-avg-cost")?.value||0);
    const cost=avgCost*qty,price=alloc[i]?.price||0;
    const profit=price-(alloc[i]?.commission||0)-cost-(alloc[i]?.delivery||0)-(alloc[i]?.extra||0);
    const rate=price>0?profit/price*100:0;
    totalPrice+=price;totalCost+=cost;totalProfit+=profit;totalCommission+=(alloc[i]?.commission||0);
    item.dataset.allocatedDelivery=String(alloc[i]?.delivery||0);
    item.dataset.allocatedExtra=String(alloc[i]?.extra||0);
    const profitEl=item.querySelector(".product-link-profit");
    const rateEl=item.querySelector(".product-link-profit-rate");
    if(profitEl)profitEl.textContent=formatAmount(profit);
    if(rateEl)rateEl.textContent=(Number.isFinite(rate)?rate:0).toFixed(2)+"%";
  });

  const set=(sel,val)=>{const el=card.querySelector(sel);if(el)el.textContent=val};
  const overallRate=totalPrice>0?totalProfit/totalPrice*100:0;
  set(".sales-card-price-total-v239","RM"+formatAmount(totalPrice));
  set(".sales-card-price-summary-v240","RM"+formatAmount(totalPrice));
  set(".sales-card-cost-total-v239","RM"+formatAmount(totalCost));
  set(".sales-card-commission-amount-v239","RM"+formatAmount(totalCommission));
  set(".sales-card-profit-total-v239","RM"+formatAmount(totalProfit));
  set(".sales-card-profit-rate-v239",(Number.isFinite(overallRate)?overallRate:0).toFixed(2)+"%");

  const ctx=productLinkContextV206(card.dataset.type);
  const official=dedupeRows(rows).filter(r=>{
    if(r.type!==card.dataset.type||r.date!==ctx.date)return false;
    return card.dataset.type==="daily"?r.company==="belimbing":card.dataset.type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(ctx.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(ctx.location);
  }).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
  const warn=card.querySelector(".sales-card-total-warning-v239");
  if(warn){
    warn.hidden=!(official>0&&totalPrice>official+0.005);
    warn.textContent=warn.hidden?"":`这张销售卡售价总数 RM${formatAmount(totalPrice)} 已超过当天营业额 RM${formatAmount(official)}`;
  }
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

  const head=document.createElement("div");head.className="product-subitem-head-v239";
  const title=document.createElement("b");title.className="product-subitem-title-v239";title.textContent=`产品 ${order}`;
  const remove=document.createElement("button");remove.type="button";remove.className="product-subitem-remove-v239";remove.textContent="删除产品";
  head.append(title,remove);item.appendChild(head);

  const label=(text)=>{const el=document.createElement("label");el.textContent=text;return el};
  const input=(cls,value,placeholder)=>{const el=document.createElement("input");el.className=cls;el.value=value??"";if(placeholder)el.placeholder=placeholder;return el};

  item.appendChild(label("搜索或输入产品"));
  const name=input("product-link-name",String(data.productName||""),"输入产品名称搜索，或直接手动输入");
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
  let shipInput;
  if(type==="live"){
    const crate=document.createElement("label");crate.className="product-result-cell-v252";
    const crateTitle=document.createElement("small");crateTitle.textContent="木架等级";crate.appendChild(crateTitle);
    const crateSelect=document.createElement("select");crateSelect.className="product-link-crate-v270";
    const opts=[[0,"自取0"],[20,"A20"],[50,"B50"],[80,"C80"],[120,"D120"],[150,"E150"]];
    const initialCrate=saved?(opts.some(x=>x[0]===storedDelivery)?storedDelivery:80):80;
    opts.forEach(([v,t])=>{const o=document.createElement("option");o.value=String(v);o.textContent=t;crateSelect.appendChild(o)});
    crateSelect.value=String(initialCrate);crate.appendChild(crateSelect);result.appendChild(crate);

    const ship=document.createElement("label");ship.className="product-result-cell-v252 product-delivery-inline-v240";
    const shipTitle=document.createElement("small");shipTitle.textContent="运费";ship.appendChild(shipTitle);
    shipInput=input("product-link-delivery-v240",formatAmount(saved?storedDelivery:initialCrate));
    shipInput.inputMode="decimal";shipInput.dataset.manual="1";ship.appendChild(shipInput);result.appendChild(ship);

    crateSelect.addEventListener("change",()=>{
      shipInput.value=formatAmount(Number(crateSelect.value||0));
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

  const onCoreEdit=()=>{markSalesCardDirtyV238(item);markSalesCardTransactionDirtyV239(card);recalcSalesCardTransactionV239(card)};
  [name,q,c,p].forEach(el=>el.addEventListener("input",onCoreEdit));
  [name,q].forEach(el=>el.addEventListener("input",()=>{
    // V32.5: editing is not confirmation. Keep a saved draft as DRAFT until
    // “确认销售” succeeds; the server is authoritative for the final status.
    if(String(card.dataset.inventoryStatus||"").startsWith("DRAFT")){
      card.dataset.inventoryStatus="DRAFT_INVENTORY_CHANGED";
      item.dataset.inventoryStatus="DRAFT_INVENTORY_CHANGED";
    }
    if(card._renderSalesStateV317)card._renderSalesStateV317();
  }));
  [c,p].forEach(el=>el.addEventListener("blur",()=>{el.value=formatAmount(toAmount(el.value||0));recalcSalesCardTransactionV239(card)}));
  p.addEventListener("input",()=>updateProductLinkMinimumWarningV214(item));
  shipInput.addEventListener("input",()=>{shipInput.dataset.manual="1";markSalesCardDirtyV238(item);markSalesCardTransactionDirtyV239(card);syncCardDeliveryTotalFromProductsV240(card);recalcSalesCardTransactionV239(card)});
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
  card.dataset.inventoryStatus=hasDraftV317?"DRAFT":hasPendingV317?"PENDING_IMPORT_LINK":hasConfirmedV317?"INVENTORY_CONFIRMED":"";

  const header=document.createElement("div");header.className="sales-card-header-v239";
  const title=document.createElement("b");title.textContent=list.some(x=>x.linkId)?"已保存销售卡":"新销售卡";
  const total=document.createElement("b");total.className="sales-card-price-total-v239";total.textContent="RM0.00";
  header.append(title,total);card.appendChild(header);

  // V32.5: make the sales-card state explicit on Sales / Fair / Live.
  // Draft is local/saved but NOT a confirmed sale and must never reach Import.
  const stateBoxV317=document.createElement("div");
  stateBoxV317.className="sales-card-state-v317";
  stateBoxV317.hidden=true;
  const renderStateV317=()=>{
    const savedItems=[...card.querySelectorAll(".product-link-item")].filter(i=>i.dataset.saved==="1"&&String(i.dataset.linkId||""));
    if(!savedItems.length){stateBoxV317.hidden=true;stateBoxV317.textContent="";return;}
    const sts=savedItems.map(i=>String(i.dataset.inventoryStatus||card.dataset.inventoryStatus||"").trim()).filter(Boolean);
    const draft=sts.some(st=>st==="DRAFT"||st==="DRAFT_INVENTORY_CHANGED")||String(card.dataset.inventoryStatus||"").startsWith("DRAFT");
    const pending=!draft&&(sts.some(st=>st==="PENDING_IMPORT_LINK")||String(card.dataset.inventoryStatus||"")==="PENDING_IMPORT_LINK");
    const done=!draft&&!pending&&sts.length>0&&sts.every(st=>st==="INVENTORY_CONFIRMED");
    stateBoxV317.hidden=false;
    stateBoxV317.className="sales-card-state-v317 "+(draft?"is-draft":pending?"is-pending":done?"is-done":"is-draft");
    stateBoxV317.textContent=draft?"🟡 草稿已保存 · 尚未确认销售":pending?"🟢 已确认销售 · 等待 Import 处理库存":done?"✅ 已确认销售 · Import 已处理库存":"🟡 草稿已保存 · 尚未确认销售";
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
        commissionRate,commissionAmount,localDelivery,extraFee,profit,profitRate,remark:shared.remark
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
    clearPendingRow(localRow);renderAll();
    const lock2=getLiveOptimisticLockV240(d,host);if(lock2)amountEl.value=formatAmount(lock2.amount);
    clearLiveOptimisticLockV240(d,host);setSync("已同步",true);
  }catch(e){
    const lock=getLiveOptimisticLockV240(d,host);if(lock)amountEl.value=formatAmount(lock.amount);
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();else setSync("同步暂未完成",false,true);
  }
}


/* ================= V32.5 Home on-demand today total profit =================
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
    if(type==="daily"&&String(x.location||"").trim()&&String(x.location||"").trim().toLowerCase()!=="belimbing")return false;
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
function productProfitGroupKeyV216(type,value){return type==="daily"?"belimbing":type==="live"?normalizeLiveHostKey(value):normalizeFairLocationKey(value)}
function productProfitSalesByGroupV216(type,date){
  const map=new Map();
  dedupeRows(rows).forEach(r=>{
    if(r.type!==type||r.date!==date)return;
    if(type==="daily"&&r.company!=="belimbing")return;
    const name=type==="daily"?"Belimbing":String(r.location||"").trim();if(!name)return;
    const key=productProfitGroupKeyV216(type,name);
    const rec=map.get(key)||{name,sales:0};
    rec.sales=Math.max(rec.sales,Number(r.amount||0));map.set(key,rec);
  });
  return map;
}
function productProfitGroupLinksV216(type,date,links){
  const groups=new Map();
  (links||[]).filter(x=>String(x.type||"")===type&&String(x.date||"")===date&&String(x.productName||"").trim()).forEach(x=>{
    const name=type==="daily"?"Belimbing":String(x.location||"").trim()||"未指定",key=productProfitGroupKeyV216(type,name)||name;
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
  panel.innerHTML=`<div class="product-profit-summary-head"><div><b>${date} · ${type==="daily"?"Belimbing 门市":type==="live"?"全部主播":"全部地点"}</b></div><button type="button" class="secondary-btn product-profit-export-btn" onclick="exportProductProfitExcelV216('${type}')">📈 导出 Excel</button></div>${sections||`<div class="product-profit-empty">当天还没有关联盆栽资料</div>`}<div class="product-profit-day-summary"><div class="product-profit-total profit-highlight"><span>当天总利润</span><b>RM${formatAmount(dayProfit)}</b></div><div class="product-profit-total profit-highlight"><span>当天整体利润率</span><b>${dayRate.toFixed(2)}%</b></div></div>`;
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
    if(Array.isArray(cachedLinks)){
      renderProductProfitSummaryV216(type,cachedLinks);
      panel.classList.remove("hidden");
      productProfitSummaryOpenV216[type]=true;
      if(button)button.textContent="📊 收起利润";
    }else{
      if(button){button.disabled=true;button.textContent="读取中..."}
    }

    const allLinks=await loadAllSalesProductLinksV203({force:true,maxAgeMs:0});
    const fresh=(allLinks||[]).filter(x=>String(x.type||"")===type&&String(x.date||"")===date);
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
    if(!Array.isArray(cachedLinks))alert("读取当天利润失败："+(e.message||e));
    else console.warn("当天利润后台核对失败",e);
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
      table.push(["产品名","数量","单棵成本","单棵售价","总数","利润","利润率","备注"]);
      group.links.forEach(x=>{
        const qty=Math.max(1,Number(x.quantity||1));
        const total=Number(x.actualPrice||0);
        const unit=(x.unitPrice!==undefined&&x.unitPrice!==null&&x.unitPrice!=="")?Number(x.unitPrice||0):(qty?total/qty:total);
        table.push([
          String(x.productName||""),qty,Number(x.averageCost||0),unit,total,
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
    clearPendingRow(localRow);
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

function monthGrandProfitV295(month){
  return (monthGrandProfitLinksV295||[]).reduce((sum,x)=>{
    if(["deleted","cancelled"].includes(String(x.status||"active").toLowerCase()))return sum;
    const date=String(x.date||"");
    const iso=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:displayToISO(date);
    if(!iso||iso.slice(0,7)!==month)return sum;
    const type=String(x.type||"").toLowerCase();
    // Profit source exists for Belimbing Sales Cards, Fair and Live.
    if(!["daily","fair","live"].includes(type))return sum;
    const profit=Number(x.profit);
    return sum+(Number.isFinite(profit)?profit:0);
  },0);
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
      profit:monthGrandProfitV295(String(item.month||""))
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
  const grandRate=grandSales>0?grandProfit/grandSales*100:0;
  panel.classList.remove("hidden");
  if(arrow)arrow.textContent="▲";

  if(monthGrandHistoryLoadingV223&&!list.length){
    panel.innerHTML='<div class="sub">正在读取月份营业额和利润...</div>';
    return;
  }

  panel.innerHTML=list.length
    ?`<div class="month-grand-profit-table-v295"><div class="month-grand-profit-head-v295"><span>日期</span><span>营业额</span><span>利润</span><span>利润率</span></div>${list.map(x=>{const rate=Number(x.amount||0)>0?Number(x.profit||0)/Number(x.amount||0)*100:0;return `<div class="month-grand-profit-row-v295"><span>${x.label}</span><b>${money(x.amount)}</b><b>${money(x.profit)}</b><b>${rate.toFixed(2)}%</b></div>`}).join("")}<div class="month-grand-profit-row-v295 month-grand-profit-total-v295"><span>总数</span><b>${money(grandSales)}</b><b>${money(grandProfit)}</b><b>${grandRate.toFixed(2)}%</b></div></div>`
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
    if(kind==="balakong")return sum; // Sales Cards are Belimbing; Balakong has no sales-card profit source.
    if(kind==="belimbing"&&type!=="daily")return sum;
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
    return [...byYear.entries()].map(([year,amount])=>({month:year,year,amount:Number(amount||0),profit:yearBreakdownProfitV286("total",year)}))
      .filter(item=>Math.abs(item.amount)>0.000001).sort((a,b)=>String(a.year).localeCompare(String(b.year)));
  }
  const year=String(document.getElementById("yearPicker")?.value||selectedYear()||"");
  return buildMonthlySummary().filter(item=>!year||String(item.month||"").slice(0,4)===year)
    .map(item=>({month:item.month,amount:Number(item[kind]||0),profit:yearBreakdownProfitV286(kind,String(item.month||""))}))
    .filter(item=>Math.abs(item.amount)>0.000001).sort((a,b)=>String(a.month).localeCompare(String(b.month)));
}
function yearBreakdownTableV286(list,kind){
  const grandSales=list.reduce((s,x)=>s+Number(x.amount||0),0),grandProfit=list.reduce((s,x)=>s+Number(x.profit||0),0),grandRate=grandSales>0?grandProfit/grandSales*100:0;
  const rowsHtml=list.map(x=>{const sales=Number(x.amount||0),profit=Number(x.profit||0),rate=sales>0?profit/sales*100:0;const label=kind==="total"?String(x.year||x.month):String(x.month).slice(5,7)+"-"+String(x.month).slice(0,4);return `<div class="year-profit-row-v286"><span>${label}</span><b>${money(sales)}</b><b>${money(profit)}</b><b>${rate.toFixed(2)}%</b></div>`}).join("");
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
  document.getElementById("liveCommissionLabel").textContent="Live 本月总佣金";
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

restoreLastLiveSession();

["commissionRate1","commissionRate2","commissionRate3"].forEach(id=>{
  const el=document.getElementById(id);
  if(el)el.addEventListener("input",markFairCommissionDraftDirty);
});
window.addEventListener("beforeunload",event=>{
  const unsavedCards=hasUnsavedSalesCardChangesV238("daily")||hasUnsavedSalesCardChangesV238("live")||hasUnsavedSalesCardChangesV238("fair");
  if(!(fairCommissionDraftDirty||liveCommissionDraftDirty||backupRestoreOperationRunningV234||unsavedCards))return;
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
function renderBackupRestoreStatusV234(state=getBackupRestoreStateV234()){
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
    version:"2830",
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
  if(backupRestoreOperationRunningV234){alert("Backup / Restore 正在进行中，请等待完成。");return}
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
    payload.fairSessions=await refreshFairSessionsV281({applyLatest:false});
    payload.backupIncludes={sales:true,fair:true,live:true,commission:true,closedMonths:true,commissionSnapshots:true,productLinks:true,salesChangeLogs:true,fairSessions:true,profitData:true,remarks:true,averageCost:true,minimumPrice:true,deliveryAndExtraFees:true};
    setBackupRestoreStateV234({type:"backup",status:"running",message:"正在生成 Backup 文件..."});
    const stamp=new Date().toISOString().replace(/[:T]/g,"-").slice(0,19);
    downloadFile(`Lover_Legend_Sales_V28_2_Backup_${stamp}.json`,JSON.stringify(payload,null,2),"application/json;charset=utf-8");
    setBackupRestoreStateV234({type:"backup",status:"success",message:`Backup 完成：营业记录 ${payload.rows.length} 笔，销售卡 ${payload.productLinks.length} 笔，新增/修改历史 ${payload.salesChangeLogs.length} 笔。`});
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
  if(backupRestoreOperationRunningV234){alert("Backup / Restore 正在进行中，请等待完成。");return}
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
  return dedupeRows(rows).filter(r=>r.type===type&&r.date===ctx.date&&(type==="daily"?r.company==="belimbing":type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(ctx.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(ctx.location))).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
}
function salesCardsEnteredTotalV241(type){return salesCardWrappersV239(type).reduce((s,c)=>s+salesCardProductsV239(c).reduce((a,i)=>a+salesCardProductTotalV240(i),0),0);}
function addProductLinkItemV209(type,data={}){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+'ProductItems');if(!wrap)return false;
  const cards=salesCardWrappersV239(type),unsaved=cards.find(c=>!salesCardIsSavedV241(c));
  if(unsaved){alert('请先保存目前这张销售卡，才可以新增第二张销售卡。');unsaved.scrollIntoView({behavior:'smooth',block:'center'});return false;}
  const official=salesCardsOfficialAmountV241(type),used=salesCardsEnteredTotalV241(type);
  if(official>0&&used>=official-0.005){alert(`当天营业额 RM${formatAmount(official)} 已全部分配到销售卡，不能再新增销售卡。`);return false;}
  wrap.appendChild(buildSalesCardTransactionV239(type,[data||{}]));return true;
}
function addProductLinkItemV206(type,data={}){return addProductLinkItemV209(type,data)}
window.addProductLinkItemV206=addProductLinkItemV206;window.addProductLinkItemV209=addProductLinkItemV209;

const _deleteSalesCardTransactionV240=deleteSalesCardTransactionV239;
deleteSalesCardTransactionV239=async function(type,txnId){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+'ProductItems');
  const card=[...(wrap?.querySelectorAll('.sales-card-transaction-v239')||[])].find(x=>x.dataset.transactionId===txnId);if(!card)return;
  if(!salesCardIsSavedV241(card)){
    if(salesCardHasUserDataV241(card)&&!confirm('这张销售卡尚未保存，确定删除？\n\n确认后，刚才输入的资料不会保存。'))return;
    card.remove();setSync('未保存销售卡已删除',true);return;
  }
  return _deleteSalesCardTransactionV240(type,txnId);
};
window.deleteSalesCardTransactionV239=deleteSalesCardTransactionV239;

function renumberSavedSalesCardsV241(type){
  let n=0;salesCardWrappersV239(type).forEach(card=>{const title=card.querySelector('.sales-card-header-v239 b:first-child');if(!title)return;if(salesCardIsSavedV241(card)){n++;title.textContent='已保存销售卡 '+n}else title.textContent='新销售卡';});
}
const _renderProductLinksEditorV240=renderProductLinksEditorV206;
renderProductLinksEditorV206=function(type,links){_renderProductLinksEditorV240(type,links);renumberSavedSalesCardsV241(type)};

const _buildSalesCardTransactionV240=buildSalesCardTransactionV239;
buildSalesCardTransactionV239=function(type,dataList=[]){const card=_buildSalesCardTransactionV240(type,dataList);setTimeout(()=>renumberSavedSalesCardsV241(type),0);return card};

const _saveProductLinksV240=saveProductLinksV206;

/* ================= V32.5 instant draft save + durable cloud retry =================
   Draft edits must never hold the user on “保存中…”.  The latest draft is written
   to persistent local cache first, the UI is released immediately, and the cloud
   write runs in the background.  Confirmation still waits for cloud so Import/FIFO
   never sees an older draft. */
// V32.5: Draft profit is real dashboard profit immediately after Save Draft.
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

const SALES_DRAFT_PENDING_KEY_V314='lover_sales_draft_pending_v314';
const SALES_DRAFT_INFLIGHT_V314=new Map();
let SALES_DRAFT_RETRY_TIMER_V314=null;
function readSalesDraftPendingV314(){try{const x=JSON.parse(localStorage.getItem(SALES_DRAFT_PENDING_KEY_V314)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return{}}}
function writeSalesDraftPendingV314(obj){try{localStorage.setItem(SALES_DRAFT_PENDING_KEY_V314,JSON.stringify(obj||{}));return true}catch(_){return false}}
function salesDraftPendingKeyV314(type,date,location){return [String(type||''),String(date||''),String(location||'').trim().toLowerCase()].join('|')}
function queueSalesDraftV314(type,date,location,items){
  const all=readSalesDraftPendingV314(),key=salesDraftPendingKeyV314(type,date,location),token=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  all[key]={type,date,location,items:Array.isArray(items)?items:[],token,savedAt:Date.now()};
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
    const wasConfirmed=salesCardIsConfirmedV322(card)||prev.some(r=>salesCardStatusIsConfirmedV322(r.importSyncStatus));
    let status='DRAFT';
    if(wasConfirmed){
      // Do not ever downgrade a confirmed sale to Draft while the cloud write runs.
      // Keep its last confirmed/pending state until the server returns the exact
      // inventory-difference status for this edit.
      status=prev.some(r=>String(r.importSyncStatus||'')==='PENDING_IMPORT_LINK')||String(card?.dataset.inventoryStatus||'')==='PENDING_IMPORT_LINK'?'PENDING_IMPORT_LINK':'INVENTORY_CONFIRMED';
    }
    return {...x,importSyncStatus:status};
  });
  const merged=[...old.filter(x=>!dirtyIds.has(String(x.transactionId||''))),...local];
  if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,ctx.date,ctx.location,merged);
  if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(type,ctx.date,ctx.location,merged);
  if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(type,ctx.date,ctx.location,merged);
  refreshProfitAggregateCachesV321(local,[...dirtyIds]);
  const statusByTxn=new Map();local.forEach(x=>{const tx=String(x.transactionId||'');if(tx&&!statusByTxn.has(tx))statusByTxn.set(tx,String(x.importSyncStatus||''))});
  dirty.forEach(card=>{
    clearSalesCardTransactionDirtyV239(card);delete card.dataset.productRemovedV259;
    const tx=String(card.dataset.transactionId||''),st=statusByTxn.get(tx)||'DRAFT';card.dataset.inventoryStatus=st;
    card.querySelectorAll('.product-link-item').forEach(i=>{i.dataset.saved='1';i.dataset.dirty='0';i.dataset.inventoryStatus=st;});
    const tag=card.querySelector('.sales-card-header-v239 b:first-child');if(tag)tag.textContent='已保存销售卡';
    if(card._renderSalesStateV317)card._renderSalesStateV317();updateSalesCardDeleteLockV322(card);
  });
  renumberSavedSalesCardsV241(type);refreshConfirmSaleButtonV322(type);
  return merged;
}
async function syncQueuedSalesDraftV314(key,expectedToken=''){
  if(SALES_DRAFT_INFLIGHT_V314.has(key))return SALES_DRAFT_INFLIGHT_V314.get(key);
  const all=readSalesDraftPendingV314(),entry=all[key];
  if(!entry)return {ok:true,skipped:true};
  if(expectedToken&&String(entry.token||'')!==String(expectedToken))return {ok:true,stale:true};
  const p=(async()=>{
    try{
      const result=await window.saveSalesProductLinksApiV241(entry.items,'draft');
      const latest=readSalesDraftPendingV314()[key];
      if(latest&&String(latest.token||'')===String(entry.token||'')){
        removeSalesDraftPendingV314(key,entry.token);
        const saved=Array.isArray(result?.links)&&result.links.length?result.links:entry.items;
        if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(entry.type,entry.date,entry.location,saved);
        if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(entry.type,entry.date,entry.location,saved);
        if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(entry.type,entry.date,entry.location,saved);
        refreshProfitAggregateCachesV321(saved,[...new Set(entry.items.map(x=>String(x.transactionId||'')).filter(Boolean))]);
        applyCloudDraftStatusesV322(entry.type,saved);
        if(typeof refreshInventoryPendingV250==='function')setTimeout(()=>refreshInventoryPendingV250(true),0);
        setSync('草稿已保存 · 云端已同步',true);
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
  if(current){const result=await window.saveSalesProductLinksApiV241(current.items,'draft');removeSalesDraftPendingV314(key,current.token);return result}
  return null;
}
window.addEventListener('online',()=>scheduleSalesDraftRetryV314(100));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSalesDraftRetryV314(250)});
setTimeout(()=>scheduleSalesDraftRetryV314(1200),0);


/* ================= V32.5 Sales stock oversell guard =================
   Before Save Draft / Confirm, re-read Import current stock.  New/unprocessed
   cards must fit the full requested quantity.  A card already confirmed AND
   fully inventory-confirmed only needs enough stock for its positive net
   increase; unchanged/reduced quantities are never blocked. */
async function validateSalesInventoryAvailabilityV325(type,items,saveMode='draft'){
  const list=Array.isArray(items)?items:[];
  const mapped=list.filter(x=>String(x?.productId||'').trim());
  if(!mapped.length)return true;
  let records=[];
  try{
    records=await Promise.race([
      loadImportProductsV214(true),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('库存云端核对超时')),7000))
    ]);
  }catch(err){
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

saveProductLinksV206=async function(type,saveMode='confirm',button=null){
  saveMode=saveMode==='draft'?'draft':'confirm';
  if(button?.dataset?.busyV285==='1')return null;
  const originalButtonText=button?.textContent||'';
  if(button){button.dataset.busyV285='1';button.disabled=true;button.textContent=saveMode==='draft'?'保存中…':'确认中…';}
  const releaseButton=()=>{if(button){button.disabled=false;button.dataset.busyV285='0';button.textContent=originalButtonText;}};
  const cards=salesCardWrappersV239(type),dirty=cards.filter(c=>{
    const needsSave=c.dataset.dirty==='1'||c.dataset.productRemovedV259==='1'||!salesCardIsSavedV241(c)||(saveMode==='confirm'&&String(c.dataset.inventoryStatus||'').startsWith('DRAFT'));
    if(!needsSave)return false;
    // V32.5: a confirmed sale can never be confirmed a second time. Any later
    // correction must use 保存草稿 so the server can create only the inventory diff.
    if(saveMode==='confirm'&&salesCardIsConfirmedV322(c))return false;
    return true;
  });
  if(!dirty.length){alert(saveMode==='confirm'?'这张销售卡已经确认销售。后续修改请使用「保存草稿」。':'销售卡没有需要保存的修改。');releaseButton();refreshConfirmSaleButtonV322(type);return null;}
  const all=collectProductLinksV206(type),dirtyIds=new Set(dirty.map(c=>String(c.dataset.transactionId||''))),items=all.filter(x=>dirtyIds.has(String(x.transactionId||'')));
  if(!items.length){alert('请填写销售卡产品资料。');releaseButton();return null;}
  if(!(await validateSalesInventoryAvailabilityV325(type,items,saveMode))){releaseButton();return null;}
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
      // V32.5: local durable save is the user-facing completion point.
      const queued=queueSalesDraftV314(type,ctx.date,ctx.location,items);
      markDraftSavedLocallyV314(type,ctx,dirty,items,dirtyIds);
      setSync('草稿已安全保存 · 可以离开',true);
      releaseButton();
      alert('销售卡草稿已保存。\n\n可以继续操作或离开；云端会在后台同步。');
      // Fire-and-forget: never hold “保存中…” on a repeat draft save.
      setTimeout(()=>syncQueuedSalesDraftV314(queued.key,queued.token).catch(()=>{}),0);
      return {ok:true,local:true,pendingCloud:true,links:items};
    }catch(e){
      releaseButton();setSync('本机草稿保存失败',false,true);alert('草稿未能安全保存：'+(e.message||e));return null;
    }
  }

  try{
    // V32.5: “直接确认” and “先保存草稿再确认” are intentionally the same
    // transaction path. If a draft exists, flush it first; if it does not, the
    // confirm API atomically saves the current card and confirms that SAME
    // transaction/link set. There is never a second sale/card created here.
    await flushSalesDraftBeforeConfirmV314(type,ctx.date,ctx.location);
    setSync('销售确认同步中...');
    const result=await window.saveSalesProductLinksApiV241(items,'confirm');
    const saved=Array.isArray(result?.links)&&result.links.length?result.links:items;
    const old=(typeof getSalesCardPersistentCacheV232==='function'?getSalesCardPersistentCacheV232(type,ctx.date,ctx.location):[])||[];
    const final=[...old.filter(x=>!dirtyIds.has(String(x.transactionId||''))),...saved];
    if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(type,ctx.date,ctx.location,final);
    if(typeof setSalesCardPersistentCacheV232==='function')setSalesCardPersistentCacheV232(type,ctx.date,ctx.location,final);
    if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(type,ctx.date,ctx.location,final);
    refreshProfitAggregateCachesV321(saved,[...dirtyIds]);
    const savedByLink=new Map(saved.map(x=>[String(x.linkId||''),x]));
    dirty.forEach(card=>{clearSalesCardTransactionDirtyV239(card);delete card.dataset.productRemovedV259;let cardStatus='';card.querySelectorAll('.product-link-item').forEach(i=>{i.dataset.saved='1';i.dataset.dirty='0';const rec=savedByLink.get(String(i.dataset.linkId||''));if(rec){i.dataset.inventoryStatus=String(rec.importSyncStatus||'');cardStatus=cardStatus||i.dataset.inventoryStatus;}});if(cardStatus)card.dataset.inventoryStatus=cardStatus;if(card._renderSalesStateV317)card._renderSalesStateV317();});
    renumberSavedSalesCardsV241(type);dirty.forEach(updateSalesCardDeleteLockV322);refreshConfirmSaleButtonV322(type);if(typeof refreshInventoryPendingV250==='function')setTimeout(()=>refreshInventoryPendingV250(true),0);setSync('销售已确认',true);alert('销售确认成功。\n\n如有库存变动，请到 Import Cost System 处理。');if(result?.warning)alert(result.warning);return result;
  }catch(e){setSync('销售确认失败',false,true);alert('销售确认失败：'+(e.message||e)+'\n\n草稿仍保留，请稍后重试确认销售。');return null}
  finally{releaseButton()}
};

// V32.5: draft cards may be edited/deleted at any time; once confirmed they are immutable for deletion.
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
      return;
    }
  }catch(e){
    // V32.5: a cloud preflight timeout must not lock turnover editing.
    // The authoritative saveLive() server guard still rejects any amount below
    // active saved cards. With no saved card, the user may edit turnover freely.
    console.warn("V32.5 销售卡预检暂时失败，继续交由云端保存时核对",e);
  }

  const restored=reactivateLiveHostIfNeeded(host);
  host=restored.host;hostInput.value=host;
  saveLiveHost(host);saveLastLiveSession(host,dateEl.value);

  const rev=nextLiveSaveRevV243(d,host);
  const now=new Date().toISOString();
  const localRow={type:"live",date:d,company:"live",location:host,amount,updatedAt:now,clientUpdatedAt:now};

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
    const saved=await saveLiveToSheet(d,host,amount,now);
    if(!isCurrentLiveSaveRevV243(d,host,rev))return;

    const finalAmount=amount;
    const finalRow=saved?{...saved,amount:finalAmount}:localRow;
    if(finalAmount<=0)rows=rows.filter(r=>rowKey(r)!==rowKey(localRow)); else upsertLocalRow(finalRow);
    if(typeof markLocalRowMutation==="function")markLocalRowMutation(finalRow,Date.now()+1);
    clearPendingRow(localRow);

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



/* ================= V29.9 profit layout + weighted average margin ================= */
function productProfitWeightedAverageRateV246(list){
  let weighted=0,qtyTotal=0;
  (list||[]).forEach(x=>{const q=Math.max(1,Number(x.quantity||1));weighted+=Number(x.profitRate||0)*q;qtyTotal+=q});
  return qtyTotal>0?weighted/qtyTotal:0;
}
function productProfitTotalsV246(list){
  return (list||[]).reduce((a,x)=>{const q=Math.max(1,Number(x.quantity||1));a.cost+=Number(x.averageCost||0)*q;a.sale+=Number(x.actualPrice||0);a.profit+=Number(x.profit||0);return a},{cost:0,sale:0,profit:0});
}
productProfitDesktopRowsV216=function(list){
  return list.map(x=>{const q=Math.max(1,Number(x.quantity||1)),cost=Number(x.averageCost||0)*q,sale=Number(x.actualPrice||0),profit=Number(x.profit||0);return `<tr><td>${profitProductDisplayV244(x)}</td><td>${formatAmount(cost)}</td><td>${formatAmount(sale)}</td><td>${formatAmount(profit)}</td><td>${Number(x.profitRate||0).toFixed(2)}%</td></tr>`}).join('');
};
productProfitMobileCardsV216=function(list){
  return list.map(x=>{const q=Math.max(1,Number(x.quantity||1)),cost=Number(x.averageCost||0)*q,sale=Number(x.actualPrice||0),profit=Number(x.profit||0);return `<div class="product-profit-mobile-card"><div class="product-profit-mobile-name">${profitProductDisplayV244(x)}</div><div class="product-profit-mobile-grid product-profit-mobile-grid-v244"><div><span>成本</span><b>${formatAmount(cost)}</b></div><div><span>售价</span><b>${formatAmount(sale)}</b></div><div><span>利润</span><b>${formatAmount(profit)}</b></div><div><span>利润率</span><b>${Number(x.profitRate||0).toFixed(2)}%</b></div></div></div>`}).join('');
};
renderProductProfitSummaryV216=function(type,allLinks){
  const panel=productProfitSummaryPanelV216(type);if(!panel)return;
  const date=productProfitSelectedDateV216(type),salesMap=productProfitSalesByGroupV216(type,date),groups=productProfitGroupLinksV216(type,date,allLinks);
  salesMap.forEach((rec,key)=>{if(!groups.has(key))groups.set(key,{name:rec.name,links:[]})});
  const ordered=Array.from(groups.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),'zh-Hans-CN',{numeric:true,sensitivity:'base'}));
  let dayProfit=0,daySales=0;
  const sections=ordered.map(group=>{const s=productProfitGroupStatsV216(group,salesMap,type),t=productProfitTotalsV246(group.links),avg=productProfitWeightedAverageRateV246(group.links);dayProfit+=s.totalProfit;daySales+=s.sales;
    const totals=group.links.length?`<div class="product-profit-rollup-v247"><b>总数</b><b>${formatAmount(t.cost)}</b><b>${formatAmount(t.sale)}</b><b>${formatAmount(t.profit)}</b><b>${avg.toFixed(2)}%</b></div>`:'';
    return `<section class="product-profit-group"><div class="product-profit-group-title">${type==='live'?'主播':'地点'}：${escapeChangeLogHtmlV200(group.name)}</div><div class="product-profit-table-wrap"><table class="product-profit-table"><thead><tr><th>产品名</th><th>成本</th><th>售价</th><th>利润</th><th>利润率</th></tr></thead><tbody>${group.links.length?productProfitDesktopRowsV216(group.links):`<tr><td colspan="5" class="product-profit-empty">没有已保存的销售卡资料</td></tr>`}</tbody></table></div><div class="product-profit-mobile-list">${group.links.length?productProfitMobileCardsV216(group.links):`<div class="product-profit-empty">没有已保存的销售卡资料</div>`}</div>${totals}<div class="product-profit-total profit-highlight product-profit-grand-v246"><span>总利润</span><b>RM${formatAmount(s.totalProfit)}</b></div></section>`;
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
      const itemType=String(item.type||"").toLowerCase();
      if(pageType==="daily")return itemType==="daily"&&String(item.location||"Belimbing").toLowerCase()==="belimbing";
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
        <div class="inventory-summary-title-v264">⚠️ 有 ${itemCount} 项库存变动</div>
        <div class="inventory-summary-meta-v264">${escapeChangeLogHtmlV200(first.date)}${inventoryPendingTimeV325(first)?" "+escapeChangeLogHtmlV200(inventoryPendingTimeV325(first)):""} · ${String(first.type||"").toLowerCase()==="daily"?"Sales · Belimbing":String(first.type||"").toLowerCase()==="live"?"Live · "+escapeChangeLogHtmlV200(first.location):"Fair · "+escapeChangeLogHtmlV200(first.location)}</div>
        <div class="inventory-summary-action-v264">请到 Import Cost System 处理 <span aria-hidden="true">›</span></div>
      </button>`;
    }).join("");
  });
}

async function refreshInventoryPendingV250(force=false){
  if(inventoryPendingLoadingV250)return inventoryPendingLoadingV250;
  if(!force&&Date.now()-inventoryPendingLastAtV250<30000){renderInventoryPendingGlobalV250();return inventoryPendingCacheV250}
  inventoryPendingLoadingV250=(async()=>{
    try{
      const list=await loadPendingInventorySalesCardsV250();
      inventoryPendingCacheV250=normalizePendingInventoryItemsV263(list);
      inventoryPendingLastAtV250=Date.now();
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


// V29.9: Sales-side inventory confirmation removed. Import is the only inventory authority.

async function openPendingInventorySalesCardV250(raw){
  const item=typeof raw==="string"?JSON.parse(raw):raw;if(!item)return;
  const type=String(item.type||"").toLowerCase();
  const page=type==="daily"?"sales":type;
  const nav=document.querySelector(`.nav-item[data-page="${page}"]`);
  if(nav)showPage(page,nav);
  await new Promise(r=>setTimeout(r,0));

  if(type==="daily"){
    const company=document.getElementById("company");if(company)company.value="belimbing";
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
// V32.5: cloud resume synchronization is centralized in update.js.
// Refresh Import reminders once only after that resume cycle completes, instead
// of competing with it through visibilitychange + focus + pageshow.
window.addEventListener("lover-sales-resume-ready",scheduleInventoryPendingResumeRefreshV265);


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
    if(type==='daily'){if(r.company!=='belimbing')return;}else if(type==='live'){if(normalizeLiveHostKey(r.location)!==normalizeLiveHostKey(name))return;}else if(normalizeFairLocationKey(r.location)!==normalizeFairLocationKey(name))return;
    total+=Number(r.amount||0);
  });return total;
}
function linksProfitV285(links,type,name,start,end){const sk=dateKeyV285(start),ek=dateKeyV285(end);return (links||[]).reduce((sum,x)=>{if(String(x.type||'')!==type)return sum;const dk=dateKeyV285(x.date);if(!dk||dk<sk||dk>ek)return sum;if(type==='daily')return sum+Number(x.profit||0);if(type==='live'&&normalizeLiveHostKey(x.location)!==normalizeLiveHostKey(name))return sum;if(type==='fair'&&normalizeFairLocationKey(x.location)!==normalizeFairLocationKey(name))return sum;return sum+Number(x.profit||0)},0)}
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
    const start='01-'+month,[mm,yy]=month.split('-').map(Number),end=String(new Date(yy,mm,0).getDate()).padStart(2,'0')+'-'+month;cards=[{title:'Belimbing',start,end,sales:rowTurnoverV285('daily','Belimbing',start,end),profit:linksProfitV285(links,'daily','Belimbing',start,end)}];
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
function fairProfitRowV294(r,profit){
  const sales=Number(r.amount||0);
  return `<div class="month-profit-row-v294"><span>${r.date}</span><strong>${money(sales)}</strong><strong class="profit-value-v294">${money(profit)}</strong><strong class="profit-rate-v294">${marginTextV294(profit,sales)}</strong></div>`;
}
function shortDayMonthV297(date){
  const text=String(date||'').trim();
  const m=text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if(m)return `${m[1]}-${m[2]}`;
  const iso=displayToISO(text);
  const im=String(iso||'').match(/^\d{4}-(\d{2})-(\d{2})$/);
  return im?`${im[2]}-${im[1]}`:text;
}
function liveProfitRowV294(r,profit){
  const sales=Number(r.amount||0);
  return `<div class="month-profit-row-v294 live-profit-row-v294"><span>${shortDayMonthV297(r.date)}</span><strong class="live-commission-value-v297">${money(r.commissionAmount)}</strong><strong>${money(sales)}</strong><strong class="profit-value-v294">${money(profit)}</strong><strong class="profit-rate-v294">${marginTextV294(profit,sales)}</strong></div>`;
}
function profitHeadV294(){return `<div class="month-profit-row-v294 month-profit-head-v294"><span>日期</span><span>营业额</span><span>利润</span><span>利润率</span></div>`}
function liveProfitHeadV297(group){
  const rates=[...new Set((group&&Array.isArray(group.rows)?group.rows:[]).map(r=>Number(r.commissionRate||0).toFixed(2).replace(/\.00$/,'')).filter(Boolean))];
  const label=rates.length===1?`佣金 ${rates[0]}%`:'佣金';
  return `<div class="month-profit-row-v294 live-profit-row-v294 live-profit-head-v297"><span>日期</span><span>${label}</span><span>营业额</span><span>利润</span><span>利润率</span></div>`;
}

renderFairMonthlyList=function(){
  const container=document.getElementById("fairMonthlyList"),totalEl=document.getElementById("fairMonthlySalesTotal"),titleEl=document.getElementById("fairMonthlyTitle"),labelEl=document.getElementById("fairMonthlyTotalLabel");
  if(!container||!totalEl)return;
  const month=monthFromDateControl("fairStart"),monthLabel=/^\d{4}-\d{2}$/.test(month)?`${month.slice(5,7)}-${month.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`Fair ${monthLabel} 销售记录`;
  if(labelEl)labelEl.textContent=`Fair ${monthLabel} 总销售额`;
  const list=rows.filter(r=>r.type==="fair"&&displayToISO(r.date).slice(0,7)===month&&Number(r.amount)>0).map(r=>({...r,displayLocation:canonicalLocation(r.location||"Fair")})).sort((a,b)=>a.displayLocation.localeCompare(b.displayLocation,"en",{sensitivity:"base"})||displayToISO(a.date).localeCompare(displayToISO(b.date)));
  const total=list.reduce((sum,r)=>sum+Number(r.amount||0),0); totalEl.textContent=money(total);
  const fairRate=getFairCommissionRate(total),fairRatePct=Number((fairRate*100).toFixed(2)),fairCommissionTotal=total*fairRate;
  const monthlyCommissionEl=document.getElementById("fairMonthlyCommissionTotal"),monthlyCommissionLabel=document.getElementById("fairMonthlyCommissionLabel");
  if(monthlyCommissionEl)monthlyCommissionEl.textContent=money(fairCommissionTotal);
  if(monthlyCommissionLabel)monthlyCommissionLabel.textContent=`Fair ${monthLabel} 总佣金 ${fairRatePct}%`;
  if(!list.length){container.innerHTML='<div class="sub">这个月份还没有 Fair 记录</div>';if(monthlyCommissionEl)monthlyCommissionEl.textContent="0.00";renderFairPageTop3();return;}
  const locations=[];list.forEach(r=>{let g=locations.find(x=>x.name===r.displayLocation);if(!g){g={name:r.displayLocation,rows:[]};locations.push(g)}g.rows.push(r)});
  const token=++monthlyProfitRenderTokenV294.fair;
  container.innerHTML=locations.map(group=>{const sales=group.rows.reduce((s,r)=>s+Number(r.amount||0),0),commission=sales*fairRate;return `<div class="month-record-group month-profit-group-v294" data-profit-group="${escapeChangeLogHtmlV200(group.name)}"><div class="month-record-group-title fair-location-title-v298"><span>${escapeChangeLogHtmlV200(group.name)}</span><b>佣金 ${money(commission)}</b></div>${profitHeadV294()}${group.rows.map(r=>fairProfitRowV294(r,0)).join('')}<div class="month-profit-row-v294 month-profit-total-v294"><span>这场 Fair 总数</span><strong>${money(sales)}</strong><strong class="profit-value-v294">0.00</strong><strong class="profit-rate-v294">0.00%</strong></div></div>`}).join('')+`<div id="fairProfitGrandV294" class="profit-grand-v294"><strong>Fair 全部地点总计</strong><div><span>营业额</span><b>${money(total)}</b></div><div><span>利润</span><b>0.00</b></div><div><span>整体利润率</span><b>0.00%</b></div></div>`;
  renderFairPageTop3();
  Promise.resolve(loadAllSalesProductLinksV203({force:false,maxAgeMs:120000})).then(links=>{
    if(token!==monthlyProfitRenderTokenV294.fair)return;
    container.innerHTML=locations.map(group=>{
      let groupProfit=0,groupSales=0;
      const rowsHtml=group.rows.map(r=>{const p=profitByDayV294(links,'fair',group.name,r.date);groupProfit+=p;groupSales+=Number(r.amount||0);return fairProfitRowV294(r,p)}).join('');
      const groupCommission=groupSales*fairRate;
      return `<div class="month-record-group month-profit-group-v294"><div class="month-record-group-title fair-location-title-v298"><span>${escapeChangeLogHtmlV200(group.name)}</span><b>佣金 ${money(groupCommission)}</b></div>${profitHeadV294()}${rowsHtml}<div class="month-profit-row-v294 month-profit-total-v294"><span>这场 Fair 总数</span><strong>${money(groupSales)}</strong><strong class="profit-value-v294">${money(groupProfit)}</strong><strong class="profit-rate-v294">${marginTextV294(groupProfit,groupSales)}</strong></div></div>`;
    }).join('');
    const totalProfit=locations.reduce((sum,g)=>sum+g.rows.reduce((s,r)=>s+profitByDayV294(links,'fair',g.name,r.date),0),0);
    container.insertAdjacentHTML('beforeend',`<div id="fairProfitGrandV294" class="profit-grand-v294"><strong>Fair 全部地点总计</strong><div><span>营业额</span><b>${money(total)}</b></div><div><span>利润</span><b>${money(totalProfit)}</b></div><div><span>整体利润率</span><b>${marginTextV294(totalProfit,total)}</b></div></div>`);
  }).catch(e=>console.warn('V29.9 Fair 利润读取失败',e));
};

renderLiveMonthlyList=function(){
  const container=document.getElementById("liveMonthlyList"),totalEl=document.getElementById("liveSelectedHostTotal"),commissionTotalEl=document.getElementById("liveSelectedCommissionTotal"),titleEl=document.getElementById("liveMonthlyTitle"),totalLabelEl=document.getElementById("liveMonthlyTotalLabel"),commissionLabelEl=document.getElementById("liveMonthlyCommissionLabel");
  if(!container||!totalEl)return;
  const liveMonth=getLiveSelectedMonth(),monthLabel=/^\d{4}-\d{2}$/.test(liveMonth)?`${liveMonth.slice(5,7)}-${liveMonth.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`Live ${monthLabel} 销售记录`;if(totalLabelEl)totalLabelEl.textContent=`Live ${monthLabel} 总销售额`;if(commissionLabelEl)commissionLabelEl.textContent=`Live ${monthLabel} 总佣金`;
  const list=rows.filter(r=>r.type==="live"&&displayToISO(r.date).slice(0,7)===liveMonth&&Number(r.amount)>0).map(r=>{const rate=getLiveHostRate(r.location,r.date),amount=Number(r.amount||0);return{...r,displayHost:canonicalLiveHost(r.location),commissionRate:rate,commissionAmount:amount*rate/100}}).sort((a,b)=>a.displayHost.localeCompare(b.displayHost,"en",{sensitivity:"base"})||displayToISO(a.date).localeCompare(displayToISO(b.date)));
  const total=list.reduce((s,r)=>s+Number(r.amount||0),0),commissionTotal=list.reduce((s,r)=>s+Number(r.commissionAmount||0),0);totalEl.textContent=money(total);if(commissionTotalEl)commissionTotalEl.textContent=money(commissionTotal);
  if(!list.length){container.innerHTML='<div class="sub">这个月份还没有 Live 记录</div>';renderLivePageTop3();return;}
  const groups=[];list.forEach(r=>{const key=normalizeLiveHostKey(r.displayHost);let g=groups.find(x=>x.key===key);if(!g){g={key,name:r.displayHost,rows:[]};groups.push(g)}g.rows.push(r)});
  const token=++monthlyProfitRenderTokenV294.live;
  container.innerHTML=groups.map(group=>{const sales=group.rows.reduce((s,r)=>s+Number(r.amount||0),0),comm=group.rows.reduce((s,r)=>s+Number(r.commissionAmount||0),0);return `<div class="live-sales-group month-profit-group-v294"><div class="live-sales-group-title"><span>${escapeChangeLogHtmlV200(group.name)}</span><b>佣金 ${money(comm)}</b></div>${liveProfitHeadV297(group)}${group.rows.map(r=>liveProfitRowV294(r,0)).join('')}<div class="month-profit-row-v294 live-profit-row-v294 month-profit-total-v294"><span>总数</span><strong class="live-commission-value-v297">${money(comm)}</strong><strong>${money(sales)}</strong><strong class="profit-value-v294">0.00</strong><strong class="profit-rate-v294">0.00%</strong></div></div>`}).join('')+`<div class="profit-grand-v294"><strong>Live 全部主播总计</strong><div><span>营业额</span><b>${money(total)}</b></div><div><span>利润</span><b>0.00</b></div><div><span>整体利润率</span><b>0.00%</b></div></div>`;
  renderLivePageTop3();
  Promise.resolve(loadAllSalesProductLinksV203({force:false,maxAgeMs:120000})).then(links=>{
    if(token!==monthlyProfitRenderTokenV294.live)return;
    container.innerHTML=groups.map(group=>{let gp=0,gs=0;const comm=group.rows.reduce((s,r)=>s+Number(r.commissionAmount||0),0);const html=group.rows.map(r=>{const p=profitByDayV294(links,'live',group.name,r.date);gp+=p;gs+=Number(r.amount||0);return liveProfitRowV294(r,p)}).join('');return `<div class="live-sales-group month-profit-group-v294"><div class="live-sales-group-title"><span>${escapeChangeLogHtmlV200(group.name)}</span><b>佣金 ${money(comm)}</b></div>${liveProfitHeadV297(group)}${html}<div class="month-profit-row-v294 live-profit-row-v294 month-profit-total-v294"><span>总数</span><strong class="live-commission-value-v297">${money(comm)}</strong><strong>${money(gs)}</strong><strong class="profit-value-v294">${money(gp)}</strong><strong class="profit-rate-v294">${marginTextV294(gp,gs)}</strong></div></div>`}).join('');
    const totalProfit=groups.reduce((sum,g)=>sum+g.rows.reduce((s,r)=>s+profitByDayV294(links,'live',g.name,r.date),0),0);
    container.insertAdjacentHTML('beforeend',`<div class="profit-grand-v294"><strong>Live 全部主播总计</strong><div><span>营业额</span><b>${money(total)}</b></div><div><span>利润</span><b>${money(totalProfit)}</b></div><div><span>整体利润率</span><b>${marginTextV294(totalProfit,total)}</b></div></div>`);
  }).catch(e=>console.warn('V29.9 Live 利润读取失败',e));
};


