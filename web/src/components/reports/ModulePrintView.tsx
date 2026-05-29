import PremiumPrintReport, { type PrintBranding } from './PremiumPrintReport';

interface ModuleRow {
  code: string;
  name: string;
  description: string;
  active: boolean;
}

interface Props {
  branding: PrintBranding;
  modules: ModuleRow[];
  onClose?: () => void;
}

export default function ModulePrintView({ branding, modules, onClose }: Props) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Overlay close button */}
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
        reportTitle="Módulos del Sistema"
        footerLegalText="Documento oficial del sistema EducandoW. El acceso a los módulos aquí listados es auditado y registrado en el servidor central. Todo uso indebido será sancionado según normativa vigente."
      >
        <table className="ppr-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre del módulo</th>
              <th>Área funcional</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.code}>
                <td><span className="ppr-badge" style={{ background: '#eef2ff', color: '#4f46e5' }}>{m.code}</span></td>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td style={{ color: '#475569' }}>{m.description}</td>
                <td>
                  <span className={`ppr-badge ${m.active ? 'ppr-badge-active' : 'ppr-badge-inactive'}`}>
                    {m.active ? 'Activo' : 'Inactivo'}
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
