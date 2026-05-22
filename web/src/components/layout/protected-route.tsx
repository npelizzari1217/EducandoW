import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';

interface Props { children: React.ReactNode; roles?: string[]; }

export function ProtectedRoute({ children, roles }: Props) {
  const { user, accessToken } = useAuth();
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
