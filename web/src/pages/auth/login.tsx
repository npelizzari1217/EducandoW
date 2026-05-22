import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    try { await login(email, password); navigate('/'); }
    catch { setError('Email o contraseña incorrectos'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <Card title="Iniciar sesión" className="login-card" actions={<span className="text-sm text-muted">EducandoW</span>}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          {error && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>{error}</div>}
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <Input label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" loading={isLoading} className="w-full">Ingresar</Button>
        </form>
        <p className="text-center text-sm text-muted mt-lg">
          ¿No tenés cuenta? <Link to="/register">Registrate</Link>
        </p>
      </Card>
      <style>{`.login-card { width: 100%; max-width: 400px; }`}</style>
    </div>
  );
}
