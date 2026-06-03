import { useState, useEffect } from 'react';
import type { CreateCourseCycleDto, UpdateCourseCycleDto, CourseCycle } from '../../types/course-cycle';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import apiClient from '../../api/client';

interface CourseCycleFormProps {
  initial?: CourseCycle | null;
  onSubmit: (data: CreateCourseCycleDto | UpdateCourseCycleDto) => Promise<boolean>;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
}

interface SelectOption {
  id: string;
  name: string;
}

const LEVEL_OPTIONS = ['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO'];
const LEVEL_NUM_TO_LABEL: Record<number, string> = {
  10: 'INICIAL', 11: 'INICIAL', 12: 'INICIAL',
  20: 'PRIMARIO', 21: 'PRIMARIO', 22: 'PRIMARIO',
  30: 'SECUNDARIO', 31: 'SECUNDARIO', 32: 'SECUNDARIO',
  40: 'TERCIARIO',
};

const selectStyle: React.CSSProperties = {
  padding: '0.5rem', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', color: 'var(--color-text)',
  fontSize: 'var(--text-sm)', width: '100%',
};

export default function CourseCycleForm({ initial, onSubmit, onCancel, loading, error }: CourseCycleFormProps) {
  const isEdit = !!initial;

  const [courses, setCourses] = useState<SelectOption[]>([]);
  const [plans, setPlans] = useState<SelectOption[]>([]);
  const [cycles, setCycles] = useState<SelectOption[]>([]);

  const bimDates = initial?.ownBimonthDates;

  const [form, setForm] = useState({
    courseId: initial?.courseId ?? '',
    studyPlanId: initial?.studyPlanId ?? '',
    cycleId: initial?.cycleId ?? '',
    courseName: initial?.courseName ?? '',
    level: initial?.level ? (LEVEL_NUM_TO_LABEL[initial.level] ?? 'PRIMARIO') : 'PRIMARIO',
    passingGrade: initial?.passingGrade ?? 6,
    active: initial?.active ?? true,
    promotionText: initial?.promotionText ?? '',
    firstBimonthStart: bimDates?.firstBimonthStart?.split('T')[0] ?? '',
    firstBimonthEnd: bimDates?.firstBimonthEnd?.split('T')[0] ?? '',
    secondBimonthStart: bimDates?.secondBimonthStart?.split('T')[0] ?? '',
    secondBimonthEnd: bimDates?.secondBimonthEnd?.split('T')[0] ?? '',
    thirdBimonthStart: bimDates?.thirdBimonthStart?.split('T')[0] ?? '',
    thirdBimonthEnd: bimDates?.thirdBimonthEnd?.split('T')[0] ?? '',
    fourthBimonthStart: bimDates?.fourthBimonthStart?.split('T')[0] ?? '',
    fourthBimonthEnd: bimDates?.fourthBimonthEnd?.split('T')[0] ?? '',
  });

  useEffect(() => {
    apiClient.get('/course-sections?limit=100').then((r) => setCourses(r.data?.data ?? []));
    apiClient.get('/study-plans?limit=100').then((r) => setPlans(r.data?.data ?? []));
    apiClient.get('/academic-cycles?limit=100').then((r) => setCycles(r.data?.data ?? []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      const data: UpdateCourseCycleDto = {
        courseName: form.courseName,
        passingGrade: form.passingGrade,
        active: form.active,
        promotionText: form.promotionText || null,
        firstBimonthStart: form.firstBimonthStart,
        firstBimonthEnd: form.firstBimonthEnd,
        secondBimonthStart: form.secondBimonthStart,
        secondBimonthEnd: form.secondBimonthEnd,
        thirdBimonthStart: form.thirdBimonthStart,
        thirdBimonthEnd: form.thirdBimonthEnd,
        fourthBimonthStart: form.fourthBimonthStart,
        fourthBimonthEnd: form.fourthBimonthEnd,
      };
      await onSubmit(data);
    } else {
      const data: CreateCourseCycleDto = {
        courseId: form.courseId,
        studyPlanId: form.studyPlanId,
        cycleId: form.cycleId,
        courseName: form.courseName,
        level: form.level,
        passingGrade: form.passingGrade,
        promotionText: form.promotionText || null,
        firstBimonthStart: form.firstBimonthStart,
        firstBimonthEnd: form.firstBimonthEnd,
        secondBimonthStart: form.secondBimonthStart,
        secondBimonthEnd: form.secondBimonthEnd,
        thirdBimonthStart: form.thirdBimonthStart,
        thirdBimonthEnd: form.thirdBimonthEnd,
        fourthBimonthStart: form.fourthBimonthStart,
        fourthBimonthEnd: form.fourthBimonthEnd,
      };
      await onSubmit(data);
    }
  };

  const update = (field: string, value: string | number | boolean) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <Card title={isEdit ? 'Editar curso por ciclo' : 'Nuevo curso por ciclo'}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          {!isEdit && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Curso</label>
                <select value={form.courseId} onChange={(e) => update('courseId', e.target.value)} style={selectStyle} required>
                  <option value="">Seleccionar...</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Plan de Estudio</label>
                <select value={form.studyPlanId} onChange={(e) => update('studyPlanId', e.target.value)} style={selectStyle} required>
                  <option value="">Seleccionar...</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Ciclo Lectivo</label>
                <select value={form.cycleId} onChange={(e) => update('cycleId', e.target.value)} style={selectStyle} required>
                  <option value="">Seleccionar...</option>
                  {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isEdit ? '1fr 1fr' : '1fr 1fr', gap: 'var(--space-md)' }}>
            <Input label="Nombre del Curso" value={form.courseName} onChange={(e) => update('courseName', e.target.value.toUpperCase())} required />
            {!isEdit ? (
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nivel</label>
                <select value={form.level} onChange={(e) => update('level', e.target.value)} style={selectStyle} required>
                  {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            ) : (
              <Input label="Nota de Aprobación (1-10)" type="number" min={1} max={10} step={0.5} value={String(form.passingGrade)} onChange={(e) => update('passingGrade', parseFloat(e.target.value))} required />
            )}
          </div>

          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)}
                style={{ width: '1rem', height: '1rem', accentColor: 'var(--color-primary, #16a34a)' }} />
              Activo
            </label>
          )}

          {!isEdit && (
            <Input label="Nota de Aprobación (1-10)" type="number" min={1} max={10} step={0.5} value={String(form.passingGrade)} onChange={(e) => update('passingGrade', parseFloat(e.target.value))} required />
          )}

          <Input label="Texto de Promoción" value={form.promotionText} onChange={(e) => update('promotionText', e.target.value)} />

          {(['first', 'second', 'third', 'fourth'] as const).map((bim, i) => {
            const label = ['Primer', 'Segundo', 'Tercer', 'Cuarto'][i];
            return (
            <div key={bim} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)' }}>
              <Input label={`${label} Bimestre Inicio`} type="date" value={(form as any)[`${bim}BimonthStart`]} onChange={(e) => update(`${bim}BimonthStart`, e.target.value)} />
              <Input label={`${label} Bimestre Fin`} type="date" value={(form as any)[`${bim}BimonthEnd`]} onChange={(e) => update(`${bim}BimonthEnd`, e.target.value)} />
            </div>
          )})}

          {error && (
            <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button>
            <Button variant="success-soft" type="submit" loading={loading}>
              {isEdit ? 'Guardar cambios' : 'Crear curso'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
