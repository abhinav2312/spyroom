const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const topics = [
  ["Airport", ["pilot","security","luggage","boarding","runway","passport","terminal"]],
  ["Beach", ["sand","waves","sunscreen","lifeguard","towel","surfboard","sunset"]],
  ["Restaurant", ["menu","chef","waiter","reservation","dessert","kitchen","bill"]],
  ["School", ["teacher","exam","classroom","homework","library","principal","student"]],
  ["Hospital", ["doctor","nurse","patient","medicine","ambulance","ward","surgery"]],
  ["Movie Set", ["actor","camera","director","script","scene","stunt","trailer"]],
  ["Space Station", ["astronaut","orbit","rocket","zero gravity","module","mission","helmet"]]
];

function code() {
  let c;
  do c = Math.random().toString(36).slice(2,6).toUpperCase();
  while (rooms.has(c));
  return c;
}
function publicState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    players: [...room.players.values()].map(p => ({id:p.id,name:p.name,alive:p.alive})),
    topic: room.phase === "playing" ? room.topic : null,
    question: room.question,
    endsAt: room.endsAt,
    votes: room.phase === "voting" ? Object.keys(room.votes).length : 0,
    round: room.round,
    winner: room.winner,
    spyName: room.phase === "result" ? room.spyName : null
  };
}
function emit(room) {
  for (const p of room.players.values()) {
    io.to(p.id).emit("state", {...publicState(room), isSpy: p.id === room.spyId});
  }
}
function startRound(room) {
  const ids=[...room.players.keys()];
  const [topic, words]=topics[Math.floor(Math.random()*topics.length)];
  room.topic=topic;
  room.spyId=ids[Math.floor(Math.random()*ids.length)];
  room.spyName=room.players.get(room.spyId)?.name || "Unknown";
  room.words=words;
  room.phase="playing";
  room.question=words[Math.floor(Math.random()*words.length)];
  room.endsAt=Date.now()+60000;
  room.votes={};
  room.winner=null;
  for (const p of room.players.values()) p.alive=true;
  emit(room);
}
function finishVoting(room) {
  const counts={};
  for (const target of Object.values(room.votes)) counts[target]=(counts[target]||0)+1;
  let max=0, eliminated=null, tie=false;
  for (const [id,n] of Object.entries(counts)) {
    if(n>max){max=n; eliminated=id; tie=false;}
    else if(n===max){tie=true;}
  }
  if (tie || !eliminated) {
    room.winner="spy";
    room.phase="result";
    room.endsAt=null;
    emit(room);
  } else if (eliminated===room.spyId) {
    room.phase="spyGuess";
    room.endsAt=null;
    emit(room);
  } else {
    room.winner="spy";
    room.phase="result";
    room.endsAt=null;
    emit(room);
  }
}
io.on("connection", socket => {
  socket.on("create", ({name}) => {
    name=String(name||"").trim().slice(0,18);
    if(!name) return socket.emit("errorMsg","Enter a name.");
    const c=code();
    const room={code:c,hostId:socket.id,players:new Map(),phase:"lobby",round:0,topic:null,spyId:null,question:null,endsAt:null,votes:{},winner:null};
    room.players.set(socket.id,{id:socket.id,name,alive:true});
    rooms.set(c,room); socket.join(c); socket.data.room=c; emit(room);
  });
  socket.on("join", ({code,name}) => {
    code=String(code||"").trim().toUpperCase();
    name=String(name||"").trim().slice(0,18);
    const room=rooms.get(code);
    if(!room) return socket.emit("errorMsg","Room not found.");
    if(room.phase!=="lobby") return socket.emit("errorMsg","That game has already started.");
    if(!name) return socket.emit("errorMsg","Enter a name.");
    if([...room.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase())) return socket.emit("errorMsg","That name is already taken.");
    if(room.players.size>=8) return socket.emit("errorMsg","Room is full.");
    room.players.set(socket.id,{id:socket.id,name,alive:true}); socket.join(code); socket.data.room=code; emit(room);
  });
  socket.on("start",()=>{
    const room=rooms.get(socket.data.room);
    if(!room || room.hostId!==socket.id || room.players.size<3) return;
    room.round++; startRound(room);
  });
  socket.on("nextQuestion",()=>{
    const room=rooms.get(socket.data.room);
    if(!room || room.phase!=="playing") return;
    room.question=room.words[Math.floor(Math.random()*room.words.length)];
    emit(room);
  });
  socket.on("vote", target=>{
    const room=rooms.get(socket.data.room);
    if(!room || room.phase!=="voting" || !room.players.has(socket.id) || !room.players.get(socket.id).alive) return;
    if(!room.players.has(target)) return;
    room.votes[socket.id]=target;
    if([...room.players.values()].filter(p=>p.alive).every(p=>room.votes[p.id])) finishVoting(room);
    else emit(room);
  });
  socket.on("spyGuess", guess => {
    const room=rooms.get(socket.data.room);
    if(!room || room.phase!=="spyGuess" || socket.id!==room.spyId) return;
    const normalized=String(guess||"").trim().toLowerCase();
    room.winner = normalized === String(room.topic||"").trim().toLowerCase() ? "spy" : "players";
    room.phase="result";
    room.endsAt=null;
    emit(room);
  });
  socket.on("newRound",()=>{
    const room=rooms.get(socket.data.room);
    if(!room || room.hostId!==socket.id || room.phase!=="result" || room.players.size<3) return;
    room.round++; startRound(room);
  });

  socket.on("returnToLobby",()=>{
    const room=rooms.get(socket.data.room);
    if(!room || room.hostId!==socket.id || room.phase!=="result") return;
    room.phase="lobby";
    room.topic=null;
    room.spyId=null;
    room.spyName=null;
    room.question=null;
    room.endsAt=null;
    room.votes={};
    room.winner=null;
    emit(room);
  });
  socket.on("disconnect",()=>{
    const c=socket.data.room, room=rooms.get(c);
    if(!room) return;

    const wasSpy = socket.id === room.spyId;
    const wasAlive = room.players.get(socket.id)?.alive;
    delete room.votes[socket.id];
    room.players.delete(socket.id);

    if(room.players.size===0){rooms.delete(c); return;}

    if(room.hostId===socket.id) room.hostId=room.players.keys().next().value;

    // If the Spy leaves during an active round, civilians win immediately.
    if((room.phase==="playing" || room.phase==="voting" || room.phase==="spyGuess") && wasSpy) {
      room.winner="players";
      room.phase="result";
      room.endsAt=null;
      emit(room);
      return;
    }

    // If someone leaves during voting, check whether all remaining alive players
    // have now voted so the round cannot get stuck waiting for a departed player.
    if(room.phase==="voting") {
      const alive=[...room.players.values()].filter(p=>p.alive);
      if(alive.length<3) {
        room.winner="players";
        room.phase="result";
        room.endsAt=null;
      } else if(alive.every(p=>room.votes[p.id])) {
        finishVoting(room);
        return;
      }
    }

    // If someone leaves during the Spy's final guess, the Spy is still given
    // the same final-guess opportunity; no vote state is carried forward.
    emit(room);
  });
});
setInterval(()=>{
  const now=Date.now();
  for(const room of rooms.values()){
    if(room.phase==="playing" && room.endsAt && now>=room.endsAt){
      room.phase="voting"; room.endsAt=null; room.votes={}; emit(room);
    }
  }
},500);
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Spy Room listening on ${PORT}`));
