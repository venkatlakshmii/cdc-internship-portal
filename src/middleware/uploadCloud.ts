import 'dotenv/config';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload folders exist automatically
const uploadDirs = [
  'uploads',
  'uploads/offerLetters',
  'uploads/joiningLetters',
  'uploads/proofs',
  'uploads/reports',
  'uploads/completions',
  'uploads/messages'
];

uploadDirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const getDestinationFolder = (fieldname: string) => {
  if (fieldname === 'offerLetter') return 'uploads/offerLetters';
  if (fieldname === 'joiningLetter') return 'uploads/joiningLetters';
  if (fieldname === 'internshipProof') return 'uploads/proofs';
  if (fieldname === 'report' || fieldname === 'reportFile') return 'uploads/reports';
  if (fieldname === 'completion' || fieldname === 'completionReport' || fieldname === 'completionCertificate') return 'uploads/completions';
  return 'uploads/messages';
};

// Configure Multer Storage for Local Disk
export const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = getDestinationFolder(file.fieldname);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// Middleware for internship uploads: PDF, JPG, PNG
export const uploadCloud = multer({
  storage: localStorage,
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();
    if (allowedExts.includes(ext) && allowedMimes.includes(mime)) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, JPG, and PNG files are allowed!'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Middleware for monthly reports, completions, and messages: PDF, DOC, DOCX, JPG, PNG
export const uploadCloudReports = multer({
  storage: localStorage,
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();
    if (allowedExts.includes(ext) && allowedMimes.includes(mime)) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed!'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
