const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  date: {
    type: String, // "YYYY-MM-DD"
    required: true
  },
  time: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    default: 'present'
  },
  confidence: {
    type: Number,
    required: true
  },
  markedBy: {
    type: String,
    enum: ['face', 'manual'],
    default: 'face'
  },
  slot: {
    type: Number,
    required: true,
    default: 1
  }
});

// Index on studentId, date, and slot for fast lookups
attendanceSchema.index({ studentId: 1, date: 1, slot: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
