import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ThemeToggle } from '../../components/ui/theme-toggle';
import './login.css';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors: Record<string, string> = {};
  if (touched.email && !email.trim()) errors.email = 'El email es requerido';
  if (touched.password && !password) errors.password = 'La contraseña es requerida';
  if (touched.email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Ingresá un email válido';
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (Object.keys(errors).length > 0) return;

    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Email o contraseña incorrectos');
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <div className="login-page" aria-label="Página de inicio de sesión">
      <ThemeToggle />
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-logo" aria-hidden="true">📚</div>
          <h1 className="login-title">EducandoW</h1>
          <p className="login-subtitle">Administración Pedagógica</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {/* Server error */}
          {error && (
            <div className="login-error" role="alert">
              <span aria-hidden="true">⚠️</span>
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => handleBlur('email')}
            error={errors.email}
            required
            autoFocus
            autoComplete="email"
          />

          <div className="login-password-wrapper">
            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              error={errors.password}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((p) => !p)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <Button type="submit" variant="primary" size="md" loading={isLoading} className="login-submit" disabled={isLoading}>
            {isLoading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>

        {/* Footer links */}
        <div className="login-footer">
          <p className="login-register">
            ¿No tenés cuenta? <Link to="/register">Registrate</Link>
          </p>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && <div className="login-loading-overlay" aria-hidden="true" />}
    </div>
  );
}
