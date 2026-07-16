import { useState, useEffect, Suspense } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, FilePlus, Users, ShieldCheck, User, FileText, MessageSquare } from 'lucide-react';
import axios from 'axios';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await axios.get('/api/messages/unread-count', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnreadCount(response.data.unreadCount || 0);
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img 
            src="/HitamLogos.jpeg" 
            alt="HITAM Logo" 
            className="w-10 h-10 rounded-lg object-cover shadow-sm" 
          />
          <div>
            <h1 className="text-slate-900 font-bold text-lg leading-tight">HITAM CDC</h1>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Internship Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-slate-900 font-semibold text-sm">{user?.name}</p>
            <p className="text-slate-500 text-xs capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="flex flex-1">
        <aside className="w-64 bg-white border-r border-slate-200 p-4 hidden md:block">
          <div className="space-y-1">
            {/* Common Menu Option: Messages & Queries */}
            {user?.role !== 'hod' && (
              <Link
                to="/messages"
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all font-medium text-sm ${
                  location.pathname === '/messages'
                    ? 'bg-slate-50 text-[#78be21] font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#78be21]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare size={18} />
                  <span>Messages & Queries</span>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-[#78be21] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )}

            {user?.role === 'hod' && (
              <Link
                to="/hod"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all font-medium text-sm ${
                  location.pathname === '/hod'
                    ? 'bg-slate-50 text-[#78be21] font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#78be21]'
                }`}
              >
                <Users size={18} />
                <span>HOD Dashboard</span>
              </Link>
            )}

            <div className="h-px bg-slate-100 my-3" />

            {user?.role === 'student' && (
              <>
                <Link
                  to="/student/register"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <User size={18} />
                  My Profile
                </Link>
                <Link
                  to="/student"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <LayoutDashboard size={18} />
                  Dashboard
                </Link>
                <Link
                  to="/student/applications"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <FilePlus size={18} />
                  Applications
                </Link>
                <Link
                  to="/student/reports"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <FileText size={18} />
                  Monthly Report
                </Link>
                <Link
                  to="/student/completion"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <ShieldCheck size={18} />
                  Internship Completion
                </Link>
              </>
            )}
            {user?.role === 'cdc' && (
              <>
                <Link
                  to="/cdc"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <Users size={18} />
                  Manage Applications
                </Link>
                <Link
                  to="/cdc/reports"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <FileText size={18} />
                  Monthly Reports
                </Link>
                <Link
                  to="/cdc/completions"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <ShieldCheck size={18} />
                  Completion Reports
                </Link>
              </>
            )}
            {user?.role === 'principal' && (
              <>
                <Link
                  to="/principal"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <ShieldCheck size={18} />
                  Final Approvals
                </Link>
                <Link
                  to="/principal/reports"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <FileText size={18} />
                  Monthly Reports
                </Link>
                <Link
                  to="/principal/completions"
                  className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-[#78be21] rounded-lg transition-all font-medium text-sm"
                >
                  <ShieldCheck size={18} />
                  Completion Reports
                </Link>
              </>
            )}

            {(user?.role === 'cdc' || user?.role === 'principal') && (
              <>
                <div className="h-px bg-slate-100 my-3" />
                <Link
                  to="/admin/control"
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all font-medium text-sm ${
                    location.pathname === '/admin/control'
                      ? 'bg-slate-50 text-[#78be21] font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#78be21]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={18} />
                    <span>Portal Control Center</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-[#78be21] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold text-slate-400">Loading module...</span>
              </div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
