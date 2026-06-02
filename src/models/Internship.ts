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
  spfBand: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
  cdcBand: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
  proposedDuration: { type: Number },
  permissibleDuration: { type: Number },
  eligibilityStatus: { 
    type: String, 
    enum: ['Pending CDC Review', 'Approved', 'Conditionally Approved', '3 Months Approved', '3 Months + 3 Months Extension', 'Not Eligible'], 
    default: 'Pending CDC Review' 
  },
  finalStatus: { 
    type: String, 
    enum: ['Pending Principal Approval', 'Approved', 'Rejected'], 
    default: 'Pending Principal Approval' 
  },
  remarks: { type: String },
}, { timestamps: true });

export const Internship = mongoose.model('Internship', InternshipSchema);
