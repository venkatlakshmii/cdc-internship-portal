import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Upload, Calendar, Search, Filter, 
  Download, MessageSquare, CheckCircle, Clock, 
  ArrowLeft, User, Hash, GraduationCap, X, ChevronDown, CheckCircle2, Save, AlertTriangle, ShieldCheck
} from 'lucide-react';

export default function InternshipCompletion() {
  const navigate = useNavigate();
  let user: any = {};
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser && storedUser !== 'undefined') {
      user = JSON.parse(storedUser);
    }
  } catch (e) {
    console.error('Failed to parse user in InternshipCompletion', e);
  }
  const role = user.role;

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  
  // Student Form State
  const [completionDate, setCompletionDate] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [studentRemarks, setStudentRemarks] = useState('');
  
  // Lists State
  const [completions, setCompletions] = useState<any[]>([]);
  
  // Filter & Search State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Review Modal State
  const [reviewingCompletion, setReviewingCompletion] = useState<any>(null);
  const [remarks, setRemarks] = useState('');
  const [reviewStatus, setReviewStatus] = useState('Approved');

  useEffect(() => {
    if (role === 'student') {
      fetchStudentProfile();
      fetchStudentCompletions();
    } else {
      fetchAllCompletions();
    }
  }, [role, branchFilter, yearFilter, statusFilter, typeFilter, startDate, endDate]);

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

  const fetchStudentCompletions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/completions/my-completions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCompletions(response.data);
    } catch (err) {
      console.error('Error fetching completions:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchAllCompletions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/reports/completions', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          module: 'completions',
          branch: branchFilter,
          semester: yearFilter,
          status: statusFilter,
          type: typeFilter,
          startDate: startDate,
          endDate: endDate
        }
      });
      setCompletions(response.data);
    } catch (err) {
      console.error('Error fetching all completions:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const endpoint = format === 'pdf' ? '/api/reports/export-pdf' : '/api/reports/export-excel';
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          module: 'completions',
          branch: branchFilter,
          semester: yearFilter,
          status: statusFilter,
          type: typeFilter,
          startDate: startDate,
          endDate: endDate
        },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hitam-completions-${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export report.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setBranchFilter('all');
    setYearFilter('all');
    setStartDate('');
    setEndDate('');
    setTypeFilter('all');
  };

  const handleReportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReportFile(e.target.files[0]);
    }
  };

  const handleCertificateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCertificateFile(e.target.files[0]);
    }
  };

  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completionDate) {
      alert('Please select the internship completion date.');
      return;
    }
    if (!reportFile) {
      alert('Please upload your completion report.');
      return;
    }
    if (!certificateFile) {
      alert('Please upload your completion certificate.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('completionReport', reportFile);
      formData.append('completionCertificate', certificateFile);
      formData.append('completionDate', completionDate);
      formData.append('studentRemarks', studentRemarks);
      
      const details = {
        name: studentProfile?.name || user.name || 'Student',
        rollNumber: studentProfile?.rollNumber || 'N/A',
        year: studentProfile?.year || 'N/A',
        branch: studentProfile?.branch || 'N/A',
      };
      formData.append('studentDetails', JSON.stringify(details));

      await axios.post('/api/completions/submit', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });

      alert('Internship completion report submitted successfully!');
      setCompletionDate('');
      setReportFile(null);
      setCertificateFile(null);
      setStudentRemarks('');
      fetchStudentCompletions();
    } catch (err: any) {
      console.error('Submit completion error:', err);
      alert(err.response?.data?.message || 'Failed to submit completion details.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingCompletion) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/completions/review/${reviewingCompletion._id}`, {
        status: reviewStatus,
        remarks: remarks
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert('Completion review updated successfully!');
      setReviewingCompletion(null);
      setRemarks('');
      fetchAllCompletions();
    } catch (err: any) {
      console.error('Review completion error:', err);
      alert('Failed to update completion review.');
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (record: any) => {
    setReviewingCompletion(record);
    if (role === 'cdc') {
      setReviewStatus('Pending Principal Approval');
      setRemarks(record.cdcRemarks || '');
    } else {
      setReviewStatus(record.status === 'Approved' || record.status === 'Rejected' ? record.status : 'Approved');
      setRemarks(record.principalRemarks || '');
    }
  };

  // Filter & Search Logic
  const filteredCompletions = completions.filter(c => {
    const studentName = c.studentDetails?.name || '';
    const rollNo = c.studentDetails?.rollNumber || '';
    const q = search.toLowerCase().trim();
    const rollMatch = q.match(/^([0-9]{2}e51a[0-9a-z]{4})@hitam\.org$/);
    const cleanSearch = rollMatch ? rollMatch[1] : q;
    const matchSearch = studentName.toLowerCase().includes(cleanSearch) || 
                        rollNo.toLowerCase().includes(cleanSearch);
    
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchBranch = branchFilter === 'all' || c.studentDetails?.branch === branchFilter;
    const matchYear = yearFilter === 'all' || (c.studentDetails?.year && (c.studentDetails.year.includes(yearFilter + ' Year') || c.studentDetails.year === yearFilter));

    return matchSearch && matchStatus && matchBranch && matchYear;
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
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading Internship Completion details...</div>;
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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Internship Completion</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {role === 'student' 
              ? 'Provide completion details, upload completion documents, and submit for verification.'
              : 'Review and verify students\' uploaded internship completion reports and certificates.'
            }
          </p>
        </div>
      </div>

      {role === 'student' ? (
        <div className="space-y-6">
          {/* Profile Warning banner if unregistered */}
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
                    Before submitting completion details, you must register your student profile.
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
            {/* Left side: Student Info and Submission Form */}
            <div className="space-y-6 lg:col-span-2">
              
              {/* Clean Student Profile Display Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="p-2 bg-[#78be21]/15 text-[#78be21] rounded-xl shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Student Academic Profile</h3>
                    <p className="text-slate-500 text-[10px] mt-0.5">Auto-fetched profile details for verification</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                  <div className="flex gap-2.5 items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <User size={14} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5">Student Name</p>
                      <p className="text-slate-800 font-bold text-[13px]">{studentProfile?.name || user.name || 'Not Registered'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <Hash size={14} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5">Roll Number</p>
                      <p className="text-slate-800 font-bold text-[13px]">{studentProfile?.rollNumber || 'Not Registered'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5">Year & Semester</p>
                      <p className="text-slate-800 font-bold text-[13px]">{studentProfile?.year || 'Not Registered'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <GraduationCap size={14} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5">Branch</p>
                      <p className="text-slate-800 font-bold text-[13px]">{studentProfile?.branch || 'Not Registered'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                  <div className="p-2 bg-[#78be21]/15 text-[#78be21] rounded-xl shrink-0">
                    <Save size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Submit Completion Details</h3>
                    <p className="text-slate-500 text-[10px] mt-0.5">Provide completion info and files</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitCompletion} className="space-y-4">
                  {/* Completion Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Internship Completion Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                      <input
                        type="date"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm cursor-pointer"
                        value={completionDate}
                        onChange={(e) => setCompletionDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Two Upload boxes in grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Completion Report Upload */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Completion Report (PDF)</label>
                      <div className="relative group">
                        <input
                          type="file"
                          required
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleReportFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 transition-all ${
                          reportFile 
                            ? 'border-[#78be21] bg-[#78be21]/5' 
                            : 'border-slate-200 bg-slate-50/50 group-hover:border-[#78be21] group-hover:bg-[#78be21]/5'
                        }`}>
                          <Upload className={reportFile ? 'text-[#78be21]' : 'text-slate-400 group-hover:text-[#78be21]'} size={20} />
                          <span className="text-[11px] font-bold text-slate-600 text-center truncate w-full px-1">
                            {reportFile ? reportFile.name : 'Select Completion Report'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Completion Certificate Upload */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Completion Certificate (PDF)</label>
                      <div className="relative group">
                        <input
                          type="file"
                          required
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleCertificateFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 transition-all ${
                          certificateFile 
                            ? 'border-[#78be21] bg-[#78be21]/5' 
                            : 'border-slate-200 bg-slate-50/50 group-hover:border-[#78be21] group-hover:bg-[#78be21]/5'
                        }`}>
                          <Upload className={certificateFile ? 'text-[#78be21]' : 'text-slate-400 group-hover:text-[#78be21]'} size={20} />
                          <span className="text-[11px] font-bold text-slate-600 text-center truncate w-full px-1">
                            {certificateFile ? certificateFile.name : 'Select Certificate'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Remarks/Feedback */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Final Remarks / Feedback</label>
                    <div className="relative">
                      <textarea
                        rows={3}
                        placeholder="Provide details of what you learned, challenges faced, or feedback about the company..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm font-medium"
                        value={studentRemarks}
                        onChange={(e) => setStudentRemarks(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || (studentProfile && !studentProfile.profileRegistered)}
                    className="w-full py-2.5 bg-[#78be21] hover:bg-[#68a61d] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
                  >
                    <Save size={16} />
                    {loading ? 'Submitting...' : 'Submit Completion details'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right side: Student Submission History */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-1 space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                <div className="p-2 bg-[#78be21]/15 text-[#78be21] rounded-xl shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Submission History</h3>
                  <p className="text-slate-500 text-[10px] mt-0.5">Track your completion approvals</p>
                </div>
              </div>

              {completions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                  <FileText size={32} className="text-slate-200 mb-2" />
                  <p className="font-bold text-slate-700 text-xs">No completion records found</p>
                  <p className="text-[10px] text-slate-500 max-w-xs mt-1">Submit your details to start tracking approval status.</p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
                  {completions.map((comp) => (
                    <div key={comp._id} className="border border-slate-200/80 rounded-xl p-4 space-y-3 bg-slate-50/20 hover:bg-slate-50/50 transition-all text-xs">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-lg font-bold flex items-center gap-1">
                          <Calendar size={11} className="text-slate-500" />
                          {new Date(comp.completionDate).toLocaleDateString()}
                        </span>
                        {(() => {
                          const badge = getStatusBadge(comp.status, 9);
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 ${badge.classes}`}>
                              {badge.icon}
                              {comp.status}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Download links */}
                      <div className="space-y-1 bg-white border border-slate-100 rounded-lg p-2.5">
                        <div className="flex items-center justify-between font-semibold text-slate-600 gap-2">
                          <span className="truncate max-w-[120px]" title={comp.reportFileName}>Report: {comp.reportFileName}</span>
                          <a 
                            href={`/${comp.reportFilePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 bg-slate-50 border border-slate-200 rounded text-slate-500 hover:text-[#78be21] hover:border-[#78be21]/30 transition-all shrink-0"
                          >
                            <Download size={10} />
                          </a>
                        </div>
                        <div className="flex items-center justify-between font-semibold text-slate-600 gap-2 pt-1 border-t border-slate-100">
                          <span className="truncate max-w-[120px]" title={comp.certificateFileName}>Certificate: {comp.certificateFileName}</span>
                          <a 
                            href={`/${comp.certificateFilePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 bg-slate-50 border border-slate-200 rounded text-slate-500 hover:text-[#78be21] hover:border-[#78be21]/30 transition-all shrink-0"
                          >
                            <Download size={10} />
                          </a>
                        </div>
                      </div>

                      {/* Feedback remarks display */}
                      {(comp.cdcRemarks || comp.principalRemarks) && (
                        <div className="text-[10px] text-slate-500 italic bg-white border border-slate-100 rounded-lg p-2.5 space-y-1.5">
                          {comp.cdcRemarks && (
                            <div className="flex items-start gap-1">
                              <MessageSquare size={11} className="text-slate-400 shrink-0 mt-0.5" />
                              <p><span className="font-bold not-italic text-slate-600">CDC Feedback:</span> "{comp.cdcRemarks}"</p>
                            </div>
                          )}
                          {comp.principalRemarks && (
                            <div className="flex items-start gap-1">
                              <MessageSquare size={11} className="text-slate-400 shrink-0 mt-0.5" />
                              <p><span className="font-bold not-italic text-slate-600">Principal Feedback:</span> "{comp.principalRemarks}"</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1 border-t border-slate-100/50">
                        <span>SUBMITTED ON</span>
                        <span className="font-bold">{new Date(comp.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* CDC / Principal Review view */
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by student name or roll..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-medium outline-none focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {/* Status Filter */}
                <div className="relative flex-1 sm:flex-none">
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

                {/* Branch Filter */}
                <div className="relative flex-1 sm:flex-none">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#78be21]/20 cursor-pointer appearance-none text-slate-700"
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                  >
                    <option value="all">All Branches</option>
                    <option value="CSE">CSE</option>
                    <option value="CSM">CSM</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="ME">ME</option>
                    <option value="CE">CE</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={12} />
                  </div>
                </div>

                {/* Year Filter */}
                <div className="relative flex-1 sm:flex-none">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#78be21]/20 cursor-pointer appearance-none text-slate-700"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                  >
                    <option value="all">All Years</option>
                    <option value="2nd">2nd Year</option>
                    <option value="3rd">3rd Year</option>
                    <option value="4th">4th Year</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={12} />
                  </div>
                </div>

                {/* Internship Mode Filter */}
                <div className="relative flex-1 sm:flex-none">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#78be21]/20 cursor-pointer appearance-none text-slate-700"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">All Modes</option>
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                    <option value="In-House">In-House</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={12} />
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-toolbar: Date Inputs & Print/Export Buttons */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-xs font-bold text-slate-600">
                <div className="flex items-center gap-2">
                  <span>From:</span>
                  <input
                    type="date"
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#78be21]/20 text-slate-700"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>To:</span>
                  <input
                    type="date"
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#78be21]/20 text-slate-700"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={loading}
                  className="px-4 py-2 bg-[#78be21] hover:bg-[#68a61d] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-[#78be21]/15 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText size={14} />
                  Print (PDF)
                </button>
                <button
                  onClick={() => handleExport('excel')}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/15 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  Export Excel
                </button>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <X size={14} />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Table list */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completion Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Documents</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remarks / Feedback</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompletions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <FileText size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="font-bold text-slate-700 text-sm">No completions found</p>
                        <p className="text-xs text-slate-500 mt-0.5">No completion reports match your filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCompletions.map((comp) => (
                      <tr key={comp._id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg shrink-0 mt-0.5">
                              <User size={14} />
                            </div>
                            <div>
                              <p className="text-slate-900 font-bold text-sm leading-snug">{comp.studentDetails?.name}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mt-0.5">
                                <span className="flex items-center gap-0.5"><Hash size={10} />{comp.studentDetails?.rollNumber}</span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5"><Calendar size={10} />{comp.studentDetails?.year}</span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5"><GraduationCap size={10} />{comp.studentDetails?.branch}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md text-[10px] font-bold">
                            {new Date(comp.completionDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1.5 max-w-[170px] text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-500 truncate" title={comp.reportFileName}>Report</span>
                              <a 
                                href={`/${comp.reportFilePath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 bg-slate-50 border border-slate-200 rounded text-slate-500 hover:text-[#78be21]"
                              >
                                <Download size={10} />
                              </a>
                            </div>
                            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1">
                              <span className="font-semibold text-slate-500 truncate" title={comp.certificateFileName}>Certificate</span>
                              <a 
                                href={`/${comp.certificateFilePath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 bg-slate-50 border border-slate-200 rounded text-slate-500 hover:text-[#78be21]"
                              >
                                <Download size={10} />
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const badge = getStatusBadge(comp.status, 11);
                            return (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${badge.classes}`}>
                                {badge.icon}
                                {comp.status}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="space-y-1">
                            {comp.studentRemarks && (
                              <p className="text-xs font-semibold text-slate-500 truncate" title={comp.studentRemarks}>
                                <span className="font-bold text-slate-400">Student:</span> "{comp.studentRemarks}"
                              </p>
                            )}
                            {comp.cdcRemarks && (
                              <p className="text-xs font-medium text-slate-600 truncate" title={comp.cdcRemarks}>
                                <span className="font-bold text-slate-500">CDC:</span> "{comp.cdcRemarks}"
                              </p>
                            )}
                            {comp.principalRemarks && (
                              <p className="text-xs font-medium text-slate-600 truncate" title={comp.principalRemarks}>
                                <span className="font-bold text-slate-500">Principal:</span> "{comp.principalRemarks}"
                              </p>
                            )}
                            {!comp.cdcRemarks && !comp.principalRemarks && !comp.studentRemarks && (
                              <span className="text-slate-400 text-xs italic">No comments</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => openReviewModal(comp)}
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

      {/* Review Modal */}
      <AnimatePresence>
        {reviewingCompletion && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            >
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Review Completion Submission</h3>
                  <p className="text-slate-500 text-[10px] mt-0.5">{reviewingCompletion.studentDetails?.name} • {new Date(reviewingCompletion.completionDate).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => setReviewingCompletion(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleReviewSubmit} className="p-6 space-y-4">
                {reviewingCompletion.studentRemarks && (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700">
                    <span className="font-bold text-slate-500 block mb-1">Student Comments:</span>
                    <p className="italic">"{reviewingCompletion.studentRemarks}"</p>
                  </div>
                )}

                {role === 'principal' && reviewingCompletion.cdcRemarks && (
                  <div className="p-3 bg-[#78be21]/10 border border-[#78be21]/20 rounded-xl text-slate-700 text-xs">
                    <span className="font-bold text-[#68a61d] block mb-1">CDC Recommendation:</span>
                    <p className="italic font-medium">"{reviewingCompletion.cdcRemarks}"</p>
                  </div>
                )}

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
                          <option value="Approved">Approve Completion</option>
                          <option value="Rejected">Reject Completion</option>
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={14} />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                    {role === 'cdc' ? 'CDC Remarks & Recommendations' : 'Feedback / Remarks'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={role === 'cdc' ? 'e.g. Verified completion files. All documents are correct. Forwarded.' : 'e.g. Approved. Well done on completing your internship!'}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-xs font-medium"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewingCompletion(null)}
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
