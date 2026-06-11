import { useAuth } from '../context/auth-context';

// ── Shared permission hook ─────────────────────────────────
// Single source of truth for module-action checks.
// ROOT bypasses every check; non-ROOT must have the module with
// at least one of the requested actions.

export function useCan() {
  const { user } = useAuth();
  const isRoot = user?.roles?.includes('ROOT') ?? false;
  const can = (moduleCode: string, ...actions: string[]) =>
    isRoot || (user?.modules ?? []).some(
      (m) => m.moduleCode === moduleCode && actions.some((a) => m.actions.includes(a)),
    );
  return { can, isRoot };
}
