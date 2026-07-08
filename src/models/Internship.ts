import mongoose from 'mongoose';

const InternshipSchema = new mongoose.Schema({
  studentId: { type: String, ref: 'User', required: true },
  studentDetails: {
    date: { type: Date, default: Date.now },
    name: { type: String, required: true },
    rollNumber: { type: String, required: true },
    branch: { type: String, required: true },
    year: { type: String, required: true },
    section: { type: String, required: true },
    attendancePercentage: { type: Number, required: true },
    cgpa: { type: Number },
    contactNumber: { type: String },
    personalEmail: { type: String },
  },
  internshipDetails: {
    companyName: { type: String, required: true },
    website: { type: String },
    obtainedThrough: { type: String, required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    totalDuration: { type: Number }, // in months
    mode: { type: String, enum: ['Online', 'Offline', 'In-House'], required: true },
    location: { type: String, required: true },
    stipend: { type: String },
    ppo: { type: String, enum: ['Yes', 'No'], required: true },
    ctc: { type: String },
  },
  spocDetails: {
    name: { type: String, required: true },
    designation: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
  },
  attachments: {
    offerLetter: { type: String }, // path
    joiningLetter: { type: String }, // path
    internshipProof: [{ type: String }], // paths
  },
  cloudinaryPublicIds: {
    offerLetter: { type: String },
    joiningLetter: { type: String },
    internshipProof: [{ type: String }],
  },
  criticalSubject: { type: String },
  spfBand: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
  cdcBand: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
  verifiedAttendancePercentage: { type: Number },
  isAttendanceVerified: { type: Boolean, default: false },
  proposedDuration: { type: Number },
  permissibleDuration: { type: Number },
  eligibilityStatus: { 
    type: String, 
    enum: [
      'Pending CDC Review',
      // Computed by calculateEligibility utility
      '3 Months Approved', 'Conditionally Approved', '3 Months + 3 Months Extension',
      'Not Eligible',
      // Set by CDC review handler
      'Clarification Required by CDC',
      'Not Recommended by CDC – Pending Principal Review',
      'Rejected by CDC – Pending Principal Review',
      // Legacy / backward compat values that may exist in DB
      'Approved', 'Rejected', 'Need Clarification', 'Needs Clarification',
    ], 
    default: 'Pending CDC Review' 
  },
  finalStatus: { 
    type: String, 
    enum: ['Pending Principal Approval', 'Approved', 'Rejected', 'Request Changes', 'Put On Hold'], 
    default: 'Pending Principal Approval' 
  },
  status: {
    type: String,
    default: 'SUBMITTED'
  },
  remarks: { type: String },
  cdcRecommendation: {
    status: { type: String, default: 'PENDING' },
    remarks: { type: String, default: '' },
    reviewedAt: { type: Date }
  },
  cdcRemarks: { type: String, default: '' },
  principalDecision: {
    status: { type: String, default: 'PENDING' },
    remarks: { type: String, default: '' },
    reviewedAt: { type: Date }
  },
  principalRemarks: { type: String, default: '' },
  timeline: [{
    status: { type: String },
    updatedBy: { type: String },
    role: { type: String },
    remarks: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  hasAcademicConflict: { type: Boolean, default: false },
  conflictDetails: { type: String, default: '' },
  currentStatus: { type: String },
  rollNumber: { type: String, required: true },
  studentEmail: { type: String, required: true },
  cdcStatus: { type: String, enum: ['Pending', 'Recommended', 'Not Recommended', 'Need Clarification'], default: 'Pending' },
  principalStatus: { type: String, enum: ['Pending Review', 'Approved', 'Rejected'], default: 'Pending Review' },
}, { timestamps: true });

InternshipSchema.index({ studentId: 1 });
InternshipSchema.index({ rollNumber: 1 });
InternshipSchema.index({ studentEmail: 1 });
InternshipSchema.index({ cdcStatus: 1 });
InternshipSchema.index({ principalStatus: 1 });
InternshipSchema.index({ eligibilityStatus: 1 });
InternshipSchema.index({ finalStatus: 1 });
InternshipSchema.index({ 'studentDetails.branch': 1 });
InternshipSchema.index({ createdAt: -1 });
InternshipSchema.index({ status: 1 });
InternshipSchema.index({ 'cdcRecommendation.status': 1, 'principalDecision.status': 1 });

export const Internship = mongoose.model('Internship', InternshipSchema);
