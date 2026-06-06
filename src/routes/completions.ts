import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { InternshipCompletion } from '../models/InternshipCompletion.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';
import { getModuleStatusInfo } from './portalControl.ts';

const router = express.Router();

// In-memory storage for fallback mode
export let memoryCompletions: any[] = [];

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `completion-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) return cb(null, true);
    cb(new Error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed!'));
  },
});

// Student: Submit Completion Report
router.post('/submit', authenticate, authorize(['student']), upload.fields([
  { name: 'completionReport', maxCount: 1 },
  { name: 'completionCertificate', maxCount: 1 }
]), async (req: AuthRequest, res) => {
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
    const parsedDetails = JSON.parse(studentDetails || '{}');

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
      reportFilePath: files.completionReport[0].path,
      reportFileName: files.completionReport[0].originalname,
      certificateFilePath: files.completionCertificate[0].path,
      certificateFileName: files.completionCertificate[0].originalname,
      studentRemarks: studentRemarks || '',
      status: 'Pending CDC Review',
      cdcRemarks: '',
      principalRemarks: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (mongoose.connection.readyState !== 1) {
      memoryCompletions.push(completionData);
      return res.status(201).json({ message: 'Completion details submitted successfully (Fallback Mode)', completion: completionData });
    }

    const completion = new InternshipCompletion(completionData);
    await completion.save();
    res.status(201).json({ message: 'Completion details submitted successfully', completion });
  } catch (error: any) {
    console.error('Completion submission error:', error);
    res.status(500).json({ message: 'Error submitting completion details', error: error.message });
  }
});

// Student: Get Own Completion Submissions
router.get('/my-completions', authenticate, authorize(['student']), async (req: AuthRequest, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(memoryCompletions.filter(c => c.studentId === req.user?.id));
    }
    const completions = await InternshipCompletion.find({ studentId: req.user?.id }).sort({ createdAt: -1 });
    res.json(completions);
  } catch (error) {
    console.error('Fetch completions error:', error);
    res.status(500).json({ message: 'Error fetching completion details' });
  }
});

// CDC / Principal: Get All Completions
router.get('/all', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(memoryCompletions);
    }
    const completions = await InternshipCompletion.find().sort({ createdAt: -1 });
    res.json(completions);
  } catch (error) {
    console.error('Fetch all completions error:', error);
    res.status(500).json({ message: 'Error fetching completions' });
  }
});

// CDC / Principal: Review/Verify Completion
router.patch('/review/:id', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    const { status, remarks } = req.body;
    const isCDC = req.user?.role === 'cdc';

    if (mongoose.connection.readyState !== 1) {
      const index = memoryCompletions.findIndex(c => c._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Completion record not found' });
      
      const record = memoryCompletions[index];
      if (isCDC) {
        memoryCompletions[index] = {
          ...record,
          cdcRemarks: remarks || '',
          status: 'Pending Principal Approval',
          updatedAt: new Date()
        };
      } else {
        memoryCompletions[index] = {
          ...record,
          principalRemarks: remarks || '',
          status: status || 'Approved',
          updatedAt: new Date()
        };
      }
      return res.json({ message: 'Completion status updated (Fallback Mode)', completion: memoryCompletions[index] });
    }

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
    console.error('Review completion error:', error);
    res.status(500).json({ message: 'Error updating completion status' });
  }
});

export default router;
