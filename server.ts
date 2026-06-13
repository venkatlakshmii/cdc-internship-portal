import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authRoutes from './src/routes/auth.ts';
import internshipRoutes, {
  getForwardedApplications,
  getAllApplications,
  handleCdcReview,
  handlePrincipalDecision
} from './src/routes/internships.ts';
import reportRoutes from './src/routes/reports.ts';
import completionRoutes from './src/routes/completions.ts';
import messageRoutes from './src/routes/messages.ts';
import portalControlRoutes from './src/routes/portalControl.ts';
import fileRoutes from './src/routes/files.ts';
import { User } from './src/models/User.ts';
import { authenticate, authorize } from './src/middleware/auth.ts';

const PORT = 3000;
const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/hitam_cdc';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
let memoryServer: MongoMemoryServer | null = null;

async function startServer() {
  const app = express();

  // Rate limiter for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many authentication attempts from this IP, please try again after 15 minutes'
    }
  });

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Connect to MongoDB
  try {
    await connectToMongo();
    await seedUsers();
    await cleanMockData();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Running in fallback mode without MongoDB');
  }

  // API Routes
  app.get('/api/health', async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ 
      status: 'ok', 
      database: dbStatus,
      env: process.env.NODE_ENV
    });
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/internships', internshipRoutes);

  // Mount Alternate CDC & Principal endpoints requested by user
  app.get('/api/principal/applications', authenticate, authorize(['principal']), getForwardedApplications);
  app.get('/api/cdc/applications', authenticate, authorize(['cdc']), getAllApplications);
  app.put('/api/cdc/approve/:id', authenticate, authorize(['cdc']), handleCdcReview);
  app.put('/api/principal/decision/:id', authenticate, authorize(['principal']), handlePrincipalDecision);
  app.use('/api/reports', reportRoutes);
  app.use('/api/completions', completionRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/portal-control', portalControlRoutes);
  app.use('/api/files', fileRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist/index.html'));
    });
  }

  // Redirection route to capture relative Cloudinary URLs (prefixed with local domain/slash by frontend link tags)
  app.get('/https:/*', (req, res) => {
    const target = 'https:/' + req.params[0];
    res.redirect(target);
  });
  app.get('/http:/*', (req, res) => {
    const target = 'http:/' + req.params[0];
    res.redirect(target);
  });

  // Centralized Error-handling Middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[CENTRAL ERROR LOG]', err);

    const success = false;

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success,
        message: err.message || 'Validation failed. Please verify input data.',
        errors: err.errors ? Object.keys(err.errors).reduce((acc: any, key) => {
          acc[key] = err.errors[key].message;
          return acc;
        }, {}) : {}
      });
    }

    // Handle Multer size limits or other multer-related errors
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success,
          message: 'File size limit exceeded. Maximum allowed size is 10MB.'
        });
      }
      return res.status(400).json({
        success,
        message: `File upload error: ${err.message}`
      });
    }

    // Handle custom validation errors (e.g., from fileFilter)
    if (err.message && (err.message.includes('Only PDF') || err.message.includes('file types') || err.message.includes('allowed!'))) {
      return res.status(400).json({
        success,
        message: err.message
      });
    }

    if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError' || mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success,
        message: 'Database connection failed. Please ensure MongoDB is running and reachable.',
        error: err.message
      });
    }

    // Cloudinary/Storage connection errors or timeouts
    const errStr = err.message || '';
    if (errStr.includes('timeout') || errStr.includes('ENOTFOUND') || errStr.toLowerCase().includes('cloudinary')) {
      return res.status(503).json({
        success,
        message: 'Storage service is temporarily unreachable. Please try again later.',
        error: err.message
      });
    }

    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
      success,
      message: err.message || 'An internal server error occurred.',
      error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function connectToMongo() {
  console.log(`Attempting primary MongoDB connection to ${MONGO_URI}`);
  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`Connected to MongoDB at ${MONGO_URI}`);
    return;
  } catch (error) {
    console.error('Primary MongoDB connection failed:', error);

    // Fall back to in-memory MongoDB
    console.log('Attempting in-memory MongoDB fallback...');
    try {
      memoryServer = await MongoMemoryServer.create();
      const memoryUri = memoryServer.getUri();
      console.log(`In-memory MongoDB started at ${memoryUri}`);

      await mongoose.connect(memoryUri, {
        maxPoolSize: 50,
        serverSelectionTimeoutMS: 5000,
        dbName: 'hitam_cdc',
      });
      console.log('Connected to in-memory MongoDB');
    } catch (memoryError) {
      console.error('In-memory MongoDB fallback failed:', memoryError);
      throw memoryError;
    }
  }
}

async function seedUsers() {
  const users = [
    { name: 'inderjeet', email: '24e51a6665@hitam.org', password: 'password123', role: 'student' },
    { name: 'CDC Faculty', email: 'cdc@hitam.org', password: 'password123', role: 'cdc' },
    { name: 'Principal', email: 'principal@hitam.org', password: 'password123', role: 'principal' },
    { name: 'Dean Careers', email: 'dean@hitam.org', password: 'password123', role: 'dean' },
  ];

  for (const userData of users) {
    const existing = await User.findOne({ email: userData.email });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const atIndex = userData.email.indexOf('@');
      const rollNumber = atIndex !== -1 ? userData.email.substring(0, atIndex).toUpperCase() : '';
      await new User({ ...userData, password: hashedPassword, rollNumber }).save();
      console.log(`Seeded user: ${userData.email}`);
    }
  }
}

async function cleanMockData() {
  try {
    const { Internship } = await import('./src/models/Internship.ts');
    const { MonthlyReport } = await import('./src/models/MonthlyReport.ts');
    const { InternshipCompletion } = await import('./src/models/InternshipCompletion.ts');
    const { Message } = await import('./src/models/Message.ts');
    const { User } = await import('./src/models/User.ts');

    const mockPatterns = [/test/i, /mock/i, /dummy/i, /fake/i, /example/i];

    // 1. Delete mock internships
    const internshipResult = await Internship.deleteMany({
      $or: [
        { 'internshipDetails.companyName': { $in: [
          'Approve-Approve Corp',
          'Approve-Reject Corp',
          'Reject-Approve Corp',
          'Reject-Reject Corp',
          'Clarify Corp',
          'Clarify Corp (Resubmitted)'
        ] } },
        { 'internshipDetails.companyName': { $in: mockPatterns } },
        { 'studentDetails.rollNumber': { $in: ['24E51A1234', '24e51a1234'] } },
        { 'studentDetails.name': 'Student User' },
        { 'studentDetails.personalEmail': /24e51a1234@hitam\.org/i }
      ]
    });
    if (internshipResult.deletedCount > 0) {
      console.log(`[CLEANUP] Removed ${internshipResult.deletedCount} mock internship applications from DB.`);
    }

    // 2. Delete mock monthly reports
    const reportResult = await MonthlyReport.deleteMany({
      $or: [
        { 'studentDetails.rollNumber': { $in: ['24E51A1234', '24e51a1234'] } },
        { 'studentDetails.name': 'Student User' },
        { month: { $in: mockPatterns } }
      ]
    });
    if (reportResult.deletedCount > 0) {
      console.log(`[CLEANUP] Removed ${reportResult.deletedCount} mock monthly reports from DB.`);
    }

    // 3. Delete mock internship completions
    const completionResult = await InternshipCompletion.deleteMany({
      $or: [
        { 'studentDetails.rollNumber': { $in: ['24E51A1234', '24e51a1234'] } },
        { 'studentDetails.name': 'Student User' },
        { studentRemarks: { $in: mockPatterns } }
      ]
    });
    if (completionResult.deletedCount > 0) {
      console.log(`[CLEANUP] Removed ${completionResult.deletedCount} mock completion reports from DB.`);
    }

    // 4. Delete mock messages
    const messageResult = await Message.deleteMany({
      $or: [
        { subject: { $in: mockPatterns } },
        { content: { $in: mockPatterns } },
        { recipientName: 'Student User' },
        { senderName: 'Student User' }
      ]
    });
    if (messageResult.deletedCount > 0) {
      console.log(`[CLEANUP] Removed ${messageResult.deletedCount} mock messages/notifications from DB.`);
    }

    // 5. Delete mock user accounts
    const userResult = await User.deleteMany({
      $or: [
        { email: { $in: ['invalid@gmail.com', 'test_student_4779_1@hitam.org', 'test_student_4779_2@hitam.org', 'test_student_92143_1@hitam.org', 'test_student_92143_2@hitam.org', '24e51a1234@hitam.org'] } },
        { email: { $regex: /test_student_/i } },
        { name: { $in: ['Student User', 'Test Student', 'Invalid Student'] } }
      ]
    });
    if (userResult.deletedCount > 0) {
      console.log(`[CLEANUP] Removed ${userResult.deletedCount} mock users from DB.`);
    }

    // 6. Handle duplicate student accounts for 24e51a6665@hitam.org
    const duplicateUsers = await User.find({ email: /24e51a6665@hitam\.org/i });
    if (duplicateUsers.length > 1) {
      // Find the best instance (lowercase email preferred)
      const lowercaseInstance = duplicateUsers.find(u => u.email === '24e51a6665@hitam.org');
      const keepUser = lowercaseInstance || duplicateUsers[0];
      
      // Delete all instances except the one we keep
      await User.deleteMany({
        email: /24e51a6665@hitam\.org/i,
        _id: { $ne: keepUser._id }
      });
      console.log(`[CLEANUP] Deduplicated student accounts for 24e51a6665@hitam.org. Kept ID: ${keepUser._id}`);
    }
  } catch (err) {
    console.error('Error cleaning mock data:', err);
  }
}

startServer();
