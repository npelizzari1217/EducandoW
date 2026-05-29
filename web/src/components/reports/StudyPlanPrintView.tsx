import PremiumPrintReport, { type PrintBranding } from './PremiumPrintReport';

interface StudyPlanRow {
  name: string;
  level: string;
  modality: string;
  academicYear: string;
  coursesCount: number;
  subjectsCount: number;
  active: boolean;
}

interface Props {
  branding: PrintBranding;
  studyPlans: StudyPlanRow[];
  onClose?: () => void;
}

const LEVEL_NAMES: Record<number, string> = {
  1: 'Inicial', 2: 'Primario', 3: 'Secundario', 4: 'Terciario', 9: 'Administración',
};

const MODALITY_NAMES: Record<number, string> = {
  0: 'Común', 1: 'Adultos', 2: 'Especial', 9: 'Todas',
};

export default function StudyPlanPrintView({ branding, studyPlans, onClose }: Props) {
  return (
    <div style={{ position: 'relative' }}>
      {onClose && (
        <div className="ppr-no-print" style={{
          maxWidth: '210mm', margin: '0 auto 0.5rem auto',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0',
              background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem',
            }}
          >
            ← Volver
          </button>
        </div>
      )}

      <PremiumPrintReport
        branding={branding}
        systemSubtitle="Sistema de Gestión Pedagógica y Administrativa"
        reportTitle="Planes de Estudio"
        footerLegalText="Documento oficial del sistema EducandoW. Los planes de estudio aquí listados están aprobados por la autoridad educativa competente. Toda modificación debe ser registrada y auditada por el sistema central."
      >
        <table className="ppr-table">
          <thead>
            <tr>
              <th>Plan de estudio</th>
              <th>Nivel</th>
              <th>Modalidad</th>
              <th>Año lectivo</th>
              <th>Cursos</th>
              <th>Materias</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {studyPlans.map((sp, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{sp.name}</td>
                <td>{LEVEL_NAMES[Number(sp.level)] ?? sp.level}</td>
                <td>{MODALITY_NAMES[Number(sp.modality)] ?? sp.modality}</td>
                <td>{sp.academicYear}</td>
                <td style={{ textAlign: 'center' }}>{sp.coursesCount}</td>
                <td style={{ textAlign: 'center' }}>{sp.subjectsCount}</td>
                <td>
                  <span className={`ppr-badge ${sp.active ? 'ppr-badge-active' : 'ppr-badge-inactive'}`}>
                    {sp.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PremiumPrintReport>
    </div>
  );
}
