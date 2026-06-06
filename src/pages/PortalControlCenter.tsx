import { useState, useEffect, FormEvent } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  Lock,
  MessageSquare,
  FileText,
  FilePlus,
  Bell
} from 'lucide-react';

interface PortalSettings {
  newApplicationsEnabled: boolean;
  monthlyReportsEnabled: boolean;
  completionsEnabled: boolean;
  communicationsEnabled: boolean;
  notificationsEnabled: boolean;
  manualOverride: string;
  overrideReason: string;
  overrideExpiryDate: string | null;
}

interface CalendarEvent {
  _id: string;
  title: string;
  type: 'exam_internal' | 'exam_mid' | 'exam_semester' | 'restriction' | 'other';
  startDate: string;
  endDate: string;
}

interface ModuleStatus {
  applications: 'active' | 'disabled' | 'restricted';
  monthlyReports: 'active' | 'disabled';
  completions: 'active' | 'disabled';
  communications: 'active' | 'disabled';
}

export default function PortalControlCenter() {
  const [settings, setSettings] = useState<PortalSettings>({
    newApplicationsEnabled: true,
    monthlyReportsEnabled: true,
    completionsEnabled: true,
    communicationsEnabled: true,
    notificationsEnabled: true,
    manualOverride: 'none',
    overrideReason: '',
    overrideExpiryDate: null,
  });

  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [modules, setModules] = useState<ModuleStatus>({
    applications: 'active',
    monthlyReports: 'active',
    completions: 'active',
    communications: 'active',
  });

  const [loading, setLoading] = useState(true);
  const [submittingSettings, setSubmittingSettings] = useState(false);
  const [submittingCalendar, setSubmittingCalendar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Event Form State
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'exam_mid',
    startDate: '',
    endDate: '',
  });

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/portal-control/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response && response.data) {
        setSettings(response.data.settings || {
          newApplicationsEnabled: true,
          monthlyReportsEnabled: true,
          completionsEnabled: true,
          communicationsEnabled: true,
          notificationsEnabled: true,
          manualOverride: 'none',
          overrideReason: '',
          overrideExpiryDate: null,
        });
        setCalendar(response.data.calendar || []);
        setModules(response.data.modules || {
          applications: 'active',
          monthlyReports: 'active',
          completions: 'active',
          communications: 'active',
        });
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.response?.data?.message || 'Failed to load control settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = (key: keyof PortalSettings) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: !prev[key]
      };
    });
  };

  const handleSettingsChange = (key: keyof PortalSettings, value: any) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: value
      };
    });
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSubmittingSettings(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...settings,
        overrideExpiryDate: settings?.overrideExpiryDate ? new Date(settings.overrideExpiryDate).toISOString() : null
      };

      const response = await axios.post('/api/portal-control/settings', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response && response.data) {
        setSettings(response.data.settings || settings);
        setModules(response.data.modules || modules);
        setSuccess('Portal settings updated successfully.');
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSubmittingSettings(false);
    }
  };

  const handleAddCalendarEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.startDate || !newEvent.endDate) {
      setError('Please fill in all calendar event fields.');
      return;
    }

    if (new Date(newEvent.startDate) > new Date(newEvent.endDate)) {
      setError('Start date cannot be after end date.');
      return;
    }

    setSubmittingCalendar(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/portal-control/calendar', newEvent, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response && response.data) {
        setSuccess('Calendar event added successfully.');
        setNewEvent({ title: '', type: 'exam_mid', startDate: '', endDate: '' });
        fetchSettings(); // Refresh settings & calendar
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Error adding calendar event:', err);
      setError(err.response?.data?.message || 'Failed to add calendar event.');
    } finally {
      setSubmittingCalendar(false);
    }
  };

  const handleDeleteCalendarEvent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this calendar restriction?')) return;

    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/portal-control/calendar/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Calendar event removed successfully.');
      fetchSettings(); // Refresh settings & calendar
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error deleting calendar event:', err);
      setError(err.response?.data?.message || 'Failed to delete calendar event.');
    }
  };

  const getStatusBadge = (status: 'active' | 'disabled' | 'restricted' | string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} />
            Active
          </span>
        );
      case 'restricted':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
            <AlertTriangle size={12} />
            Restricted
          </span>
        );
      case 'disabled':
      default:
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
            <XCircle size={12} />
            Disabled
          </span>
        );
    }
  };

  const getCalendarTypeLabel = (type: string) => {
    switch (type) {
      case 'exam_internal': return 'Internal Exams';
      case 'exam_mid': return 'Mid Exams';
      case 'exam_semester': return 'Semester Exams';
      case 'restriction': return 'Institutional Restriction';
      default: return 'Other Event';
    }
  };

  const formatDateTimeLocal = (dateVal: any) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      const pad = (num: number) => String(num).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (e) {
      return '';
    }
  };

  const calendarEvents = Array.isArray(calendar) ? calendar : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-[#78be21] border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Portal Control Center...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-[#78be21]" size={28} />
            Portal Control Center
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage system modules, override permissions during exam schedules, and manage restricted calendar periods.
          </p>
        </div>
      </div>

      {/* Status Banner Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-start gap-3 text-sm">
          <XCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3 text-sm">
          <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Main Grid split: Left (Status & Toggles), Right (Override & Calendar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Module Statuses & Switches */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">System Module Controls</h3>
              <span className="text-slate-400 text-xs font-semibold uppercase">Global Switches</span>
            </div>

            <form onSubmit={saveSettings} className="space-y-6">
              
              {/* Modules Toggles list */}
              <div className="divide-y divide-slate-100">
                {/* 1. Internship Applications */}
                <div className="py-4 flex items-center justify-between first:pt-0">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg mt-0.5">
                      <FilePlus size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        Internship Applications
                        {getStatusBadge(modules?.applications || 'active')}
                      </h4>
                      <p className="text-slate-500 text-xs mt-1">
                        Allows students to register new internship applications. Restricts automatically during academic exams.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings?.newApplicationsEnabled ?? true} 
                        onChange={() => handleToggle('newApplicationsEnabled')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#78be21]"></div>
                    </label>
                  </div>
                </div>

                {/* 2. Monthly Reports */}
                <div className="py-4 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mt-0.5">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        Monthly Reports
                        {getStatusBadge(modules?.monthlyReports || 'active')}
                      </h4>
                      <p className="text-slate-500 text-xs mt-1">
                        Allows students to submit monthly progress reports.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings?.monthlyReportsEnabled ?? true} 
                        onChange={() => handleToggle('monthlyReportsEnabled')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#78be21]"></div>
                    </label>
                  </div>
                </div>

                {/* 3. Internship Completion */}
                <div className="py-4 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg mt-0.5">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        Internship Completion
                        {getStatusBadge(modules?.completions || 'active')}
                      </h4>
                      <p className="text-slate-500 text-xs mt-1">
                        Allows students to submit completion reports and certificates.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings?.completionsEnabled ?? true} 
                        onChange={() => handleToggle('completionsEnabled')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#78be21]"></div>
                    </label>
                  </div>
                </div>

                {/* 4. Communication Center */}
                <div className="py-4 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg mt-0.5">
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        Communication Center
                        {getStatusBadge(modules?.communications || 'active')}
                      </h4>
                      <p className="text-slate-500 text-xs mt-1">
                        Controls messaging capabilities across all roles on the platform.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings?.communicationsEnabled ?? true} 
                        onChange={() => handleToggle('communicationsEnabled')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#78be21]"></div>
                    </label>
                  </div>
                </div>

                {/* 5. Notifications Switch */}
                <div className="py-4 flex items-center justify-between last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg mt-0.5">
                      <Bell size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        Student Notifications
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${settings?.notificationsEnabled ?? true ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                          {settings?.notificationsEnabled ?? true ? 'Enabled' : 'Disabled'}
                        </span>
                      </h4>
                      <p className="text-slate-500 text-xs mt-1">
                        Controls system-triggered alerts and status notifications for students.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings?.notificationsEnabled ?? true} 
                        onChange={() => handleToggle('notificationsEnabled')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#78be21]"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Manual Override Controls */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Lock size={16} className="text-slate-600" />
                  Manual Override Policy
                </h4>
                <p className="text-slate-500 text-xs">
                  Force active/disabled state on applications, bypassing the academic exam freeze schedules.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-700 text-xs font-bold">Override Mode</label>
                    <select
                      value={settings?.manualOverride || 'none'}
                      onChange={(e) => handleSettingsChange('manualOverride', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#78be21]"
                    >
                      <option value="none">None (Follow Calendar/Toggles)</option>
                      <option value="force_enable">Force Enable (Always Active)</option>
                      <option value="force_disable">Force Disable (Always Off)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 text-xs font-bold">Expiry Date & Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formatDateTimeLocal(settings?.overrideExpiryDate)}
                      onChange={(e) => handleSettingsChange('overrideExpiryDate', e.target.value || null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#78be21]"
                    />
                  </div>
                </div>

                {(settings?.manualOverride || 'none') !== 'none' && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="text-slate-700 text-xs font-bold">Override Reason / Notice Text</label>
                    <textarea
                      placeholder="Specify reason for override (displayed to students if applications are disabled)..."
                      value={settings?.overrideReason || ''}
                      onChange={(e) => handleSettingsChange('overrideReason', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#78be21] h-20 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submittingSettings}
                  className="px-6 py-2.5 bg-[#78be21] hover:bg-[#68a61d] disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all flex items-center gap-2"
                >
                  <Save size={16} />
                  {submittingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Calendar Management */}
        <div className="space-y-6">
          
          {/* Create Restriction Event */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Calendar className="text-[#78be21]" size={20} />
              Add Restrictions
            </h3>

            <form onSubmit={handleAddCalendarEvent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-700 text-xs font-bold">Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. Mid-Term II Examinations"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#78be21]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 text-xs font-bold">Event Type</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#78be21]"
                >
                  <option value="exam_mid">Mid Examinations</option>
                  <option value="exam_internal">Internal Exams</option>
                  <option value="exam_semester">Semester Exams</option>
                  <option value="restriction">Institutional Restriction</option>
                  <option value="other">Other Event</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 text-xs font-bold">Start Date</label>
                <input
                  type="date"
                  value={newEvent.startDate}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#78be21]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 text-xs font-bold">End Date</label>
                <input
                  type="date"
                  value={newEvent.endDate}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#78be21]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingCalendar}
                className="w-full py-2.5 bg-[#78be21] hover:bg-[#68a61d] disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Plus size={16} />
                {submittingCalendar ? 'Adding...' : 'Add Event & Restrict'}
              </button>
            </form>
          </div>

          {/* List of Restrictions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center justify-between">
              <span>Active Restriction Periods</span>
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                {calendarEvents.length}
              </span>
            </h3>

            {calendarEvents.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                No active exam periods or calendar restrictions.
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {calendarEvents.map((event) => (
                  <div 
                    key={event._id}
                    className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex justify-between items-start gap-2 text-xs"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <h4 className="font-bold text-slate-800 truncate" title={event.title}>{event.title}</h4>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100">
                          {getCalendarTypeLabel(event.type)}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[10px]">
                        {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteCalendarEvent(event._id)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-md transition-colors shrink-0 mt-0.5"
                      title="Remove restriction"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
