import PremiumPrintReport, { type PrintBranding } from './PremiumPrintReport';

interface UserRow {
  name: string;
  email: string;
  institution: string;
  role: string;
  level: string;
  active: boolean;
}

interface Props {
  branding: PrintBranding;
  users: UserRow[];
  onClose?: () => void;
}

export default function UserPrintView({ branding, users, onClose }: Props) {
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
        systemSubtitle="Sistema Central de Control de Accesos y Permisos"
        reportTitle="Usuarios del Sistema"
        footerLegalText="Documento confidencial del sistema EducandoW. Contiene información de acceso restringido. La distribución no autorizada de este documento constituye una violación a la Ley de Protección de Datos Personales."
      >
        <table className="ppr-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Institución</th>
              <th>Rol</th>
              <th>Nivel educativo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td style={{ fontSize: '0.78rem', color: '#4f46e5' }}>{u.email}</td>
                <td>{u.institution || '-'}</td>
                <td>{u.role || '-'}</td>
                <td>{u.level || '-'}</td>
                <td>
                  <span className={`ppr-badge ${u.active ? 'ppr-badge-active' : 'ppr-badge-inactive'}`}>
                    {u.active ? 'Activo' : 'Inactivo'}
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
