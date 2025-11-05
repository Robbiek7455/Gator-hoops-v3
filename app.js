/* ========= Config ========= */
const TEAM_ID = 57;
let   GENDER  = "mens-college-basketball";
const BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball";
const GOOGLE_IMPORT_URL = "https://calendar.google.com/calendar/u/0/r/settings/import";

/* Photos: more highlights + logos */
const CHAMPIONSHIP_PHOTOS = [
  // YouTube thumbs (safe to hotlink)
  "https://img.youtube.com/vi/igDpFxg60qU/maxresdefault.jpg",
  "https://img.youtube.com/vi/ww6n-Y9ygeg/maxresdefault.jpg",
  "https://img.youtube.com/vi/kuPmLVeXXac/maxresdefault.jpg",
  "https://img.youtube.com/vi/2Skv3IYAdUE/maxresdefault.jpg",
  // Logos / arenas
  "https://upload.wikimedia.org/wikipedia/commons/7/7d/Florida_Gators_gator_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/6/65/Southeastern_Conference_logo.svg"
];

/* ========= El helpers ========= */
const $ = (q)=>document.querySelector(q);
const scheduleList = $("#scheduleList");
const rosterList   = $("#rosterList");
const propsWrap    = $("#propsWrap");
const refreshBtn   = $("#refreshBtn");
const genderSelect = $("#gender");
const newsList     = $("#newsList");
const ticketsList  = $("#ticketsList");

const heroImg = $("#heroImg"); const prevBtn = $("#prevBtn"); const nextBtn = $("#nextBtn");

function el(html){ const d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstChild; }
async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
function toGCalDate(dt){ return dt.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z"); }
function addHours(date, h){ const d=new Date(date); d.setHours(d.getHours()+h); return d; }
function fmtDate(iso){ const d=new Date(iso); return d.toLocaleString(undefined,{dateStyle:"medium", timeStyle:"short"}); }
function isIOS(){ return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1); }
function isAndroid(){ return /Android/.test(navigator.userAgent); }

/* ========= Tabs (robust) ========= */
function activateTab(which){
  const ids = ["schedule","roster","props","stats","news","tickets"];
  ids.forEach(id=>{
    const tab = document.getElementById("tab-"+id);
    const panel = document.getElementById("panel-"+id);
    const on = id===which;
    tab?.setAttribute("aria-selected", String(on));
    panel?.classList.toggle("active", on);
  });
}
document.addEventListener("click",(e)=>{
  const b = e.target.closest(".tab"); if(!b) return;
  e.preventDefault();
  activateTab(b.id.replace("tab-",""));
});

/* ========= Carousel ========= */
let heroIndex=0;
function setHero(i){
  const arr=CHAMPIONSHIP_PHOTOS;
  if(!arr.length){
    heroImg.src="https://upload.wikimedia.org/wikipedia/commons/7/7d/Florida_Gators_gator_logo.svg";
    heroImg.style.objectFit="contain";
    return;
  }
  heroIndex=(i+arr.length)%arr.length; heroImg.src=arr[heroIndex];
}
prevBtn.addEventListener("click",()=>setHero(heroIndex-1));
nextBtn.addEventListener("click",()=>setHero(heroIndex+1));

/* ========= Countdown + Notifications ========= */
function msUntil(date){ return +date - Date.now(); }
function formatCountdown(ms){
  if(ms<=0) return "Tip-off!";
  const s=Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), ss=s%60;
  if(d>0) return `${d}d ${h}h ${m}m`; if(h>0) return `${h}h ${m}m ${ss}s`; return `${m}m ${ss}s`;
}
async function requestNotifyPermission(){ if(!("Notification" in window)) return false; if(Notification.permission==="granted") return true; const p=await Notification.requestPermission(); return p==="granted"; }

/* ========= ESPN parsing ========= */
function parseSchedule(data){
  const events=data?.events??[];
  return events.map(ev=>{
    const comp=ev.competitions?.[0];
    const competitors=comp?.competitors??[];
    const home=competitors.find(c=>c.homeAway==="home");
    const away=competitors.find(c=>c.homeAway==="away");
    const isHome=String(home?.team?.id)===String(TEAM_ID);
    const selfSide=isHome?home:away; const oppSide=isHome?away:home;
    const statusType=comp?.status?.type; const status=statusType?.shortDetail||statusType?.description||"Scheduled";
    const oppTeam=oppSide?.team??{}; const logo=oppTeam?.logos?.[0]?.href;
    const myScore=Number(selfSide?.score); const oppScore=Number(oppSide?.score);
    return { id:ev.id, date:ev.date, opponent:oppTeam.displayName??"Opponent", isHome,
      venue:comp?.venue?.fullName, tv:comp?.broadcasts?.[0]?.names?.[0], status,
      myScore:isNaN(myScore)?undefined:myScore, oppScore:isNaN(oppScore)?undefined:oppScore, opponentLogo:logo };
  }).sort((a,b)=> new Date(a.date)-new Date(b.date));
}
function parseRoster(data){
  const groups=data?.team?.athletes??[]; const players=[];
  for(const g of groups){ for(const it of (g.items??[])){
    let stats={ ppg:0,rpg:0,apg:0,fgp:0,tpp:0,ftp:0,spg:0,bpg:0,topg:0,mpg:0 };
    const season=(it.statistics??[]).find(s=>String(s.name||"").toLowerCase().includes("season"));
    const cats=season?.splits?.categories??[];
    for(const cat of cats){ for(const st of (cat.stats??[])){ const nm=st.name, val=Number(st.value);
      if(nm==="pointsPerGame")stats.ppg=val; if(nm==="reboundsPerGame")stats.rpg=val; if(nm==="assistsPerGame")stats.apg=val;
      if(nm==="fieldGoalPct")stats.fgp=val; if(nm==="threePointPct")stats.tpp=val; if(nm==="freeThrowPct")stats.ftp=val;
      if(nm==="stealsPerGame")stats.spg=val; if(nm==="blocksPerGame")stats.bpg=val; if(nm==="turnoversPerGame")stats.topg=val;
      if(nm==="minutesPerGame")stats.mpg=val;
    } }
    players.push({ id:String(it.id), fullName:it.displayName, position:it.position?.abbreviation, number:it.jersey,
      classYear:it.class, headshot:it.headshot?.href, stats });
  } }
  players.sort((a,b)=> a.fullName.localeCompare(b.fullName));
  return players;
}

/* ========= Elo (fun) ========= */
function buildElo(games){ let elo=1500,K=18; for(const g of games){ if(g.myScore!=null&&g.oppScore!=null){ const diff=g.myScore-g.oppScore, res=diff>0?1:diff<0?0:0.5; const exp=1/(1+Math.pow(10,(1500-elo)/400)); const margin=Math.min(10,Math.abs(diff))/10; elo=elo+K*(res-exp)*(1+margin*0.6); } } return elo; }
function predictWinProb(eloSelf,isHome){ const home= isHome?50:0, opp=1500; return 1/(1+Math.pow(10,((opp-(eloSelf+home))/400))); }

/* ========= Calendar (per-game & all) ========= */
function perGameCalendarLinks(game){
  const title = `Florida Gators ${game.isHome?"vs":"@"} ${game.opponent}`;
  const start=new Date(game.date), end=addHours(start,2);
  const loc=game.venue||"TBD"; const details=`TV: ${game.tv||"TBD"} — Auto-generated from Gator Hoops`;
  const uid=`${game.id}@gatorhoops`; const dtS=toGCalDate(start), dtE=toGCalDate(end);
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//GatorHoops//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
    `UID:${uid}`,`DTSTAMP:${toGCalDate(new Date())}`,`DTSTART:${dtS}`,`DTEND:${dtE}`,
    `SUMMARY:${title}`,`DESCRIPTION:${details}`,`LOCATION:${loc}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const icsUrl = URL.createObjectURL(new Blob([ics],{type:"text/calendar;charset=utf-8"}));
  const g = new URL("https://www.google.com/calendar/render");
  g.searchParams.set("action","TEMPLATE"); g.searchParams.set("text",title); g.searchParams.set("dates",`${dtS}/${dtE}`); g.searchParams.set("details",details); g.searchParams.set("location",loc); g.searchParams.set("sf","true"); g.searchParams.set("output","xml");
  const o = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  o.searchParams.set("subject",title); o.searchParams.set("startdt",start.toISOString()); o.searchParams.set("enddt",end.toISOString()); o.searchParams.set("body",details); o.searchParams.set("location",loc);
  return { icsUrl, gcalUrl:g.toString(), outlookUrl:o.toString(), fname:`${title.replace(/\s+/g,'_')}.ics` };
}
function calendarMenu(game){
  const L=perGameCalendarLinks(game);
  const w=el(`<div class="cal-wrap">
    <button class="cal-btn" type="button">Add to Calendar ▾</button>
    <div class="cal-menu">
      <a href="${L.icsUrl}" download="${L.fname}"> Apple Calendar (.ics)</a>
      <a href="${L.gcalUrl}" target="_blank" rel="noopener">Google Calendar</a>
      <a href="${L.outlookUrl}" target="_blank" rel="noopener">Outlook (web)</a>
    </div>
  </div>`);
  const b=w.querySelector(".cal-btn"); const m=w.querySelector(".cal-menu");
  b.addEventListener("click",(e)=>{ e.stopPropagation(); m.style.display=(m.style.display==="block"?"none":"block"); });
  document.addEventListener("click",()=> m.style.display="none");
  return w;
}
function buildAllGamesICS(games){
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//GatorHoops//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
  for(const g of games){ const s=new Date(g.date), e=addHours(s,2), title=`Florida Gators ${g.isHome?"vs":"@"} ${g.opponent}`, loc=g.venue||"TBD", desc=`TV: ${g.tv||"TBD"} — Auto-generated from Gator Hoops`;
    lines.push("BEGIN:VEVENT",`UID:${g.id}@gatorhoops`,`DTSTAMP:${toGCalDate(new Date())}`,`DTSTART:${toGCalDate(s)}`,`DTEND:${toGCalDate(e)}`,`SUMMARY:${title}`,`DESCRIPTION:${desc}`,`LOCATION:${loc}`,"END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return URL.createObjectURL(new Blob([lines.join("\r\n")],{type:"text/calendar;charset=utf-8"}));
}
function wireAddAllSmart(){
  const btn=$("#addAllBtn"), menu=$("#allcal-menu"), apple=$("#allcal-apple");
  btn.addEventListener("click", ()=>{
    const games=window._latestGames||[]; if(!games.length){ alert("Load the schedule first!"); return; }
    const url=buildAllGamesICS(games);
    if(isIOS()){ const a=document.createElement("a"); a.href=url; a.download="Gator_Hoops_Schedule.ics"; a.click(); return; }
    if(isAndroid()){ window.open(GOOGLE_IMPORT_URL,"_blank","noopener"); const a=document.createElement("a"); a.href=url; a.download="Gator_Hoops_Schedule.ics"; a.click(); return; }
    menu.classList.toggle("open");
    apple.onclick=(e)=>{ e.preventDefault(); const a=document.createElement("a"); a.href=url; a.download="Gator_Hoops_Schedule.ics"; a.click(); menu.classList.remove("open"); };
    document.addEventListener("click",(ev)=>{ if(!menu.contains(ev.target) && ev.target!==btn) menu.classList.remove("open"); });
  });
}

/* ========= Tickets helpers ========= */
function ticketUrl(opponent, iso){
  const d=new Date(iso); const yyyy=d.getUTCFullYear(); const mm=String(d.getUTCMonth()+1).padStart(2,'0'); const dd=String(d.getUTCDate()).padStart(2,'0');
  const q = `Florida Gators Basketball ${opponent} ${yyyy}-${mm}-${dd}`;
  return {
    seatgeek: `https://seatgeek.com/search?search=${encodeURIComponent(q)}`,
    ticketmaster: `https://www.ticketmaster.com/search?q=${encodeURIComponent(q)}`,
    vivid: `https://www.vividseats.com/performer/florida-gators-basketball-tickets/?q=${encodeURIComponent(q)}`
  };
}

/* ========= Next Game (countdown + alarms) ========= */
function icsWithAlarm(game){
  const title=`Florida Gators ${game.isHome?"vs":"@"} ${game.opponent}`, s=new Date(game.date), e=addHours(s,2);
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//GatorHoops//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
    `UID:${game.id}@gatorhoops`,`DTSTAMP:${toGCalDate(new Date())}`,`DTSTART:${toGCalDate(s)}`,`DTEND:${toGCalDate(e)}`,
    `SUMMARY:${title}`,`DESCRIPTION:${`TV: ${game.tv||"TBD"} — Auto-generated from Gator Hoops`}`,`LOCATION:${game.venue||"TBD"}`,
    "BEGIN:VALARM","TRIGGER:-PT60M","ACTION:DISPLAY","DESCRIPTION:Game starting in 1 hour","END:VALARM","END:VEVENT","END:VCALENDAR"];
  const url=URL.createObjectURL(new Blob([lines.join("\r\n")],{type:"text/calendar;charset=utf-8"}));
  return { url, filename:`${title.replace(/\s+/g,'_')}.ics` };
}
let countdownTimer=null;
function renderNextGameCard(game){
  const wrap=$("#nextGame"); wrap.innerHTML="";
  if(!game){ wrap.innerHTML=`<div class="note">No upcoming games found.</div>`; return; }
  const start=new Date(game.date);
  const tix=ticketUrl(game.opponent, game.date);
  const card=el(`<div class="next-card">
    ${game.opponentLogo?`<img class="logo" alt="" src="${game.opponentLogo}">`:`<div class="logo"></div>`}
    <div class="next-left">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div style="font-weight:800">Next: ${game.isHome?"vs":"@"} ${game.opponent}</div>
        ${game.tv?`<span class="pill"><span class="pill-dot"></span>${game.tv}</span>`:""}
        ${game.venue?`<span class="pill gray"><span class="pill-dot"></span>${game.venue}</span>`:""}
      </div>
      <div class="meta">${fmtDate(game.date)}</div>
      <div id="cd" class="countdown">—</div>
      <div class="next-actions">
        <a class="btn" target="_blank" rel="noopener" href="${tix.seatgeek}">Get Tickets</a>
        <button id="notifyBtn" class="btn" type="button">Remind me 1h before</button>
        <button id="addNextBtn" class="btn primary" type="button">Add next game (1h alert)</button>
      </div>
      <div class="note">Calendar event includes a 60-minute alert.</div>
    </div>
  </div>`);
  wrap.appendChild(card);
  const cd=card.querySelector("#cd");
  function tick(){ cd.textContent=formatCountdown(msUntil(start)); }
  tick(); if(countdownTimer) clearInterval(countdownTimer); countdownTimer=setInterval(tick,1000);
  card.querySelector("#addNextBtn").addEventListener("click",()=>{ const {url,filename}=icsWithAlarm(game); const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); });
  card.querySelector("#notifyBtn").addEventListener("click", async ()=>{
    const ok=await requestNotifyPermission(); if(!ok){ alert("Please allow notifications."); return; }
    const ms=msUntil(new Date(start.getTime()-60*60*1000)); if(ms<=0){ new Notification("Gators tip-off soon!"); return; }
    const b=card.querySelector("#notifyBtn"); b.disabled=true; b.innerHTML=`<span class="spinner"></span> Scheduled`;
    setTimeout(()=> new Notification("Gators tip-off in 60 minutes! 🐊"), ms);
  });
}

/* ========= Renderers ========= */
function renderSchedule(list){
  scheduleList.innerHTML=""; window._latestGames=list;
  const next=list.find(g=> new Date(g.date) > new Date()); renderNextGameCard(next);
  const elo=buildElo(list.filter(g=>g.myScore!=null&&g.oppScore!=null));
  for(const g of list){
    const right=(g.myScore!=null&&g.oppScore!=null)?`<div class="score">${g.myScore}-${g.oppScore}</div>`:`<div class="meta">${g.status}</div>`;
    const tv=g.tv?`<span class="pill"><span class="pill-dot"></span>${g.tv}</span>`:"";
    const venue=g.venue?`<span class="pill gray"><span class="pill-dot"></span>${g.venue}</span>`:"";
    const tix=ticketUrl(g.opponent, g.date);
    let pred=""; if(g.myScore==null||g.oppScore==null){ const p=predictWinProb(elo,g.isHome); pred=`<div class="pred">Prediction: <b>${Math.round(p*100)}%</b> win</div>`; }
    const card=el(`<div class="card">
      <div class="row">
        ${g.opponentLogo?`<img class="logo" alt="" src="${g.opponentLogo}">`:`<div class="logo"></div>`}
        <div style="flex:1">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <div style="font-weight:800">${g.isHome?"vs":"@"} ${g.opponent}</div>${tv} ${venue}
          </div>
          <div class="meta">${fmtDate(g.date)}</div>${pred}
        </div>
        <div class="right">${right}</div>
      </div>
      <div class="card-actions" style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end"></div>
    </div>`);
    const actions=card.querySelector(".card-actions");
    actions.appendChild(calendarMenu(g));
    actions.appendChild(el(`<a class="btn" target="_blank" rel="noopener" href="${tix.seatgeek}">Get Tickets</a>`));
    scheduleList.appendChild(card);
  }
}
function renderRoster(players){
  // Robust roster rendering (works even if some stats/headshots missing)
  rosterList.innerHTML="";
  if(!players.length){ rosterList.appendChild(el(`<div class="meta">No players found.</div>`)); return; }
  for(const p of players){
    const s=p.stats||{};
    rosterList.appendChild(el(`
      <div class="card">
        <div class="row">
          ${p.headshot?`<img class="head" alt="" src="${p.headshot}">`:`<div class="head"></div>`}
          <div style="flex:1">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <div style="font-weight:800">${p.fullName}</div>
              <span class="meta">${p.number?("#"+p.number+" "):""}${p.position??""} ${p.classYear?("· "+p.classYear):""}</span>
            </div>
            <div class="statgrid">
              <div class="stat"><div class="t">PPG</div><div class="v">${(s.ppg??0).toFixed(1)}</div></div>
              <div class="stat"><div class="t">RPG</div><div class="v">${(s.rpg??0).toFixed(1)}</div></div>
              <div class="stat"><div class="t">APG</div><div class="v">${(s.apg??0).toFixed(1)}</div></div>
              <div class="stat"><div class="t">FG%</div><div class="v">${(s.fgp??0).toFixed(1)}</div></div>
              <div class="stat"><div class="t">3P%</div><div class="v">${(s.tpp??0).toFixed(1)}</div></div>
              <div class="stat"><div class="t">FT%</div><div class="v">${(s.ftp??0).toFixed(1)}</div></div>
            </div>
          </div>
        </div>
      </div>
    `));
  }
}

/* ===== Stats ===== */
function renderLeaders(players){
  const leaders=$("#leaders"); leaders.innerHTML="";
  const by = (k)=> [...players].sort((a,b)=>(b.stats?.[k]??0)-(a.stats?.[k]??0))[0];
  const cats=[["ppg","PPG"],["rpg","RPG"],["apg","APG"],["tpp","3P%"],["fgp","FG%"],["ftp","FT%"]];
  for(const [k,lab] of cats){
    const p=by(k)||{fullName:"—",stats:{[k]:0}};
    leaders.appendChild(el(`<div class="stat"><div class="t">${lab}</div><div class="v">${p.fullName}<br>${(p.stats?.[k]??0).toFixed(1)}</div></div>`));
  }
}
function renderTeamPtsChart(games){
  const ctx=$("#teamPtsChart").getContext("2d");
  const completed=games.filter(g=>g.myScore!=null&&g.oppScore!=null);
  if(!completed.length){ ctx.font="14px system-ui"; ctx.fillText("No completed games yet", 10, 20); return; }
  new Chart(ctx,{ type:"line", data:{
      labels: completed.map((g,i)=>`G${i+1}`),
      datasets:[{ label:"Gators Pts", data: completed.map(g=>g.myScore) }]
    }, options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

/* ===== Props (simple fun mode) ===== */
function makeLineFromAvg(ppg){ const swing=Math.max(0.5,Math.min(3,ppg*0.12)); return +(ppg+(Math.random()*2-1)*swing).toFixed(1); }
function renderProps(games, players){
  propsWrap.innerHTML="";
  const upcoming = games.filter(g=> new Date(g.date) > new Date());
  if(!upcoming.length){ propsWrap.appendChild(el(`<div class="meta">No upcoming games to pick.</div>`)); return; }
  const next = upcoming[0];
  const topPlayers = [...players].sort((a,b)=>(b.stats?.ppg??0)-(a.stats?.ppg??0)).slice(0,5);
  const card = el(`<div class="card">
    <div class="row"><div style="font-weight:800;flex:1">Props (Next Game): ${next.isHome?"vs":"@"} ${next.opponent}</div><div class="meta">${fmtDate(next.date)}</div></div>
    <div id="propsList" class="grid" style="margin-top:8px"></div>
    <div class="note">Your picks save to this device only.</div>
  </div>`);
  const list = card.querySelector("#propsList");
  const storeKey = (id)=>`props:${id}`;

  const picks = JSON.parse(localStorage.getItem(storeKey(next.id) )||"{}");
  topPlayers.forEach(p=>{
    const line = makeLineFromAvg(p.stats?.ppg??10);
    const row = el(`<div class="prop-card">
      <div><div class="prop-title">${p.fullName}</div><div class="prop-meta">Line: ${line} pts · Season ${ (p.stats?.ppg??0).toFixed(1) } PPG</div></div>
      <div class="toggle">
        <button data-choice="under">Under</button>
        <button data-choice="over">Over</button>
      </div>
    </div>`);
    if(picks[p.id]) row.querySelector(`[data-choice="${picks[p.id]}"]`).classList.add("active");
    row.querySelector(".toggle").addEventListener("click",(e)=>{
      const b=e.target.closest("button"); if(!b) return;
      picks[p.id]=b.dataset.choice;
      localStorage.setItem(storeKey(next.id), JSON.stringify(picks));
      row.querySelectorAll("button").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
    });
    list.appendChild(row);
  });
  propsWrap.appendChild(card);
}

/* ===== News (curated links; no CORS needed) ===== */
function renderNews(){
  newsList.innerHTML="";
  const links = [
    ["Official Gators — Men’s Basketball","https://floridagators.com/sports/mens-basketball"],
    ["ESPN — Florida Gators Team Page","https://www.espn.com/mens-college-basketball/team/_/id/57/florida-gators"],
    ["The Independent Florida Alligator — Sports","https://www.alligator.org/section/sports"],
    ["247Sports — Florida Gators","https://247sports.com/college/florida/"],
    ["On3 — Gators","https://www.on3.com/college/florida-gators/"],
    ["Google News — Gators Basketball","https://news.google.com/search?q=Florida%20Gators%20basketball&hl=en-US&gl=US&ceid=US%3Aen"]
  ];
  for(const [title,url] of links){
    newsList.appendChild(el(`<a class="card" target="_blank" rel="noopener" href="${url}">${title}</a>`));
  }
}

/* ===== Tickets (list next 5 games with quick links) ===== */
function renderTickets(games){
  ticketsList.innerHTML="";
  const upcoming = games.filter(g=> new Date(g.date) > new Date()).slice(0,5);
  if(!upcoming.length){ ticketsList.appendChild(el(`<div class="card">No upcoming games found.</div>`)); return; }
  for(const g of upcoming){
    const t = ticketUrl(g.opponent, g.date);
    ticketsList.appendChild(el(`
      <div class="card">
        <div class="row">
          ${g.opponentLogo?`<img class="logo" alt="" src="${g.opponentLogo}">`:`<div class="logo"></div>`}
          <div style="flex:1">
            <div style="font-weight:800">${g.isHome?"vs":"@"} ${g.opponent}</div>
            <div class="meta">${fmtDate(g.date)} ${g.venue?("· "+g.venue):""}</div>
          </div>
          <div class="right">
            <a class="btn" target="_blank" rel="noopener" href="${t.seatgeek}">SeatGeek</a>
            <a class="btn" target="_blank" rel="noopener" href="${t.ticketmaster}">TM</a>
            <a class="btn" target="_blank" rel="noopener" href="${t.vivid}">Vivid</a>
          </div>
        </div>
      </div>
    `));
  }
}

/* ===== Data flow ===== */
async function loadAll(){
  try{
    refreshBtn.disabled=true; refreshBtn.textContent="Loading…"; setHero(0);

    const sched = await getJSON(`${BASE}/${GENDER}/teams/${TEAM_ID}/schedule`);
    const games = parseSchedule(sched);
    renderSchedule(games);

    const roster = await getJSON(`${BASE}/${GENDER}/teams/${TEAM_ID}`);
    const players = parseRoster(roster);
    renderRoster(players);

    // Stats
    renderLeaders(players);
    renderTeamPtsChart(games);

    // Props, News, Tickets
    renderProps(games, players);
    renderNews();
    renderTickets(games);
  }catch(err){
    scheduleList.innerHTML=`<div class="meta" style="color:#c1121f">Error: ${err}</div>`;
    rosterList.innerHTML=`<div class="meta" style="color:#c1121f">Error: ${err}</div>`;
  }finally{
    refreshBtn.disabled=false; refreshBtn.textContent="↻ Refresh";
  }
}

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", ()=>{
  activateTab("schedule");
  setHero(0);
  wireAddAllSmart();
  loadAll();
});
refreshBtn.addEventListener("click", loadAll);
genderSelect.addEventListener("change", (e)=>{ GENDER=e.target.value; loadAll(); });
