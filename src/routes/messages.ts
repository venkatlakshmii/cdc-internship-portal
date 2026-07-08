import express from 'express';
import { uploadCloudReports } from '../middleware/uploadCloud.ts';
import path from 'path';
import fs from 'fs';
import { Message } from '../models/Message.ts';
import { User } from '../models/User.ts';
import { Internship } from '../models/Internship.ts';
import { DbFile } from '../models/DbFile.ts';
import { authenticate, AuthRequest } from '../middleware/auth.ts';
import { getModuleStatusInfo } from './portalControl.ts';

const router = express.Router();

// Multer setup replaced with Cloudinary storage
const upload = uploadCloudReports;

// GET /api/messages/recipients - Get list of potential message recipients
router.get('/recipients', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const currentRole = req.user?.role;
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
    next(error);
  }
});

// GET /api/messages/internships - Get internships lists for dropdown mapping
router.get('/internships', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { studentId } = req.query;
    let filter: any = {};
    if (req.user?.role === 'student') {
      filter = { studentId: req.user.id };
    } else if (studentId) {
      filter = { studentId: studentId };
    }

    const internships = await Internship.find(filter).select('studentDetails.name internshipDetails.companyName eligibilityStatus finalStatus').sort({ createdAt: -1 });
    res.json(internships);
  } catch (error: any) {
    next(error);
  }
});

// POST /api/messages/send - Send a new message or announcement
router.post('/send', authenticate, upload.single('attachment'), async (req: AuthRequest, res, next) => {
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
    
    const sender = await User.findById(req.user?.id);
    if (sender) {
      senderName = sender.name;
      senderRole = sender.role;
    }

    if (!isAnnouncement) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(recipientId);
      if (!isValidObjectId) {
        if (recipientId === 'system-alert') {
          recipientName = 'System Control';
          recipientRole = 'system';
        } else {
          return res.status(400).json({ message: 'Invalid recipient ID format.' });
        }
      } else {
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          return res.status(404).json({ message: 'Recipient user not found.' });
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
      const dbFile = new DbFile({
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        data: req.file.buffer,
        size: req.file.size
      });
      await dbFile.save();
      messageData.attachmentPath = `api/files/download/${dbFile._id}`;
      messageData.attachmentName = req.file.originalname;
      messageData.attachmentPublicId = dbFile._id.toString();
    }

    const newMessage = new Message(messageData);
    await newMessage.save();
    res.status(201).json({ message: 'Message sent successfully', data: newMessage });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/messages/conversations - Get all messages involving the user (inbox, sent, announcements)
router.get('/conversations', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;

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
    next(error);
  }
});

// GET /api/messages/inbox - Get received messages
router.get('/inbox', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;

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
    next(error);
  }
});

// GET /api/messages/sent - Get sent direct messages
router.get('/sent', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;

    const messages = await Message.find({
      senderId: userId,
      type: 'direct'
    }).sort({ createdAt: -1 });

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// GET /api/messages/unread-count - Get total unread count
router.get('/unread-count', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;

    const unreadCount = await Message.countDocuments({
      $or: [
        { recipientId: userId },
        { type: 'announcement' }
      ],
      isRead: false
    });

    res.json({ unreadCount });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/messages/read/:id - Toggle/set read status
router.patch('/read/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const { isRead } = req.body;

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
    next(error);
  }
});

// GET /api/messages/thread/:id - Fetch full thread for a message
router.get('/thread/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const messageId = req.params.id;
    const userId = req.user?.id;

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
    next(error);
  }
});

// PATCH /api/messages/important/:id - Toggle important status
router.patch('/important/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;

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
    next(error);
  }
});

export default router;
