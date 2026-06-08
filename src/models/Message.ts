import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  senderId: { type: String, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  recipientId: { type: String, ref: 'User', required: true }, // 'all' represents Principal broadcasts
  recipientName: { type: String, required: true },
  recipientRole: { type: String, required: true },
  subject: { type: String, required: true },
  content: { type: String, required: true },
  attachmentPath: { type: String },
  attachmentName: { type: String },
  attachmentPublicId: { type: String },
  isRead: { type: Boolean, default: false },
  isImportant: { type: Boolean, default: false },
  type: { type: String, enum: ['direct', 'announcement'], default: 'direct' },
  internshipId: { type: String, ref: 'Internship' },
  parentMessageId: { type: String, ref: 'Message' },
  // Targeted messaging fields
  targetedStudentName: { type: String },
  targetedRollNumber: { type: String },
  targetedSemester: { type: String },
  targetedBranch: { type: String },
  targetedFacultyName: { type: String },
  targetedDepartment: { type: String },
  principalMsgType: { type: String, enum: ['approval_remark', 'clarification_request', 'official_notice', 'none'], default: 'none' },
  // Status tracking
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
}, { timestamps: true });

export const Message = mongoose.model('Message', MessageSchema);
