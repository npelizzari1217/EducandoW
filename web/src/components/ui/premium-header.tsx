import { type ReactNode, useMemo } from 'react';
import { useInstitution } from '../../context/institution-context';

export interface PremiumHeaderStats {
  label: string;
  value: string;
}

interface PremiumHeaderProps {
  title: string;
  subtitle?: string;
  stats?: PremiumHeaderStats[];
  children?: ReactNode;
  icon?: string;
}

export default function PremiumHeader({
  title,
  subtitle,
  stats,
  children,
  icon = '🏫',
}: PremiumHeaderProps) {
  const { config } = useInstitution();
  const institutionName = config.name || 'Institución Educativa';

  const today = useMemo(() => {
    return new Date().toLocaleDateString('es-AR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }, []);

  return (
    <>
      <style>{`
        .mph-header {
          position: relative;
          background: linear-gradient(135deg, #0f2b4a 0%, #1a3c5e 40%, #1e4976 100%);
          border-radius: 20px;
          padding: 2rem 2.5rem;
          margin-bottom: 2rem;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(15, 43, 74, 0.18), 0 2px 8px rgba(15, 43, 74, 0.1);
        }
        .mph-header::before {
          content: '';
          position: absolute; top: -60px; right: -60px;
          width: 260px; height: 260px; border-radius: 50%;
          background: rgba(255,255,255,0.03); pointer-events: none;
        }
        .mph-header::after {
          content: '';
          position: absolute; bottom: -40px; left: 20%;
          width: 180px; height: 180px; border-radius: 50%;
          background: rgba(255,255,255,0.025); pointer-events: none;
        }
        .mph-header-inner {
          position: relative; z-index: 1;
          display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
        }
        .mph-logo {
          width: 64px; height: 64px; border-radius: 16px;
          background: rgba(255,255,255,0.1); backdrop-filter: blur(8px);
          border: 1.5px solid rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem; flex-shrink: 0;
        }
        .mph-info { flex: 1; min-width: 200px; }
        .mph-institution {
          font-size: 0.78rem; font-weight: 500; letter-spacing: 0.08em;
          text-transform: uppercase; color: rgba(255,255,255,0.55);
          margin-bottom: 0.3rem;
        }
        .mph-title {
          font-size: 1.65rem; font-weight: 700; color: #fff;
          margin: 0; line-height: 1.2; letter-spacing: -0.01em;
        }
        .mph-subtitle {
          font-size: 0.82rem; color: rgba(255,255,255,0.5);
          margin-top: 0.35rem; display: flex; align-items: center; gap: 0.5rem;
        }
        .mph-subtitle .dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.25); }
        .mph-actions {
          display: flex; gap: 0.5rem; flex-shrink: 0; margin-left: auto;
        }
        .mph-btn {
          padding: 0.6rem 1.2rem; border-radius: 10px;
          font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer;
          transition: all 0.2s ease; display: flex; align-items: center; gap: 0.35rem;
          white-space: nowrap;
        }
        .mph-btn-print {
          background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.75);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .mph-btn-print:hover { background: rgba(255,255,255,0.14); color: #fff; }
        .mph-btn-primary {
          background: rgba(255,255,255,0.92); color: #0f2b4a;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .mph-btn-primary:hover { background: #fff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
        .mph-btn-cancel {
          background: rgba(239,68,68,0.85); color: #fff;
        }
        .mph-btn-cancel:hover { background: #ef4444; }
        .mph-stats {
          display: flex; gap: 0.35rem; margin-top: 1.5rem;
          position: relative; z-index: 1; flex-wrap: wrap;
        }
        .mph-stat {
          background: rgba(255,255,255,0.07); border-radius: 10px;
          padding: 0.5rem 1rem; font-size: 0.78rem;
          color: rgba(255,255,255,0.6); backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .mph-stat strong { color: #fff; font-weight: 700; }

        @media (max-width: 700px) {
          .mph-header { padding: 1.5rem 1.25rem; border-radius: 14px; }
          .mph-header-inner { gap: 1rem; }
          .mph-title { font-size: 1.35rem; }
          .mph-logo { width: 48px; height: 48px; font-size: 1.3rem; border-radius: 12px; }
          .mph-actions { margin-left: 0; width: 100%; justify-content: flex-end; }
        }

        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="mph-header no-print">
        <div className="mph-header-inner">
          <div className="mph-logo" title={institutionName}>{icon}</div>
          <div className="mph-info">
            <div className="mph-institution">{institutionName}</div>
            <h1 className="mph-title">{title}</h1>
            {subtitle && (
              <div className="mph-subtitle">
                {today}
                <span className="dot" />
                {subtitle}
              </div>
            )}
            {!subtitle && (
              <div className="mph-subtitle">{today}</div>
            )}
          </div>
          {children && <div className="mph-actions">{children}</div>}
        </div>
        {stats && stats.length > 0 && (
          <div className="mph-stats">
            {stats.map((s) => (
              <div key={s.label} className="mph-stat">
                <strong>{s.value}</strong> {s.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
