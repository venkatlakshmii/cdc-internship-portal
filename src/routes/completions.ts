import express from 'express';
import { uploadCloudReports } from '../middleware/uploadCloud.ts';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { InternshipCompletion } from '../models/InternshipCompletion.ts';
import { DbFile } from '../models/DbFile.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';
import { getModuleStatusInfo } from './portalControl.ts';

const router = express.Router();

// Multer setup replaced with Cloudinary storage
const upload = uploadCloudReports;

// Student: Submit Completion Report
router.post('/submit', authenticate, authorize(['student']), upload.fields([
  { name: 'completionReport', maxCount: 1 },
  { name: 'completionCertificate', maxCount: 1 }
]), async (req: AuthRequest, res, next) => {
  try {
    const statusInfo = await getModuleStatusInfo();
    if (statusInfo.modules.completions !== 'active') {
      return res.status(403).json({ message: 'Internship completion details submission is temporarily disabled.' });
    }

    const files = req.files as any;
    if (!files || !files.completionReport?.[0] || !files.completionCertificate?.[0]) {
      return res.status(400).json({ message: 'Please upload both completion report and certificate.' });
    }

    const { completionDate, studentDetails, studentRemarks } = req.body;
    let parsedDetails: any = {};
    if (studentDetails) {
      try {
        parsedDetails = typeof studentDetails === 'string' ? JSON.parse(studentDetails) : studentDetails;
      } catch (err) {
        parsedDetails = {};
      }
    }

    if (completionDate && isNaN(new Date(completionDate).getTime())) {
      return res.status(400).json({ message: 'Completion Date must be a valid date.' });
    }

    const reportFile = files.completionReport[0];
    const certFile = files.completionCertificate[0];

    const dbReport = new DbFile({
      filename: reportFile.originalname,
      contentType: reportFile.mimetype,
      data: reportFile.buffer,
      size: reportFile.size
    });
    await dbReport.save();

    const dbCert = new DbFile({
      filename: certFile.originalname,
      contentType: certFile.mimetype,
      data: certFile.buffer,
      size: certFile.size
    });
    await dbCert.save();

    const completionData = {
      _id: new mongoose.Types.ObjectId().toString(),
      studentId: req.user?.id,
      studentDetails: {
        name: parsedDetails.name || 'Student',
        rollNumber: parsedDetails.rollNumber || 'N/A',
        year: parsedDetails.year || 'N/A',
        branch: parsedDetails.branch || 'N/A',
      },
      completionDate: completionDate ? new Date(completionDate) : new Date(),
      reportFilePath: `api/files/download/${dbReport._id}`,
      reportFileName: reportFile.originalname,
      reportPublicId: dbReport._id.toString(),
      certificateFilePath: `api/files/download/${dbCert._id}`,
      certificateFileName: certFile.originalname,
      certificatePublicId: dbCert._id.toString(),
      studentRemarks: studentRemarks || '',
      status: 'Pending CDC Review',
      cdcRemarks: '',
      principalRemarks: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const completion = new InternshipCompletion(completionData);
    await completion.save();
    res.status(201).json({ message: 'Completion details submitted successfully', completion });
  } catch (error: any) {
    next(error);
  }
});

// Student: Get Own Completion Submissions
router.get('/my-completions', authenticate, authorize(['student']), async (req: AuthRequest, res, next) => {
  try {
    const completions = await InternshipCompletion.find({ studentId: req.user?.id }).sort({ createdAt: -1 });
    res.json(completions);
  } catch (error) {
    next(error);
  }
});

// CDC / Principal: Get All Completions
router.get('/all', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res, next) => {
  try {
    const completions = await InternshipCompletion.find().sort({ createdAt: -1 });
    res.json(completions);
  } catch (error) {
    next(error);
  }
});

// CDC / Principal: Review/Verify Completion
router.patch('/review/:id', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res, next) => {
  try {
    const { status, remarks } = req.body;
    const isCDC = req.user?.role === 'cdc';

    const completion = await InternshipCompletion.findById(req.params.id);
    if (!completion) return res.status(404).json({ message: 'Completion record not found' });

    if (isCDC) {
      completion.cdcRemarks = remarks || '';
      completion.status = 'Pending Principal Approval';
    } else {
      completion.principalRemarks = remarks || '';
      completion.status = status || 'Approved';
    }
    await completion.save();

    res.json({ message: 'Completion status updated successfully', completion });
  } catch (error) {
    next(error);
  }
});

export default router;
