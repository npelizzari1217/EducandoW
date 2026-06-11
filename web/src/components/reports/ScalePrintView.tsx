import PremiumPrintReport, { type PrintBranding } from './PremiumPrintReport';

interface ScaleValueRow {
  code: string;
  label: string;
  internal_status: string;
  sort_order: number;
}

interface ScaleRow {
  id: string;
  name: string;
  level: number;
  modality: number;
  active: boolean;
  values: ScaleValueRow[];
}

interface Props {
  branding: PrintBranding;
  scales: ScaleRow[];
  levelLabels: Record<number, string>;
  modalityLabels: Record<number, string>;
  statusLabels: Record<string, string>;
  onClose?: () => void;
}

export default function ScalePrintView({
  branding,
  scales,
  levelLabels,
  modalityLabels,
  statusLabels,
  onClose,
}: Props) {
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
        systemSubtitle="Sistema de Gestión Académica"
        reportTitle="Escalas de Calificación"
        footerLegalText="Documento oficial del sistema EducandoW. Las escalas de calificación aquí listadas rigen la valoración académica de la institución."
      >
        {scales.length === 0 && (
          <p style={{ color: '#64748b' }}>No hay escalas de calificación para imprimir.</p>
        )}
        {scales.map((s) => (
          <div key={s.id} style={{ marginBottom: '1.6rem', breakInside: 'avoid' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: '#1e293b' }}>
              {s.name}
              <span style={{ fontWeight: 500, color: '#64748b' }}>
                {'  —  '}{levelLabels[s.level] ?? s.level} · {modalityLabels[s.modality] ?? s.modality}
                {!s.active && '  ·  (Inactiva)'}
              </span>
            </h3>
            <table className="ppr-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Etiqueta</th>
                  <th>Estado interno</th>
                  <th>Orden</th>
                </tr>
              </thead>
              <tbody>
                {[...s.values]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((v) => (
                    <tr key={v.code + v.sort_order}>
                      <td style={{ fontWeight: 600 }}>{v.code}</td>
                      <td>{v.label}</td>
                      <td style={{ color: '#475569' }}>{statusLabels[v.internal_status] ?? v.internal_status}</td>
                      <td>{v.sort_order}</td>
                    </tr>
                  ))}
                {s.values.length === 0 && (
                  <tr><td colSpan={4} style={{ color: '#94a3b8' }}>Sin valores cargados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </PremiumPrintReport>
    </div>
  );
}
