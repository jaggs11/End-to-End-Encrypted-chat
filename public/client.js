const socket = io();

const room = sessionStorage.getItem("e2ee_room");
const username = sessionStorage.getItem("e2ee_username");
const password = sessionStorage.getItem("e2ee_password");

if (!room || !username || !password) {
  alert("Missing session data.");
  location.href = "/";
}

document.getElementById("roomName").textContent = room;

// AES encryption
function encrypt(msg) {
  return CryptoJS.AES.encrypt(msg, password).toString();
}
function decrypt(cipher) {
  try {
    return CryptoJS.AES.decrypt(cipher, password).toString(CryptoJS.enc.Utf8);
  } catch {
    return null;
  }
}

// Load message history
fetch("/messages?room=" + encodeURIComponent(room))
  .then((r) => r.json())
  .then((d) => {
    if (d.ok) {
      d.messages.forEach((m) => {
        appendMessage(m.sender, decrypt(m.ciphertext), m.sender === username);
      });
    }
  });

socket.emit("join-room", { room, username });

// Events
socket.on("room-users", (users) => {
  const box = document.getElementById("users");
  box.innerHTML = users.map((u) => `<div>${u}</div>`).join("");
});

socket.on("user-joined", ({ username: u }) =>
  appendSystem(`${u} joined the chat`)
);

socket.on("user-left", ({ username: u }) =>
  appendSystem(`${u} left the chat`)
);

socket.on("message", ({ from, ciphertext }) => {
  appendMessage(from, decrypt(ciphertext), from === username);
});

// UI Functions
function appendMessage(from, text, me) {
  if (!text) text = "[Unable to decrypt]";

  const msg = document.createElement("div");
  msg.className = "msg-bubble " + (me ? "me" : "other");

  msg.innerHTML = `<b>${from}</b><br>${text}`;

  const m = document.getElementById("messages");
  m.appendChild(msg);
  m.scrollTop = m.scrollHeight;
}

function appendSystem(text) {
  const msg = document.createElement("div");
  msg.className = "sys-msg";
  msg.textContent = text;

  const m = document.getElementById("messages");
  m.appendChild(msg);
  m.scrollTop = m.scrollHeight;
}

// send
document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = document.getElementById("msg").value.trim();
  if (!t) return;

  const ciphertext = encrypt(t);
  socket.emit("message", { room, from: username, ciphertext, time: Date.now() });
  
  document.getElementById("msg").value = "";
});
