import express from 'express';
import { uploadCloud } from '../middleware/uploadCloud.ts';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { Internship } from '../models/Internship.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';
import { calculateEligibility } from '../utils/eligibility.ts';
import { getModuleStatusInfo, memoryAcademicCalendar } from './portalControl.ts';
import { AcademicCalendar } from '../models/AcademicCalendar.ts';
import { User } from '../models/User.ts';

const router = express.Router();

async function detectConflict(fromDateStr: any, toDateStr: any) {
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);
  
  let calendar: any[] = [];
  if (mongoose.connection.readyState === 1) {
    calendar = await AcademicCalendar.find();
  } else {
    calendar = memoryAcademicCalendar;
  }

  // Filter exam/restriction events
  const examEvents = calendar.filter(e => 
    e.type === 'exam_internal' || 
    e.type === 'exam_mid' || 
    e.type === 'exam_semester' || 
    e.type === 'restriction'
  );

  const conflictingEvent = examEvents.find(event => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    end.setHours(23, 59, 59, 999);
    return from <= end && to >= start;
  });

  if (conflictingEvent) {
    return {
      hasConflict: true,
      details: `Academic Conflict Detected: Overlaps with ${conflictingEvent.title} (${new Date(conflictingEvent.startDate).toLocaleDateString()} to ${new Date(conflictingEvent.endDate).toLocaleDateString()})`
    };
  }

  return { hasConflict: false, details: '' };
}

async function createSystemNotification(studentId: string, subject: string, content: string, senderRole = 'system') {
  const alertMsg = {
    senderId: 'system-alert',
    senderName: senderRole === 'cdc' ? 'CDC Faculty' : (senderRole === 'principal' ? 'Principal' : 'System Control'),
    senderRole: senderRole,
    recipientId: studentId,
    recipientName: 'Student',
    recipientRole: 'student',
    subject: subject,
    content: content,
    type: 'direct',
    isRead: false,
    isImportant: true,
    status: 'sent',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    const student = await mongoose.model('User').findById(studentId);
    if (student) {
      alertMsg.recipientName = student.name;
    }
    const newAlert = new (mongoose.model('Message'))(alertMsg);
    await newAlert.save();
    console.log(`[NOTIFICATION SUCCESS] Sent DB notification to student: ${studentId}`);
  } catch (err) {
    console.error('Failed to save notification to DB:', err);
  }
}

function formatInternshipForFrontend(app: any) {
  if (!app) return app;
  const appObj = typeof app.toObject === 'function' ? app.toObject() : { ...app };
  
  // Format cdcRecommendation
  let cdcStatus = 'PENDING';
  let cdcRemarksVal = appObj.cdcRemarks || '';
  let cdcReviewedAtVal = appObj.updatedAt || new Date();
  
  if (typeof appObj.cdcRecommendation === 'string') {
    cdcStatus = appObj.cdcRecommendation.toUpperCase();
  } else if (appObj.cdcRecommendation && typeof appObj.cdcRecommendation === 'object') {
    cdcStatus = (appObj.cdcRecommendation.status || 'PENDING').toUpperCase();
    cdcRemarksVal = appObj.cdcRecommendation.remarks || cdcRemarksVal;
    cdcReviewedAtVal = appObj.cdcRecommendation.reviewedAt || cdcReviewedAtVal;
  }
  
  if (cdcStatus === 'APPROVED' || cdcStatus === 'APPROVED_BY_CDC' || appObj.currentStatus === 'CDC_APPROVED' || appObj.status === 'cdc_approved') {
    appObj.cdcRecommendation = 'Approved';
  } else if (cdcStatus === 'REJECTED') {
    appObj.cdcRecommendation = 'Rejected';
  } else if (cdcStatus === 'CLARIFICATION_REQUIRED' || cdcStatus === 'NEEDS CLARIFICATION' || cdcStatus === 'NEEDS_CLARIFICATION') {
    appObj.cdcRecommendation = 'Needs Clarification';
  } else {
    appObj.cdcRecommendation = 'Pending';
  }

  // Format principalDecision
  let principalStatus = 'PENDING';
  let principalRemarksVal = appObj.principalRemarks || '';
  let principalReviewedAtVal = appObj.updatedAt || new Date();
  
  if (typeof appObj.principalDecision === 'string') {
    principalStatus = appObj.principalDecision.toUpperCase();
  } else if (appObj.principalDecision && typeof appObj.principalDecision === 'object') {
    principalStatus = (appObj.principalDecision.status || 'PENDING').toUpperCase();
    principalRemarksVal = appObj.principalDecision.remarks || principalRemarksVal;
    principalReviewedAtVal = appObj.principalDecision.reviewedAt || principalReviewedAtVal;
  }

  if (principalStatus === 'APPROVED') {
    appObj.principalDecision = 'Approved';
  } else if (principalStatus === 'REJECTED') {
    appObj.principalDecision = 'Rejected';
  } else {
    appObj.principalDecision = 'Pending';
  }

  // Dynamically generate timeline
  const studentEntries = (appObj.timeline || []).filter((t: any) => t.role === 'student');
  if (studentEntries.length === 0) {
    studentEntries.push({
      status: 'Submitted by Student',
      updatedBy: appObj.studentDetails?.name || 'Student',
      role: 'student',
      remarks: 'Application submitted successfully',
      timestamp: appObj.createdAt || new Date()
    });
  }

  if (cdcStatus !== 'PENDING') {
    let cdcStatusText = '';
    if (cdcStatus === 'APPROVED' || cdcStatus === 'APPROVED_BY_CDC' || appObj.currentStatus === 'CDC_APPROVED' || appObj.status === 'cdc_approved') {
      cdcStatusText = 'CDC Approved Application';
    } else if (cdcStatus === 'REJECTED') {
      cdcStatusText = 'CDC Rejected Application';
    } else if (cdcStatus === 'CLARIFICATION_REQUIRED' || cdcStatus === 'NEEDS CLARIFICATION' || cdcStatus === 'NEEDS_CLARIFICATION') {
      cdcStatusText = 'Clarification Requested by CDC';
    }
    
    if (cdcStatusText) {
      studentEntries.push({
        status: cdcStatusText,
        updatedBy: 'CDC Faculty',
        role: 'cdc',
        remarks: cdcRemarksVal,
        timestamp: cdcReviewedAtVal
      });
    }
  }

  if (principalStatus !== 'PENDING') {
    let principalStatusText = '';
    if (principalStatus === 'APPROVED') {
      principalStatusText = 'Final Decision by Principal: Approved';
    } else if (principalStatus === 'REJECTED') {
      principalStatusText = 'Final Decision by Principal: Rejected';
    }
    
    if (principalStatusText) {
      studentEntries.push({
        status: principalStatusText,
        updatedBy: 'Principal',
        role: 'principal',
        remarks: principalRemarksVal,
        timestamp: principalReviewedAtVal
      });
    }
  }

  appObj.timeline = studentEntries;

  return appObj;
}

// Multer setup replaced with Cloudinary storage
const upload = uploadCloud;

// Student: Submit Application
router.post('/submit', authenticate, authorize(['student']), upload.fields([
  { name: 'offerLetter', maxCount: 1 },
  { name: 'joiningLetter', maxCount: 1 },
  { name: 'internshipProof', maxCount: 5 },
]), async (req: AuthRequest, res, next) => {
  try {
    const statusInfo = await getModuleStatusInfo();
    if (statusInfo.modules.applications !== 'active') {
      return res.status(403).json({ 
        message: statusInfo.warningMessage || 'New internship applications are temporarily restricted due to exam or institutional schedule.' 
      });
    }

    let body = req.body;
    if (req.body && typeof req.body.data === 'string') {
      try {
        body = JSON.parse(req.body.data);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid JSON format in request body.' });
      }
    }

    if (!body || !body.studentDetails || !body.internshipDetails) {
      return res.status(400).json({ message: 'Missing required student or internship details.' });
    }

    if (!body.internshipDetails.fromDate || isNaN(new Date(body.internshipDetails.fromDate).getTime())) {
      return res.status(400).json({ message: 'From Date is required and must be a valid date.' });
    }
    if (!body.internshipDetails.toDate || isNaN(new Date(body.internshipDetails.toDate).getTime())) {
      return res.status(400).json({ message: 'To Date is required and must be a valid date.' });
    }

    const files = req.files as any;
    const attendance = Number(body.studentDetails.attendancePercentage || 0);
    const proposedDuration = Number(body.internshipDetails.totalDuration || 0);

    if (proposedDuration > 6) {
      return res.status(400).json({ message: 'Internships with a duration of more than 6 months are not accepted.' });
    }

    const yearSem = body.studentDetails.year || '';
    
    // 1st Year Students Check
    if (yearSem.includes('1st Year')) {
      return res.status(400).json({ message: 'Students from 1st Year are not eligible for internships.' });
    }

    const is2ndYear = yearSem.includes('2nd Year');
    const is3rdYear1stSem = yearSem === '3rd Year – 1st Sem';
    const is3rdYear2ndSem = yearSem === '3rd Year – 2nd Sem';
    const is4thYear = yearSem.includes('4th Year');

    // Restrict mode for 2nd Year and 3rd Year 1st Sem
    if (is2ndYear || is3rdYear1stSem) {
      if (body.internshipDetails.mode !== 'In-House') {
        return res.status(400).json({ message: 'Students from 2nd Year – 1st Semester to 3rd Year – 1st Semester are eligible only for In-House Internships (Live Projects).' });
      }
    }

    // Critical Subject Selection check for 2nd Year students
    if (is2ndYear) {
      if (!body.criticalSubject || body.criticalSubject.trim() === '') {
        return res.status(400).json({ message: 'Critical subject selection is mandatory for 2nd Year students.' });
      }
    }

    const fromDate = new Date(body.internshipDetails.fromDate);
    const toDate = new Date(body.internshipDetails.toDate);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // 2nd Year students: max duration 4 weeks (28 days)
      if (is2ndYear && diffDays > 28) {
        return res.status(400).json({ message: 'Students from 2nd Year are allowed internships only for a maximum duration of 4 weeks (28 days).' });
      }

      // 3rd Year 2nd Sem students: max duration 3 months
      if (is3rdYear2ndSem && (diffDays > 92 || proposedDuration > 3)) {
        return res.status(400).json({ message: 'Students from 3rd Year – 2nd Semester are eligible for internships for a maximum duration of 3 months.' });
      }

      // 4th Year / General: max duration 6 months
      if (is4thYear && (diffDays > 185 || proposedDuration > 6)) {
        return res.status(400).json({ message: 'Internships with a duration of more than 6 months are not accepted.' });
      }
    }

    // Initial eligibility check based on attendance
    let eligibilityStatus = 'Pending CDC Review';
    if (attendance < 75) {
      eligibilityStatus = 'Not Eligible';
    }

    const conflict = await detectConflict(body.internshipDetails.fromDate, body.internshipDetails.toDate);

    const internshipData = {
      _id: new mongoose.Types.ObjectId().toString(),
      studentId: req.user?.id,
      rollNumber: body.studentDetails.rollNumber,
      studentEmail: req.user?.email || body.studentDetails.personalEmail,
      cdcStatus: 'Pending',
      principalStatus: 'Pending Review',
      ...body,
      status: 'SUBMITTED',
      currentStatus: 'SUBMITTED',
      proposedDuration: proposedDuration,
      attachments: {
        offerLetter: files?.offerLetter?.[0]?.path,
        joiningLetter: files?.joiningLetter?.[0]?.path,
        internshipProof: files?.internshipProof?.map((f: any) => f.path) || [],
      },
      cloudinaryPublicIds: {
        offerLetter: files?.offerLetter?.[0]?.filename,
        joiningLetter: files?.joiningLetter?.[0]?.filename,
        internshipProof: files?.internshipProof?.map((f: any) => f.filename) || [],
      },
      eligibilityStatus,
      finalStatus: 'Pending Principal Approval',
      cdcRecommendation: { status: 'PENDING', remarks: '' },
      principalDecision: { status: 'PENDING', remarks: '' },
      timeline: [{
        status: 'Submitted by Student',
        updatedBy: body.studentDetails?.name || 'Student',
        role: 'student',
        remarks: 'Application submitted successfully',
        timestamp: new Date()
      }],
      hasAcademicConflict: conflict.hasConflict,
      conflictDetails: conflict.details,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Auto notify Student, CDC and Principal about conflict
    if (conflict.hasConflict) {
      try {
        let cdcUsers = await User.find({ role: 'cdc' });
        let principalUsers = await User.find({ role: 'principal' });
        let studentName = body.studentDetails.name || 'Student';

        const alertMsg = {
          senderId: 'system-alert',
          senderName: 'System Control',
          senderRole: 'system',
          recipientId: req.user?.id || 'student-fallback-id',
          recipientName: studentName,
          recipientRole: 'student',
          subject: 'Academic Conflict Alert',
          content: `SYSTEM WARNING: Internship application for ${body.internshipDetails.companyName} by student ${studentName} (${body.studentDetails.rollNumber}) has triggered an Academic Conflict. Conflict Details: ${conflict.details}. CDC and Principal have been notified for manual review.`,
          type: 'direct',
          isRead: false,
          isImportant: true,
          status: 'sent',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const { Message } = await import('../models/Message.ts');
        const newAlert = new Message(alertMsg);
        await newAlert.save();
        
        for (const cdc of cdcUsers) {
          await new Message({
            ...alertMsg,
            recipientId: cdc._id,
            recipientName: cdc.name,
            recipientRole: 'cdc'
          }).save();
        }
        for (const principal of principalUsers) {
          await new Message({
            ...alertMsg,
            recipientId: principal._id,
            recipientName: principal.name,
            recipientRole: 'principal'
          }).save();
        }
      } catch (msgError) {
        console.error('Error generating academic conflict system notification:', msgError);
      }
    }

    const internship = new Internship(internshipData);
    await internship.save();
    console.log("Application Status:", internship.status);
    res.status(201).json({ message: 'Application submitted successfully', internship: formatInternshipForFrontend(internship) });
  } catch (error: any) {
    next(error);
  }
});

// Student: View Own Applications
router.get('/my-applications', authenticate, authorize(['student']), async (req: AuthRequest, res, next) => {
  try {
    const applications = await Internship.find({ studentId: req.user?.id });
    const populatedApps = await Promise.all(applications.map(async (app) => {
      console.log("Application Status:", app.status || 'pending');
      const conflict = await detectConflict(app.internshipDetails.fromDate, app.internshipDetails.toDate);
      const appObj = app.toObject();
      appObj.hasAcademicConflict = conflict.hasConflict || app.hasAcademicConflict;
      appObj.conflictDetails = conflict.details || app.conflictDetails;
      return formatInternshipForFrontend(appObj);
    }));
    res.json(populatedApps);
  } catch (error) {
    next(error);
  }
});

// Student/CDC/Principal: View Single Application Detail
router.get('/detail/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const internship = await Internship.findById(id).populate('studentId', 'name email');
    if (!internship) return res.status(404).json({ message: 'Internship not found' });
    
    const studentIdVal = internship.studentId as any;
    const ownerId = studentIdVal && typeof studentIdVal === 'object' && '_id' in studentIdVal
      ? studentIdVal._id.toString()
      : (studentIdVal ? studentIdVal.toString() : '');
    
    if (req.user?.role === 'student' && ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(formatInternshipForFrontend(internship));
  } catch (error) {
    next(error);
  }
});

// Student: Edit and Resubmit Application
router.put('/update/:id', authenticate, authorize(['student']), upload.fields([
  { name: 'offerLetter', maxCount: 1 },
  { name: 'joiningLetter', maxCount: 1 },
  { name: 'internshipProof', maxCount: 5 }
]), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    let body = req.body;
    if (req.body && typeof req.body.data === 'string') {
      try {
        body = JSON.parse(req.body.data);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid JSON format in request body.' });
      }
    }

    if (!body || !body.studentDetails || !body.internshipDetails) {
      return res.status(400).json({ message: 'Missing required student or internship details.' });
    }

    if (!body.internshipDetails.fromDate || isNaN(new Date(body.internshipDetails.fromDate).getTime())) {
      return res.status(400).json({ message: 'From Date is required and must be a valid date.' });
    }
    if (!body.internshipDetails.toDate || isNaN(new Date(body.internshipDetails.toDate).getTime())) {
      return res.status(400).json({ message: 'To Date is required and must be a valid date.' });
    }

    const existingApp = await Internship.findById(id);

    if (!existingApp) {
      return res.status(404).json({ message: 'Internship application not found' });
    }

    const ownerId = existingApp.studentId.toString();
    if (ownerId !== req.user?.id) {
      return res.status(403).json({ message: 'Forbidden: You do not own this application' });
    }

    const files = req.files as any;
    const attendance = Number(body.studentDetails.attendancePercentage || 0);
    const yearSem = body.studentDetails.year || '';
    const is2ndYear = yearSem.includes('2nd Year');
    const is3rdYear1stSem = yearSem === '3rd Year – 1st Sem';
    const is3rdYear2ndSem = yearSem === '3rd Year – 2nd Sem';
    const is4thYear = yearSem.includes('4th Year');

    if (is2ndYear || is3rdYear1stSem) {
      if (body.internshipDetails.mode !== 'In-House') {
        return res.status(400).json({ message: 'Students from 2nd Year – 1st Semester to 3rd Year – 1st Semester are eligible only for In-House Internships (Live Projects).' });
      }
    }

    if (is2ndYear && (!body.criticalSubject || body.criticalSubject.trim() === '')) {
      return res.status(400).json({ message: 'Critical subject selection is mandatory for 2nd Year students.' });
    }

    const fromDate = new Date(body.internshipDetails.fromDate);
    const toDate = new Date(body.internshipDetails.toDate);
    const proposedDuration = Number(body.internshipDetails.totalDuration || 0);

    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (is2ndYear && diffDays > 28) {
        return res.status(400).json({ message: 'Students from 2nd Year are allowed internships only for a maximum duration of 4 weeks (28 days).' });
      }
      if (is3rdYear2ndSem && (diffDays > 92 || proposedDuration > 3)) {
        return res.status(400).json({ message: 'Students from 3rd Year – 2nd Semester are eligible for internships for a maximum duration of 3 months.' });
      }
      if (is4thYear && (diffDays > 185 || proposedDuration > 6)) {
        return res.status(400).json({ message: 'Internships with a duration of more than 6 months are not accepted.' });
      }
    }

    const offerLetterPath = files?.offerLetter?.[0]?.path || existingApp.attachments?.offerLetter;
    const joiningLetterPath = files?.joiningLetter?.[0]?.path || existingApp.attachments?.joiningLetter;
    const internshipProofPaths = files?.internshipProof?.map((f: any) => f.path) || existingApp.attachments?.internshipProof || [];

    const offerLetterPublicId = files?.offerLetter?.[0]?.filename || existingApp.cloudinaryPublicIds?.offerLetter;
    const joiningLetterPublicId = files?.joiningLetter?.[0]?.filename || existingApp.cloudinaryPublicIds?.joiningLetter;
    const internshipProofPublicIds = files?.internshipProof?.map((f: any) => f.filename) || existingApp.cloudinaryPublicIds?.internshipProof || [];

    const updatedTimeline = existingApp.timeline || [];
    updatedTimeline.push({
      status: 'Resubmitted by Student',
      updatedBy: req.user?.email || 'Student',
      role: 'student',
      remarks: 'Application updated and resubmitted for review',
      timestamp: new Date()
    });

    const updatedData = {
      ...existingApp.toObject(),
      ...body,
      status: 'SUBMITTED',
      currentStatus: 'SUBMITTED',
      proposedDuration,
      attachments: {
        offerLetter: offerLetterPath,
        joiningLetter: joiningLetterPath,
        internshipProof: internshipProofPaths
      },
      cloudinaryPublicIds: {
        offerLetter: offerLetterPublicId,
        joiningLetter: joiningLetterPublicId,
        internshipProof: internshipProofPublicIds
      },
      rollNumber: body.studentDetails.rollNumber,
      studentEmail: req.user?.email || body.studentDetails.personalEmail,
      eligibilityStatus: 'Pending CDC Review',
      cdcRecommendation: { status: 'PENDING', remarks: '' },
      principalDecision: { status: 'PENDING', remarks: '' },
      finalStatus: 'Pending Principal Approval',
      cdcStatus: 'Pending',
      principalStatus: 'Pending Review',
      timeline: updatedTimeline,
      updatedAt: new Date()
    };

    await Internship.findByIdAndUpdate(id, updatedData);
    const updatedInternship = await Internship.findById(id);

    console.log("Application Status:", updatedInternship?.status);
    res.json({ message: 'Application updated successfully', internship: formatInternshipForFrontend(updatedInternship) });
  } catch (error: any) {
    next(error);
  }
});

// CDC: View All Applications
router.get('/all', authenticate, authorize(['cdc']), async (req, res, next) => {
  try {
    const { search, status, branch, year, type, startDate, endDate } = req.query;
    
    // Build query object
    const query: any = {};
    
    if (branch && branch !== 'all') {
      query['studentDetails.branch'] = branch;
    }
    if (year && year !== 'all') {
      query['studentDetails.year'] = new RegExp(String(year), 'i');
    }
    if (type && type !== 'all') {
      query['internshipDetails.mode'] = type;
    }
    
    if (startDate || endDate) {
      query['internshipDetails.fromDate'] = {};
      if (startDate) {
        query['internshipDetails.fromDate'].$gte = new Date(String(startDate));
      }
      if (endDate) {
        query['internshipDetails.fromDate'].$lte = new Date(String(endDate));
      }
    }
    
    if (status && status !== 'all') {
      const statusStr = String(status).toLowerCase();
      if (statusStr === 'pending') {
        query.eligibilityStatus = 'Pending CDC Review';
      } else if (statusStr === 'approved') {
        query.eligibilityStatus = { $in: ['Approved', '3 Months Approved', 'Conditionally Approved', '3 Months + 3 Months Extension'] };
      } else if (statusStr === 'not eligible') {
        query.eligibilityStatus = 'Not Eligible';
      } else {
        query.eligibilityStatus = new RegExp(statusStr, 'i');
      }
    }
    
    if (search) {
      const q = String(search).toLowerCase().trim();
      const rollMatch = q.match(/^([0-9]{2}e51a[0-9a-z]{4})@hitam\.org$/);
      const cleanSearch = rollMatch ? rollMatch[1] : q;
      query.$or = [
        { 'studentDetails.name': new RegExp(cleanSearch, 'i') },
        { 'studentDetails.rollNumber': new RegExp(cleanSearch, 'i') },
        { rollNumber: new RegExp(cleanSearch, 'i') },
        { studentEmail: new RegExp(cleanSearch, 'i') }
      ];
    }
    
    const applications = await Internship.find(query)
      .populate('studentId', 'name email')
      .lean();
      
    const populatedApps = await Promise.all(applications.map(async (app: any) => {
      console.log("Application Status:", app.status || 'pending');
      const conflict = await detectConflict(app.internshipDetails.fromDate, app.internshipDetails.toDate);
      app.hasAcademicConflict = conflict.hasConflict || app.hasAcademicConflict;
      app.conflictDetails = conflict.details || app.conflictDetails;
      return formatInternshipForFrontend(app);
    }));
    
    res.json(populatedApps);
  } catch (error) {
    next(error);
  }
});

// CDC: Update Bands and Eligibility
router.patch('/cdc-review/:id', authenticate, authorize(['cdc']), async (req: AuthRequest, res, next) => {
  try {
    const { spfBand, cdcBand, cdcRecommendation, cdcRemarks, action } = req.body;
    const rec = cdcRecommendation || (action === 'reject' ? 'Rejected' : 'Approved');
    const rems = cdcRemarks || (action === 'reject' ? 'Rejected by CDC' : '');

    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: 'Internship not found' });

    let finalEligibility = 'Pending CDC Review';
    let finalSpf = spfBand || 'A';
    let finalCdc = cdcBand || 'A';
    let permDuration = 0;

    if (rec === 'Rejected') {
      finalEligibility = 'Rejected by CDC – Pending Principal Review';
    } else if (rec === 'Needs Clarification') {
      finalEligibility = 'Clarification Required by CDC';
    } else {
      const result = calculateEligibility(
        internship.studentDetails.attendancePercentage,
        spfBand || 'A',
        cdcBand || 'A',
        internship.internshipDetails.totalDuration || 0
      );
      finalEligibility = result.eligibilityStatus;
      permDuration = result.permissibleDuration || 0;
    }

    internship.spfBand = finalSpf;
    internship.cdcBand = finalCdc;
    internship.permissibleDuration = permDuration;
    internship.eligibilityStatus = finalEligibility as any;
    
    let dbCdcStatus = 'PENDING';
    if (rec === 'Approved') dbCdcStatus = 'APPROVED';
    else if (rec === 'Rejected') dbCdcStatus = 'REJECTED';
    else if (rec === 'Needs Clarification') dbCdcStatus = 'CLARIFICATION_REQUIRED';
    
    internship.cdcRecommendation = {
      status: dbCdcStatus,
      remarks: rems,
      reviewedAt: new Date()
    };
    internship.cdcRemarks = rems;

    // Map recommendation to cdcStatus enum
    let cdcStatusVal = 'Pending';
    if (rec === 'Approved') {
      cdcStatusVal = 'Approved';
      internship.status = 'cdc_approved';
      internship.currentStatus = 'CDC_APPROVED';
      internship.principalDecision = { status: 'PENDING', remarks: '' };
    } else if (rec === 'Rejected') {
      cdcStatusVal = 'Rejected';
      internship.status = 'cdc_rejected';
      internship.currentStatus = 'CDC_REJECTED';
    } else if (rec === 'Needs Clarification') {
      cdcStatusVal = 'Needs Clarification';
      internship.status = 'clarification';
      internship.currentStatus = 'CLARIFICATION_REQUIRED';
    }
    internship.cdcStatus = cdcStatusVal as any;
    
    // Clear non-student entries to keep DB timeline clean
    internship.timeline = internship.timeline.filter((t: any) => t.role === 'student') as any;
    internship.markModified('timeline');

    await internship.save();
    console.log("Application Status:", internship.status);

    const notificationContent = rec === 'Needs Clarification'
      ? "CDC Department has requested clarification. Please meet the CDC office."
      : `CDC Faculty has reviewed your internship application for ${internship.internshipDetails.companyName}. Recommendation: ${rec}. Remarks: "${rems || 'None'}"`;

    // Send notification
    createSystemNotification(
      internship.studentId.toString(),
      'Internship CDC Review Notification',
      notificationContent,
      'cdc'
    ).catch(console.error);

    res.json({ message: 'CDC review updated', internship: formatInternshipForFrontend(internship) });
  } catch (error) {
    next(error);
  }
});

// Principal: View Forwarded Applications
router.get('/forwarded', authenticate, authorize(['principal']), async (req, res, next) => {
  try {
    const { search, branch, year, type, startDate, endDate } = req.query;
    
    // Build query object strictly matching cdcRecommendation.status = APPROVED/Approved or currentStatus = CDC_APPROVED
    const query: any = {
      $or: [
        { 'cdcRecommendation.status': 'APPROVED' },
        { 'cdcRecommendation.status': 'Approved' },
        { cdcRecommendation: 'Approved' },
        { cdcRecommendation: 'APPROVED' },
        { currentStatus: 'CDC_APPROVED' },
        { status: 'cdc_approved' }
      ]
    };
    
    if (branch && branch !== 'all') {
      query['studentDetails.branch'] = branch;
    }
    if (year && year !== 'all') {
      query['studentDetails.year'] = new RegExp(String(year), 'i');
    }
    if (type && type !== 'all') {
      query['internshipDetails.mode'] = type;
    }
    
    if (startDate || endDate) {
      query['internshipDetails.fromDate'] = {};
      if (startDate) {
        query['internshipDetails.fromDate'].$gte = new Date(String(startDate));
      }
      if (endDate) {
        query['internshipDetails.fromDate'].$lte = new Date(String(endDate));
      }
    }
    
    if (search) {
      const q = String(search).toLowerCase().trim();
      const rollMatch = q.match(/^([0-9]{2}e51a[0-9a-z]{4})@hitam\.org$/);
      const cleanSearch = rollMatch ? rollMatch[1] : q;
      query.$or = [
        { 'studentDetails.name': new RegExp(cleanSearch, 'i') },
        { 'studentDetails.rollNumber': new RegExp(cleanSearch, 'i') },
        { rollNumber: new RegExp(cleanSearch, 'i') },
        { studentEmail: new RegExp(cleanSearch, 'i') }
      ];
    }
    
    const page = req.query.page ? parseInt(req.query.page as string) : null;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
    
    let applicationsQuery = Internship.find(query).populate('studentId', 'name email');
    if (page && limit) {
      const skip = (page - 1) * limit;
      applicationsQuery = applicationsQuery.skip(skip).limit(limit);
    }
    
    const applications = await applicationsQuery.lean();
      
    const populatedApps = await Promise.all(applications.map(async (app: any) => {
      console.log("Application Status:", app.status || 'pending');
      const conflict = await detectConflict(app.internshipDetails.fromDate, app.internshipDetails.toDate);
      app.hasAcademicConflict = conflict.hasConflict || app.hasAcademicConflict;
      app.conflictDetails = conflict.details || app.conflictDetails;
      return formatInternshipForFrontend(app);
    }));
    
    res.json(populatedApps);
  } catch (error) {
    next(error);
  }
});

// Principal: Final Decision
router.patch('/principal-decision/:id', authenticate, authorize(['principal']), async (req: AuthRequest, res, next) => {
  try {
    const { finalStatus, remarks } = req.body;

    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: 'Internship not found' });

    let dbPrincipalStatus = 'PENDING';
    if (finalStatus === 'Approved') dbPrincipalStatus = 'APPROVED';
    else if (finalStatus === 'Rejected') dbPrincipalStatus = 'REJECTED';

    internship.finalStatus = finalStatus as any;
    internship.remarks = remarks;
    internship.principalDecision = {
      status: dbPrincipalStatus,
      remarks: remarks || '',
      reviewedAt: new Date()
    };
    internship.principalRemarks = remarks;
    internship.eligibilityStatus = finalStatus as any;

    // Map decision to principalStatus enum
    let principalStatusVal = 'Pending Review';
    if (finalStatus === 'Approved') {
      principalStatusVal = 'Approved';
      internship.status = 'principal_approved';
      internship.currentStatus = 'APPROVED';
    } else if (finalStatus === 'Rejected') {
      principalStatusVal = 'Rejected';
      internship.status = 'principal_rejected';
      internship.currentStatus = 'REJECTED';
    } else {
      internship.status = 'principal_pending';
      internship.currentStatus = 'PENDING';
    }
    internship.principalStatus = principalStatusVal as any;
    
    // Clear non-student entries to keep DB timeline clean
    internship.timeline = internship.timeline.filter((t: any) => t.role === 'student') as any;
    internship.markModified('timeline');
    
    await internship.save();
    console.log("Application Status:", internship.status);

    // Send notification
    createSystemNotification(
      internship.studentId.toString(),
      'Internship Final Decision Notification',
      `Principal has made a final decision on your internship application for ${internship.internshipDetails.companyName}. Decision: ${finalStatus}. Remarks: "${remarks || 'None'}"`,
      'principal'
    ).catch(console.error);

    res.json({ message: 'Principal decision updated', internship: formatInternshipForFrontend(internship) });
  } catch (error) {
    next(error);
  }
});

export default router;
