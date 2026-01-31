const express = require('express');
const http = require('http');
const path = require('path');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
require('dotenv').config();

const Room = require('./Room');
const Message = require('./Message');

const MONGO = process.env.MONGO || 'mongodb://127.0.0.1:27017/e2ee_chat_upgraded';
mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=>console.log('MongoDB connected'))
  .catch(e=>console.error('Mongo connect err', e));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create room (stores hashed password + creator)
app.post('/create-room', async (req, res) => {
  const { room, password, creator } = req.body;
  if (!room || !password || !creator) return res.status(400).json({ error: 'room,password,creator required' });
  let r = await Room.findOne({ name: room });
  if (r) return res.status(400).json({ error: 'room exists' });
  const hash = await bcrypt.hash(password, 10);
  r = await Room.create({ name: room, secretHash: hash, creator });
  return res.json({ ok: true });
});

// Validate login (compare password)
app.post('/validate', async (req, res) => {
  const { room, password, username } = req.body;
  if (!room || !password || !username) return res.status(400).json({ error: 'room,password,username required' });
  const r = await Room.findOne({ name: room });
  if (!r) return res.status(404).json({ error: 'room not found' });
  const match = await bcrypt.compare(password, r.secretHash);
  if (!match) return res.status(401).json({ error: 'wrong password' });

  // add user to room document (optional persistent users)
  if (!r.users.includes(username)) {
    r.users.push(username);
    await r.save();
  }

  return res.json({ ok: true });
});

// Get last N messages for a room (ciphertexts)
app.get('/messages', async (req, res) => {
  const room = req.query.room;
  if (!room) return res.status(400).json({ error: 'room required' });
  const msgs = await Message.find({ room }).sort({ time: 1 }).limit(500).lean();
  return res.json({ ok: true, messages: msgs });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Socket.IO: server only relays ciphertext and stores it (server never decrypts)
io.on('connection', (socket) => {
  socket.on('join-room', ({ room, username }) => {
    socket.join(room);
    socket.data.username = username;
    socket.data.room = room;

    // broadcast join
    socket.to(room).emit('user-joined', { username, time: Date.now() });

    // send users list
    const clients = Array.from(io.sockets.adapter.rooms.get(room) || []).map(id => {
      const s = io.sockets.sockets.get(id);
      return s ? s.data.username : null;
    }).filter(Boolean);
    io.to(room).emit('room-users', clients);
  });

  socket.on('message', async ({ room, from, ciphertext, time }) => {
    // Save ciphertext to DB (server never decrypts)
    try {
      await Message.create({ room, sender: from, ciphertext, time: time || Date.now() });
    } catch (e) {
      console.error('msg save err', e);
    }
    // Broadcast ciphertext to room
    io.to(room).emit('message', { from, ciphertext, time: time || Date.now() });
  });

  socket.on('disconnect', () => {
    const { username, room } = socket.data || {};
    if (room && username) {
      socket.to(room).emit('user-left', { username, time: Date.now() });
      const clients = Array.from(io.sockets.adapter.rooms.get(room) || []).map(id => {
        const s = io.sockets.sockets.get(id);
        return s ? s.data.username : null;
      }).filter(Boolean);
      io.to(room).emit('room-users', clients);
      // optionally remove user from Room.users (left as persistent; could remove)
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log('Server running on', PORT));
