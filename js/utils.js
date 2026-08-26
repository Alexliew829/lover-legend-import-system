function todayISO(){
  const d=new Date();

  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isoToDisplay(s){
  if(!s)return"";

  const t=String(s).trim();

  if(/^\d{2}-\d{2}-\d{4}$/.test(t)){
    return t;
  }

  if(/^\d{4}-\d{2}-\d{2}$/.test(t)){
    const[y,m,d]=t.split("-");
    return `${d}-${m}-${y}`;
  }

  return t;
}

function displayToISO(s){
  if(!s)return"";

  const t=String(s).trim();

  if(/^\d{4}-\d{2}-\d{2}$/.test(t)){
    return t;
  }

  if(/^\d{2}-\d{2}-\d{4}$/.test(t)){
    const[d,m,y]=t.split("-");
    return `${y}-${m}-${d}`;
  }

  return"";
}

function isValidDisplayDate(s){
  if(!/^\d{2}-\d{2}-\d{4}$/.test(String(s||""))){
    return false;
  }

  const iso=displayToISO(s);
  const[y,m,d]=iso.split("-").map(Number);
  const x=new Date(y,m-1,d);

  return(
    x.getFullYear()===y &&
    x.getMonth()===m-1 &&
    x.getDate()===d
  );
}

function monthISO(){
  return todayISO().slice(0,7);
}

function currentYear(){
  return new Date().getFullYear();
}

function sameMonthDisplay(d,m){
  return displayToISO(d).slice(0,7)===m;
}

function sameYearDisplay(d,y){
  return displayToISO(d).slice(0,4)===String(y);
}

function money(n){
  return Number(n||0).toLocaleString("en-MY",{
    minimumFractionDigits:2,
    maximumFractionDigits:2
  });
}

function formatAmount(n){
  return money(n);
}

function cleanAmount(v){
  return String(v||"")
    .replace(/,/g,"")
    .trim();
}

function toAmount(v){
  return Number(cleanAmount(v)||0);
}

function formatMoneyInput(i){
  i.value=formatAmount(toAmount(i.value));
}

function moneyFocusHandler(e){
  e.target.value=cleanAmount(e.target.value);

  if(
    e.target.value==="0.00" ||
    e.target.value==="0"
  ){
    e.target.value="";
  }
}

function moneyBlurHandler(e){
  formatMoneyInput(e.target);
}

function enterToSaveHandler(e){
  if(
    e.key==="Enter" &&
    e.target.id==="dailySales"
  ){
    e.preventDefault();
    saveDailySales();
  }
}

function attachMoneyInputs(){
  document.querySelectorAll(".money-input").forEach(i=>{
    i.removeEventListener("focus",moneyFocusHandler);
    i.removeEventListener("blur",moneyBlurHandler);
    i.removeEventListener("keydown",enterToSaveHandler);

    i.addEventListener("focus",moneyFocusHandler);
    i.addEventListener("blur",moneyBlurHandler);
    i.addEventListener("keydown",enterToSaveHandler);
  });
}

function dateRange(startISO,endISO){
  const a=[];

  const[sy,sm,sd]=startISO.split("-").map(Number);
  const[ey,em,ed]=endISO.split("-").map(Number);

  let c=new Date(sy,sm-1,sd);
  const l=new Date(ey,em-1,ed);

  while(c<=l){
    a.push(
      isoToDisplay(
        `${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,"0")}-${String(c.getDate()).padStart(2,"0")}`
      )
    );

    c.setDate(c.getDate()+1);
  }

  return a;
}

function downloadFile(filename,content,type){
  const b=new Blob([content],{type});
  const u=URL.createObjectURL(b);
  const l=document.createElement("a");
  l.href=u;
  l.download=filename;
  l.rel="noopener";
  l.style.display="none";
  document.body.appendChild(l);
  l.click();
  setTimeout(()=>{
    try{document.body.removeChild(l)}catch(e){}
    URL.revokeObjectURL(u);
  },1000);
}

function getLastDayOfMonth(m){
  const[y,mo]=m.split("-").map(Number);
  return new Date(y,mo,0);
}

function showTempMsg(id){
  const e=document.getElementById(id);

  if(!e)return;

  e.classList.remove("hidden");

  setTimeout(()=>{
    e.classList.add("hidden");
  },2500);
}

function nowText(){
  return new Date().toLocaleTimeString("zh-MY",{
    hour:"2-digit",
    minute:"2-digit",
    second:"2-digit"
  });
}

/*
  地点比较规则：
  - 忽略大小写
  - 忽略空格
  - 保留所有符号

  KL East Mall = kleastmall
  KL-East Mall ≠ KL East Mall
  KL+East Mall ≠ KL East Mall
*/
function normLoc(s){
  return String(s||"")
    .trim()
    .replace(/\s+/g,"")
    .toLowerCase();
}

function canonicalLocation(value){
  let s=String(value||"").trim();

  if(!s)return"";

  // 只合并多余空格，不删除或替换任何符号
  s=s.replace(/\s+/g," ").trim();

  // 比较时只忽略空格和大小写
  const compact=s
    .replace(/\s+/g,"")
    .toLowerCase();

  // 没有符号的固定地点统一名称
  if(compact==="sunway"||compact==="sunwaymall"){
    return"Sunway";
  }

  if(compact==="ioi"||compact==="ioimall"){
    return"IOI";
  }

  if(compact==="midvalley"||compact==="midvalleymall"){
    return"Mid Valley";
  }

  if(compact==="kleastmall"){
    return"KL East Mall";
  }

  /*
    如果含有符号，不套用无符号地点的统一名称。
    例如：
    KL-East Mall
    KL+East Mall
    KL.East Mall
    都会保留为独立地点。
  */
  const hasSymbol=/[^a-zA-Z0-9\s]/.test(s);

  if(hasSymbol){
    return s
      .split(" ")
      .map(part=>{
        if(!part)return"";

        // 保留带符号内容，只调整第一个英文字母大小写
        return part.charAt(0).toUpperCase()+part.slice(1);
      })
      .join(" ");
  }

  // 一般无符号地点统一英文大小写
  return s
    .split(" ")
    .map(part=>{
      const lower=part.toLowerCase();

      if(lower==="ioi"){
        return"IOI";
      }

      if(lower==="kl"){
        return"KL";
      }

      if(
        part.length<=3 &&
        part===part.toUpperCase()
      ){
        return part;
      }

      return(
        part.charAt(0).toUpperCase()+
        part.slice(1).toLowerCase()
      );
    })
    .join(" ");
}

function monthAfter(m){
  const[y,mo]=m.split("-").map(Number);
  const d=new Date(y,mo,1);

  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}


// V21.1: Fair 地点键值忽略所有空格及英文字母大小写，但保留符号。
// 例如 "JB AEON Mall , Terbau City" 与 "JB AEON Mall,Terbau City" 是同一地点。
function normalizeFairLocationKey(value){
  return canonicalLocation(value||"")
    .replace(/\s+/g,"")
    .toLowerCase();
}

function yearAfter(y){
  return String(Number(y)+1);
}

function syncKey(row){
  const location=row.type==="live"
    ? String(row.location||"").replace(/\s+/g,"").toLowerCase()
    : normalizeFairLocationKey(row.location||"");
  return[row.type,row.date,row.company,location].join("|");
}

function openDatePicker(id){
  const el=document.getElementById(id);

  if(el.showPicker){
    el.showPicker();
  }else{
    el.click();
  }
}

function setDateControl(id,iso){
  document.getElementById(id).value=iso;

  const d=document.getElementById(id+"Display");

  if(d){
    d.value=isoToDisplay(iso);
  }
}

function bindSingleClickDatePicker(id){
  const hidden=document.getElementById(id);
  const display=document.getElementById(id+"Display");
  if(!hidden||!display||display.dataset.pickerBound==="1")return;
  display.dataset.pickerBound="1";
  const field=display.closest(".date-field");
  const button=field&&field.querySelector(".date-btn");
  const openPicker=(event)=>{
    if(event){event.preventDefault();event.stopPropagation();}
    try{if(typeof hidden.showPicker==="function")hidden.showPicker();else hidden.click();}
    catch(err){hidden.focus();hidden.click();}
  };
  display.addEventListener("click",openPicker);
  if(button)button.addEventListener("click",openPicker);
}

function bindDateControl(id,onChange){
  const hidden=document.getElementById(id);
  const display=document.getElementById(id+"Display");

  hidden.addEventListener("change",()=>{
    display.value=isoToDisplay(hidden.value);

    if(onChange){
      onChange();
    }
  });

  display.addEventListener("change",()=>{
    if(!isValidDisplayDate(display.value)){
      alert("日期格式必须是 dd-mm-yyyy，例如 10-07-2026");
      display.value=isoToDisplay(hidden.value);
      return;
    }

    hidden.value=displayToISO(display.value);

    if(onChange){
      onChange();
    }
  });

  bindSingleClickDatePicker(id);
}
