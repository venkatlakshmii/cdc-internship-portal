import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, FileText, ExternalLink } from 'lucide-react';

export default function StudentDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentYear, setStudentYear] = useState<string>('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        try {
          const profileResponse = await axios.get('/api/auth/profile', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (profileResponse.data) {
            setStudentYear(profileResponse.data.year || '');
          }
        } catch (profileErr) {
          console.error('Error fetching profile for dashboard:', profileErr);
        }

        const response = await axios.get('/api/internships/my-applications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setApplications(response.data);
      } catch (err) {
        console.error('Error fetching applications:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case '3 Months Approved': 
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Conditionally Approved':
      case '3 Months + 3 Months Extension': 
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Not Eligible': return 'bg-red-100 text-red-700 border-red-200';
      case 'Rejected': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved':
      case '3 Months Approved': 
        return <CheckCircle2 size={16} />;
      case 'Conditionally Approved':
      case '3 Months + 3 Months Extension': 
        return <AlertTriangle size={16} />;
      case 'Not Eligible': return <XCircle size={16} />;
      case 'Rejected': return <XCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading applications...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Applications</h2>
          <p className="text-slate-500 text-sm mt-1">Track your internship status and eligibility</p>
        </div>
        <Link
          to={user.profileRegistered ? "/student/apply" : "/student/register"}
          onClick={(e) => {
            if (!user.profileRegistered) {
              alert("Please complete your student profile registration before applying for internships.");
            }
          }}
          className="px-5 py-2.5 bg-[#78be21] hover:bg-[#68a61d] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all active:scale-[0.98] flex items-center gap-2"
        >
          <FileText size={18} />
          New Application
        </Link>
      </div>

      {(studentYear === '2nd' || studentYear.includes('2nd')) && (
        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-amber-800 text-xs font-semibold shadow-sm">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="font-bold text-amber-900">2nd Year Student Eligibility Notice:</p>
            <p className="mt-0.5 leading-relaxed">
              You are allowed to apply for internships with a <strong>maximum duration of 4 weeks (28 days)</strong> and you are eligible <strong>only for In-House internships</strong>. Please ensure your application matches these criteria.
            </p>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <FileText size={32} />
          </div>
          <h3 className="text-slate-900 font-bold text-lg">No applications yet</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
            You haven't submitted any internship applications yet. Click the button above to start.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {applications.map((app) => (
            <motion.div
              key={app._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-900">{app.internshipDetails.companyName}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${getStatusColor(app.eligibilityStatus)}`}>
                      {getStatusIcon(app.eligibilityStatus)}
                      {app.eligibilityStatus}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-sm">
                    <div>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Duration</p>
                      <p className="text-slate-700 font-medium">{app.internshipDetails.totalDuration} Months</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Mode</p>
                      <p className="text-slate-700 font-medium">{app.internshipDetails.mode}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Attendance</p>
                      <p className={`font-bold ${app.studentDetails.attendancePercentage < 75 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {app.studentDetails.attendancePercentage}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Final Status</p>
                      <p className="text-slate-700 font-medium">{app.finalStatus}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0">
                  {app.attachments.offerLetter && (
                    <a
                      href={`/${app.attachments.offerLetter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-[#78be21] transition-colors"
                      title="View Offer Letter"
                    >
                      <ExternalLink size={20} />
                    </a>
                  )}
                  <div className="text-right">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Submitted On</p>
                    <p className="text-slate-700 text-xs font-medium">{new Date(app.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              
              {app.remarks && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 italic">
                  <span className="font-bold not-italic mr-2">Remarks:</span>
                  "{app.remarks}"
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
