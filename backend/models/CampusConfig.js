const mongoose = require('mongoose');

const campusConfigSchema = new mongoose.Schema({
  campusName: {
    type: String,
    required: true,
    unique: true
  },
  slots: [{
    slotNumber: { type: Number, required: true },
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  }],
  classes: [{
    type: String,
    trim: true
  }]
});

module.exports = mongoose.model('CampusConfig', campusConfigSchema);
