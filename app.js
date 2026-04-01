import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue,
  onChildAdded,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBvk4riEC5qhNFNMA9O_rx-S1kAwrHzvbw",
  authDomain: "voteroast-57ecf.firebaseapp.com",
  projectId: "voteroast-57ecf",
  storageBucket: "voteroast-57ecf.firebasestorage.app",
  messagingSenderId: "654433059396",
  appId: "1:654433059396:web:8105dfa734d040ec4df211",
  databaseURL: "https://voteroast-57ecf-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const ROUND1_COUNT = 3;
const VOTE_TIME = 22000;
const ROAST_TIME = 7000;
const SUBMIT_TIME = 30000;
const GUESS_TIME = 22000;
const REVEAL_TIME = 7000;

const QUESTIONS = [
  "Sabse lazy kaun hai?",
  "Sabse zyada late reply kaun deta hai?",
  "Kaun sabse pehle party mein khana dhoondhta hai?",
  "Group ka drama magnet kaun hai?",
  "Sabse likely kaun awkward voice note bhejega?",
  "Kaun sabse pehle '5 min mein aaya' bolke 45 min late aata hai?",
  "Sabse zyada overthinking kaun karta hai?",
  "Kaun sabse likely cringe reel bana dega?",
  "Kaun bina reason ke full mysterious rehta hai?",
  "Kaun sabse likely group trip ka plan banake khud cancel karega?"
];

const MESSAGE_PROMPTS = [
  "Write one anonymous spicy line about this group 👀",
  "Drop the most sus 2AM text someone here would send 😵‍💫",
  "Write a fake but believable confession from someone in this room 😂",
  "Write the pettiest message possible for this group 🔥",
  "Write a shady compliment about one of your friends 😏"
];

const FALLBACK_MESSAGES = [
  "Main kuch nahi bol raha... but sab suspicious lag rahe ho 👀",
  "Aaj sach bolunga toh dosti toot jayegi 😂",
  "Jo sabse innocent lagta hai, wahi asli mastermind hai 😌",
  "Main bas itna bolunga: trust issues unlocked 🔥",
  "Yahan sab normal dikhte hain, par koi bhi normal nahi hai 💀"
];

const REACTIONS = ["😂", "🔥", "👀", "💀", "👏"];
const AVATARS = ["😎", "🤠", "🥷", "🧠", "🦄", "🐼", "🐸", "🫡", "👽", "🐯"];
const ROAST_LINES = [
  (name) => `${name} just unlocked a legendary title: Chief Executive of Chaos 😂`,
  (name) => `${name}, your vibe is “confidently wrong but very committed” 🔥`,
  (name) => `${name} got voted like the group had this stored in drafts for weeks 💀`,
  (name) => `${name} is proof that main character energy can also be accidental 👀`,
  (name) => `${name}, congratulations — today you are the people’s favorite problem 😎`,
  (name) => `${name} has been selected by public demand for premium roasting services 😂`
];

const $ = (id) => document.getElementById(id);

const els = {
  nicknameInput: $("nicknameInput"),
  joinCodeInput: $("joinCodeInput"),
  createRoomBtn: $("createRoomBtn"),
  joinRoomBtn: $("joinRoomBtn"),
  homeHint: $("homeHint"),

  homeView: $("homeView"),
  lobbyView: $("lobbyView"),
  gameView: $("gameView"),
  resultView: $("resultView"),

  lobbyRoomCode: $("lobbyRoomCode"),
  lobbyStatus: $("lobbyStatus"),
  lobbyCountdown: $("lobbyCountdown"),
  lobbyPlayers: $("lobbyPlayers"),
  startNowBtn: $("startNowBtn"),

  gameRoundPill: $("gameRoundPill"),
  gameTitle: $("gameTitle"),
  gameSubtitle: $("gameSubtitle"),
  gameTimer: $("gameTimer"),
  gameContent: $("gameContent"),

  championText: $("championText"),
  resultsSummary: $("resultsSummary"),
  resultsBoard: $("resultsBoard"),
  replayBtn: $("replayBtn"),

  roomPanel: $("roomPanel"),
  reactionPanel: $("reactionPanel"),
  miniRoomCode: $("miniRoomCode"),
  livePlayerCount: $("livePlayerCount"),
  miniPhase: $("miniPhase"),
  scoreStrip: $("scoreStrip"),
  reactionButtons: $("reactionButtons"),
  leaveRoomBtn: $("leaveRoomBtn"),

  toastContainer: $("toastContainer"),
  emojiLayer: $("emojiLayer")
};

const local = {
  playerId: sessionStorage.getItem("vr_player_id") || makeId(),
  avatar: sessionStorage.getItem("vr_avatar") || pick(AVATARS),
  name: localStorage.getItem("vr_name") || ""
};

sessionStorage.setItem("vr_player_id", local.playerId);
sessionStorage.setItem("vr_avatar", local.avatar);
els.nicknameInput.value = local.name;

let currentRoom = null;
let currentRoomCode = "";
let roomUnsub = null;
let reactionUnsub = null;
let connectedUnsub = null;
let joinTimestamp = 0;
let hostBusy = false;
let leavingRoom = false;

bindEvents();
renderReactionButtons();
showView("home");
setInterval(tickUI, 1000);

function bindEvents() {
  els.createRoomBtn.addEventListener("click", createRoom);
  els.joinRoomBtn.addEventListener("click", joinRoomFromInput);
  els.startNowBtn.addEventListener("click", () => amHost() && startGame());
  els.replayBtn.addEventListener("click", () => amHost() && replayGame());
  els.leaveRoomBtn.addEventListener("click", leaveRoom);

  els.joinCodeInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  });

  els.nicknameInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.slice(0, 18);
  });

  els.joinCodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinRoomFromInput();
  });

  els.nicknameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createRoom();
  });
}

function renderReactionButtons() {
  els.reactionButtons.innerHTML = REACTIONS.map(
    (emoji) => `<button class="reaction-btn" data-reaction="${emoji}" title="${emoji}">${emoji}</button>`
  ).join("");

  [...els.reactionButtons.querySelectorAll("[data-reaction]")].forEach((btn) => {
    btn.addEventListener("click", () => sendReaction(btn.dataset.reaction));
  });
}

async function createRoom() {
  const name = sanitizeName(els.nicknameInput.value);
  if (!name) {
    toast("Enter a nickname first.");
    return;
  }

  local.name = name;
  localStorage.setItem("vr_name", local.name);

  for (let i = 0; i < 8; i++) {
    const code = makeRoomCode();
    const roomSnap = await get(ref(db, `rooms/${code}`));

    if (!roomSnap.exists() || !Object.keys(roomSnap.val()?.players || {}).length) {
      const roomData = {
        code,
        createdAt: Date.now(),
        phase: "lobby",
        hostId: local.playerId,
        autoStartAt: 0,
        statusText: "Waiting for players...",
        players: {
          [local.playerId]: {
            id: local.playerId,
            name: local.name,
            avatar: local.avatar,
            score: 0,
            joinedAt: Date.now()
          }
        },
        round1: {
          questions: shuffle([...QUESTIONS]).slice(0, ROUND1_COUNT),
          index: 0,
          votes: {},
          currentResult: null,
          history: [],
          deadline: 0,
          roastEndsAt: 0
        },
        round2: {
          prompt: "",
          submissions: {},
          order: [],
          index: 0,
          guesses: {},
          currentReveal: null,
          history: [],
          submitDeadline: 0,
          guessDeadline: 0,
          revealEndsAt: 0
        },
        results: {}
      };

      await set(ref(db, `rooms/${code}`), roomData);
      await connectToRoom(code);
      popView(els.lobbyView);
      toast(`Room ${code} created.`);
      return;
    }
  }

  toast("Couldn't create room. Try again.");
}

async function joinRoomFromInput() {
  const name = sanitizeName(els.nicknameInput.value);
  const code = els.joinCodeInput.value.trim().toUpperCase();

  if (!name) {
    toast("Enter a nickname first.");
    return;
  }

  if (code.length < 4) {
    toast("Enter a valid room code.");
    return;
  }

  local.name = name;
  localStorage.setItem("vr_name", local.name);
  await connectToRoom(code);
}

async function connectToRoom(code) {
  const roomRefPath = ref(db, `rooms/${code}`);
  const snap = await get(roomRefPath);

  if (!snap.exists()) {
    toast("Room not found.");
    return;
  }

  const room = snap.val();
  const players = room.players || {};
  const alreadyInside = !!players[local.playerId];

  if (!alreadyInside && room.phase !== "lobby") {
    toast("Game already started. Wait for replay.");
    return;
  }

  if (!alreadyInside && Object.keys(players).length >= MAX_PLAYERS) {
    toast("Room is full.");
    return;
  }

  currentRoomCode = code;
  joinTimestamp = Date.now();
  leavingRoom = false;

  const playerData = alreadyInside
    ? {
        ...players[local.playerId],
        name: players[local.playerId].name || local.name,
        avatar: players[local.playerId].avatar || local.avatar
      }
    : {
        id: local.playerId,
        name: local.name,
        avatar: local.avatar,
        score: 0,
        joinedAt: Date.now()
      };

  await update(ref(db, `rooms/${code}/players`), {
    [local.playerId]: playerData
  });

  await setupPresence(code);
  subscribeToRoom(code);
  toast(`Joined room ${code}`);
}

async function setupPresence(code) {
  if (connectedUnsub) connectedUnsub();

  const connectedRef = ref(db, ".info/connected");
  const playerPath = ref(db, `rooms/${code}/players/${local.playerId}`);

  connectedUnsub = onValue(connectedRef, async (snap) => {
    if (snap.val() === true) {
      try {
        await onDisconnect(playerPath).remove();
      } catch (err) {
        console.error("onDisconnect failed:", err);
      }
    }
  });
}

function subscribeToRoom(code) {
  cleanupListeners(false);

  roomUnsub = onValue(ref(db, `rooms/${code}`), (snap) => {
    const room = snap.val();

    if (!room) {
      currentRoom = null;
      currentRoomCode = "";
      showView("home");
      els.roomPanel.classList.add("hidden");
      els.reactionPanel.classList.add("hidden");
      toast("Room closed.");
      return;
    }

    currentRoom = room;

    if (!currentRoom.players?.[local.playerId] && !leavingRoom) {
      currentRoom = null;
      currentRoomCode = "";
      showView("home");
      els.roomPanel.classList.add("hidden");
      els.reactionPanel.classList.add("hidden");
      toast("You were disconnected from the room.");
      return;
    }

    maybeClaimHost();
    render();
  });

  reactionUnsub = onChildAdded(ref(db, `rooms/${code}/reactions`), (snap) => {
    const payload = snap.val();
    if (!payload) return;
    if ((payload.at || 0) < joinTimestamp - 1200) return;
    spawnReaction(payload.emoji || "😂");
  });
}

function cleanupListeners(clearRoom = true) {
  if (roomUnsub) roomUnsub();
  if (reactionUnsub) reactionUnsub();
  roomUnsub = null;
  reactionUnsub = null;

  if (clearRoom) {
    currentRoom = null;
    currentRoomCode = "";
  }
}

async function leaveRoom() {
  if (!currentRoomCode) return;
  leavingRoom = true;

  try {
    await remove(ref(db, `rooms/${currentRoomCode}/players/${local.playerId}`));
  } catch (err) {
    console.error(err);
  }

  cleanupListeners(true);
  showView("home");
  els.roomPanel.classList.add("hidden");
  els.reactionPanel.classList.add("hidden");
  toast("Left the room.");
}

function tickUI() {
  if (!currentRoom) return;
  render();
  maybeClaimHost();
  if (amHost()) hostGameLoop();
}

function maybeClaimHost() {
  if (!currentRoom) return;
  const players = getPlayers("joined");
  if (!players.length) return;

  const currentHostMissing =
    !currentRoom.hostId || !currentRoom.players?.[currentRoom.hostId];

  if (currentHostMissing && players[0]?.id === local.playerId) {
    update(ref(db, `rooms/${currentRoom.code}`), { hostId: local.playerId });
  }
}

async function hostGameLoop() {
  if (!currentRoom || hostBusy) return;
  hostBusy = true;

  try {
    const players = getPlayers("joined");

    if (players.length < MIN_PLAYERS) {
      if (currentRoom.phase !== "lobby") {
        await update(ref(db, `rooms/${currentRoom.code}`), {
          phase: "lobby",
          autoStartAt: 0,
          statusText: "Need at least 2 players."
        });
      } else if (currentRoom.autoStartAt) {
        await update(ref(db, `rooms/${currentRoom.code}`), { autoStartAt: 0 });
      }
      return;
    }

    if (currentRoom.phase === "lobby") {
      if (!currentRoom.autoStartAt) {
        await update(ref(db, `rooms/${currentRoom.code}`), {
          autoStartAt: Date.now() + 8000,
          statusText: "Game auto-starting soon..."
        });
      } else if (Date.now() >= currentRoom.autoStartAt) {
        await startGame();
      }
      return;
    }

    if (currentRoom.phase === "vote") {
      const idx = currentRoom.round1?.index || 0;
      const votes = currentRoom.round1?.votes?.[idx] || {};
      if (
        Object.keys(votes).length >= players.length ||
        Date.now() >= (currentRoom.round1?.deadline || 0)
      ) {
        await resolveVoteRound();
      }
      return;
    }

    if (currentRoom.phase === "roast") {
      if (Date.now() >= (currentRoom.round1?.roastEndsAt || 0)) {
        const questions = indexedToArray(currentRoom.round1?.questions);
        const nextIndex = (currentRoom.round1?.index || 0) + 1;
        if (nextIndex < questions.length) {
          await startVoteQuestion(nextIndex);
        } else {
          await startSubmissionRound();
        }
      }
      return;
    }

    if (currentRoom.phase === "submit") {
      const submissions = currentRoom.round2?.submissions || {};
      if (
        Object.keys(submissions).length >= players.length ||
        Date.now() >= (currentRoom.round2?.submitDeadline || 0)
      ) {
        await startGuessRound();
      }
      return;
    }

    if (currentRoom.phase === "guess") {
      const order = indexedToArray(currentRoom.round2?.order);
      const idx = currentRoom.round2?.index || 0;
      const authorId = order[idx];
      const requiredGuessers = players.filter((p) => p.id !== authorId).length;
      const guesses = currentRoom.round2?.guesses?.[idx] || {};

      if (
        Object.keys(guesses).length >= requiredGuessers ||
        Date.now() >= (currentRoom.round2?.guessDeadline || 0)
      ) {
        await resolveGuessRound();
      }
      return;
    }

    if (currentRoom.phase === "reveal") {
      if (Date.now() >= (currentRoom.round2?.revealEndsAt || 0)) {
        const order = indexedToArray(currentRoom.round2?.order);
        const nextIndex = (currentRoom.round2?.index || 0) + 1;
        if (nextIndex < order.length) {
          await startGuessForIndex(nextIndex);
        } else {
          await finishGame();
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    hostBusy = false;
  }
}

async function startGame() {
  if (!currentRoom) return;
  const players = getPlayers("joined");
  const roomRoot = ref(db, `rooms/${currentRoom.code}`);
  const updates = {
    phase: "vote",
    autoStartAt: 0,
    statusText: "Round 1: Vote & Roast",
    "round1/questions": shuffle([...QUESTIONS]).slice(0, ROUND1_COUNT),
    "round1/index": 0,
    "round1/votes": {},
    "round1/currentResult": null,
    "round1/history": [],
    "round1/deadline": Date.now() + VOTE_TIME,
    "round1/roastEndsAt": 0,
    "round2/prompt": "",
    "round2/submissions": {},
    "round2/order": [],
    "round2/index": 0,
    "round2/guesses": {},
    "round2/currentReveal": null,
    "round2/history": [],
    "round2/submitDeadline": 0,
    "round2/guessDeadline": 0,
    "round2/revealEndsAt": 0,
    results: {}
  };

  players.forEach((player) => {
    updates[`players/${player.id}/score`] = 0;
  });

  await update(roomRoot, updates);
  blast("🚀");
}

async function replayGame() {
  if (!currentRoom) return;
  const players = getPlayers("joined");
  const updates = {
    phase: "lobby",
    autoStartAt: players.length >= MIN_PLAYERS ? Date.now() + 6000 : 0,
    statusText: "Rematch loading...",
    "round1/questions": shuffle([...QUESTIONS]).slice(0, ROUND1_COUNT),
    "round1/index": 0,
    "round1/votes": {},
    "round1/currentResult": null,
    "round1/history": [],
    "round1/deadline": 0,
    "round1/roastEndsAt": 0,
    "round2/prompt": "",
    "round2/submissions": {},
    "round2/order": [],
    "round2/index": 0,
    "round2/guesses": {},
    "round2/currentReveal": null,
    "round2/history": [],
    "round2/submitDeadline": 0,
    "round2/guessDeadline": 0,
    "round2/revealEndsAt": 0,
    results: {}
  };

  players.forEach((player) => {
    updates[`players/${player.id}/score`] = 0;
  });

  await update(ref(db, `rooms/${currentRoom.code}`), updates);
  blast("🎉");
}

async function startVoteQuestion(index) {
  await update(ref(db, `rooms/${currentRoom.code}`), {
    phase: "vote",
    statusText: `Vote question ${index + 1}`,
    "round1/index": index,
    "round1/currentResult": null,
    "round1/deadline": Date.now() + VOTE_TIME
  });
}

async function resolveVoteRound() {
  const room = currentRoom;
  const players = getPlayers("joined");
  const idx = room.round1?.index || 0;
  const question = indexedToArray(room.round1?.questions)[idx] || "Who is guilty?";
  const votes = room.round1?.votes?.[idx] || {};

  const tally = {};
  Object.values(votes).forEach((targetId) => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  let winnerId = null;

  if (Object.keys(tally).length) {
    const maxVotes = Math.max(...Object.values(tally));
    const winners = Object.keys(tally).filter((id) => tally[id] === maxVotes);
    winnerId = pick(winners);
  } else {
    winnerId = pick(players).id;
  }

  const increments = {};
  Object.entries(votes).forEach(([voterId, targetId]) => {
    if (targetId === winnerId) {
      increments[voterId] = (increments[voterId] || 0) + 10;
    }
  });
  increments[winnerId] = (increments[winnerId] || 0) + 5;

  const scoreUpdates = {};
  Object.entries(increments).forEach(([playerId, add]) => {
    const base = room.players?.[playerId]?.score || 0;
    scoreUpdates[`players/${playerId}/score`] = base + add;
  });

  const winnerName = room.players?.[winnerId]?.name || "Mystery Human";
  const roast = pick(ROAST_LINES)(winnerName);
  const history = indexedToArray(room.round1?.history);
  history.push({
    question,
    winnerId,
    winnerName,
    roast,
    tally,
    at: Date.now()
  });

  await update(ref(db, `rooms/${room.code}`), {
    phase: "roast",
    statusText: "Roast time 🔥",
    "round1/currentResult": {
      question,
      winnerId,
      winnerName,
      roast,
      tally
    },
    "round1/history": history,
    "round1/roastEndsAt": Date.now() + ROAST_TIME,
    ...scoreUpdates
  });

  blast("🔥");
}

async function startSubmissionRound() {
  await update(ref(db, `rooms/${currentRoom.code}`), {
    phase: "submit",
    statusText: "Round 2: Guess Who",
    "round2/prompt": pick(MESSAGE_PROMPTS),
    "round2/submissions": {},
    "round2/order": [],
    "round2/index": 0,
    "round2/guesses": {},
    "round2/currentReveal": null,
    "round2/submitDeadline": Date.now() + SUBMIT_TIME,
    "round2/guessDeadline": 0,
    "round2/revealEndsAt": 0
  });
  blast("🕵️");
}

async function startGuessRound() {
  const room = currentRoom;
  const players = getPlayers("joined");
  const submissions = { ...(room.round2?.submissions || {}) };

  players.forEach((player, i) => {
    if (!submissions[player.id]) {
      submissions[player.id] = {
        text: FALLBACK_MESSAGES[i % FALLBACK_MESSAGES.length],
        authorName: player.name,
        autoFilled: true
      };
    }
  });

  const order = shuffle(Object.keys(submissions));

  await update(ref(db, `rooms/${room.code}`), {
    phase: "guess",
    statusText: "Guess who wrote it 👀",
    "round2/submissions": submissions,
    "round2/order": order,
    "round2/index": 0,
    "round2/guesses": {},
    "round2/currentReveal": null,
    "round2/guessDeadline": Date.now() + GUESS_TIME
  });
}

async function startGuessForIndex(index) {
  await update(ref(db, `rooms/${currentRoom.code}`), {
    phase: "guess",
    statusText: "Guess who wrote it 👀",
    "round2/index": index,
    "round2/currentReveal": null,
    "round2/guessDeadline": Date.now() + GUESS_TIME
  });
}

async function resolveGuessRound() {
  const room = currentRoom;
  const players = getPlayers("joined");
  const idx = room.round2?.index || 0;
  const order = indexedToArray(room.round2?.order);
  const authorId = order[idx];
  const submission = room.round2?.submissions?.[authorId];

  if (!authorId || !submission) {
    await finishGame();
    return;
  }

  const guesses = room.round2?.guesses?.[idx] || {};
  const correctGuessers = Object.entries(guesses)
    .filter(([, guessId]) => guessId === authorId)
    .map(([playerId]) => playerId);

  const totalGuessers = players.filter((p) => p.id !== authorId).length;
  const fooledCount = Math.max(0, totalGuessers - correctGuessers.length);

  const increments = {};
  correctGuessers.forEach((id) => {
    increments[id] = (increments[id] || 0) + 15;
  });
  increments[authorId] = (increments[authorId] || 0) + fooledCount * 8;

  const scoreUpdates = {};
  Object.entries(increments).forEach(([playerId, add]) => {
    const base = room.players?.[playerId]?.score || 0;
    scoreUpdates[`players/${playerId}/score`] = base + add;
  });

  const history = indexedToArray(room.round2?.history);
  history.push({
    authorId,
    authorName: submission.authorName || room.players?.[authorId]?.name || "Unknown",
    text: submission.text,
    fooledCount,
    correctGuessers,
    at: Date.now()
  });

  await update(ref(db, `rooms/${room.code}`), {
    phase: "reveal",
    statusText: "Reveal time 😈",
    "round2/currentReveal": {
      authorId,
      authorName: submission.authorName || room.players?.[authorId]?.name || "Unknown",
      text: submission.text,
      fooledCount,
      correctGuessers
    },
    "round2/history": history,
    "round2/revealEndsAt": Date.now() + REVEAL_TIME,
    ...scoreUpdates
  });

  blast(correctGuessers.includes(local.playerId) ? "🎯" : "💥");
}

async function finishGame() {
  const players = getPlayers("score");
  const winner = players[0];

  await update(ref(db, `rooms/${currentRoom.code}`), {
    phase: "results",
    statusText: "Final results",
    results: {
      winnerId: winner?.id || null,
      winnerName: winner?.name || "No winner",
      finishedAt: Date.now()
    }
  });

  blast("🏆");
}

async function castVote(targetId) {
  if (!currentRoom || currentRoom.phase !== "vote") return;
  const idx = currentRoom.round1?.index || 0;
  await update(ref(db, `rooms/${currentRoom.code}`), {
    [`round1/votes/${idx}/${local.playerId}`]: targetId
  });
  spawnReaction("🔥");
}

async function submitAnonymousMessage() {
  if (!currentRoom || currentRoom.phase !== "submit") return;
  const textarea = document.getElementById("anonymousMessage");
  const text = textarea?.value?.trim();

  if (!text) {
    toast("Write something first.");
    return;
  }

  await update(ref(db, `rooms/${currentRoom.code}`), {
    [`round2/submissions/${local.playerId}`]: {
      text: text.slice(0, 140),
      authorName: local.name
    }
  });

  textarea.value = "";
  toast("Anonymous message locked in.");
  spawnReaction("😏");
}

async function castGuess(guessId) {
  if (!currentRoom || currentRoom.phase !== "guess") return;
  const idx = currentRoom.round2?.index || 0;
  await update(ref(db, `rooms/${currentRoom.code}`), {
    [`round2/guesses/${idx}/${local.playerId}`]: guessId
  });
  spawnReaction("👀");
}

async function sendReaction(emoji) {
  if (!currentRoomCode) return;
  await push(ref(db, `rooms/${currentRoomCode}/reactions`), {
    emoji,
    by: local.playerId,
    name: local.name,
    at: Date.now()
  });
}

function render() {
  if (!currentRoom) {
    showView("home");
    return;
  }

  els.roomPanel.classList.remove("hidden");
  els.reactionPanel.classList.remove("hidden");

  els.miniRoomCode.textContent = currentRoom.code;
  els.livePlayerCount.textContent = `${getPlayers("joined").length}/${MAX_PLAYERS}`;
  els.miniPhase.textContent = phaseLabel(currentRoom.phase);
  renderScoreStrip();

  if (currentRoom.phase === "lobby") {
    showView("lobby");
    renderLobby();
  } else if (currentRoom.phase === "results") {
    showView("results");
    renderResults();
  } else {
    showView("game");
    renderGame();
  }
}

function renderLobby() {
  const players = getPlayers("joined");
  const countdown =
    currentRoom.autoStartAt && players.length >= MIN_PLAYERS
      ? Math.max(0, Math.ceil((currentRoom.autoStartAt - Date.now()) / 1000))
      : null;

  els.lobbyRoomCode.textContent = currentRoom.code;
  els.lobbyStatus.textContent =
    players.length < MIN_PLAYERS
      ? "Waiting for at least 2 players..."
      : amHost()
      ? "You are the host. Starting soon."
      : "Host will start the madness shortly.";

  els.lobbyCountdown.textContent =
    players.length < MIN_PLAYERS ? "--" : countdown !== null ? `${countdown}s` : "Soon";

  els.startNowBtn.classList.toggle("hidden", !amHost());
  els.startNowBtn.disabled = players.length < MIN_PLAYERS;

  els.lobbyPlayers.innerHTML = players
    .map((player, index) => {
      const me = player.id === local.playerId;
      const host = player.id === currentRoom.hostId;
      return `
        <div class="player-card ${me ? "me" : ""}">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="text-3xl">${player.avatar || "😎"}</div>
              <div>
                <div class="font-bold text-white">${escapeHTML(player.name)}</div>
                <div class="mt-1 text-xs text-slate-400">
                  ${host ? "Host • " : ""}Player ${index + 1}
                  ${me ? " • You" : ""}
                </div>
              </div>
            </div>
            <div class="text-sm font-bold text-cyan-300">${player.score || 0} pts</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderGame() {
  const phase = currentRoom.phase;
  const players = getPlayers("joined");
  const timerValue = getCurrentTimer();
  els.gameTimer.textContent = timerValue;
  els.gameRoundPill.textContent = phasePill(phase);

  if (phase === "vote") {
    const idx = currentRoom.round1?.index || 0;
    const questions = indexedToArray(currentRoom.round1?.questions);
    const question = questions[idx] || "Who is the chaos goblin?";
    const votes = currentRoom.round1?.votes?.[idx] || {};
    const myVote = votes[local.playerId];

    els.gameTitle.textContent = question;
    els.gameSubtitle.textContent = `Vote for the best match. Votes in: ${Object.keys(votes).length}/${players.length}`;

    els.gameContent.innerHTML = `
      <div class="space-y-4">
        <div class="kicker">Question ${idx + 1} / ${questions.length}</div>
        <div class="grid gap-3 sm:grid-cols-2">
          ${players
            .filter((p) => p.id !== local.playerId)
            .map(
              (player) => `
                <button class="option-btn ${myVote === player.id ? "selected" : ""}" data-vote="${player.id}">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <span class="text-3xl">${player.avatar || "😎"}</span>
                      <div>
                        <div class="font-bold">${escapeHTML(player.name)}</div>
                        <div class="text-sm text-slate-400">Tap to accuse</div>
                      </div>
                    </div>
                    <div class="text-xl">${myVote === player.id ? "✅" : "👉"}</div>
                  </div>
                </button>
              `
            )
            .join("")}
        </div>
      </div>
    `;

    [...els.gameContent.querySelectorAll("[data-vote]")].forEach((btn) => {
      btn.addEventListener("click", () => castVote(btn.dataset.vote));
    });

    return;
  }

  if (phase === "roast") {
    const result = currentRoom.round1?.currentResult;
    els.gameTitle.textContent = `${result?.winnerName || "Someone"} got cooked`;
    els.gameSubtitle.textContent = result?.question || "Judgment has been delivered.";

    els.gameContent.innerHTML = `
      <div class="space-y-4">
        <div class="quote-card">
          <div class="mb-2 text-xs uppercase tracking-[0.25em] text-amber-300">Top voted player</div>
          <div class="text-3xl font-black text-white">${escapeHTML(result?.winnerName || "Mystery Human")}</div>
          <p class="mt-4 text-lg leading-8 text-slate-100">${escapeHTML(result?.roast || "No roast available.")}</p>
        </div>
        <div class="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100">
          Majority-match voters earned <strong>+10</strong> points. Roast target got <strong>+5 spotlight points</strong>.
        </div>
      </div>
    `;
    return;
  }

  if (phase === "submit") {
    const mySubmission = currentRoom.round2?.submissions?.[local.playerId];
    const prompt = currentRoom.round2?.prompt || "Write something suspicious.";

    els.gameTitle.textContent = "Anonymous message time";
    els.gameSubtitle.textContent = prompt;

    els.gameContent.innerHTML = mySubmission
      ? `
      <div class="space-y-4">
        <div class="quote-card">
          <div class="mb-2 text-xs uppercase tracking-[0.25em] text-cyan-300">Your anonymous message</div>
          <p class="text-lg leading-8 text-white">${escapeHTML(mySubmission.text)}</p>
        </div>
        <div class="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          Locked in. Now wait while everyone else exposes themselves 😏
        </div>
      </div>
    `
      : `
      <div class="space-y-4">
        <div class="quote-card">
          <div class="mb-2 text-xs uppercase tracking-[0.25em] text-cyan-300">Prompt</div>
          <p class="text-lg leading-8 text-white">${escapeHTML(prompt)}</p>
        </div>
        <div class="space-y-3">
          <textarea
            id="anonymousMessage"
            maxlength="140"
            placeholder="Write something hilarious, shady, or suspicious..."
            class="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          ></textarea>
          <button id="submitMessageBtn" class="btn-primary">📨 Submit anonymously</button>
        </div>
      </div>
    `;

    const submitBtn = document.getElementById("submitMessageBtn");
    if (submitBtn) submitBtn.addEventListener("click", submitAnonymousMessage);
    return;
  }

  if (phase === "guess") {
    const idx = currentRoom.round2?.index || 0;
    const order = indexedToArray(currentRoom.round2?.order);
    const authorId = order[idx];
    const submission = currentRoom.round2?.submissions?.[authorId];
    const guesses = currentRoom.round2?.guesses?.[idx] || {};
    const myGuess = guesses[local.playerId];

    els.gameTitle.textContent = `Guess Who #${idx + 1}`;
    els.gameSubtitle.textContent = `Guesses in: ${Object.keys(guesses).length}/${Math.max(0, players.length - 1)}`;

    if (!submission) {
      els.gameContent.innerHTML = `
        <div class="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
          Preparing the next mystery...
        </div>
      `;
      return;
    }

    if (authorId === local.playerId) {
      els.gameContent.innerHTML = `
        <div class="space-y-4">
          <div class="quote-card">
            <div class="mb-2 text-xs uppercase tracking-[0.25em] text-amber-300">Anonymous message</div>
            <p class="text-lg leading-8 text-white">${escapeHTML(submission.text)}</p>
          </div>
          <div class="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            This one is yours. Sit back and watch people overthink 😌
          </div>
        </div>
      `;
      return;
    }

    els.gameContent.innerHTML = `
      <div class="space-y-4">
        <div class="quote-card">
          <div class="mb-2 text-xs uppercase tracking-[0.25em] text-amber-300">Anonymous message</div>
          <p class="text-lg leading-8 text-white">"${escapeHTML(submission.text)}"</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          ${players
            .map(
              (player) => `
                <button class="option-btn ${myGuess === player.id ? "selected" : ""}" data-guess="${player.id}">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <span class="text-3xl">${player.avatar || "😎"}</span>
                      <div>
                        <div class
