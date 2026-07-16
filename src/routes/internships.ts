import express from 'express';
import { uploadCloud } from '../middleware/uploadCloud.ts';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { Internship } from '../models/Internship.ts';
import { DbFile } from '../models/DbFile.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';
import { calculateEligibility } from '../utils/eligibility.ts';
import { getFormattedDuration } from '../utils/duration.ts';
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
  
  if (appObj.internshipDetails) {
    appObj.internshipDetails.durationDisplay = getFormattedDuration(
      appObj.internshipDetails.fromDate,
      appObj.internshipDetails.toDate,
      appObj.internshipDetails.totalDuration
    );
  }
  
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
  
  if (cdcStatus === 'RECOMMENDED' || cdcStatus === 'APPROVED' || cdcStatus === 'APPROVED_BY_CDC' || appObj.currentStatus === 'CDC_APPROVED' || appObj.status === 'cdc_approved') {
    appObj.cdcRecommendation = 'Recommended';
  } else if (cdcStatus === 'NOT_RECOMMENDED' || cdcStatus === 'REJECTED') {
    appObj.cdcRecommendation = 'Not Recommended';
  } else if (cdcStatus === 'CLARIFICATION_REQUIRED' || cdcStatus === 'NEEDS CLARIFICATION' || cdcStatus === 'NEEDS_CLARIFICATION' || cdcStatus === 'NEED_CLARIFICATION' || cdcStatus === 'NEED CLARIFICATION') {
    appObj.cdcRecommendation = 'Need Clarification';
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

  // Add principalApprovedMonths and principalRemarks
  let approvedMonths = appObj.permissibleDuration || 0;
  if (appObj.principalDecision === 'Approved' && approvedMonths === 0) {
    const proposed = appObj.internshipDetails?.totalDuration || 0;
    const yearSem = appObj.studentDetails?.year || '';
    const is2ndYear = yearSem.includes('2nd Year');
    const is3rdYear2ndSem = yearSem === '3rd Year – 2nd Sem';
    
    let limit = 6;
    if (is2ndYear) limit = 1;
    else if (is3rdYear2ndSem) limit = 3;
    
    approvedMonths = Math.min(proposed, limit);
    if (approvedMonths === 0) approvedMonths = proposed;
  }
  appObj.principalApprovedMonths = appObj.principalDecision === 'Approved' ? approvedMonths : 0;
  appObj.principalRemarks = principalRemarksVal || '';

  // Dynamically generate timeline
  const studentEntries = [];
  studentEntries.push({
    status: 'Submitted',
    updatedBy: appObj.studentDetails?.name || 'Student',
    role: 'student',
    remarks: 'Application submitted successfully',
    timestamp: appObj.createdAt || new Date()
  });

  if (cdcStatus !== 'PENDING') {
    studentEntries.push({
      status: 'CDC Reviewed',
      updatedBy: 'CDC Faculty',
      role: 'cdc',
      remarks: cdcRemarksVal ? `Recommendation: ${appObj.cdcRecommendation}. Remarks: ${cdcRemarksVal}` : `Recommendation: ${appObj.cdcRecommendation}`,
      timestamp: cdcReviewedAtVal
    });
  }

  if (appObj.hodStatus && appObj.hodStatus !== 'Pending') {
    studentEntries.push({
      status: `HOD Reviewed: ${appObj.hodStatus}`,
      updatedBy: appObj.hodReviewedBy || 'HOD',
      role: 'hod',
      remarks: appObj.hodComments ? `Comments: ${appObj.hodComments}` : `HOD Decision: ${appObj.hodStatus}`,
      timestamp: appObj.hodReviewedAt || appObj.updatedAt
    });
  }

  if (principalStatus !== 'PENDING') {
    studentEntries.push({
      status: 'Principal Final Decision',
      updatedBy: 'Principal',
      role: 'principal',
      remarks: principalRemarksVal ? `Decision: ${appObj.principalDecision}. Remarks: ${principalRemarksVal}` : `Decision: ${appObj.principalDecision}`,
      timestamp: principalReviewedAtVal
    });
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
    const attendance = Math.round(Number(body.studentDetails.attendancePercentage || 0) * 100) / 100;
    body.studentDetails.attendancePercentage = attendance;
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
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfFromDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      const daysPrior = Math.ceil((startOfFromDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
      if (daysPrior < 15) {
        return res.status(400).json({ message: 'Internship applications must be submitted at least 15 days prior to the internship start date.' });
      }

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

    let offerLetterPath = '';
    let offerLetterId = '';
    if (files?.offerLetter?.[0]) {
      const f = files.offerLetter[0];
      const dbFile = new DbFile({
        filename: f.originalname,
        contentType: f.mimetype,
        data: f.buffer,
        size: f.size
      });
      await dbFile.save();
      offerLetterPath = `api/files/download/${dbFile._id}`;
      offerLetterId = dbFile._id.toString();
    }

    let joiningLetterPath = '';
    let joiningLetterId = '';
    if (files?.joiningLetter?.[0]) {
      const f = files.joiningLetter[0];
      const dbFile = new DbFile({
        filename: f.originalname,
        contentType: f.mimetype,
        data: f.buffer,
        size: f.size
      });
      await dbFile.save();
      joiningLetterPath = `api/files/download/${dbFile._id}`;
      joiningLetterId = dbFile._id.toString();
    }

    const internshipProofPaths = [];
    const internshipProofIds = [];
    if (files?.internshipProof) {
      for (const f of files.internshipProof) {
        const dbFile = new DbFile({
          filename: f.originalname,
          contentType: f.mimetype,
          data: f.buffer,
          size: f.size
        });
        await dbFile.save();
        internshipProofPaths.push(`api/files/download/${dbFile._id}`);
        internshipProofIds.push(dbFile._id.toString());
      }
    }

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
        offerLetter: offerLetterPath,
        joiningLetter: joiningLetterPath,
        internshipProof: internshipProofPaths,
      },
      cloudinaryPublicIds: {
        offerLetter: offerLetterId,
        joiningLetter: joiningLetterId,
        internshipProof: internshipProofIds,
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

    if (req.user?.role === 'hod') {
      const hod = await User.findById(req.user.id);
      if (!hod) return res.status(404).json({ message: 'HOD user not found' });
      
      const studentBranch = (internship.studentDetails?.branch || '').toUpperCase().trim();
      const hodBranch = (hod.branch || '').toUpperCase().trim();
      
      const branchMatches = hodBranch === 'MECH'
        ? (studentBranch === 'MECH' || studentBranch === 'ME')
        : (studentBranch === hodBranch);
        
      if (!branchMatches) {
        return res.status(403).json({ message: 'Forbidden: You can only view applications from your department.' });
      }
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
    const attendance = Math.round(Number(body.studentDetails.attendancePercentage || 0) * 100) / 100;
    body.studentDetails.attendancePercentage = attendance;
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
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfFromDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      const daysPrior = Math.ceil((startOfFromDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
      if (daysPrior < 15) {
        return res.status(400).json({ message: 'Internship applications must be submitted at least 15 days prior to the internship start date.' });
      }

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

    let offerLetterPath = existingApp.attachments?.offerLetter;
    let offerLetterPublicId = existingApp.cloudinaryPublicIds?.offerLetter;
    if (files?.offerLetter?.[0]) {
      const f = files.offerLetter[0];
      const dbFile = new DbFile({
        filename: f.originalname,
        contentType: f.mimetype,
        data: f.buffer,
        size: f.size
      });
      await dbFile.save();
      offerLetterPath = `api/files/download/${dbFile._id}`;
      offerLetterPublicId = dbFile._id.toString();
    }

    let joiningLetterPath = existingApp.attachments?.joiningLetter;
    let joiningLetterPublicId = existingApp.cloudinaryPublicIds?.joiningLetter;
    if (files?.joiningLetter?.[0]) {
      const f = files.joiningLetter[0];
      const dbFile = new DbFile({
        filename: f.originalname,
        contentType: f.mimetype,
        data: f.buffer,
        size: f.size
      });
      await dbFile.save();
      joiningLetterPath = `api/files/download/${dbFile._id}`;
      joiningLetterPublicId = dbFile._id.toString();
    }

    let internshipProofPaths = existingApp.attachments?.internshipProof || [];
    let internshipProofPublicIds = existingApp.cloudinaryPublicIds?.internshipProof || [];
    if (files?.internshipProof) {
      const paths = [];
      const ids = [];
      for (const f of files.internshipProof) {
        const dbFile = new DbFile({
          filename: f.originalname,
          contentType: f.mimetype,
          data: f.buffer,
          size: f.size
        });
        await dbFile.save();
        paths.push(`api/files/download/${dbFile._id}`);
        ids.push(dbFile._id.toString());
      }
      internshipProofPaths = paths;
      internshipProofPublicIds = ids;
    }

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
export const getAllApplications = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const { search, status, branch, year, type, startDate, endDate } = req.query;
    
    // Build query object
    const query: any = {};
    
    if (branch && branch !== 'all') {
      query['studentDetails.branch'] = branch;
    }
    if (year && year !== 'all') {
      query['studentDetails.year'] = new RegExp(String(year) + ' Year', 'i');
    }
    if (type && type !== 'all') {
      query['internshipDetails.mode'] = type;
    }
    
    // Date filter on submission date (createdAt), not internship start date
    if (startDate || endDate) {
      query['createdAt'] = {};
      if (startDate) {
        const [year, month, day] = String(startDate).split('-').map(Number);
        query['createdAt'].$gte = new Date(year, month - 1, day, 0, 0, 0, 0);
      }
      if (endDate) {
        const [year, month, day] = String(endDate).split('-').map(Number);
        query['createdAt'].$lte = new Date(year, month - 1, day, 23, 59, 59, 999);
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
      const rollMatch = q.match(/^([a-z0-9]{10})@hitam\.org$/);
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
};
router.get('/all', authenticate, authorize(['cdc']), getAllApplications);

// CDC: Update Bands and Eligibility
export const handleCdcReview = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const { spfBand, cdcBand, cdcRecommendation, cdcRemarks, action, verifiedAttendancePercentage } = req.body;
    const rec = cdcRecommendation || (action === 'reject' ? 'Rejected' : 'Approved');
    const rems = cdcRemarks || (action === 'reject' ? 'Rejected by CDC' : '');

    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: 'Internship not found' });

    const studentAttendance = Number(internship.studentDetails.attendancePercentage || 0);
    const verifiedAttendance = verifiedAttendancePercentage !== undefined ? Number(verifiedAttendancePercentage) : studentAttendance;

    const studentPct = Number(studentAttendance.toFixed(2));
    const verifiedPct = Number(verifiedAttendance.toFixed(2));
    const attendanceMatches = (studentPct === verifiedPct);

    internship.verifiedAttendancePercentage = verifiedPct;
    internship.isAttendanceVerified = attendanceMatches;

    if (!attendanceMatches) {
      await createSystemNotification(
        internship.studentId.toString(),
        'Attendance Verification Discrepancy',
        'Your attendance has not been verified. Please visit the department and discuss the discrepancy.',
        'cdc'
      ).catch(console.error);
    }

    let finalEligibility = 'Pending CDC Review';
    let finalSpf = spfBand || 'A';
    let finalCdc = cdcBand || 'A';
    let permDuration = 0;

    const recStr = String(rec).trim().toLowerCase();
    if (recStr === 'not recommended') {
      finalEligibility = 'Not Recommended by CDC – Pending Principal Review';
    } else if (recStr === 'need clarification' || recStr === 'clarification') {
      finalEligibility = 'Clarification Required by CDC';
    } else {
      const result = calculateEligibility(
        verifiedPct,
        spfBand || 'A',
        cdcBand || 'A',
        internship.internshipDetails.totalDuration || 0,
        internship.studentDetails.year || ''
      );
      finalEligibility = result.eligibilityStatus;
      permDuration = result.permissibleDuration || 0;
    }

    internship.spfBand = finalSpf;
    internship.cdcBand = finalCdc;
    internship.permissibleDuration = permDuration;
    internship.eligibilityStatus = finalEligibility as any;
    
    let dbCdcStatus = 'PENDING';
    let cdcStatusVal = 'Pending';
    let timelineAction = 'CDC Action';
    
    if (recStr === 'recommended') {
      dbCdcStatus = 'RECOMMENDED';
      cdcStatusVal = 'Recommended';
      internship.status = 'cdc_approved';
      internship.currentStatus = 'CDC_APPROVED';
      internship.principalDecision = { status: 'PENDING', remarks: '' };
      internship.principalStatus = 'Pending Review' as any;
      internship.finalStatus = 'Pending Principal Approval' as any;
      timelineAction = 'CDC Recommended';
    } else if (recStr === 'not recommended') {
      dbCdcStatus = 'NOT_RECOMMENDED';
      cdcStatusVal = 'Not Recommended';
      internship.status = 'cdc_rejected';
      internship.currentStatus = 'CDC_REJECTED';
      internship.principalDecision = { status: 'PENDING', remarks: '' };
      internship.principalStatus = 'Pending Review' as any;
      internship.finalStatus = 'Pending Principal Approval' as any;
      timelineAction = 'CDC Not Recommended';
    } else if (recStr === 'need clarification' || recStr === 'clarification') {
      dbCdcStatus = 'CLARIFICATION_REQUIRED';
      cdcStatusVal = 'Need Clarification';
      internship.status = 'clarification';
      internship.currentStatus = 'CLARIFICATION_REQUIRED';
      internship.principalDecision = { status: 'PENDING', remarks: '' };
      internship.principalStatus = 'Pending Review' as any;
      internship.finalStatus = 'Pending Principal Approval' as any;
      timelineAction = 'Clarification Requested by CDC';
    }
    
    internship.cdcRecommendation = {
      status: dbCdcStatus,
      remarks: rems,
      reviewedAt: new Date()
    };
    internship.cdcRemarks = rems;
    internship.cdcStatus = cdcStatusVal as any;
    
    // Clear legacy timeline entries of same type before pushing to keep history clean
    internship.timeline = internship.timeline.filter((t: any) => t.role === 'student') as any;
    
    internship.timeline.push({
      action: timelineAction,
      by: 'CDC',
      timestamp: new Date(),
      status: timelineAction,
      updatedBy: req.user?.email || 'CDC Faculty',
      role: 'cdc',
      remarks: rems
    } as any);
    
    internship.markModified('timeline');

    await internship.save();
    
    // Add debug logs
    console.log("CDC APPROVED:", internship._id);
    console.log("Current Status:", internship.currentStatus);

    // Refresh from MongoDB to get fresh document state
    const refreshedInternship = await Internship.findById(internship._id);
    const finalInternship = refreshedInternship || internship;

    const notificationContent = rec === 'Needs Clarification'
      ? "CDC Department has requested clarification. Please meet the CDC office."
      : `CDC Faculty has reviewed your internship application for ${finalInternship.internshipDetails.companyName}. Recommendation: ${rec}. Remarks: "${rems || 'None'}"`;

    // Send notification
    createSystemNotification(
      finalInternship.studentId.toString(),
      'Internship CDC Review Notification',
      notificationContent,
      'cdc'
    ).catch(console.error);

    res.json({ message: 'CDC review updated', internship: formatInternshipForFrontend(finalInternship) });
  } catch (error) {
    next(error);
  }
};
router.patch('/cdc-review/:id', authenticate, authorize(['cdc']), handleCdcReview);

// Principal: View Forwarded Applications
export const getForwardedApplications = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const { search, branch, year, type, startDate, endDate } = req.query;
    
    // Status conditions for forwarded applications (all reviewed applications)
    const statusQuery = {
      $and: [
        { 'cdcRecommendation.status': { $ne: 'PENDING' } },
        { cdcRecommendation: { $ne: 'PENDING' } },
        {
          $or: [
            {
              $and: [
                { spfBand: { $nin: ['C', 'D'] } },
                { cdcBand: { $nin: ['C', 'D'] } }
              ]
            },
            { hodStatus: { $ne: 'Pending' } }
          ]
        }
      ]
    };

    const query: any = {
      $and: [statusQuery]
    };
    
    if (branch && branch !== 'all') {
      query['studentDetails.branch'] = branch;
    }
    if (year && year !== 'all') {
      query['studentDetails.year'] = new RegExp(String(year) + ' Year', 'i');
    }
    if (type && type !== 'all') {
      query['internshipDetails.mode'] = type;
    }
    
    // Date filter on submission date (createdAt), not internship start date
    if (startDate || endDate) {
      query['createdAt'] = {};
      if (startDate) {
        const [year, month, day] = String(startDate).split('-').map(Number);
        query['createdAt'].$gte = new Date(year, month - 1, day, 0, 0, 0, 0);
      }
      if (endDate) {
        const [year, month, day] = String(endDate).split('-').map(Number);
        query['createdAt'].$lte = new Date(year, month - 1, day, 23, 59, 59, 999);
      }
    }
    
    if (search) {
      const q = String(search).toLowerCase().trim();
      const rollMatch = q.match(/^([a-z0-9]{10})@hitam\.org$/);
      const cleanSearch = rollMatch ? rollMatch[1] : q;
      query.$and.push({
        $or: [
          { 'studentDetails.name': new RegExp(cleanSearch, 'i') },
          { 'studentDetails.rollNumber': new RegExp(cleanSearch, 'i') },
          { rollNumber: new RegExp(cleanSearch, 'i') },
          { studentEmail: new RegExp(cleanSearch, 'i') }
        ]
      });
    }
    
    const page = req.query.page ? parseInt(req.query.page as string) : null;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
    
    console.log("Principal Fetch Query:", JSON.stringify(query, null, 2));

    let applicationsQuery = Internship.find(query).populate('studentId', 'name email').sort({ createdAt: -1 });
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
    
    // Add debug logs
    console.log("Principal Fetch Result:", applications.length);
    
    res.json(populatedApps);
  } catch (error) {
    next(error);
  }
};
router.get('/forwarded', authenticate, authorize(['principal']), getForwardedApplications);

// Principal: Final Decision
export const handlePrincipalDecision = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const { finalStatus, remarks } = req.body;

    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: 'Internship not found' });

    const statusStr = String(finalStatus).trim().toLowerCase();
    let dbPrincipalStatus = 'PENDING';
    if (statusStr === 'approved') dbPrincipalStatus = 'APPROVED';
    else if (statusStr === 'rejected') dbPrincipalStatus = 'REJECTED';

    internship.finalStatus = finalStatus as any;
    internship.remarks = remarks;
    internship.principalDecision = {
      status: dbPrincipalStatus,
      remarks: remarks || '',
      reviewedAt: new Date()
    };
    internship.principalRemarks = remarks;
    // NOTE: eligibilityStatus is NOT updated here — it holds the CDC-computed eligibility,
    // not the principal's decision. Principal decision is stored in finalStatus + principalStatus.

    // Map decision to principalStatus enum
    let principalStatusVal = 'Pending Review';
    let timelineAction = 'Principal Review';
    
    let approvedMonths = internship.permissibleDuration || 0;
    if (statusStr === 'approved') {
      principalStatusVal = 'Approved';
      internship.status = 'principal_approved';
      internship.currentStatus = 'APPROVED';
      timelineAction = 'Principal Approved';
      
      // Calculate approved months if it is currently 0 or null
      if (!approvedMonths || approvedMonths === 0) {
        const proposed = internship.internshipDetails.totalDuration || 0;
        const yearSem = internship.studentDetails.year || '';
        const is2ndYear = yearSem.includes('2nd Year');
        const is3rdYear2ndSem = yearSem === '3rd Year – 2nd Sem';
        
        let limit = 6;
        if (is2ndYear) limit = 1;
        else if (is3rdYear2ndSem) limit = 3;
        
        approvedMonths = Math.min(proposed, limit);
        if (approvedMonths === 0) approvedMonths = proposed;
      }
      internship.permissibleDuration = approvedMonths;
    } else if (statusStr === 'rejected') {
      principalStatusVal = 'Rejected';
      internship.status = 'principal_rejected';
      internship.currentStatus = 'REJECTED';
      timelineAction = 'Principal Rejected';
      internship.permissibleDuration = 0;
    } else {
      internship.status = 'principal_pending';
      internship.currentStatus = 'PENDING';
    }
    internship.principalStatus = principalStatusVal as any;
    
    // Clear legacy timeline entries of same type before pushing to keep history clean
    internship.timeline = internship.timeline.filter((t: any) => t.role === 'student') as any;
    
    internship.timeline.push({
      action: timelineAction,
      by: 'Principal',
      timestamp: new Date(),
      status: `Final Decision by Principal: ${finalStatus}`,
      updatedBy: req.user?.email || 'Principal',
      role: 'principal',
      remarks: remarks || ''
    } as any);
    
    internship.markModified('timeline');
    
    await internship.save();
    console.log("Application Status:", internship.status);

    // Refresh from MongoDB to get fresh document state
    const refreshedInternship = await Internship.findById(internship._id);
    const finalInternship = refreshedInternship || internship;

    // Send notification
    createSystemNotification(
      finalInternship.studentId.toString(),
      'Internship Final Decision Notification',
      `Principal has made a final decision on your internship application for ${finalInternship.internshipDetails.companyName}. Decision: ${finalStatus}. Remarks: "${remarks || 'None'}"`,
      'principal'
    ).catch(console.error);

    res.json({ message: 'Principal decision updated', internship: formatInternshipForFrontend(finalInternship) });
  } catch (error) {
    next(error);
  }
};
router.patch('/principal-decision/:id', authenticate, authorize(['principal']), handlePrincipalDecision);

// HOD: Get Applications for own Department
router.get('/hod/applications', authenticate, authorize(['hod']), async (req: AuthRequest, res, next) => {
  try {
    const hod = await User.findById(req.user?.id);
    if (!hod) return res.status(404).json({ message: 'HOD user not found' });

    let hodBranch = (hod.branch || '').toUpperCase().trim();
    if (!hodBranch && hod.email) {
      const prefix = hod.email.split('@')[0].toLowerCase();
      if (prefix.endsWith('hod')) {
        hodBranch = prefix.replace('hod', '').toUpperCase().trim();
      }
    }

    if (!hodBranch) {
      return res.status(400).json({ message: 'HOD branch configuration not found.' });
    }

    let branchFilter: any;
    if (hodBranch === 'MECH' || hodBranch === 'ME') {
      branchFilter = { $in: [/^MECH$/i, /^ME$/i] };
    } else {
      branchFilter = new RegExp(`^${hodBranch}$`, 'i');
    }

    const query = {
      'studentDetails.branch': branchFilter,
      'cdcRecommendation.status': { $ne: 'PENDING' }, // Only applications already assessed by CDC Faculty
      $or: [
        { spfBand: { $in: ['C', 'D'] } },
        { cdcBand: { $in: ['C', 'D'] } }
      ]
    };

    const applications = await Internship.find(query)
      .populate('studentId', 'name email')
      .sort({ createdAt: -1 });

    const populatedApps = applications.map(app => formatInternshipForFrontend(app));
    res.json(populatedApps);
  } catch (error) {
    next(error);
  }
});

// HOD: Submit Recommendation / Opinion
router.post('/hod/review/:id', authenticate, authorize(['hod']), async (req: AuthRequest, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['Recommended', 'Not Recommended', 'Need Clarification'].includes(action)) {
      return res.status(400).json({ message: 'Invalid HOD action. Must be Recommended, Not Recommended, or Need Clarification.' });
    }

    if (!comment || typeof comment !== 'string' || comment.trim() === '') {
      return res.status(400).json({ message: 'Comments are mandatory for HOD review.' });
    }

    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: 'Internship not found' });

    const hod = await User.findById(req.user?.id);
    if (!hod) return res.status(404).json({ message: 'HOD user not found' });

    let hodBranch = (hod.branch || '').toUpperCase().trim();
    if (!hodBranch && hod.email) {
      const prefix = hod.email.split('@')[0].toLowerCase();
      if (prefix.endsWith('hod')) {
        hodBranch = prefix.replace('hod', '').toUpperCase().trim();
      }
    }

    if (!hodBranch) {
      return res.status(403).json({ message: 'Forbidden: HOD branch not configured.' });
    }

    const studentBranch = (internship.studentDetails?.branch || '').toUpperCase().trim();

    const branchMatches = (hodBranch === 'MECH' || hodBranch === 'ME')
      ? (studentBranch === 'MECH' || studentBranch === 'ME')
      : (studentBranch === hodBranch);

    if (!branchMatches) {
      return res.status(403).json({ message: 'Forbidden: You can only review applications from your department.' });
    }

    // Save HOD Review details
    internship.hodStatus = action;
    internship.hodComments = comment.trim();
    internship.hodReviewedBy = hod.name;
    internship.hodReviewedAt = new Date();

    // Append to timeline
    internship.timeline.push({
      action: `HOD Decision: ${action}`,
      by: 'HOD',
      timestamp: new Date(),
      status: `HOD Reviewed: ${action}`,
      updatedBy: hod.name,
      role: 'hod',
      remarks: comment.trim()
    } as any);

    internship.markModified('timeline');
    await internship.save();

    console.log(`[HOD REVIEW SUCCESS] Application ${internship._id} reviewed by ${hod.name} with decision ${action}`);
    res.json({ message: 'HOD review submitted successfully', internship: formatInternshipForFrontend(internship) });
  } catch (error) {
    next(error);
  }
});

export default router;
