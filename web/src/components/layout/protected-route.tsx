import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { useCan } from '../../hooks/use-can';

interface Props { children: React.ReactNode; moduleCode?: string; action?: string; }

export function ProtectedRoute({ children, moduleCode, action = 'READ' }: Props) {
  const { user, accessToken } = useAuth();
  const { can } = useCan();
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  // can() already short-circuits for ROOT; module check is skipped when moduleCode is absent
  if (moduleCode && !can(moduleCode, action)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
