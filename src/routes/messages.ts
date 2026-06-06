import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { Message } from '../models/Message.ts';
import { User } from '../models/User.ts';
import { Internship } from '../models/Internship.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';
import { getModuleStatusInfo } from './portalControl.ts';

const router = express.Router();

// Fallback in-memory storage for messages
export let memoryMessages: any[] = [
  {
    _id: 'msg-demo-1',
    senderId: 'principal-id',
    senderName: 'Principal',
    senderRole: 'principal',
    recipientId: 'all',
    recipientName: 'All Users',
    recipientRole: 'all',
    subject: 'Welcome to HITAM CDC Communication Center',
    content: 'This announcement center is for official notices, queries, and direct messaging regarding internship approvals.',
    type: 'announcement',
    isRead: false,
    isImportant: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
  }
];

// Multer setup for message attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `msg-attach-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|jpg|jpeg|png|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) return cb(null, true);
    cb(new Error('Only PDF, JPG, PNG, DOC, and DOCX files are allowed!'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET /api/messages/recipients - Get list of potential message recipients
router.get('/recipients', authenticate, async (req: AuthRequest, res) => {
  try {
    const currentRole = req.user?.role;
    
    // In-memory fallback
    if (mongoose.connection.readyState !== 1) {
      const fallbackRecipients = [
        { _id: 'student-fallback-id', name: 'Student User', email: '24E51A1234@hitam.org', role: 'student' },
        { _id: 'cdc-fallback-id', name: 'CDC Faculty', email: 'cdc@hitam.org', role: 'cdc' },
        { _id: 'principal-fallback-id', name: 'Principal', email: 'principal@hitam.org', role: 'principal' }
      ];
      
      // Filter out self
      const filtered = fallbackRecipients.filter(u => u.email !== req.user?.email);
      
      // Students can only message staff
      if (currentRole === 'student') {
        return res.json(filtered.filter(u => u.role !== 'student'));
      }
      return res.json(filtered);
    }

    let filter: any = {};
    if (currentRole === 'student') {
      // Students can only message CDC and Principal
      filter = { role: { $in: ['cdc', 'principal'] } };
    } else {
      // Staff can message student, cdc, or principal (excluding themselves)
      filter = { 
        role: { $in: ['student', 'cdc', 'principal'] },
        _id: { $ne: req.user?.id } 
      };
    }

    const users = await User.find(filter).select('name email role rollNumber branch').sort({ name: 1 });
    res.json(users);
  } catch (error: any) {
    console.error('Error fetching recipients:', error);
    res.status(500).json({ message: 'Error fetching recipients list' });
  }
});

// GET /api/messages/internships - Get internships lists for dropdown mapping
router.get('/internships', authenticate, async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.query;
    
    if (mongoose.connection.readyState !== 1) {
      // Fallback
      return res.json([]);
    }

    let filter: any = {};
    if (req.user?.role === 'student') {
      filter = { studentId: req.user.id };
    } else if (studentId) {
      filter = { studentId: studentId };
    }

    const internships = await Internship.find(filter).select('studentDetails.name internshipDetails.companyName eligibilityStatus finalStatus').sort({ createdAt: -1 });
    res.json(internships);
  } catch (error: any) {
    console.error('Error fetching internships for messaging:', error);
    res.status(500).json({ message: 'Error fetching internships list' });
  }
});

// POST /api/messages/send - Send a new message or announcement
router.post('/send', authenticate, upload.single('attachment'), async (req: AuthRequest, res) => {
  try {
    const statusInfo = await getModuleStatusInfo();
    if (statusInfo.modules.communications !== 'active' && req.body.type !== 'announcement') {
      return res.status(403).json({ message: 'The communication messaging system is temporarily disabled.' });
    }

    const { 
      recipientId, 
      subject, 
      content, 
      type, 
      internshipId, 
      parentMessageId,
      targetedStudentName,
      targetedRollNumber,
      targetedSemester,
      targetedBranch,
      targetedFacultyName,
      targetedDepartment,
      principalMsgType
    } = req.body;
    
    if (!subject || !content) {
      return res.status(400).json({ message: 'Subject and Content are required.' });
    }

    const isAnnouncement = type === 'announcement';
    if (isAnnouncement && req.user?.role !== 'principal') {
      return res.status(403).json({ message: 'Only the Principal can broadcast announcements.' });
    }

    if (!isAnnouncement && !recipientId) {
      return res.status(400).json({ message: 'Recipient is required for direct messages.' });
    }

    let recipientName = 'All Users';
    let recipientRole = 'all';

    // Get sender information
    let senderName = 'System User';
    let senderRole = req.user?.role || 'student';
    
    if (mongoose.connection.readyState === 1) {
      const sender = await User.findById(req.user?.id);
      if (sender) {
        senderName = sender.name;
        senderRole = sender.role;
      }

      if (!isAnnouncement) {
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          return res.status(404).json({ message: 'Recipient user not found.' });
        }
        recipientName = recipient.name;
        recipientRole = recipient.role;
      }
    } else {
      // Fallback matching
      const fallbackUsers = [
        { id: 'student-fallback-id', name: 'Student User', role: 'student', email: '24E51A1234@hitam.org' },
        { id: 'cdc-fallback-id', name: 'CDC Faculty', role: 'cdc', email: 'cdc@hitam.org' },
        { id: 'principal-fallback-id', name: 'Principal', role: 'principal', email: 'principal@hitam.org' }
      ];

      const sender = fallbackUsers.find(u => u.email === req.user?.email);
      if (sender) {
        senderName = sender.name;
        senderRole = sender.role;
      }

      if (!isAnnouncement) {
        const recipient = fallbackUsers.find(u => u.id === recipientId || u.email === recipientId);
        if (!recipient) {
          return res.status(404).json({ message: 'Recipient user not found in fallback list.' });
        }
        recipientName = recipient.name;
        recipientRole = recipient.role;
      }
    }

    const messageData: any = {
      senderId: req.user?.id || 'fallback-sender-id',
      senderName,
      senderRole,
      recipientId: isAnnouncement ? 'all' : recipientId,
      recipientName,
      recipientRole,
      subject,
      content,
      type: type || 'direct',
      internshipId: internshipId || null,
      parentMessageId: parentMessageId || null,
      isRead: false,
      isImportant: false,
      targetedStudentName: targetedStudentName || null,
      targetedRollNumber: targetedRollNumber || null,
      targetedSemester: targetedSemester || null,
      targetedBranch: targetedBranch || null,
      targetedFacultyName: targetedFacultyName || null,
      targetedDepartment: targetedDepartment || null,
      principalMsgType: principalMsgType || 'none',
      status: 'sent'
    };

    if (req.file) {
      messageData.attachmentPath = req.file.path;
      messageData.attachmentName = req.file.originalname;
    }

    if (mongoose.connection.readyState !== 1) {
      const ephemeralMsg = {
        ...messageData,
        _id: `msg-mem-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memoryMessages.push(ephemeralMsg);
      return res.status(201).json({ message: 'Message sent successfully (Fallback Mode)', data: ephemeralMsg });
    }

    const newMessage = new Message(messageData);
    await newMessage.save();
    res.status(201).json({ message: 'Message sent successfully', data: newMessage });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
});

// GET /api/messages/conversations - Get all messages involving the user (inbox, sent, announcements)
router.get('/conversations', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (mongoose.connection.readyState !== 1) {
      // Fallback: match senderId or recipientId or type === 'announcement'
      const list = memoryMessages.filter(
        m => m.senderId === userId ||
             m.recipientId === userId ||
             m.recipientId === req.user?.email ||
             m.type === 'announcement' ||
             (userRole !== 'student' && m.recipientRole === userRole)
      );

      // Update status from 'sent' to 'delivered' for messages where recipient is this user
      list.forEach(m => {
        if (m.recipientId === userId && m.status === 'sent') {
          m.status = 'delivered';
        }
      });

      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json(list);
    }

    const messages = await Message.find({
      $or: [
        { senderId: userId },
        { recipientId: userId },
        { type: 'announcement' }
      ]
    }).sort({ createdAt: -1 });

    // Update status from 'sent' to 'delivered' for incoming messages
    const sentIncomingIds = messages
      .filter(m => m.recipientId === userId && m.status === 'sent')
      .map(m => m._id);

    if (sentIncomingIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: sentIncomingIds } },
        { $set: { status: 'delivered' } }
      );
      messages.forEach(m => {
        if (sentIncomingIds.includes(m._id)) {
          m.status = 'delivered';
        }
      });
    }

    res.json(messages);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error loading conversations' });
  }
});

// GET /api/messages/inbox - Get received messages
router.get('/inbox', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (mongoose.connection.readyState !== 1) {
      // Fallback: match recipient id OR 'all' (announcements)
      const list = memoryMessages.filter(
        m => m.recipientId === userId || 
             m.recipientId === req.user?.email || 
             (m.type === 'announcement') ||
             (userRole !== 'student' && m.recipientRole === userRole)
      );

      // Update status from 'sent' to 'delivered' for messages where recipient is this user
      list.forEach(m => {
        if (m.recipientId === userId && m.status === 'sent') {
          m.status = 'delivered';
        }
      });

      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json(list);
    }

    // Direct messages sent to user, OR announcements
    const messages = await Message.find({
      $or: [
        { recipientId: userId },
        { type: 'announcement' }
      ]
    }).sort({ createdAt: -1 });

    // Update status from 'sent' to 'delivered' for direct messages
    const sentMessageIds = messages
      .filter(m => m.recipientId === userId && m.status === 'sent')
      .map(m => m._id);

    if (sentMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: sentMessageIds } },
        { $set: { status: 'delivered' } }
      );
      // Update local array status values
      messages.forEach(m => {
        if (sentMessageIds.includes(m._id)) {
          m.status = 'delivered';
        }
      });
    }

    res.json(messages);
  } catch (error) {
    console.error('Error fetching inbox messages:', error);
    res.status(500).json({ message: 'Error loading inbox messages' });
  }
});

// GET /api/messages/sent - Get sent direct messages
router.get('/sent', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    if (mongoose.connection.readyState !== 1) {
      const list = memoryMessages.filter(m => m.senderId === userId && m.type === 'direct');
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json(list);
    }

    const messages = await Message.find({
      senderId: userId,
      type: 'direct'
    }).sort({ createdAt: -1 });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching sent messages:', error);
    res.status(500).json({ message: 'Error loading sent messages' });
  }
});

// GET /api/messages/unread-count - Get total unread count
router.get('/unread-count', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    if (mongoose.connection.readyState !== 1) {
      const count = memoryMessages.filter(
        m => (m.recipientId === userId || m.recipientId === req.user?.email || m.type === 'announcement') && !m.isRead
      ).length;
      return res.json({ unreadCount: count });
    }

    const unreadCount = await Message.countDocuments({
      $or: [
        { recipientId: userId },
        { type: 'announcement' }
      ],
      isRead: false
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Error reading notifications' });
  }
});

// PATCH /api/messages/read/:id - Toggle/set read status
router.patch('/read/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { isRead } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const index = memoryMessages.findIndex(m => m._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Message not found' });
      
      const msg = memoryMessages[index];
      // Security check: must be recipient or type announcement
      if (msg.recipientId !== userId && msg.recipientId !== req.user?.email && msg.type !== 'announcement') {
        return res.status(403).json({ message: 'Access denied' });
      }

      memoryMessages[index].isRead = isRead !== undefined ? isRead : true;
      if (isRead !== false) {
        memoryMessages[index].status = 'read';
      }
      return res.json({ message: 'Message read status updated', data: memoryMessages[index] });
    }

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Security check: only recipient or anyone reading an announcement can mark it read
    if (message.recipientId !== userId && message.type !== 'announcement') {
      return res.status(403).json({ message: 'Access denied' });
    }

    message.isRead = isRead !== undefined ? isRead : true;
    if (isRead !== false) {
      message.status = 'read';
    }
    await message.save();

    res.json({ message: 'Message marked as read', data: message });
  } catch (error) {
    console.error('Error updating read status:', error);
    res.status(500).json({ message: 'Error marking message as read' });
  }
});

// GET /api/messages/thread/:id - Fetch full thread for a message
router.get('/thread/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user?.id;

    if (mongoose.connection.readyState !== 1) {
      const msg = memoryMessages.find(m => m._id === messageId);
      if (!msg) return res.status(404).json({ message: 'Message not found' });

      const rootId = msg.parentMessageId || msg._id;
      const thread = memoryMessages.filter(
        m => m._id === rootId || m.parentMessageId === rootId
      );

      thread.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      thread.forEach(m => {
        if (m.recipientId === userId && m.status === 'sent') {
          m.status = 'delivered';
        }
      });

      return res.json(thread);
    }

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    const rootId = msg.parentMessageId || msg._id;
    const thread = await Message.find({
      $or: [
        { _id: rootId },
        { parentMessageId: rootId }
      ]
    }).sort({ createdAt: 1 });

    const sentIncomingIds = thread
      .filter(m => m.recipientId === userId && m.status === 'sent')
      .map(m => m._id);

    if (sentIncomingIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: sentIncomingIds } },
        { $set: { status: 'delivered' } }
      );
      thread.forEach(m => {
        if (sentIncomingIds.includes(m._id)) {
          m.status = 'delivered';
        }
      });
    }

    res.json(thread);
  } catch (error) {
    console.error('Error loading thread:', error);
    res.status(500).json({ message: 'Error loading conversation thread' });
  }
});

// PATCH /api/messages/important/:id - Toggle important status
router.patch('/important/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    if (mongoose.connection.readyState !== 1) {
      const index = memoryMessages.findIndex(m => m._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Message not found' });
      
      const msg = memoryMessages[index];
      // Security check: must be sender or recipient
      if (msg.senderId !== userId && msg.recipientId !== userId && msg.recipientId !== req.user?.email && msg.type !== 'announcement') {
        return res.status(403).json({ message: 'Access denied' });
      }

      memoryMessages[index].isImportant = !memoryMessages[index].isImportant;
      return res.json({ message: 'Important status toggled', data: memoryMessages[index] });
    }

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Security check: only sender, recipient, or anyone viewing an announcement can tag as important
    if (message.senderId !== userId && message.recipientId !== userId && message.type !== 'announcement') {
      return res.status(403).json({ message: 'Access denied' });
    }

    message.isImportant = !message.isImportant;
    await message.save();

    res.json({ message: 'Message important status toggled', data: message });
  } catch (error) {
    console.error('Error toggling important status:', error);
    res.status(500).json({ message: 'Error updating message status' });
  }
});

export default router;
