import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Eye, FileText, ExternalLink, AlertTriangle, AlertCircle, Shield, Calendar, GraduationCap, CheckCircle, Filter, ChevronDown, X
} from 'lucide-react';

export default function HODDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [hodDecision, setHodDecision] = useState('Recommended');
  const [comment, setComment] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/internships/hod/applications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApplications(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching HOD applications:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleReviewSubmit = async (id: string) => {
    if (!comment.trim()) {
      alert('Review comment is compulsory. Please write a comment before submitting.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/internships/hod/review/${id}`, {
        action: hodDecision,
        comment: comment.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`Review submitted successfully as: ${hodDecision}`);
      setSelectedApp(null);
      setComment('');
      fetchApplications();
    } catch (err: any) {
      console.error('Error submitting HOD review:', err);
      alert(err.response?.data?.message || 'Failed to submit review.');
    }
  };

  const filteredApps = applications.filter(app => {
    const studentName = app.studentDetails?.name || '';
    const rollNo = app.studentDetails?.rollNumber || '';
    const q = search.toLowerCase().trim();
    const matchSearch = studentName.toLowerCase().includes(q) || rollNo.toLowerCase().includes(q);

    const matchStatus = statusFilter === 'all' || (() => {
      const status = (app.hodStatus || 'Pending').toLowerCase();
      if (statusFilter === 'pending') return status === 'pending';
      if (statusFilter === 'recommended') return status === 'recommended';
      if (statusFilter === 'not recommended') return status === 'not recommended';
      if (statusFilter === 'need clarification') return status === 'need clarification';
      return status === statusFilter.toLowerCase();
    })();

    return matchSearch && matchStatus;
  });

  const getDepartmentLabel = (branch: string) => {
    const b = (branch || '').toUpperCase().trim();
    if (b === 'MECH' || b === 'ME') return 'Mechanical Engineering';
    if (b === 'CSE') return 'Computer Science & Engineering';
    if (b === 'CSM') return 'CSE (AI & ML)';
    if (b === 'CSD') return 'CSE (Data Science)';
    if (b === 'ECE') return 'Electronics & Communication Engineering';
    if (b === 'EEE') return 'Electrical & Electronics Engineering';
    return b;
  };

  const convertDecimalMonthsToMonthsDays = (months: number) => {
    if (!months) return 'N/A';
    const m = Math.floor(months);
    const d = Math.round((months - m) * 30);
    if (m === 0) return `${d} Days`;
    if (d === 0) return `${m} Month${m > 1 ? 's' : ''}`;
    return `${m} Month${m > 1 ? 's' : ''} ${d} Day${d > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
        <div className="w-8 h-8 border-4 border-[#78be21] border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-semibold">Loading HOD applications...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">HOD Dashboard ({user.branch})</h2>
          <p className="text-slate-500 text-sm mt-1">
            Department of {getDepartmentLabel(user.branch)}. Review and make recommendations for C & D band applications.
          </p>
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

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by student name or roll number..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-medium outline-none focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <div className="relative flex-1 sm:flex-none">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#78be21]/20 cursor-pointer appearance-none text-slate-700"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="recommended">Recommended</option>
                <option value="not recommended">Not Recommended</option>
                <option value="need clarification">Need Clarification</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown size={12} />
              </div>
            </div>

            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <X size={14} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Card-List of applications matching Principal's UI */}
      <div className="grid gap-6">
        {filteredApps.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-slate-900 font-bold text-lg">No applications available</h3>
            <p className="text-slate-500 text-sm mt-1">All applications have been processed or match your active filters.</p>
          </div>
        ) : (
          filteredApps.map((app) => (
            <motion.div
              key={app._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{app.studentDetails.name}</h3>
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-100 uppercase tracking-wider">
                    {app.studentDetails.rollNumber}
                  </span>
                  
                  {/* CDC Status Badge */}
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                    app.cdcRecommendation === 'Recommended' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    app.cdcRecommendation === 'Not Recommended' ? 'bg-red-50 text-red-600 border-red-100' :
                    'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    CDC: {app.cdcRecommendation}
                  </span>

                  {/* HOD Status Badge */}
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                    (app.hodStatus || 'Pending') === 'Recommended' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    (app.hodStatus || 'Pending') === 'Not Recommended' ? 'bg-red-50 text-red-600 border-red-100' :
                    (app.hodStatus || 'Pending') === 'Need Clarification' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    'bg-slate-50 text-slate-600 border-slate-100'
                  }`}>
                    HOD: {app.hodStatus || 'Pending'}
                  </span>

                  {/* Principal Status Badge */}
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                    app.principalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    app.principalStatus === 'Rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                    'bg-blue-50 text-blue-600 border-blue-100'
                  }`}>
                    Principal: {app.principalStatus || 'Pending Review'}
                  </span>

                  {app.hasAcademicConflict && (
                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase" title={app.conflictDetails || 'Academic Conflict'}>
                      <AlertTriangle size={12} className="text-amber-500" />
                      Conflict
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
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Bands (SPF | CDC)</p>
                    <p className="text-slate-700 font-bold">{app.spfBand || 'N/A'} | {app.cdcBand || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Attendance</p>
                    <p className="text-emerald-500 font-bold">
                      {Number(app.studentDetails.attendancePercentage).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Mode</p>
                    <p className="text-slate-700 font-medium">{app.internshipDetails.mode}</p>
                  </div>
                </div>

                {app.hodComments && (
                  <p className="text-xs text-slate-500 mt-1 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100/60">
                    <strong>My Review Comments:</strong> "{app.hodComments}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedApp(app);
                    setHodDecision(app.hodStatus && app.hodStatus !== 'Pending' ? app.hodStatus : 'Recommended');
                    setComment(app.hodComments || '');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-[#78be21] hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Eye size={14} />
                  {app.hodStatus && app.hodStatus !== 'Pending' ? 'View/Edit Review' : 'Review & Decide'}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 bg-[#78be21] rounded-full"></div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Review Application</h3>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">HOD Assessment Layer</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedApp(null)} 
                  className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200/80 p-2 rounded-full transition-all cursor-pointer flex items-center justify-center w-8 h-8 font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[75vh] overflow-auto">
                <div className="grid grid-cols-2 gap-8">
                  {/* Student Info */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Student Info</h4>
                    <p className="text-slate-900 font-bold">{selectedApp.studentDetails.name}</p>
                    <p className="text-slate-500 text-sm">{selectedApp.studentDetails.rollNumber} | {selectedApp.studentDetails.branch} | {selectedApp.studentDetails.year}</p>
                    <p className="text-slate-700 font-bold mt-2">Attendance: {Number(selectedApp.studentDetails.attendancePercentage).toFixed(2)}%</p>
                    {selectedApp.studentDetails.cgpa !== undefined && (
                      <p className="text-slate-700 font-bold">CGPA: {Number(selectedApp.studentDetails.cgpa).toFixed(2)}</p>
                    )}
                    <p className="text-purple-700 font-bold mt-1">Assigned Bands: SPF {selectedApp.spfBand} | CDC {selectedApp.cdcBand}</p>
                  </div>

                  {/* Internship Info */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Internship Details</h4>
                    <p className="text-slate-900 font-bold">{selectedApp.internshipDetails.companyName}</p>
                    <p className="text-slate-500 text-sm">
                      {selectedApp.internshipDetails.durationDisplay || `${selectedApp.internshipDetails.totalDuration} Months`} | {selectedApp.internshipDetails.mode}
                    </p>
                    <p className="text-slate-600 text-xs mt-2">Location: {selectedApp.internshipDetails.location}</p>
                    {selectedApp.internshipDetails.stipend && (
                      <p className="text-slate-600 text-xs">Stipend: {selectedApp.internshipDetails.stipend}</p>
                    )}
                  </div>
                </div>

                {/* Uploaded Documents */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uploaded Documents</h4>
                  <div className="flex flex-wrap gap-3">
                    {selectedApp.attachments.offerLetter && (
                      <a
                        href={`/${selectedApp.attachments.offerLetter}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <FileText size={14} className="text-[#78be21]" />
                        Offer Letter
                        <ExternalLink size={12} className="text-slate-400 animate-pulse" />
                      </a>
                    )}
                    {selectedApp.attachments.joiningLetter && (
                      <a
                        href={`/${selectedApp.attachments.joiningLetter}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <FileText size={14} className="text-[#78be21]" />
                        Joining Letter
                        <ExternalLink size={12} className="text-slate-400 animate-pulse" />
                      </a>
                    )}
                  </div>
                </div>

                {/* CDC Assessment matching Principal Dashboard */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">CDC Review Assessment</h4>
                  <p className="text-slate-900 text-sm font-bold">
                    CDC Recommendation:{" "}
                    <span className={`font-bold uppercase ${
                      selectedApp.cdcRecommendation === 'Recommended' ? 'text-emerald-600' :
                      selectedApp.cdcRecommendation === 'Not Recommended' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {selectedApp.cdcRecommendation === 'Recommended' ? 'Recommended ✓' :
                        selectedApp.cdcRecommendation === 'Not Recommended' ? 'Not Recommended ✗' :
                        selectedApp.cdcRecommendation === 'Need Clarification' ? 'Need Clarification' :
                          `${selectedApp.cdcRecommendation}`}
                    </span>
                  </p>
                  <p className="text-slate-700 text-xs mt-1 font-semibold">
                    Assigned Bands: SPF Band {selectedApp.spfBand || 'N/A'} | CDC Band {selectedApp.cdcBand || 'N/A'}
                  </p>
                  {selectedApp.cdcRemarks && (
                    <p className="text-slate-600 text-xs mt-2 bg-white border border-slate-200 p-2.5 rounded-xl italic">
                      CDC Remarks: "{selectedApp.cdcRemarks}"
                    </p>
                  )}
                </div>

                {/* HOD Assessment input card styled exactly like CDC Assessment in CDCDashboard */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900">HOD Assessment</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Recommendation</label>
                      <select
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm text-slate-700 font-semibold"
                        value={hodDecision}
                        onChange={(e) => setHodDecision(e.target.value)}
                      >
                        <option value="Recommended">Recommended</option>
                        <option value="Not Recommended">Not Recommended</option>
                        <option value="Need Clarification">Need Clarification</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Comments <span className="text-red-500">*</span></label>
                      <textarea
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm text-slate-700 focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21]"
                        rows={2}
                        placeholder="Add HOD comments..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Actions aligned with CDC Submit Button */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={() => handleReviewSubmit(selectedApp._id)}
                    className="w-full py-3 bg-[#78be21] hover:bg-[#68a61d] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all cursor-pointer text-sm flex items-center justify-center"
                  >
                    Submit Assessment
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
