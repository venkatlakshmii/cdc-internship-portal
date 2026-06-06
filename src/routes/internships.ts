import express from 'express';
import multer from 'multer';
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

// In-memory storage for fallback mode
export let memoryInternships: any[] = [];

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

  if (mongoose.connection.readyState === 1) {
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
  } else {
    try {
      const { memoryMessages } = await import('./messages.ts');
      memoryMessages.push(alertMsg);
      console.log(`[NOTIFICATION SUCCESS] Sent memory notification to student: ${studentId}`);
    } catch (err) {
      console.error('Failed to save notification to memory:', err);
    }
  }
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only PDF, JPG, and PNG files are allowed!'));
  },
});

// Student: Submit Application
router.post('/submit', authenticate, authorize(['student']), upload.fields([
  { name: 'offerLetter', maxCount: 1 },
  { name: 'joiningLetter', maxCount: 1 },
  { name: 'internshipProof', maxCount: 5 },
]), async (req: AuthRequest, res) => {
  try {
    const statusInfo = await getModuleStatusInfo();
    if (statusInfo.modules.applications !== 'active') {
      return res.status(403).json({ 
        message: statusInfo.warningMessage || 'New internship applications are temporarily restricted due to exam or institutional schedule.' 
      });
    }

    const files = req.files as any;
    const body = JSON.parse(req.body.data);

    const attendance = Number(body.studentDetails.attendancePercentage);
    const proposedDuration = Number(body.internshipDetails.totalDuration);

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
      ...body,
      proposedDuration: proposedDuration,
      attachments: {
        offerLetter: files.offerLetter?.[0]?.path,
        joiningLetter: files.joiningLetter?.[0]?.path,
        internshipProof: files.internshipProof?.map((f: any) => f.path) || [],
      },
      eligibilityStatus,
      finalStatus: 'Pending Principal Approval',
      cdcRecommendation: 'Pending',
      principalDecision: 'Pending',
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
        let cdcUsers: any[] = [];
        let principalUsers: any[] = [];
        let studentName = body.studentDetails.name || 'Student';

        if (mongoose.connection.readyState === 1) {
          cdcUsers = await User.find({ role: 'cdc' });
          principalUsers = await User.find({ role: 'principal' });
        } else {
          cdcUsers = [{ _id: 'cdc-fallback-id', name: 'CDC Faculty' }];
          principalUsers = [{ _id: 'principal-fallback-id', name: 'Principal' }];
        }

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

        if (mongoose.connection.readyState === 1) {
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
        } else {
          const { memoryMessages } = await import('./messages.ts');
          memoryMessages.push(alertMsg);
          cdcUsers.forEach(cdc => {
            memoryMessages.push({
              ...alertMsg,
              recipientId: cdc._id || cdc.id,
              recipientName: cdc.name,
              recipientRole: 'cdc'
            });
          });
          principalUsers.forEach(p => {
            memoryMessages.push({
              ...alertMsg,
              recipientId: p._id || p.id,
              recipientName: p.name,
              recipientRole: 'principal'
            });
          });
        }
      } catch (msgError) {
        console.error('Error generating academic conflict system notification:', msgError);
      }
    }

    if (mongoose.connection.readyState !== 1) {
      memoryInternships.push(internshipData);
      return res.status(201).json({ message: 'Application submitted successfully (Fallback Mode)', internship: internshipData });
    }

    const internship = new Internship(internshipData);
    await internship.save();
    res.status(201).json({ message: 'Application submitted successfully', internship });
  } catch (error: any) {
    console.error('Submission Error:', error);
    res.status(500).json({ 
      message: 'Error submitting application', 
      error: error.message,
      details: error.errors 
    });
  }
});

// Student: View Own Applications
router.get('/my-applications', authenticate, authorize(['student']), async (req: AuthRequest, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const list = memoryInternships.filter(i => i.studentId === req.user?.id);
      const populatedList = await Promise.all(list.map(async (app) => {
        const conflict = await detectConflict(app.internshipDetails.fromDate, app.internshipDetails.toDate);
        return {
          ...app,
          hasAcademicConflict: conflict.hasConflict || app.hasAcademicConflict,
          conflictDetails: conflict.details || app.conflictDetails
        };
      }));
      return res.json(populatedList);
    }
    const applications = await Internship.find({ studentId: req.user?.id });
    const populatedApps = await Promise.all(applications.map(async (app) => {
      const conflict = await detectConflict(app.internshipDetails.fromDate, app.internshipDetails.toDate);
      const appObj = app.toObject();
      appObj.hasAcademicConflict = conflict.hasConflict || app.hasAcademicConflict;
      appObj.conflictDetails = conflict.details || app.conflictDetails;
      return appObj;
    }));
    res.json(populatedApps);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications' });
  }
});

// Student/CDC/Principal: View Single Application Detail
router.get('/detail/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState !== 1) {
      const internship = memoryInternships.find(i => i._id === id);
      if (!internship) return res.status(404).json({ message: 'Internship not found' });
      if (req.user?.role === 'student' && internship.studentId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      return res.json(internship);
    }
    
    const internship = await Internship.findById(id).populate('studentId', 'name email');
    if (!internship) return res.status(404).json({ message: 'Internship not found' });
    
    const studentIdVal = internship.studentId as any;
    const ownerId = studentIdVal && typeof studentIdVal === 'object' && '_id' in studentIdVal
      ? studentIdVal._id.toString()
      : (studentIdVal ? studentIdVal.toString() : '');
    
    console.log('[DEBUG] req.user.id:', req.user?.id);
    console.log('[DEBUG] studentIdVal:', studentIdVal);
    console.log('[DEBUG] ownerId:', ownerId);
    
    if (req.user?.role === 'student' && ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(internship);
  } catch (error) {
    console.error('Error fetching internship details:', error);
    res.status(500).json({ message: 'Error fetching internship details' });
  }
});

// Student: Edit and Resubmit Application
router.put('/update/:id', authenticate, authorize(['student']), upload.fields([
  { name: 'offerLetter', maxCount: 1 },
  { name: 'joiningLetter', maxCount: 1 },
  { name: 'internshipProof', maxCount: 5 }
]), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const files = req.files as any;
    const body = JSON.parse(req.body.data);

    let existingApp: any = null;

    if (mongoose.connection.readyState !== 1) {
      existingApp = memoryInternships.find(i => i._id === id);
    } else {
      existingApp = await Internship.findById(id);
    }

    if (!existingApp) {
      return res.status(404).json({ message: 'Internship application not found' });
    }

    const ownerId = mongoose.connection.readyState !== 1 ? existingApp.studentId : existingApp.studentId.toString();
    if (ownerId !== req.user?.id) {
      return res.status(403).json({ message: 'Forbidden: You do not own this application' });
    }

    const attendance = Number(body.studentDetails.attendancePercentage);
    const yearSem = body.studentDetails.year;
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
    const proposedDuration = Number(body.internshipDetails.totalDuration);

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

    const offerLetterPath = files.offerLetter?.[0]?.path || existingApp.attachments?.offerLetter;
    const joiningLetterPath = files.joiningLetter?.[0]?.path || existingApp.attachments?.joiningLetter;
    const internshipProofPaths = files.internshipProof?.map((f: any) => f.path) || existingApp.attachments?.internshipProof || [];

    const updatedTimeline = existingApp.timeline || [];
    updatedTimeline.push({
      status: 'Resubmitted by Student',
      updatedBy: req.user?.email || 'Student',
      role: 'student',
      remarks: 'Application updated and resubmitted for review',
      timestamp: new Date()
    });

    const updatedData = {
      ...existingApp.toObject ? existingApp.toObject() : existingApp,
      ...body,
      proposedDuration,
      attachments: {
        offerLetter: offerLetterPath,
        joiningLetter: joiningLetterPath,
        internshipProof: internshipProofPaths
      },
      eligibilityStatus: 'Pending CDC Review',
      cdcRecommendation: 'Pending',
      principalDecision: 'Pending',
      finalStatus: 'Pending Principal Approval',
      timeline: updatedTimeline,
      updatedAt: new Date()
    };

    if (mongoose.connection.readyState !== 1) {
      const index = memoryInternships.findIndex(i => i._id === id);
      memoryInternships[index] = updatedData;
      return res.json({ message: 'Application updated successfully (Fallback Mode)', internship: updatedData });
    }

    await Internship.findByIdAndUpdate(id, updatedData);
    const updatedInternship = await Internship.findById(id);

    res.json({ message: 'Application updated successfully', internship: updatedInternship });
  } catch (error: any) {
    console.error('Update Error:', error);
    res.status(500).json({ message: 'Error updating application', error: error.message });
  }
});

// CDC: View All Applications
router.get('/all', authenticate, authorize(['cdc']), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const list = memoryInternships;
      const populatedList = await Promise.all(list.map(async (app) => {
        const conflict = await detectConflict(app.internshipDetails.fromDate, app.internshipDetails.toDate);
        return {
          ...app,
          hasAcademicConflict: conflict.hasConflict || app.hasAcademicConflict,
          conflictDetails: conflict.details || app.conflictDetails
        };
      }));
      return res.json(populatedList);
    }
    const applications = await Internship.find().populate('studentId', 'name email');
    const populatedApps = await Promise.all(applications.map(async (app) => {
      const conflict = await detectConflict(app.internshipDetails.fromDate, app.internshipDetails.toDate);
      const appObj = app.toObject();
      appObj.hasAcademicConflict = conflict.hasConflict || app.hasAcademicConflict;
      appObj.conflictDetails = conflict.details || app.conflictDetails;
      return appObj;
    }));
    res.json(populatedApps);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications' });
  }
});

// CDC: Update Bands and Eligibility
router.patch('/cdc-review/:id', authenticate, authorize(['cdc']), async (req: AuthRequest, res) => {
  try {
    const { spfBand, cdcBand, cdcRecommendation, cdcRemarks, action } = req.body;
    const rec = cdcRecommendation || (action === 'reject' ? 'Rejected' : 'Approved');
    const rems = cdcRemarks || (action === 'reject' ? 'Rejected by CDC' : '');

    if (mongoose.connection.readyState !== 1) {
      const index = memoryInternships.findIndex(i => i._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Internship not found' });
      
      const internship = memoryInternships[index];
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

      let timeline = internship.timeline || [];
      if (rec === 'Approved' || rec === 'Rejected') {
        timeline = timeline.filter((t: any) => !t.status.includes('Clarification'));
      }
      const statusStr = rec === 'Approved' ? 'Reviewed by CDC – Approved' :
                        rec === 'Rejected' ? 'Reviewed by CDC – Rejected' :
                        'Clarification Requested by CDC';
      timeline.push({
        status: statusStr,
        updatedBy: req.user?.email || 'CDC Faculty',
        role: 'cdc',
        remarks: rems,
        timestamp: new Date()
      });

      memoryInternships[index] = {
        ...internship,
        spfBand: finalSpf,
        cdcBand: finalCdc,
        permissibleDuration: permDuration,
        eligibilityStatus: finalEligibility,
        cdcRecommendation: rec,
        cdcRemarks: rems,
        timeline,
        updatedAt: new Date()
      };

      const notificationContent = rec === 'Needs Clarification'
        ? "CDC Department has requested clarification. Please meet the CDC office."
        : `CDC Faculty has reviewed your internship application for ${internship.internshipDetails.companyName}. Recommendation: ${rec}. Remarks: "${rems || 'None'}"`;

      // Send notification asynchronously
      createSystemNotification(
        internship.studentId,
        'Internship CDC Review Notification',
        notificationContent,
        'cdc'
      ).catch(console.error);

      return res.json({ message: 'CDC review updated (Fallback Mode)', internship: memoryInternships[index] });
    }

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
    internship.cdcRecommendation = rec;
    internship.cdcRemarks = rems;
    
    const statusStr = rec === 'Approved' ? 'Reviewed by CDC – Approved' :
                      rec === 'Rejected' ? 'Reviewed by CDC – Rejected' :
                      'Clarification Requested by CDC';

    let newTimeline = internship.timeline
      .map((t: any) => (t.toObject ? t.toObject() : t));

    if (rec === 'Approved' || rec === 'Rejected') {
      newTimeline = newTimeline.filter((t: any) => !t.status.includes('Clarification'));
    }

    newTimeline.push({
      status: statusStr,
      updatedBy: req.user?.email || 'CDC Faculty',
      role: 'cdc',
      remarks: rems,
      timestamp: new Date()
    });

    internship.timeline = newTimeline as any;
    internship.markModified('timeline');

    await internship.save();

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

    res.json({ message: 'CDC review updated', internship });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Error updating review' });
  }
});

// Principal: View Forwarded Applications
router.get('/forwarded', authenticate, authorize(['principal']), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const list = memoryInternships.filter(i => 
        i.cdcRecommendation !== 'Pending'
      );
      const populatedList = await Promise.all(list.map(async (app) => {
        const conflict = await detectConflict(app.internshipDetails.fromDate, app.internshipDetails.toDate);
        return {
          ...app,
          hasAcademicConflict: conflict.hasConflict || app.hasAcademicConflict,
          conflictDetails: conflict.details || app.conflictDetails
        };
      }));
      return res.json(populatedList);
    }
    const applications = await Internship.find({ 
      cdcRecommendation: { $ne: 'Pending' }
    }).populate('studentId', 'name email');
    const populatedApps = await Promise.all(applications.map(async (app) => {
      const conflict = await detectConflict(app.internshipDetails.fromDate, app.internshipDetails.toDate);
      const appObj = app.toObject();
      appObj.hasAcademicConflict = conflict.hasConflict || app.hasAcademicConflict;
      appObj.conflictDetails = conflict.details || app.conflictDetails;
      return appObj;
    }));
    res.json(populatedApps);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications' });
  }
});

// Principal: Final Decision
router.patch('/principal-decision/:id', authenticate, authorize(['principal']), async (req: AuthRequest, res) => {
  try {
    const { finalStatus, remarks } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const index = memoryInternships.findIndex(i => i._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Internship not found' });
      
      const internship = memoryInternships[index];
      const timeline = internship.timeline || [];
      timeline.push({
        status: `Final Decision by Principal: ${finalStatus}`,
        updatedBy: req.user?.email || 'Principal',
        role: 'principal',
        remarks: remarks || '',
        timestamp: new Date()
      });

      memoryInternships[index] = {
        ...internship,
        finalStatus,
        remarks,
        principalDecision: finalStatus,
        principalRemarks: remarks,
        eligibilityStatus: finalStatus,
        timeline,
        updatedAt: new Date()
      };

      // Send notification asynchronously
      createSystemNotification(
        internship.studentId,
        'Internship Final Decision Notification',
        `Principal has made a final decision on your internship application for ${internship.internshipDetails.companyName}. Decision: ${finalStatus}. Remarks: "${remarks || 'None'}"`,
        'principal'
      ).catch(console.error);

      return res.json({ message: 'Principal decision updated (Fallback Mode)', internship: memoryInternships[index] });
    }

    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: 'Internship not found' });

    internship.finalStatus = finalStatus as any;
    internship.remarks = remarks;
    internship.principalDecision = finalStatus as any;
    internship.principalRemarks = remarks;
    internship.eligibilityStatus = finalStatus as any;
    
    internship.timeline.push({
      status: `Final Decision by Principal: ${finalStatus}`,
      updatedBy: req.user?.email || 'Principal',
      role: 'principal',
      remarks: remarks || '',
      timestamp: new Date()
    });
    
    await internship.save();

    // Send notification
    createSystemNotification(
      internship.studentId.toString(),
      'Internship Final Decision Notification',
      `Principal has made a final decision on your internship application for ${internship.internshipDetails.companyName}. Decision: ${finalStatus}. Remarks: "${remarks || 'None'}"`,
      'principal'
    ).catch(console.error);

    res.json({ message: 'Principal decision updated', internship });
  } catch (error) {
    console.error('Error updating decision:', error);
    res.status(500).json({ message: 'Error updating decision' });
  }
});

export default router;
