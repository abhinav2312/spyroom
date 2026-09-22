const socket=io();let state=null;
const $=id=>document.getElementById(id);
function toast(s){$("toast").textContent=s;setTimeout(()=>{$("toast").textContent=""},3000)}
socket.on("errorMsg",toast);
socket.on("state",s=>{state=s;render()});
$("createForm").onsubmit=e=>{e.preventDefault();socket.emit("create",{name:$("createName").value})};
$("joinForm").onsubmit=e=>{e.preventDefault();socket.emit("join",{code:$("joinCode").value,name:$("joinName").value})};

function render(){
 $("home").classList.add("hidden");$("game").classList.remove("hidden");
 $("roomBadge").classList.remove("hidden");$("roomBadge").textContent="ROOM "+state.code;
 const me=state.players.find(p=>p.id===socket.id);
 let html="";
 if(state.phase==="lobby") html=lobby();
 if(state.phase==="playing") html=playing(me);
 if(state.phase==="voting") html=voting(me);
 if(state.phase==="spyGuess") html=spyGuess();
 if(state.phase==="result") html=result();
 $("game").innerHTML=html + `<div class="leave-wrap"><button id="leave" class="secondary leave-btn">Leave room</button></div>`;
 bind();
}
function lobby(){
 const host=state.players.find(p=>p.id===state.hostId);
 return `<div class="panel"><div class="small">ROOM CODE</div><div class="topic">${state.code}</div><p>Share this code with your friends.</p><div class="players">${state.players.map(p=>`<div class="player"><span>${esc(p.name)}${p.id===state.hostId?" 👑":""}</span><span>●</span></div>`).join("")}</div>${state.players.length<3?`<div class="notice">Need at least 3 players. The host starts the round.</div>`:""}${state.hostId===socket.id?`<button id="start" class="btn" ${state.players.length<2?"disabled":""}>Start game</button>`:`<div class="small">Waiting for ${esc(host?.name||"host")} to start…</div>`}</div>`;
}
function playing(me){
 return `<div class="gamegrid"><div class="card"><div class="small">ROUND ${state.round}</div><h2>Your secret information</h2><div class="topic">${state.isSpy?"🕵️ YOU ARE THE SPY":esc(state.topic||"")}</div><div class="question">${state.isSpy?"You do not know the topic. Blend in and avoid being identified.":esc(state.question||"")}</div><div class="notice">Discuss with everyone. Don't reveal the topic directly. The Spy is trying to blend in.</div></div><div class="card"><h2>Players</h2><div id="timer" class="timer">60s</div><div class="players">${state.players.map(p=>`<div class="player"><span>${esc(p.name)}</span><span>${p.id===socket.id?"You":""}</span></div>`).join("")}</div></div></div>`;
}
function voting(me){
 return `<div class="card"><div class="small">VOTING PHASE</div><h2>Who is the Spy?</h2><p>Choose one player. The result is revealed when everyone votes.</p><div class="vote">${state.players.filter(p=>p.id!==socket.id&&p.alive).map(p=>`<button data-vote="${p.id}">${esc(p.name)}</button>`).join("")}</div><div class="notice">${state.votes} vote(s) submitted.</div></div>`;
}
function spyGuess(){
 const canGuess=state.isSpy;
 return `<div class="card"><div class="small">FINAL CHANCE</div><h2>The Spy was caught!</h2><p>The Spy gets one chance to guess the secret topic. If the guess is correct, the Spy escapes.</p>${canGuess?`<form id="guessForm" class="actions"><input id="guessInput" maxlength="40" placeholder="What was the secret topic?" required><button class="btn">Make my guess</button></form>`:`<div class="notice">The Spy is making their final guess…</div>`}</div>`;
}
function result(){
 const msg=state.winner==="players"?"The players found the Spy! 🎉":"The Spy escaped! 🕵️";
 const spyName=state.spyName || "Unknown";
 const enoughPlayers=state.players.length>=3;
 const action=enoughPlayers
   ? (state.hostId===socket.id?`<button id="newRound" class="btn">Play another round</button>`:`<div class="small">Waiting for the host to start another round.</div>`)
   : (state.hostId===socket.id
      ?`<div class="notice">Not enough players remain for another round. Bring at least 3 players into the room.</div><button id="returnLobby" class="btn">Return to lobby</button>`
      :`<div class="notice">Not enough players remain for another round. Waiting for the host to return everyone to the lobby.</div>`);
 return `<div class="card"><div class="small">ROUND ${state.round} RESULT</div><div class="result">${msg}</div><p>The Spy was <b>${esc(spyName)}</b>.</p>${action}</div>`;
}
function bind(){
 $("start")?.addEventListener("click",()=>socket.emit("start"));

 $("newRound")?.addEventListener("click",()=>socket.emit("newRound"));
 $("returnLobby")?.addEventListener("click",()=>socket.emit("returnToLobby"));
 $("leave")?.addEventListener("click",leaveRoom);
 $("guessForm")?.addEventListener("submit",e=>{e.preventDefault();socket.emit("spyGuess",$("guessInput").value)});
 document.querySelectorAll("[data-vote]").forEach(b=>b.addEventListener("click",()=>socket.emit("vote",b.dataset.vote)));
}
function leaveRoom(){
  socket.disconnect();
  state=null;
  $("game").classList.add("hidden");
  $("home").classList.remove("hidden");
  $("roomBadge").classList.add("hidden");
  $("createName").value="";
  $("joinCode").value="";
  $("joinName").value="";
  setTimeout(()=>{ location.reload(); }, 0);
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
setInterval(()=>{if(state?.phase==="playing"&&state.endsAt){const n=Math.max(0,Math.ceil((state.endsAt-Date.now())/1000));const el=$("timer");if(el)el.textContent=n+"s";}},250);
