import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import { Save, ArrowLeft, Upload, Info, User, Hash, GraduationCap, Calendar, Layers, Percent, Phone, Mail, Building, Globe, MapPin, Coins, Briefcase, Clock, Monitor, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

export default function InternshipForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    studentDetails: {
      name: '',
      rollNumber: '',
      branch: '',
      year: '',
      section: '',
      attendancePercentage: '',
      cgpa: '',
      contactNumber: '',
      personalEmail: '',
    },
    internshipDetails: {
      companyName: '',
      website: '',
      obtainedThrough: '',
      fromDate: '',
      toDate: '',
      totalDuration: 0,
      mode: 'Offline',
      location: '',
      stipend: '',
      ppo: 'No',
      ctc: '',
    },
    spocDetails: {
      name: '',
      designation: '',
      email: '',
      phone: '',
    },
  });

  const [files, setFiles] = useState<{ [key: string]: File | File[] | null }>({
    offerLetter: null,
    joiningLetter: null,
    internshipProof: null,
  });

  const [showGuidelines, setShowGuidelines] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data) {
          const user = response.data;
          setFormData((prev: any) => ({
            ...prev,
            studentDetails: {
              name: user.name || '',
              rollNumber: user.rollNumber || '',
              branch: user.branch || '',
              year: user.year || '',
              section: user.section || '',
              attendancePercentage: user.attendancePercentage !== undefined ? String(user.attendancePercentage) : '',
              cgpa: user.cgpa !== undefined ? String(user.cgpa) : '',
              contactNumber: user.contactNumber || '',
              personalEmail: user.personalEmail || '',
            }
          }));
        }
      } catch (err) {
        console.error('Error fetching student profile:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData((prev: any) => {
      const updatedSection = {
        ...prev[section],
        [field]: value,
      };

      const updatedData = {
        ...prev,
        [section]: updatedSection,
      };

      // Auto calculate duration if dates change
      if (section === 'internshipDetails' && (field === 'fromDate' || field === 'toDate')) {
        const fromVal = field === 'fromDate' ? value : prev.internshipDetails.fromDate;
        const toVal = field === 'toDate' ? value : prev.internshipDetails.toDate;
        
        if (fromVal && toVal) {
          const from = new Date(fromVal);
          const to = new Date(toVal);
          if (to > from) {
            const diffTime = Math.abs(to.getTime() - from.getTime());
            const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
            updatedData.internshipDetails = {
              ...updatedData.internshipDetails,
              totalDuration: diffMonths,
            };
          }
        }
      }

      return updatedData;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (e.target.files) {
      if (field === 'internshipProof') {
        setFiles((prev) => ({ ...prev, [field]: Array.from(e.target.files!) }));
      } else {
        setFiles((prev) => ({ ...prev, [field]: e.target.files![0] }));
      }
    }
  };

  const getDurationErrors = () => {
    const fromVal = formData.internshipDetails.fromDate;
    const toVal = formData.internshipDetails.toDate;
    if (!fromVal || !toVal) return '';

    const from = new Date(fromVal);
    const to = new Date(toVal);
    if (to <= from) return 'To Date must be after From Date';

    const diffTime = Math.abs(to.getTime() - from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));

    if (diffMonths > 6) {
      return 'Internships with a duration of more than 6 months are not accepted.';
    }

    const is2ndYear = formData.studentDetails.year === '2nd' || (formData.studentDetails.year && formData.studentDetails.year.includes('2nd'));
    if (is2ndYear) {
      if (diffDays > 28) {
        return 'Students from 2nd Year are allowed internships only for a maximum duration of 4 weeks (28 days).';
      }
      if (formData.internshipDetails.mode !== 'In-House') {
        return 'Students from 2nd Year are eligible only for In-House internships.';
      }
    }

    return '';
  };

  const durationError = getDurationErrors();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (durationError) {
      alert(durationError);
      return;
    }
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const data = new FormData();
      
      // Ensure all numbers are correctly typed
      const submissionData = {
        ...formData,
        studentDetails: {
          ...formData.studentDetails,
          attendancePercentage: Number(formData.studentDetails.attendancePercentage),
          cgpa: formData.studentDetails.cgpa ? Number(formData.studentDetails.cgpa) : undefined
        },
        internshipDetails: {
          ...formData.internshipDetails,
          totalDuration: Number(formData.internshipDetails.totalDuration)
        }
      };

      data.append('data', JSON.stringify(submissionData));
      
      if (files.offerLetter) data.append('offerLetter', files.offerLetter as File);
      if (files.joiningLetter) data.append('joiningLetter', files.joiningLetter as File);
      if (files.internshipProof) {
        (files.internshipProof as File[]).forEach((file) => {
          data.append('internshipProof', file);
        });
      }

      await axios.post('/api/internships/submit', data, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });

      navigate('/student');
    } catch (err: any) {
      console.error('Error submitting form:', err);
      alert(err.response?.data?.message || 'Failed to submit application. Please check all fields and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto pb-12 space-y-6"
    >
      {/* Top Header Section */}
      <div>
        <button
          onClick={() => navigate('/student')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors font-semibold text-xs mb-2 cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </button>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Internship Application Form</h2>
        <p className="text-slate-500 text-xs mt-0.5">Provide accurate details for CDC review and eligibility check.</p>
      </div>

      {/* Internship Guidelines & Eligibility Criteria Accordion */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
        <button
          type="button"
          onClick={() => setShowGuidelines(!showGuidelines)}
          className="w-full flex items-center justify-between p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#78be21]/10 text-[#78be21] rounded-xl animate-pulse">
              <Info size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Internship Guidelines & Eligibility Criteria</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">Review SPF/CDC Band eligibility and submission lead times before applying</p>
            </div>
          </div>
          <div className="text-slate-400">
            {showGuidelines ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {showGuidelines && (
          <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Guidelines - Left Column */}
            <div className="lg:col-span-6 space-y-4">
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest mb-2">Key Guidelines</h4>
              
              {/* Point 7 Highlight Alert */}
              <div className="p-4 bg-[#78be21]/10 border border-[#78be21]/20 rounded-xl flex gap-3">
                <AlertCircle className="text-[#78be21] shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="font-bold text-xs text-[#68a61d] uppercase tracking-wide block mb-1">Important Rule (Point 7)</span>
                  <p className="text-slate-700 text-xs leading-relaxed font-semibold">
                    All internship applications must be submitted <strong className="text-[#68a61d] underline decoration-wavy decoration-[#78be21] underline-offset-4">15 days prior</strong> to the start of the internship program to the CDC Internship Coordinator.
                  </p>
                </div>
              </div>

              <ol className="space-y-2.5 text-xs text-slate-600 leading-relaxed list-decimal pl-4">
                <li>
                  <strong>SPF Band:</strong> Derived from academic performance classification as per SPF guidelines.
                </li>
                <li>
                  <strong>CDC Band:</strong> Assigned based on participation in CDC training programs and assessment scores.
                </li>
                <li>
                  <strong>Eligibility:</strong> Students from 2nd year to final year are eligible based on the band matrix.
                  <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200/60 rounded-xl text-amber-800 font-medium">
                    ⚠️ <strong>2nd Year Student Restriction:</strong> Students from 2nd Year are allowed internships only for a maximum duration of 4 weeks (28 days) and are eligible only for In-House internships.
                  </div>
                </li>
                <li>
                  <strong>Relevance:</strong> Internships must align with student's career aspirations and professional goals.
                </li>
                <li>
                  <strong>Duration & Extensions:</strong> Initial approval is for 3 months max. Extensions require good performance and:
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Classes must be attended on Saturdays for 5-day working internships.</li>
                    <li>Submission of monthly progress reports to the HOD on the last Saturday of each month.</li>
                  </ul>
                </li>
                <li>
                  <strong>Attendance:</strong> Awarded as per the official HITAM attendance policy.
                </li>
              </ol>
            </div>

            {/* Eligibility Table - Right Column */}
            <div className="lg:col-span-6 space-y-3">
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest mb-2">Eligibility Matrix (SPF vs CDC Bands)</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-3">S.No.</th>
                      <th className="p-3">SPF Band</th>
                      <th className="p-3">CDC Band</th>
                      <th className="p-3">Permissible Duration</th>
                      <th className="p-3">Conditions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-400">1</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-bold">A</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-bold">A</span></td>
                      <td className="p-3 font-medium">3 Months + 3 Months Extension</td>
                      <td className="p-3 text-slate-400 text-[10px]">-</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-400">2</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold">A / B</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold">B / A</span></td>
                      <td className="p-3 font-medium">3 Months + 3 Months Extension</td>
                      <td className="p-3 text-slate-400 text-[10px]">-</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-400">3</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-bold">A</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md font-bold">C / D</span></td>
                      <td className="p-3 font-medium">3 Months + 3 Months Extension</td>
                      <td className="p-3 text-slate-400 text-[10px]">-</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-400">4</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-md font-bold">B</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-md font-bold">B</span></td>
                      <td className="p-3 font-medium">3 Months + 3 Months Extension</td>
                      <td className="p-3 text-slate-400 text-[10px]">-</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-400">5</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-md font-bold">B</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md font-bold">C / D</span></td>
                      <td className="p-3 font-medium">3 Months + 3 Months Extension</td>
                      <td className="p-3 text-slate-400 text-[10px]">-</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-400">6</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md font-bold">C / D</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold">A / B</span></td>
                      <td className="p-3 font-medium text-amber-700">3 Months</td>
                      <td className="p-3 text-amber-700 font-medium text-[10px]">To be endorsed by the Dept</td>
                    </tr>
                    <tr className="bg-red-50/40 hover:bg-red-50/60">
                      <td className="p-3 font-medium text-slate-400">7</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md font-bold">C / D</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md font-bold">C / D</span></td>
                      <td className="p-3 text-red-600 font-bold">Not Eligible</td>
                      <td className="p-3 text-red-600 font-medium text-[10px]">Restricted</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
          
          {/* Section A: Registered Student Profile */}
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#78be21]/15 text-[#78be21] rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                  A
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Student Profile Information</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">Verified personal and academic details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/student/register')}
                className="text-xs font-bold text-[#78be21] hover:text-[#68a61d] transition-colors border border-[#78be21]/20 hover:border-[#78be21] px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 cursor-pointer"
              >
                Edit Profile
              </button>
            </div>
            
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div className="flex gap-2.5">
                <User size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Full Name</p>
                  <p className="text-slate-800 font-bold">{formData.studentDetails.name || 'Not Provided'}</p>
                </div>
              </div>
              
              <div className="flex gap-2.5">
                <Hash size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Roll Number</p>
                  <p className="text-slate-800 font-bold">{formData.studentDetails.rollNumber || 'Not Provided'}</p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <GraduationCap size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Branch</p>
                  <p className="text-slate-800 font-semibold">{formData.studentDetails.branch || 'Not Provided'}</p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <Calendar size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Year & Section</p>
                  <p className="text-slate-800 font-semibold">
                    {formData.studentDetails.year ? (formData.studentDetails.year.includes('Year') ? formData.studentDetails.year : `${formData.studentDetails.year} Year`) : ''} 
                    {formData.studentDetails.section ? ` - Sec ${formData.studentDetails.section}` : 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <Percent size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Attendance</p>
                  <p className={`font-bold ${Number(formData.studentDetails.attendancePercentage) < 75 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {formData.studentDetails.attendancePercentage ? `${formData.studentDetails.attendancePercentage}%` : 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">CGPA</p>
                  <p className="text-slate-800 font-bold">
                    {formData.studentDetails.cgpa ? Number(formData.studentDetails.cgpa).toFixed(2) : 'Not Provided'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <Phone size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Contact Number</p>
                  <p className="text-slate-800 font-semibold">{formData.studentDetails.contactNumber || 'Not Provided'}</p>
                </div>
              </div>

              <div className="flex gap-2.5 sm:col-span-2">
                <Mail size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Personal Email ID</p>
                  <p className="text-slate-800 font-semibold truncate">{formData.studentDetails.personalEmail || 'Not Provided'}</p>
                </div>
              </div>
            </div>
            
            {Number(formData.studentDetails.attendancePercentage) < 75 && formData.studentDetails.attendancePercentage !== '' && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-600 text-xs font-semibold"
              >
                <Info size={16} className="shrink-0 mt-0.5" />
                <p>WARNING: Your registered attendance is below 75%. This application will be marked as "Not Eligible" upon submission.</p>
              </motion.div>
            )}
          </div>

          {/* Section B: Internship Details */}
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#78be21]/15 text-[#78be21] rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                B
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Internship Details</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Information about the company and internship terms</p>
              </div>
            </div>

            {/* Eligibility Note Banner */}
            <div className="p-4 bg-blue-50/80 border border-blue-100 rounded-xl flex items-start gap-3 text-blue-700 text-xs font-semibold">
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-900">Important Eligibility Note:</p>
                <p className="mt-0.5">Students from 2nd Year are allowed internships only for a maximum duration of 4 weeks and are eligible only for In-House internships.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Company Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Company Name</label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google India"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.internshipDetails.companyName}
                    onChange={(e) => handleInputChange('internshipDetails', 'companyName', e.target.value)}
                  />
                </div>
              </div>

              {/* Company Website */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Company Website</label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="url"
                    placeholder="https://example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.internshipDetails.website}
                    onChange={(e) => handleInputChange('internshipDetails', 'website', e.target.value)}
                  />
                </div>
              </div>

              {/* Obtained Through */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Obtained Through</label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  <select
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm appearance-none cursor-pointer"
                    value={formData.internshipDetails.obtainedThrough}
                    onChange={(e) => handleInputChange('internshipDetails', 'obtainedThrough', e.target.value)}
                  >
                    <option value="">Select Option</option>
                    <option value="CDC Portal">CDC Portal</option>
                    <option value="Direct Application">Direct Application</option>
                    <option value="Referral">Referral</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2 text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">From Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.internshipDetails.fromDate}
                    onChange={(e) => handleInputChange('internshipDetails', 'fromDate', e.target.value)}
                  />
                </div>
              </div>

              {/* To Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">To Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.internshipDetails.toDate}
                    onChange={(e) => handleInputChange('internshipDetails', 'toDate', e.target.value)}
                  />
                </div>
              </div>

              {/* Total Duration */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Total Duration (Months)</label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="number"
                    readOnly
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 font-bold text-sm cursor-not-allowed"
                    value={formData.internshipDetails.totalDuration}
                  />
                </div>
              </div>

              {durationError && (
                <div className="md:col-span-2 p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-600 text-xs font-semibold">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <p>{durationError}</p>
                </div>
              )}

              {/* Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Mode</label>
                <div className="relative">
                  <Monitor className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  <select
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm appearance-none cursor-pointer"
                    value={formData.internshipDetails.mode}
                    onChange={(e) => handleInputChange('internshipDetails', 'mode', e.target.value)}
                  >
                    <option value="Offline">Offline</option>
                    <option value="Online">Online</option>
                    <option value="In-House">In-House</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2 text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Location & Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Location & Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-4 text-slate-400" size={16} />
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Gachibowli, Hyderabad"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.internshipDetails.location}
                    onChange={(e) => handleInputChange('internshipDetails', 'location', e.target.value)}
                  />
                </div>
              </div>

              {/* Stipend */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Stipend (per month)</label>
                <div className="relative">
                  <Coins className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="e.g. 15000 or Unpaid"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.internshipDetails.stipend}
                    onChange={(e) => handleInputChange('internshipDetails', 'stipend', e.target.value)}
                  />
                </div>
              </div>

              {/* PPO Offered & CTC */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">PPO Offered?</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <select
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm appearance-none cursor-pointer"
                      value={formData.internshipDetails.ppo}
                      onChange={(e) => handleInputChange('internshipDetails', 'ppo', e.target.value)}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2 text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                {formData.internshipDetails.ppo === 'Yes' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">CTC (LPA)</label>
                    <div className="relative">
                      <Coins className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        required
                        placeholder="e.g. 6.5"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                        value={formData.internshipDetails.ctc}
                        onChange={(e) => handleInputChange('internshipDetails', 'ctc', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section C: SPOC Details */}
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#78be21]/15 text-[#78be21] rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                C
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">SPOC Details (Company Point of Contact)</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Contact details for verification purpose</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* SPOC Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">SPOC Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.spocDetails.name}
                    onChange={(e) => handleInputChange('spocDetails', 'name', e.target.value)}
                  />
                </div>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Designation</label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. HR Manager"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.spocDetails.designation}
                    onChange={(e) => handleInputChange('spocDetails', 'designation', e.target.value)}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    placeholder="e.g. hr@company.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.spocDetails.email}
                    onChange={(e) => handleInputChange('spocDetails', 'email', e.target.value)}
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.spocDetails.phone}
                    onChange={(e) => handleInputChange('spocDetails', 'phone', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section D: Attachments */}
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#78be21]/15 text-[#78be21] rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                D
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Attachments</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Upload required verification documents</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Offer Letter */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Offer Letter (PDF)</label>
                <div className="relative group">
                  <input
                    type="file"
                    accept=".pdf"
                    required
                    onChange={(e) => handleFileChange(e, 'offerLetter')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-slate-50/50 group-hover:border-[#78be21] group-hover:bg-[#78be21]/5 transition-all">
                    <Upload className="text-slate-400 group-hover:text-[#78be21] transition-colors" size={20} />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-[#78be21] text-center transition-colors">
                      {files.offerLetter ? (files.offerLetter as File).name : 'Click to upload PDF'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Joining Letter */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Joining Letter (PDF)</label>
                <div className="relative group">
                  <input
                    type="file"
                    accept=".pdf"
                    required
                    onChange={(e) => handleFileChange(e, 'joiningLetter')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-slate-50/50 group-hover:border-[#78be21] group-hover:bg-[#78be21]/5 transition-all">
                    <Upload className="text-slate-400 group-hover:text-[#78be21] transition-colors" size={20} />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-[#78be21] text-center transition-colors">
                      {files.joiningLetter ? (files.joiningLetter as File).name : 'Click to upload PDF'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Internship Proof */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Internship Proof (Multiple Files - PDF/JPG/PNG)</label>
                <div className="relative group">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange(e, 'internshipProof')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 bg-slate-50/50 group-hover:border-[#78be21] group-hover:bg-[#78be21]/5 transition-all">
                    <Upload className="text-slate-400 group-hover:text-[#78be21] transition-colors" size={24} />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-[#78be21] text-center transition-colors">
                      {files.internshipProof ? `${(files.internshipProof as File[]).length} files selected` : 'Click to upload multiple proof documents'}
                    </span>
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">Allowed: PDF, JPG, PNG</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions footer */}
          <div className="p-8 bg-slate-50/50 flex justify-end border-t border-slate-100">
            <button
              type="submit"
              disabled={loading || !!durationError}
              className="w-full sm:w-auto px-8 py-3 bg-[#78be21] hover:bg-[#68a61d] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
            >
              <Save size={18} />
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
