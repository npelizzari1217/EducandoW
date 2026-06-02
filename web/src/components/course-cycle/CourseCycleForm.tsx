import { useState, useEffect } from 'react';
import type { CreateCourseCycleDto, UpdateCourseCycleDto, CourseCycle } from '../../types/course-cycle';
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

export default function CourseCycleForm({ initial, onSubmit, onCancel, loading, error }: CourseCycleFormProps) {
  const isEdit = !!initial;

  const [courses, setCourses] = useState<SelectOption[]>([]);
  const [plans, setPlans] = useState<SelectOption[]>([]);
  const [cycles, setCycles] = useState<SelectOption[]>([]);

  const [form, setForm] = useState({
    courseId: initial?.courseId ?? '',
    studyPlanId: initial?.studyPlanId ?? '',
    cycleId: initial?.cycleId ?? '',
    courseName: initial?.courseName ?? '',
    level: LEVEL_OPTIONS.find((_, i) => `INICIAL PRIMARIO SECUNDARIO TERCIARIO`.split(' ')[i] === initial?.level) ?? 'PRIMARIO',
    passingGrade: initial?.passingGrade ?? 6,
    promotionText: initial?.promotionText ?? '',
    firstBimonthStart: initial?.firstBimonthStart?.split('T')[0] ?? '',
    firstBimonthEnd: initial?.firstBimonthEnd?.split('T')[0] ?? '',
    secondBimonthStart: initial?.secondBimonthStart?.split('T')[0] ?? '',
    secondBimonthEnd: initial?.secondBimonthEnd?.split('T')[0] ?? '',
    thirdBimonthStart: initial?.thirdBimonthStart?.split('T')[0] ?? '',
    thirdBimonthEnd: initial?.thirdBimonthEnd?.split('T')[0] ?? '',
    fourthBimonthStart: initial?.fourthBimonthStart?.split('T')[0] ?? '',
    fourthBimonthEnd: initial?.fourthBimonthEnd?.split('T')[0] ?? '',
  });

  // Load combobox data
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

  const update = (field: string, value: string | number) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 p-4 border rounded-lg bg-card">
      {!isEdit && (
        <>
          <label className="col-span-1">
            Curso
            <select value={form.courseId} onChange={(e) => update('courseId', e.target.value)} className="w-full border rounded p-1" required>
              <option value="">Seleccionar...</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="col-span-1">
            Plan de Estudio
            <select value={form.studyPlanId} onChange={(e) => update('studyPlanId', e.target.value)} className="w-full border rounded p-1" required>
              <option value="">Seleccionar...</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="col-span-1">
            Ciclo Lectivo
            <select value={form.cycleId} onChange={(e) => update('cycleId', e.target.value)} className="w-full border rounded p-1" required>
              <option value="">Seleccionar...</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </>
      )}
      <label className="col-span-1">
        Nombre del Curso
        <input type="text" value={form.courseName} onChange={(e) => update('courseName', e.target.value)} className="w-full border rounded p-1" required />
      </label>
      {!isEdit && (
        <label className="col-span-1">
          Nivel
          <select value={form.level} onChange={(e) => update('level', e.target.value)} className="w-full border rounded p-1" required>
            {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      )}
      <label className="col-span-1">
        Nota de Aprobación (1-10)
        <input type="number" min={1} max={10} step={0.5} value={form.passingGrade} onChange={(e) => update('passingGrade', parseFloat(e.target.value))} className="w-full border rounded p-1" required />
      </label>
      <label className="col-span-2">
        Texto de Promoción
        <input type="text" value={form.promotionText} onChange={(e) => update('promotionText', e.target.value)} className="w-full border rounded p-1" />
      </label>
      {['first', 'second', 'third', 'fourth'].map((bim, i) => (
        <div key={bim} className="col-span-2 grid grid-cols-2 gap-2 border-t pt-2 mt-1">
          <label>
            {bim.charAt(0).toUpperCase() + bim.slice(1)} Bimestre Inicio
            <input type="date" value={(form as any)[`${bim}BimonthStart`]} onChange={(e) => update(`${bim}BimonthStart`, e.target.value)} className="w-full border rounded p-1" required />
          </label>
          <label>
            {bim.charAt(0).toUpperCase() + bim.slice(1)} Bimestre Fin
            <input type="date" value={(form as any)[`${bim}BimonthEnd`]} onChange={(e) => update(`${bim}BimonthEnd`, e.target.value)} className="w-full border rounded p-1" required />
          </label>
        </div>
      ))}
      {error && <p className="col-span-2 text-red-500 text-sm">{error}</p>}
      <div className="col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-1 border rounded">Cancelar</button>
        <button type="submit" disabled={loading} className="px-4 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
          {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </form>
  );
}
