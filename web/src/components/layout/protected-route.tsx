import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';

interface Props { children: React.ReactNode; moduleCode?: string; action?: string; }

function hasModulePermission(
  userModules: { moduleCode: string; actions: string[] }[] | undefined,
  moduleCode: string,
  action: string,
): boolean {
  if (!userModules) return false;
  return userModules.some(
    (m) => m.moduleCode === moduleCode && m.actions.includes(action),
  );
}

export function ProtectedRoute({ children, moduleCode, action = 'READ' }: Props) {
  const { user, accessToken } = useAuth();
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  // ROOT bypasses all checks
  if (user.roles?.includes('ROOT')) return <>{children}</>;
  // Module-based check
  if (moduleCode && !hasModulePermission(user.modules, moduleCode, action)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
