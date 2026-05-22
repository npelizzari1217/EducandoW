import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TEACHER', institutionId: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    try { await register(form); setSuccess(true); }
    catch { setError('Error al registrar. Verificá los datos.'); }
  };

  if (success) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card title="¡Registro exitoso!" className="reg-card">
        <p className="text-muted">El usuario fue creado. Ya puede iniciar sesión.</p>
        <Link to="/login"><Button className="mt-lg w-full">Ir al login</Button></Link>
      </Card>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <Card title="Crear cuenta" className="reg-card">
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          {error && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>{error}</div>}
          <Input label="Nombre completo" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <Input label="Contraseña" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} />
          <div className="field"><label className="field-label">Rol</label><select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}><option value="TEACHER">Docente</option><option value="MANAGER">Directivo</option><option value="ADMIN">Administrador</option></select></div>
          <Input label="ID de Institución (opcional)" value={form.institutionId} onChange={e => setForm({...form, institutionId: e.target.value})} placeholder="UUID de la institución" />
          <Button type="submit" loading={isLoading} className="w-full">Crear cuenta</Button>
        </form>
        <p className="text-center text-sm text-muted mt-lg">¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link></p>
      </Card>
      <style>{`.reg-card { width: 100%; max-width: 440px; }`}</style>
    </div>
  );
}
