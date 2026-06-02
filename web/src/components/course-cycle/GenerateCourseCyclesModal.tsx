import { useState, useEffect } from 'react';
import type { GenerateCourseCyclesDto, GenerateResult } from '../../types/course-cycle';
import apiClient from '../../api/client';

interface GenerateCourseCyclesModalProps {
  open: boolean;
  onClose: () => void;
  onGenerated: (result: GenerateResult) => void;
}

interface SelectOption {
  id: string;
  name: string;
}

export default function GenerateCourseCyclesModal({ open, onClose, onGenerated }: GenerateCourseCyclesModalProps) {
  const [plans, setPlans] = useState<SelectOption[]>([]);
  const [cycles, setCycles] = useState<SelectOption[]>([]);
  const [studyPlanId, setStudyPlanId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      apiClient.get('/study-plans?limit=100').then((r) => setPlans(r.data?.data ?? []));
      apiClient.get('/academic-cycles?limit=100').then((r) => setCycles(r.data?.data ?? []));
      setStudyPlanId('');
      setCycleId('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!studyPlanId || !cycleId) {
      setError('Seleccioná un plan de estudio y un ciclo lectivo');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const dto: GenerateCourseCyclesDto = { studyPlanId, cycleId };
      const res = await apiClient.post('/v1/course-cycles/generate', dto);
      const result = res.data?.data as GenerateResult;
      onGenerated(result);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Error al generar cursos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Generar Cursos por Ciclo</h3>
        <div className="flex flex-col gap-3">
          <label>
            Plan de Estudio
            <select value={studyPlanId} onChange={(e) => setStudyPlanId(e.target.value)} className="w-full border rounded p-1 mt-1">
              <option value="">Seleccionar...</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            Ciclo Lectivo
            <select value={cycleId} onChange={(e) => setCycleId(e.target.value)} className="w-full border rounded p-1 mt-1">
              <option value="">Seleccionar...</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1 border rounded">Cancelar</button>
          <button onClick={handleGenerate} disabled={loading} className="px-4 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
            {loading ? 'Generando...' : 'Generar Cursos'}
          </button>
        </div>
      </div>
    </div>
  );
}
