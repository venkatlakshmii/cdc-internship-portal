import express from 'express';
import mongoose from 'mongoose';
import { PortalControl } from '../models/PortalControl.ts';
import { AcademicCalendar } from '../models/AcademicCalendar.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';

const router = express.Router();

// Fallback in-memory storage for portal settings and calendar events
export let memoryPortalControl = {
  newApplicationsEnabled: true,
  monthlyReportsEnabled: true,
  completionsEnabled: true,
  communicationsEnabled: true,
  notificationsEnabled: true,
  manualOverride: 'none',
  overrideReason: '',
  overrideExpiryDate: null as any
};

export let memoryAcademicCalendar: any[] = [];

// Helper to calculate module statuses dynamically
export async function getModuleStatusInfo() {
  let settings = memoryPortalControl;
  let calendar: any[] = memoryAcademicCalendar;

  if (mongoose.connection.readyState === 1) {
    try {
      let dbSettings = await PortalControl.findOne();
      if (!dbSettings) {
        dbSettings = new PortalControl();
        await dbSettings.save();
      }
      settings = dbSettings.toObject() as any;
      calendar = await AcademicCalendar.find();
    } catch (err) {
      console.error('Error fetching portal settings from DB:', err);
    }
  }

  const now = new Date();

  // Find active exam/restriction calendar events
  const currentEvents = calendar.filter(event => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    // Include the entire day of the end date
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  });

  const isExamPeriod = currentEvents.some(e => 
    e.type === 'exam_internal' || 
    e.type === 'exam_mid' || 
    e.type === 'exam_semester' || 
    e.type === 'restriction'
  );

  const activeExamEvent = currentEvents.find(e => 
    e.type === 'exam_internal' || 
    e.type === 'exam_mid' || 
    e.type === 'exam_semester' || 
    e.type === 'restriction'
  );

  // Determine status for Internship Applications
  let appsStatus = settings.newApplicationsEnabled ? 'active' : 'disabled';
  let warningMessage = '';

  if (isExamPeriod && activeExamEvent) {
    appsStatus = 'restricted';
    warningMessage = `New internship applications are temporarily disabled due to academic examination schedule (${activeExamEvent.title}).`;
  }

  // Handle Manual Override
  if (settings.manualOverride && settings.manualOverride !== 'none') {
    const isOverrideActive = !settings.overrideExpiryDate || new Date(settings.overrideExpiryDate) > now;
    if (isOverrideActive) {
      if (settings.manualOverride === 'force_enable') {
        appsStatus = 'active';
        warningMessage = '';
      } else if (settings.manualOverride === 'force_disable') {
        appsStatus = 'disabled';
        warningMessage = settings.overrideReason || 'Internship applications are temporarily disabled by the administrator.';
      }
    }
  }

  // Non-application modules are controlled strictly by toggles
  const reportsStatus = settings.monthlyReportsEnabled ? 'active' : 'disabled';
  const completionsStatus = settings.completionsEnabled ? 'active' : 'disabled';
  const communicationsStatus = settings.communicationsEnabled ? 'active' : 'disabled';

  return {
    modules: {
      applications: appsStatus,
      monthlyReports: reportsStatus,
      completions: completionsStatus,
      communications: communicationsStatus
    },
    warningMessage,
    settings,
    calendar,
    activeExamEvent
  };
}

// GET /api/portal-control/status - Retrieve active statuses and warnings (available to students/all)
router.get('/status', authenticate, async (req, res) => {
  try {
    const info = await getModuleStatusInfo();
    res.json({
      modules: info.modules,
      warningMessage: info.warningMessage,
      activeExamEvent: info.activeExamEvent
    });
  } catch (error) {
    console.error('Error fetching portal status:', error);
    res.status(500).json({ message: 'Error loading portal status' });
  }
});

// GET /api/portal-control/settings - Fetch full settings (CDC & Principal only)
router.get('/settings', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    const info = await getModuleStatusInfo();
    res.json({
      settings: info.settings,
      calendar: info.calendar,
      modules: info.modules
    });
  } catch (error) {
    console.error('Error loading portal control settings:', error);
    res.status(500).json({ message: 'Error loading settings' });
  }
});

// POST /api/portal-control/settings - Update settings toggles & overrides (CDC & Principal only)
router.post('/settings', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    const { 
      newApplicationsEnabled, 
      monthlyReportsEnabled, 
      completionsEnabled, 
      communicationsEnabled, 
      notificationsEnabled,
      manualOverride,
      overrideReason,
      overrideExpiryDate
    } = req.body;

    if (mongoose.connection.readyState !== 1) {
      memoryPortalControl = {
        newApplicationsEnabled: newApplicationsEnabled !== undefined ? !!newApplicationsEnabled : memoryPortalControl.newApplicationsEnabled,
        monthlyReportsEnabled: monthlyReportsEnabled !== undefined ? !!monthlyReportsEnabled : memoryPortalControl.monthlyReportsEnabled,
        completionsEnabled: completionsEnabled !== undefined ? !!completionsEnabled : memoryPortalControl.completionsEnabled,
        communicationsEnabled: communicationsEnabled !== undefined ? !!communicationsEnabled : memoryPortalControl.communicationsEnabled,
        notificationsEnabled: notificationsEnabled !== undefined ? !!notificationsEnabled : memoryPortalControl.notificationsEnabled,
        manualOverride: manualOverride || memoryPortalControl.manualOverride,
        overrideReason: overrideReason || '',
        overrideExpiryDate: overrideExpiryDate ? new Date(overrideExpiryDate) : null as any
      };
      const info = await getModuleStatusInfo();
      return res.json({ message: 'Settings updated successfully (Fallback Mode)', settings: memoryPortalControl, modules: info.modules });
    }

    let settings = await PortalControl.findOne();
    if (!settings) {
      settings = new PortalControl();
    }

    if (newApplicationsEnabled !== undefined) settings.newApplicationsEnabled = !!newApplicationsEnabled;
    if (monthlyReportsEnabled !== undefined) settings.monthlyReportsEnabled = !!monthlyReportsEnabled;
    if (completionsEnabled !== undefined) settings.completionsEnabled = !!completionsEnabled;
    if (communicationsEnabled !== undefined) settings.communicationsEnabled = !!communicationsEnabled;
    if (notificationsEnabled !== undefined) settings.notificationsEnabled = !!notificationsEnabled;
    if (manualOverride !== undefined) settings.manualOverride = manualOverride;
    if (overrideReason !== undefined) settings.overrideReason = overrideReason;
    if (overrideExpiryDate !== undefined) settings.overrideExpiryDate = overrideExpiryDate ? new Date(overrideExpiryDate) : undefined;

    await settings.save();
    const info = await getModuleStatusInfo();
    res.json({ message: 'Settings updated successfully', settings, modules: info.modules });
  } catch (error) {
    console.error('Error updating portal settings:', error);
    res.status(500).json({ message: 'Error saving settings' });
  }
});

// POST /api/portal-control/calendar - Add calendar event (CDC & Principal only)
router.post('/calendar', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    const { title, type, startDate, endDate } = req.body;

    if (!title || !type || !startDate || !endDate) {
      return res.status(400).json({ message: 'All calendar fields are required.' });
    }

    const eventData = {
      title,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    if (mongoose.connection.readyState !== 1) {
      const fallbackEvent = {
        _id: `evt-${Date.now()}`,
        ...eventData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memoryAcademicCalendar.push(fallbackEvent);
      return res.status(201).json({ message: 'Event added successfully (Fallback Mode)', event: fallbackEvent });
    }

    const event = new AcademicCalendar(eventData);
    await event.save();
    res.status(201).json({ message: 'Event added successfully', event });
  } catch (error) {
    console.error('Error adding calendar event:', error);
    res.status(500).json({ message: 'Error saving calendar event' });
  }
});

// DELETE /api/portal-control/calendar/:id - Remove calendar event (CDC & Principal only)
router.delete('/calendar/:id', authenticate, authorize(['cdc', 'principal']), async (req: AuthRequest, res) => {
  try {
    const eventId = req.params.id;

    if (mongoose.connection.readyState !== 1) {
      const index = memoryAcademicCalendar.findIndex(e => e._id === eventId);
      if (index === -1) return res.status(404).json({ message: 'Event not found.' });
      memoryAcademicCalendar.splice(index, 1);
      return res.json({ message: 'Event deleted successfully (Fallback Mode)' });
    }

    const event = await AcademicCalendar.findByIdAndDelete(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ message: 'Error deleting calendar event' });
  }
});

export default router;
