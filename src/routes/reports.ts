import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { MonthlyReport } from '../models/MonthlyReport.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';

const router = express.Router();

// In-memory storage for fallback mode
let memoryReports: any[] = [];

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `report-${Date.now()}-${file.originalname}`);
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

// Student: Submit Monthly Report
router.post('/submit', authenticate, authorize(['student']), upload.single('reportFile'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a report file.' });
    }

    const { month, studentDetails } = req.body;
    const parsedDetails = JSON.parse(studentDetails || '{}');

    const reportData = {
      _id: new mongoose.Types.ObjectId().toString(),
      studentId: req.user?.id,
      studentDetails: {
        name: parsedDetails.name || 'Student',
        rollNumber: parsedDetails.rollNumber || 'N/A',
        branch: parsedDetails.branch || 'N/A',
      },
      month: month || 'Current Month',
      filePath: req.file.path,
      fileName: req.file.originalname,
      status: 'Pending CDC Review',
      remarks: '',
      cdcRemarks: '',
      principalRemarks: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (mongoose.connection.readyState !== 1) {
      memoryReports.push(reportData);
      return res.status(201).json({ message: 'Monthly report submitted successfully (Fallback Mode)', report: reportData });
    }

    const report = new MonthlyReport(reportData);
    await report.save();
    res.status(201).json({ message: 'Monthly report submitted successfully', report });
  } catch (error: any) {
    console.error('Report submission error:', error);
    res.status(500).json({ message: 'Error submitting report', error: error.message });
  }
});

// Student: Get Own Reports
router.get('/my-reports', authenticate, authorize(['student']), async (req: AuthRequest, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(memoryReports.filter(r => r.studentId === req.user?.id));
    }
    const reports = await MonthlyReport.find({ studentId: req.user?.id }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error('Fetch reports error:', error);
    res.status(500).json({ message: 'Error fetching reports' });
  }
});

// CDC / Principal: Get All Reports (For review & monitoring)
router.get('/all', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(memoryReports);
    }
    const reports = await MonthlyReport.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error('Fetch all reports error:', error);
    res.status(500).json({ message: 'Error fetching reports' });
  }
});

// CDC / Principal: Review/Verify Report
router.patch('/review/:id', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    const { status, remarks } = req.body;
    const isCDC = req.user?.role === 'cdc';

    if (mongoose.connection.readyState !== 1) {
      const index = memoryReports.findIndex(r => r._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Report not found' });
      
      const report = memoryReports[index];
      if (isCDC) {
        memoryReports[index] = {
          ...report,
          cdcRemarks: remarks || '',
          remarks: remarks || '',
          status: 'Pending Principal Approval',
          updatedAt: new Date()
        };
      } else {
        memoryReports[index] = {
          ...report,
          principalRemarks: remarks || '',
          status: status || 'Approved',
          updatedAt: new Date()
        };
      }
      return res.json({ message: 'Report status updated (Fallback Mode)', report: memoryReports[index] });
    }

    const report = await MonthlyReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    if (isCDC) {
      report.cdcRemarks = remarks || '';
      report.remarks = remarks || '';
      report.status = 'Pending Principal Approval';
    } else {
      report.principalRemarks = remarks || '';
      report.status = status || 'Approved';
    }
    await report.save();

    res.json({ message: 'Report status updated successfully', report });
  } catch (error) {
    console.error('Review report error:', error);
    res.status(500).json({ message: 'Error updating report status' });
  }
});

export default router;
