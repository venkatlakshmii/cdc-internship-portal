import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'cdc', 'principal', 'Student', 'CDC', 'Principal'], default: 'student' },
  rollNumber: { type: String },
  branch: { type: String },
  year: { type: String },
  section: { type: String },
  attendancePercentage: { type: Number },
  cgpa: { type: Number },
  contactNumber: { type: String },
  personalEmail: { type: String },
  profileRegistered: { type: Boolean, default: false },
  passwordHashSha256: { type: String },
}, { timestamps: true });

UserSchema.index({ rollNumber: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ passwordHashSha256: 1 });

export const User = mongoose.model('User', UserSchema);
