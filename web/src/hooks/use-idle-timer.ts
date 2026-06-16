import { useEffect, useRef } from 'react';
import { useAuth } from '../context/auth-context';
import { useInstitution } from '../context/institution-context';
import { removeToken } from '../api/token';
import { sessionManager } from '../api/session-manager';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;
const THROTTLE_MS = 1000;

export function useIdleTimer(): void {
  const { accessToken, user, sessionStatus } = useAuth();
  const { config } = useInstitution();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Compute timeout in ms — default to 20 min if field absent
  const timeoutMs = ((config.session_timeout_minutes ?? 20) as number) * 60 * 1000;

  // Only active when session is live
  const isActive = !!(accessToken && user && sessionStatus === 'active');

  useEffect(() => {
    if (!isActive) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const fire = () => {
      removeToken(); // stop future requests from going out with a stale token
      sessionManager.requireRelogin().catch(() => {}); // ignore user-cancel errors
    };

    const reset = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(fire, timeoutMs);
    };

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < THROTTLE_MS) return;
      lastActivityRef.current = now;
      reset();
    };

    reset(); // start timer on mount / activation

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, handleActivity, { passive: true });
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, handleActivity);
      }
    };
  }, [isActive, timeoutMs]);
}
