const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  secretHash: { type: String, required: true }, // bcrypt hash
  creator: { type: String, required: true },
  users: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Room', schema);
