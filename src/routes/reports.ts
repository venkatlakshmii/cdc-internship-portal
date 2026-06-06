import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import exceljs from 'exceljs';
import moment from 'moment';
import { MonthlyReport } from '../models/MonthlyReport.ts';
import { InternshipCompletion } from '../models/InternshipCompletion.ts';
import { Internship } from '../models/Internship.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';
import { getModuleStatusInfo } from './portalControl.ts';
import { memoryInternships } from './internships.ts';
import { memoryCompletions } from './completions.ts';

const router = express.Router();

// In-memory storage for fallback mode
export let memoryReports: any[] = [];

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
    const statusInfo = await getModuleStatusInfo();
    if (statusInfo.modules.monthlyReports !== 'active') {
      return res.status(403).json({ message: 'Monthly report submission is temporarily disabled.' });
    }

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

// ==========================================
// REPORT FILTERING AND EXPORT ENDPOINTS
// ==========================================

async function fetchReportData(query: any) {
  const { module = 'completions', branch, semester, status, type, startDate, endDate } = query;
  let data: any[] = [];

  if (module === 'completions') {
    if (mongoose.connection.readyState === 1) {
      const matchStage: any = {};
      if (branch && branch !== 'all') {
        matchStage['studentDetails.branch'] = branch;
      }
      if (semester && semester !== 'all') {
        matchStage['studentDetails.year'] = semester;
      }
      if (status && status !== 'all') {
        matchStage['status'] = status;
      }
      if (startDate || endDate) {
        matchStage['completionDate'] = {};
        if (startDate) matchStage['completionDate'].$gte = new Date(startDate);
        if (endDate) matchStage['completionDate'].$lte = new Date(endDate);
      }

      const pipeline: any[] = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'internships',
            localField: 'studentDetails.rollNumber',
            foreignField: 'studentDetails.rollNumber',
            as: 'internship'
          }
        },
        {
          $unwind: { path: '$internship', preserveNullAndEmptyArrays: true }
        }
      ];

      if (type && type !== 'all') {
        pipeline.push({
          $match: {
            'internship.internshipDetails.mode': type
          }
        });
      }

      data = await mongoose.model('InternshipCompletion').aggregate(pipeline);
    } else {
      let list = memoryCompletions;
      if (branch && branch !== 'all') {
        list = list.filter(c => c.studentDetails?.branch === branch);
      }
      if (semester && semester !== 'all') {
        list = list.filter(c => c.studentDetails?.year === semester);
      }
      if (status && status !== 'all') {
        list = list.filter(c => c.status === status);
      }
      if (startDate) {
        list = list.filter(c => new Date(c.completionDate) >= new Date(startDate));
      }
      if (endDate) {
        list = list.filter(c => new Date(c.completionDate) <= new Date(endDate));
      }

      data = list.map(c => {
        const internship = memoryInternships.find(i => i.studentDetails?.rollNumber === c.studentDetails?.rollNumber);
        return {
          ...c,
          internship
        };
      });

      if (type && type !== 'all') {
        data = data.filter(item => item.internship?.internshipDetails?.mode === type);
      }
    }
  } else if (module === 'approved') {
    if (mongoose.connection.readyState === 1) {
      const matchStage: any = {
        finalStatus: 'Approved'
      };
      if (branch && branch !== 'all') {
        matchStage['studentDetails.branch'] = branch;
      }
      if (semester && semester !== 'all') {
        matchStage['studentDetails.year'] = semester;
      }
      if (status && status !== 'all') {
        matchStage['finalStatus'] = status;
      }
      if (type && type !== 'all') {
        matchStage['internshipDetails.mode'] = type;
      }
      if (startDate || endDate) {
        matchStage['internshipDetails.fromDate'] = {};
        if (startDate) matchStage['internshipDetails.fromDate'].$gte = new Date(startDate);
        if (endDate) matchStage['internshipDetails.fromDate'].$lte = new Date(endDate);
      }
      data = await mongoose.model('Internship').find(matchStage);
    } else {
      let list = memoryInternships.filter(i => i.finalStatus === 'Approved');
      if (branch && branch !== 'all') {
        list = list.filter(i => i.studentDetails?.branch === branch);
      }
      if (semester && semester !== 'all') {
        list = list.filter(i => i.studentDetails?.year === semester);
      }
      if (status && status !== 'all') {
        list = list.filter(i => i.finalStatus === status);
      }
      if (type && type !== 'all') {
        list = list.filter(i => i.internshipDetails?.mode === type);
      }
      if (startDate) {
        list = list.filter(i => new Date(i.internshipDetails?.fromDate) >= new Date(startDate));
      }
      if (endDate) {
        list = list.filter(i => new Date(i.internshipDetails?.fromDate) <= new Date(endDate));
      }
      data = list;
    }
  } else if (module === 'reports') {
    if (mongoose.connection.readyState === 1) {
      const matchStage: any = {};
      if (branch && branch !== 'all') {
        matchStage['studentDetails.branch'] = branch;
      }
      if (status && status !== 'all') {
        matchStage['status'] = status;
      }
      if (startDate || endDate) {
        matchStage['createdAt'] = {};
        if (startDate) matchStage['createdAt'].$gte = new Date(startDate);
        if (endDate) matchStage['createdAt'].$lte = new Date(endDate);
      }
      data = await mongoose.model('MonthlyReport').find(matchStage);
    } else {
      let list = memoryReports;
      if (branch && branch !== 'all') {
        list = list.filter(r => r.studentDetails?.branch === branch);
      }
      if (status && status !== 'all') {
        list = list.filter(r => r.status === status);
      }
      if (startDate) {
        list = list.filter(r => new Date(r.createdAt) >= new Date(startDate));
      }
      if (endDate) {
        list = list.filter(r => new Date(r.createdAt) <= new Date(endDate));
      }
      data = list;
    }
  }
  return data;
}

// GET /api/reports/completions - JSON API
router.get('/completions', authenticate, authorize(['cdc', 'principal']), async (req, res) => {
  try {
    const data = await fetchReportData(req.query);
    res.json(data);
  } catch (error: any) {
    console.error('Fetch completions reports error:', error);
    res.status(500).json({ message: 'Error fetching completions reports' });
  }
});

// GET /api/reports/export-excel
router.get('/export-excel', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    const { module = 'completions' } = req.query;
    const data = await fetchReportData(req.query);

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Internship Record');

    let headers: string[] = [];
    let rows: any[] = [];

    if (module === 'completions') {
      headers = [
        'Roll Number', 'Student Name', 'Branch', 'Year/Semester', 
        'Company Name', 'Mode', 'Start Date', 'End Date', 
        'Duration', 'Completion Date', 'Status'
      ];
      rows = data.map(item => [
        item.studentDetails?.rollNumber || '',
        item.studentDetails?.name || '',
        item.studentDetails?.branch || '',
        item.studentDetails?.year || '',
        item.internship?.internshipDetails?.companyName || 'N/A',
        item.internship?.internshipDetails?.mode || 'N/A',
        item.internship?.internshipDetails?.fromDate ? moment(item.internship.internshipDetails.fromDate).format('YYYY-MM-DD') : 'N/A',
        item.internship?.internshipDetails?.toDate ? moment(item.internship.internshipDetails.toDate).format('YYYY-MM-DD') : 'N/A',
        item.internship?.internshipDetails?.totalDuration ? `${item.internship.internshipDetails.totalDuration} Months` : 'N/A',
        item.completionDate ? moment(item.completionDate).format('YYYY-MM-DD') : 'N/A',
        item.status || ''
      ]);
    } else if (module === 'approved') {
      headers = [
        'Roll Number', 'Student Name', 'Branch', 'Year/Semester', 
        'Company Name', 'Obtained Through', 'Mode', 'Start Date', 
        'End Date', 'Duration', 'CDC Status', 'Principal Status'
      ];
      rows = data.map(item => [
        item.studentDetails?.rollNumber || '',
        item.studentDetails?.name || '',
        item.studentDetails?.branch || '',
        item.studentDetails?.year || '',
        item.internshipDetails?.companyName || '',
        item.internshipDetails?.obtainedThrough || '',
        item.internshipDetails?.mode || '',
        item.internshipDetails?.fromDate ? moment(item.internshipDetails.fromDate).format('YYYY-MM-DD') : '',
        item.internshipDetails?.toDate ? moment(item.internshipDetails.toDate).format('YYYY-MM-DD') : '',
        item.internshipDetails?.totalDuration ? `${item.internshipDetails.totalDuration} Months` : '',
        item.eligibilityStatus || '',
        item.finalStatus || ''
      ]);
    } else {
      headers = [
        'Roll Number', 'Student Name', 'Branch', 
        'Report Month', 'Report File Name', 'Submitted Date', 
        'CDC Remarks', 'Principal Remarks', 'Status'
      ];
      rows = data.map(item => [
        item.studentDetails?.rollNumber || '',
        item.studentDetails?.name || '',
        item.studentDetails?.branch || '',
        item.month || '',
        item.fileName || '',
        item.createdAt ? moment(item.createdAt).format('YYYY-MM-DD HH:mm') : '',
        item.cdcRemarks || '',
        item.principalRemarks || '',
        item.status || ''
      ]);
    }

    worksheet.columns = headers.map((header, idx) => ({
      header: header,
      key: `col_${idx}`,
      width: 15
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF78BE21' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };

    rows.forEach(row => {
      const rowObj: any = {};
      row.forEach((cell: any, cellIdx: number) => {
        rowObj[`col_${cellIdx}`] = cell;
      });
      worksheet.addRow(rowObj);
    });

    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.max(maxLength + 3, 12);
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=hitam-internship-${module}-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Error exporting Excel sheet' });
  }
});

// GET /api/reports/export-pdf
router.get('/export-pdf', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    const { module = 'completions' } = req.query;
    const data = await fetchReportData(req.query);

    const doc = new PDFDocument({ layout: 'landscape', margin: 30, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=hitam-internship-${module}-${Date.now()}.pdf`);
    doc.pipe(res);

    // Document Header
    const logoPath = path.join(process.cwd(), 'public', 'HitamLogos.jpeg');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 22, { width: 40 });
    }

    doc.fillColor('#0f172a'); // slate-900
    doc.font('Helvetica-Bold').fontSize(14).text('HYDERABAD INSTITUTE OF TECHNOLOGY AND MANAGEMENT', 80, 22);
    doc.fontSize(10).fillColor('#475569').text('Career Design Centre (CDC) - Internship Records Program', 80, 38);
    
    let title = 'Internship Completion Submissions';
    if (module === 'approved') title = 'Official Approved Student Internships';
    if (module === 'reports') title = 'Monthly Student Work Reports';
    
    doc.fontSize(9).fillColor('#64748b').text(`Report Title: ${title} | Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')} | By: ${req.user?.email || 'System'} (${req.user?.role.toUpperCase()})`, 80, 50);

    doc.moveTo(30, 68).lineTo(doc.page.width - 30, 68).strokeColor('#cbd5e1').lineWidth(1).stroke();

    let headers: string[] = [];
    let widths: number[] = [];
    let rows: string[][] = [];

    if (module === 'completions') {
      headers = [
        'Roll Number', 'Student Name', 'Branch', 'Year/Semester', 
        'Company Name', 'Mode', 'Start Date', 'End Date', 
        'Duration', 'Completed', 'Status'
      ];
      widths = [75, 100, 45, 80, 100, 45, 60, 60, 50, 70, 70];
      rows = data.map(item => [
        item.studentDetails?.rollNumber || '',
        item.studentDetails?.name || '',
        item.studentDetails?.branch || '',
        item.studentDetails?.year || '',
        item.internship?.internshipDetails?.companyName || 'N/A',
        item.internship?.internshipDetails?.mode || 'N/A',
        item.internship?.internshipDetails?.fromDate ? moment(item.internship.internshipDetails.fromDate).format('YYYY-MM-DD') : 'N/A',
        item.internship?.internshipDetails?.toDate ? moment(item.internship.internshipDetails.toDate).format('YYYY-MM-DD') : 'N/A',
        item.internship?.internshipDetails?.totalDuration ? `${item.internship.internshipDetails.totalDuration} M` : 'N/A',
        item.completionDate ? moment(item.completionDate).format('YYYY-MM-DD') : 'N/A',
        item.status || ''
      ]);
    } else if (module === 'approved') {
      headers = [
        'Roll Number', 'Student Name', 'Branch', 'Year/Semester', 
        'Company Name', 'Obtained Through', 'Mode', 'Start Date', 
        'End Date', 'Duration', 'CDC Status', 'Principal Status'
      ];
      widths = [75, 100, 45, 75, 95, 80, 40, 55, 55, 45, 75, 75];
      rows = data.map(item => [
        item.studentDetails?.rollNumber || '',
        item.studentDetails?.name || '',
        item.studentDetails?.branch || '',
        item.studentDetails?.year || '',
        item.internshipDetails?.companyName || '',
        item.internshipDetails?.obtainedThrough || '',
        item.internshipDetails?.mode || '',
        item.internshipDetails?.fromDate ? moment(item.internshipDetails.fromDate).format('YYYY-MM-DD') : '',
        item.internshipDetails?.toDate ? moment(item.internshipDetails.toDate).format('YYYY-MM-DD') : '',
        item.internshipDetails?.totalDuration ? `${item.internshipDetails.totalDuration} M` : '',
        item.eligibilityStatus || '',
        item.finalStatus || ''
      ]);
    } else {
      headers = [
        'Roll Number', 'Student Name', 'Branch', 
        'Report Month', 'Report File Name', 'Submitted Date', 
        'CDC Remarks', 'Principal Remarks', 'Status'
      ];
      widths = [75, 100, 45, 80, 110, 60, 95, 95, 70];
      rows = data.map(item => [
        item.studentDetails?.rollNumber || '',
        item.studentDetails?.name || '',
        item.studentDetails?.branch || '',
        item.month || '',
        item.fileName || '',
        item.createdAt ? moment(item.createdAt).format('YYYY-MM-DD HH:mm') : '',
        item.cdcRemarks || '',
        item.principalRemarks || '',
        item.status || ''
      ]);
    }

    doc.fontSize(8).fillColor('#475569').text(`Total Records Found: ${rows.length}`, 30, 80);

    // Drawing Table
    let y = 95;
    const pageHeightLimit = 525;
    const rowHeight = 22;
    const startX = 30;

    const drawHeaders = (currentY: number) => {
      doc.fillColor('#78be21');
      doc.rect(startX, currentY, widths.reduce((a, b) => a + b, 0), rowHeight).fill();
      
      doc.fillColor('#ffffff');
      doc.font('Helvetica-Bold').fontSize(8);
      
      let currentX = startX;
      headers.forEach((header, idx) => {
        doc.text(header, currentX + 4, currentY + 7, { width: widths[idx] - 8, align: 'left' });
        currentX += widths[idx];
      });
      return currentY + rowHeight;
    };

    y = drawHeaders(y);

    doc.font('Helvetica').fontSize(7);
    rows.forEach((row, rowIndex) => {
      if (y + rowHeight > pageHeightLimit) {
        doc.addPage({ layout: 'landscape', margin: 30 });
        y = drawHeaders(40);
        doc.font('Helvetica').fontSize(7);
      }

      const bg = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.fillColor(bg);
      doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), rowHeight).fill();

      doc.fillColor('#334155');
      let currentX = startX;
      row.forEach((cell, cellIdx) => {
        doc.text(cell || '', currentX + 4, y + 7, { width: widths[cellIdx] - 8, align: 'left', lineBreak: false });
        currentX += widths[cellIdx];
      });

      doc.strokeColor('#e2e8f0');
      doc.lineWidth(0.5);
      doc.moveTo(startX, y + rowHeight).lineTo(startX + widths.reduce((a, b) => a + b, 0), y + rowHeight).stroke();

      y += rowHeight;
    });

    // Add page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor('#64748b');
      doc.text(
        `Page ${i + 1} of ${range.count}`,
        30,
        doc.page.height - 22,
        { align: 'center', width: doc.page.width - 60 }
      );
      doc.text(
        'HITAM Internship Management System',
        doc.page.width - 200,
        doc.page.height - 22,
        { align: 'right', width: 170 }
      );
    }

    doc.end();
  } catch (error: any) {
    console.error('PDF export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error exporting PDF report' });
    }
  }
});

export default router;
