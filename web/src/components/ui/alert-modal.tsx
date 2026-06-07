import { useId } from 'react';
import { Button } from './button';

interface AlertModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function AlertModal({ open, title, message, onClose }: AlertModalProps) {
  const titleId = useId();
  const messageId = useId();

  if (!open) return null;

  return (
    <div
      data-testid="alert-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 420,
          width: '90%',
          backgroundColor: 'var(--color-surface, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.2))',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span aria-hidden="true" style={{ color: 'var(--color-warning, #f59e0b)', fontSize: '1.25rem' }}>&#9888;</span>
          <h2 id={titleId} style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
        </div>
        <p id={messageId} style={{ margin: 0, color: 'var(--color-text-secondary, #6b7280)' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={onClose}>
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
