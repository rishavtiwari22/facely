const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  schoolEmail: {
    type: String,
    required: true,
    unique: true
  },
  campus: {
    type: String,
    required: true
  },
  rollNo: {
    type: String,
    required: true
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

// A roll number should be unique within a specific campus
studentSchema.index({ campus: 1, rollNo: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
