import { type ReactNode, useCallback } from 'react';
import type { InstitutionConfig } from '../../context/institution-context';

/** Resuelve la URL del logo. Paths locales → usa host de API en prod, proxy en dev. */
function resolveLogoUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const apiBase = (import.meta.env.VITE_API_URL as string) || '';
  if (apiBase && apiBase.startsWith('http')) {
    const host = apiBase.replace(/\/v1\/?$/, '');
    return `${host}${url}`;
  }
  return url;
}

export interface PrintBranding {
  /** Logo URL — loaded from institution config */
  logoUrl: string | null;
  /** Header background color */
  headerColor: string | null;
  /** Header text color */
  headerTextColor: string | null;
  /** Body background color */
  bodyColor: string | null;
  /** Body text color */
  bodyTextColor: string | null;
  /** Footer background color */
  footerColor: string | null;
  /** Footer text color */
  footerTextColor: string | null;
  /** Institution name */
  institutionName: string;
}

export interface PrintReportProps {
  branding: PrintBranding;
  /** Nombre del sistema (ej: "Sistema Central de Control de Accesos y Permisos") */
  systemSubtitle: string;
  /** Título central del reporte (ej: "Módulos del Sistema") */
  reportTitle: string;
  /** Fecha de emisión */
  emissionDate?: string;
  /** Contenido del cuerpo (tabla, lista, etc.) */
  children: ReactNode;
  /** Texto legal del pie */
  footerLegalText?: string;
}

export function buildBranding(config: InstitutionConfig): PrintBranding {
  return {
    logoUrl: config.logo_url,
    headerColor: config.header_color ?? '#1e293b',
    headerTextColor: config.header_text_color ?? '#ffffff',
    bodyColor: config.body_color ?? '#ffffff',
    bodyTextColor: config.body_text_color ?? '#1e293b',
    footerColor: config.footer_color ?? '#f1f5f9',
    footerTextColor: config.footer_text_color ?? '#475569',
    institutionName: config.name || 'Institución Educativa',
  };
}

export default function PremiumPrintReport({
  branding,
  systemSubtitle,
  reportTitle,
  emissionDate,
  children,
  footerLegalText,
}: PrintReportProps) {
  const {
    logoUrl,
    headerColor,
    headerTextColor,
    bodyColor,
    bodyTextColor,
    footerColor,
    footerTextColor,
    institutionName,
  } = branding;

  const fecha = emissionDate ?? new Date().toLocaleDateString('es-AR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleDownloadPdf = useCallback(async (openInTab = false) => {
    const element = document.getElementById('print-report');
    if (!element) return;
    const { default: html2pdf } = await import('html2pdf.js');
    const opt = {
      margin:        [7.5, 10, 7.5, 10] as [number, number, number, number],
      filename:      `${reportTitle.replace(/\s+/g, '_')}_${institutionName.replace(/\s+/g, '_')}.pdf`,
      image:         { type: 'jpeg' as const, quality: 0.95 },
      html2canvas:   {
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc: Document) => {
          clonedDoc.querySelectorAll('.ppr-no-print').forEach(el => el.remove());
          const root = clonedDoc.getElementById('print-report');
          if (root) {
            root.style.background = '#ffffff';
            root.style.minHeight = 'auto';
          }
          const page = clonedDoc.querySelector('.ppr-page') as HTMLElement;
          if (page) {
            page.style.boxShadow = 'none';
            page.style.borderRadius = '0';
            page.style.margin = '0';
            page.style.maxWidth = '100%';
            page.style.overflow = 'visible';
          }
        },
      },
      jsPDF:         { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak:     { mode: ['css', 'legacy'] },
    };

    if (openInTab) {
      // Abrir en nueva pestaña para imprimir limpio desde el visor PDF
      const worker = await html2pdf().set(opt).from(element).outputPdf('blob');
      const url = URL.createObjectURL(worker);
      window.open(url, '_blank');
    } else {
      await html2pdf().set(opt).from(element).save();
    }
  }, [reportTitle, institutionName]);

  const legalText = footerLegalText ??
    'Documento generado automáticamente por el sistema de control institucional. ' +
    'Toda reproducción no autorizada constituye una violación a las políticas de seguridad. ' +
    'El acceso a este sistema es monitoreado y registrado.';

  return (
    <div id="print-report" className="ppr-root">
      {/* ── Print-only styles ── */}
      <style>{`
        @page {
          size: A4;
          margin: 7.5mm 10mm 7.5mm 10mm;
        }

        /* Page-break rules: global so html2canvas can see them (not @media print) */
        .ppr-header { page-break-after: avoid; break-after: avoid; }
        .ppr-title-section { page-break-after: avoid; break-after: avoid; }
        .ppr-table { page-break-inside: auto; }
        .ppr-table thead { display: table-header-group; }
        .ppr-table tr { page-break-inside: avoid; break-inside: avoid; }
        .ppr-footer { page-break-before: avoid; break-before: avoid; page-break-inside: avoid; break-inside: avoid; }

        @media print {
          body * { visibility: hidden; }
          #print-report, #print-report * { visibility: visible; }
          #print-report { position: absolute; left: 0; top: 0; width: 100%; }
          .ppr-no-print { display: none !important; }
        }

        /* Screen preview */
        .ppr-root {
          background: #f1f5f9;
          min-height: 100vh;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: ${bodyTextColor};
        }

        .ppr-page {
          max-width: 210mm;
          margin: 2rem auto;
          background: ${bodyColor};
          box-shadow: 0 2px 20px rgba(0,0,0,0.12);
          border-radius: 4px;
          overflow: hidden;
        }

        /* ── Button bar ── */
        .ppr-btn-bar {
          max-width: 210mm;
          margin: 0 auto 1rem auto;
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        .ppr-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.35rem;
          border-radius: 10px;
          font-size: 0.88rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.18s ease;
          letter-spacing: 0.01em;
        }

        .ppr-btn-print {
          background: #eef2ff;
          color: #4f46e5;
          border: 1px solid rgba(99,102,241,0.2);
        }
        .ppr-btn-print:hover {
          background: #e0e7ff;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99,102,241,0.15);
        }

        .ppr-btn-pdf {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid rgba(220,38,38,0.2);
        }
        .ppr-btn-pdf:hover {
          background: #fee2e2;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220,38,38,0.15);
        }

        .ppr-btn-close {
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }
        .ppr-btn-close:hover {
          background: #f1f5f9;
          color: #334155;
        }

        /* ── Header ── */
        .ppr-header {
          background: ${headerColor};
          color: ${headerTextColor};
          padding: 1.4rem 2rem;
          display: table;
          width: 100%;
          box-sizing: border-box;
        }

        .ppr-header-logo-cell {
          display: table-cell;
          width: 90px;
          vertical-align: middle;
        }

        .ppr-header-logo {
          width: 72px;
          height: 72px;
          border-radius: 10px;
          object-fit: contain;
          background: #fff;
          padding: 5px;
          border: 1px solid rgba(0,0,0,0.08);
        }

        .ppr-header-text-cell {
          display: table-cell;
          vertical-align: middle;
          padding-left: 1rem;
        }

        .ppr-header-title {
          font-size: 1.3rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0 0 0.2rem 0;
          line-height: 1.25;
        }

        .ppr-header-subtitle {
          font-size: 0.78rem;
          font-weight: 500;
          opacity: 0.85;
          letter-spacing: 0.02em;
          margin: 0;
        }

        /* ── Title section ── */
        .ppr-title-section {
          padding: 1.4rem 2rem 0.6rem 2rem;
          border-bottom: 2px solid ${headerColor};
        }

        .ppr-report-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: ${headerColor};
          margin: 0 0 0.2rem 0;
        }

        .ppr-report-date {
          font-size: 0.76rem;
          color: #64748b;
          font-weight: 500;
        }

        /* ── Body / table ── */
        .ppr-body {
          padding: 0 2rem 1.5rem 2rem;
        }

        .ppr-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
          margin-top: 1rem;
        }

        .ppr-table thead th {
          background: ${headerColor};
          color: ${headerTextColor};
          padding: 0.7rem 0.85rem;
          text-align: left;
          font-weight: 650;
          font-size: 0.76rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .ppr-table tbody td {
          padding: 0.55rem 0.85rem;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }

        .ppr-table tbody tr:nth-child(even) {
          background: ${adjustOpacity(bodyColor ?? '#ffffff', bodyTextColor ?? '#1e293b', 0.04)};
        }

        .ppr-table tbody tr:nth-child(odd) {
          background: ${bodyColor ?? '#ffffff'};
        }

        .ppr-badge {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 0.15rem 0.6rem;
          border-radius: 5px;
        }

        .ppr-badge-active {
          background: #dcfce7;
          color: #15803d;
        }

        .ppr-badge-inactive {
          background: #f1f5f9;
          color: #64748b;
        }

        /* ── Footer ── */
        .ppr-footer {
          background: ${footerColor};
          color: ${footerTextColor};
          padding: 1rem 2rem;
          font-size: 0.68rem;
          line-height: 1.5;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }

        .ppr-footer strong {
          display: block;
          margin-bottom: 0.3rem;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
      `}</style>

      {/* ── Button bar (hidden on print/PDF) ── */}
      <div className="ppr-btn-bar ppr-no-print">
        <button
          className="ppr-btn ppr-btn-print"
          onClick={() => handleDownloadPdf(true)}
          title="Abre el PDF en una nueva pestaña lista para imprimir"
        >
          🖨 Imprimir
        </button>
        <button
          className="ppr-btn ppr-btn-pdf"
          onClick={() => handleDownloadPdf(false)}
          title="Descarga el archivo PDF directamente"
        >
          📄 Descargar PDF
        </button>
      </div>

      {/* ── Report page ── */}
      <div className="ppr-page">
        {/* Header */}
        <div className="ppr-header">
          {logoUrl && (
            <div className="ppr-header-logo-cell">
              <img className="ppr-header-logo" src={resolveLogoUrl(logoUrl)} alt={institutionName} />
            </div>
          )}
          <div className="ppr-header-text-cell">
            <h1 className="ppr-header-title">{institutionName}</h1>
            <p className="ppr-header-subtitle">{systemSubtitle}</p>
          </div>
        </div>

        {/* Title */}
        <div className="ppr-title-section">
          <h2 className="ppr-report-title">{reportTitle}</h2>
          <p className="ppr-report-date">Fecha de emisión: {fecha}</p>
        </div>

        {/* Body */}
        <div className="ppr-body">
          {children}
        </div>

        {/* Footer */}
        <div className="ppr-footer">
          <strong>Cláusula de Confidencialidad</strong>
          {legalText}
        </div>
      </div>
    </div>
  );
}

/** Helper: generate a semi-transparent version of textColor over backgroundColor */
function adjustOpacity(_bg: string, textColor: string, opacity: number): string {
  // Extract RGB from hex and build rgba
  const r = parseInt(textColor.slice(1, 3), 16);
  const g = parseInt(textColor.slice(3, 5), 16);
  const b = parseInt(textColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
