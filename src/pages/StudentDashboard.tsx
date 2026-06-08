import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, FileText, ExternalLink, Lock } from 'lucide-react';

export default function StudentDashboard() {
  let user: any = {};
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser && storedUser !== 'undefined') {
      user = JSON.parse(storedUser);
    }
  } catch (e) {
    console.error('Failed to parse user in StudentDashboard', e);
  }
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentYear, setStudentYear] = useState<string>('');
  const [portalStatus, setPortalStatus] = useState<any>({
    modules: { applications: 'active' },
    warningMessage: '',
    activeExamEvent: null
  });

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

        try {
          const statusRes = await axios.get('/api/portal-control/status', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (statusRes.data) {
            setPortalStatus(statusRes.data);
          }
        } catch (statusErr) {
          console.error('Error fetching portal status:', statusErr);
        }

        const response = await axios.get('/api/internships/my-applications', {
          headers: { Authorization: `Bearer ${token}` },
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
    fetchDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case '3 Months Approved': 
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Conditionally Approved':
      case '3 Months + 3 Months Extension': 
      case 'Needs Clarification':
      case 'Clarification Required by CDC':
      case 'Request Changes':
      case 'Put On Hold':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Not Eligible':
      case 'Rejected by CDC – Pending Principal Review':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Rejected':
        return 'bg-slate-100 text-slate-700 border-slate-200';
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
      case 'Needs Clarification':
      case 'Clarification Required by CDC':
      case 'Request Changes':
      case 'Put On Hold':
        return <AlertTriangle size={16} />;
      case 'Not Eligible':
      case 'Rejected by CDC – Pending Principal Review':
      case 'Rejected':
        return <XCircle size={16} />;
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
        {portalStatus.modules?.applications !== 'active' ? (
          <button
            disabled
            className="px-5 py-2.5 bg-slate-200 text-slate-400 font-bold rounded-xl cursor-not-allowed flex items-center gap-2 border border-slate-300"
            title={portalStatus.warningMessage || 'Applications are currently disabled.'}
          >
            <Lock size={18} />
            New Application
          </button>
        ) : (
          <Link
            to={user.profileRegistered ? "/student/applications" : "/student/register"}
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
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200/80 rounded-2xl flex items-start gap-3 text-red-800 text-xs font-semibold shadow-sm">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900">Error Loading Applications</p>
            <p className="mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {portalStatus.modules?.applications !== 'active' && (
        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-amber-800 text-xs font-semibold shadow-sm animate-pulse">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900">Internship Applications Suspended ({portalStatus.modules?.applications.toUpperCase()})</p>
            <p className="mt-0.5 leading-relaxed">
              {portalStatus.warningMessage || 'Internship applications are temporarily disabled.'}
            </p>
          </div>
        </div>
      )}

      {studentYear.includes('1st Year') && (
        <div className="p-4 bg-red-50 border border-red-200/80 rounded-2xl flex items-start gap-3 text-red-800 text-xs font-semibold shadow-sm">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900">1st Year Student Eligibility Notice:</p>
            <p className="mt-0.5 leading-relaxed">
              1st Year students are not eligible for internship applications.
            </p>
          </div>
        </div>
      )}

      {(studentYear.includes('2nd Year') || studentYear === '3rd Year – 1st Sem') && (
        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-amber-800 text-xs font-semibold shadow-sm">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900">Academic Semester Notice:</p>
            <p className="mt-0.5 leading-relaxed">
              Students from 2nd Year – 1st Semester to 3rd Year – 1st Semester are eligible only for In-House Internships (Live Projects). {studentYear.includes('2nd Year') && <>Additionally, 2nd Year students are allowed internships only for a maximum duration of 4 weeks (28 days).</>}
            </p>
          </div>
        </div>
      )}

      {applications.some(app => app.eligibilityStatus === 'Clarification Required by CDC' && app.finalStatus === 'Pending Principal Approval') && (
        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-amber-800 text-xs font-semibold shadow-sm animate-pulse">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900">CDC Clarification Required</p>
            <p className="mt-0.5 leading-relaxed text-[#8a6d3b]">
              CDC Department has requested clarification. Please meet the CDC office.
            </p>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <FileText size={32} />
          </div>
          <h3 className="text-slate-900 font-bold text-lg">No applications available</h3>
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
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-900">{app.internshipDetails?.companyName || 'N/A'}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                      app.finalStatus === 'Approved' ? getStatusColor('Approved') :
                      app.finalStatus === 'Rejected' ? getStatusColor('Rejected') :
                      app.finalStatus === 'Pending Principal Approval' && !['Pending CDC Review', 'Clarification Required by CDC', 'Rejected by CDC – Pending Principal Review'].includes(app.eligibilityStatus)
                        ? getStatusColor('Pending Principal Approval')
                        : getStatusColor(app.eligibilityStatus)
                    }`}>
                      {app.finalStatus === 'Approved' ? getStatusIcon('Approved') :
                       app.finalStatus === 'Rejected' ? getStatusIcon('Rejected') :
                       app.finalStatus === 'Pending Principal Approval' && !['Pending CDC Review', 'Clarification Required by CDC', 'Rejected by CDC – Pending Principal Review'].includes(app.eligibilityStatus)
                         ? getStatusIcon('Pending Principal Approval')
                         : getStatusIcon(app.eligibilityStatus)}
                      {app.finalStatus === 'Approved' ? 'Approved' :
                       app.finalStatus === 'Rejected' ? 'Rejected' :
                       app.finalStatus === 'Pending Principal Approval' && !['Pending CDC Review', 'Clarification Required by CDC', 'Rejected by CDC – Pending Principal Review'].includes(app.eligibilityStatus)
                         ? 'Pending Principal Approval'
                         : app.eligibilityStatus}
                    </span>
                    {app.hasAcademicConflict && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-amber-50 text-amber-700 border-amber-200">
                        <AlertTriangle size={12} className="animate-bounce text-amber-500" />
                        Academic Conflict Detected
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-sm col-span-2">
                    <div>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Duration</p>
                      <p className="text-slate-700 font-medium">{app.internshipDetails?.totalDuration} Months</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Mode</p>
                      <p className="text-slate-700 font-medium">{app.internshipDetails?.mode}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">CDC Recommendation</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider mt-1 ${
                        app.cdcRecommendation === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        app.cdcRecommendation === 'Rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                        app.cdcRecommendation === 'Needs Clarification' || app.eligibilityStatus === 'Clarification Required by CDC' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {app.cdcRecommendation || 'Pending'}
                      </span>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Principal Decision</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider mt-1 ${
                        app.eligibilityStatus === 'Clarification Required by CDC' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        app.principalDecision === 'Approved' || app.finalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        app.principalDecision === 'Rejected' || app.finalStatus === 'Rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                        'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {app.eligibilityStatus === 'Clarification Required by CDC' ? 'Awaiting Student Response' : (app.principalDecision || 'Pending')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0">
                  {app.attachments?.offerLetter && (
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
                  {app.eligibilityStatus === 'Clarification Required by CDC' && (
                    <Link
                      to={`/student/applications?id=${app._id}`}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-500/15 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      Edit & Resubmit
                    </Link>
                  )}
                  <div className="text-right">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Submitted On</p>
                    <p className="text-slate-700 text-xs font-medium">{new Date(app.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              
              {app.hasAcademicConflict && app.conflictDetails && (
                <div className="mt-4 p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Academic Conflict: </span>
                    {app.conflictDetails}
                  </div>
                </div>
              )}

              {app.remarks && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 italic">
                  <span className="font-bold not-italic mr-2">Remarks:</span>
                  "{app.remarks}"
                </div>
              )}

              {app.eligibilityStatus === 'Clarification Required by CDC' && (
                <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200/60 rounded-xl text-amber-800 font-medium text-xs flex items-start gap-2.5">
                  <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-950">Clarification Notice:</span>
                    <p className="mt-0.5 leading-relaxed">CDC Department has requested clarification. Please meet the CDC office.</p>
                  </div>
                </div>
              )}

              {/* Timeline History */}
              {app.timeline && app.timeline.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100 space-y-4 text-left">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Application Progress Timeline</h4>
                  <div className="relative pl-6 border-l border-slate-200 space-y-4">
                    {app.timeline.map((event: any, idx: number) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[29px] top-1 w-2.5 h-2.5 bg-white border-2 border-[#78be21] rounded-full flex items-center justify-center">
                          <div className="w-1 h-1 bg-[#78be21] rounded-full"></div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <p className="text-xs font-bold text-slate-800">{event.status}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{new Date(event.timestamp).toLocaleString()}</p>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          By: <span className="font-semibold text-slate-700">{event.updatedBy}</span> ({event.role})
                        </p>
                        {event.remarks && (
                          <p className="text-xs text-slate-500 mt-1 italic pl-2 border-l-2 border-slate-200">
                            "{event.remarks}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
