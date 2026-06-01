import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';

interface CourseSection {
  [key: string]: unknown;
  id: string;
  name: string;
  grade: string | null;
  division: string | null;
  level: string;
  academicYear: string;
}

interface Cycle {
  id: string;
  name: string;
  level: number;
  modality: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Inicial', 2: 'Primario', 3: 'Secundario', 4: 'Terciario', 9: 'Administración',
};

const LEVEL_OPTIONS = [
  { value: '1', label: 'Inicial', code: 'INICIAL' },
  { value: '2', label: 'Primario', code: 'PRIMARIO' },
  { value: '3', label: 'Secundario', code: 'SECUNDARIO' },
  { value: '4', label: 'Terciario', code: 'TERCIARIO' },
];

export default function CourseSectionsPage() {
  const { user } = useAuth();
  const { config } = useInstitution();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [levelEditable, setLevelEditable] = useState(false);

  const { data, loading, reload } = useApiList<CourseSection>('/course-sections');
  const { deleting, del } = useApiDelete('/course-sections');
  const { creating, createError, create } = useApiCreate('/course-sections');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ grade: '', division: '', level: '' });

  // Determinar si el nivel es fijo o seleccionable
  const userLevel = user?.userLevels?.[0]?.level;
  useEffect(() => {
    if (userLevel && userLevel >= 1 && userLevel <= 4) {
      // Nivel específico — readonly
      setForm((f) => ({ ...f, level: LEVEL_OPTIONS.find((o) => o.value === String(userLevel))?.value || '' }));
      setLevelEditable(false);
    } else {
      // ADMINISTRACION=9 o sin nivel — dropdown
      setLevelEditable(true);
    }
  }, [userLevel]);

  // Cargar ciclo lectivo activo
  useEffect(() => {
    const fetchCycle = async () => {
      try {
        const levelParam = userLevel && userLevel >= 1 && userLevel <= 4 ? `?level=${userLevel}` : '';
        const res = await apiClient.get(`/academic-cycles${levelParam}`);
        const cycles = res.data?.data ?? [];
        if (cycles.length > 0) {
          setCycle(cycles[0]);
        }
      } catch {
        // sin ciclo activo — se usará solo el año
      }
    };
    fetchCycle();
  }, [userLevel]);

  const resetForm = () => {
    const defaultLevel = userLevel && userLevel >= 1 && userLevel <= 4
      ? LEVEL_OPTIONS.find((o) => o.value === String(userLevel))?.value || ''
      : '';
    setForm({ grade: '', division: '', level: defaultLevel });
    setShowForm(false);
  };

  const handleCreate = async () => {
    const selectedOpt = LEVEL_OPTIONS.find((o) => o.value === form.level);
    const body: Record<string, unknown> = {
      grade: form.grade || undefined,
      division: form.division || undefined,
      level: selectedOpt?.code || form.level || 'PRIMARIO',
      academicYear: cycle ? String(new Date(cycle.startDate).getFullYear()) : String(new Date().getFullYear()),
    };
    const ok = await create(body);
    if (ok) { resetForm(); reload(); }
  };

  const currentYear = cycle ? String(new Date(cycle.startDate).getFullYear()) : String(new Date().getFullYear());

  return (
    <div>
      <PremiumHeader
        title="Cursos"
        subtitle="Secciones y divisiones — campos contextuales automáticos"
        icon="📋"
        stats={[{ label: 'cursos', value: String(data.length) }]}
      >
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? 'Cancelar' : 'Nuevo curso'}
        </Button>
      </PremiumHeader>

      {showForm && (
        <Card title="Nuevo curso" className="mt-md">
          {createError && (
            <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              {createError}
            </div>
          )}

          {/* Info contextual (readonly) */}
          <div style={{ background: 'var(--color-surface-alt, #f8f9fa)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Institución: </span>
                <strong>{config.name || user?.institutionId || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Ciclo lectivo: </span>
                <strong>{cycle ? `${cycle.name} (${currentYear})` : currentYear}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Nivel: </span>
                <strong>{LEVEL_LABELS[parseInt(form.level)] || '—'}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-md">
            {/* Grado + División */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input
                label="Grado / Año"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="5to, 3ro, 1er año..."
                required
              />
              <Input
                label="División (opcional)"
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
                placeholder="A, B, C..."
              />
            </div>

            {/* Nivel — readonly o dropdown */}
            {levelEditable ? (
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
                  Nivel educativo
                </label>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}
                >
                  <option value="">Seleccionar nivel</option>
                  {LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" value={form.level} />
            )}

            <Button variant="success-soft" onClick={handleCreate} loading={creating}>
              Crear curso
            </Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'name', header: 'Nombre' },
            { key: 'level', header: 'Nivel' },
            { key: 'academicYear', header: 'Año' },
            {
              key: 'actions', header: '',
              render: (row: Record<string, unknown>) => (
                <Button variant="danger-soft" size="sm" onClick={() => del(row.id as string).then(() => reload())} loading={deleting}>
                  Eliminar
                </Button>
              ),
            },
          ]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay cursos'}
        />
      </Card>
    </div>
  );
}
