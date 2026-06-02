import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { Internship } from '../models/Internship.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';
import { calculateEligibility } from '../utils/eligibility.ts';

const router = express.Router();

// In-memory storage for fallback mode
let memoryInternships: any[] = [];

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
    const files = req.files as any;
    const body = JSON.parse(req.body.data);

    const attendance = Number(body.studentDetails.attendancePercentage);
    const proposedDuration = Number(body.internshipDetails.totalDuration);

    if (proposedDuration > 6) {
      return res.status(400).json({ message: 'Internships with a duration of more than 6 months are not accepted.' });
    }

    const fromDate = new Date(body.internshipDetails.fromDate);
    const toDate = new Date(body.internshipDetails.toDate);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const is2ndYear = body.studentDetails.year === '2nd' || (body.studentDetails.year && body.studentDetails.year.includes('2nd'));
      if (is2ndYear) {
        if (diffDays > 28) {
          return res.status(400).json({ message: 'Students from 2nd Year are allowed internships only for a maximum duration of 4 weeks.' });
        }
        if (body.internshipDetails.mode !== 'In-House') {
          return res.status(400).json({ message: 'Students from 2nd Year are eligible only for In-House internships.' });
        }
      }
    }

    // Initial eligibility check based on attendance
    let eligibilityStatus = 'Pending CDC Review';
    if (attendance < 75) {
      eligibilityStatus = 'Not Eligible';
    }

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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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
      return res.json(memoryInternships.filter(i => i.studentId === req.user?.id));
    }
    const applications = await Internship.find({ studentId: req.user?.id });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications' });
  }
});

// CDC: View All Applications
router.get('/all', authenticate, authorize(['cdc']), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(memoryInternships);
    }
    const applications = await Internship.find().populate('studentId', 'name email');
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications' });
  }
});

// CDC: Update Bands and Eligibility
router.patch('/cdc-review/:id', authenticate, authorize(['cdc']), async (req, res) => {
  try {
    const { spfBand, cdcBand, action } = req.body;

    if (action === 'reject') {
      if (mongoose.connection.readyState !== 1) {
        const index = memoryInternships.findIndex(i => i._id === req.params.id);
        if (index === -1) return res.status(404).json({ message: 'Internship not found' });
        
        const internship = memoryInternships[index];
        memoryInternships[index] = {
          ...internship,
          eligibilityStatus: 'Not Eligible',
          finalStatus: 'Rejected',
          updatedAt: new Date()
        };
        return res.json({ message: 'CDC application rejected (Fallback Mode)', internship: memoryInternships[index] });
      }

      const internship = await Internship.findById(req.params.id);
      if (!internship) return res.status(404).json({ message: 'Internship not found' });

      internship.eligibilityStatus = 'Not Eligible';
      internship.finalStatus = 'Rejected';
      await internship.save();
      return res.json({ message: 'CDC application rejected', internship });
    }
    
    if (mongoose.connection.readyState !== 1) {
      const index = memoryInternships.findIndex(i => i._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Internship not found' });
      
      const internship = memoryInternships[index];
      const result = calculateEligibility(
        internship.studentDetails.attendancePercentage,
        spfBand,
        cdcBand,
        internship.internshipDetails.totalDuration || 0
      );
      
      memoryInternships[index] = {
        ...internship,
        spfBand,
        cdcBand,
        permissibleDuration: result.permissibleDuration || 0,
        eligibilityStatus: result.eligibilityStatus,
        updatedAt: new Date()
      };
      return res.json({ message: 'CDC review updated (Fallback Mode)', internship: memoryInternships[index] });
    }

    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: 'Internship not found' });

    const result = calculateEligibility(
      internship.studentDetails.attendancePercentage,
      spfBand,
      cdcBand,
      internship.internshipDetails.totalDuration || 0
    );

    internship.spfBand = spfBand;
    internship.cdcBand = cdcBand;
    internship.permissibleDuration = result.permissibleDuration || 0;
    internship.eligibilityStatus = result.eligibilityStatus;
    
    await internship.save();
    res.json({ message: 'CDC review updated', internship });
  } catch (error) {
    res.status(500).json({ message: 'Error updating review' });
  }
});

// Principal: View Forwarded Applications
router.get('/forwarded', authenticate, authorize(['principal']), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(memoryInternships.filter(i => 
        ['Approved', 'Conditionally Approved', '3 Months Approved', '3 Months + 3 Months Extension'].includes(i.eligibilityStatus)
      ));
    }
    const applications = await Internship.find({ 
      eligibilityStatus: { $in: ['Approved', 'Conditionally Approved', '3 Months Approved', '3 Months + 3 Months Extension'] } 
    }).populate('studentId', 'name email');
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications' });
  }
});

// Principal: Final Decision
router.patch('/principal-decision/:id', authenticate, authorize(['principal']), async (req, res) => {
  try {
    const { finalStatus, remarks } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const index = memoryInternships.findIndex(i => i._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Internship not found' });
      
      memoryInternships[index] = {
        ...memoryInternships[index],
        finalStatus,
        remarks,
        updatedAt: new Date()
      };
      return res.json({ message: 'Principal decision updated (Fallback Mode)', internship: memoryInternships[index] });
    }

    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: 'Internship not found' });

    internship.finalStatus = finalStatus;
    internship.remarks = remarks;
    
    await internship.save();
    res.json({ message: 'Principal decision updated', internship });
  } catch (error) {
    res.status(500).json({ message: 'Error updating decision' });
  }
});

export default router;
