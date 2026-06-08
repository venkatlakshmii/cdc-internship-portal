import mongoose from 'mongoose';

const MonthlyReportSchema = new mongoose.Schema({
  studentId: { type: String, ref: 'User', required: true },
  studentDetails: {
    name: { type: String, required: true },
    rollNumber: { type: String, required: true },
    branch: { type: String, required: true },
  },
  month: { type: String, required: true }, // e.g. "June 2026"
  filePath: { type: String, required: true },
  fileName: { type: String, required: true },
  publicId: { type: String },
  status: { 
    type: String, 
    enum: ['Pending CDC Review', 'Pending Principal Approval', 'Approved', 'Rejected'], 
    default: 'Pending CDC Review' 
  },
  cdcRemarks: { type: String, default: '' },
  principalRemarks: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { timestamps: true });

export const MonthlyReport = mongoose.model('MonthlyReport', MonthlyReportSchema);
