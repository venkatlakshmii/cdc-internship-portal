import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import { Save, ArrowLeft, User as UserIcon, Phone, Mail, Info, Hash, GraduationCap, Calendar, Layers, Percent, ShieldCheck, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

export default function StudentRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    branch: '',
    year: '',
    section: '',
    attendancePercentage: '',
    cgpa: '',
    contactNumber: '',
    personalEmail: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data) {
          const user = response.data;
          setFormData({
            name: user.name || '',
            rollNumber: user.rollNumber || '',
            branch: user.branch || '',
            year: user.year || '',
            section: user.section || '',
            attendancePercentage: user.attendancePercentage !== undefined ? String(user.attendancePercentage) : '',
            cgpa: user.cgpa !== undefined ? String(user.cgpa) : '',
            contactNumber: user.contactNumber || '',
            personalEmail: user.personalEmail || '',
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const contactError = formData.contactNumber && !/^\d{10}$/.test(formData.contactNumber) ? 'Invalid phone number. Please enter only 10 digits.' : '';
  const attendanceError = Number(formData.attendancePercentage) > 100 ? 'Invalid Attendance Percentage' : '';
  const cgpaError = formData.cgpa && (Number(formData.cgpa) > 10 || Number(formData.cgpa) < 0) ? 'Invalid CGPA' : '';
  const rollNumberError = formData.rollNumber && !/^[0-9]{2}E51A[0-9A-Z]{4}$/i.test(formData.rollNumber) ? 'Invalid Roll Number format. (e.g. rollnumber)' : '';
  const isFormInvalid = !!contactError || !!attendanceError || !!cgpaError || !!rollNumberError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormInvalid) {
      alert('Please correct all validation errors before saving.');
      return;
    }
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/auth/profile', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Update local storage user state
      let localUser: any = {};
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser && storedUser !== 'undefined') {
          localUser = JSON.parse(storedUser);
        }
      } catch (e) {
        console.error('Failed to parse user in StudentRegistration', e);
      }
      localUser.profileRegistered = true;
      localUser.name = formData.name;
      localStorage.setItem('user', JSON.stringify(localUser));

      alert('Profile registered successfully!');
      navigate('/student');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      alert(err.response?.data?.message || 'Failed to register profile. Please check all fields.');
    } finally {
      setLoading(false);
    }
  };

  const getProfileCompletion = () => {
    const fields = Object.values(formData);
    const filled = fields.filter(val => val !== '').length;
    return Math.round((filled / fields.length) * 100);
  };

  if (initialLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading student profile...</div>;
  }

  const attendance = Number(formData.attendancePercentage);
  const completion = getProfileCompletion();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto pb-12 space-y-6"
    >
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/student')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors font-semibold text-xs mb-2"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Student Profile Registration</h2>
          <p className="text-slate-500 text-xs mt-0.5">Please fill in your correct details. This profile is locked during internship applications.</p>
        </div>

        {/* Profile Completion Indicator */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3 shrink-0 sm:w-64">
          <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 font-bold text-xs text-slate-700 shrink-0">
            {completion}%
            <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
              <circle cx="20" cy="20" r="18" fill="transparent" stroke="#f1f5f9" strokeWidth="2.5" />
              <circle cx="20" cy="20" r="18" fill="transparent" stroke="#78be21" strokeWidth="2.5" 
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - completion / 100)}`}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-slate-700 font-bold text-xs">Profile Status</p>
            <p className="text-slate-400 text-[10px] font-medium">
              {completion === 100 ? 'All fields completed!' : `${9 - Object.values(formData).filter(val => val !== '').length} fields remaining`}
            </p>
          </div>
        </div>
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
              <p className="text-slate-500 text-[11px] mt-0.5">Review SPF/CDC Band eligibility and submission lead times before registering</p>
            </div>
          </div>
          <div className="text-slate-400">
            {showGuidelines ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {showGuidelines && (
          <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Rules & Eligibility - Left Column */}
            <div className="lg:col-span-6 space-y-4">
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest mb-1">Internship Eligibility Rules</h4>
              
              {/* Semester-based Restriction Warning Box */}
              <div className="p-4 bg-amber-50 border border-amber-200/60 rounded-xl flex gap-3">
                <span className="text-lg shrink-0">⚠️</span>
                <div>
                  <span className="font-bold text-xs text-amber-800 uppercase tracking-wide block mb-1">In-House Restriction</span>
                  <p className="text-slate-700 text-xs leading-relaxed font-semibold">
                    Students from 2nd Year – 1st Semester to 3rd Year – 1st Semester are eligible only for In-House Internships (Live Projects).
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                <div>
                  <strong className="text-slate-800 font-bold block mb-1">1. General Eligibility</strong>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>1st Year students are not eligible for internship applications.</li>
                    <li>Students from 2nd Year – 1st Semester to 3rd Year – 1st Semester are eligible only for In-House Internships (Live Projects).</li>
                    <li>Students from 3rd Year – 2nd Semester and Final Year are eligible for internships subject to institutional approval.</li>
                  </ul>
                </div>

                <div>
                  <strong className="text-slate-800 font-bold block mb-1">2. Internship Duration Criteria</strong>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>2nd Year students are allowed internships only for a maximum duration of 4 weeks (28 days) and are eligible only for In-House internships.</li>
                    <li>Students from 3rd Year – 2nd Semester are eligible for a maximum duration of 3 months.</li>
                    <li>Students from 4th Year – 1st Semester onwards are eligible for internships up to 3 months, with an additional extension of 3 months permitted based on recommendations from the HOD and Mentors.</li>
                  </ul>
                </div>

                <div>
                  <strong className="text-slate-800 font-bold block mb-1">3. SPF & CDC Band Rules</strong>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Students with SPF and CDC Bands of A or B can directly apply to the CDC department.</li>
                    <li>Students with SPF or CDC Bands of C or D must obtain Mentor and HOD approval before applying to CDC.</li>
                  </ul>
                </div>
              </div>

              {/* Eligibility Matrix Table */}
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest pt-2 mb-1">Eligibility Matrix</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-3">SPF Band</th>
                      <th className="p-3">CDC Band</th>
                      <th className="p-3">Permissible Duration</th>
                      <th className="p-3">Conditions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3"><span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-bold">A / B</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-bold">A / B</span></td>
                      <td className="p-3">3 Months (Extendable to 6 Months for 4th Year)</td>
                      <td className="p-3 text-emerald-700 font-semibold">Direct apply to CDC</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3"><span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-bold">A / B</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md font-bold">C / D</span></td>
                      <td className="p-3">3 Months (Extendable to 6 Months for 4th Year)</td>
                      <td className="p-3 text-amber-700 font-semibold">Requires Mentor & HOD Approval</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3"><span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md font-bold">C / D</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-bold">A / B</span></td>
                      <td className="p-3">3 Months</td>
                      <td className="p-3 text-amber-700 font-semibold">Requires Mentor & HOD Approval</td>
                    </tr>
                    <tr className="bg-red-50/40 hover:bg-red-50/60">
                      <td className="p-3"><span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md font-bold">C / D</span></td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md font-bold">C / D</span></td>
                      <td className="p-3 text-red-600 font-bold">Not Eligible</td>
                      <td className="p-3 text-red-600 font-semibold">Restricted (except 2nd Yr Live Projects)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Guidelines - Right Column */}
            <div className="lg:col-span-6 space-y-4">
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest mb-1">Internship Guidelines</h4>

              {/* Timeline Rule Box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
                <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="font-bold text-xs text-blue-800 uppercase tracking-wide block mb-1">Important Timeline Rule</span>
                  <p className="text-slate-700 text-xs leading-relaxed font-semibold">
                    Internship applications must be submitted at least 15 days prior to the internship start date.
                  </p>
                </div>
              </div>

              <ol className="space-y-2.5 text-xs text-slate-600 leading-relaxed list-decimal pl-4 font-medium">
                <li>
                  Internship eligibility is determined based on academic semester, SPF Band, CDC Band, attendance, and academic performance.
                </li>
                <li>
                  1st Year students are not eligible for internship applications.
                </li>
                <li>
                  Students from 2nd Year – 1st Semester to 3rd Year – 1st Semester are eligible only for In-House Internships (Live Projects).
                </li>
                <li>
                  Students from 3rd Year – 2nd Semester are eligible for both In-House and External Internships for a maximum duration of 3 months.
                </li>
                <li>
                  Students from 4th Year – 1st Semester onwards are eligible for internships up to 3 months, with an additional extension of 3 months permitted based on recommendations from the HOD and Mentors.
                </li>
                <li>
                  2nd Year students may select critical subjects to attend during the semester while participating in internship programs.
                </li>
                <li>
                  Internship applications must be submitted at least 15 days prior to the internship start date.
                </li>
                <li>
                  Internship approvals are subject to CDC review, attendance policy, academic eligibility, and institutional guidelines.
                </li>
                <li>
                  Monthly reports are reviewed by CDC Faculty, while the final approval authority rests with the Principal.
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Main Form Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
          {/* Section 1: Academic Information */}
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-2 pb-2">
              <div className="p-2 bg-[#78be21]/10 text-[#78be21] rounded-xl shrink-0">
                <GraduationCap size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Academic Profile</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Your official college identification and records</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Student Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inderjeet Karan Jaiswal"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
              </div>

              {/* Roll Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Roll Number</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. rollnumber"
                    className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all text-slate-800 text-sm ${
                      rollNumberError 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500 bg-red-50/20' 
                        : 'border-slate-200 focus:ring-[#78be21]/20 focus:border-[#78be21]'
                    }`}
                    value={formData.rollNumber}
                    onChange={(e) => handleInputChange('rollNumber', e.target.value)}
                  />
                </div>
                {rollNumberError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-red-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider flex items-center gap-1"
                  >
                    <Info size={11} className="shrink-0" /> {rollNumberError}
                  </motion.p>
                )}
              </div>

              {/* Branch */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Branch</label>
                <div className="relative">
                  <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  <select
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm appearance-none cursor-pointer"
                    value={formData.branch}
                    onChange={(e) => handleInputChange('branch', e.target.value)}
                  >
                    <option value="">Select Branch</option>
                    <option value="CSE">CSE (Computer Science & Engineering)</option>
                    <option value="CSM">CSM (CSE - Artificial Intelligence & Machine Learning)</option>
                    <option value="ECE">ECE (Electronics & Communication Engineering)</option>
                    <option value="EEE">EEE (Electrical & Electronics Engineering)</option>
                    <option value="ME">ME (Mechanical Engineering)</option>
                    <option value="CE">CE (Civil Engineering)</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2 text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Year & Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Year & Semester</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    <select
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm appearance-none cursor-pointer"
                      value={formData.year}
                      onChange={(e) => handleInputChange('year', e.target.value)}
                    >
                      <option value="">Select Semester</option>
                      <option value="1st Year – 1st Sem">1st Year – 1st Sem</option>
                      <option value="1st Year – 2nd Sem">1st Year – 2nd Sem</option>
                      <option value="2nd Year – 1st Sem">2nd Year – 1st Sem</option>
                      <option value="2nd Year – 2nd Sem">2nd Year – 2nd Sem</option>
                      <option value="3rd Year – 1st Sem">3rd Year – 1st Sem</option>
                      <option value="3rd Year – 2nd Sem">3rd Year – 2nd Sem</option>
                      <option value="4th Year – 1st Sem">4th Year – 1st Sem</option>
                      <option value="4th Year – 2nd Sem">4th Year – 2nd Sem</option>
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2 text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Section</label>
                  <div className="relative">
                    <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. A"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                      value={formData.section}
                      onChange={(e) => handleInputChange('section', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Attendance Percentage */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Attendance Percentage</label>
                <div className="relative">
                  <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 85"
                    className={`w-full pl-10 pr-8 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all text-slate-800 text-sm ${
                      attendanceError 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500 bg-red-50/20' 
                        : 'border-slate-200 focus:ring-[#78be21]/20 focus:border-[#78be21]'
                    }`}
                    value={formData.attendancePercentage}
                    onChange={(e) => handleInputChange('attendancePercentage', e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
                {attendanceError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-red-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider flex items-center gap-1"
                  >
                    <Info size={11} className="shrink-0" /> {attendanceError}
                  </motion.p>
                )}
                {!attendanceError && attendance < 75 && formData.attendancePercentage !== '' && (
                  <p className="text-red-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Info size={11} className="shrink-0" /> Attendance below 75% will result in "Not Eligible" status.
                  </p>
                )}
              </div>

              {/* CGPA */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">CGPA</label>
                <div className="relative">
                  <Info className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    max="10"
                    placeholder="e.g. 8.50"
                    className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all text-slate-800 text-sm ${
                      cgpaError 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500 bg-red-50/20' 
                        : 'border-slate-200 focus:ring-[#78be21]/20 focus:border-[#78be21]'
                    }`}
                    value={formData.cgpa}
                    onChange={(e) => handleInputChange('cgpa', e.target.value)}
                  />
                </div>
                {cgpaError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-red-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider flex items-center gap-1"
                  >
                    <Info size={11} className="shrink-0" /> {cgpaError}
                  </motion.p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Contact Details */}
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-2 pb-2">
              <div className="p-2 bg-[#78be21]/10 text-[#78be21] rounded-xl shrink-0">
                <Phone size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Contact Information</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">How the CDC office and employers can contact you</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Contact Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Contact Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all text-slate-800 text-sm ${
                      contactError 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500 bg-red-50/20' 
                        : 'border-slate-200 focus:ring-[#78be21]/20 focus:border-[#78be21]'
                    }`}
                    value={formData.contactNumber}
                    onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                  />
                </div>
                {contactError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-red-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider flex items-center gap-1"
                  >
                    <Info size={11} className="shrink-0" /> {contactError}
                  </motion.p>
                )}
              </div>

              {/* Personal Email ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Personal Email ID</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    placeholder="e.g. inderjeet.jaiswal@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-800 text-sm"
                    value={formData.personalEmail}
                    onChange={(e) => handleInputChange('personalEmail', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions footer */}
          <div className="p-8 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <ShieldCheck size={16} className="text-[#78be21] shrink-0" />
              <span>Details are verified by the CDC department.</span>
            </div>
            
            <button
              type="submit"
              disabled={loading || isFormInvalid}
              className="w-full sm:w-auto px-8 py-3 bg-[#78be21] hover:bg-[#68a61d] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
            >
              <Save size={18} />
              {loading ? 'Saving Profile...' : 'Save Profile & Continue'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
