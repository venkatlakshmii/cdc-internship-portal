import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { Search, Filter, CheckCircle, AlertCircle, Eye, ExternalLink, AlertTriangle } from 'lucide-react';

export default function CDCDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [bands, setBands] = useState({ spfBand: 'A', cdcBand: 'A' });

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
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/internships/cdc-review/${id}`, bands, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedApp(null);
      fetchApplications();
    } catch (err) {
      console.error('Error updating review:', err);
      alert('Failed to update review');
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this internship application?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/internships/cdc-review/${id}`, { action: 'reject' }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedApp(null);
      fetchApplications();
    } catch (err) {
      console.error('Error rejecting application:', err);
      alert('Failed to reject application');
    }
  };

  const filteredApps = applications.filter(app => {
    if (filter === 'all') return true;
    return app.eligibilityStatus.toLowerCase().includes(filter.toLowerCase());
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading applications...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">CDC Faculty Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Review student applications and assign bands</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#78be21]/20"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="not eligible">Not Eligible</option>
            </select>
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
                        spfBand: app.spfBand || 'A',
                        cdcBand: app.cdcBand || 'A'
                      });
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

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">Assign Bands</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">SPF Band</label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none"
                      value={bands.spfBand}
                      onChange={(e) => setBands({ ...bands, spfBand: e.target.value })}
                    >
                      <option value="A">Band A</option>
                      <option value="B">Band B</option>
                      <option value="C">Band C</option>
                      <option value="D">Band D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">CDC Band</label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none"
                      value={bands.cdcBand}
                      onChange={(e) => setBands({ ...bands, cdcBand: e.target.value })}
                    >
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
                  type="button"
                  onClick={() => handleReject(selectedApp._id)}
                  className="w-full sm:w-auto px-6 py-3 border border-red-200 hover:border-red-300 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/70 font-bold rounded-xl text-sm transition-all cursor-pointer text-center"
                >
                  Reject Application
                </button>
                <button
                  onClick={() => handleReview(selectedApp._id)}
                  className="w-full sm:flex-1 py-3 bg-[#78be21] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 hover:bg-[#68a61d] transition-all cursor-pointer"
                >
                  Submit Review
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
