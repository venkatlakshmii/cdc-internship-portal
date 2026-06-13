import mongoose from 'mongoose';

const DbFileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
  size: { type: Number },
  uploadedAt: { type: Date, default: Date.now }
});

export const DbFile = mongoose.model('DbFile', DbFileSchema);
