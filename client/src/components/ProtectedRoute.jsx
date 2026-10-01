import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="auth-loading">Restoring your session…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children || <Outlet />;
}
