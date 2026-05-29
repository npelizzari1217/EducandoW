import PremiumPrintReport, { type PrintBranding } from './PremiumPrintReport';

interface StudentRow {
  firstName: string;
  lastName: string;
  dni: string;
  grade: string;
  division: string;
  status: string;
  enrollmentYear: string;
  guardianName: string;
  guardianPhone: string;
}

interface Props {
  branding: PrintBranding;
  students: StudentRow[];
  onClose?: () => void;
}

export default function StudentPrintView({ branding, students, onClose }: Props) {
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
        reportTitle="Legajo de Alumnos"
        footerLegalText="Documento oficial del sistema EducandoW. Los datos aquí consignados están protegidos por la Ley de Protección de Datos Personales. Su uso está limitado al ámbito institucional autorizado."
      >
        <table className="ppr-table">
          <thead>
            <tr>
              <th>Apellido y Nombre</th>
              <th>DNI</th>
              <th>Curso</th>
              <th>División</th>
              <th>Estado</th>
              <th>Año</th>
              <th>Tutor</th>
              <th>Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{s.lastName}, {s.firstName}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.dni}</td>
                <td>{s.grade || '-'}</td>
                <td>{s.division || '-'}</td>
                <td>
                  <span className={`ppr-badge ${s.status === 'ACTIVE' ? 'ppr-badge-active' : 'ppr-badge-inactive'}`}>
                    {s.status === 'ACTIVE' ? 'Activo' : s.status}
                  </span>
                </td>
                <td>{s.enrollmentYear}</td>
                <td>{s.guardianName || '-'}</td>
                <td style={{ fontSize: '0.78rem' }}>{s.guardianPhone || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PremiumPrintReport>
    </div>
  );
}
