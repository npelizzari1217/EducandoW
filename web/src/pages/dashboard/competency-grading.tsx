import { useState } from 'react';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { CourseCycleSubjectSelector } from './components/CourseCycleSubjectSelector';
import type { CourseCycleSelectionContext } from './components/CourseCycleSubjectSelector';
import { CompetencyGradingGrid } from './components/CompetencyGradingGrid';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompetencyGradingPage() {
  const [selectionContext, setSelectionContext] = useState<CourseCycleSelectionContext | null>(null);

  return (
    <div>
      <PremiumHeader
        title="Calificación de Competencias"
        subtitle="Seleccioná el ciclo lectivo, el ciclo de curso y la materia para calificar"
        icon="📝"
      />

      {/* Selector */}
      <Card className="mt-md">
        <CourseCycleSubjectSelector onSelect={ctx => setSelectionContext(ctx)} />
      </Card>

      {/* Grid: rendered once selector has emitted a full context */}
      {selectionContext ? (
        <div data-testid="grading-grid-slot" style={{ marginTop: 'var(--space-lg)' }}>
          <CompetencyGradingGrid
            courseCycleId={selectionContext.courseCycleId}
            studyPlanId={selectionContext.studyPlanId}
            studyPlanSubjectId={selectionContext.studyPlanSubjectId}
            level={selectionContext.level}
            modality={selectionContext.modality}
          />
        </div>
      ) : (
        <Card className="mt-lg">
          <p
            data-testid="grading-placeholder"
            style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--space-lg)' }}
          >
            Seleccioná un ciclo lectivo, ciclo de curso y materia para comenzar a calificar.
          </p>
        </Card>
      )}
    </div>
  );
}
