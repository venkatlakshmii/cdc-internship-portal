import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import {
  CheckCircle, XCircle, Eye, ExternalLink, ShieldCheck, AlertCircle, AlertTriangle,
  Search, Filter, FileText, Download, X, Calendar, GraduationCap, ChevronDown
} from 'lucide-react';
import { convertDecimalMonthsToMonthsDays } from '../utils/duration';

export default function PrincipalDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [finalStatus, setFinalStatus] = useState('Approved');
  const [remarks, setRemarks] = useState('');

  // Filter & Search State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem('token');
      const endpoint = format === 'pdf' ? '/api/reports/export-pdf' : '/api/reports/export-excel';

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          module: 'approved',
          branch: branchFilter,
          semester: yearFilter,
          status: statusFilter,
          type: typeFilter,
          startDate: startDate,
          endDate: endDate,
          search: search
        },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hitam-approved-internships-${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export approved internships.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setBranchFilter('all');
    setYearFilter('all');
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
  };

  useEffect(() => {
    fetchApplications();
  }, [debouncedSearch, statusFilter, branchFilter, yearFilter, typeFilter, startDate, endDate]);

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/internships/forwarded', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          search: debouncedSearch,
          status: statusFilter,
          branch: branchFilter,
          year: yearFilter,
          type: typeFilter,
          startDate,
          endDate
        }
      });
      setApplications(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching applications:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/internships/principal-decision/${id}`, { finalStatus, remarks }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedApp(null);
      fetchApplications();
    } catch (err) {
      console.error('Error updating decision:', err);
      alert('Failed to update decision');
    }
  };

  const filteredApps = applications.filter(app => {
    const studentName = app.studentDetails?.name || '';
    const rollNo = app.studentDetails?.rollNumber || '';
    const q = search.toLowerCase().trim();
    const rollMatch = q.match(/^([a-z0-9]{10})@hitam\.org$/);
    const cleanSearch = rollMatch ? rollMatch[1] : q;
    const matchSearch = studentName.toLowerCase().includes(cleanSearch) ||
      rollNo.toLowerCase().includes(cleanSearch);

    const matchStatus = statusFilter === 'all' || (() => {
      const eligibility = (app.eligibilityStatus || '').toLowerCase();
      const finalSt = (app.finalStatus || '').toLowerCase();
      const cdcRec = (app.cdcRecommendation || '').toLowerCase();
      if (statusFilter === 'pending') 
        return eligibility.includes('pending') || finalSt.includes('pending') || cdcRec === 'pending';
      if (statusFilter === 'approved') 
        return finalSt === 'approved' || [
          'approved', '3 months approved', 'conditionally approved', '3 months + 3 months extension', 'recommended'
        ].some(st => eligibility === st);
      if (statusFilter === 'not eligible') return eligibility.includes('not eligible');
      if (statusFilter === 'Rejected') 
        return finalSt === 'rejected' || eligibility.includes('not recommended') || eligibility.includes('rejected');
      return eligibility.includes(statusFilter.toLowerCase()) || finalSt.includes(statusFilter.toLowerCase());
    })();

    const matchBranch = branchFilter === 'all' || app.studentDetails?.branch === branchFilter;
    const matchYear = yearFilter === 'all' || (app.studentDetails?.year && (app.studentDetails.year.includes(yearFilter + ' Year') || app.studentDetails.year === yearFilter));
    const matchType = typeFilter === 'all' || app.internshipDetails?.mode === typeFilter;

    // Date filter on submission date (createdAt), not internship start date
    const matchDate = (() => {
      if (!startDate && !endDate) return true;
      const submittedAt = app.createdAt || app.submittedAt;
      if (!submittedAt) return false;
      
      const dateObj = new Date(submittedAt);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const appDateStr = `${year}-${month}-${day}`;
      
      if (startDate && appDateStr < startDate) return false;
      if (endDate && appDateStr > endDate) return false;
      return true;
    })();

    return matchSearch && matchStatus && matchBranch && matchYear && matchType && matchDate;
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading applications...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Principal Dashboard</h2>
          <p className="text-slate-500 text-xs mt-0.5">Review student applications, provide final approvals, and generate internship records reports.</p>
        </div>
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20 shrink-0">
          <ShieldCheck size={20} />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200/80 rounded-2xl flex items-start gap-3 text-red-800 text-xs font-semibold shadow-sm">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900">Error Loading Applications</p>
            <p className="mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

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
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="not eligible">Not Eligible</option>
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
            <span className="text-slate-400 text-[10px] uppercase tracking-widest">Submission Date:</span>
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
              disabled={isExporting}
              className="px-4 py-2 bg-[#78be21] hover:bg-[#68a61d] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-[#78be21]/15 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileText size={14} />
              Print (PDF)
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={isExporting}
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

      <div className="grid gap-6">
        {filteredApps.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-slate-900 font-bold text-lg">No applications available</h3>
            <p className="text-slate-500 text-sm mt-1">All forwarded applications have been processed or match your active filters.</p>
          </div>
        ) : (
          filteredApps.map((app) => (
            <motion.div
              key={app._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{app.studentDetails.name}</h3>
                  {(() => {
                    if (app.cdcRecommendation === 'Recommended') {
                      return (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-100 uppercase tracking-wider">
                          CDC: Recommended
                        </span>
                      );
                    }
                    if (app.cdcRecommendation === 'Not Recommended') {
                      return (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-red-50 text-red-600 border-red-100 uppercase tracking-wider">
                          CDC: Not Recommended
                        </span>
                      );
                    }
                    if (app.cdcRecommendation === 'Need Clarification') {
                      return (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-600 border-amber-100 uppercase tracking-wider">
                          CDC: Need Clarification
                        </span>
                      );
                    }
                    return (
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-100 uppercase tracking-wider">
                        CDC: Pending Review
                      </span>
                    );
                  })()}
                  {app.hodStatus && app.hodStatus !== 'Pending' && (() => {
                    const colorClass =
                      app.hodStatus === 'Recommended' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      app.hodStatus === 'Not Recommended' ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-amber-50 text-amber-600 border-amber-100';
                    return (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${colorClass}`}>
                        HOD: {app.hodStatus}
                      </span>
                    );
                  })()}
                  {(() => {
                    const status = app.principalDecision || 'Pending';
                    const colorClass =
                      status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                          'bg-blue-50 text-blue-600 border-blue-100';
                    return (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${colorClass}`}>
                        Principal Decision: {status}
                      </span>
                    );
                  })()}
                  {app.hasAcademicConflict && (
                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase" title={app.conflictDetails || 'Academic Conflict'}>
                      <AlertTriangle size={12} className="text-amber-500" />
                      Conflict Detected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-2 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Company</p>
                    <p className="text-slate-700 font-medium">{app.internshipDetails.companyName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Duration</p>
                    <p className="text-slate-700 font-medium">{app.internshipDetails.durationDisplay || convertDecimalMonthsToMonthsDays(app.internshipDetails.totalDuration)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Permissible</p>
                    <p className="text-slate-700 font-bold">{convertDecimalMonthsToMonthsDays(app.permissibleDuration)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Attendance</p>
                    <p className="text-emerald-500 font-bold">
                      {Number(app.studentDetails.attendancePercentage).toFixed(2)}%
                      {app.verifiedAttendancePercentage !== undefined && (
                        <span className="text-[10px] text-slate-400 font-medium block">
                          Verified: {Number(app.verifiedAttendancePercentage).toFixed(2)}%
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Bands (SPF | CDC)</p>
                    <p className="text-slate-700 font-bold">{app.spfBand || 'N/A'} | {app.cdcBand || 'N/A'}</p>
                  </div>
                </div>
                {app.cdcRemarks && (
                  <p className="text-xs text-slate-500 mt-1 italic bg-slate-50 p-2 rounded-xl border border-slate-100/60">
                    <strong>CDC Remarks:</strong> "{app.cdcRemarks}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0">
                <button
                  onClick={() => {
                    setSelectedApp(app);
                    const initialStatus = (app.finalStatus === 'Approved' || app.finalStatus === 'Rejected') ? app.finalStatus : 'Approved';
                    setFinalStatus(initialStatus);
                    setRemarks(app.remarks || '');
                  }}
                  className="px-5 py-2.5 bg-[#78be21] hover:bg-[#68a61d] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all active:scale-[0.98] flex items-center gap-2"
                >
                  <Eye size={18} />
                  Review & Decide
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Decision Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-xl font-bold">Final Decision</h3>
              <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-2 gap-8">
                {selectedApp.hasAcademicConflict && (
                  <div className="col-span-2 p-3.5 bg-amber-50 border border-amber-200/60 rounded-xl text-amber-800 font-medium text-xs flex items-start gap-2.5">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-950">Academic Conflict Detected:</span>
                      <p className="mt-0.5 leading-relaxed text-amber-800">{selectedApp.conflictDetails}</p>
                    </div>
                  </div>
                )}
                {(selectedApp.studentDetails.year.includes('2nd Year') || selectedApp.studentDetails.year === '3rd Year – 1st Sem') && (
                  <div className="col-span-2 p-3.5 bg-amber-50/80 border border-amber-200/60 rounded-xl text-amber-800 font-medium text-xs flex items-center gap-2.5 animate-pulse">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                    <span><strong>Semester Eligibility Restriction:</strong> Students from 2nd Year – 1st Semester to 3rd Year – 1st Semester are eligible only for In-House Internships (Live Projects).</span>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Student Info</h4>
                  <p className="text-slate-900 font-bold">{selectedApp.studentDetails.name}</p>
                  <p className="text-slate-500 text-sm">{selectedApp.studentDetails.rollNumber} | {selectedApp.studentDetails.branch} | {selectedApp.studentDetails.year}</p>
                  <p className="text-slate-700 font-bold mt-2">Attendance (Submitted): {Number(selectedApp.studentDetails.attendancePercentage).toFixed(2)}%</p>
                  {selectedApp.verifiedAttendancePercentage !== undefined && (
                    <p className="text-slate-700 font-bold mt-1 flex items-center gap-1.5">
                      <span>Attendance (Verified): {Number(selectedApp.verifiedAttendancePercentage).toFixed(2)}%</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                        selectedApp.isAttendanceVerified
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {selectedApp.isAttendanceVerified ? 'Verified ✓' : 'Discrepancy ⚠️'}
                      </span>
                    </p>
                  )}
                  {selectedApp.studentDetails.cgpa !== undefined && (
                    <p className="text-slate-700 font-bold">CGPA: {Number(selectedApp.studentDetails.cgpa).toFixed(2)}</p>
                  )}
                  {selectedApp.studentDetails.contactNumber && (
                    <p className="text-slate-600 text-xs mt-1">Phone: {selectedApp.studentDetails.contactNumber}</p>
                  )}
                  {selectedApp.studentDetails.personalEmail && (
                    <p className="text-slate-600 text-xs">Email: {selectedApp.studentDetails.personalEmail}</p>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">CDC Review Assessment</h4>
                  <p className="text-slate-900 text-sm font-bold">
                    CDC Recommendation:{" "}
                    <span className={`font-bold uppercase ${
                      selectedApp.cdcRecommendation === 'Recommended' ? 'text-emerald-600' :
                      selectedApp.cdcRecommendation === 'Not Recommended' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {selectedApp.cdcRecommendation === 'Recommended' ? 'Recommended ✓' :
                        selectedApp.cdcRecommendation === 'Not Recommended' ? 'Not Recommended ✗' :
                        selectedApp.cdcRecommendation === 'Need Clarification' ? 'Need Clarification' :
                          `${(selectedApp.cdcRecommendation || 'Pending')}`}
                    </span>
                  </p>
                  <p className="text-slate-700 text-xs mt-1 font-semibold">
                    Assigned Bands: SPF Band {selectedApp.spfBand || 'N/A'} | CDC Band {selectedApp.cdcBand || 'N/A'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    CDC Reviewed Date: {(() => {
                      const cdcEvent = selectedApp.timeline?.find((e: any) => e.role === 'cdc');
                      return cdcEvent ? new Date(cdcEvent.timestamp).toLocaleDateString() : 'N/A';
                    })()}
                  </p>
                  {selectedApp.cdcRemarks && (
                    <p className="text-slate-600 text-xs mt-2 bg-slate-50 border border-slate-100 p-2.5 rounded-xl italic">
                      CDC Remarks: "{selectedApp.cdcRemarks}"
                    </p>
                  )}
                  {selectedApp.criticalSubject && (
                    <div className="mt-3.5 p-3.5 bg-amber-50 border border-amber-200/60 rounded-xl flex items-start gap-2.5">
                      <span className="text-base shrink-0">⚡</span>
                      <div>
                        <span className="font-bold text-[10px] uppercase text-amber-800 tracking-wide block mb-0.5">Critical Subject Selected</span>
                        <span className="text-slate-800 font-semibold text-xs leading-snug">{selectedApp.criticalSubject}</span>
                        <p className="text-slate-500 text-[10px] mt-0.5">Student plans to attend this subject during internship</p>
                      </div>
                    </div>
                  )}

                  {/* HOD Review Details */}
                  {selectedApp.hodStatus && selectedApp.hodStatus !== 'Pending' && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">HOD Review Assessment</h4>
                      <p className="text-slate-900 text-sm font-bold">
                        HOD Recommendation:{" "}
                        <span className={`font-bold uppercase ${
                          selectedApp.hodStatus === 'Recommended' ? 'text-emerald-600' :
                          selectedApp.hodStatus === 'Not Recommended' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {selectedApp.hodStatus === 'Recommended' ? 'Recommended ✓' :
                            selectedApp.hodStatus === 'Not Recommended' ? 'Not Recommended ✗' :
                            selectedApp.hodStatus === 'Need Clarification' ? 'Need Clarification' :
                              `${selectedApp.hodStatus}`}
                        </span>
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        HOD Reviewed By: {selectedApp.hodReviewedBy || 'HOD'}
                        {selectedApp.hodReviewedAt && ` on ${new Date(selectedApp.hodReviewedAt).toLocaleDateString()}`}
                      </p>
                      {selectedApp.hodComments && (
                        <p className="text-slate-600 text-xs mt-2 bg-slate-50 border border-slate-100 p-2.5 rounded-xl italic">
                          HOD Comments: "{selectedApp.hodComments}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline History Tracker */}
              {selectedApp.timeline && selectedApp.timeline.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900">Application History Timeline</h4>
                  <div className="relative pl-6 border-l-2 border-slate-200/80 space-y-5">
                    {selectedApp.timeline.map((event: any, idx: number) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 bg-white border-2 border-[#78be21] rounded-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-[#78be21] rounded-full"></div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800">{event.status}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{new Date(event.timestamp).toLocaleString()}</p>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          By: <span className="font-semibold text-slate-700">{event.updatedBy}</span> ({event.role})
                        </p>
                        {event.remarks && (
                          <p className="text-xs text-slate-600 mt-1 italic pl-2 border-l-2 border-slate-200">
                            "{event.remarks}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">Final Decision</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Status</label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-700 font-semibold"
                      value={finalStatus}
                      onChange={(e) => setFinalStatus(e.target.value)}
                    >
                      <option value="Approved">Approve</option>
                      <option value="Rejected">Reject</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Remarks</label>
                    <textarea
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm text-slate-700"
                      rows={2}
                      placeholder="Add any additional comments..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <a
                  href={`/${selectedApp.attachments.offerLetter}`}
                  target="_blank"
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <ExternalLink size={16} /> View Offer Letter
                </a>
                <button
                  onClick={() => handleDecision(selectedApp._id)}
                  className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer ${finalStatus === 'Approved' ? 'bg-[#78be21] shadow-[#78be21]/20 hover:bg-[#68a61d]' :
                      'bg-red-500 shadow-red-500/20 hover:bg-red-600'
                    }`}
                >
                  {finalStatus === 'Approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
