import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Upload, Calendar, Search, Filter, 
  Download, MessageSquare, CheckCircle, Clock, 
  ArrowLeft, User, Hash, GraduationCap, X, ChevronDown, CheckCircle2, Save, AlertTriangle
} from 'lucide-react';

export default function MonthlyReports() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role;

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  
  // Student Form State
  const [month, setMonth] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  
  // Lists State
  const [reports, setReports] = useState<any[]>([]);
  
  // Filter & Search State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  // Review Modal State
  const [reviewingReport, setReviewingReport] = useState<any>(null);
  const [remarks, setRemarks] = useState('');
  const [reviewStatus, setReviewStatus] = useState('Reviewed');

  const monthsList = [
    'June 2026', 'July 2026', 'August 2026', 
    'September 2026', 'October 2026', 'November 2026', 'December 2026'
  ];

  useEffect(() => {
    if (role === 'student') {
      fetchStudentProfile();
      fetchStudentReports();
    } else {
      fetchAllReports();
    }
  }, [role]);

  const fetchStudentProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudentProfile(response.data);
    } catch (err) {
      console.error('Error fetching student profile:', err);
    }
  };

  const fetchStudentReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/reports/my-reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(response.data);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchAllReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/reports/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(response.data);
    } catch (err) {
      console.error('Error fetching all reports:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReportFile(e.target.files[0]);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!month) {
      alert('Please select a month.');
      return;
    }
    if (!reportFile) {
      alert('Please upload a report file.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('reportFile', reportFile);
      
      const formattedDate = new Date(month).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      formData.append('month', formattedDate);
      
      const details = {
        name: studentProfile?.name || user.name || 'Student',
        rollNumber: studentProfile?.rollNumber || 'N/A',
        branch: studentProfile?.branch || 'N/A',
      };
      formData.append('studentDetails', JSON.stringify(details));

      await axios.post('/api/reports/submit', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });

      alert('Monthly report submitted successfully!');
      setMonth('');
      setReportFile(null);
      fetchStudentReports();
    } catch (err: any) {
      console.error('Submit report error:', err);
      alert(err.response?.data?.message || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingReport) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/reports/review/${reviewingReport._id}`, {
        status: reviewStatus,
        remarks: remarks
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert('Report review updated successfully!');
      setReviewingReport(null);
      setRemarks('');
      fetchAllReports();
    } catch (err: any) {
      console.error('Review report error:', err);
      alert('Failed to update report review.');
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (report: any) => {
    setReviewingReport(report);
    if (role === 'cdc') {
      setReviewStatus('Pending Principal Approval');
      setRemarks(report.cdcRemarks || '');
    } else {
      setReviewStatus(report.status === 'Approved' || report.status === 'Rejected' ? report.status : 'Approved');
      setRemarks(report.principalRemarks || '');
    }
  };

  // Filter logic
  const filteredReports = reports.filter(r => {
    const studentName = r.studentDetails?.name || '';
    const rollNo = r.studentDetails?.rollNumber || '';
    const matchSearch = studentName.toLowerCase().includes(search.toLowerCase()) || 
                        rollNo.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchMonth = monthFilter === 'all' || (() => {
      const parts = monthFilter.split(' ');
      if (parts.length === 2) {
        return r.month.toLowerCase().includes(parts[0].toLowerCase()) && r.month.includes(parts[1]);
      }
      return r.month === monthFilter;
    })();

    return matchSearch && matchStatus && matchMonth;
  });

  const getStatusBadge = (status: string, size = 10) => {
    switch (status) {
      case 'Approved':
        return {
          classes: 'bg-emerald-50 text-emerald-600 border-emerald-100',
          icon: <CheckCircle size={size} />
        };
      case 'Rejected':
        return {
          classes: 'bg-red-50 text-red-600 border-red-100',
          icon: <X size={size} />
        };
      case 'Pending Principal Approval':
        return {
          classes: 'bg-indigo-50 text-indigo-600 border-indigo-100',
          icon: <Clock size={size} className="animate-pulse" />
        };
      default: // 'Pending CDC Review'
        return {
          classes: 'bg-amber-50 text-amber-700 border-amber-100',
          icon: <Clock size={size} />
        };
    }
  };

  if (dataLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading Monthly Reports...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-7xl mx-auto pb-12 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(`/${role}`)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors font-semibold text-xs mb-2 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Monthly Work Reports</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {role === 'student' 
              ? 'Upload your monthly work report as progress proof for the CDC department and Principal.'
              : 'Review and monitor students\' uploaded monthly work reports.'
            }
          </p>
        </div>
      </div>

      {role === 'student' ? (
        <div className="space-y-6">
          {studentProfile && !studentProfile.profileRegistered && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-amber-900 text-sm">Profile Registration Required</h4>
                  <p className="text-amber-700 text-xs mt-0.5">
                    Before submitting monthly reports, you should register your academic details. Unregistered profiles will submit reports under temporary details.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/student/register')}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors shrink-0 shadow-sm shadow-amber-600/10 cursor-pointer"
              >
                Register Profile
              </button>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Submission Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit space-y-5 lg:col-span-1">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                <div className="p-2 bg-[#78be21]/15 text-[#78be21] rounded-xl shrink-0">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Submit New Report</h3>
                  <p className="text-slate-500 text-[10px] mt-0.5">Upload monthly progress report</p>
                </div>
              </div>

              <form onSubmit={handleSubmitReport} className="space-y-4">
                {/* Select Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Report Submission Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <input
                      type="date"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm cursor-pointer"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                    />
                  </div>
                </div>

              {/* File Upload Box */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Upload Report File (PDF/DOCX/Images)</label>
                <div className="relative group">
                  <input
                    type="file"
                    required
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 transition-all ${
                    reportFile 
                      ? 'border-[#78be21] bg-[#78be21]/5' 
                      : 'border-slate-200 bg-slate-50/50 group-hover:border-[#78be21] group-hover:bg-[#78be21]/5'
                  }`}>
                    <FileText className={reportFile ? 'text-[#78be21]' : 'text-slate-400 group-hover:text-[#78be21]'} size={24} />
                    <span className="text-xs font-bold text-slate-600 text-center truncate w-full px-2">
                      {reportFile ? reportFile.name : 'Click to select report file'}
                    </span>
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">PDF, DOCX, JPG, PNG</p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#78be21] hover:bg-[#68a61d] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
              >
                <Save size={16} />
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>

          {/* Submission History */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <div className="p-2 bg-[#78be21]/15 text-[#78be21] rounded-xl shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Submission History</h3>
                <p className="text-slate-500 text-[10px] mt-0.5">Track your submitted work reports</p>
              </div>
            </div>

            {reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                <FileText size={40} className="text-slate-200 mb-3" />
                <p className="font-bold text-slate-700 text-sm">No reports submitted yet</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">Submit your first report using the form on the left to start tracking.</p>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-[450px] pr-1">
                {reports.map((report) => (
                  <div key={report._id} className="border border-slate-200/80 rounded-xl p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-slate-50/20 hover:bg-slate-50/50 transition-all">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-500" />
                          {report.month}
                        </span>
                        {(() => {
                          const badge = getStatusBadge(report.status, 10);
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${badge.classes}`}>
                              {badge.icon}
                              {report.status}
                            </span>
                          );
                        })()}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <span className="truncate max-w-[180px]">{report.fileName}</span>
                        <a 
                          href={`/${report.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 bg-white border border-slate-200 rounded-md text-slate-500 hover:text-[#78be21] hover:border-[#78be21]/30 transition-all"
                          title="Download report file"
                        >
                          <Download size={12} />
                        </a>
                      </div>

                      {(report.cdcRemarks || report.principalRemarks) && (
                        <div className="text-[11px] text-slate-500 italic bg-white border border-slate-100 rounded-lg p-2.5 space-y-1.5 min-w-[240px]">
                          {report.cdcRemarks && (
                            <div className="flex items-start gap-1">
                              <MessageSquare size={12} className="text-slate-400 shrink-0 mt-0.5" />
                              <p><span className="font-bold not-italic text-slate-600">CDC Feedback:</span> "{report.cdcRemarks}"</p>
                            </div>
                          )}
                          {report.principalRemarks && (
                            <div className="flex items-start gap-1">
                              <MessageSquare size={12} className="text-slate-400 shrink-0 mt-0.5" />
                              <p><span className="font-bold not-italic text-slate-600">Principal Feedback:</span> "{report.principalRemarks}"</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right border-t md:border-t-0 pt-2.5 md:pt-0 shrink-0">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Submitted On</p>
                      <p className="text-slate-700 text-xs font-medium">{new Date(report.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        /* CDC / Principal Review Dashboard */
        <div className="space-y-5">
          {/* Filtering Header Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by name or roll number..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-medium outline-none focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#78be21]/20 cursor-pointer appearance-none text-slate-700"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending CDC Review">Pending CDC Review</option>
                  <option value="Pending Principal Approval">Pending Principal Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={12} />
                </div>
              </div>

              <div className="relative flex-1 md:flex-none">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#78be21]/20 cursor-pointer appearance-none text-slate-700"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                >
                  <option value="all">All Months</option>
                  {monthsList.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={12} />
                </div>
              </div>
            </div>
          </div>

          {/* Reports Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Month</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Report File</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remarks / Feedback</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <FileText size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="font-bold text-slate-700 text-sm">No monthly reports found</p>
                        <p className="text-xs text-slate-500 mt-0.5">No reports match your current filter criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((report) => (
                      <tr key={report._id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg shrink-0 mt-0.5">
                              <User size={14} />
                            </div>
                            <div>
                              <p className="text-slate-900 font-bold text-sm leading-snug">{report.studentDetails?.name}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mt-0.5">
                                <span className="flex items-center gap-0.5"><Hash size={10} />{report.studentDetails?.rollNumber}</span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5"><GraduationCap size={10} />{report.studentDetails?.branch}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md text-[10px] font-bold">
                            {report.month}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 max-w-[160px]">
                            <span className="text-xs font-semibold text-slate-600 truncate" title={report.fileName}>
                              {report.fileName}
                            </span>
                            <a 
                              href={`/${report.filePath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-[#78be21] hover:border-[#78be21]/30 transition-all shrink-0"
                              title="Download report"
                            >
                              <Download size={12} />
                            </a>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const badge = getStatusBadge(report.status, 11);
                            return (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${badge.classes}`}>
                                {badge.icon}
                                {report.status}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="space-y-1">
                            {report.cdcRemarks && (
                              <p className="text-xs font-medium text-slate-600 truncate" title={report.cdcRemarks}>
                                <span className="font-bold text-slate-500 mr-1">CDC:</span> "{report.cdcRemarks}"
                              </p>
                            )}
                            {report.principalRemarks && (
                              <p className="text-xs font-medium text-slate-600 truncate" title={report.principalRemarks}>
                                <span className="font-bold text-slate-500 mr-1">Principal:</span> "{report.principalRemarks}"
                              </p>
                            )}
                            {!report.cdcRemarks && !report.principalRemarks && (
                              <span className="text-slate-400 text-xs italic">No feedback provided yet</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => openReviewModal(report)}
                            className="px-3.5 py-1.5 bg-[#78be21] hover:bg-[#68a61d] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal Backdrop */}
      <AnimatePresence>
        {reviewingReport && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Review Monthly Report</h3>
                  <p className="text-slate-500 text-[10px] mt-0.5">{reviewingReport.studentDetails?.name} • {reviewingReport.month}</p>
                </div>
                <button 
                  onClick={() => setReviewingReport(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleReviewSubmit} className="p-6 space-y-4">
                {/* Read-only CDC Remarks for Principal */}
                {role === 'principal' && reviewingReport.cdcRemarks && (
                  <div className="p-3 bg-[#78be21]/10 border border-[#78be21]/20 rounded-xl text-slate-700 text-xs">
                    <span className="font-bold text-[#68a61d] block mb-1">CDC Recommendation / Remarks:</span>
                    <p className="italic font-medium">"{reviewingReport.cdcRemarks}"</p>
                  </div>
                )}

                {/* Select Review Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Review Action</label>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    {role === 'cdc' ? (
                      <div className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#68a61d] flex items-center">
                        Verify & Forward to Principal
                      </div>
                    ) : (
                      <>
                        <select
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#78be21]/20 cursor-pointer appearance-none text-slate-800"
                          value={reviewStatus}
                          onChange={(e) => setReviewStatus(e.target.value)}
                        >
                          <option value="Approved">Approve Report</option>
                          <option value="Rejected">Reject Report</option>
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={14} />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Remarks textarea */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                    {role === 'cdc' ? 'CDC Remarks & Recommendations' : 'Feedback / Remarks'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={role === 'cdc' ? 'e.g. Verified student submission. Strongly recommend approval.' : 'e.g. Satisfactory work progress reported. Keep it up!'}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-xs font-medium"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                {/* Actions */}
                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewingReport(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-[#78be21] hover:bg-[#68a61d] text-white text-xs font-bold rounded-xl shadow-md shadow-[#78be21]/10 transition-all cursor-pointer"
                  >
                    {loading ? 'Saving...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
