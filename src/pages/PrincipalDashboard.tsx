import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Eye, ExternalLink, ShieldCheck, AlertCircle, AlertTriangle } from 'lucide-react';

export default function PrincipalDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [decision, setDecision] = useState({ finalStatus: 'Approved', remarks: '' });

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/internships/forwarded', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setApplications(response.data);
    } catch (err) {
      console.error('Error fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/internships/principal-decision/${id}`, decision, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedApp(null);
      fetchApplications();
    } catch (err) {
      console.error('Error updating decision:', err);
      alert('Failed to update decision');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading applications...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Principal Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Review and provide final approval for internships</p>
        </div>
        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
          <ShieldCheck size={24} />
        </div>
      </div>

      <div className="grid gap-6">
        {applications.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-slate-900 font-bold text-lg">No pending approvals</h3>
            <p className="text-slate-500 text-sm mt-1">All forwarded applications have been processed.</p>
          </div>
        ) : (
          applications.map((app) => (
            <motion.div
              key={app._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{app.studentDetails.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                    ['Approved', '3 Months Approved'].includes(app.eligibilityStatus) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    ['Conditionally Approved', '3 Months + 3 Months Extension'].includes(app.eligibilityStatus) ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    'bg-blue-50 text-blue-600 border-blue-100'
                  }`}>
                    CDC: {app.eligibilityStatus}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Company</p>
                    <p className="text-slate-700 font-medium">{app.internshipDetails.companyName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Duration</p>
                    <p className="text-slate-700 font-medium">{app.internshipDetails.totalDuration} Months</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Permissible</p>
                    <p className="text-slate-700 font-bold">{app.permissibleDuration} Months</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Attendance</p>
                    <p className="text-emerald-500 font-bold">{app.studentDetails.attendancePercentage}%</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0">
                <button
                  onClick={() => {
                    setSelectedApp(app);
                    setDecision({
                      finalStatus: app.finalStatus || 'Approved',
                      remarks: app.remarks || ''
                    });
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
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">CDC Review</h4>
                  <p className="text-slate-900 font-bold">Bands: SPF {selectedApp.spfBand} | CDC {selectedApp.cdcBand}</p>
                  <p className="text-slate-500 text-sm">Permissible: {selectedApp.permissibleDuration} Months</p>
                  <p className={`font-bold mt-2 ${
                    ['Approved', '3 Months Approved'].includes(selectedApp.eligibilityStatus) ? 'text-emerald-600' :
                    ['Conditionally Approved', '3 Months + 3 Months Extension'].includes(selectedApp.eligibilityStatus) ? 'text-amber-600' :
                    'text-red-500'
                  }`}>Status: {selectedApp.eligibilityStatus}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">Final Decision</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Status</label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none"
                      value={decision.finalStatus}
                      onChange={(e) => setDecision({ ...decision, finalStatus: e.target.value })}
                    >
                      <option value="Approved">Approve</option>
                      <option value="Rejected">Reject</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Remarks</label>
                    <textarea
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                      rows={2}
                      placeholder="Add any additional comments..."
                      value={decision.remarks}
                      onChange={(e) => setDecision({ ...decision, remarks: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <a
                  href={`/${selectedApp.attachments.offerLetter}`}
                  target="_blank"
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                >
                  <ExternalLink size={16} /> View Offer Letter
                </a>
                <button
                  onClick={() => handleDecision(selectedApp._id)}
                  className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition-all ${
                    decision.finalStatus === 'Approved' ? 'bg-[#78be21] shadow-[#78be21]/20 hover:bg-[#68a61d]' : 'bg-red-500 shadow-red-500/20 hover:bg-red-600'
                  }`}
                >
                  {decision.finalStatus === 'Approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
