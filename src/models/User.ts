import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'cdc', 'principal', 'hod', 'dean'], default: 'student' },
  rollNumber: { type: String },
  branch: { type: String },
  year: { type: String },
  section: { type: String },
  attendancePercentage: { type: Number },
  cgpa: { type: Number },
  contactNumber: { type: String },
  personalEmail: { type: String },
  profileRegistered: { type: Boolean, default: false },
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
