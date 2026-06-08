import mongoose from 'mongoose';

const InternshipCompletionSchema = new mongoose.Schema({
  studentId: { type: String, ref: 'User', required: true },
  studentDetails: {
    name: { type: String, required: true },
    rollNumber: { type: String, required: true },
    year: { type: String, required: true },
    branch: { type: String, required: true },
  },
  completionDate: { type: Date, required: true },
  reportFilePath: { type: String, required: true },
  reportFileName: { type: String, required: true },
  reportPublicId: { type: String },
  certificateFilePath: { type: String, required: true },
  certificateFileName: { type: String, required: true },
  certificatePublicId: { type: String },
  studentRemarks: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Pending CDC Review', 'Pending Principal Approval', 'Approved', 'Rejected'], 
    default: 'Pending CDC Review' 
  },
  cdcRemarks: { type: String, default: '' },
  principalRemarks: { type: String, default: '' },
}, { timestamps: true });

export const InternshipCompletion = mongoose.model('InternshipCompletion', InternshipCompletionSchema);
