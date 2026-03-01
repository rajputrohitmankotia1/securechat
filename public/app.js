const socket = io();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let username = "";
let room = "";
let password = "";
let cryptoKey = null;
let selectedAvatar = "🦊";
let typingTimeout = null;

/* DOM */
const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");
const usernameInput = document.getElementById("usernameInput");
const roomInput = document.getElementById("roomInput");
const passwordInput = document.getElementById("passwordInput");
const joinBtn = document.getElementById("joinBtn");
const sendBtn = document.getElementById("sendBtn");
const msgInput = document.getElementById("msgInput");
const messages = document.getElementById("messages");
const userCount = document.getElementById("userCount");
const typingIndicator = document.getElementById("typingIndicator");
const roomName = document.getElementById("roomName");
const copyBtn = document.getElementById("copyBtn");
const logoutBtn = document.getElementById("logoutBtn");

/* Avatar */
document.querySelectorAll(".avatar-option").forEach(option => {
  option.addEventListener("click", () => {
    document.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
    option.classList.add("selected");
    selectedAvatar = option.dataset.avatar;
  });
});
document.querySelector(".avatar-option").classList.add("selected");

/* AUTO LOGIN */
window.addEventListener("load", async () => {
  const savedUser = localStorage.getItem("username");
  const savedRoom = localStorage.getItem("room");
  const savedPassword = localStorage.getItem("password");
  const savedAvatar = localStorage.getItem("avatar");

  if (savedUser && savedRoom && savedPassword && savedAvatar) {
    username = savedUser;
    room = savedRoom;
    password = savedPassword;
    selectedAvatar = savedAvatar;

    cryptoKey = await deriveKey(password);

    loginScreen.style.display = "none";
    chatScreen.style.display = "flex";
    roomName.innerText = "Room: " + room;

    socket.emit("join-room", { room, username, avatar: selectedAvatar });
  }
});

/* ENCRYPTION */
async function deriveKey(password) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("secure-salt"),
      iterations: 150000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptMessage(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(text)
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
}

async function decryptMessage(payload) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
    cryptoKey,
    new Uint8Array(payload.data)
  );
  return decoder.decode(decrypted);
}

/* JOIN */
joinBtn.addEventListener("click", async () => {
  username = usernameInput.value.trim();
  room = roomInput.value.trim();
  password = passwordInput.value.trim();

  if (!username || !room || !password) {
    alert("All fields required");
    return;
  }

  cryptoKey = await deriveKey(password);

  localStorage.setItem("username", username);
  localStorage.setItem("room", room);
  localStorage.setItem("password", password);
  localStorage.setItem("avatar", selectedAvatar);

  loginScreen.style.display = "none";
  chatScreen.style.display = "flex";
  roomName.innerText = "Room: " + room;

  socket.emit("join-room", { room, username, avatar: selectedAvatar });
});

/* LOGOUT */
logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  location.reload();
});

/* MESSAGE UI */
function addMessage(text, isMe = false, avatarIcon = "🙂") {
  const container = document.createElement("div");
  container.className = "message-row " + (isMe ? "me-row" : "");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerText = avatarIcon;

  const messageDiv = document.createElement("div");
  messageDiv.className = "message " + (isMe ? "me" : "other");

  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  messageDiv.innerHTML =
    `<div>${text}</div>
     <div class="timestamp">${time}</div>`;

  container.appendChild(avatar);
  container.appendChild(messageDiv);
  messages.appendChild(container);
  messages.scrollTop = messages.scrollHeight;
}

/* SEND */
sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  const finalText = username + ": " + text;
  const encrypted = await encryptMessage(finalText);

  socket.emit("send-message", { room, message: encrypted });
  addMessage(finalText, true, selectedAvatar);

  msgInput.value = "";
  stopTyping();
}

/* TYPING */
msgInput.addEventListener("input", () => {
  socket.emit("typing", room);
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 1000);
});

function stopTyping() {
  socket.emit("stop-typing", room);
}

/* SOCKET EVENTS */
socket.on("receive-message", async payload => {
  try {
    const decrypted = await decryptMessage(payload.message);
    addMessage(decrypted, false, payload.avatar);
  } catch {
    addMessage("⚠ Decryption failed", false);
  }
});

socket.on("update-users", users => {
  userCount.innerText = users.length + " user(s) online";
});

socket.on("show-typing", user => {
  typingIndicator.innerText = user + " is typing...";
});

socket.on("hide-typing", () => {
  typingIndicator.innerText = "";
});

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(window.location.href);
  alert("Room link copied!");
});