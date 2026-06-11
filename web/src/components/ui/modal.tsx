import { useId, useEffect } from 'react';
import { Button } from './button';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const SIZE_MAP: Record<'md' | 'lg' | 'xl', number> = {
  md: 480,
  lg: 720,
  xl: 960,
};

export function Modal({ open, title, onClose, children, size = 'xl' }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = SIZE_MAP[size];

  return (
    <div
      data-testid="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        data-testid="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth,
          width: '90%',
          maxHeight: '85vh',
          backgroundColor: 'var(--color-surface, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.2))',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <h2
            id={titleId}
            style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}
          >
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>

        {/* Body */}
        <div
          style={{
            overflow: 'auto',
            padding: '1rem 1.25rem',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
