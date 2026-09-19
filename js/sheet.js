const API_URL = window.LOVER_API_URL;
let rows = [];
let pendingRows = [];
let pendingSyncRunning = false;
let cloudLoadPromise = null;
const cloudLoadPromisesByMonth = new Map();
let lastCloudLoadAt = 0;
let initialCloudSyncFinished = false;
let initialCloudSyncPromise = null;
let localDataRevision = 0;
let revisionCheckPromise = null;
let revisionRetryTimerV448 = null;
let revisionRetryCountV448 = 0;
let settingsWritePromise = null;
let settingsWriteDepth = 0;
let yearLoadPromises = new Map();
let loadedCloudYears = new Set();
const localRowMutationAt = new Map();
const fairWriteQueuesV343 = new Map();
const CLIENT_DEVICE_KEY_V344="lover_sales_client_device_v344";
const CLIENT_SEQUENCE_KEY_V344="lover_sales_client_sequence_v344";
const RESTORE_GENERATION_KEY_V347="lover_restore_generation_v347";
function getLocalRestoreGenerationV347(){try{return Math.max(0,Number(localStorage.getItem(RESTORE_GENERATION_KEY_V347)||0))}catch(_){return 0}}
function clearStaleRestoreQueuesV347(){
  pendingRows=[];
  try{localStorage.removeItem("lover_pending_rows");localStorage.removeItem("lover_sales_draft_pending_v314");localStorage.removeItem(LOCAL_DATA_CACHE_KEY);localStorage.removeItem("lover_daily_profit_cache_v237");localStorage.removeItem("lover_sales_change_log_cache_v237")}catch(_){}
}
function applyRestoreGenerationV347(value){
  const incoming=Math.max(0,Number(value||0)),current=getLocalRestoreGenerationV347();
  if(incoming<=current)return false;
  clearStaleRestoreQueuesV347();
  try{localStorage.setItem(RESTORE_GENERATION_KEY_V347,String(incoming))}catch(_){}
  return true;
}
window.getLocalRestoreGenerationV347=getLocalRestoreGenerationV347;
window.applyRestoreGenerationV347=applyRestoreGenerationV347;

function nextClientMutationV344(){
  let deviceId="";
  try{deviceId=localStorage.getItem(CLIENT_DEVICE_KEY_V344)||""}catch(_){}
  if(!deviceId){
    deviceId="dev_"+(crypto?.randomUUID?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2)));
    try{localStorage.setItem(CLIENT_DEVICE_KEY_V344,deviceId)}catch(_){}
  }
  let sequence=0;
  try{sequence=Number(localStorage.getItem(CLIENT_SEQUENCE_KEY_V344)||0)+1;localStorage.setItem(CLIENT_SEQUENCE_KEY_V344,String(sequence))}catch(_){sequence=Date.now()}
  return{clientDeviceId:deviceId,clientSequence:sequence,restoreGeneration:getLocalRestoreGenerationV347()};
}

const LOCAL_DATA_CACHE_KEY = "lover_sales_data_cache";
const LEGACY_LOCAL_DATA_CACHE_KEYS = [
  "lover_sales_data_cache_v95",
  "lover_sales_data_cache_v94",
  "lover_sales_data_cache_v93",
  "lover_sales_data_cache_v92"
];
const CLOUD_LOAD_COOLDOWN_MS = 20000;
const REVISION_CHECK_TIMEOUT_MS = 9000; // V46.0: survive Apps Script cold-start; Local First remains instant.
// V29.9: notification dispatch uses the existing keepalive transport.
// It is fire-and-forget after a successful business save, so OneSignal never
// blocks the Sales/Fair/Live save or cloud-sync path on mobile or desktop.
function getSalesLaunchUrlV194(){
  try{
    const url=new URL(window.location.href);
    url.hash="";
    url.search="";
    if(/\/index\.html$/i.test(url.pathname))url.pathname=url.pathname.replace(/index\.html$/i,"");
    else if(!url.pathname.endsWith("/"))url.pathname=url.pathname.replace(/[^/]+$/,"");
    return url.href;
  }catch(e){return "";}
}

function setLastNotificationDispatchStatus(result){
  try{
    const payload={
      at:new Date().toISOString(),
      ok:Boolean(result&&result.ok),
      result:result||null
    };
    localStorage.setItem("lover_sales_last_notification_dispatch_v180",JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("lover-sales-notification-status",{detail:payload}));
  }catch(e){}
}

const SALES_NOTIFICATION_QUEUE_KEY_V397="lover_sales_notification_queue_v397";
let salesNotificationWorkerV397=null;
function readSalesNotificationQueueV397(){try{const x=JSON.parse(localStorage.getItem(SALES_NOTIFICATION_QUEUE_KEY_V397)||"[]");return Array.isArray(x)?x:[]}catch(_){return[]}}
function writeSalesNotificationQueueV397(list){try{localStorage.setItem(SALES_NOTIFICATION_QUEUE_KEY_V397,JSON.stringify(Array.isArray(list)?list:[]))}catch(_){}}
function notificationQueueIdV397(envelope){return String(envelope?.notificationId||envelope?.payload||"").slice(0,180)}
function queueSalesNotificationV397(envelope){
  const id=notificationQueueIdV397(envelope);if(!id)return false;
  const q=readSalesNotificationQueueV397();
  if(!q.some(x=>x.id===id))q.push({id,envelope,attempts:0,nextAt:0,createdAt:Date.now()});
  writeSalesNotificationQueueV397(q);return true;
}
function scheduleSalesNotificationWorkerV397(delay=0){
  if(salesNotificationWorkerV397)clearTimeout(salesNotificationWorkerV397);
  salesNotificationWorkerV397=setTimeout(()=>{salesNotificationWorkerV397=null;runSalesNotificationWorkerV397().catch(()=>{})},Math.max(0,delay));
}
async function runSalesNotificationWorkerV397(){
  const q=readSalesNotificationQueueV397();if(!q.length)return;
  const now=Date.now(),item=q.find(x=>Number(x.nextAt||0)<=now);if(!item){scheduleSalesNotificationWorkerV397(Math.min(30000,Math.max(1000,Math.min(...q.map(x=>Number(x.nextAt||now+1000)))-now)));return}
  try{
    const env=item.envelope||{};
    const result=await jsonp({action:"dispatchSalesNotification",payload:env.payload,signature:env.signature,notificationId:String(env.notificationId||""),clientVersion:"39.7",launchUrl:getSalesLaunchUrlV194()},{timeoutMs:12000});
    if(!result?.ok)throw new Error(result?.message||"通知发送失败");
    const next=readSalesNotificationQueueV397().filter(x=>x.id!==item.id);writeSalesNotificationQueueV397(next);
    setLastNotificationDispatchStatus({...result,ok:true,queued:false,message:result.alreadySent?"通知已确认发送（去重）":"通知已确认发送"});
    if(next.length)scheduleSalesNotificationWorkerV397(250);
  }catch(e){
    const next=readSalesNotificationQueueV397();const rec=next.find(x=>x.id===item.id);if(rec){rec.attempts=Number(rec.attempts||0)+1;const waits=[5000,15000,30000,60000,120000,300000];rec.nextAt=Date.now()+waits[Math.min(rec.attempts-1,waits.length-1)];writeSalesNotificationQueueV397(next);setLastNotificationDispatchStatus({ok:false,queued:true,retrying:true,attempted:rec.attempts,message:"通知发送失败，后台自动重试："+String(e?.message||e)});scheduleSalesNotificationWorkerV397(Math.min(30000,waits[Math.min(rec.attempts-1,waits.length-1)]));}
  }
}
function dispatchSalesNotificationAsync(envelope){
  if(!envelope||!envelope.payload||!envelope.signature){setLastNotificationDispatchStatus({ok:true,skipped:true,message:"没有新的营业额变化，无需重复通知"});return}
  queueSalesNotificationV397(envelope);
  setLastNotificationDispatchStatus({ok:true,queued:true,attempted:0,sent:0,message:"资料已保存；通知后台发送中"});
  scheduleSalesNotificationWorkerV397(0);
}
window.addEventListener("online",()=>scheduleSalesNotificationWorkerV397(100));
document.addEventListener("visibilitychange",()=>{if(!document.hidden)scheduleSalesNotificationWorkerV397(150)});
setTimeout(()=>scheduleSalesNotificationWorkerV397(1200),0);



function applyLocalDataRevision(value) {
  const revision = Number(value || 0);
  if (Number.isFinite(revision) && revision >= 0) localDataRevision = revision;
  return localDataRevision;
}

function getLocalDataRevision() {
  return Number(localDataRevision || 0);
}

const PRIORITY_SYNC_CACHE_KEY_V315="lover_priority_sync_v315";
function getPrioritySyncLocalV315(){try{return JSON.parse(localStorage.getItem(PRIORITY_SYNC_CACHE_KEY_V315)||"{}")}catch(_){return{}}}
function setPrioritySyncLocalV315(v){try{localStorage.setItem(PRIORITY_SYNC_CACHE_KEY_V315,JSON.stringify(v||{}))}catch(_){}}

// V46.0: exact-context freshness stamp. A full cloud bundle updates the global
// Sales Card revision, but an editor context is trusted only after that exact
// date/location has been read from the authoritative endpoint (or this device
// itself successfully saved that context).
const SALES_CARD_CONTEXT_VERIFY_KEY_V451="lover_sales_card_context_verify_v451";
function readSalesCardContextVerifyV451(){try{const x=JSON.parse(localStorage.getItem(SALES_CARD_CONTEXT_VERIFY_KEY_V451)||"{}");return x&&typeof x==="object"?x:{}}catch(_){return{}}}
function salesCardContextVerifyKeyV451(type,date,location){return [String(type||""),String(date||""),String(location||"").trim().toLowerCase()].join("|")}
function markSalesCardContextVerifiedV451(type,date,location,revision){
  const rev=Number(revision||0);if(!type||!date||!String(location||"").trim()||!rev)return;
  const all=readSalesCardContextVerifyV451();all[salesCardContextVerifyKeyV451(type,date,location)]=rev;
  try{localStorage.setItem(SALES_CARD_CONTEXT_VERIFY_KEY_V451,JSON.stringify(all))}catch(_){}
}
function salesCardContextNeedsVerifyV451(type,date,location){
  const rev=Number((getPrioritySyncLocalV315()||{}).salesCardRevision||0);
  if(!rev||!type||!date||!String(location||"").trim())return false;
  const all=readSalesCardContextVerifyV451();
  return Number(all[salesCardContextVerifyKeyV451(type,date,location)]||0)!==rev;
}
if(typeof window!=="undefined"){window.markSalesCardContextVerifiedV451=markSalesCardContextVerifiedV451;window.salesCardContextNeedsVerifyV451=salesCardContextNeedsVerifyV451;}
async function checkPriorityRevisionV315(timeoutMs=8000){return jsonp({action:"priorityRevisionV315"},{timeoutMs});}
async function refreshVisibleSalesCardsAfterCloudRevisionV444(){
  const types=['daily','fair','live'];
  const tasks=[];
  for(const type of types){
    try{
      if(typeof productLinkBoxIsOpenV210==='function'&&productLinkBoxIsOpenV210(type)&&typeof loadProductLinksIntoEditorV206==='function'){
        tasks.push(Promise.resolve(loadProductLinksIntoEditorV206(type)));
      }
    }catch(_){}
  }
  if(tasks.length)await Promise.allSettled(tasks);
}

// V46.0 authoritative cross-device refresh. When the Sales Card revision changes,
// fetch ONE complete active Sales Card snapshot from cloud. Do not clear any
// local card cache before that request succeeds. The snapshot is committed in
// one local transaction only after month data + all active cards both arrive.
let CLOUD_ATOMIC_SYNC_PENDING_V448=false;
function setCloudAtomicSyncPendingV448(value){
  CLOUD_ATOMIC_SYNC_PENDING_V448=!!value;
  if(typeof window!=="undefined")window.CLOUD_ATOMIC_SYNC_PENDING_V448=CLOUD_ATOMIC_SYNC_PENDING_V448;
}
function cloudAtomicSyncPendingV448(){return CLOUD_ATOMIC_SYNC_PENDING_V448;}
if(typeof window!=="undefined")window.cloudAtomicSyncPendingV448=cloudAtomicSyncPendingV448;

let CLOUD_REVISION_CONFIRMED_V449=false;
function setCloudRevisionConfirmedV449(value){
  CLOUD_REVISION_CONFIRMED_V449=!!value;
  if(typeof window!=='undefined')window.CLOUD_REVISION_CONFIRMED_V449=CLOUD_REVISION_CONFIRMED_V449;
}
function cloudRevisionSafeForWriteV449(){return CLOUD_REVISION_CONFIRMED_V449===true&&!CLOUD_ATOMIC_SYNC_PENDING_V448;}
if(typeof window!=='undefined')window.cloudRevisionSafeForWriteV449=cloudRevisionSafeForWriteV449;

function hasLocalSalesDraftRiskV449(){
  // V46.0: only a card that is actively being edited in the DOM blocks an
  // authoritative cloud commit. Durable pending drafts are reconciled against
  // per-context cloud timestamps after the bundle arrives; they must not freeze
  // the entire device or keep an older saved draft above a newer cloud card.
  try{
    if(typeof hasUnsavedSalesCardChangesV238==='function'&&['daily','fair','live'].some(t=>hasUnsavedSalesCardChangesV238(t)))return true;
  }catch(_){}
  return false;
}
function dirtySalesCardContextKeysV456(){
  const out=new Set();
  try{
    ['daily','fair','live'].forEach(type=>{
      if(typeof hasUnsavedSalesCardChangesV238!=='function'||!hasUnsavedSalesCardChangesV238(type))return;
      const c=typeof productLinkContextV206==='function'?productLinkContextV206(type):null;
      if(c&&c.date&&String(c.location||'').trim())out.add([type,String(c.date),String(c.location).trim().toLowerCase()].join('|'));
    });
  }catch(_){}
  return out;
}
function changedCardTouchesDirtyContextV456(changes){
  const dirty=dirtySalesCardContextKeysV456();if(!dirty.size)return false;
  return (Array.isArray(changes)?changes:[]).some(x=>x&&x.kind==='card'&&dirty.has([String(x.type||''),String(x.date||''),String(x.location||'').trim().toLowerCase()].join('|')));
}

async function fetchAllSalesCardsAtomicV449(timeoutMs=20000){
  const json=await jsonp({action:'getAllSalesProductLinks'},{timeoutMs:Number(timeoutMs||20000)});
  if(!json||!json.ok)throw new Error((json&&json.message)||'销售卡云端读取失败');
  return typeof dedupeAuthoritativeSalesLinksV354==='function'
    ?dedupeAuthoritativeSalesLinksV354(Array.isArray(json.links)?json.links:[])
    :(Array.isArray(json.links)?json.links:[]);
}

async function fetchSyncBundleV450(month,timeoutMs=22000){
  const json=await jsonp({action:'syncBundleV450',month:String(month||'')},{timeoutMs:Number(timeoutMs||22000)});
  if(!json||!json.ok)throw new Error((json&&json.message)||'完整云端同步失败');
  if(!Array.isArray(json.salesProductLinks))throw new Error('云端销售卡快照不完整');
  return json;
}
if(typeof window!=='undefined')window.fetchSyncBundleV450=fetchSyncBundleV450;

// V46.0: durable local draft retry entries are safety copies, not an authority
// above a newer cloud context. Compare each pending context with the same-context
// cloud timestamp from the authoritative bundle before any retry can run.
const SALES_DRAFT_CONFLICT_BACKUP_KEY_V452='lover_sales_draft_conflict_backup_v452';
function backupSalesDraftConflictV452(key,entry,reason){
  try{
    const all=JSON.parse(localStorage.getItem(SALES_DRAFT_CONFLICT_BACKUP_KEY_V452)||'{}')||{};
    all[key]={...entry,conflictReason:String(reason||''),conflictAt:Date.now()};
    localStorage.setItem(SALES_DRAFT_CONFLICT_BACKUP_KEY_V452,JSON.stringify(all));
  }catch(_){}
}
function salesCardSnapshotContextV452(allLinks,type,date,location){
  const want=salesCardPersistentKeyV232(type,date,location);
  return (Array.isArray(allLinks)?allLinks:[]).filter(x=>x&&salesCardPersistentKeyV232(x.type,x.date,x.location)===want);
}
function reconcilePendingSalesDraftsFromBundleV452(bundle){
  if(typeof readSalesDraftPendingV314!=='function'||typeof writeSalesDraftPendingV314!=='function')return {cleared:0,conflicts:0};
  const pending=readSalesDraftPendingV314()||{};
  const versions=(bundle&&bundle.salesCardContextVersions&&typeof bundle.salesCardContextVersions==='object')?bundle.salesCardContextVersions:{};
  const links=Array.isArray(bundle&&bundle.salesProductLinks)?bundle.salesProductLinks:[];
  let cleared=0,conflicts=0,changed=false;
  Object.keys(pending).forEach(key=>{
    const entry=pending[key];if(!entry||!entry.type||!entry.date||!String(entry.location||'').trim())return;
    const cloud=salesCardSnapshotContextV452(links,entry.type,entry.date,entry.location);
    const localItems=Array.isArray(entry.items)?entry.items:[];
    const same=(typeof salesCardCloudFingerprintV445==='function')
      ?salesCardCloudFingerprintV445(cloud)===salesCardCloudFingerprintV445(localItems)
      :JSON.stringify(cloud)===JSON.stringify(localItems);
    if(same){delete pending[key];changed=true;cleared++;return;}
    const ctxKey=String(entry.type||'')+'|'+String(entry.date||'')+'|'+String(entry.location||'').trim().toLowerCase();
    const cloudChangedAt=Number(versions[ctxKey]||0),localSafeAt=Number(entry.savedAt||0);
    // Only discard the retry authority when the SAME cloud context is proven
    // newer than this safety copy. Changes to unrelated cards never cancel it.
    if(cloudChangedAt&&localSafeAt&&cloudChangedAt>localSafeAt+1000){
      backupSalesDraftConflictV452(key,entry,'同一销售卡已有较新的云端版本；旧本机安全副本未自动覆盖云端');
      delete pending[key];changed=true;conflicts++;
    }
  });
  if(changed)writeSalesDraftPendingV314(pending);
  return {cleared,conflicts};
}
if(typeof window!=='undefined')window.reconcilePendingSalesDraftsFromBundleV452=reconcilePendingSalesDraftsFromBundleV452;

// V46.0: Sales Card + profit are one local authority transaction. Profit is
// never allowed to come from a newer/older source than the card snapshot that
// produced it. Rebuild the daily profit cache from the SAME authoritative card
// snapshot before any UI repaint can occur.
function rebuildProfitCachesFromAuthoritativeCardsV453(allLinks){
  const links=typeof dedupeAuthoritativeSalesLinksV354==='function'
    ?dedupeAuthoritativeSalesLinksV354(Array.isArray(allLinks)?allLinks:[])
    :(Array.isArray(allLinks)?allLinks:[]);
  const byDay=new Map();
  for(const x of links){
    if(!x||!x.type||!x.date)continue;
    if(['deleted','cancelled'].includes(String(x.status||'active').toLowerCase()))continue;
    const k=String(x.type)+'|'+String(x.date);
    if(!byDay.has(k))byDay.set(k,{type:String(x.type),date:String(x.date),links:[]});
    byDay.get(k).links.push(x);
  }
  try{if(typeof clearDailyProfitCacheV237==='function')clearDailyProfitCacheV237();}catch(_){}
  for(const g of byDay.values()){
    try{if(typeof setDailyProfitCacheV237==='function')setDailyProfitCacheV237(g.type,g.date,g.links);}catch(_){}
  }
  // Full Sales Card snapshot is also the authority for aggregate profit readers.
  try{allSalesProductLinksCacheV216={links,at:Date.now()};}catch(_){}
  try{
    if(Array.isArray(monthGrandProfitLinksV295))monthGrandProfitLinksV295=[...links];
    if(Array.isArray(yearBreakdownLinksV286))yearBreakdownLinksV286=[...links];
  }catch(_){}
  return links;
}
if(typeof window!=='undefined')window.rebuildProfitCachesFromAuthoritativeCardsV453=rebuildProfitCachesFromAuthoritativeCardsV453;

// V46.0: replace one exact Sales/Fair/Live context in every in-memory
// aggregate profit authority immediately after the fast context read succeeds.
// This uses the card payload already in memory, so it adds no cloud request and
// prevents the Profit panel from reusing a 3-minute-old getAll cache.
function replaceProfitAggregateContextV457(type,date,location,links){
  const t=String(type||''),d=String(date||''),loc=String(location||'').trim().toLowerCase();
  const fresh=typeof dedupeAuthoritativeSalesLinksV354==='function'
    ?dedupeAuthoritativeSalesLinksV354(Array.isArray(links)?links:[])
    :(Array.isArray(links)?links:[]);
  const sameCtx=x=>String(x?.type||'')===t&&String(x?.date||'')===d&&String(x?.location||'').trim().toLowerCase()===loc;
  try{
    if(Array.isArray(allSalesProductLinksCacheV216?.links)){
      const kept=allSalesProductLinksCacheV216.links.filter(x=>!sameCtx(x)&&!['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase()));
      allSalesProductLinksCacheV216={links:[...kept,...fresh],at:Date.now()};
    }
  }catch(_){}
  try{
    if(Array.isArray(monthGrandProfitLinksV295)){
      const kept=monthGrandProfitLinksV295.filter(x=>!sameCtx(x)&&!['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase()));
      monthGrandProfitLinksV295=[...kept,...fresh];
    }
    if(Array.isArray(yearBreakdownLinksV286)){
      const kept=yearBreakdownLinksV286.filter(x=>!sameCtx(x)&&!['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase()));
      yearBreakdownLinksV286=[...kept,...fresh];
    }
  }catch(_){}
  try{if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(t,d,location,fresh)}catch(_){}
  try{if(typeof renderSelectedDayGrandV362==='function')renderSelectedDayGrandV362(t)}catch(_){}
  try{
    if(typeof productProfitSelectedDateV216==='function'&&productProfitSummaryOpenV216?.[t]&&productProfitSelectedDateV216(t)===d&&typeof getDailyProfitCacheV237==='function'&&typeof renderProductProfitSummaryV216==='function'){
      const day=getDailyProfitCacheV237(t,d)||[];
      renderProductProfitSummaryV216(t,day);
    }
  }catch(_){}
  try{if(monthGrandHistoryOpenV223&&typeof renderMonthGrandHistoryV223==='function')renderMonthGrandHistoryV223()}catch(_){}
  try{if(Object.values(yearBreakdownOpenV224||{}).some(Boolean)&&typeof renderAllYearBreakdownsV224==='function')renderAllYearBreakdownsV224()}catch(_){}
  return fresh;
}
if(typeof window!=='undefined')window.replaceProfitAggregateContextV457=replaceProfitAggregateContextV457;

function commitAllSalesCardsAtomicV449(allLinks,verifiedRevisionV452=0){
  const links=typeof dedupeAuthoritativeSalesLinksV354==='function'
    ?dedupeAuthoritativeSalesLinksV354(Array.isArray(allLinks)?allLinks:[])
    :(Array.isArray(allLinks)?allLinks:[]);
  const groups=new Map();
  for(const link of links){
    if(!link||!link.type||!link.date||!String(link.location||'').trim())continue;
    const key=salesCardPersistentKeyV232(link.type,link.date,link.location);
    if(!groups.has(key))groups.set(key,{type:link.type,date:link.date,location:link.location,links:[]});
    groups.get(key).links.push(link);
  }
  const persistent={};
  for(const [key,g] of groups){
    let ctxLinks=g.links;
    try{if(typeof pruneSalesCardFinalStatesV447==='function')pruneSalesCardFinalStatesV447(g.type,g.date,g.location,ctxLinks)}catch(_){}
    try{if(typeof captureSalesCardFinalStatesV431==='function')ctxLinks=captureSalesCardFinalStatesV431(g.type,g.date,g.location,ctxLinks)}catch(_){}
    persistent[key]={at:Date.now(),links:ctxLinks};
    g.links=ctxLinks;
  }
  // One authoritative replace. Missing cloud contexts are true deletions only
  // because the full cloud snapshot was fetched successfully above.
  writeSalesCardPersistentCacheV232(persistent);
  try{salesProductLinksCacheV216.clear()}catch(_){}
  for(const [key,g] of groups){
    try{salesProductLinksCacheV216.set(key,{links:g.links,at:Date.now(),source:'cloud-v452'})}catch(_){}
    try{if(Number(verifiedRevisionV452||0)>0&&typeof markSalesCardContextVerifiedV451==='function')markSalesCardContextVerifiedV451(g.type,g.date,g.location,Number(verifiedRevisionV452||0))}catch(_){}
  }
  // V46.0 atomic authority: card caches and every profit cache are rebuilt
  // from this exact same cloud snapshot before any visible repaint.
  rebuildProfitCachesFromAuthoritativeCardsV453(links);
  try{
    if(typeof renderSelectedDayGrandV362==='function'){['daily','fair','live'].forEach(t=>renderSelectedDayGrandV362(t));}
  }catch(_){}

  // Repaint any currently open context from the same authoritative snapshot.
  for(const type of ['daily','fair','live']){
    try{
      const cur=typeof productLinkContextV206==='function'?(productLinkContextV206(type)||{}):{};
      const key=cur.date&&String(cur.location||'').trim()?salesCardPersistentKeyV232(type,cur.date,cur.location):'';
      const dirty=typeof hasUnsavedSalesCardChangesV238==='function'&&hasUnsavedSalesCardChangesV238(type);
      if(!dirty&&key&&typeof productLinkBoxIsOpenV210==='function'&&productLinkBoxIsOpenV210(type)&&typeof renderProductLinksEditorV206==='function'){
        const ctx=groups.get(key);const ctxLinks=ctx?ctx.links:[];
        renderProductLinksEditorV206(type,ctxLinks);
        if(typeof applyCloudDraftStatusesV322==='function')applyCloudDraftStatusesV322(type,ctxLinks);
      }
    }catch(_){}
  }
  return links;
}

function syncContextLabelV456(change){
  const type=String(change&&change.type||'');const kind=String(change&&change.kind||'');const loc=String(change&&change.location||'').trim();
  // V50.2: a Fair Sales Card sync is a card operation, not a Fair turnover/location label.
  if(type==='fair'&&kind==='card')return 'Fair Sales Card';
  if(type==='fair')return loc?`Fair · ${loc}`:'Fair';
  if(type==='live')return loc?`Live · ${loc}`:'Live';
  if(type==='daily')return `${/balakong/i.test(loc)?'Balakong':'Belimbing'} Sales`;
  return '云端资料';
}
function syncChangesLabelV456(changes){const labels=[...new Set((Array.isArray(changes)?changes:[]).map(syncContextLabelV456).filter(Boolean))];return labels.length===1?labels[0]:labels.length>1?`${labels.slice(0,2).join(' / ')}${labels.length>2?' 等':''}`:'云端资料'}
async function checkCloudRevisionShared(timeoutMs = REVISION_CHECK_TIMEOUT_MS) {
  if (revisionCheckPromise) return revisionCheckPromise;
  const local=getPrioritySyncLocalV315();
  revisionCheckPromise = jsonp(
    { action: "priorityRevisionV456", lastTurnoverRevision:Number(local.turnoverRevision||0), lastSalesCardRevision:Number(local.salesCardRevision||0) },
    { timeoutMs: Number(timeoutMs || REVISION_CHECK_TIMEOUT_MS) }
  ).finally(() => { revisionCheckPromise = null; });
  return revisionCheckPromise;
}
async function syncChangedSalesCardContextsV456(changes,cloudCardRevision){
  const cards=(Array.isArray(changes)?changes:[]).filter(x=>x&&x.kind==='card'&&x.type&&x.date&&String(x.location||'').trim());
  const unique=new Map();cards.forEach(x=>unique.set([x.type,x.date,String(x.location).toLowerCase()].join('|'),x));
  if(!unique.size)return [];
  // Fetch every changed context first. Nothing local is changed until ALL reads succeed.
  const results=await Promise.all([...unique.values()].map(async c=>{
    const json=await jsonp({action:'getSalesProductLinks',type:c.type,date:c.date,location:c.location},{timeoutMs:12000});
    if(!json||!json.ok)throw new Error((json&&json.message)||'销售卡 context 读取失败');
    const links=typeof dedupeAuthoritativeSalesLinksV354==='function'?dedupeAuthoritativeSalesLinksV354(Array.isArray(json.links)?json.links:[]):(Array.isArray(json.links)?json.links:[]);
    return{...c,links};
  }));
  // Atomic local publication: card cache and profit cache move together per context.
  for(const r of results){
    // V50.2: an empty authoritative context means another device deleted the last card.
    // Remove only older local safety/cache state before publishing the empty context.
    if(!r.links.length&&typeof invalidateStaleLocalSalesCardAfterCloudDeleteV491==='function')invalidateStaleLocalSalesCardAfterCloudDeleteV491(r,cloudCardRevision);
    if(typeof setSessionSalesProductLinksV493==='function')setSessionSalesProductLinksV493(r.type,r.date,r.location,r.links);else if(typeof setCachedSalesProductLinksV216==='function')setCachedSalesProductLinksV216(r.type,r.date,r.location,r.links);
    if(typeof deferSalesCardPersistentCacheV493==='function')deferSalesCardPersistentCacheV493(r.type,r.date,r.location,r.links);
    // V46.0: the fast context response updates card + every profit authority
    // in the same synchronous commit. No second network request and no refresh needed.
    if(typeof replaceProfitAggregateContextV457==='function')replaceProfitAggregateContextV457(r.type,r.date,r.location,r.links);
    else if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(r.type,r.date,r.location,r.links);
    if(typeof markSalesCardContextVerifiedV451==='function')markSalesCardContextVerifiedV451(r.type,r.date,r.location,Number(cloudCardRevision||0));
    try{
      const cur=typeof productLinkContextV206==='function'?productLinkContextV206(r.type):null;
      const same=cur&&String(cur.date||'')===String(r.date||'')&&String(cur.location||'').trim().toLowerCase()===String(r.location||'').trim().toLowerCase();
      const dirty=typeof hasUnsavedSalesCardChangesV238==='function'&&hasUnsavedSalesCardChangesV238(r.type);
      if(same&&!dirty&&typeof productLinkBoxIsOpenV210==='function'&&productLinkBoxIsOpenV210(r.type)&&typeof renderProductLinksEditorV206==='function'){renderProductLinksEditorV206(r.type,r.links);if(typeof applyCloudDraftStatusesV322==='function')applyCloudDraftStatusesV322(r.type,r.links);}
      // V46.0: the visible Profit panel must repaint from the SAME merged day cache
      // as the card commit. Do not render with only this one location's links, and
      // do not depend solely on the in-memory "open" flag (PWA resume can lose it).
      const profitPanelV458=typeof productProfitSummaryPanelV216==='function'?productProfitSummaryPanelV216(r.type):null;
      const profitVisibleV458=!!(profitPanelV458&&!profitPanelV458.classList.contains('hidden'));
      if(typeof productProfitSelectedDateV216==='function'&&(productProfitSummaryOpenV216?.[r.type]||profitVisibleV458)&&productProfitSelectedDateV216(r.type)===r.date&&typeof renderProductProfitSummaryV216==='function'){
        const dayLinksV458=typeof getDailyProfitCacheV237==='function'?(getDailyProfitCacheV237(r.type,r.date)||[]):r.links;
        renderProductProfitSummaryV216(r.type,dayLinksV458);
      }
      if(typeof homeTodayProfitOpenV318!=='undefined'&&homeTodayProfitOpenV318&&typeof homeTodayProfitDateV318==='function'&&homeTodayProfitDateV318()===r.date&&typeof homeTodayProfitCachedLinksV318==='function'&&typeof renderHomeTodayProfitV318==='function'){
        const homeLinksV458=homeTodayProfitCachedLinksV318(r.date);if(Array.isArray(homeLinksV458))renderHomeTodayProfitV318(homeLinksV458,r.date);
      }
    }catch(_){}
  }
  return results;
}
if(typeof window!=='undefined'){window.syncContextLabelV456=syncContextLabelV456;window.syncChangesLabelV456=syncChangesLabelV456;}

// V50.2: V50.2 remains the sync authority. These helpers only consume the
// already-returned V50.2 change journal; they add no polling and no extra cloud read.
function invalidateStaleLocalSalesCardAfterCloudDeleteV491(change,cloudCardRevision){
  if(!change||String(change.kind||'')!=='card'||!change.type||!change.date||!String(change.location||'').trim())return;
  const key=typeof salesDraftPendingKeyV314==='function'?salesDraftPendingKeyV314(change.type,change.date,change.location):[change.type,change.date,String(change.location).trim().toLowerCase()].join('|');
  try{
    if(typeof readSalesDraftPendingV314==='function'&&typeof writeSalesDraftPendingV314==='function'){
      const all=readSalesDraftPendingV314()||{},pending=all[key];
      if(pending){
        const cloudAt=Number(change.at||0),localAt=Number(pending.savedAt||0),base=Number(pending.baseSalesCardRevision||0);
        // Only invalidate a safety copy proven older than this cloud deletion.
        // A truly newer offline draft is preserved exactly as in V50.2.
        const cloudIsNewer=(cloudAt>0&&localAt>0&&cloudAt>=localAt)||(Number(cloudCardRevision||0)>base&&cloudAt>0&&localAt>0&&cloudAt>=localAt-1500);
        if(cloudIsNewer){
          try{if(typeof backupSalesDraftConflictV452==='function')backupSalesDraftConflictV452(key,pending,'V50.2：云端已删除该销售卡；旧本机安全副本已停止自动回写')}catch(_){}
          delete all[key];writeSalesDraftPendingV314(all);
        }
      }
    }
  }catch(_){}
  try{if(typeof clearSalesCardPersistentCacheV232==='function')clearSalesCardPersistentCacheV232(change.type,change.date,change.location)}catch(_){}
  try{if(typeof salesProductLinksCacheV216!=='undefined')salesProductLinksCacheV216.delete(salesProductLinksCacheKeyV216(change.type,change.date,change.location))}catch(_){}
  try{if(typeof pruneSalesCardFinalStatesV447==='function')pruneSalesCardFinalStatesV447(change.type,change.date,change.location,[])}catch(_){}
  try{if(typeof invalidateSalesCardLoadRequestsV351==='function')invalidateSalesCardLoadRequestsV351(change.type)}catch(_){}
}
function autoFollowLatestFairContextV491(changes){
  try{
    const fair=(Array.isArray(changes)?changes:[]).filter(x=>x&&String(x.type||'')==='fair'&&String(x.location||'').trim());
    if(!fair.length)return false;
    // Never steal the page away from unsaved local work.
    if(typeof hasUnsavedSalesCardChangesV238==='function'&&hasUnsavedSalesCardChangesV238('fair'))return false;
    if(typeof fairInputsHaveUnsavedChanges==='function'&&fairInputsHaveUnsavedChanges())return false;
    if(typeof turnoverNewDraftDirtyV382==='function'&&turnoverNewDraftDirtyV382('fair'))return false;
    const latest=[...fair].sort((a,b)=>Number(a.at||a.revision||0)-Number(b.at||b.revision||0)).pop();
    const loc=typeof canonicalLocation==='function'?canonicalLocation(String(latest.location||'')):String(latest.location||'').trim();
    if(!loc)return false;
    const input=document.getElementById('fairLocation');if(!input)return false;
    if(typeof saveFairLocation==='function')saveFairLocation(loc);
    const session=typeof findFairSessionV320==='function'?findFairSessionV320(loc):null;
    if(session&&typeof switchFairLocationV320==='function')switchFairLocationV320(loc);
    else{
      input.value=loc;
      try{if(typeof fairSessionDraftDirtyV282!=='undefined')fairSessionDraftDirtyV282=false}catch(_){}
      try{if(typeof updateFairPageMode==='function')updateFairPageMode()}catch(_){}
      try{if(typeof syncFairInputs==='function')syncFairInputs()}catch(_){}
      try{if(typeof syncFairProductDatesV203==='function')syncFairProductDatesV203(true)}catch(_){}
      try{if(typeof renderFairMonthlyList==='function')renderFairMonthlyList()}catch(_){}
      try{if(typeof refreshProductLinkContextV210==='function')refreshProductLinkContextV210('fair')}catch(_){}
    }
    return true;
  }catch(_){return false}
}
if(typeof window!=='undefined'){window.autoFollowLatestFairContextV491=autoFollowLatestFairContextV491;window.invalidateStaleLocalSalesCardAfterCloudDeleteV491=invalidateStaleLocalSalesCardAfterCloudDeleteV491;}



async function loadMonthCloudShared(month, timeoutMs = 15000) {
  const key = /^\d{4}-\d{2}$/.test(String(month || "")) ? String(month) : new Date().toISOString().slice(0, 7);
  if (cloudLoadPromisesByMonth.has(key)) return cloudLoadPromisesByMonth.get(key);

  const request = jsonp(
    { action: "loadMonth", month: key },
    { timeoutMs: Number(timeoutMs || 15000) }
  ).finally(() => {
    if (cloudLoadPromisesByMonth.get(key) === request) cloudLoadPromisesByMonth.delete(key);
  });

  cloudLoadPromisesByMonth.set(key, request);
  return request;
}

/* V29.9: first paint must not wait for the full system render. */
let localCacheRenderedOnce = false;
let deferredFullRenderTimer = null;

function renderHomeFirst() {
  // V29.9: first paint must stay lightweight. Cloud merge performs dedupe later.
  if (typeof renderDashboard === "function") {
    renderDashboard();
  }

  if (typeof updateReadOnlyMode === "function") {
    updateReadOnlyMode();
  }
}

function scheduleDeferredFullRender(delay = 0) {
  if (deferredFullRenderTimer) return;

  const run = () => {
    deferredFullRenderTimer = null;
    if (typeof renderAll === "function") renderAll();
  };

  if (typeof requestIdleCallback === "function") {
    deferredFullRenderTimer = requestIdleCallback(run, { timeout: Math.max(300, delay + 300) });
  } else {
    deferredFullRenderTimer = setTimeout(run, Math.max(0, delay));
  }
}

function readLocalDataCacheRaw() {
  let raw = localStorage.getItem(LOCAL_DATA_CACHE_KEY);
  if (!raw) {
    for (const key of LEGACY_LOCAL_DATA_CACHE_KEYS) {
      raw = localStorage.getItem(key);
      if (raw) {
        localStorage.setItem(LOCAL_DATA_CACHE_KEY, raw);
        break;
      }
    }
  }
  return raw;
}

function loadLocalDataCache() {
  try {
    const raw = readLocalDataCacheRaw();
    if (!raw) return false;

    const cached = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.rows)) {
      localStorage.removeItem(LOCAL_DATA_CACHE_KEY);
      return false;
    }

    rows = cached.rows;
    applyLocalDataRevision(cached.dataRevision);

    if (
      cached.commissionSettings &&
      typeof applyCommissionSettings === "function"
    ) {
      applyCommissionSettings(
        cached.commissionSettings
      );
    }

    if (
      cached.accessSettings &&
      typeof applyAccessPasswordSettings === "function"
    ) {
      applyAccessPasswordSettings(
        cached.accessSettings
      );
    }

    renderHomeFirst();
    localCacheRenderedOnce = true;
    scheduleDeferredFullRender(50);
    return true;
  } catch (err) {
    // V29.9: damaged/partial cache must never trap startup.
    try { localStorage.removeItem(LOCAL_DATA_CACHE_KEY); } catch (e) {}
    rows = [];
    return false;
  }
}

function loadLocalDataCacheAsync() {
  return new Promise(resolve => {
    const run = () => {
      let loaded = false;
      try { loaded = loadLocalDataCache(); } catch (err) { loaded = false; }
      resolve(loaded);
    };
    // Give the unlocked Home and logo one paint before reading/parsing cache.
    setTimeout(run, 0);
  });
}

function saveLocalDataCache(
  commissionSettings = null,
  accessSettings = null
) {
  try {
    localStorage.setItem(
      LOCAL_DATA_CACHE_KEY,
      JSON.stringify({
        rows,
        commissionSettings:
          commissionSettings ||
          (
            typeof getCommissionSettings === "function"
              ? getCommissionSettings()
              : null
          ),
        accessSettings:
          accessSettings ||
          (
            typeof getAccessPasswordSettings === "function"
              ? getAccessPasswordSettings()
              : null
          ),
        dataRevision: getLocalDataRevision(),
        savedAt: Date.now()
      })
    );
  } catch (err) {}
}

function loadPendingRows() {
  try {
    pendingRows = JSON.parse(localStorage.getItem("lover_pending_rows") || "[]");
  } catch (err) {
    pendingRows = [];
  }
}

function savePendingRows() {
  localStorage.setItem("lover_pending_rows", JSON.stringify(pendingRows));
}

function setPendingRetrySyncStatus() {
  loadPendingRows();
  if (pendingRows.length > 0) {
    setSync(`有 ${pendingRows.length} 笔未同步资料，系统会自动重试`, false, true);
  } else {
    setSync("已同步", true);
  }
}

function addPendingRow(row) {
  const key = syncKey(row);
  const index = pendingRows.findIndex(r => syncKey(r) === key);
  if (index >= 0) pendingRows[index] = row;
  else pendingRows.push(row);
  savePendingRows();
}

// V35.0: a completed older request may only acknowledge the exact pending
// version it sent.  It must not remove a newer edit for the same Fair date.
function clearPendingRowIfVersionV343(row) {
  loadPendingRows();
  const key = syncKey(row);
  const expected = String(row && (row.clientUpdatedAt || row.updatedAt) || "");
  pendingRows = pendingRows.filter(current => {
    if (syncKey(current) !== key) return true;
    const actual = String(current.clientUpdatedAt || current.updatedAt || "");
    return Boolean(expected && actual !== expected);
  });
  savePendingRows();
}

// V35.0: a pagehide keepalive request can reach Google Sheet even though the
// browser cannot read its no-cors response.  On the next cloud load, treat an
// identical authoritative row as the acknowledgement and permanently remove
// the stale local retry item.  This prevents the same successful save from
// alternating between "已同步" and "1 笔未同步" on later opens.
function reconcilePendingRowsFromCloudV329(cloudRows) {
  loadPendingRows();
  if (!pendingRows.length || !Array.isArray(cloudRows)) return 0;
  const cloudByKey = new Map();
  cloudRows.forEach(row => cloudByKey.set(syncKey(row), row));
  const before = pendingRows.length;
  pendingRows = pendingRows.filter(pending => {
    const cloud = cloudByKey.get(syncKey(pending));
    // V35.0: a zero-amount pending row means deletion.  When the authoritative
    // cloud read no longer contains that key, the deletion is already complete.
    if (!cloud) return Number(pending.amount || 0) > 0.005;
    return Math.abs(Number(cloud.amount || 0) - Number(pending.amount || 0)) > 0.005;
  });
  if (pendingRows.length !== before) savePendingRows();
  return before - pendingRows.length;
}

// V39.9: pending rows are durable retry instructions, not proof that the cloud
// is missing data. Before retrying any write, verify every pending row against
// the authoritative month that owns that row. This removes "ghost pending"
// entries left behind when the original write reached Apps Script but the
// browser missed/aborted the acknowledgement.
function pendingRowMonthV374(row){
  const iso=typeof displayToISO==="function"?displayToISO(String(row?.date||"")):"";
  return /^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.slice(0,7):"";
}
function pendingRowMatchesCloudV374(pending,cloud){
  if(!pending)return false;
  const amount=Number(pending.amount||0);
  // A 0.00 pending mutation is a deletion. Missing authoritative row means the
  // deletion is already complete and the retry item can be discarded safely.
  if(!cloud)return amount<=0.005;
  return Math.abs(Number(cloud.amount||0)-amount)<=0.005;
}
async function reconcileAllPendingRowsFromCloudV374(options={}){
  loadPendingRows();
  if(!pendingRows.length)return {ok:true,cleared:0,remaining:0,checkedMonths:0};

  const before=pendingRows.length;
  const pendingSnapshot=[...pendingRows];
  const months=[...new Set(pendingSnapshot.map(pendingRowMonthV374).filter(Boolean))];
  const cloudMaps=new Map();
  let checkedMonths=0;

  for(const month of months){
    try{
      const json=await loadMonthCloudShared(month,Number(options.timeoutMs||12000));
      if(!json||!json.ok)continue;
      const map=new Map();
      (Array.isArray(json.rows)?json.rows:[]).forEach(row=>map.set(syncKey(row),row));
      cloudMaps.set(month,map);
      checkedMonths++;
    }catch(_){
      // Keep the pending row when the authoritative check itself is unavailable.
      // We never delete unverified local work merely to make the status green.
    }
  }

  const cloudConfirmedRows=[];
  pendingRows=pendingSnapshot.filter(pending=>{
    const month=pendingRowMonthV374(pending);
    const map=cloudMaps.get(month);
    if(!map)return true;
    const keep=!pendingRowMatchesCloudV374(pending,map.get(syncKey(pending)));
    if(!keep)cloudConfirmedRows.push({...pending,cloudRow:map.get(syncKey(pending))||null});
    return keep;
  });

  if(pendingRows.length!==before)savePendingRows();
  // Notify the turnover composer when a request that originally timed
  // out is later proven to be safely stored in the cloud. The UI can then
  // remove only the matching stale input draft and its leave-page warning.
  if(cloudConfirmedRows.length&&typeof window!=='undefined'){
    try{window.dispatchEvent(new CustomEvent('lover-sales-pending-cloud-confirmed-v439',{detail:{rows:cloudConfirmedRows}}))}catch(_){ }
  }
  return {ok:true,cleared:before-pendingRows.length,remaining:pendingRows.length,checkedMonths};
}

function syncStatusNodesV457(){
  return [
    document.getElementById("syncStatus"),
    document.getElementById("salesSyncStatusV457"),
    document.getElementById("fairSyncStatusV457"),
    document.getElementById("liveSyncStatusV457")
  ].filter(Boolean);
}
function writeSyncStatusV457(value,state){
  syncStatusNodesV457().forEach(node=>{
    node.textContent=value;
    if(node.classList.contains("context-sync-status-v457")){
      node.classList.toggle("is-good",state==="good");
      node.classList.toggle("is-error",state==="error");
    }
  });
}
function setSync(text, good = false, error = false) {
  const nodes=syncStatusNodesV457();
  if(!nodes.length)return;

  // V46.0: Home keeps the original status row. Sales/Fair/Live show the same
  // state compactly beside Company / Location / Host. Report and More show none.
  if(good&&String(text||'')==='已同步'&&typeof window!=='undefined'&&typeof window.cloudAtomicSyncPendingV448==='function'&&window.cloudAtomicSyncPendingV448()){
    writeSyncStatusV457('🟡 云端新资料同步中…','wait');
    return;
  }
  // V50.2: legacy/safety Sales Card verification never hijacks a confirmed global sync status.
  if(error){
    writeSyncStatusV457('🔴 '+text,'error');
    return;
  }
  writeSyncStatusV457((good?'🟢 ':'🟡 ')+text,good?'good':'wait');
  if(good){
    // V46.0: a confirmed sync is terminal for the current retry cycle.
    // Cancel stale retry timers so the page does not keep issuing background
    // probes / showing a refresh spinner after the UI already says 已同步.
    try{if(revisionRetryTimerV448){clearTimeout(revisionRetryTimerV448);revisionRetryTimerV448=null;}revisionRetryCountV448=0;}catch(_){}
    const last=document.getElementById("lastSync");
    if(last)last.textContent="最后同步："+nowText();
    try{localStorage.setItem("lover_sales_last_sync_at_v442",new Date().toISOString())}catch(_){}
    try{window.dispatchEvent(new CustomEvent('lover-sales-sync-complete-v458',{detail:{text:String(text||'已同步')}}))}catch(_){}
  }
}


function markCloudCheckPending(text = "本机资料已显示 · 云端后台同步中") {
  writeSyncStatusV457("🟡 "+text,"wait");
}

// V29.9: best-effort immediate cloud dispatch for mobile saves.
// The row stays in pendingRows until a normal JSONP confirmation succeeds, so
// closing/suspending the page cannot silently lose the user's entry.
function dispatchKeepalive(params) {
  try {
    const payload = {...params, _ts: Date.now()};
    const url = API_URL + "?" + new URLSearchParams(payload).toString();
    fetch(url, {method:"GET", mode:"no-cors", cache:"no-store", keepalive:true}).catch(()=>{});
    return true;
  } catch (err) {
    return false;
  }
}

function flushPendingRowsKeepalive() {
  try {
    loadPendingRows();

    const fairGroups=new Map();

    pendingRows.forEach(row => {
      const turnoverMutation=row&&row.turnoverMutation&&typeof row.turnoverMutation==='object'?row.turnoverMutation:{};
      if (row.type === "daily") {
        dispatchKeepalive({
          action:"saveDaily",
          date:row.date,
          company:row.company,
          amount:row.amount,
          clientUpdatedAt:row.clientUpdatedAt||"",
          clientDeviceId:row.clientDeviceId||"",
          clientSequence:Number(row.clientSequence||0),
          baseCloudUpdatedAt:row.baseCloudUpdatedAt||"",
          notificationAction:String(turnoverMutation.action||""),
          notificationAmount:Number(turnoverMutation.amount||0),
          notificationOldAmount:Number(turnoverMutation.oldAmount||0),
          notificationNewAmount:Number(turnoverMutation.newAmount||0),
          notificationEntryId:String(turnoverMutation.entryId||""),
          restoreGeneration:Number(row.restoreGeneration||0),
          notifyInline:"1",
          clientVersion:"24.1",
          launchUrl:getSalesLaunchUrlV194()
        });
      } else if (row.type === "live") {
        dispatchKeepalive({
          action:"saveLive",
          date:row.date,
          host:row.location,
          amount:row.amount,
          clientUpdatedAt:row.clientUpdatedAt||"",
          clientDeviceId:row.clientDeviceId||"",
          clientSequence:Number(row.clientSequence||0),
          baseCloudUpdatedAt:row.baseCloudUpdatedAt||"",
          notificationAction:String(turnoverMutation.action||""),
          notificationAmount:Number(turnoverMutation.amount||0),
          notificationOldAmount:Number(turnoverMutation.oldAmount||0),
          notificationNewAmount:Number(turnoverMutation.newAmount||0),
          notificationEntryId:String(turnoverMutation.entryId||""),
          restoreGeneration:Number(row.restoreGeneration||0),
          notifyInline:"1",
          clientVersion:"24.1",
          launchUrl:getSalesLaunchUrlV194()
        });
      } else if (row.type === "fair") {
        const loc=canonicalLocation(row.location);
        const groupKey=String(turnoverMutation.entryId||'')?loc+'|'+String(row.date||'')+'|'+String(turnoverMutation.entryId):loc;
        if(!fairGroups.has(groupKey))fairGroups.set(groupKey,{location:loc,records:[]});
        fairGroups.get(groupKey).records.push({
          date:row.date,
          amount:Number(row.amount||0),
          clientUpdatedAt:row.clientUpdatedAt||""
          ,clientDeviceId:row.clientDeviceId||""
          ,clientSequence:Number(row.clientSequence||0)
          ,baseCloudUpdatedAt:row.baseCloudUpdatedAt||""
          ,restoreGeneration:Number(row.restoreGeneration||0)
          ,notificationAction:String(turnoverMutation.action||"")
          ,notificationAmount:Number(turnoverMutation.amount||0)
          ,notificationOldAmount:Number(turnoverMutation.oldAmount||0)
          ,notificationNewAmount:Number(turnoverMutation.newAmount||0)
          ,notificationEntryId:String(turnoverMutation.entryId||"")
        });
      }
    });

    fairGroups.forEach(group=>{
      const location=group.location,records=group.records;
      dispatchKeepalive({
        action:"saveFairBatch",
        location,
        records:JSON.stringify(records),
        restoreGeneration:records.length?Number(records[0].restoreGeneration||0):getLocalRestoreGenerationV347(),
        notifyInline:"1",
        clientVersion:"24.1",
        launchUrl:getSalesLaunchUrlV194()
      });
    });
  } catch (err) {}
}

window.addEventListener("pagehide", flushPendingRowsKeepalive);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPendingRowsKeepalive();
});

function jsonp(params, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 15000);
  return new Promise((resolve, reject) => {
    const callback = "ll_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    params={...params};
    if(params.restoreGeneration===undefined)params.restoreGeneration=getLocalRestoreGenerationV347();
    params.callback = callback;
    params._ts = Date.now();

    const script = document.createElement("script");
    const query = new URLSearchParams(params).toString();

    const timer = setTimeout(() => {
      delete window[callback];
      script.remove();
      reject(new Error("连接 Google Apps Script 超时"));
    }, timeoutMs);

    window[callback] = data => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      if(data&&data.restoreGeneration!==undefined)applyRestoreGenerationV347(data.restoreGeneration);
      if(data&&data.systemState&&data.systemState.restoreGeneration!==undefined)applyRestoreGenerationV347(data.systemState.restoreGeneration);
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      reject(new Error("无法连接 Google Apps Script"));
    };

    script.async = true;
    script.defer = true;
    script.src = API_URL + "?" + query;
    (document.head || document.body || document.documentElement).appendChild(script);
  });
}

function beginSettingsWrite() {
  settingsWriteDepth += 1;
}

function endSettingsWrite() {
  settingsWriteDepth = Math.max(0, settingsWriteDepth - 1);
}

function isSettingsWriteRunning() {
  return settingsWriteDepth > 0 || !!settingsWritePromise;
}

function runSettingsWrite(task) {
  const previous = settingsWritePromise || Promise.resolve();
  beginSettingsWrite();
  const current = previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      endSettingsWrite();
      if (settingsWritePromise === current) settingsWritePromise = null;
    });
  settingsWritePromise = current;
  return current;
}

function rowMonthKey(row) {
  const iso = typeof displayToISO === "function" ? displayToISO(row && row.date) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(0, 7) : "";
}

function markLocalRowMutation(row, timestamp = Date.now()) {
  localRowMutationAt.set(syncKey(row), Number(timestamp) || Date.now());
}

function mergeCloudRowsSafely(existingRows, cloudRows, pending, requestStartedAt) {
  const protectedLocal = (existingRows || []).filter(row =>
    Number(localRowMutationAt.get(syncKey(row)) || 0) > Number(requestStartedAt || 0)
  );
  const combined = [...(cloudRows || []), ...protectedLocal, ...(pending || [])];
  return typeof dedupeRows === "function" ? dedupeRows(combined) : combined;
}

function mergeCloudMonthRows(month, cloudRows, requestStartedAt = 0) {
  const keep = rows.filter(row => rowMonthKey(row) !== month);
  const localForMonth = rows.filter(row => rowMonthKey(row) === month);
  const pendingForMonth = pendingRows.filter(row => rowMonthKey(row) === month);
  rows = [...keep, ...mergeCloudRowsSafely(localForMonth, cloudRows, pendingForMonth, requestStartedAt)];
}

function mergeCloudYearRows(year, cloudRows, requestStartedAt = 0) {
  const keep = rows.filter(row => !rowMonthKey(row).startsWith(year + "-"));
  const localForYear = rows.filter(row => rowMonthKey(row).startsWith(year + "-"));
  const pendingForYear = pendingRows.filter(row => rowMonthKey(row).startsWith(year + "-"));
  rows = [...keep, ...mergeCloudRowsSafely(localForYear, cloudRows, pendingForYear, requestStartedAt)];
}

async function loadYearInBackground(year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : new Date().getFullYear().toString();
  if (loadedCloudYears.has(y)) return { ok:true, year:y, cached:true };
  if (yearLoadPromises.has(y)) return yearLoadPromises.get(y);

  const task = (async () => {
    const requestStartedAt = Date.now();
    if (isSettingsWriteRunning()) {
      if (settingsWritePromise) await settingsWritePromise.catch(() => {});
    }

    try {
      const json = await jsonp({ action: "loadYear", year: y }, { timeoutMs: 20000 });
      if (!json.ok) throw new Error(json.message || "读取全年资料失败");
      const fairDraftDirtyBeforeCloud = typeof fairInputsHaveUnsavedChanges === "function"
        ? fairInputsHaveUnsavedChanges()
        : false;
      loadPendingRows();
      reconcilePendingRowsFromCloudV329(json.rows || []);
      mergeCloudYearRows(y, json.rows || [], requestStartedAt);
      if (json.systemState && typeof applySystemState === "function") applySystemState(json.systemState);
      if (json.commissionSettings) {
        if (typeof applyCloudCommissionSettings === "function") applyCloudCommissionSettings(json.commissionSettings);
        else if (typeof applyCommissionSettings === "function") applyCommissionSettings(json.commissionSettings);
      }
      if (json.accessSettings && typeof applyAccessPasswordSettings === "function") applyAccessPasswordSettings(json.accessSettings);
      renderHomeFirst();
      scheduleDeferredFullRender(0);
      // V29.9: if Fair is currently open, repaint its date inputs from the
      // newly merged cloud rows, unless the user has an unsaved Fair draft.
      const fairPageActive = !!document.getElementById("page-fair")?.classList.contains("active");
      if (fairPageActive && !fairDraftDirtyBeforeCloud && typeof refreshFairInputsFromRows === "function") {
        refreshFairInputsFromRows(true);
      }
      saveLocalDataCache(json.commissionSettings || null, json.accessSettings || null);
      loadedCloudYears.add(y);
      setSync("已同步", true);
      return { ok:true, year:y, rows:(json.rows || []).length };
    } catch (err) {
      console.warn("Full-year background refresh failed", err);
      return { ok:false, year:y, error:err };
    }
  })().finally(() => {
    yearLoadPromises.delete(y);
  });

  yearLoadPromises.set(y, task);
  return task;
}

function getActiveCloudLoadPromise() {
  return cloudLoadPromise;
}

function isInitialCloudSyncFinished() {
  return initialCloudSyncFinished;
}

function waitForInitialCloudSync() {
  return initialCloudSyncPromise || cloudLoadPromise || Promise.resolve();
}

function salesSyncDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function yieldAuthoritativeUiV495(){
  return new Promise(resolve=>{
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>resolve());
    else setTimeout(resolve,0);
  });
}

function scheduleRevisionRetryV448(){
  // V46.0: never give up after only three probes. A 2.5s probe could expire
  // during an Apps Script cold start, leaving the device stuck at “后台检查中”
  // until the user manually refreshed. Keep retrying with a capped backoff.
  if(revisionRetryTimerV448)return;
  const waits=[1200,3000,7000,15000,30000];
  const delay=waits[Math.min(revisionRetryCountV448,waits.length-1)];
  revisionRetryTimerV448=setTimeout(()=>{
    revisionRetryTimerV448=null;
    if(typeof document!=='undefined'&&document.hidden){scheduleRevisionRetryV448();return;}
    // V50.2: never start a retry on top of a live sync/probe. Let the current
    // single-flight request finish, then the next interval/manual/resume can probe.
    if(cloudLoadPromise){scheduleRevisionRetryV448();return;}
    revisionRetryCountV448+=1;
    loadFromSheet({
      bypassCooldown:true,
      suppressStartStatus:true,
      silent:false,
      revisionTimeoutMs:REVISION_CHECK_TIMEOUT_MS
    }).catch(()=>{});
  },delay);
}

function retryRevisionNowV455(){
  if(revisionRetryTimerV448){clearTimeout(revisionRetryTimerV448);revisionRetryTimerV448=null;}
  // V50.2: update.js owns foreground/resume probes. This helper is kept for
  // network-online recovery only, and it never overlaps an active cloud load.
  if(cloudLoadPromise){scheduleRevisionRetryV448();return;}
  loadFromSheet({bypassCooldown:true,suppressStartStatus:true,silent:false,revisionTimeoutMs:REVISION_CHECK_TIMEOUT_MS}).catch(()=>scheduleRevisionRetryV448());
}
if(typeof window!=='undefined')window.addEventListener('online',()=>setTimeout(retryRevisionNowV455,120));

async function tryFastVisibleTurnoverFallbackV516(){
  try{
    if(typeof window==='undefined'||typeof window.fastSyncVisibleTurnoverContextV516!=='function')return null;
    return await window.fastSyncVisibleTurnoverContextV516();
  }catch(_){return null;}
}

async function loadFromSheet(options = {}) {
  if (settingsWritePromise) {
    await settingsWritePromise.catch(() => {});
  }
  const force = options.force === true;
  const silent = options.silent === true;
  const suppressStartStatus = options.suppressStartStatus === true;
  const statusText = String(options.statusText || "").trim();
  const now = Date.now();
  if (cloudLoadPromise) return cloudLoadPromise;
  if (!force && options.bypassCooldown !== true && now - lastCloudLoadAt < CLOUD_LOAD_COOLDOWN_MS) {
    return initialCloudSyncPromise || Promise.resolve({ ok:true, skipped:true, cooldown:true });
  }
  lastCloudLoadAt = now;

  let completedSuccessfully = false;
  cloudLoadPromise = (async () => {
    setCloudRevisionConfirmedV449(false);
    loadPendingRows();
    const pendingCountAtStart = pendingRows.length;

    const hasLocalData = rows.length > 0
      ? true
      : loadLocalDataCache();
    if (!silent && !suppressStartStatus) {
      setSync(statusText || (hasLocalData ? "本机资料已显示 · 云端后台同步中" : "正在读取本月云端资料"));
    }

    let cloudChangedV448=false;
    let syncLabelV456='';
    try {
      const requestedMonth = /^\d{4}-\d{2}$/.test(String(options.month || ""))
        ? String(options.month)
        : "";
      const month = requestedMonth ||
        ((typeof selectedMonth === "function" && selectedMonth()) || new Date().toISOString().slice(0, 7));

      // V46.0 Global Revision Gate:
      // One tiny request detects ANY successful cloud write (turnover, Sales Card,
      // Fair/Live, commissions/settings, confirmation/Import ACK, restore, etc.).
      // If the global Revision is unchanged, Local First is already authoritative
      // and startup/resume returns immediately without downloading month data or
      // re-checking every Sales Card. Only a changed Revision enters the heavier
      // selective refresh path below.
      let salesCardRevisionChangedV444=false;
      let observedPriorityRevisionV447=null;
      let prefetchedMonthJsonV448=null;
      let prefetchedAllSalesCardsV449=null;
      let deltaChangesForUiV491=[];
      if (!force && hasLocalData && options.skipRevisionCheck !== true) {
        try {
          const rev = await checkCloudRevisionShared(Number(options.revisionTimeoutMs || REVISION_CHECK_TIMEOUT_MS));
          if (rev && rev.ok) {
            revisionRetryCountV448=0;
            if(revisionRetryTimerV448){clearTimeout(revisionRetryTimerV448);revisionRetryTimerV448=null;}
            const cloudGlobal=Number(rev.dataRevision||0);
            const localGlobal=Number(getLocalDataRevision()||0);
            const localPr=getPrioritySyncLocalV315();
            const cloudTurn=Number(rev.turnoverRevision||0);
            const cloudCard=Number(rev.salesCardRevision||0);
            const localTurn=Number(localPr.turnoverRevision||0);
            const localCard=Number(localPr.salesCardRevision||0);
            salesCardRevisionChangedV444=cloudCard!==localCard;
            observedPriorityRevisionV447={turnoverRevision:cloudTurn,salesCardRevision:cloudCard,at:Date.now()};

            // V46.0: never clear a valid Local First card merely because a newer
            // revision was observed. Keep the old complete snapshot visible until
            // month data + selected Sales/Fair/Live card contexts are all fetched.
            if(cloudGlobal===localGlobal&&cloudTurn===localTurn&&!salesCardRevisionChangedV444&&pendingCountAtStart===0){
              setCloudAtomicSyncPendingV448(false);
              if(observedPriorityRevisionV447)setPrioritySyncLocalV315(observedPriorityRevisionV447);
              setCloudRevisionConfirmedV449(true);
              setSync("已同步", true);
              completedSuccessfully = true;
              return {
                ok:true,month,globalRevisionOnly:true,dataRevision:cloudGlobal,
                turnoverRevision:cloudTurn,salesCardRevision:cloudCard
              };
            }

            // Any cloud write advanced Global Revision. Fetch all pieces needed for
            // the visible business state in parallel, but commit none of them until
            // every request succeeds. This is both faster than serial card checks and
            // prevents profit from becoming new while Sales Card stays old/blank.
            cloudChangedV448=(cloudGlobal!==localGlobal)||(cloudTurn!==localTurn)||salesCardRevisionChangedV444;
            if(cloudChangedV448){
              setCloudAtomicSyncPendingV448(true);
              if(!silent)setSync('发现云端新资料 · 正在完整同步');
              const deltaChangesV456=Array.isArray(rev.changes)?rev.changes:[];
              deltaChangesForUiV491=deltaChangesV456;
              syncLabelV456=syncChangesLabelV456(deltaChangesV456);
              if(salesCardRevisionChangedV444&&changedCardTouchesDirtyContextV456(deltaChangesV456)){
                throw new Error('当前正在编辑的这张销售卡已有其他设备的新版本；已保护本机未保存内容，请先处理冲突。');
              }
              // V46.0: Sales Card uses the SAME fast cloud path as profit.
              // Card-only changes no longer wait for month rows. If turnover/settings
              // also changed, both requests run in parallel and nothing is published
              // until every required piece succeeds.
              const deltaCompleteV456=rev.deltaComplete===true;
              const needsMonthRefreshV454=(cloudTurn!==localTurn)||(!salesCardRevisionChangedV444&&cloudGlobal!==localGlobal);
              if(!silent)setSync(`${syncChangesLabelV456(deltaChangesV456)} 同步中…`);
              const canContextDeltaV456=salesCardRevisionChangedV444&&deltaCompleteV456&&deltaChangesV456.some(x=>x&&x.kind==='card');
              const cardPromiseV454=salesCardRevisionChangedV444?(canContextDeltaV456?syncChangedSalesCardContextsV456(deltaChangesV456,cloudCard):fetchAllSalesCardsAtomicV449(Number(options.cardTimeoutMs||15000))):Promise.resolve(null);
              const monthPromiseV454=needsMonthRefreshV454?loadMonthCloudShared(month,Number(options.timeoutMs||15000)):Promise.resolve(null);
              // V51.0: turnover total + TurnoverEntries are published under the same
              // revision. If the visible context is touched, fetch that tiny detail row
              // in parallel with the month so total/detail paint together.
              const turnoverDetailPromiseV509=(cloudTurn!==localTurn&&typeof window.syncTurnoverDetailsForChangesV509==='function')?window.syncTurnoverDetailsForChangesV509(deltaChangesV456):Promise.resolve(null);
              const pairV454=await Promise.all([cardPromiseV454,monthPromiseV454,turnoverDetailPromiseV509]);
              if(canContextDeltaV456){
                prefetchedAllSalesCardsV449=null;
              }else{
                prefetchedAllSalesCardsV449=pairV454[0];
                if(salesCardRevisionChangedV444&&!Array.isArray(prefetchedAllSalesCardsV449))throw new Error('云端销售卡快照读取失败');
              }
              prefetchedMonthJsonV448=pairV454[1];
              if(needsMonthRefreshV454&&(!prefetchedMonthJsonV448||!prefetchedMonthJsonV448.ok))throw new Error((prefetchedMonthJsonV448&&prefetchedMonthJsonV448.message)||'云端营业资料读取失败');
              if(salesCardRevisionChangedV444&&!needsMonthRefreshV454){
                if(!canContextDeltaV456)commitAllSalesCardsAtomicV449(prefetchedAllSalesCardsV449||[],cloudCard);
                applyLocalDataRevision(cloudGlobal);
                setPrioritySyncLocalV315(observedPriorityRevisionV447);
                setCloudAtomicSyncPendingV448(false);
                setCloudRevisionConfirmedV449(true);
                try{renderHomeFirst();scheduleDeferredFullRender(0)}catch(_){}
                try{if(typeof autoFollowLatestFairContextV491==='function')autoFollowLatestFairContextV491(deltaChangesV456)}catch(_){}
                // V50.2: status follows the authoritative card paint, not the ACK.
                await yieldAuthoritativeUiV495();
                setSync(`${syncChangesLabelV456(deltaChangesV456)} 已同步`,true);
                completedSuccessfully=true;
                return {ok:true,month,cardOnlySync:true,dataRevision:cloudGlobal,turnoverRevision:cloudTurn,salesCardRevision:cloudCard};
              }
            }
          } else {
            const fastTurnoverV516=await tryFastVisibleTurnoverFallbackV516();
            if(fastTurnoverV516)setSync(fastTurnoverV516.updated?"营业额已同步":"当前营业额已确认 · 后台检查其他资料",true,false);
            else setSync("上次同步资料已保留 · 后台检查中", true, false);
            scheduleRevisionRetryV448();
            completedSuccessfully = true;
            return {ok:true,month,revisionUnconfirmed:true,fastTurnoverV516};
          }
        } catch (revisionError) {
          // Do not replace valid Local First data with a false red failure when
          // only the tiny Revision probe is temporarily slow. Resume/interval/
          // manual refresh will retry this lightweight check.
          const fastTurnoverV516=await tryFastVisibleTurnoverFallbackV516();
          if(fastTurnoverV516)setSync(fastTurnoverV516.updated?"营业额已同步":"当前营业额已确认 · 后台检查其他资料",true,false);
          else setSync("上次同步资料已保留 · 后台检查中", true, false);
          scheduleRevisionRetryV448();
          completedSuccessfully = true;
          return {ok:true,month,revisionUnconfirmed:true,error:revisionError,fastTurnoverV516};
        }
      }
      let json = prefetchedMonthJsonV448;
      let lastError = null;
      const requestStartedAt = Date.now();

      for (let attempt = 1; !json && attempt <= 2; attempt += 1) {
        try {
          json = await loadMonthCloudShared(month, Number(options.timeoutMs || 15000));
          if (!json || !json.ok) throw new Error((json && json.message) || "读取失败");
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (attempt === 1) {
            if (!silent) setSync("首次连接较慢，正在重新连接云端...");
            await salesSyncDelay(1200);
          }
        }
      }

      if (lastError) throw lastError;

      const fairDraftDirtyBeforeCloud = typeof fairInputsHaveUnsavedChanges === "function"
        ? fairInputsHaveUnsavedChanges()
        : false;
      loadPendingRows();
      reconcilePendingRowsFromCloudV329(json.rows || []);
      // V46.0 CARD + PROFIT ATOMIC COMMIT:
      // When Sales Card changed, commit the authoritative card snapshot AND the
      // profit caches derived from that same snapshot first. Only then merge the
      // turnover/month rows. No render occurs between these synchronous steps, so
      // the UI can never publish new profit with an old card (or vice versa).
      if(cloudChangedV448&&salesCardRevisionChangedV444&&Array.isArray(prefetchedAllSalesCardsV449)){
        // Full-snapshot fallback only. Delta contexts were already published
        // atomically and must never be replaced by an empty placeholder.
        commitAllSalesCardsAtomicV449(prefetchedAllSalesCardsV449,Number(observedPriorityRevisionV447?.salesCardRevision||0));
      }
      mergeCloudMonthRows(month, json.rows || [], requestStartedAt);
      applyLocalDataRevision(json.dataRevision);
      if (json.systemState && typeof applySystemState === "function") applySystemState(json.systemState);
      if (json.commissionSettings) {
        if (typeof applyCloudCommissionSettings === "function") applyCloudCommissionSettings(json.commissionSettings);
        else if (typeof applyCommissionSettings === "function") applyCommissionSettings(json.commissionSettings);
      }
      if (json.accessSettings && typeof applyAccessPasswordSettings === "function") applyAccessPasswordSettings(json.accessSettings);

      renderHomeFirst();
      scheduleDeferredFullRender(0);
      // V29.9: keep Fair's visible daily amount inputs consistent with rows after
      // cloud refresh. Do not overwrite any unsaved Fair edits.
      const fairPageActive = !!document.getElementById("page-fair")?.classList.contains("active");
      if (typeof refreshFairInputsFromRows === "function" && !fairDraftDirtyBeforeCloud && (fairPageActive || options.refreshFairInputs === true)) {
        refreshFairInputsFromRows(true);
      }
      saveLocalDataCache(json.commissionSettings || null, json.accessSettings || null);
      // V50.2: Fair session/history registry is secondary metadata. Do not block
      // turnover/Sales Card authoritative sync completion on this extra request.
      // The change journal already contains the latest Fair context for auto-follow.
      try{if(typeof autoFollowLatestFairContextV491==='function')autoFollowLatestFairContextV491(deltaChangesForUiV491)}catch(_){}
      if(typeof refreshFairSessionsV281==="function")Promise.resolve(refreshFairSessionsV281({applyLatest:false,forceApply:false})).catch(()=>{});

      // V39.9: verify durable pending rows against their own authoritative
      // month BEFORE retrying writes. If the cloud already contains the exact
      // amount (or a requested deletion is already absent), the pending item is
      // an acknowledgement residue and is permanently removed without another
      // upload. Only genuinely unmatched work proceeds to syncPendingRows().
      loadPendingRows();
      if (pendingRows.length > 0) {
        setSync(`正在确认 ${pendingRows.length} 笔待同步资料...`);
        await reconcileAllPendingRowsFromCloudV374({timeoutMs:12000});
        loadPendingRows();
      }
      if (pendingRows.length > 0) {
        setSync(`正在自动同步 ${pendingRows.length} 笔资料...`);
        await syncPendingRows();
        loadPendingRows();
      }
      if (pendingRows.length > 0) setPendingRetrySyncStatus();
      else {
        if(observedPriorityRevisionV447)setPrioritySyncLocalV315(observedPriorityRevisionV447);
        setCloudAtomicSyncPendingV448(false);
        setCloudRevisionConfirmedV449(true);
        // V50.2: do not advertise “已同步” until the authoritative rows/cards
        // have been committed and the current UI has had a chance to paint them.
        await yieldAuthoritativeUiV495();
        setSync(syncLabelV456?`${syncLabelV456} 已同步`:"已同步", true);
      }
      completedSuccessfully = true;

      const year = month.slice(0, 4);

      // V29.9 mobile performance: startup loads only the selected month.
      // Full-year data is requested only when the user opens Monthly Summary.
      if (options.loadYear === true) {
        setTimeout(() => {
          loadYearInBackground(year).catch(() => {});
        }, 1400);
      }

      return { ok:true, month, refreshedAt:Date.now() };
    } catch (err) {
      setCloudRevisionConfirmedV449(false);
      if (!silent) {
        if(cloudChangedV448){
          setCloudAtomicSyncPendingV448(true);
          setSync("发现云端新资料 · 完整同步未完成，请重试", false, true);
        }else{
          setSync(hasLocalData ? "已显示本机资料，云端稍后重试" : "同步失败：" + err.message, false, true);
        }
      }
      return { ok:false, error:err };
    }
  })();

  if (!initialCloudSyncPromise) initialCloudSyncPromise = cloudLoadPromise;

  try {
    return await cloudLoadPromise;
  } finally {
    cloudLoadPromise = null;
    if (!initialCloudSyncFinished) {
      initialCloudSyncFinished = true;
      window.dispatchEvent(new CustomEvent("lover-sales-initial-sync-complete", {
        detail: { success: completedSuccessfully }
      }));
    }
  }
}

async function syncPendingRows() {
  if (pendingSyncRunning) return;
  pendingSyncRunning = true;

  try {
    loadPendingRows();

    if (pendingRows.length === 0) {
      if (initialCloudSyncFinished && !cloudLoadPromise) {
        setSync("已同步", true);
      }
      return;
    }

    // V39.9: every retry path (startup, timer, focus, manual recovery) first
    // checks whether another request/device already committed this mutation.
    // This keeps successful writes from being uploaded again on every open.
    setSync(`正在确认 ${pendingRows.length} 笔待同步资料...`);
    await reconcileAllPendingRowsFromCloudV374({timeoutMs:12000});
    loadPendingRows();
    if (pendingRows.length === 0) {
      setSync("已同步", true);
      return;
    }

    setSync(`正在自动同步 ${pendingRows.length} 笔资料...`);

    const dailyRows = pendingRows.filter(r => r.type === "daily");
    const fairRows = pendingRows.filter(r => r.type === "fair");
    const liveRows = pendingRows.filter(r => r.type === "live");

    for (const row of dailyRows) {
      const turnoverMutation=row&&row.turnoverMutation&&typeof row.turnoverMutation==='object'?row.turnoverMutation:{};
      const saved = await saveDailyToSheet(
        row.date,
        row.company,
        row.amount,
        row.clientUpdatedAt || "",
        row.clientDeviceId||"",
        Number(row.clientSequence||0)
        ,row.baseCloudUpdatedAt||"",false,Number(row.restoreGeneration||0),turnoverMutation,null
      );
      if (saved) upsertLocalRow(saved);
      clearPendingRowIfVersionV343(row);
    }

    const fairGroups = new Map();

    fairRows.forEach(row => {
      const turnoverMutation=row&&row.turnoverMutation&&typeof row.turnoverMutation==='object'?row.turnoverMutation:{};
      const loc = canonicalLocation(row.location);
      const groupKey=String(turnoverMutation.entryId||'')?loc+'|'+String(row.date||'')+'|'+String(turnoverMutation.entryId):loc;
      if (!fairGroups.has(groupKey)) fairGroups.set(groupKey, {location:loc,records:[]});
      fairGroups.get(groupKey).records.push({
        date: row.date,
        amount: Number(row.amount || 0),
        clientUpdatedAt: row.clientUpdatedAt || ""
        ,clientDeviceId:row.clientDeviceId||""
        ,clientSequence:Number(row.clientSequence||0)
        ,baseCloudUpdatedAt:row.baseCloudUpdatedAt||""
        ,restoreGeneration:Number(row.restoreGeneration||0)
        ,notificationAction:String(turnoverMutation.action||"")
        ,notificationAmount:Number(turnoverMutation.amount||0)
        ,notificationOldAmount:Number(turnoverMutation.oldAmount||0)
        ,notificationNewAmount:Number(turnoverMutation.newAmount||0)
        ,notificationEntryId:String(turnoverMutation.entryId||"")
      });
    });

    for (const row of liveRows) {
      const turnoverMutation=row&&row.turnoverMutation&&typeof row.turnoverMutation==='object'?row.turnoverMutation:{};
      const saved = await saveLiveToSheet(
        row.date,
        row.location,
        row.amount,
        row.clientUpdatedAt || "",
        row.clientDeviceId||"",
        Number(row.clientSequence||0)
        ,row.baseCloudUpdatedAt||"",false,Number(row.restoreGeneration||0),turnoverMutation,null
      );
      if (saved && Number(saved.amount) > 0) upsertLocalRow(saved);
      else rows = rows.filter(x => syncKey(x) !== syncKey(row));
      clearPendingRowIfVersionV343(row);
    }

    for (const group of fairGroups.values()) {
      const location=group.location,records=group.records;
      const result = await saveFairBatchToSheet(location, records);

      if (result && Array.isArray(result.rows)) {
        result.rows.forEach(r => {
          if (Number(r.amount) <= 0) {
            rows = rows.filter(x => syncKey(x) !== syncKey(r));
          } else {
            upsertLocalRow(r);
          }
        });
      }

      records.forEach(item => {
        clearPendingRowIfVersionV343({
          type: "fair",
          date: item.date,
          company: "fair",
          location,
          clientUpdatedAt:item.clientUpdatedAt||"",
          clientDeviceId:item.clientDeviceId||"",
          clientSequence:Number(item.clientSequence||0)
        });
      });
    }

    renderAll();
    saveLocalDataCache();
    loadPendingRows();
    if(pendingRows.length>0)setPendingRetrySyncStatus();
    else setSync("已同步", true);
  } catch (err) {
    setPendingRetrySyncStatus();
  } finally {
    pendingSyncRunning = false;
  }
}

async function saveSalesProductLinkV203(payload) {
  const safePayload={...(payload||{})};
  if(!String(safePayload.linkId||'').trim()){
    const tx=String(safePayload.transactionId||'').trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80),order=Math.max(1,Number(safePayload.productOrder||1));
    safePayload.linkId=tx?('spl_v514_'+tx+'_'+order):('spl_v514_'+Date.now()+'_'+Math.random().toString(36).slice(2,10));
    if(payload&&typeof payload==='object')payload.linkId=safePayload.linkId;
  }
  const json = await jsonp({
    action: "saveSalesProductLink",
    ...safePayload
  }, { timeoutMs: 20000 });
  if (!json.ok) throw new Error(json.message || "盆栽资料保存失败");
  if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
  if(json.salesCardRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,salesCardRevision:Number(json.salesCardRevision||0),at:Date.now()})}
  return json.link || null;
}

async function loadPendingInventorySalesCardsV250() {
  const json = await jsonp({ action:"getPendingInventorySalesCardsV250", _:Date.now() }, { timeoutMs:10000 });
  if (!json.ok) throw new Error(json.message || "读取库存待处理记录失败");
  return Array.isArray(json.items) ? json.items : [];
}

async function loadSalesInventoryAckStatusV408(linkIds){
  const ids=[...new Set((Array.isArray(linkIds)?linkIds:[]).map(String).filter(Boolean))];
  if(!ids.length)return [];
  const json=await jsonp({action:"getSalesInventoryAckStatusV408",linkIdsJson:JSON.stringify(ids),_:Date.now()},{timeoutMs:10000});
  if(!json.ok)throw new Error(json.message||"ACK 状态读取失败");
  return Array.isArray(json.items)?json.items:[];
}
window.loadSalesInventoryAckStatusV408=loadSalesInventoryAckStatusV408;

async function confirmSalesCardInventoryV249(payload) {
  const json = await jsonp({ action:"confirmSalesCardInventoryV249", ...payload }, { timeoutMs:20000 });
  if (!json.ok) throw new Error(json.message || "库存确认状态保存失败");
  return json;
}

async function saveSalesProductLinksV206(items, saveMode="confirm", restoreGeneration=getLocalRestoreGenerationV347(), clientDeviceId="", clientSequence=0, deletedLinkIds=[], expectedSalesCardRevisionOverrideV452=undefined) {
  const priorityV450=getPrioritySyncLocalV315();
  const hasOverrideV452=expectedSalesCardRevisionOverrideV452!==undefined&&expectedSalesCardRevisionOverrideV452!==null&&String(expectedSalesCardRevisionOverrideV452)!=='';
  const hasExpectedV450=hasOverrideV452||Object.prototype.hasOwnProperty.call(priorityV450||{},'salesCardRevision');
  const expectedSalesCardRevisionV450=hasOverrideV452?Number(expectedSalesCardRevisionOverrideV452||0):(hasExpectedV450?Number(priorityV450.salesCardRevision||0):'');
  const json = await jsonp({ action:"saveSalesProductLinks", itemsJson:JSON.stringify(items||[]), deletedLinkIdsJson:JSON.stringify(Array.isArray(deletedLinkIds)?deletedLinkIds:[]), saveMode:String(saveMode||"confirm"), restoreGeneration, clientDeviceId, clientSequence, expectedSalesCardRevision:expectedSalesCardRevisionV450 }, { timeoutMs:30000 });
  if (!json.ok) throw new Error(json.message || "盆栽资料保存失败");
  if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
  if(json.salesCardRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,salesCardRevision:Number(json.salesCardRevision||0),at:Date.now()})}
  const first=Array.isArray(items)&&items.length?items[0]:null;
  if(first&&first.type&&first.date&&first.location){
    if(json.salesCardRevision!==undefined)markSalesCardContextVerifiedV451(first.type,first.date,first.location,Number(json.salesCardRevision||0));
    mergeDailyProfitContextCacheV237(first.type,first.date,first.location,Array.isArray(json.links)?json.links:items);
  }
  try{saveLocalDataCache()}catch(_){}
  return json;
}



/* ================= V29.9 Profit / Change Log persistent cache ================= */
const PROFIT_CACHE_KEY_V237="lover_daily_profit_cache_v237";
const CHANGE_LOG_CACHE_KEY_V237="lover_sales_change_log_cache_v237";
const VIEW_CACHE_MAX_AGE_V237=30*24*60*60*1000;

function readViewCacheMapV237(key){
  try{
    const raw=localStorage.getItem(key);
    const obj=raw?JSON.parse(raw):{};
    return obj&&typeof obj==="object"?obj:{};
  }catch(e){return{}}
}
function writeViewCacheMapV237(key,obj){
  try{localStorage.setItem(key,JSON.stringify(obj||{}))}catch(e){}
}
function viewCacheKeyV237(type,date){
  return [String(type||""),String(date||"")].join("|");
}
function getDailyProfitCacheV237(type,date){
  const all=readViewCacheMapV237(PROFIT_CACHE_KEY_V237),rec=all[viewCacheKeyV237(type,date)];
  if(!rec||!Array.isArray(rec.links))return null;
  if(rec.at&&Date.now()-Number(rec.at)>VIEW_CACHE_MAX_AGE_V237)return null;
  return typeof dedupeAuthoritativeSalesLinksV354==="function"?dedupeAuthoritativeSalesLinksV354(rec.links):rec.links;
}
function setDailyProfitCacheV237(type,date,links){
  const all=readViewCacheMapV237(PROFIT_CACHE_KEY_V237);
  all[viewCacheKeyV237(type,date)]={at:Date.now(),links:typeof dedupeAuthoritativeSalesLinksV354==="function"?dedupeAuthoritativeSalesLinksV354(links):Array.isArray(links)?links:[]};
  writeViewCacheMapV237(PROFIT_CACHE_KEY_V237,all);
}
function mergeDailyProfitContextCacheV237(type,date,location,links){
  const current=getDailyProfitCacheV237(type,date)||[];
  const key=String(location||"").trim().toLowerCase();
  const merged=current.filter(x=>String(x.location||"").trim().toLowerCase()!==key)
    .concat(Array.isArray(links)?links:[]);
  setDailyProfitCacheV237(type,date,merged);
}
function clearDailyProfitCacheV237(type,date){
  const all=readViewCacheMapV237(PROFIT_CACHE_KEY_V237);
  if(type&&date)delete all[viewCacheKeyV237(type,date)];
  else Object.keys(all).forEach(k=>delete all[k]);
  writeViewCacheMapV237(PROFIT_CACHE_KEY_V237,all);
}
function getSalesChangeLogCacheV237(type,date){
  const all=readViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237),rec=all[viewCacheKeyV237(type,date)];
  if(!rec||!Array.isArray(rec.logs))return null;
  if(rec.at&&Date.now()-Number(rec.at)>VIEW_CACHE_MAX_AGE_V237)return null;
  return rec.logs;
}
function setSalesChangeLogCacheV237(type,date,logs){
  const all=readViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237);
  all[viewCacheKeyV237(type,date)]={at:Date.now(),logs:Array.isArray(logs)?logs:[]};
  writeViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237,all);
}
function clearSalesChangeLogCacheV237(type,date){
  const all=readViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237);
  if(type&&date)delete all[viewCacheKeyV237(type,date)];
  else Object.keys(all).forEach(k=>delete all[k]);
  writeViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237,all);
}

const SALES_CARD_PERSIST_CACHE_KEY_V232="lover_sales_card_links_cache_v232";
const SALES_CARD_PERSIST_CACHE_MAX_AGE_V232=0; // V46.0: local cache stays instant until the global Sales Card revision proves another device changed cards.

function readSalesCardPersistentCacheV232(){
  try{
    const raw=localStorage.getItem(SALES_CARD_PERSIST_CACHE_KEY_V232);
    const obj=raw?JSON.parse(raw):{};
    return obj&&typeof obj==="object"?obj:{};
  }catch(e){ return {}; }
}
function writeSalesCardPersistentCacheV232(obj){
  try{ localStorage.setItem(SALES_CARD_PERSIST_CACHE_KEY_V232,JSON.stringify(obj||{})); }catch(e){}
}
function salesCardPersistentKeyV232(type,date,location){
  return [String(type||""),String(date||""),String(location||"").trim().toLowerCase()].join("|");
}
function getSalesCardPersistentCacheV232(type,date,location){
  const all=readSalesCardPersistentCacheV232();
  const rec=all[salesCardPersistentKeyV232(type,date,location)];
  if(!rec||!Array.isArray(rec.links))return null;
  return rec.links;
}
function setSalesCardPersistentCacheV232(type,date,location,links){
  const all=readSalesCardPersistentCacheV232();
  all[salesCardPersistentKeyV232(type,date,location)]={at:Date.now(),links:Array.isArray(links)?links:[]};
  writeSalesCardPersistentCacheV232(all);
}
function clearSalesCardPersistentCacheV232(type,date,location){
  const all=readSalesCardPersistentCacheV232();
  if(type&&date&&location)delete all[salesCardPersistentKeyV232(type,date,location)];
  else Object.keys(all).forEach(k=>delete all[k]);
  writeSalesCardPersistentCacheV232(all);
}

// V36.0: one authoritative active row per Sales Card product slot.
// Cloud/Restore history can contain legacy active duplicates with different Link IDs;
// the latest transactionId + productOrder row wins so Sales Card and Profit use
// exactly the same authoritative set and can never count one product twice.
function dedupeAuthoritativeSalesLinksV354(links){
  const map=new Map();
  (Array.isArray(links)?links:[]).forEach((x,index)=>{
    if(!x||["deleted","cancelled"].includes(String(x.status||"active").toLowerCase()))return;
    const tx=String(x.transactionId||x.saleId||"").trim();
    const order=Math.max(1,Number(x.productOrder||1));
    const loc=String(x.location||"").trim().toLowerCase();
    const key=tx?[String(x.type||""),String(x.date||""),loc,tx,String(order)].join("|"):(String(x.linkId||"").trim()||[String(x.type||""),String(x.date||""),loc,String(x.productId||x.productName||""),String(order)].join("|"));
    const prev=map.get(key);
    if(!prev){map.set(key,{x,index});return}
    const a=Date.parse(String(prev.x.updatedAt||prev.x.createdAt||""))||0,b=Date.parse(String(x.updatedAt||x.createdAt||""))||0;
    if(b>a||(b===a&&index>prev.index))map.set(key,{x,index});
  });
  return [...map.values()].sort((a,b)=>a.index-b.index).map(v=>v.x);
}
window.dedupeAuthoritativeSalesLinksV354=dedupeAuthoritativeSalesLinksV354;

const salesProductLinksCacheV216 = new Map();
const salesProductLinksPendingV216 = new Map();
function salesProductLinksCacheKeyV216(type,date,location){
  return [String(type||""),String(date||""),String(location||"").trim().toLowerCase()].join("|");
}
function getCachedSalesProductLinksV216(type,date,location){
  const key=salesProductLinksCacheKeyV216(type,date,location);
  const rec=salesProductLinksCacheV216.get(key);
  if(rec)return rec.links;
  const persistent=getSalesCardPersistentCacheV232(type,date,location);
  if(Array.isArray(persistent)){
    salesProductLinksCacheV216.set(key,{links:persistent,at:Date.now(),source:"persistent"});
    return persistent;
  }
  return null;
}
function getSessionSalesProductLinksCacheV244(type,date,location){
  const rec=salesProductLinksCacheV216.get(salesProductLinksCacheKeyV216(type,date,location));
  if(!rec||rec.source==="persistent")return null;
  return Array.isArray(rec.links)?rec.links:null;
}
function setCachedSalesProductLinksV216(type,date,location,links){
  const safe=typeof dedupeAuthoritativeSalesLinksV354==="function"?dedupeAuthoritativeSalesLinksV354(links):(Array.isArray(links)?links:[]);
  salesProductLinksCacheV216.set(salesProductLinksCacheKeyV216(type,date,location),{links:safe,at:Date.now(),source:"session"});
  setSalesCardPersistentCacheV232(type,date,location,safe);
  return safe;
}
// V50.2: changed-card sync publishes the authoritative card to memory immediately,
// then persists it after the visible sync commit. This keeps the V49.1/V48.8
// main sync path light while still refreshing the full card snapshot for later opens.
function setSessionSalesProductLinksV493(type,date,location,links){
  const safe=typeof dedupeAuthoritativeSalesLinksV354==="function"?dedupeAuthoritativeSalesLinksV354(links):(Array.isArray(links)?links:[]);
  salesProductLinksCacheV216.set(salesProductLinksCacheKeyV216(type,date,location),{links:safe,at:Date.now(),source:"session-v493"});
  return safe;
}
function deferSalesCardPersistentCacheV493(type,date,location,links){
  const safe=Array.isArray(links)?links:[];
  setTimeout(()=>{try{setSalesCardPersistentCacheV232(type,date,location,safe)}catch(_){}},80);
}
async function loadSalesProductLinksV206(type,date,location,options={}) {
  const key=salesProductLinksCacheKeyV216(type,date,location);
  const cached=salesProductLinksCacheV216.get(key);
  const maxAge=Number(options.maxAgeMs??120000);
  if(!options.force&&cached&&Date.now()-cached.at<maxAge)return cached.links;
  if(salesProductLinksPendingV216.has(key))return salesProductLinksPendingV216.get(key);
  const pending=(async()=>{
    const json=await jsonp({action:"getSalesProductLinks",type,date,location},{timeoutMs:12000});
    if(!json.ok)throw new Error(json.message||"读取盆栽关联资料失败");
    const links=setCachedSalesProductLinksV216(type,date,location,Array.isArray(json.links)?json.links:[]);
    // V46.0 exact-context request is card+profit authority for this context.
    // Replace the exact context in every aggregate cache so the Profit panel cannot
    // return stale values from the older getAll cache after the card is already new.
    if(typeof replaceProfitAggregateContextV457==='function')replaceProfitAggregateContextV457(type,date,location,links);
    else {
      if(typeof mergeDailyProfitContextCacheV237==='function')mergeDailyProfitContextCacheV237(type,date,location,links);
      if(typeof refreshProfitAggregateCachesV321==='function'){
        const txns=[...new Set(links.map(x=>String(x.transactionId||x.saleId||'')).filter(Boolean))];
        refreshProfitAggregateCachesV321(links,txns);
      }
    }
    if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
    if(json.salesCardRevision!==undefined){
      const p=getPrioritySyncLocalV315();
      setPrioritySyncLocalV315({...p,salesCardRevision:Number(json.salesCardRevision||0),at:Date.now()});
      if(typeof markSalesCardContextVerifiedV451==='function')markSalesCardContextVerifiedV451(type,date,location,Number(json.salesCardRevision||0));
    }
    return links;
  })().finally(()=>salesProductLinksPendingV216.delete(key));
  salesProductLinksPendingV216.set(key,pending);
  return pending;
}

async function deleteSalesProductLinkV206(linkId) {
  const priority=typeof getPrioritySyncLocalV315==='function'?getPrioritySyncLocalV315():{};
  const expectedSalesCardRevision=Object.prototype.hasOwnProperty.call(priority||{},'salesCardRevision')?Number(priority.salesCardRevision||0):'';
  const json = await jsonp({ action:"deleteSalesProductLink", linkId, expectedSalesCardRevision }, { timeoutMs:20000 });
  if (!json.ok) throw new Error(json.message || "删除盆栽关联失败");
  if(typeof window.purgeDeletedSalesLinkV348==='function')window.purgeDeletedSalesLinkV348(linkId);
  if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
  if(json.salesCardRevision!==undefined)setPrioritySyncLocalV315({...priority,salesCardRevision:Number(json.salesCardRevision||0),at:Date.now()});
  // V50.8: the deleted Link ID is purged precisely by purgeDeletedSalesLinkV348.
  // Never clear all Sales Card / Profit caches here; unrelated contexts must stay hot.
  if(Array.isArray(allSalesProductLinksCacheV216?.links))allSalesProductLinksCacheV216={links:allSalesProductLinksCacheV216.links.filter(x=>String(x?.linkId||'').trim()!==String(linkId||'').trim()),at:Date.now()};
  return json;
}

let allSalesProductLinksCacheV216={links:null,at:0};
let allSalesProductLinksPendingV216=null;

// V32.6: keep already-loaded profit rollup data current when a Draft is saved.
// Only patch the cache when it already represents a complete getAll result; if it
// has never been loaded, leave it null so the next profit query still fetches all rows.
function mergeAllSalesProductLinksCacheV321(savedLinks, replaceTransactionIds=[]){
  if(!Array.isArray(allSalesProductLinksCacheV216.links))return null;
  const incoming=(Array.isArray(savedLinks)?savedLinks:[]).filter(x=>!['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase()));
  const txnIds=new Set((Array.isArray(replaceTransactionIds)?replaceTransactionIds:[]).map(String).filter(Boolean));
  incoming.forEach(x=>{const id=String(x?.transactionId||'').trim();if(id)txnIds.add(id)});
  const linkIds=new Set(incoming.map(x=>String(x?.linkId||'').trim()).filter(Boolean));
  const kept=allSalesProductLinksCacheV216.links.filter(x=>{
    const txn=String(x?.transactionId||'').trim(),link=String(x?.linkId||'').trim();
    if(txn&&txnIds.has(txn))return false;
    if(link&&linkIds.has(link))return false;
    return !['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase());
  });
  allSalesProductLinksCacheV216={links:[...kept,...incoming],at:Date.now()};
  return allSalesProductLinksCacheV216.links;
}
window.mergeAllSalesProductLinksCacheV321=mergeAllSalesProductLinksCacheV321;

async function loadAllSalesProductLinksV203(options={}) {
  const maxAge=Number(options.maxAgeMs??120000);
  if(!options.force&&Array.isArray(allSalesProductLinksCacheV216.links)&&Date.now()-allSalesProductLinksCacheV216.at<maxAge)return allSalesProductLinksCacheV216.links;
  // V46.0: never let an independent profit refresh advance past an actively edited
  // Sales Card. Keep the last complete local authority until the edit is saved/cancelled.
  if(typeof hasLocalSalesDraftRiskV449==='function'&&hasLocalSalesDraftRiskV449()&&Array.isArray(allSalesProductLinksCacheV216.links)){
    return allSalesProductLinksCacheV216.links;
  }
  if(allSalesProductLinksPendingV216)return allSalesProductLinksPendingV216;
  allSalesProductLinksPendingV216=(async()=>{
    const json=await jsonp({action:"getAllSalesProductLinks"},{timeoutMs:Number(options.timeoutMs||15000)});
    if(!json.ok)throw new Error(json.message||"读取盆栽关联资料失败");
    const links=typeof dedupeAuthoritativeSalesLinksV354==="function"?dedupeAuthoritativeSalesLinksV354(json.links):(Array.isArray(json.links)?json.links:[]);
    // V46.0 single authority path: the same fast request previously used by profit
    // now atomically publishes BOTH Sales Card caches and all profit caches.
    if(typeof commitAllSalesCardsAtomicV449==='function')commitAllSalesCardsAtomicV449(links,Number(json.salesCardRevision||0));
    else allSalesProductLinksCacheV216={links,at:Date.now()};
    if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
    if(json.salesCardRevision!==undefined){
      const p=getPrioritySyncLocalV315();
      setPrioritySyncLocalV315({...p,salesCardRevision:Number(json.salesCardRevision||0),at:Date.now()});
    }
    return links;
  })().finally(()=>{allSalesProductLinksPendingV216=null;});
  return allSalesProductLinksPendingV216;
}

async function loadSalesChangeLogFromSheetV200(type, date, options={}) {
  if(!options.force){
    const cached=getSalesChangeLogCacheV237(type,date);
    if(Array.isArray(cached))return{ok:true,logs:cached,fromCache:true};
  }
  const json = await jsonp({
    action: "getSalesChangeLog",
    type,
    date,
    location: options.location || ""
  }, { timeoutMs: 15000 });
  if (!json.ok) throw new Error(json.message || "读取新增 / 修改记录失败");
  setSalesChangeLogCacheV237(type,date,Array.isArray(json.logs)?json.logs:[]);
  return json;
}

async function loadAllSalesChangeLogsV236() {
  const json = await jsonp({ action:"getAllSalesChangeLogs" }, { timeoutMs:30000 });
  if (!json.ok) throw new Error(json.message || "读取新增 / 修改历史失败");
  return Array.isArray(json.logs) ? json.logs : [];
}

async function saveDailyToSheet(date, company, amount, clientUpdatedAt = "", clientDeviceId="", clientSequence=0, baseCloudUpdatedAt="", foregroundSave=false, restoreGeneration=getLocalRestoreGenerationV347(), notificationMeta={}, turnoverEntries=null) {
  const json = await jsonp({
    action: "saveDaily",
    date,
    company,
    amount,
    clientUpdatedAt,clientDeviceId,clientSequence,baseCloudUpdatedAt,foregroundSave:foregroundSave?"1":"",restoreGeneration,
    notificationAction:String(notificationMeta?.action||""),
    notificationAmount:Number(notificationMeta?.amount||0),
    notificationOldAmount:Number(notificationMeta?.oldAmount||0),
    notificationNewAmount:Number(notificationMeta?.newAmount||0),
    notificationEntryId:String(notificationMeta?.entryId||""),
    turnoverEntries:Array.isArray(turnoverEntries)?JSON.stringify(turnoverEntries):""
  }, { timeoutMs: foregroundSave ? 45000 : 30000 });

  if (!json.ok) throw new Error(json.message || "储存失败");
  applyLocalDataRevision(json.dataRevision);
  if(json.turnoverRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,turnoverRevision:Number(json.turnoverRevision||0),at:Date.now()})}
  dispatchSalesNotificationAsync(json.notificationEnvelope);
  const row=json.row||null;if(row&&json.turnoverEntriesRecord)row.turnoverEntriesRecord=json.turnoverEntriesRecord;
  return row;
}

let fairSessionRevisionV514=0;
let fairSessionRevisionKnownV514=false;
function applyFairSessionRevisionV514(value){if(value===undefined||value===null||value==='')return;fairSessionRevisionV514=Math.max(0,Number(value||0));fairSessionRevisionKnownV514=true;}
async function saveFairSessionToSheetV281(location,start,end){
  const json=await jsonp({action:"saveFairSessionV281",location,start,end,expectedFairSessionRevision:fairSessionRevisionKnownV514?fairSessionRevisionV514:""});
  if(!json.ok)throw new Error(json.message||"Fair 活动资料储存失败");
  applyLocalDataRevision(json.dataRevision);
  applyFairSessionRevisionV514(json.fairSessionRevision);
  return json;
}
async function loadFairSessionsFromSheetV281(){
  const json=await jsonp({action:"getFairSessionsV281"});
  if(!json.ok)throw new Error(json.message||"读取 Fair 活动资料失败");
  if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
  applyFairSessionRevisionV514(json.fairSessionRevision);
  return json;
}

async function deleteFairLocationFromSheetV358(location){
  const json=await jsonp({action:"deleteFairLocationV358",location,restoreGeneration:getLocalRestoreGenerationV347(),expectedFairSessionRevision:fairSessionRevisionKnownV514?fairSessionRevisionV514:""});
  if(!json.ok)throw new Error(json.message||"删除 Fair 地点失败");
  if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
  applyFairSessionRevisionV514(json.fairSessionRevision);
  return json;
}

async function sendFairBatchToSheetV343(location, records, foregroundSave=false, turnoverEntries=null) {
  const restoreGeneration=Array.isArray(records)&&records.length?Number(records[0].restoreGeneration||0):getLocalRestoreGenerationV347();
  const json = await jsonp({
    action: "saveFairBatch",
    location,
    records: JSON.stringify(records),
    foregroundSave:foregroundSave?"1":"",restoreGeneration,
    notificationAction:String((records&&records[0]&&records[0].notificationAction)||""),
    notificationAmount:Number((records&&records[0]&&records[0].notificationAmount)||0),
    notificationOldAmount:Number((records&&records[0]&&records[0].notificationOldAmount)||0),
    notificationNewAmount:Number((records&&records[0]&&records[0].notificationNewAmount)||0),
    notificationEntryId:String((records&&records[0]&&records[0].notificationEntryId)||""),
    // V39.9: interactive Fair saves must return the cloud ACK before any push work.
    // Inline notification is reserved for pagehide/keepalive requests only.
    notifyInline:"",
    clientVersion:"39.7",
    launchUrl:getSalesLaunchUrlV194(),
    turnoverEntries:Array.isArray(turnoverEntries)?JSON.stringify(turnoverEntries):""
  }, { timeoutMs: foregroundSave ? 45000 : 30000 });

  if (!json.ok) throw new Error(json.message || "Fair 储存失败");
  applyLocalDataRevision(json.dataRevision);
  if(json.turnoverRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,turnoverRevision:Number(json.turnoverRevision||0),at:Date.now()})}
  // V39.9 foreground Fair saves return the cloud ACK first; push is dispatched asynchronously afterward.
  // Pagehide keepalive remains the only path allowed to request inline notification.
  if(!(json.inlineNotification&&json.inlineNotification.inline))dispatchSalesNotificationAsync(json.notificationEnvelope);
  (Array.isArray(records)?records:[]).forEach(r=>{
    if(r&&r.date)Promise.resolve(loadSalesChangeLogFromSheetV200("fair",r.date,{force:true})).catch(()=>{});
  });
  return json;
}

// Keep all writes for one canonical Fair location in creation order.  This
// closes the foreground-save/background-retry race on the same device; the
// Apps Script timestamp guard remains authoritative across devices/pagehide.
function saveFairBatchToSheet(location, records, foregroundSave=false, turnoverEntries=null) {
  const queueKey=normalizeFairLocationKey(location);
  const previous=fairWriteQueuesV343.get(queueKey)||Promise.resolve();
  const task=previous.catch(()=>{}).then(()=>sendFairBatchToSheetV343(location,records,foregroundSave,turnoverEntries));
  fairWriteQueuesV343.set(queueKey,task);
  task.finally(()=>{
    if(fairWriteQueuesV343.get(queueKey)===task)fairWriteQueuesV343.delete(queueKey);
  }).catch(()=>{});
  return task;
}

async function saveFairSingleToSheet(date, location, amount, clientUpdatedAt = "") {
  return saveFairBatchToSheet(location, [{
    date,
    amount,
    clientUpdatedAt
  }]);
}

async function saveFairToSheet(location, records) {
  return saveFairBatchToSheet(location, records);
}


async function saveLiveToSheet(date, host, amount, clientUpdatedAt = "", clientDeviceId="", clientSequence=0, baseCloudUpdatedAt="", foregroundSave=false, restoreGeneration=getLocalRestoreGenerationV347(), notificationMeta={}, turnoverEntries=null) {
  const json = await jsonp({
    action: "saveLive",
    date,
    host,
    amount,
    clientUpdatedAt,clientDeviceId,clientSequence,baseCloudUpdatedAt,foregroundSave:foregroundSave?"1":"",restoreGeneration,
    notificationAction:String(notificationMeta?.action||""),
    notificationAmount:Number(notificationMeta?.amount||0),
    notificationOldAmount:Number(notificationMeta?.oldAmount||0),
    notificationNewAmount:Number(notificationMeta?.newAmount||0),
    notificationEntryId:String(notificationMeta?.entryId||""),
    turnoverEntries:Array.isArray(turnoverEntries)?JSON.stringify(turnoverEntries):""
  }, { timeoutMs: foregroundSave ? 45000 : 30000 });
  if (!json.ok) throw new Error(json.message || "Live 储存失败");
  applyLocalDataRevision(json.dataRevision);
  if(json.turnoverRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,turnoverRevision:Number(json.turnoverRevision||0),at:Date.now()})}
  dispatchSalesNotificationAsync(json.notificationEnvelope);
  Promise.resolve(loadSalesChangeLogFromSheetV200("live",date,{force:true})).catch(()=>{});
  const row=json.row||null;if(row&&json.turnoverEntriesRecord)row.turnoverEntriesRecord=json.turnoverEntriesRecord;
  return row;
}

async function saveCommissionSettingsToSheet(settings, targetMonth = "") {
  return runSettingsWrite(async () => {
    const json = await jsonp({
      action: "saveCommissionSettings",
      rate1: settings.rate1,
      rate2: settings.rate2,
      rate3: settings.rate3,
      liveHostRates: JSON.stringify(settings.liveHostRates || {}),
      liveHosts: JSON.stringify(settings.liveHosts || {}),
      inactiveLiveHosts: JSON.stringify(settings.inactiveLiveHosts || {}),
      liveRateSchedules: JSON.stringify(settings.liveRateSchedules || []),
      fairRevision: Number(settings.fairRevision || 0),
      liveRevision: Number(settings.liveRevision || 0),
      targetMonth: targetMonth || ""
    }, { timeoutMs: 20000 });
    if (!json.ok) throw new Error(json.message || "佣金设置储存失败");
    applyLocalDataRevision(json.dataRevision);
    return json.commissionSettings || null;
  });
}

async function saveCommissionFastRequest_(action, settings, targetMonth = "") {
  const params = {
    action,
    rate1: settings.rate1,
    rate2: settings.rate2,
    rate3: settings.rate3,
    liveHostRates: JSON.stringify(settings.liveHostRates || {}),
    liveHosts: JSON.stringify(settings.liveHosts || {}),
    inactiveLiveHosts: JSON.stringify(settings.inactiveLiveHosts || {}),
    liveRateSchedules: JSON.stringify(settings.liveRateSchedules || []),
    fairRevision: Number(settings.fairRevision || 0),
    liveRevision: Number(settings.liveRevision || 0),
    targetMonth: targetMonth || ""
  };

  try {
    const json = await jsonp(params, { timeoutMs: 4500 });
    if (!json.ok) throw new Error(json.message || "佣金设置储存失败");
    applyLocalDataRevision(json.dataRevision);
    return json.commissionSettings || null;
  } catch (firstError) {
    await new Promise(resolve => setTimeout(resolve, 350));
    const json = await jsonp(params, { timeoutMs: 5500 });
    if (!json.ok) throw new Error(json.message || firstError.message || "佣金设置储存失败");
    applyLocalDataRevision(json.dataRevision);
    return json.commissionSettings || null;
  }
}

async function saveFairCommissionSettingsToSheet(settings, targetMonth = "") {
  return runSettingsWrite(() =>
    saveCommissionFastRequest_("saveFairCommissionFast", settings, targetMonth)
  );
}

async function saveLiveCommissionSettingsToSheet(settings, targetMonth = "") {
  return runSettingsWrite(() =>
    saveCommissionFastRequest_("saveLiveCommissionFast", settings, targetMonth)
  );
}

async function resetCommissionSettingsInSheet() {
  const json = await jsonp({ action: "resetCommissionSettings" });
  if (!json.ok) throw new Error(json.message || "恢复默认值失败");
  applyLocalDataRevision(json.dataRevision);
  return json.commissionSettings || null;
}

setInterval(() => {
  loadPendingRows();
  if (pendingRows.length > 0) syncPendingRows();
}, 30000);

window.addEventListener("online", () => {
  loadPendingRows();
  if (pendingRows.length > 0) syncPendingRows();
});


async function closeMonthInSheet(month){const json=await jsonp({action:"closeMonth",month});if(!json.ok)throw new Error(json.message||"月底结算失败");return json}
async function closeYearInSheet(year){const json=await jsonp({action:"closeYear",year},{timeoutMs:180000});if(!json.ok)throw new Error(json.message||"年底结算失败");return json}
async function restoreBackupToSheet(payload,onProgress=()=>{}){
  const raw=JSON.stringify(payload);
  const id="restore_"+Date.now()+"_"+Math.floor(Math.random()*100000);
  const chunkSize=3200,total=Math.ceil(raw.length/chunkSize);

  onProgress({stage:"upload",message:"正在准备 Restore...",restoreId:id});
  let result=await jsonp({action:"restoreBegin",restoreId:id,totalChunks:total},{timeoutMs:45000});
  if(!result.ok)throw new Error(result.message||"无法开始恢复");

  for(let i=0;i<total;i++){
    onProgress({stage:"upload",message:`正在上传 Backup ${i+1}/${total}...`,restoreId:id});
    result=await jsonp({action:"restoreChunk",restoreId:id,index:i,data:raw.slice(i*chunkSize,(i+1)*chunkSize)},{timeoutMs:45000});
    if(!result.ok)throw new Error(result.message||`恢复区块 ${i+1} 失败`);
  }

  onProgress({stage:"start",message:"正在建立 Restore 工作...",restoreId:id});
  result=await jsonp({action:"restoreJobStart",restoreId:id},{timeoutMs:90000});
  if(!result.ok)throw new Error(result.message||"无法建立 Restore 工作");

  const jobId=String(result.jobId||id);
  onProgress({stage:"job",message:result.message||"Restore 已开始",restoreId:id,jobId,status:result});

  for(let safety=0;safety<500;safety++){
    await new Promise(resolve=>setTimeout(resolve,1200));
    let status=await jsonp({action:"restoreJobStatus",jobId},{timeoutMs:30000});
    if(!status.ok)throw new Error(status.message||"无法读取 Restore 状态");
    onProgress({stage:"job",message:status.message||"Restore 进行中",restoreId:id,jobId,status});

    if(status.state==="success")return status;
    if(status.state==="failed")throw new Error(status.error||status.message||"Restore 失败");

    // Each step is deliberately small. If this request times out, status remains on server
    // and the next page open can continue/resume safely.
    try{
      const step=await jsonp({action:"restoreJobStep",jobId},{timeoutMs:90000});
      if(step&&step.ok){
        onProgress({stage:"job",message:step.message||"Restore 进行中",restoreId:id,jobId,status:step});
        if(step.state==="success")return step;
        if(step.state==="failed")throw new Error(step.error||step.message||"Restore 失败");
      }
    }catch(e){
      // Do not declare failure on one transient timeout; query persisted status next loop.
      console.warn("Restore step temporary error",e);
    }
  }
  throw new Error("Restore 工作未在预期时间内完成，请重新打开系统查看 Restore 状态。");
}

async function getRestoreJobStatusV234(jobId){
  return jsonp({action:"restoreJobStatus",jobId},{timeoutMs:30000});
}
async function continueRestoreJobV234(jobId){
  return jsonp({action:"restoreJobStep",jobId},{timeoutMs:90000});
}


async function loadAccessSettingsFromSheet() {
  const json = await jsonp({ action: "loadAccessSettings" });
  if (!json.ok) throw new Error(json.message || "读取密码设置失败");
  return json.accessSettings || null;
}

async function saveAccessSettingsToSheet(settings) {
  return runSettingsWrite(async () => {
    const json = await jsonp({
      action: "saveAccessSettings",
      accessPasswordHash: settings.accessPasswordHash,
      accessPasswordHint: settings.accessPasswordHint,
      expectedAccessRevision:Number(settings.accessRevision||0)
    }, { timeoutMs: 20000 });
    if (!json.ok) throw new Error(json.message || "密码设置同步失败");
    return json.accessSettings || null;
  });
}


async function verifyAccessBackendVersion() {
  const json = await jsonp({
    action: "accessVersion"
  });

  if (!json.ok ||
      json.accessSettingsSupported !== true) {
    throw new Error(
      "Google Apps Script 密码功能未部署"
    );
  }

  return json;
}
// V29.9 stable API alias: UI save function must never shadow the transport function.
async function deleteSalesTransactionV256(saleId){
  // V46.0: deletion has no revision override argument. Always use this device's
  // last cloud-confirmed Sales Card revision. A timeout is tagged for the caller
  // so it can VERIFY the final cloud result instead of reporting a false failure.
  const priorityV450=getPrioritySyncLocalV315();
  const hasExpectedV450=Object.prototype.hasOwnProperty.call(priorityV450||{},'salesCardRevision');
  const expectedSalesCardRevisionV450=hasExpectedV450?Number(priorityV450.salesCardRevision||0):'';
  try{
    const json=await jsonp({action:"deleteSalesTransaction",saleId:String(saleId||""),expectedSalesCardRevision:expectedSalesCardRevisionV450},{timeoutMs:16000});
    if(!json.ok)throw new Error(json.error||"删除销售卡失败");
    if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
    if(json.salesCardRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,salesCardRevision:Number(json.salesCardRevision||0),at:Date.now()})}
    try{saveLocalDataCache()}catch(_){}
    return json;
  }catch(err){
    if(/超时/.test(String(err&&err.message||err||'')))err.deleteTimeoutV459=true;
    throw err;
  }
}
async function verifySalesTransactionDeletedV459(saleId,type,date,location){
  try{
    const json=await jsonp({action:'verifySalesTransactionDeletedV459',saleId:String(saleId||''),type:String(type||''),date:String(date||''),location:String(location||'')},{timeoutMs:14000});
    if(!json.ok)throw new Error(json.error||json.message||'确认删除结果失败');
    if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
    if(json.salesCardRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,salesCardRevision:Number(json.salesCardRevision||0),at:Date.now()})}
    return json;
  }catch(err){err.deleteVerifyUnknownV459=true;throw err;}
}
window.deleteSalesTransactionV256=deleteSalesTransactionV256;
window.verifySalesTransactionDeletedV459=verifySalesTransactionDeletedV459;

window.saveSalesProductLinksApiV241=saveSalesProductLinksV206;

/* V36.8: expose already-authoritative in-memory profit links for instant same-page reuse. */
function peekAllSalesProductLinksCacheV367(maxAgeMs=180000){
  if(!Array.isArray(allSalesProductLinksCacheV216.links))return null;
  if(Date.now()-Number(allSalesProductLinksCacheV216.at||0)>Number(maxAgeMs||0))return null;
  return allSalesProductLinksCacheV216.links;
}
window.peekAllSalesProductLinksCacheV367=peekAllSalesProductLinksCacheV367;

// V36.8 build alias
window.peekAllSalesProductLinksCacheV368=peekAllSalesProductLinksCacheV367;


/* ================= V39.9 Fair/Live turnover entry details ================= */
async function loadTurnoverEntriesFromSheetV376(type,date,location){
  const json=await jsonp({action:'getTurnoverEntriesV502',type,date,location},{timeoutMs:8000});
  if(!json.ok)throw new Error(json.message||'读取营业额明细失败');
  return json.record||null;
}
async function getTurnoverTotalFromSheetV504(type,date,location){
  const json=await jsonp({action:'getTurnoverTotalV504',type,date,location},{timeoutMs:8000});
  if(!json.ok)throw new Error(json.message||'确认营业额失败');
  return json.record||null;
}
async function getTurnoverContextFromSheetV509(type,date,location,timeoutMs=8000){
  const json=await jsonp({action:'getTurnoverContextV509',type,date,location},{timeoutMs:Number(timeoutMs||8000)});
  if(!json.ok)throw new Error(json.message||'确认营业额资料失败');
  if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
  if(json.turnoverRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,turnoverRevision:Number(json.turnoverRevision||0),at:Date.now()})}
  return json.record||null;
}
window.getTurnoverTotalFromSheetV504=getTurnoverTotalFromSheetV504;
window.getTurnoverContextFromSheetV509=getTurnoverContextFromSheetV509;
async function loadAllTurnoverEntriesV376(){
  const json=await jsonp({action:'getAllTurnoverEntriesV376'},{timeoutMs:30000});
  if(!json.ok)throw new Error(json.message||'读取营业额明细失败');
  return Array.isArray(json.records)?json.records:[];
}
async function saveTurnoverEntriesToSheetV376(type,date,location,entries,total,clientUpdatedAt=''){
  const json=await jsonp({
    action:'saveTurnoverEntriesV376',type,date,location,
    entries:JSON.stringify(Array.isArray(entries)?entries:[]),total:Number(total||0),
    clientUpdatedAt:String(clientUpdatedAt||new Date().toISOString()),
    restoreGeneration:getLocalRestoreGenerationV347()
  },{timeoutMs:20000});
  if(!json.ok)throw new Error(json.message||'营业额明细同步失败');
  if(json.turnoverRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,turnoverRevision:Number(json.turnoverRevision||0),at:Date.now()})}
  return json.record||null;
}
window.loadTurnoverEntriesFromSheetV376=loadTurnoverEntriesFromSheetV376;
window.loadAllTurnoverEntriesV376=loadAllTurnoverEntriesV376;
window.saveTurnoverEntriesToSheetV376=saveTurnoverEntriesToSheetV376;
