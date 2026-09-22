const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  rollNo: {
    type: String,
    required: true,
    unique: true
  },
  class: {
    type: String,
    required: true
  },
  embeddings: {
    type: [[Number]], // Array of arrays of numbers (multiple 128-d arrays)
    required: true
  }
}, {
  timestamps: true // adds createdAt and updatedAt
});

module.exports = mongoose.model('Student', studentSchema);
