import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import Login from './pages/Login.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import Layout from './components/Layout.tsx';

const StudentDashboard = lazy(() => import('./pages/StudentDashboard.tsx'));
const CDCDashboard = lazy(() => import('./pages/CDCDashboard.tsx'));
const PrincipalDashboard = lazy(() => import('./pages/PrincipalDashboard.tsx'));
const InternshipForm = lazy(() => import('./pages/InternshipForm.tsx'));
const StudentRegistration = lazy(() => import('./pages/StudentRegistration.tsx'));
const MonthlyReports = lazy(() => import('./pages/MonthlyReports.tsx'));
const InternshipCompletion = lazy(() => import('./pages/InternshipCompletion.tsx'));
const CommunicationCenter = lazy(() => import('./pages/CommunicationCenter.tsx'));
const PortalControlCenter = lazy(() => import('./pages/PortalControlCenter.tsx'));

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute roles={['student', 'cdc', 'principal', 'hod', 'dean']} />}>
          <Route element={<Layout />}>
            <Route path="/messages" element={<CommunicationCenter />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['hod']} />}>
          <Route element={<Layout />}>
            <Route path="/hod" element={<CommunicationCenter />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['dean']} />}>
          <Route element={<Layout />}>
            <Route path="/dean" element={<CommunicationCenter />} />
          </Route>
        </Route>
        
        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route element={<Layout />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/register" element={<StudentRegistration />} />
            <Route path="/student/applications" element={<InternshipForm />} />
            <Route path="/student/reports" element={<MonthlyReports />} />
            <Route path="/student/completion" element={<InternshipCompletion />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['cdc']} />}>
          <Route element={<Layout />}>
            <Route path="/cdc" element={<CDCDashboard />} />
            <Route path="/cdc/reports" element={<MonthlyReports />} />
            <Route path="/cdc/completions" element={<InternshipCompletion />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['principal']} />}>
          <Route element={<Layout />}>
            <Route path="/principal" element={<PrincipalDashboard />} />
            <Route path="/principal/reports" element={<MonthlyReports />} />
            <Route path="/principal/completions" element={<InternshipCompletion />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['cdc', 'principal']} />}>
          <Route element={<Layout />}>
            <Route path="/admin/control" element={<PortalControlCenter />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
