import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.tsx';
import StudentDashboard from './pages/StudentDashboard.tsx';
import CDCDashboard from './pages/CDCDashboard.tsx';
import PrincipalDashboard from './pages/PrincipalDashboard.tsx';
import InternshipForm from './pages/InternshipForm.tsx';
import StudentRegistration from './pages/StudentRegistration.tsx';
import MonthlyReports from './pages/MonthlyReports.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import Layout from './components/Layout.tsx';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route element={<Layout />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/register" element={<StudentRegistration />} />
            <Route path="/student/apply" element={<InternshipForm />} />
            <Route path="/student/reports" element={<MonthlyReports />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['cdc']} />}>
          <Route element={<Layout />}>
            <Route path="/cdc" element={<CDCDashboard />} />
            <Route path="/cdc/reports" element={<MonthlyReports />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['principal']} />}>
          <Route element={<Layout />}>
            <Route path="/principal" element={<PrincipalDashboard />} />
            <Route path="/principal/reports" element={<MonthlyReports />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
