import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Mail, AlertCircle, User as UserIcon, ChevronDown, GraduationCap, Shield, Building2 } from 'lucide-react';

type Role = 'student' | 'cdc' | 'principal';

const ROLE_OPTIONS: { value: Role; label: string; icon: React.ReactNode; emailPrefix: string; readOnly: boolean; placeholder: string }[] = [
  {
    value: 'student',
    label: 'Student',
    icon: <GraduationCap size={16} />,
    emailPrefix: '',
    readOnly: false,
    placeholder: 'rollnumber',
  },
  {
    value: 'cdc',
    label: 'CDC Faculty',
    icon: <Shield size={16} />,
    emailPrefix: 'cdc',
    readOnly: true,
    placeholder: 'cdc',
  },
  {
    value: 'principal',
    label: 'Principal',
    icon: <Building2 size={16} />,
    emailPrefix: 'principal',
    readOnly: true,
    placeholder: 'principal',
  },
];

// Defined OUTSIDE Login to prevent remount-on-render focus loss
function EmailSplitInput({
  prefix,
  setPrefix,
  readOnly,
  placeholder,
}: {
  prefix: string;
  setPrefix: (v: string) => void;
  readOnly: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex items-stretch border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#78be21]/25 focus-within:border-[#78be21] transition-all bg-slate-50">
      <div className="flex items-center pl-3 text-slate-400 shrink-0">
        <Mail size={17} />
      </div>
      <input
        type="text"
        required
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`flex-1 min-w-0 px-2 py-2.5 bg-transparent outline-none text-slate-900 text-sm ${readOnly ? 'cursor-default text-slate-500' : ''}`}
      />
      <div className="flex items-center pr-3 text-slate-400 text-sm font-medium select-none shrink-0">
        @hitam.org
      </div>
    </div>
  );
}

export default function Login() {
  const [view, setView] = useState<'login' | 'register' | 'forgot_email' | 'forgot_reset'>('login');
  const [role, setRole] = useState<Role>('student');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [emailPrefix, setEmailPrefix] = useState('');
  const [name, setName] = useState('');
  const [registerEmailPrefix, setRegisterEmailPrefix] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const selectedRole = ROLE_OPTIONS.find(r => r.value === role)!;

  const getFullEmail = (prefix: string) => `${prefix.toLowerCase().trim()}@hitam.org`;

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setRoleDropdownOpen(false);
    setError('');
    const option = ROLE_OPTIONS.find(o => o.value === r)!;
    if (option.readOnly) {
      setEmailPrefix(option.emailPrefix);
    } else {
      setEmailPrefix('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fullEmail = getFullEmail(selectedRole.readOnly ? selectedRole.emailPrefix : emailPrefix);

    try {
      const response = await axios.post('/api/auth/login', { email: fullEmail, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      const userRole = response.data.user.role;
      navigate(`/${userRole}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const emailStr = getFullEmail(registerEmailPrefix);
    const hitamEmailRegex = /^[a-z0-9]{10}@hitam\.org$/;
    if (!hitamEmailRegex.test(emailStr)) {
      setError('Invalid student email format. The roll number must consist of exactly 10 characters (can be numbers, letters, or alphanumeric) followed by @hitam.org.');
      setLoading(false);
      return;
    }

    if (emailStr === 'cdc@hitam.org' || emailStr === 'principal@hitam.org') {
      setError('Invalid email address for student registration.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      await axios.post('/api/auth/register', {
        name,
        email: emailStr,
        password,
        role: 'student'
      });

      const loginResponse = await axios.post('/api/auth/login', {
        email: emailStr,
        password
      });

      localStorage.setItem('token', loginResponse.data.token);
      localStorage.setItem('user', JSON.stringify(loginResponse.data.user));

      alert('Student registration successful!');
      navigate('/student');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const emailStr = resetEmail.toLowerCase().trim();
    const hitamEmailRegex = /^[a-z0-9]{10}@hitam\.org$/;
    if (!hitamEmailRegex.test(emailStr)) {
      setError('Invalid student email format. The roll number must consist of exactly 10 characters (can be numbers, letters, or alphanumeric) followed by @hitam.org.');
      setLoading(false);
      return;
    }

    try {
      await axios.post('/api/auth/forgot-password/verify', { email: emailStr });
      setView('forgot_reset');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification failed. Please check the email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      await axios.post('/api/auth/forgot-password/reset', {
        email: resetEmail.toLowerCase().trim(),
        newPassword
      });
      alert('Password reset successfully! You can now login with your new password.');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetEmail('');
      setView('login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-green-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="p-8 text-center bg-white text-slate-800 border-b border-slate-100">
            <img
              src="/HitamLogos.jpeg"
              alt="HITAM Logo"
              className="w-16 h-16 rounded-2xl mx-auto mb-4 object-cover shadow-md"
            />
            <h2 className="text-2xl font-bold text-slate-900">HITAM CDC Portal</h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">Internship Management System</p>
          </div>

          {/* Toggle Tab Bar */}
          {(view === 'login' || view === 'register') && (
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <button
                onClick={() => { setView('login'); setError(''); }}
                className={`flex-1 py-3 text-sm font-bold transition-all relative ${view === 'login' ? 'text-[#78be21]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Sign In
                {view === 'login' && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#78be21]" />
                )}
              </button>
              <button
                onClick={() => { setView('register'); setError(''); }}
                className={`flex-1 py-3 text-sm font-bold transition-all relative ${view === 'register' ? 'text-[#78be21]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Student Register
                {view === 'register' && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#78be21]" />
                )}
              </button>
            </div>
          )}

          <div className="p-8">
            {/* Error */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* ---- LOGIN FORM ---- */}
            {view === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Role Selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Login As</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setRoleDropdownOpen(prev => !prev)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium hover:border-[#78be21] transition-all"
                    >
                      <span className="flex items-center gap-2">
                        {selectedRole.icon}
                        {selectedRole.label}
                      </span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {roleDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleRoleSelect(opt.value)}
                              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${role === opt.value ? 'text-[#78be21] font-semibold bg-green-50' : 'text-slate-700'}`}
                            >
                              {opt.icon}
                              {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Email with @hitam.org suffix */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                  <EmailSplitInput
                    prefix={selectedRole.readOnly ? selectedRole.emailPrefix : emailPrefix}
                    setPrefix={setEmailPrefix}
                    readOnly={selectedRole.readOnly}
                    placeholder={selectedRole.placeholder}
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    Full address: <span className="font-medium text-slate-500">
                      {(selectedRole.readOnly ? selectedRole.emailPrefix : (emailPrefix || '......')) + '@hitam.org'}
                    </span>
                  </p>
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Password</label>
                    {role === 'student' && (
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setResetEmail(getFullEmail(emailPrefix));
                          setView('forgot_email');
                        }}
                        className="text-xs font-bold text-[#78be21] hover:text-[#68a61d] transition-colors"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-900"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#78be21] hover:bg-[#68a61d] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2 cursor-pointer"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            )}

            {/* ---- REGISTER FORM (Students Only) ---- */}
            {view === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-900"
                      placeholder="e.g. Inderjeet Karan Jaiswal"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Student Email Address</label>
                  <EmailSplitInput
                    prefix={registerEmailPrefix}
                    setPrefix={setRegisterEmailPrefix}
                    readOnly={false}
                    placeholder="rollnumber"
                  />
                  <p className="mt-1.5 text-xs text-[#78be21] font-semibold">
                    * Roll number must consist of exactly 10 characters (can be all numbers, alphabets, or alphanumeric).
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Full address: <span className="font-medium text-slate-500">
                      {(registerEmailPrefix || '......') + '@hitam.org'}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-900"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-900"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#78be21] hover:bg-[#68a61d] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2 cursor-pointer"
                >
                  {loading ? 'Registering...' : 'Register Account'}
                </button>
              </form>
            )}

            {/* ---- FORGOT PASSWORD STEP 1: VERIFY EMAIL ---- */}
            {view === 'forgot_email' && (
              <form onSubmit={handleVerifyEmail} className="space-y-5">
                <div className="text-center mb-2">
                  <h3 className="text-lg font-bold text-slate-900">Forgot Password</h3>
                  <p className="text-slate-500 text-sm mt-1">Enter your registered student email address to verify your account.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Student Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-900"
                      placeholder="rollnumber@hitam.org"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#78be21] hover:bg-[#68a61d] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2 cursor-pointer"
                >
                  {loading ? 'Verifying...' : 'Verify Email'}
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setError(''); setView('login'); }}
                    className="text-sm font-bold text-[#78be21] hover:text-[#68a61d] transition-colors"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* ---- FORGOT PASSWORD STEP 2: RESET ---- */}
            {view === 'forgot_reset' && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="text-center mb-2">
                  <h3 className="text-lg font-bold text-slate-900">Reset Password</h3>
                  <p className="text-slate-500 text-sm mt-1">Enter a new secure password for your account.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-900"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-slate-900"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#78be21] hover:bg-[#68a61d] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2 cursor-pointer"
                >
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setError(''); setView('login'); }}
                    className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-slate-500 text-xs leading-relaxed">
                Use your official HITAM email to login or register.<br />
                Contact CDC department if you face any issues.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
