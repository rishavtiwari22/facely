const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String
  },
  role: {
    type: String,
    enum: ['pending', 'staff', 'superadmin'],
    default: 'pending'
  },
  campus: {
    type: String, // Which campus the staff member has access to
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminUser', adminUserSchema);
