import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { 
  Search, Filter, CheckCircle, AlertCircle, Eye, ExternalLink, AlertTriangle,
  FileText, Download, X, Calendar, GraduationCap, ChevronDown
} from 'lucide-react';

export default function CDCDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [bands, setBands] = useState({ spfBand: '', cdcBand: '' });
  const [cdcRecommendation, setCdcRecommendation] = useState('Approved');
  const [cdcRemarks, setCdcRemarks] = useState('');

  // Filter & Search State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/internships/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setApplications(response.data);
    } catch (err) {
      console.error('Error fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: string) => {
    if (!bands.spfBand || !bands.cdcBand) {
      alert('Please select both SPF Band and CDC Band before submitting assessment.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/internships/cdc-review/${id}`, {
        spfBand: bands.spfBand,
        cdcBand: bands.cdcBand,
        cdcRecommendation,
        cdcRemarks
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedApp(null);
      fetchApplications();
    } catch (err) {
      console.error('Error updating review:', err);
      alert('Failed to update review');
    }
  };

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

  const filteredApps = applications.filter(app => {
    const studentName = app.studentDetails?.name || '';
    const rollNo = app.studentDetails?.rollNumber || '';
    const q = search.toLowerCase().trim();
    const rollMatch = q.match(/^([0-9]{2}e51a[0-9a-z]{4})@hitam\.org$/);
    const cleanSearch = rollMatch ? rollMatch[1] : q;
    const matchSearch = studentName.toLowerCase().includes(cleanSearch) || 
                        rollNo.toLowerCase().includes(cleanSearch);
    
    const matchStatus = statusFilter === 'all' || (() => {
      const eligibility = app.eligibilityStatus.toLowerCase();
      if (statusFilter === 'pending') return eligibility.includes('pending');
      if (statusFilter === 'approved') return ['approved', '3 months approved', 'conditionally approved', '3 months + 3 months extension'].some(st => eligibility === st);
      if (statusFilter === 'not eligible') return eligibility.includes('not eligible');
      return eligibility.includes(statusFilter.toLowerCase());
    })();

    const matchBranch = branchFilter === 'all' || app.studentDetails?.branch === branchFilter;
    const matchYear = yearFilter === 'all' || (app.studentDetails?.year && app.studentDetails.year.includes(yearFilter));
    const matchType = typeFilter === 'all' || app.internshipDetails?.mode === typeFilter;
    
    const matchDate = (() => {
      if (!startDate && !endDate) return true;
      if (!app.internshipDetails?.fromDate) return false;
      const appDateStr = typeof app.internshipDetails.fromDate === 'string'
        ? app.internshipDetails.fromDate.substring(0, 10)
        : new Date(app.internshipDetails.fromDate).toISOString().substring(0, 10);
      if (startDate && appDateStr < startDate) return false;
      if (endDate && appDateStr > endDate) return false;
      return true;
    })();

    return matchSearch && matchStatus && matchBranch && matchYear && matchType && matchDate;
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading applications...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">CDC Faculty Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Review student applications, make recommendations, and assign bands.</p>
        </div>
      </div>

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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Attendance</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Eligibility</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredApps.map((app) => (
              <tr key={app._id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-slate-900 font-bold text-sm">{app.studentDetails.name}</p>
                  <p className="text-slate-500 text-xs">{app.studentDetails.rollNumber}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-slate-700 font-medium text-sm">{app.internshipDetails.companyName}</p>
                  <p className="text-slate-400 text-xs">{app.internshipDetails.totalDuration} Months</p>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm font-bold ${app.studentDetails.attendancePercentage < 75 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {app.studentDetails.attendancePercentage}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                    ['Approved', '3 Months Approved'].includes(app.eligibilityStatus) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    ['Conditionally Approved', '3 Months + 3 Months Extension'].includes(app.eligibilityStatus) ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    app.eligibilityStatus === 'Not Eligible' ? 'bg-red-50 text-red-600 border-red-100' :
                    app.eligibilityStatus.includes('Rejected by CDC') ? 'bg-red-50 text-red-600 border-red-100' :
                    app.eligibilityStatus === 'Needs Clarification' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    'bg-blue-50 text-blue-600 border-blue-100'
                  }`}>
                    {app.eligibilityStatus}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => {
                      setSelectedApp(app);
                      setBands({
                        spfBand: app.spfBand || '',
                        cdcBand: app.cdcBand || ''
                      });
                      setCdcRecommendation(app.cdcRecommendation || 'Approved');
                      setCdcRemarks(app.cdcRemarks || '');
                    }}
                    className="p-2 text-slate-400 hover:text-[#78be21] transition-colors"
                    title="Review Details"
                  >
                    <Eye size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Review Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-6 bg-[#78be21] rounded-full"></div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Review Application</h3>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">CDC Assessment Module</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedApp(null)} 
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200/80 p-2 rounded-full transition-all cursor-pointer flex items-center justify-center w-8 h-8 font-bold text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-2 gap-8">
                {((selectedApp.studentDetails.year === '2nd' || (selectedApp.studentDetails.year && selectedApp.studentDetails.year.includes('2nd')))) && (
                  <div className="col-span-2 p-3.5 bg-amber-50/80 border border-amber-200/60 rounded-xl text-amber-800 font-medium text-xs flex items-center gap-2.5 animate-pulse">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                    <span><strong>2nd Year Student Restriction:</strong> Max duration is 4 weeks (28 days) and eligible only for In-House internships.</span>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Student Info</h4>
                  <p className="text-slate-900 font-bold">{selectedApp.studentDetails.name}</p>
                  <p className="text-slate-500 text-sm">{selectedApp.studentDetails.rollNumber} | {selectedApp.studentDetails.branch}</p>
                  <p className="text-slate-700 font-bold mt-2">Attendance: {selectedApp.studentDetails.attendancePercentage}%</p>
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
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Internship Info</h4>
                  <p className="text-slate-900 font-bold">{selectedApp.internshipDetails.companyName}</p>
                  <p className="text-slate-500 text-sm">{selectedApp.internshipDetails.totalDuration} Months | {selectedApp.internshipDetails.mode}</p>
                </div>
              </div>

              {/* Recommendation and Remarks */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">CDC Assessment</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Recommendation</label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm text-slate-700 font-semibold"
                      value={cdcRecommendation}
                      onChange={(e) => setCdcRecommendation(e.target.value)}
                    >
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Needs Clarification">Needs Clarification</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Remarks</label>
                    <textarea
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm text-slate-700"
                      rows={2}
                      placeholder="Add assessment remarks..."
                      value={cdcRemarks}
                      onChange={(e) => setCdcRemarks(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">Assign Bands</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">SPF Band <span className="text-red-500">*</span></label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-700 font-semibold"
                      value={bands.spfBand}
                      onChange={(e) => setBands({ ...bands, spfBand: e.target.value })}
                    >
                      <option value="">Select SPF Band</option>
                      <option value="A">Band A</option>
                      <option value="B">Band B</option>
                      <option value="C">Band C</option>
                      <option value="D">Band D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">CDC Band <span className="text-red-500">*</span></label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-700 font-semibold"
                      value={bands.cdcBand}
                      onChange={(e) => setBands({ ...bands, cdcBand: e.target.value })}
                    >
                      <option value="">Select CDC Band</option>
                      <option value="A">Band A</option>
                      <option value="B">Band B</option>
                      <option value="C">Band C</option>
                      <option value="D">Band D</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <a
                  href={`/${selectedApp.attachments.offerLetter}`}
                  target="_blank"
                  className="w-full sm:flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <ExternalLink size={16} /> View Offer Letter
                </a>
                <button
                  onClick={() => handleReview(selectedApp._id)}
                  className="w-full sm:flex-1 py-3 bg-[#78be21] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 hover:bg-[#68a61d] transition-all cursor-pointer"
                >
                  Submit Assessment
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
