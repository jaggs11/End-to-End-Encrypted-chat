const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  room: { type: String, required: true, index: true },
  sender: { type: String, required: true },
  ciphertext: { type: String, required: true }, // encrypted message
  time: { type: Number, default: Date.now }
});
module.exports = mongoose.model('Message', schema);
