import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { Button } from '../ui/button';

export function ReloginModal() {
  const { user, sessionStatus, reauthenticate, logout } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset password field when modal opens
  useEffect(() => {
    if (sessionStatus === 'expired') {
      setPassword('');
      setError('');
    }
  }, [sessionStatus]);

  // Block ESC key while modal is open
  useEffect(() => {
    if (sessionStatus !== 'expired') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [sessionStatus]);

  const handleAccept = useCallback(async () => {
    if (!password.trim()) {
      setError('Ingresá tu contraseña');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await reauthenticate(password);
      // sessionStatus becomes 'active' → modal unmounts automatically
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Contraseña incorrecta';
      // Extract NestJS error message format
      const axiosMsg = (e as { response?: { data?: { error?: { message?: string }; message?: string } } })
        ?.response?.data?.error?.message
        ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(axiosMsg ?? msg);
    } finally {
      setLoading(false);
    }
  }, [password, reauthenticate]);

  const handleCancel = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  if (sessionStatus !== 'expired') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      // no onClick on backdrop — intentional lockout
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="relogin-title"
        style={{
          width: '90%',
          maxWidth: 420,
          background: 'var(--color-surface, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.25))',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div>
          <h2
            id="relogin-title"
            style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}
          >
            Sesión cerrada
          </h2>
          <p style={{ margin: 0, fontSize: 'var(--text-sm, 0.875rem)', color: 'var(--color-text-muted, #64748b)' }}>
            Tu sesión venció por inactividad. Volvé a ingresar para continuar.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="field">
            <label htmlFor="relogin-email" className="field-label" style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              Usuario
            </label>
            <input
              id="relogin-email"
              className="input"
              type="email"
              value={user?.email ?? ''}
              readOnly
              style={{
                width: '100%',
                background: 'var(--color-surface-alt, #f8fafc)',
                color: 'var(--color-text-muted, #64748b)',
                cursor: 'not-allowed',
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="relogin-password" className="field-label" style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              Contraseña
            </label>
            <input
              id="relogin-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleAccept(); }}
              autoFocus
              placeholder="Tu contraseña"
              style={{ width: '100%' }}
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                background: 'var(--color-danger-light, #fee2e2)',
                color: 'var(--color-danger, #dc2626)',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-md, 6px)',
                fontSize: 'var(--text-sm, 0.875rem)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="success-soft" onClick={handleAccept} loading={loading}>
            Ingresar
          </Button>
        </div>
      </div>
    </div>
  );
}
